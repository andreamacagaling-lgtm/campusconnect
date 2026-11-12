<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;

class EmailApiDelivery
{
    public static function send(array $recipients, $subject, $html, $text)
    {
        $apiKey = trim((string) getenv('RESEND_API_KEY'));
        $fromEmail = trim((string) getenv('RESEND_FROM_EMAIL'));
        $fromName = trim((string) (getenv('RESEND_FROM_NAME') ?: 'CampusConnect'));

        if ($apiKey === '' || !filter_var($fromEmail, FILTER_VALIDATE_EMAIL)) {
            return 'Set RESEND_API_KEY and a verified RESEND_FROM_EMAIL in the backend environment.';
        }

        if (!$recipients) {
            return 'Email delivery requires at least one recipient.';
        }

        $fromName = str_replace(["\r", "\n"], '', $fromName);
        $payload = [
            'from' => $fromName . ' <' . $fromEmail . '>',
            'to' => [array_shift($recipients)],
            'subject' => (string) $subject,
            'html' => (string) $html,
            'text' => (string) $text
        ];

        if ($recipients) {
            $payload['bcc'] = array_values($recipients);
        }

        try {
            $client = new Client([
                'base_uri' => 'https://api.resend.com',
                'connect_timeout' => 5,
                'timeout' => 20,
                'http_errors' => false
            ]);
            $response = $client->post('/emails', [
                'headers' => [
                    'Authorization' => 'Bearer ' . $apiKey,
                    'Accept' => 'application/json'
                ],
                'json' => $payload
            ]);
        } catch (GuzzleException $e) {
            error_log('EmailApiDelivery request failed: ' . $e->getMessage());
            return 'Could not connect to the email API. Check the backend logs and try again.';
        }

        $status = $response->getStatusCode();
        $responseBody = (string) $response->getBody();
        $result = json_decode($responseBody, true);

        if ($status < 200 || $status >= 300) {
            $detail = is_array($result)
                ? (string) ($result['message'] ?? $result['name'] ?? '')
                : '';
            $detail = trim(preg_replace('/[\r\n]+/', ' ', $detail));
            error_log(
                'EmailApiDelivery rejected request (HTTP ' . $status . '): ' .
                ($detail !== '' ? $detail : 'No error detail returned.')
            );
            return $detail !== ''
                ? 'Email provider rejected the request: ' . $detail
                : 'Email provider rejected the request (HTTP ' . $status . '). Check backend logs.';
        }

        if (!is_array($result) || empty($result['id'])) {
            error_log('EmailApiDelivery returned success without an email ID.');
            return 'Email provider did not confirm delivery. Check backend logs.';
        }

        return null;
    }
}
