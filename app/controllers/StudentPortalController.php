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

            $academicOptions = $this->db->raw(
                'SELECT
                    y.yr_id,
                    y.yr_name,
                    s.section_id,
                    s.section_name
                 FROM sections s
                 INNER JOIN yr_levels y ON y.yr_id = s.yr_id
                 WHERE s.dept_id = ?
                 ORDER BY y.yr_id ASC, s.section_name ASC',
                [(int) ($profile['dept_id'] ?? 0)]
            )->fetchAll(PDO::FETCH_ASSOC);

            foreach ($academicOptions as &$option) {
                $option['yr_id'] = (int) $option['yr_id'];
                $option['section_id'] = (int) $option['section_id'];
            }
            unset($option);

            $events = $this->db->raw(
                'SELECT
                    e.event_id,
                    e.category_id,
                    e.dept_id,
                    e.org_id,
                    e.title,
                    e.description,
                    e.venue,
                    e.image,
                    e.start_datetime,
                    e.end_datetime,
                    e.status,
                    c.category_name,
                    d.dept_name,
                    o.org_name,
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
                LEFT JOIN organizations o
                    ON o.org_id = e.org_id
                LEFT JOIN event_registrations er
                    ON er.event_id = e.event_id
                    AND er.user_id = ?
                LEFT JOIN attendance a
                    ON a.event_reg_id = er.event_reg_id
                WHERE e.approval_status = ?
                    AND (e.dept_id IS NULL OR e.dept_id = ?)
                ORDER BY e.start_datetime ASC',
                [
                    (int) $student['user_id'],
                    'approved',
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
                    'academic_options' => $academicOptions,
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
                        e.end_datetime, e.status, e.approval_status,
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

            if ($event['approval_status'] !== 'approved') {
                $this->api->respond_error(
                    'This event is not available for registration.',
                    409
                );
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
            $body = $this->api->body();
            if (!is_array($body)) {
                $this->api->respond_error('Invalid request body.', 400);
                return;
            }

            $applicant = [
                'full_name' => trim((string) ($body['full_name'] ?? '')),
                'department' => trim((string) ($body['department'] ?? '')),
                'section' => trim((string) ($body['section'] ?? '')),
                'year_level' => trim((string) ($body['year_level'] ?? ''))
            ];

            foreach ($applicant as $value) {
                if ($value === '') {
                    $this->api->respond_error(
                        'Full name, department, section, and year level are required.',
                        422
                    );
                    return;
                }
            }

            if (
                strlen($applicant['full_name']) > 150 ||
                strlen($applicant['department']) > 150 ||
                strlen($applicant['section']) > 100 ||
                strlen($applicant['year_level']) > 50
            ) {
                $this->api->respond_error(
                    'One or more membership application fields are too long.',
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
                    'You already have a membership application for this organization.',
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
                    $applicant['full_name'],
                    $applicant['department'],
                    $applicant['section'],
                    $applicant['year_level']
                ]
            );

            $this->api->respond([
                'success' => true,
                'message' => 'Membership application submitted successfully.'
            ], 201);
        } catch (Throwable $e) {
            error_log(
                'StudentPortalController join_organization: ' .
                $e->getMessage()
            );

            if (stripos($e->getMessage(), 'duplicate') !== false) {
                $this->api->respond_error(
                    'You already have a membership application for this organization.',
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
        $yearId = $body['yr_id'] ?? '';
        $sectionId = $body['section_id'] ?? '';

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

        if (($yearId === '' || $yearId === null) !==
            ($sectionId === '' || $sectionId === null)) {
            $this->api->respond_error(
                'Choose both a year level and section.',
                422
            );
            return;
        }

        $yearId = ($yearId === '' || $yearId === null)
            ? null
            : (string) $yearId;
        $sectionId = ($sectionId === '' || $sectionId === null)
            ? null
            : (string) $sectionId;

        if (
            ($yearId !== null && !$this->valid_positive_id($yearId)) ||
            ($sectionId !== null && !$this->valid_positive_id($sectionId))
        ) {
            $this->api->respond_error(
                'Choose a valid year level and section.',
                422
            );
            return;
        }

        try {
            if ($yearId !== null && $sectionId !== null) {
                $validSection = $this->db->raw(
                    'SELECT s.section_id
                     FROM sections s
                     INNER JOIN users u ON u.user_id = ?
                     LEFT JOIN sections current_section
                        ON current_section.section_id = u.section_id
                     WHERE s.section_id = ?
                       AND s.yr_id = ?
                       AND s.dept_id = COALESCE(
                            u.dept_id,
                            current_section.dept_id
                       )
                     LIMIT 1',
                    [
                        (int) $student['user_id'],
                        (int) $sectionId,
                        (int) $yearId
                    ]
                )->fetch(PDO::FETCH_ASSOC);

                if (!$validSection) {
                    $this->api->respond_error(
                        'The selected section does not match your department and year level.',
                        422
                    );
                    return;
                }
            }

            $this->db->raw(
                'UPDATE users
                 SET full_name = ?, student_no = ?, yr_id = ?, section_id = ?
                 WHERE user_id = ?',
                [
                    $fullName,
                    $studentNo === '' ? null : $studentNo,
                    $yearId === null ? null : (int) $yearId,
                    $sectionId === null ? null : (int) $sectionId,
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

    public function upload_avatar()
    {
        $this->api->require_method('POST');

        $student = $this->get_student();
        if ($student === null) {
            return;
        }

        $upload = $_FILES['avatar'] ?? null;
        if (!is_array($upload) || !isset($upload['error'])) {
            $this->api->respond_error('Choose a profile photo to upload.', 422);
            return;
        }

        if ($upload['error'] !== UPLOAD_ERR_OK) {
            $this->api->respond_error(
                $upload['error'] === UPLOAD_ERR_INI_SIZE ||
                $upload['error'] === UPLOAD_ERR_FORM_SIZE
                    ? 'Profile photos must be 2000 MB or smaller.'
                    : 'The profile photo could not be uploaded.',
                422
            );
            return;
        }

        if (
            !isset($upload['tmp_name'], $upload['size']) ||
            !is_string($upload['tmp_name']) ||
            !is_uploaded_file($upload['tmp_name']) ||
            $upload['size'] < 1 ||
            $upload['size'] > 2000 * 1024 * 1024
        ) {
            $this->api->respond_error(
                'Choose a valid image file that is 2000 MB or smaller.',
                422
            );
            return;
        }

        $imageInfo = @getimagesize($upload['tmp_name']);
        $fileInfo = new finfo(FILEINFO_MIME_TYPE);
        $mimeType = $fileInfo->file($upload['tmp_name']);
        $extensions = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp'
        ];

        if (
            !$imageInfo ||
            !is_string($mimeType) ||
            !isset($extensions[$mimeType]) ||
            $imageInfo['mime'] !== $mimeType ||
            $imageInfo[0] < 1 ||
            $imageInfo[1] < 1 ||
            $imageInfo[0] > 8000 ||
            $imageInfo[1] > 8000 ||
            $imageInfo[0] * $imageInfo[1] > 12000000
        ) {
            $this->api->respond_error(
                'Use a valid JPEG, PNG, or WebP profile photo.',
                422
            );
            return;
        }

        $avatarDirectory = ROOT_DIR . 'public/uploads/avatars';
        if (
            !is_dir($avatarDirectory) &&
            !mkdir($avatarDirectory, 0755, true) &&
            !is_dir($avatarDirectory)
        ) {
            error_log('StudentPortalController upload_avatar: Unable to create avatar directory.');
            $this->api->respond_error(
                'Unable to save the profile photo right now.',
                500
            );
            return;
        }

        $filename = bin2hex(random_bytes(16)) . '.' . $extensions[$mimeType];
        $destination = $avatarDirectory . DIRECTORY_SEPARATOR . $filename;
        $avatarPath = '/uploads/avatars/' . $filename;

        if (!move_uploaded_file($upload['tmp_name'], $destination)) {
            error_log('StudentPortalController upload_avatar: Unable to move uploaded photo.');
            $this->api->respond_error(
                'Unable to save the profile photo right now.',
                500
            );
            return;
        }

        try {
            $userId = (int) $student['user_id'];
            $profile = $this->db->raw(
                'SELECT avatar
                 FROM student_profiles
                 WHERE user_id = ?
                 LIMIT 1',
                [$userId]
            )->fetch(PDO::FETCH_ASSOC);

            if ($profile) {
                $this->db->raw(
                    'UPDATE student_profiles
                     SET avatar = ?
                     WHERE user_id = ?',
                    [$avatarPath, $userId]
                );
            } else {
                $this->db->raw(
                    'INSERT INTO student_profiles (user_id, avatar)
                     VALUES (?, ?)',
                    [$userId, $avatarPath]
                );
            }

            $oldAvatar = (string) ($profile['avatar'] ?? '');
            if (preg_match('#^/uploads/avatars/([a-f0-9]{32}\.(?:jpg|png|webp))$#', $oldAvatar, $matches)) {
                $oldAvatarFile = $avatarDirectory . DIRECTORY_SEPARATOR . $matches[1];
                if (is_file($oldAvatarFile) && !unlink($oldAvatarFile)) {
                    error_log(
                        'StudentPortalController upload_avatar: Unable to remove previous avatar.'
                    );
                }
            }

            $this->api->respond([
                'success' => true,
                'message' => 'Profile photo updated successfully.',
                'avatar' => $avatarPath
            ], 200);
        } catch (Throwable $e) {
            if (is_file($destination)) {
                unlink($destination);
            }

            error_log(
                'StudentPortalController upload_avatar: ' . $e->getMessage()
            );
            $this->api->respond_error(
                'Unable to update the profile photo.',
                500
            );
        }
    }

    private function valid_positive_id($value)
    {
        return is_scalar($value)
            && ctype_digit((string) $value)
            && (int) $value > 0;
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
