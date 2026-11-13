<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class GmailApiDelivery
{
    public static function send(array $recipients, $subject, $html, $text)
    {
        $clientId = trim((string) (
            getenv('GMAIL_OAUTH_CLIENT_ID') ?: getenv('GOOGLE_OAUTH_CLIENT_ID')
        ));
        $clientSecret = trim((string) (
            getenv('GMAIL_OAUTH_CLIENT_SECRET') ?: getenv('GOOGLE_OAUTH_CLIENT_SECRET')
        ));
        $refreshToken = trim((string) getenv('GMAIL_OAUTH_REFRESH_TOKEN'));
        $fromEmail = trim((string) (
            getenv('GMAIL_FROM_EMAIL') ?: getenv('MAIL_USERNAME')
        ));
        $fromName = trim((string) (getenv('GMAIL_FROM_NAME') ?: 'CampusConnect'));

        if (
            $clientId === '' ||
            $clientSecret === '' ||
            $refreshToken === '' ||
            !filter_var($fromEmail, FILTER_VALIDATE_EMAIL)
        ) {
            return 'Set the Gmail OAuth client ID, client secret, refresh token, and sender address in the backend environment.';
        }

        if (!$recipients) {
            return 'Gmail delivery requires at least one recipient.';
        }

        $client = new Google\Client();
        $client->setClientId($clientId);
        $client->setClientSecret($clientSecret);
        $client->setScopes([Google\Service\Gmail::GMAIL_SEND]);
        $client->setAccessType('offline');

        try {
            $token = $client->fetchAccessTokenWithRefreshToken($refreshToken);
            if (!empty($token['error'])) {
                $detail = trim((string) (
                    $token['error_description'] ?? $token['error']
                ));
                error_log('GmailApiDelivery token refresh failed: ' . $detail);
                return 'Gmail authorization failed. Check the client credentials, refresh token, and Gmail send permission.';
            }

            $client->setAccessToken($token);
            $service = new Google\Service\Gmail($client);
            $message = new Google\Service\Gmail\Message();
            $message->setRaw(self::build_raw_message(
                $recipients,
                $subject,
                $html,
                $text,
                $fromEmail,
                $fromName
            ));

            $sent = $service->users_messages->send('me', $message);
            if (!$sent || !$sent->getId()) {
                error_log('GmailApiDelivery returned success without a message ID.');
                return 'Gmail did not confirm the email request. Check the backend logs.';
            }
        } catch (Throwable $e) {
            error_log(
                'GmailApiDelivery failed (' . get_class($e) . '): ' .
                $e->getMessage()
            );
            return 'Gmail API could not send the email. Check that the Gmail API is enabled and the OAuth account has send permission.';
        }

        return null;
    }

    private static function build_raw_message(
        array $recipients,
        $subject,
        $html,
        $text,
        $fromEmail,
        $fromName
    ) {
        $fromName = str_replace(["\r", "\n"], '', (string) $fromName);
        $boundary = 'campusconnect_' . bin2hex(random_bytes(16));
        $headers = [
            'From: =?UTF-8?B?' . base64_encode($fromName) . '?= <' . $fromEmail . '>',
            'To: ' . array_shift($recipients),
            'Subject: =?UTF-8?B?' . base64_encode(
                str_replace(["\r", "\n"], '', (string) $subject)
            ) . '?=',
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"'
        ];

        if ($recipients) {
            $headers[] = 'Bcc: ' . implode(', ', $recipients);
        }

        $body = '--' . $boundary . "\r\n" .
            "Content-Type: text/plain; charset=UTF-8\r\n" .
            "Content-Transfer-Encoding: base64\r\n\r\n" .
            chunk_split(base64_encode((string) $text)) .
            '--' . $boundary . "\r\n" .
            "Content-Type: text/html; charset=UTF-8\r\n" .
            "Content-Transfer-Encoding: base64\r\n\r\n" .
            chunk_split(base64_encode((string) $html)) .
            '--' . $boundary . "--\r\n";

        $raw = implode("\r\n", $headers) . "\r\n\r\n" . $body;

        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    }
}
