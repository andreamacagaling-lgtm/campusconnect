<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class EventsController extends Controller
{
    public function __construct()
    {
        parent::__construct();

        $this->api->require_library('api');
        $this->api->database();
        $this->call->model('EventsModel');
    }

    public function index($id = null)
    {
        $this->api->require_method('GET');

        try {
            $claims = $this->api->require_jwt();
            $user = $this->get_current_user($claims);

            if ($user === null) {
                return;
            }

            if ($id !== null) {
                if (!$this->valid_id($id)) {
                    $this->api->respond_error('Invalid event ID.', 400);
                    return;
                }

                $event = $this->EventsModel->find((int) $id);

                if (!$event) {
                    $this->api->respond_error('Event not found.', 404);
                    return;
                }

                if (!$this->can_view_event($user, $event)) {
                    $this->api->respond_error(
                        'You are not allowed to view this event.',
                        403
                    );
                    return;
                }

                $this->api->respond([
                    'success' => true,
                    'data' => $event
                ], 200);

                return;
            }

            $allEvents = $this->EventsModel->all();

            if (!is_array($allEvents)) {
                $allEvents = [];
            }

            $allEvents = array_filter(
                $allEvents,
                function ($event) use ($user) {
                    return $this->can_view_event($user, $event);
                }
            );

            $allEvents = array_values($allEvents);

            $this->api->respond([
                'success' => true,
                'data' => $allEvents
            ], 200);

        } catch (Throwable $e) {
            error_log('EventsController index: ' . $e->getMessage());

            $this->api->respond_error(
                'Unable to retrieve events.',
                500
            );
        }
    }

    /**
     * POST /api/events
     */
    public function create()
    {
        $this->api->require_method('POST');

        $claims = $this->api->require_jwt();
        $user = $this->require_admin($claims);

        if ($user === null) {
            return;
        }

        $body = $this->api->body();

        if (!is_array($body)) {
            $this->api->respond_error('Invalid request body.', 400);
            return;
        }

        $title = trim((string) ($body['title'] ?? ''));
        $description = trim((string) ($body['description'] ?? ''));
        $venue = trim((string) ($body['venue'] ?? ''));
        $startDatetime = trim((string) ($body['start_datetime'] ?? ''));
        $endDatetime = trim((string) ($body['end_datetime'] ?? ''));
        $status = trim((string) ($body['status'] ?? 'upcoming'));

        $validationError = $this->validate_event(
            $title,
            $description,
            $venue,
            $startDatetime,
            $endDatetime,
            $status
        );

        if ($validationError !== null) {
            $this->api->respond_error($validationError, 422);
            return;
        }

        $categoryId = $this->validate_category_id(
            $body['category_id'] ?? null
        );

        if ($categoryId === false) {
            $this->api->respond_error(
                'A valid category ID is required.',
                422
            );
            return;
        }

        $requestedDeptId = $this->validate_department_id(
            $body['dept_id'] ?? null
        );

        if ($requestedDeptId === false) {
            $this->api->respond_error(
                'Department ID must be a positive integer or null.',
                422
            );
            return;
        }

        // Department admins can only create events for their own department.
        if ($user['dept_id'] !== null) {
            if (
                $requestedDeptId !== null &&
                $requestedDeptId !== (int) $user['dept_id']
            ) {
                $this->api->respond_error(
                    'You can only create events for your assigned department.',
                    403
                );
                return;
            }

            $deptId = (int) $user['dept_id'];
        } else {
            // University admins manage university-wide events only.
            if ($requestedDeptId !== null) {
                $this->api->respond_error(
                    'University admins can only create university-wide events.',
                    403
                );
                return;
            }

            $deptId = null;
        }

        $data = [
            'category_id' => $categoryId,
            'dept_id' => $deptId,
            'title' => $title,
            'description' => $description,
            'venue' => $venue,
            'image' => trim((string) ($body['image'] ?? '')) ?: null,
            'start_datetime' => date(
                'Y-m-d H:i:s',
                strtotime($startDatetime)
            ),
            'end_datetime' => date(
                'Y-m-d H:i:s',
                strtotime($endDatetime)
            ),
            'status' => $status,
            'created_by' => (int) $user['user_id']
        ];

        try {
            $eventId = $this->EventsModel->insert($data);

            if (!$eventId) {
                error_log('EventsController create: insert returned false.');

                $this->api->respond_error(
                    'Failed to create event.',
                    500
                );
                return;
            }

            $calendarSync = $this->sync_google_calendar_event(
                array_merge($data, [
                    'event_id' => (int) $eventId
                ])
            );

            $this->api->respond([
                'success' => true,
                'message' => $calendarSync['success']
                    ? 'Event created successfully.'
                    : 'Event created, but Google Calendar sync failed.',
                'event_id' => $eventId,
                'google_calendar_sync' => $calendarSync
            ], 201);

        } catch (Throwable $e) {
            error_log('EventsController create: ' . $e->getMessage());

            $this->api->respond_error(
                'Unable to create event. Check the category and database constraints.',
                500
            );
        }
    }

    /**
     * PUT /api/events/5
     */
    public function update($id = null)
    {
        $this->api->require_method('PUT');

        $claims = $this->api->require_jwt();
        $user = $this->require_admin($claims);

        if ($user === null) {
            return;
        }

        if (!$this->valid_id($id)) {
            $this->api->respond_error(
                'A valid event ID is required.',
                400
            );
            return;
        }

        $existingEvent = $this->EventsModel->find((int) $id);

        if (!$existingEvent) {
            $this->api->respond_error('Event not found.', 404);
            return;
        }

        if (!$this->can_manage_event($user, $existingEvent)) {
            $this->api->respond_error(
                'You can only manage events assigned to your account.',
                403
            );
            return;
        }

        $body = $this->api->body();

        if (!is_array($body)) {
            $this->api->respond_error('Invalid request body.', 400);
            return;
        }

        $title = trim((string) ($body['title'] ?? ''));
        $description = trim((string) ($body['description'] ?? ''));
        $venue = trim((string) ($body['venue'] ?? ''));
        $startDatetime = trim((string) ($body['start_datetime'] ?? ''));
        $endDatetime = trim((string) ($body['end_datetime'] ?? ''));
        $status = trim((string) ($body['status'] ?? ''));

        $validationError = $this->validate_event(
            $title,
            $description,
            $venue,
            $startDatetime,
            $endDatetime,
            $status
        );

        if ($validationError !== null) {
            $this->api->respond_error($validationError, 422);
            return;
        }

        $categoryId = $this->validate_category_id(
            $body['category_id'] ?? null
        );

        if ($categoryId === false) {
            $this->api->respond_error(
                'A valid category ID is required.',
                422
            );
            return;
        }

        $existingDeptId = $this->get_value(
            $existingEvent,
            'dept_id'
        );

        if ($user['dept_id'] === null) {
            if (
                $existingDeptId !== null &&
                $existingDeptId !== ''
            ) {
                $this->api->respond_error(
                    'University admins can only update university-wide events.',
                    403
                );
                return;
            }

            $deptId = null;
        } else {
            if (
                $existingDeptId === null ||
                (int) $existingDeptId !== (int) $user['dept_id']
            ) {
                $this->api->respond_error(
                    'You cannot update another department’s event.',
                    403
                );
                return;
            }

            if (array_key_exists('dept_id', $body)) {
                $requestedDeptId = $this->validate_department_id(
                    $body['dept_id']
                );

                if (
                    $requestedDeptId === false ||
                    (
                        $requestedDeptId !== null &&
                        $requestedDeptId !== (int) $user['dept_id']
                    )
                ) {
                    $this->api->respond_error(
                        'You cannot change the event department.',
                        403
                    );
                    return;
                }
            }

            $deptId = (int) $user['dept_id'];
        }

        $data = [
            'category_id' => $categoryId,
            'dept_id' => $deptId,
            'title' => $title,
            'description' => $description,
            'venue' => $venue,
            'image' => trim((string) ($body['image'] ?? '')) ?: null,
            'start_datetime' => date(
                'Y-m-d H:i:s',
                strtotime($startDatetime)
            ),
            'end_datetime' => date(
                'Y-m-d H:i:s',
                strtotime($endDatetime)
            ),
            'status' => $status
        ];

        try {
            $updated = $this->EventsModel->update((int) $id, $data);

            if ($updated === false) {
                $this->api->respond_error(
                    'Failed to update event.',
                    500
                );
                return;
            }

            $calendarSync = $this->sync_google_calendar_event(
                array_merge($data, [
                    'event_id' => (int) $id
                ])
            );

            $this->api->respond([
                'success' => true,
                'message' => $calendarSync['success']
                    ? 'Event updated successfully.'
                    : 'Event updated, but Google Calendar sync failed.',
                'google_calendar_sync' => $calendarSync
            ], 200);

        } catch (Throwable $e) {
            error_log('EventsController update: ' . $e->getMessage());

            $this->api->respond_error(
                'Unable to update event. Check the category and database constraints.',
                500
            );
        }
    }

    /**
     * DELETE /api/events/5
     */
    public function delete($id = null)
    {
        $this->api->require_method('DELETE');

        $claims = $this->api->require_jwt();
        $user = $this->require_admin($claims);

        if ($user === null) {
            return;
        }

        if (!$this->valid_id($id)) {
            $this->api->respond_error(
                'A valid event ID is required.',
                400
            );
            return;
        }

        $existingEvent = $this->EventsModel->find((int) $id);

        if (!$existingEvent) {
            $this->api->respond_error('Event not found.', 404);
            return;
        }

        if (!$this->can_manage_event($user, $existingEvent)) {
            $this->api->respond_error(
                'You can only delete events assigned to your account.',
                403
            );
            return;
        }

        try {
            $deleted = $this->EventsModel->delete((int) $id);

            if ($deleted === false) {
                $this->api->respond_error(
                    'Failed to delete event.',
                    500
                );
                return;
            }

            $calendarSync = $this->sync_google_calendar_event([
                'event_id' => (int) $id,
                'dept_id' => $this->get_value(
                    $existingEvent,
                    'dept_id'
                ),
                'title' => $this->get_value($existingEvent, 'title')
            ], true);

            $this->api->respond([
                'success' => true,
                'message' => $calendarSync['success']
                    ? 'Event deleted successfully.'
                    : 'Event deleted, but it could not be removed from Google Calendar.',
                'google_calendar_sync' => $calendarSync
            ], 200);

        } catch (Throwable $e) {
            error_log('EventsController delete: ' . $e->getMessage());

            $this->api->respond_error(
                'Unable to delete event. Check server logs and database constraints.',
                500
            );
        }
    }

    // =========================================================================
    // NEW METHODS: QR CODE REGISTRATION & ATTENDANCE VERIFICATION
    // =========================================================================

    /**
     * POST /api/events/register
     * Estudyante ay nagre-register sa event at binibigyan ng natatanging QR token.
     */
    public function register()
    {
        $this->api->require_method('POST');

        $claims = $this->api->require_jwt();
        $user = $this->get_current_user($claims);

        if ($user === null) {
            return;
        }

        $body = $this->api->body();
        $eventId = $this->validate_category_id($body['event_id'] ?? null);

        if (!$eventId) {
            $this->api->respond_error('A valid event ID is required.', 422);
            return;
        }

        $event = $this->EventsModel->find((int) $eventId);
        if (!$event) {
            $this->api->respond_error('Event not found.', 404);
            return;
        }

        try {
            // 1. Suriin kung rehistrado na ba ang user
            $existingReg = $this->db->raw(
                'SELECT reg_id, qr_token FROM registrations WHERE event_id = ? AND student_id = ? LIMIT 1',
                [$eventId, $user['user_id']]
            )->fetch(PDO::FETCH_ASSOC);

            if ($existingReg) {
                $this->api->respond([
                    'success' => true,
                    'message' => 'You are already registered for this event.',
                    'qr_token' => $existingReg['qr_token']
                ], 200);
                return;
            }

            // 2. Gumawa ng natatanging QR Token
            $qrToken = 'EVT-' . uniqid() . '-' . mt_rand(1000, 9999);

            // 3. I-save sa database
            $insertResult = $this->db->raw(
                'INSERT INTO registrations (event_id, student_id, qr_token, status) VALUES (?, ?, ?, ?)',
                [$eventId, $user['user_id'], $qrToken, 'Registered']
            );

            if (!$insertResult) {
                $this->api->respond_error('Failed to register for the event.', 500);
                return;
            }

            $this->api->respond([
                'success' => true,
                'message' => 'Successfully registered for the event.',
                'qr_token' => $qrToken
            ], 201);

        } catch (Throwable $e) {
            error_log('EventsController register: ' . $e->getMessage());
            $this->api->respond_error('Unable to complete event registration.', 500);
        }
    }

    /**
     * POST /api/events/verify-ticket
     * Admin scanner nagpapadala ng QR token para makuha ang detalye at avatar ng estudyante.
     */
    public function verify_ticket()
    {
        $this->api->require_method('POST');

        $claims = $this->api->require_jwt();
        $adminUser = $this->require_admin($claims);

        if ($adminUser === null) {
            return;
        }

        $body = $this->api->body();
        $token = trim((string) ($body['token'] ?? ''));

        if ($token === '') {
            $this->api->respond_error('QR token is required.', 422);
            return;
        }

        try {
            $query = $this->db->raw(
                'SELECT r.reg_id, r.status, u.user_id AS student_id, u.full_name, u.avatar_url, u.dept_id AS department, e.title AS event_name 
                 FROM registrations r
                 JOIN users u ON r.student_id = u.user_id
                 JOIN events e ON r.event_id = e.event_id
                 WHERE r.qr_token = ?
                 LIMIT 1',
                [$token]
            );

            $ticket = $query->fetch(PDO::FETCH_ASSOC);

            if (!$ticket) {
                $this->api->respond_error('Invalid or unrecognized QR code ticket.', 404);
                return;
            }

            $this->api->respond([
                'success' => true,
                'student' => [
                    'reg_id' => (int) $ticket['reg_id'],
                    'student_id' => $ticket['student_id'],
                    'full_name' => $ticket['full_name'],
                    'avatar_url' => $ticket['avatar_url'] ?? 'uploads/avatars/default.png',
                    'department' => $ticket['department'],
                    'event_name' => $ticket['event_name']
                ],
                'already_attended' => ($ticket['status'] === 'Attended')
            ], 200);

        } catch (Throwable $e) {
            error_log('EventsController verify_ticket: ' . $e->getMessage());
            $this->api->respond_error('Unable to verify ticket.', 500);
        }
    }

    /**
     * POST /api/events/confirm-attendance
     * Kinukumpirma ng admin ang pagdalo pagkatapos makita ang avatar.
     */
    public function confirm_attendance()
    {
        $this->api->require_method('POST');

        $claims = $this->api->require_jwt();
        $adminUser = $this->require_admin($claims);

        if ($adminUser === null) {
            return;
        }

        $body = $this->api->body();
        $regId = $body['reg_id'] ?? null;

        if (!$this->valid_id($regId)) {
            $this->api->respond_error('A valid registration ID is required.', 422);
            return;
        }

        try {
            $updateResult = $this->db->raw(
                'UPDATE registrations SET status = ? WHERE reg_id = ?',
                ['Attended', (int) $regId]
            );

            if (!$updateResult) {
                $this->api->respond_error('Failed to update attendance status.', 500);
                return;
            }

            $this->api->respond([
                'success' => true,
                'message' => 'Attendance confirmed successfully.'
            ], 200);

        } catch (Throwable $e) {
            error_log('EventsController confirm_attendance: ' . $e->getMessage());
            $this->api->respond_error('Unable to record attendance.', 500);
        }
    }

    // =========================================================================
    // EXISTING HELPER METHODS
    // =========================================================================

    private function get_current_user($claims)
    {
        if (
            !is_array($claims) ||
            !isset($claims['sub']) ||
            !$this->valid_id($claims['sub'])
        ) {
            $this->api->respond_error(
                'Invalid authentication token.',
                401
            );
            return null;
        }

        $userId = (int) $claims['sub'];

        try {
            $result = $this->db->raw(
                'SELECT user_id, role, dept_id
                 FROM users
                 WHERE user_id = ?
                 LIMIT 1',
                [$userId]
            );

            $user = $result->fetch(PDO::FETCH_ASSOC);

            if (!$user) {
                $this->api->respond_error(
                    'User account not found.',
                    401
                );
                return null;
            }

            $user['user_id'] = (int) $user['user_id'];
            $user['dept_id'] = (
                $user['dept_id'] === null ||
                $user['dept_id'] === ''
            ) ? null : (int) $user['dept_id'];

            return $user;

        } catch (Throwable $e) {
            error_log(
                'EventsController get_current_user: ' .
                $e->getMessage()
            );

            $this->api->respond_error(
                'Unable to verify the user account.',
                500
            );
            return null;
        }
    }

    private function require_admin($claims)
    {
        $user = $this->get_current_user($claims);

        if ($user === null) {
            return null;
        }

        if ($user['role'] !== 'admin') {
            $this->api->respond_error(
                'Admin access required.',
                403
            );
            return null;
        }

        return $user;
    }

    private function can_view_event($user, $event)
    {
        $eventDeptId = $this->get_value($event, 'dept_id');

        if ($eventDeptId === null || $eventDeptId === '') {
            return true;
        }

        return $user['dept_id'] !== null
            && (int) $eventDeptId === (int) $user['dept_id'];
    }

    private function can_manage_event($user, $event)
    {
        if ($user['role'] !== 'admin') {
            return false;
        }

        $eventDeptId = $this->get_value($event, 'dept_id');

        if ($user['dept_id'] === null) {
            return $eventDeptId === null || $eventDeptId === '';
        }

        return $eventDeptId !== null
            && $eventDeptId !== ''
            && (int) $eventDeptId === (int) $user['dept_id'];
    }

    private function validate_event(
        $title,
        $description,
        $venue,
        $startDatetime,
        $endDatetime,
        $status
    ) {
        if (
            $title === '' ||
            $description === '' ||
            $venue === '' ||
            $startDatetime === '' ||
            $endDatetime === ''
        ) {
            return 'Title, description, venue, start datetime, and end datetime are required.';
        }

        $start = strtotime($startDatetime);
        $end = strtotime($endDatetime);

        if ($start === false || $end === false) {
            return 'Invalid event date and time.';
        }

        if ($end < $start) {
            return 'Event end datetime cannot be earlier than start datetime.';
        }

        $allowedStatuses = [
            'upcoming',
            'ongoing',
            'completed',
            'cancelled'
        ];

        if (!in_array($status, $allowedStatuses, true)) {
            return 'Invalid event status. Use upcoming, ongoing, completed, or cancelled.';
        }

        return null;
    }

    private function validate_category_id($categoryId)
    {
        if (
            $categoryId === null ||
            $categoryId === '' ||
            !is_scalar($categoryId) ||
            !ctype_digit((string) $categoryId) ||
            (int) $categoryId < 1
        ) {
            return false;
        }

        return (int) $categoryId;
    }

    private function validate_department_id($deptId)
    {
        if ($deptId === null || $deptId === '') {
            return null;
        }

        if (
            !is_scalar($deptId) ||
            !ctype_digit((string) $deptId) ||
            (int) $deptId < 1
        ) {
            return false;
        }

        return (int) $deptId;
    }

    private function valid_id($id)
    {
        return $id !== null
            && is_scalar($id)
            && ctype_digit((string) $id)
            && (int) $id > 0;
    }

    private function get_value($record, $key)
    {
        if (is_array($record)) {
            return $record[$key] ?? null;
        }

        if (is_object($record)) {
            return $record->$key ?? null;
        }

        return null;
    }

    private function sync_google_calendar_event(
        array $event,
        $delete = false
    ) {
        try {
            require_once APP_DIR . 'libraries/GoogleCalendarSync.php';

            $calendarSync = new GoogleCalendarSync();

            return $delete
                ? $calendarSync->deleteEvent($event)
                : $calendarSync->syncEvent($event);
        } catch (Throwable $e) {
            error_log(
                'EventsController Google Calendar sync: ' .
                $e->getMessage()
            );

            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }
}
