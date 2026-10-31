<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class StudentPortalController extends Controller
{
    public function __construct()
    {
        parent::__construct();

        $this->call->library('api');
        $this->call->database();
    }

    public function index()
    {
        $this->api->require_method('GET');

        $student = $this->get_student();

        if ($student === null) {
            return;
        }

        try {
            $profile = $this->db->raw(
                'SELECT
                    u.user_id,
                    u.student_no,
                    u.full_name,
                    u.email,
                    u.section_id,
                    u.yr_id,
                    COALESCE(u.dept_id, s.dept_id) AS dept_id,
                    d.dept_name,
                    s.section_name,
                    y.yr_name,
                    sp.contact_number,
                    sp.avatar
                FROM users u
                LEFT JOIN sections s ON s.section_id = u.section_id
                LEFT JOIN departments d
                    ON d.dept_id = COALESCE(u.dept_id, s.dept_id)
                LEFT JOIN yr_levels y ON y.yr_id = u.yr_id
                LEFT JOIN student_profiles sp ON sp.user_id = u.user_id
                WHERE u.user_id = ?
                LIMIT 1',
                [(int) $student['user_id']]
            )->fetch(PDO::FETCH_ASSOC);

            if (!$profile) {
                $this->api->respond_error(
                    'Student profile could not be loaded.',
                    500
                );
                return;
            }

            $events = $this->db->raw(
                'SELECT
                    e.event_id,
                    e.category_id,
                    e.dept_id,
                    e.title,
                    e.description,
                    e.venue,
                    e.image,
                    e.start_datetime,
                    e.end_datetime,
                    e.status,
                    c.category_name,
                    d.dept_name,
                    er.event_reg_id,
                    er.qr_token,
                    er.registered_at,
                    a.status AS attendance_status,
                    a.scanned_at
                FROM events e
                LEFT JOIN event_categories c
                    ON c.category_id = e.category_id
                LEFT JOIN departments d
                    ON d.dept_id = e.dept_id
                LEFT JOIN event_registrations er
                    ON er.event_id = e.event_id
                    AND er.user_id = ?
                LEFT JOIN attendance a
                    ON a.event_reg_id = er.event_reg_id
                WHERE (e.dept_id IS NULL OR e.dept_id = ?)
                ORDER BY e.start_datetime ASC',
                [
                    (int) $student['user_id'],
                    $profile['dept_id'] === null
                        ? 0
                        : (int) $profile['dept_id']
                ]
            )->fetchAll(PDO::FETCH_ASSOC);

            foreach ($events as &$event) {
                $event['event_id'] = (int) $event['event_id'];
                $event['is_registered'] = $event['event_reg_id'] !== null;
            }
            unset($event);

            $organizations = $this->db->raw(
                'SELECT
                    o.org_id,
                    o.org_name,
                    o.category,
                    o.description,
                    o.eligibility,
                    o.status,
                    r.status AS membership_status,
                    r.registered_at AS membership_registered_at
                FROM organizations o
                LEFT JOIN org_registrations r
                    ON r.org_id = o.org_id
                    AND r.user_id = ?
                WHERE o.status = ?
                ORDER BY o.org_name ASC',
                [(int) $student['user_id'], 'active']
            )->fetchAll(PDO::FETCH_ASSOC);

            foreach ($organizations as &$organization) {
                $organization['org_id'] = (int) $organization['org_id'];
            }
            unset($organization);

            $attendance = array_values(array_filter(
                $events,
                function ($event) {
                    return $event['is_registered'];
                }
            ));

            $this->api->respond([
                'success' => true,
                'data' => [
                    'profile' => $profile,
                    'events' => $events,
                    'organizations' => $organizations,
                    'attendance' => $attendance
                ]
            ], 200);
        } catch (Throwable $e) {
            error_log(
                'StudentPortalController index: ' . $e->getMessage()
            );

            $this->api->respond_error(
                'Unable to load the student portal.',
                500
            );
        }
    }

    public function register_event($eventId = null)
    {
        $this->api->require_method('POST');

        $student = $this->get_student();

        if ($student === null) {
            return;
        }

        if (!$this->valid_id($eventId)) {
            $this->api->respond_error('Invalid event ID.', 400);
            return;
        }

        try {
            $event = $this->db->raw(
                'SELECT e.event_id, e.dept_id, e.start_datetime,
                        e.end_datetime, e.status,
                        COALESCE(u.dept_id, s.dept_id) AS student_dept_id
                 FROM events e
                 LEFT JOIN users u ON u.user_id = ?
                 LEFT JOIN sections s ON s.section_id = u.section_id
                 WHERE e.event_id = ?
                 LIMIT 1',
                [(int) $student['user_id'], (int) $eventId]
            )->fetch(PDO::FETCH_ASSOC);

            if (!$event) {
                $this->api->respond_error('Event not found.', 404);
                return;
            }

            if (
                $event['dept_id'] !== null &&
                (
                    $event['student_dept_id'] === null ||
                    (int) $event['dept_id'] !==
                        (int) $event['student_dept_id']
                )
            ) {
                $this->api->respond_error(
                    'You are not eligible to register for this department event.',
                    403
                );
                return;
            }

            $end = strtotime((string) $event['end_datetime']);

            if (
                $event['status'] === 'cancelled' ||
                $event['status'] === 'completed' ||
                $end === false ||
                $end <= time()
            ) {
                $this->api->respond_error(
                    'Registration is closed for this event.',
                    409
                );
                return;
            }

            $existing = $this->db->raw(
                'SELECT event_reg_id
                 FROM event_registrations
                 WHERE event_id = ? AND user_id = ?
                 LIMIT 1',
                [(int) $eventId, (int) $student['user_id']]
            )->fetch(PDO::FETCH_ASSOC);

            if ($existing) {
                $this->api->respond_error(
                    'You are already registered for this event.',
                    409
                );
                return;
            }

            $this->db->raw(
                'INSERT INTO event_registrations
                    (event_id, user_id, qr_token)
                 VALUES (?, ?, ?)',
                [
                    (int) $eventId,
                    (int) $student['user_id'],
                    bin2hex(random_bytes(32))
                ]
            );

            $this->api->respond([
                'success' => true,
                'message' => 'You are registered for this event.'
            ], 201);
        } catch (Throwable $e) {
            error_log(
                'StudentPortalController register_event: ' .
                $e->getMessage()
            );

            if (stripos($e->getMessage(), 'duplicate') !== false) {
                $this->api->respond_error(
                    'You are already registered for this event.',
                    409
                );
                return;
            }

            $this->api->respond_error(
                'Unable to register for this event.',
                500
            );
        }
    }

    public function join_organization($organizationId = null)
    {
        $this->api->require_method('POST');

        $student = $this->get_student();

        if ($student === null) {
            return;
        }

        if (!$this->valid_id($organizationId)) {
            $this->api->respond_error('Invalid organization ID.', 400);
            return;
        }

        try {
            $applicant = $this->db->raw(
                'SELECT
                    u.full_name,
                    d.dept_name,
                    s.section_name,
                    y.yr_name
                 FROM users u
                 LEFT JOIN sections s ON s.section_id = u.section_id
                 LEFT JOIN departments d
                    ON d.dept_id = COALESCE(u.dept_id, s.dept_id)
                 LEFT JOIN yr_levels y ON y.yr_id = u.yr_id
                 WHERE u.user_id = ?
                 LIMIT 1',
                [(int) $student['user_id']]
            )->fetch(PDO::FETCH_ASSOC);

            if (!$applicant || trim((string) $applicant['full_name']) === '') {
                $this->api->respond_error(
                    'Complete your student profile before applying for membership.',
                    422
                );
                return;
            }

            $organization = $this->db->raw(
                'SELECT org_id
                 FROM organizations
                 WHERE org_id = ? AND status = ?
                 LIMIT 1',
                [(int) $organizationId, 'active']
            )->fetch(PDO::FETCH_ASSOC);

            if (!$organization) {
                $this->api->respond_error(
                    'Organization not found or inactive.',
                    404
                );
                return;
            }

            $existing = $this->db->raw(
                'SELECT reg_id, status
                 FROM org_registrations
                 WHERE org_id = ? AND user_id = ?
                 LIMIT 1',
                [(int) $organizationId, (int) $student['user_id']]
            )->fetch(PDO::FETCH_ASSOC);

            if ($existing) {
                $this->api->respond_error(
                    'You already have a membership request for this organization.',
                    409
                );
                return;
            }

            $this->db->raw(
                'INSERT INTO org_registrations (
                    org_id,
                    user_id,
                    applicant_full_name,
                    applicant_department,
                    applicant_section,
                    applicant_year_level
                 )
                 VALUES (?, ?, ?, ?, ?, ?)',
                [
                    (int) $organizationId,
                    (int) $student['user_id'],
                    trim($applicant['full_name']),
                    $applicant['dept_name'] ?: null,
                    $applicant['section_name'] ?: null,
                    $applicant['yr_name'] ?: null
                ]
            );

            $this->api->respond([
                'success' => true,
                'message' => 'Membership application submitted with your student details.'
            ], 201);
        } catch (Throwable $e) {
            error_log(
                'StudentPortalController join_organization: ' .
                $e->getMessage()
            );

            if (stripos($e->getMessage(), 'duplicate') !== false) {
                $this->api->respond_error(
                    'You already have a membership request for this organization.',
                    409
                );
                return;
            }

            $this->api->respond_error(
                'Unable to submit the membership request.',
                500
            );
        }
    }

    public function update_profile()
    {
        $this->api->require_method('PUT');

        $student = $this->get_student();

        if ($student === null) {
            return;
        }

        $body = $this->api->body();
        $fullName = trim((string) ($body['full_name'] ?? ''));
        $studentNo = trim((string) ($body['student_no'] ?? ''));
        $contactNumber = trim((string) ($body['contact_number'] ?? ''));

        if ($fullName === '') {
            $this->api->respond_error('Full name is required.', 422);
            return;
        }

        if (strlen($fullName) > 150 || strlen($studentNo) > 50) {
            $this->api->respond_error(
                'Full name or student number is too long.',
                422
            );
            return;
        }

        if (strlen($contactNumber) > 20) {
            $this->api->respond_error(
                'Contact number must be 20 characters or fewer.',
                422
            );
            return;
        }

        try {
            $this->db->raw(
                'UPDATE users
                 SET full_name = ?, student_no = ?
                 WHERE user_id = ?',
                [
                    $fullName,
                    $studentNo === '' ? null : $studentNo,
                    (int) $student['user_id']
                ]
            );

            $profile = $this->db->raw(
                'SELECT profile_id
                 FROM student_profiles
                 WHERE user_id = ?
                 LIMIT 1',
                [(int) $student['user_id']]
            )->fetch(PDO::FETCH_ASSOC);

            if ($profile) {
                $this->db->raw(
                    'UPDATE student_profiles
                     SET contact_number = ?
                     WHERE user_id = ?',
                    [
                        $contactNumber === '' ? null : $contactNumber,
                        (int) $student['user_id']
                    ]
                );
            } else {
                $this->db->raw(
                    'INSERT INTO student_profiles (user_id, contact_number)
                     VALUES (?, ?)',
                    [
                        (int) $student['user_id'],
                        $contactNumber === '' ? null : $contactNumber
                    ]
                );
            }

            $this->api->respond([
                'success' => true,
                'message' => 'Profile updated successfully.'
            ], 200);
        } catch (Throwable $e) {
            error_log(
                'StudentPortalController update_profile: ' .
                $e->getMessage()
            );

            if (stripos($e->getMessage(), 'duplicate') !== false) {
                $this->api->respond_error(
                    'That student number is already in use.',
                    409
                );
                return;
            }

            $this->api->respond_error(
                'Unable to update the student profile.',
                500
            );
        }
    }

    private function get_student()
    {
        $claims = $this->api->require_jwt();

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

        try {
            $student = $this->db->raw(
                'SELECT user_id, role, status
                 FROM users
                 WHERE user_id = ?
                 LIMIT 1',
                [(int) $claims['sub']]
            )->fetch(PDO::FETCH_ASSOC);
        } catch (Throwable $e) {
            error_log(
                'StudentPortalController get_student: ' .
                $e->getMessage()
            );

            $this->api->respond_error(
                'Unable to verify the student account.',
                500
            );
            return null;
        }

        if (!$student || $student['status'] !== 'active') {
            $this->api->respond_error(
                'Active student account required.',
                401
            );
            return null;
        }

        if ($student['role'] !== 'student') {
            $this->api->respond_error(
                'Student access required.',
                403
            );
            return null;
        }

        return $student;
    }

    private function valid_id($id)
    {
        return $id !== null &&
            is_scalar($id) &&
            ctype_digit((string) $id) &&
            (int) $id > 0;
    }
}
