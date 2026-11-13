
<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class GoogleAppsScriptDelivery
{
    public static function send(
        array $recipients,
        $subject,
        $html,
        $text
    ) {
        $url = trim((string) getenv('GOOGLE_APPS_SCRIPT_URL'));
        $secret = trim((string) getenv('GOOGLE_APPS_SCRIPT_SECRET'));

        if ($url === '' || $secret === '') {
            error_log(
                'GoogleAppsScriptDelivery: Missing URL or secret configuration.'
            );

            return 'Google Apps Script configuration is incomplete.';
        }

        $urlParts = parse_url($url);
        $validUrl = filter_var($url, FILTER_VALIDATE_URL) &&
            is_array($urlParts) &&
            strtolower((string) ($urlParts['scheme'] ?? '')) === 'https' &&
            strtolower((string) ($urlParts['host'] ?? '')) === 'script.google.com' &&
            preg_match(
                '#^/macros/s/[^/]+/exec/?$#',
                (string) ($urlParts['path'] ?? '')
            ) === 1;

        if (!$validUrl) {
            error_log(
                'GoogleAppsScriptDelivery: URL must be a deployed Apps Script Web App URL ending in /macros/s/{deployment-id}/exec.'
            );

            return 'The Google Apps Script URL is invalid. Copy the deployed Web App URL ending in /exec.';
        }

        if (filter_var($secret, FILTER_VALIDATE_URL)) {
            error_log(
                'GoogleAppsScriptDelivery: The configured shared secret is a URL, not a secret string.'
            );

            return 'GOOGLE_APPS_SCRIPT_SECRET must be the shared secret string configured in Apps Script, not a URL.';
        }

        if (!function_exists('curl_init')) {
            error_log(
                'GoogleAppsScriptDelivery: PHP cURL extension is unavailable.'
            );

            return 'PHP cURL extension is unavailable.';
        }

        $validRecipients = [];

        foreach ($recipients as $recipient) {
            $email = strtolower(trim((string) $recipient));

            if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $validRecipients[$email] = true;
            }
        }

        $validRecipients = array_keys($validRecipients);

        if (empty($validRecipients)) {
            return 'No valid email recipients were provided.';
        }

        
        $subject = trim((string) $subject);
        $html = trim((string) $html);
        $text = trim((string) $text);

        if ($text === '') {
            $text = trim(strip_tags($html));
        }

        if ($subject === '' || ($html === '' && $text === '')) {
            return 'Email subject or message content is empty.';
        }

        $payload = [
            'secret' => $secret,
            'recipients' => $validRecipients,
            'subject' => $subject,
            'message' => $text,
            'html' => $html
        ];

        $json = json_encode(
            $payload,
            JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE
        );

        if ($json === false) {
            error_log(
                'GoogleAppsScriptDelivery: JSON encoding failed: ' .
                json_last_error_msg()
            );

            return 'Unable to prepare email request.';
        }

        /*
         * SEND REQUEST
         */
        $ch = curl_init($url);

        if ($ch === false) {
            return 'Unable to initialize cURL.';
        }

        $curlOptions = [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $json,

            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Accept: application/json'
            ],

            CURLOPT_RETURNTRANSFER => true,

            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,

            CURLOPT_POSTREDIR => defined('CURL_REDIR_POST_ALL')
                ? CURL_REDIR_POST_ALL
                : 3,

            CURLOPT_CONNECTTIMEOUT => 20,
            CURLOPT_TIMEOUT => 120,

            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,

            CURLOPT_USERAGENT => 'CampusConnect-Mailer/1.0'
        ];

        curl_setopt_array($ch, $curlOptions);

        $response = curl_exec($ch);

        $curlError = curl_error($ch);
        $curlErrno = curl_errno($ch);

        $httpCode = (int) curl_getinfo(
            $ch,
            CURLINFO_HTTP_CODE
        );

        curl_close($ch);

        if ($response === false) {
            error_log(
                'GoogleAppsScriptDelivery cURL error (' .
                $curlErrno . '): ' . $curlError
            );

            return 'Unable to connect to Google Apps Script: ' .
                $curlError;
        }

        if ($httpCode < 200 || $httpCode >= 300) {
            error_log(
                'GoogleAppsScriptDelivery HTTP error: ' .
                $httpCode . ' Response: ' .
                substr((string) $response, 0, 1000)
            );

            return 'Google Apps Script returned HTTP error ' .
                $httpCode . '.';
        }

        $result = json_decode($response, true);

        if (!is_array($result)) {
            error_log(
                'GoogleAppsScriptDelivery: Invalid JSON response. HTTP ' .
                $httpCode . ' Response: ' .
                substr((string) $response, 0, 1000)
            );

            return 'Google Apps Script did not return JSON. Confirm that the URL is a deployed Web App ending in /exec and that access is allowed for the backend.';
        }

        /*
         * CHECK SCRIPT SUCCESS
         */
        if (
            !isset($result['success']) ||
            $result['success'] !== true
        ) {
            $error = isset($result['message'])
                ? (string) $result['message']
                : 'Unknown Google Apps Script error.';

            error_log(
                'GoogleAppsScriptDelivery failed: ' . $error
            );

            return $error;
        }

        /*
         * CHECK SENT COUNT
         */
        if (
            isset($result['sent']) &&
            (int) $result['sent'] !== count($validRecipients)
        ) {
            error_log(
                'GoogleAppsScriptDelivery: Sent count mismatch. Expected ' .
                count($validRecipients) . ', received ' .
                (int) $result['sent']
            );

            return 'Google Apps Script reported an incomplete sending result.';
        }

        error_log(
            'GoogleAppsScriptDelivery: Successfully sent batch of ' .
            count($validRecipients) . ' recipient(s).'
        );

        return null;
    }
}
