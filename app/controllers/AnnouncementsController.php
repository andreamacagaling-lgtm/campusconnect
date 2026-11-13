<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class AnnouncementsController extends Controller
{
    public function __construct()
    {
        parent::__construct();

        $this->call->library('api');
        $this->call->database();
        $this->call->model('AnnouncementModel');

        $this->announcements = new AnnouncementModel();
    }

    public function index($id = null)
    {
        $this->api->require_method('GET');

        try {
            $claims = $this->api->require_jwt();
            $viewer = $this->get_announcement_viewer($claims);

            if ($viewer === null) {
                return;
            }

            [$scopeSql, $scopeParams] = $this->announcement_view_scope($viewer);

            if ($id !== null) {
                if (!$this->valid_id($id)) {
                    $this->api->respond_error(
                        'Invalid announcement ID.',
                        400
                    );
                    return;
                }

                $announcement = $this->db->raw(
                    'SELECT a.*, UNIX_TIMESTAMP(a.created_at) AS created_at_timestamp,
                            e.title AS event_title,
                            e.start_datetime AS event_start_datetime,
                            e.end_datetime AS event_end_datetime,
                            e.venue AS event_venue,
                            e.image AS event_image
                     FROM announcements a
                     LEFT JOIN events e ON e.event_id = a.event_id
                     WHERE a.announcement_id = ? AND ' . $scopeSql . '
                     LIMIT 1',
                    array_merge([(int) $id], $scopeParams)
                )->fetch(PDO::FETCH_ASSOC);

                if (!$announcement) {
                    $this->api->respond_error(
                        'Announcement not found.',
                        404
                    );
                    return;
                }

                $this->api->respond([
                    'success' => true,
                    'data' => $announcement
                ], 200);

                return;
            }

            $announcements = $this->db->raw(
                'SELECT a.*, UNIX_TIMESTAMP(a.created_at) AS created_at_timestamp,
                        e.title AS event_title,
                        e.start_datetime AS event_start_datetime,
                        e.end_datetime AS event_end_datetime,
                        e.venue AS event_venue,
                        e.image AS event_image
                 FROM announcements a
                 LEFT JOIN events e ON e.event_id = a.event_id
                 WHERE ' . $scopeSql . '
                 ORDER BY a.created_at DESC',
                $scopeParams
            )->fetchAll(PDO::FETCH_ASSOC);

            $this->api->respond([
                'success' => true,
                'data' => $announcements
            ], 200);

        } catch (Throwable $e) {
            error_log(
                'AnnouncementsController index: ' . $e->getMessage()
            );

            $this->api->respond_error(
                'Unable to retrieve announcements.',
                500
            );
        }
    }

    public function create()
    {
        $this->api->require_method('POST');

        $user = $this->require_admin();

        if ($user === null) {
            return;
        }

        $body = $this->api->body();

        if (!is_array($body)) {
            $this->api->respond_error(
                'Invalid request body.',
                400
            );
            return;
        }

        $title = trim((string) ($body['title'] ?? ''));
        $content = trim((string) ($body['body'] ?? ''));
        $eventId = $this->validate_event_id($body['event_id'] ?? null);

        if ($eventId === false) {
            $this->api->respond_error(
                'A valid upcoming event ID is required.',
                422
            );
            return;
        }

        $validationError = $this->validate_announcement(
            $title,
            $content
        );

        if ($validationError !== null) {
            $this->api->respond_error($validationError, 422);
            return;
        }

        $event = null;
        if ($eventId !== null) {
            $adminType = $user['admin_type'] ?? null;
            $adminDeptId = $user['dept_id'] ?? null;
            if (
                !in_array($adminType, ['usg', 'department'], true) ||
                ($adminType === 'usg' && !empty($adminDeptId)) ||
                ($adminType === 'department' && empty($adminDeptId))
            ) {
                $this->api->respond_error(
                    'Only USG and department administrators can send event notifications.',
                    403
                );
                return;
            }

            $event = $this->db->raw(
                'SELECT event_id, dept_id, title, start_datetime,
                        end_datetime, venue
                 FROM events
                 WHERE event_id = ?
                   AND approval_status = ?
                   AND status IN (?, ?)
                   AND end_datetime > DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)
                 LIMIT 1',
                [$eventId, 'approved', 'upcoming', 'ongoing']
            )->fetch(PDO::FETCH_ASSOC);

            if (!$event) {
                $this->api->respond_error(
                    'Select an approved event that has not ended.',
                    422
                );
                return;
            }

            $eventDeptId = $event['dept_id'] === null
                ? null
                : (int) $event['dept_id'];
            if (
                ($adminType === 'usg' && $eventDeptId !== null) ||
                (
                    $adminType === 'department' &&
                    $eventDeptId !== (int) $adminDeptId
                )
            ) {
                $this->api->respond_error(
                    'You can only send event notifications for events managed by your account.',
                    403
                );
                return;
            }
        }

        $data = [
            'title' => $title,
            'body' => $content,
            'posted_by' => (int) $user['sub'],
            'event_id' => $eventId,
            'dept_id' => $user['admin_type'] === 'department'
                ? (int) $user['dept_id']
                : null
        ];

        try {
            $announcementId = $this->announcements->insert($data);

            if (!$announcementId) {
                error_log(
                    'AnnouncementsController create: insert returned false.'
                );

                $this->api->respond_error(
                    'Failed to create announcement.',
                    500
                );
                return;
            }

            $eventEmailNotification = null;
            if ($event !== null) {
                $eventEmailNotification = $this->notify_students_about_event(
                    $announcementId,
                    $title,
                    $content,
                    $event
                );
            }

            $emailNotification = $this->notify_registered_accounts(
                $announcementId,
                $title,
                $content,
                $data['dept_id'],
                $eventEmailNotification['sent_emails'] ?? []
            );

            if ($eventEmailNotification !== null) {
                unset(
                    $eventEmailNotification['sent_emails'],
                    $eventEmailNotification['failed_emails'],
                    $eventEmailNotification['invalid_emails']
                );
            }

            if ($emailNotification['success'] && $emailNotification['sent'] > 0) {
                $message = 'Announcement published and emailed to ' .
                    $emailNotification['sent'] .
                    ' active student email account(s).';
            } elseif ($emailNotification['success']) {
                $message = 'Announcement published; active student email accounts already received the event notification.';
            } elseif ($emailNotification['failed'] === 0) {
                $message = 'Announcement published, but no active student email accounts were found in the target audience.';
            } elseif ($emailNotification['sent'] > 0) {
                $message = 'Announcement published; email was sent to ' .
                    $emailNotification['sent'] . ' active student email account(s), but ' .
                    $emailNotification['failed'] . ' notification(s) failed.';
            } else {
                $message = 'Announcement published, but Google account email notifications could not be sent.';
            }

            $this->api->respond([
                'success' => true,
                'message' => $message,
                'announcement_id' => $announcementId,
                'email_notification' => $emailNotification,
                'event_email_notification' => $eventEmailNotification
            ], 201);

        } catch (Throwable $e) {
            error_log(
                'AnnouncementsController create: ' . $e->getMessage()
            );

            $this->api->respond_error(
                'Unable to create announcement.',
                500
            );
        }
    }

    public function update($id = null)
    {
        $this->api->require_method('PUT');

        $user = $this->require_admin();

        if ($user === null) {
            return;
        }

        if (!$this->valid_id($id)) {
            $this->api->respond_error(
                'A valid announcement ID is required.',
                400
            );
            return;
        }

        $existing = $this->announcements->find((int) $id);

        if (!$existing) {
            $this->api->respond_error(
                'Announcement not found.',
                404
            );
            return;
        }

        if (!$this->can_manage_announcement($user, $existing)) {
            $this->api->respond_error(
                'You can only manage announcements for your account scope.',
                403
            );
            return;
        }

        $body = $this->api->body();

        if (!is_array($body)) {
            $this->api->respond_error(
                'Invalid request body.',
                400
            );
            return;
        }

        $title = trim((string) ($body['title'] ?? ''));
        $content = trim((string) ($body['body'] ?? ''));

        $validationError = $this->validate_announcement(
            $title,
            $content
        );

        if ($validationError !== null) {
            $this->api->respond_error($validationError, 422);
            return;
        }

        $data = [
            'title' => $title,
            'body' => $content
        ];

        try {
            $updated = $this->announcements->update(
                (int) $id,
                $data
            );

            if ($updated === false) {
                $this->api->respond_error(
                    'Failed to update announcement.',
                    500
                );
                return;
            }

            $this->api->respond([
                'success' => true,
                'message' => 'Announcement updated successfully.'
            ], 200);

        } catch (Throwable $e) {
            error_log(
                'AnnouncementsController update: ' . $e->getMessage()
            );

            $this->api->respond_error(
                'Unable to update announcement.',
                500
            );
        }
    }

    public function delete($id = null)
    {
        $this->api->require_method('DELETE');

        $user = $this->require_admin();

        if ($user === null) {
            return;
        }

        if (!$this->valid_id($id)) {
            $this->api->respond_error(
                'A valid announcement ID is required.',
                400
            );
            return;
        }

        $existing = $this->announcements->find((int) $id);

        if (!$existing) {
            $this->api->respond_error(
                'Announcement not found.',
                404
            );
            return;
        }

        if (!$this->can_manage_announcement($user, $existing)) {
            $this->api->respond_error(
                'You can only manage announcements for your account scope.',
                403
            );
            return;
        }

        try {
            $deleted = $this->announcements->delete((int) $id);

            if ($deleted === false) {
                $this->api->respond_error(
                    'Failed to delete announcement.',
                    500
                );
                return;
            }

            $this->api->respond([
                'success' => true,
                'message' => 'Announcement deleted successfully.'
            ], 200);

        } catch (Throwable $e) {
            error_log(
                'AnnouncementsController delete: ' . $e->getMessage()
            );

            $this->api->respond_error(
                'Unable to delete announcement.',
                500
            );
        }
    }

    private function require_admin()
    {
        $claims = $this->api->require_jwt();
        if (!is_array($claims) || !$this->valid_id($claims['sub'] ?? null)) {
            $this->api->respond_error('Invalid authentication token.', 401);
            return null;
        }

        $user = $this->db->raw(
            'SELECT user_id, role, admin_type, dept_id, status
             FROM users
             WHERE user_id = ?
             LIMIT 1',
            [(int) $claims['sub']]
        )->fetch(PDO::FETCH_ASSOC);

        if (
            !is_array($user) ||
            $user['role'] !== 'admin' ||
            $user['status'] !== 'active' ||
            !in_array($user['admin_type'], ['usg', 'department'], true) ||
            (
                $user['admin_type'] === 'usg' &&
                $user['dept_id'] !== null
            ) ||
            (
                $user['admin_type'] === 'department' &&
                (int) $user['dept_id'] < 1
            )
        ) {
            $this->api->respond_error(
                'Admin access required.',
                403
            );

            return null;
        }

        $user['sub'] = (int) $user['user_id'];
        $user['dept_id'] = $user['dept_id'] === null
            ? null
            : (int) $user['dept_id'];

        return $user;
    }

    private function get_announcement_viewer($claims)
    {
        if (!is_array($claims) || !$this->valid_id($claims['sub'] ?? null)) {
            $this->api->respond_error('Invalid authentication token.', 401);
            return null;
        }

        $viewer = $this->db->raw(
            'SELECT u.user_id, u.role, u.admin_type, u.dept_id, u.status,
                    COALESCE(u.dept_id, s.dept_id) AS student_dept_id
             FROM users u
             LEFT JOIN sections s ON s.section_id = u.section_id
             WHERE u.user_id = ?
             LIMIT 1',
            [(int) $claims['sub']]
        )->fetch(PDO::FETCH_ASSOC);

        if (!$viewer) {
            $this->api->respond_error('User account not found.', 401);
            return null;
        }

        if (
            $viewer['status'] !== 'active'
        ) {
            $this->api->respond_error('Active account required.', 403);
            return null;
        }

        if (
            $viewer['role'] === 'admin' &&
            in_array($viewer['admin_type'], ['usg', 'department'], true)
        ) {
            if (
                ($viewer['admin_type'] === 'usg' && $viewer['dept_id'] !== null) ||
                (
                    $viewer['admin_type'] === 'department' &&
                    (int) $viewer['dept_id'] < 1
                )
            ) {
                $this->api->respond_error('Admin department scope is invalid.', 403);
                return null;
            }

            $viewer['dept_id'] = $viewer['dept_id'] === null
                ? null
                : (int) $viewer['dept_id'];
            return $viewer;
        }

        if ($viewer['role'] === 'student') {
            $viewer['dept_id'] = $viewer['student_dept_id'] === null
                ? null
                : (int) $viewer['student_dept_id'];
            return $viewer;
        }

        $this->api->respond_error('Announcement access required.', 403);
        return null;
    }

    private function announcement_view_scope(array $viewer)
    {
        if ($viewer['role'] === 'student') {
            return $viewer['dept_id'] === null
                ? ['a.dept_id IS NULL', []]
                : [
                    '(a.dept_id IS NULL OR a.dept_id = ?)',
                    [$viewer['dept_id']]
                ];
        }

        if ($viewer['admin_type'] === 'usg') {
            return ['a.dept_id IS NULL', []];
        }

        return ['a.dept_id = ?', [$viewer['dept_id']]];
    }

    private function can_manage_announcement(array $user, array $announcement)
    {
        $announcementDeptId = $announcement['dept_id'] === null
            ? null
            : (int) $announcement['dept_id'];

        if ($user['admin_type'] === 'usg') {
            return $announcementDeptId === null;
        }

        return $announcementDeptId === (int) $user['dept_id'];
    }

    private function validate_announcement($title, $content)
    {
        if ($title === '') {
            return 'Announcement title is required.';
        }

        if (mb_strlen($title) > 255) {
            return 'Title must not exceed 255 characters.';
        }

        if ($content === '') {
            return 'Announcement body is required.';
        }

        return null;
    }

    private function validate_event_id($eventId)
    {
        if ($eventId === null || $eventId === '') {
            return null;
        }

        if (
            !is_scalar($eventId) ||
            !ctype_digit((string) $eventId) ||
            (int) $eventId < 1
        ) {
            return false;
        }

        return (int) $eventId;
    }

    private function notify_students_about_event(
        $announcementId,
        $title,
        $content,
        array $event
    ) {
        try {
            $recipients = $this->db->raw(
                'SELECT DISTINCT u.email
                 FROM users u
                 LEFT JOIN sections s ON s.section_id = u.section_id
                 WHERE u.role = ?
                   AND u.status = ?
                   AND u.email IS NOT NULL
                   AND TRIM(u.email) <> ?
                   AND NOT EXISTS (
                       SELECT 1
                       FROM event_registrations er
                       WHERE er.event_id = ?
                         AND er.user_id = u.user_id
                   )' .
                    ($event['dept_id'] === null
                        ? ''
                        : ' AND COALESCE(u.dept_id, s.dept_id) = ?') .
                    ' ORDER BY u.email ASC',
                array_values(array_merge(
                    ['student', 'active', '', (int) $event['event_id']],
                    $event['dept_id'] === null
                        ? []
                        : [(int) $event['dept_id']]
                ))
            )->fetchAll(PDO::FETCH_COLUMN);

            if (!$recipients) {
                error_log(
                    'AnnouncementsController notify_students_about_event: No active students have email addresses.'
                );
                return [
                    'success' => false,
                    'sent' => 0,
                    'failed' => 0,
                    'sent_emails' => [],
                    'message' => 'No active student email addresses were found.'
                ];
            }

            require_once APP_DIR . 'libraries/EventAnnouncementMailer.php';
            $mailer = new EventAnnouncementMailer();
            $delivery = $mailer->send(
                $title,
                $content,
                $event,
                $recipients,
                'registration_open'
            );
            $delivery['success'] = $delivery['failed'] === 0;
            $delivery['message'] = $delivery['success']
                ? 'Registration-open email notifications were sent to eligible students.'
                : (
                    $delivery['error_message'] ??
                    'Some email notifications could not be delivered.'
                );

            if (!$delivery['success'] && ($delivery['failed'] ?? 0) > 0) {
                error_log(
                    'AnnouncementsController notify_students_about_event: ' .
                    $delivery['failed'] . ' student email(s) failed for announcement ' .
                    (int) $announcementId . '.'
                );
            }

            return $delivery;
        } catch (Throwable $e) {
            error_log(
                'AnnouncementsController notify_students_about_event: ' .
                $e->getMessage()
            );

            return [
                'success' => false,
                'sent' => 0,
                'failed' => null,
                'sent_emails' => [],
                'message' => 'Check the SMTP settings in the server environment.'
            ];
        }
    }

    private function notify_registered_accounts(
        $announcementId,
        $title,
        $content,
        $departmentId,
        array $alreadyNotified = []
    ) {
        try {
            $recipients = $this->db->raw(
                'SELECT DISTINCT u.email
                 FROM users u
                 LEFT JOIN sections s ON s.section_id = u.section_id
                 WHERE u.role = ?
                   AND u.status = ?
                   AND u.email IS NOT NULL
                   AND TRIM(u.email) <> ?' .
                    ($departmentId === null
                        ? ''
                        : ' AND COALESCE(u.dept_id, s.dept_id) = ?') .
                    ' ORDER BY u.email ASC',
                array_values(array_merge(
                    ['student', 'active', ''],
                    $departmentId === null
                        ? []
                        : [(int) $departmentId]
                ))
            )->fetchAll(PDO::FETCH_COLUMN);

            if (!$recipients) {
                return [
                    'success' => false,
                    'sent' => 0,
                    'failed' => 0,
                    'message' => 'No active student email accounts were found in the target audience.'
                ];
            }

            require_once APP_DIR . 'services/EmailService.php';
            $delivery = EmailService::sendEmails(
                $recipients,
                'New announcement: ' . $title,
                $title,
                $content,
                $alreadyNotified
            );

            if (!$delivery['success']) {
                error_log(
                    'AnnouncementsController notify_registered_accounts: ' .
                    $delivery['failed'] . ' email(s) failed for announcement ' .
                    (int) $announcementId . '.'
                );
            }

            return $delivery;
        } catch (Throwable $e) {
            error_log(
                'AnnouncementsController notify_registered_accounts: ' .
                $e->getMessage()
            );

            return [
                'success' => false,
                'sent' => 0,
                'failed' => null,
                'message' => 'Announcement was saved, but email delivery failed.'
            ];
        }
    }

    private function valid_id($id)
    {
        return $id !== null
            && ctype_digit((string) $id)
            && (int) $id > 0;
    }
}