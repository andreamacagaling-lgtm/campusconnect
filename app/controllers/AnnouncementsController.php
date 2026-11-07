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
            if ($id !== null) {
                if (!$this->valid_id($id)) {
                    $this->api->respond_error(
                        'Invalid announcement ID.',
                        400
                    );
                    return;
                }

                $announcement = $this->announcements->find((int) $id);

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
                'SELECT a.*, e.title AS event_title,
                        e.start_datetime AS event_start_datetime,
                        e.end_datetime AS event_end_datetime,
                        e.venue AS event_venue,
                        e.image AS event_image
                 FROM announcements a
                 LEFT JOIN events e ON e.event_id = a.event_id
                 ORDER BY a.created_at DESC'
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
                   AND status = ?
                   AND start_datetime > NOW()
                   AND end_datetime > NOW()
                 LIMIT 1',
                [$eventId, 'approved', 'upcoming']
            )->fetch(PDO::FETCH_ASSOC);

            if (!$event) {
                $this->api->respond_error(
                    'Select an approved upcoming event that is still open for registration.',
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
            'event_id' => $eventId
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
                    ' registered account(s).';
            } elseif ($emailNotification['success']) {
                $message = 'Announcement published; registered account emails already received the event notification.';
            } elseif ($emailNotification['failed'] === 0) {
                $message = 'Announcement published, but no active registered account emails were found to notify.';
            } elseif ($emailNotification['sent'] > 0) {
                $message = 'Announcement published; email was sent to ' .
                    $emailNotification['sent'] . ' Google account(s), but ' .
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
        $user = $this->api->require_jwt();

        if (
            !is_array($user) ||
            !isset($user['sub'], $user['role']) ||
            $user['role'] !== 'admin'
        ) {
            $this->api->respond_error(
                'Admin access required.',
                403
            );

            return null;
        }

        return $user;
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
                : 'Some email notifications could not be delivered.';

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
        array $alreadyNotified = []
    ) {
        try {
            $recipients = $this->db->raw(
                'SELECT DISTINCT email
                 FROM users
                 WHERE status = ?
                   AND email IS NOT NULL
                   AND TRIM(email) <> ?
                 ORDER BY email ASC',
                ['active', '']
            )->fetchAll(PDO::FETCH_COLUMN);

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
