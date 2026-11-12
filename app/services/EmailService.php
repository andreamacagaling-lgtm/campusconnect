<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\PHPMailer;

class EmailService
{
    public static function sendEmail($recipient, $subject, $title, $content)
    {
        $result = self::sendEmails(
            [$recipient],
            $subject,
            $title,
            $content
        );

        return $result['success'] && $result['sent'] === 1;
    }

    public static function sendEmails(
        array $recipients,
        $subject,
        $title,
        $content,
        array $excludeRecipients = []
    ) {
        $excluded = [];
        foreach ($excludeRecipients as $email) {
            $excluded[strtolower(trim((string) $email))] = true;
        }

        $validRecipients = [];
        $invalidCount = 0;
        $alreadyNotifiedCount = 0;
        foreach ($recipients as $recipient) {
            $email = strtolower(trim((string) $recipient));
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $invalidCount++;
                continue;
            }
            if (isset($excluded[$email])) {
                $alreadyNotifiedCount++;
                continue;
            }
            $validRecipients[$email] = true;
        }
        $validRecipients = array_keys($validRecipients);

        if (!$validRecipients) {
            return [
                'success' => $invalidCount === 0 && $alreadyNotifiedCount > 0,
                'sent' => 0,
                'failed' => $invalidCount,
                'message' => $alreadyNotifiedCount > 0
                    ? 'All recipients already received the event announcement.'
                    : ($invalidCount === 0
                        ? 'No active registered account email addresses were found.'
                        : 'No valid recipient email addresses were found.')
            ];
        }

        $autoload = ROOT_DIR . 'vendor/autoload.php';
        if (!is_file($autoload)) {
            error_log('EmailService: Composer autoload file was not found.');
            return self::failed_delivery(
                count($validRecipients) + $invalidCount,
                'Email delivery is unavailable.'
            );
        }
        require_once $autoload;

        $transport = strtolower(trim((string) (getenv('MAIL_TRANSPORT') ?: 'smtp')));
        if ($transport === 'resend') {
            return self::send_via_api(
                $validRecipients,
                $invalidCount,
                $subject,
                $title,
                $content
            );
        }

        if ($transport !== 'smtp') {
            return self::failed_delivery(
                count($validRecipients) + $invalidCount,
                'MAIL_TRANSPORT must be set to smtp or resend.'
            );
        }

        $username = trim((string) (getenv('SMTP_USERNAME') ?: getenv('MAIL_USERNAME')));
        $password = (string) (getenv('SMTP_PASSWORD') ?: getenv('MAIL_PASSWORD'));
        $host = trim((string) (getenv('SMTP_HOST') ?: 'smtp.gmail.com'));
        $fromEmail = trim((string) (getenv('SMTP_FROM_EMAIL') ?: $username));
        $fromName = trim((string) (getenv('SMTP_FROM_NAME') ?: 'CampusConnect'));
        $port = filter_var(
            getenv('SMTP_PORT') ?: '587',
            FILTER_VALIDATE_INT,
            ['options' => ['min_range' => 1, 'max_range' => 65535]]
        );
        $encryption = strtolower(trim((string) (getenv('SMTP_ENCRYPTION') ?: 'tls')));

        if (
            $username === '' ||
            $password === '' ||
            !$port ||
            !filter_var($fromEmail, FILTER_VALIDATE_EMAIL) ||
            !in_array($encryption, ['tls', 'ssl'], true)
        ) {
            error_log('EmailService: SMTP credentials or mail settings are missing or invalid.');
            return self::failed_delivery(
                count($validRecipients) + $invalidCount,
                'Email delivery is not configured correctly. Set valid SMTP credentials and mail settings in the backend environment.'
            );
        }

        $mailer = new PHPMailer(true);
        $mailer->isSMTP();
        $mailer->Host = $host;
        $mailer->Port = $port;
        $mailer->SMTPAuth = true;
        $mailer->Username = $username;
        $mailer->Password = $password;
        $mailer->SMTPSecure = $encryption === 'ssl'
            ? PHPMailer::ENCRYPTION_SMTPS
            : PHPMailer::ENCRYPTION_STARTTLS;
        $mailer->Timeout = 20;
        $mailer->SMTPKeepAlive = true;
        $mailer->CharSet = PHPMailer::CHARSET_UTF8;
        $mailer->isHTML(true);
        $mailer->setFrom($fromEmail, $fromName);

        $safeTitle = htmlspecialchars(
            (string) $title,
            ENT_QUOTES | ENT_SUBSTITUTE,
            'UTF-8'
        );
        $safeContent = nl2br(htmlspecialchars(
            (string) $content,
            ENT_QUOTES | ENT_SUBSTITUTE,
            'UTF-8'
        ));
        $mailer->Subject = (string) $subject;
        $mailer->Body = '<!doctype html><html><body>' .
            '<h2>CampusConnect</h2><h3>' . $safeTitle . '</h3>' .
            '<p>' . $safeContent . '</p>' .
            '<p>Log in to CampusConnect to read the announcement.</p>' .
            '</body></html>';
        $mailer->AltBody = (string) $title . "\n\n" . (string) $content .
            "\n\nLog in to CampusConnect to read the announcement.";

        $sent = 0;
        $failed = $invalidCount;
        foreach (array_chunk($validRecipients, 40) as $batchIndex => $batch) {
            try {
                $mailer->clearAllRecipients();
                foreach ($batch as $email) {
                    $mailer->addBCC($email);
                }
                $mailer->send();
                $sent += count($batch);
            } catch (Exception $e) {
                $failed += count($batch);
                error_log(
                    'EmailService batch ' . ($batchIndex + 1) .
                    ' failed: ' . $mailer->ErrorInfo
                );
            }
        }
        $mailer->smtpClose();

        return [
            'success' => $failed === 0,
            'sent' => $sent,
            'failed' => $failed,
            'message' => $failed === 0
                ? 'Announcement email sent.'
                : 'Some announcement emails could not be delivered. Check the backend SMTP settings and server logs.'
        ];
    }

    private static function failed_delivery($failed, $message)
    {
        return [
            'success' => false,
            'sent' => 0,
            'failed' => $failed,
            'message' => $message
        ];
    }

    private static function send_via_api(
        array $recipients,
        $invalidCount,
        $subject,
        $title,
        $content
    ) {
        require_once APP_DIR . 'libraries/EmailApiDelivery.php';

        $safeTitle = htmlspecialchars(
            (string) $title,
            ENT_QUOTES | ENT_SUBSTITUTE,
            'UTF-8'
        );
        $safeContent = nl2br(htmlspecialchars(
            (string) $content,
            ENT_QUOTES | ENT_SUBSTITUTE,
            'UTF-8'
        ));
        $html = '<!doctype html><html><body>' .
            '<h2>CampusConnect</h2><h3>' . $safeTitle . '</h3>' .
            '<p>' . $safeContent . '</p>' .
            '<p>Log in to CampusConnect to read the announcement.</p>' .
            '</body></html>';
        $text = (string) $title . "\n\n" . (string) $content .
            "\n\nLog in to CampusConnect to read the announcement.";

        $sent = 0;
        $failed = $invalidCount;
        $firstError = null;
        foreach (array_chunk($recipients, 40) as $batchIndex => $batch) {
            $error = EmailApiDelivery::send($batch, $subject, $html, $text);
            if ($error === null) {
                $sent += count($batch);
                continue;
            }

            $failed += count($batch);
            $firstError = $firstError ?? $error;
            error_log(
                'EmailService API batch ' . ($batchIndex + 1) .
                ' failed: ' . $error
            );
        }

        return [
            'success' => $failed === 0,
            'sent' => $sent,
            'failed' => $failed,
            'message' => $failed === 0
                ? 'Announcement email sent.'
                : 'Some announcement emails could not be delivered. ' .
                    ($firstError ?? 'Check the backend logs.')
        ];
    }
}
