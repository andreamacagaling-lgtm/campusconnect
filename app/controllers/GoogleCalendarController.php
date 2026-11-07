<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class GoogleCalendarController extends Controller
{
    public function __construct()
    {
        parent::__construct();

        $this->call->library('api');
        $this->call->database();
    }

    /**
     * GET /api/google-calendar/test
     */
    public function test()
    {
        $this->api->require_method('GET');

        $user = $this->get_department_admin();

        if ($user === null) {
            return;
        }

        try {
            require_once APP_DIR . 'libraries/GoogleCalendarSync.php';

            $calendar = (new GoogleCalendarSync())->testConnection(
                (int) $user['dept_id']
            );

            $this->api->respond([
                'success' => true,
                'message' => 'Google Calendar connection successful.',
                'calendar' => $calendar
            ], 200);
        } catch (Throwable $e) {
            error_log(
                'Google Calendar connection test failed: ' .
                $e->getMessage()
            );

            $this->api->respond_error(
                $e->getMessage(),
                502
            );
        }
    }

    /**
     * POST /api/google-calendar/sync-events
     */
    public function sync_events()
    {
        $this->api->require_method('POST');

        $user = $this->get_department_admin();

        if ($user === null) {
            return;
        }

        try {
            require_once APP_DIR . 'libraries/GoogleCalendarSync.php';

            $calendarSync = new GoogleCalendarSync();
            $departmentId = (int) $user['dept_id'];
            $calendar = $calendarSync->testConnection($departmentId);
            $events = $this->db->raw(
                'SELECT event_id, dept_id, title, description, venue,
                        start_datetime, end_datetime, status
                 FROM events
                 WHERE dept_id = ? AND approval_status = ?
                 ORDER BY start_datetime ASC',
                [$departmentId, 'approved']
            )->fetchAll(PDO::FETCH_ASSOC);

            $results = [];
            $syncedCount = 0;

            foreach ($events as $event) {
                try {
                    $result = $calendarSync->syncEvent($event);
                    $syncedCount++;
                    $results[] = [
                        'event_id' => (int) $event['event_id'],
                        'success' => true,
                        'message' => $result['message']
                    ];
                } catch (Throwable $e) {
                    error_log(
                        'Google Calendar event sync failed for event ' .
                        (int) $event['event_id'] . ': ' . $e->getMessage()
                    );

                    $results[] = [
                        'event_id' => (int) $event['event_id'],
                        'success' => false,
                        'message' => $e->getMessage()
                    ];
                }
            }

            $failedCount = count($results) - $syncedCount;

            $this->api->respond([
                'success' => $failedCount === 0,
                'message' => $failedCount === 0
                    ? 'All department events are synced to Google Calendar.'
                    : 'Some events could not be synced to Google Calendar.',
                'calendar' => $calendar,
                'synced_count' => $syncedCount,
                'failed_count' => $failedCount,
                'results' => $results
            ], 200);
        } catch (Throwable $e) {
            error_log(
                'Google Calendar bulk sync failed: ' . $e->getMessage()
            );

            $this->api->respond_error(
                $e->getMessage(),
                502
            );
        }
    }

    private function get_department_admin()
    {
        $claims = $this->api->require_jwt();

        if (
            !is_array($claims) ||
            !isset($claims['sub']) ||
            !ctype_digit((string) $claims['sub']) ||
            (int) $claims['sub'] < 1
        ) {
            $this->api->respond_error(
                'Invalid authentication token.',
                401
            );
            return null;
        }

        try {
            $result = $this->db->raw(
                'SELECT user_id, role, admin_type, dept_id, status
                 FROM users
                 WHERE user_id = ?
                 LIMIT 1',
                [(int) $claims['sub']]
            );

            $user = $result->fetch(PDO::FETCH_ASSOC);
        } catch (Throwable $e) {
            error_log(
                'Google Calendar user lookup failed: ' . $e->getMessage()
            );

            $this->api->respond_error(
                'Unable to verify the user account.',
                500
            );
            return null;
        }

        if (!$user || $user['status'] !== 'active') {
            $this->api->respond_error(
                'Active user account required.',
                401
            );
            return null;
        }

        if (
            $user['role'] !== 'admin' ||
            $user['admin_type'] === 'organization'
        ) {
            $this->api->respond_error(
                'Admin access required.',
                403
            );
            return null;
        }

        if (
            $user['dept_id'] === null ||
            (int) $user['dept_id'] < 1
        ) {
            $this->api->respond_error(
                'A department admin account is required.',
                422
            );
            return null;
        }

        return $user;
    }
}
