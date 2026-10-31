<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class GoogleCalendarSync
{
    private $config;
    private $service;
    private $timezone;

    public function __construct()
    {
        $configFile = APP_DIR . 'config/google_calendar.php';

        if (!is_file($configFile)) {
            throw new RuntimeException(
                'Google Calendar configuration file is missing.'
            );
        }

        $this->config = require $configFile;
        $this->timezone = $this->config['timezone'] ?? 'Asia/Manila';

        $autoload = ROOT_DIR . 'vendor/autoload.php';

        if (!is_file($autoload)) {
            throw new RuntimeException(
                'Composer autoload file was not found.'
            );
        }

        require_once $autoload;

        if (!class_exists(\Google\Client::class)) {
            throw new RuntimeException(
                'Google API client is not installed. Run Composer install.'
            );
        }

        if (!class_exists(\Composer\CaBundle\CaBundle::class)) {
            throw new RuntimeException(
                'Composer CA bundle package is not installed. Run Composer install.'
            );
        }
    }

    public function testConnection($departmentId)
    {
        try {
            $calendar = $this->getService()
                ->calendars
                ->get($this->getCalendarId($departmentId));
        } catch (\Google\Service\Exception $e) {
            throw $this->calendarApiError($e);
        }

        return [
            'summary' => $calendar->getSummary(),
            'timeZone' => $calendar->getTimeZone()
        ];
    }

    public function syncEvent(array $event)
    {
        $departmentId = $this->getEventDepartmentId($event);
        $eventId = $this->getEventId($event);
        $calendarId = $this->getCalendarId($departmentId);
        $googleEventId = $this->googleEventId($eventId);
        $status = (string) ($event['status'] ?? 'upcoming');
        $title = trim((string) ($event['title'] ?? ''));
        $description = trim((string) ($event['description'] ?? ''));
        $description .= ($description === '' ? '' : "\n\n");
        $description .= 'CampusConnect status: ' . ucfirst($status);

        if ($status === 'cancelled') {
            $title = '[CANCELLED] ' . $title;
        }

        $calendarEvent = new \Google\Service\Calendar\Event([
            'id' => $googleEventId,
            'summary' => $title,
            'description' => $description,
            'location' => (string) ($event['venue'] ?? ''),
            'start' => [
                'dateTime' => $this->formatDateTime(
                    $event['start_datetime'] ?? ''
                ),
                'timeZone' => $this->timezone
            ],
            'end' => [
                'dateTime' => $this->formatDateTime(
                    $event['end_datetime'] ?? ''
                ),
                'timeZone' => $this->timezone
            ]
        ]);

        $service = $this->getService();

        try {
            $service->events->get($calendarId, $googleEventId);
            $syncedEvent = $service->events->update(
                $calendarId,
                $googleEventId,
                $calendarEvent
            );
        } catch (\Google\Service\Exception $e) {
            if ((int) $e->getCode() !== 404) {
                throw $this->calendarApiError($e);
            }

            try {
                $syncedEvent = $service->events->insert(
                    $calendarId,
                    $calendarEvent
                );
            } catch (\Google\Service\Exception $insertError) {
                throw $this->calendarApiError($insertError);
            }
        }

        return [
            'success' => true,
            'message' => 'Event synced to Google Calendar.',
            'html_link' => $syncedEvent->getHtmlLink()
        ];
    }

    public function deleteEvent(array $event)
    {
        $departmentId = $this->getEventDepartmentId($event);
        $eventId = $this->getEventId($event);
        $calendarId = $this->getCalendarId($departmentId);

        try {
            $this->getService()->events->delete(
                $calendarId,
                $this->googleEventId($eventId)
            );
        } catch (\Google\Service\Exception $e) {
            if ((int) $e->getCode() !== 404) {
                throw $this->calendarApiError($e);
            }
        }

        return [
            'success' => true,
            'message' => 'Event removed from Google Calendar.'
        ];
    }

    private function getService()
    {
        if ($this->service !== null) {
            return $this->service;
        }

        $credentials = trim((string) ($this->config['credentials'] ?? ''));

        if ($credentials === '') {
            throw new RuntimeException(
                'Set GOOGLE_CALENDAR_CREDENTIALS to the service-account JSON file path.'
            );
        }

        $credentialsPath = $credentials;

        if (!is_file($credentialsPath)) {
            $credentialsPath = ROOT_DIR . ltrim(
                $credentials,
                '/\\'
            );
        }

        if (!is_file($credentialsPath)) {
            throw new RuntimeException(
                'Google Calendar service-account credentials file was not found. Check GOOGLE_CALENDAR_CREDENTIALS.'
            );
        }

        $client = new \Google\Client();
        $client->setApplicationName('CampusConnect');
        $client->setAuthConfig($credentialsPath);
        $client->setHttpClient($this->createVerifiedHttpClient());
        $client->setScopes([
            \Google\Service\Calendar::CALENDAR_EVENTS,
            \Google\Service\Calendar::CALENDAR_READONLY
        ]);

        $this->service = new \Google\Service\Calendar($client);

        return $this->service;
    }

    private function createVerifiedHttpClient()
    {
        $caBundle = trim((string) ($this->config['ca_bundle'] ?? ''));

        if ($caBundle !== '' && !is_file($caBundle)) {
            $caBundle = ROOT_DIR . ltrim($caBundle, '/\\');
        }

        if ($caBundle === '') {
            $caBundle = \Composer\CaBundle\CaBundle::getSystemCaRootBundlePath();

            if (!is_file($caBundle) || !is_readable($caBundle)) {
                $caBundle = \Composer\CaBundle\CaBundle::getBundledCaBundlePath();
            }
        }

        if (!is_file($caBundle) || !is_readable($caBundle)) {
            throw new RuntimeException(
                'A readable CA certificate bundle is required for Google Calendar HTTPS requests. Set GOOGLE_CALENDAR_CA_BUNDLE to a valid PEM file.'
            );
        }

        $httpClient = new \GuzzleHttp\Client([
            'verify' => $caBundle
        ]);

        \Google\Auth\HttpHandler\HttpClientCache::setHttpClient(
            $httpClient
        );

        return $httpClient;
    }

    private function getCalendarId($departmentId)
    {
        $departmentId = (int) $departmentId;
        $calendarId = $this->config['calendars'][$departmentId] ?? '';

        if ($calendarId === '') {
            throw new RuntimeException(
                'No Google Calendar ID is configured for this department.'
            );
        }

        return $calendarId;
    }

    private function getEventDepartmentId(array $event)
    {
        $departmentId = (int) ($event['dept_id'] ?? 0);

        if ($departmentId < 1) {
            throw new RuntimeException(
                'Only department events can be synced to Google Calendar.'
            );
        }

        return $departmentId;
    }

    private function getEventId(array $event)
    {
        $eventId = (int) ($event['event_id'] ?? 0);

        if ($eventId < 1) {
            throw new RuntimeException(
                'A valid event ID is required for Google Calendar sync.'
            );
        }

        return $eventId;
    }

    private function googleEventId($eventId)
    {
        return 'cc' . substr(
            hash('sha256', 'campusconnect-event-' . $eventId),
            0,
            62
        );
    }

    private function formatDateTime($value)
    {
        if (trim((string) $value) === '') {
            throw new RuntimeException(
                'An event start and end date are required for Google Calendar sync.'
            );
        }

        $dateTime = new DateTimeImmutable(
            (string) $value,
            new DateTimeZone($this->timezone)
        );

        return $dateTime->format(DateTime::RFC3339);
    }

    private function calendarApiError(\Google\Service\Exception $error)
    {
        error_log('Google Calendar API sync error: ' . $error->getMessage());

        return new RuntimeException(
            'Google Calendar sync failed. Check that the Calendar API is enabled and the service account has Editor access to this calendar.',
            (int) $error->getCode(),
            $error
        );
    }
}
