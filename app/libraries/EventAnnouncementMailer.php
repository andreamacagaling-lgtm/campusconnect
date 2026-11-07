<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\PHPMailer;

class EventAnnouncementMailer
{
    public function send(
        $title,
        $content,
        array $event,
        array $recipients,
        $notificationType = 'registration_open'
    )
    {
        require_once ROOT_DIR . 'vendor/autoload.php';

        $username = trim((string) (getenv('SMTP_USERNAME') ?: getenv('MAIL_USERNAME')));
        $password = (string) (getenv('SMTP_PASSWORD') ?: getenv('MAIL_PASSWORD'));
        $host = trim((string) (getenv('SMTP_HOST') ?: 'smtp.gmail.com'));
        $fromEmail = trim((string) (getenv('SMTP_FROM_EMAIL') ?: $username));
        $fromName = trim((string) (getenv('SMTP_FROM_NAME') ?: 'CampusConnect'));
        $portalUrl = rtrim(trim((string) getenv('STUDENT_PORTAL_URL')), '/');
        $port = filter_var(
            getenv('SMTP_PORT') ?: '587',
            FILTER_VALIDATE_INT,
            ['options' => ['min_range' => 1, 'max_range' => 65535]]
        );
        $encryption = strtolower(trim((string) (getenv('SMTP_ENCRYPTION') ?: 'tls')));
        $portalUrlParts = $portalUrl === '' ? false : parse_url($portalUrl);

        if (
            $username === '' ||
            $password === '' ||
            !$port ||
            !filter_var($fromEmail, FILTER_VALIDATE_EMAIL) ||
            (
                $portalUrl !== '' &&
                (
                    !filter_var($portalUrl, FILTER_VALIDATE_URL) ||
                    !is_array($portalUrlParts) ||
                    !in_array(
                        strtolower((string) ($portalUrlParts['scheme'] ?? '')),
                        ['http', 'https'],
                        true
                    ) ||
                    empty($portalUrlParts['host'])
                )
            ) ||
            !in_array($encryption, ['tls', 'ssl'], true)
        ) {
            throw new RuntimeException(
                'Mail credentials, sender, encryption, port, and any configured student portal URL must be valid.'
            );
        }

        $validRecipients = [];
        $invalidEmails = [];
        $failed = 0;
        foreach ($recipients as $recipient) {
            $email = strtolower(trim((string) $recipient));
            if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $validRecipients[$email] = true;
            } else {
                $failed++;
                $invalidEmails[] = $email;
            }
        }
        $validRecipients = array_keys($validRecipients);

        if (!$validRecipients) {
            return [
                'sent' => 0,
                'failed' => $failed,
                'sent_emails' => [],
                'failed_emails' => [],
                'invalid_emails' => $invalidEmails
            ];
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
        $isEventStart = $notificationType === 'event_start';
        $mailer->Subject = ($isEventStart ? 'Event is starting: ' : 'Registration is open: ') .
            $title;
        $mailer->Body = $this->build_html(
            $title,
            $content,
            $event,
            $portalUrl,
            $isEventStart
        );
        $mailer->AltBody = $this->build_text(
            $title,
            $content,
            $event,
            $portalUrl,
            $isEventStart
        );

        $sent = 0;
        $sentEmails = [];
        $failedEmails = [];
        foreach (array_chunk($validRecipients, 40) as $batchIndex => $batch) {
            try {
                $mailer->clearAllRecipients();
                foreach ($batch as $email) {
                    $mailer->addBCC($email);
                }

                $mailer->send();
                $sent += count($batch);
                $sentEmails = array_merge($sentEmails, $batch);
            } catch (Exception $e) {
                $failed += count($batch);
                $failedEmails = array_merge($failedEmails, $batch);
                error_log(
                    'EventAnnouncementMailer batch ' . ($batchIndex + 1) .
                    ' failed: ' . $mailer->ErrorInfo
                );
            }
        }

        $mailer->smtpClose();

        return [
            'sent' => $sent,
            'failed' => $failed,
            'sent_emails' => $sentEmails,
            'failed_emails' => $failedEmails,
            'invalid_emails' => $invalidEmails
        ];
    }

    private function build_html(
        $title,
        $content,
        array $event,
        $portalUrl,
        $isEventStart
    )
    {
        $escapedTitle = $this->escape($title);
        $escapedBody = nl2br($this->escape($content));
        $eventTitle = $this->escape($event['title'] ?? '');
        $venue = $this->escape($event['venue'] ?? '');
        $schedule = $this->escape(
            $this->format_event_date($event['start_datetime'] ?? '')
        );
        $eventUrl = $portalUrl === ''
            ? ''
            : $this->escape(
                $portalUrl . '?event_id=' . (int) $event['event_id']
            );

        return '<!doctype html><html><body style="margin:0;padding:24px;background:#f4f7f5;font-family:Arial,sans-serif;color:#1d2c24;">' .
            '<div style="max-width:600px;margin:0 auto;padding:24px;border:1px solid #e3ebe4;border-radius:12px;background:#fff;">' .
            '<p style="margin:0 0 8px;color:#216b43;font-size:12px;font-weight:bold;">' .
            ($isEventStart ? 'CAMPUSCONNECT EVENT STARTING' : 'CAMPUSCONNECT REGISTRATION OPEN') .
            '</p>' .
            '<h1 style="margin:0 0 16px;font-size:22px;">' . $escapedTitle . '</h1>' .
            '<p style="line-height:1.6;">' . $escapedBody . '</p>' .
            '<div style="margin:20px 0;padding:16px;border-radius:8px;background:#f4f8f5;">' .
            '<h2 style="margin:0 0 8px;font-size:18px;">' . $eventTitle . '</h2>' .
            '<p style="margin:0 0 6px;">' . $schedule . '</p>' .
            '<p style="margin:0;">' . $venue . '</p></div>' .
            ($eventUrl === ''
                ? ''
                : '<a href="' . $eventUrl . '" style="display:inline-block;padding:12px 18px;border-radius:7px;background:#216b43;color:#fff;text-decoration:none;font-weight:bold;">' .
                    ($isEventStart ? 'View event details' : 'View event and register') .
                    '</a>') .
            '</div></body></html>';
    }

    private function build_text(
        $title,
        $content,
        array $event,
        $portalUrl,
        $isEventStart
    )
    {
        return $title . "\n\n" . $content . "\n\n" .
            ($event['title'] ?? '') . "\n" .
            $this->format_event_date($event['start_datetime'] ?? '') . "\n" .
            ($event['venue'] ?? '') .
            ($portalUrl === ''
                ? ''
                : "\n\n" .
                    ($isEventStart ? 'View event details: ' : 'View event and register: ') .
                    $portalUrl . '?event_id=' . (int) $event['event_id']);
    }

    private function format_event_date($value)
    {
        $timestamp = strtotime((string) $value);
        return $timestamp === false
            ? (string) $value
            : date('M j, Y g:i A', $timestamp);
    }

    private function escape($value)
    {
        return htmlspecialchars(
            (string) $value,
            ENT_QUOTES | ENT_SUBSTITUTE,
            'UTF-8'
        );
    }
}
