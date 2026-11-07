<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class AttendanceController extends Controller
{
    public function __construct()
    {
        parent::__construct();

        $this->call->library('api');
        $this->call->database();
        $this->call->model('AttendanceModel');

        $this->attendance = new AttendanceModel();
    }

    public function index()
    {
        $this->api->require_method('GET');

        $user = $this->require_admin();

        if ($user === null) {
            return;
        }

        $eventId = $_GET['event_id'] ?? '';
        $deptId = $_GET['dept_id'] ?? '';
        $yrId = $_GET['yr_id'] ?? '';
        $sectionId = $_GET['section_id'] ?? '';
        $status = strtolower(trim((string) ($_GET['status'] ?? '')));

        foreach ([
            'event_id' => $eventId,
            'dept_id' => $deptId,
            'yr_id' => $yrId,
            'section_id' => $sectionId
        ] as $field => $value) {
            if ($value !== '' && !$this->valid_id($value)) {
                $this->api->respond_error('Invalid ' . $field . '.', 400);
                return;
            }
        }

        if (!in_array($status, [
            '',
            'present',
            'late',
            'absent',
            'not_scanned'
        ], true)) {
            $this->api->respond_error('Invalid attendance status.', 400);
            return;
        }

        $sql = "
            SELECT
                er.event_reg_id,
                er.event_id,
                er.registered_at,
                e.title AS event_title,
                event_department.dept_name AS event_dept_name,
                e.start_datetime,
                e.end_datetime,
                e.status AS event_status,
                u.user_id,
                u.student_no,
                u.full_name,
                u.email,
                d.dept_id,
                d.dept_name,
                yl.yr_id,
                yl.yr_name,
                s.section_id,
                s.section_name,
                a.attendance_id,
                UNIX_TIMESTAMP(a.scanned_at) AS scanned_at,
                a.scanned_by,
                a.status AS recorded_status,
                CASE
                    WHEN a.attendance_id IS NOT NULL THEN a.status
                    WHEN NOW() > e.end_datetime THEN 'absent'
                    ELSE 'not_scanned'
                END AS attendance_status
            FROM event_registrations er
            INNER JOIN events e ON e.event_id = er.event_id
            INNER JOIN users u ON u.user_id = er.user_id
            LEFT JOIN sections s ON s.section_id = u.section_id
            LEFT JOIN departments d ON d.dept_id = u.dept_id
            LEFT JOIN departments event_department
                ON event_department.dept_id = e.dept_id
            LEFT JOIN yr_levels yl ON yl.yr_id = u.yr_id
            LEFT JOIN attendance a ON a.event_reg_id = er.event_reg_id
            WHERE 1 = 1
        ";

        $params = [];
        $this->append_attendance_scope($sql, $params, $user);

        if ($eventId !== '') {
            $sql .= ' AND er.event_id = ?';
            $params[] = (int) $eventId;
        }

        if ($deptId !== '') {
            $sql .= ' AND d.dept_id = ?';
            $params[] = (int) $deptId;
        }

        if ($yrId !== '') {
            $sql .= ' AND yl.yr_id = ?';
            $params[] = (int) $yrId;
        }

        if ($sectionId !== '') {
            $sql .= ' AND s.section_id = ?';
            $params[] = (int) $sectionId;
        }

        if ($status === 'present' || $status === 'late') {
            $sql .= ' AND a.status = ?';
            $params[] = $status;
        } elseif ($status === 'absent') {
            $sql .= ' AND a.attendance_id IS NULL AND NOW() > e.end_datetime';
        } elseif ($status === 'not_scanned') {
            $sql .= ' AND a.attendance_id IS NULL AND NOW() <= e.end_datetime';
        }

        $sql .= ' ORDER BY e.start_datetime DESC, u.full_name ASC';

        try {
            $rows = $this->run_select($sql, $params);

            $this->api->respond([
                'success' => true,
                'data' => $rows
            ], 200);
        } catch (Throwable $e) {
            error_log('AttendanceController index: ' . $e->getMessage());
            $this->api->respond_error('Unable to retrieve attendance records.', 500);
        }
    }

    /**
     * GET /api/attendance/summary?event_id=1
     */
    public function summary()
    {
        $this->api->require_method('GET');

        $user = $this->require_admin();

        if ($user === null) {
            return;
        }

        $eventId = $_GET['event_id'] ?? '';
        $deptId = $_GET['dept_id'] ?? '';
        $yrId = $_GET['yr_id'] ?? '';
        $sectionId = $_GET['section_id'] ?? '';

        if (!$this->valid_id($eventId)) {
            $this->api->respond_error('A valid event_id is required.', 400);
            return;
        }

        foreach ([
            'dept_id' => $deptId,
            'yr_id' => $yrId,
            'section_id' => $sectionId
        ] as $field => $value) {
            if ($value !== '' && !$this->valid_id($value)) {
                $this->api->respond_error('Invalid ' . $field . '.', 400);
                return;
            }
        }

        $sql = "
            SELECT
                COUNT(*) AS registered,
                COALESCE(SUM(a.status = 'present'), 0) AS present_count,
                COALESCE(SUM(a.status = 'late'), 0) AS late_count,
                COALESCE(SUM(
                    a.attendance_id IS NULL AND NOW() > e.end_datetime
                ), 0) AS absent_count,
                COALESCE(SUM(
                    a.attendance_id IS NULL AND NOW() <= e.end_datetime
                ), 0) AS not_scanned_count
            FROM event_registrations er
            INNER JOIN events e ON e.event_id = er.event_id
            INNER JOIN users u ON u.user_id = er.user_id
            LEFT JOIN sections s ON s.section_id = u.section_id
            LEFT JOIN departments d ON d.dept_id = u.dept_id
            LEFT JOIN yr_levels yl ON yl.yr_id = u.yr_id
            LEFT JOIN attendance a ON a.event_reg_id = er.event_reg_id
            WHERE er.event_id = ?
        ";

        $params = [(int) $eventId];
        $this->append_attendance_scope($sql, $params, $user);

        if ($deptId !== '') {
            $sql .= ' AND d.dept_id = ?';
            $params[] = (int) $deptId;
        }

        if ($yrId !== '') {
            $sql .= ' AND yl.yr_id = ?';
            $params[] = (int) $yrId;
        }

        if ($sectionId !== '') {
            $sql .= ' AND s.section_id = ?';
            $params[] = (int) $sectionId;
        }

        try {
            $rows = $this->run_select($sql, $params);

            $this->api->respond([
                'success' => true,
                'data' => $rows[0] ?? [
                    'registered' => 0,
                    'present_count' => 0,
                    'late_count' => 0,
                    'absent_count' => 0,
                    'not_scanned_count' => 0
                ]
            ], 200);
        } catch (Throwable $e) {
            error_log('AttendanceController summary: ' . $e->getMessage());
            $this->api->respond_error('Unable to retrieve attendance summary.', 500);
        }
    }


    public function scan()
    {
        $this->api->require_method('POST');

        $user = $this->require_admin();

        if ($user === null) {
            return;
        }

        $body = $this->api->body();

        if (!is_array($body)) {
            $this->api->respond_error('Invalid request body.', 400);
            return;
        }

        $qrToken = trim((string) ($body['qr_token'] ?? ''));

        if ($qrToken === '') {
            $this->api->respond_error('QR token is required.', 400);
            return;
        }

        $sql = "
            SELECT
                er.event_reg_id,
                er.event_id,
                er.qr_token,
                e.title AS event_title,
                e.dept_id AS event_dept_id,
                e.approval_status,
                e.start_datetime,
                e.end_datetime,
                e.status AS event_status,
                u.user_id,
                u.student_no,
                u.full_name,
                sp.avatar AS avatar_url,
                d.dept_name,
                event_department.dept_name AS event_dept_name,
                yl.yr_name,
                s.section_name,
                a.attendance_id,
                a.status AS existing_status,
                UNIX_TIMESTAMP(a.scanned_at) AS existing_scanned_at
            FROM event_registrations er
            INNER JOIN events e ON e.event_id = er.event_id
            INNER JOIN users u ON u.user_id = er.user_id
            LEFT JOIN student_profiles sp ON sp.user_id = u.user_id
            LEFT JOIN sections s ON s.section_id = u.section_id
            LEFT JOIN departments d ON d.dept_id = u.dept_id
            LEFT JOIN departments event_department
                ON event_department.dept_id = e.dept_id
            LEFT JOIN yr_levels yl ON yl.yr_id = u.yr_id
            LEFT JOIN attendance a ON a.event_reg_id = er.event_reg_id
            WHERE er.qr_token = ?
            LIMIT 1
        ";

        try {
            $rows = $this->run_select($sql, [$qrToken]);

            if (empty($rows)) {
                $this->api->respond_error('Invalid QR code or registration not found.', 404);
                return;
            }

            $registration = $rows[0];

            if (!$this->can_manage_event($user, $registration->event_dept_id)) {
                $this->api->respond_error(
                    'Only the event department can record its attendance.',
                    403
                );
                return;
            }

            if ($registration->approval_status !== 'approved') {
                $this->api->respond_error(
                    'Attendance is available only for approved events.',
                    409
                );
                return;
            }

            if (!in_array($registration->event_status, ['upcoming', 'ongoing'], true)) {
                $this->api->respond_error(
                    'Attendance is unavailable for completed or cancelled events.',
                    409
                );
                return;
            }

            $now = time();
            $start = strtotime($registration->start_datetime);
            $end = strtotime($registration->end_datetime);

            if ($start === false || $end === false || $now > $end) {
                $this->api->respond_error(
                    'Attendance is available until the event ends.',
                    409
                );
                return;
            }

            if (!empty($registration->attendance_id)) {
                $this->api->respond([
                    'success' => false,
                    'message' => 'This student has already been scanned.',
                    'data' => [
                        'event_reg_id' => (int) $registration->event_reg_id,
                        'student_no' => $registration->student_no,
                        'full_name' => $registration->full_name,
                        'avatar_url' => $registration->avatar_url,
                        'event_title' => $registration->event_title,
                        'department' => $registration->dept_name,
                        'event_department' => $registration->event_dept_name,
                        'attendance_status' => $registration->existing_status,
                        'scanned_at' => $registration->existing_scanned_at
                    ]
                ], 409);

                return;
            }

            $lateCutoff = $start + (15 * 60);
            $attendanceStatus = ($now > $lateCutoff) ? 'late' : 'present';

            $insertSql = "
                INSERT INTO attendance
                    (event_reg_id, scanned_by, scanned_at, status)
                VALUES (?, ?, NOW(), ?)
            ";

            $this->run_write($insertSql, [
                (int) $registration->event_reg_id,
                (int) $user['user_id'],
                $attendanceStatus
            ]);

            $this->api->respond([
                'success' => true,
                'message' => 'Attendance recorded successfully.',
                'data' => [
                    'event_reg_id' => (int) $registration->event_reg_id,
                    'event_id' => (int) $registration->event_id,
                    'event_title' => $registration->event_title,
                    'event_department' => $registration->event_dept_name,
                    'student_no' => $registration->student_no,
                    'full_name' => $registration->full_name,
                    'avatar_url' => $registration->avatar_url,
                    'department' => $registration->dept_name,
                    'year_level' => $registration->yr_name,
                    'section' => $registration->section_name,
                    'scanned_at' => date('Y-m-d H:i:s'),
                    'attendance_status' => $attendanceStatus
                ]
            ], 201);
        } catch (Throwable $e) {
            error_log('AttendanceController scan: ' . $e->getMessage());

            if (stripos($e->getMessage(), 'duplicate') !== false) {
                $this->api->respond_error('This student has already been scanned.', 409);
                return;
            }

            $this->api->respond_error('Unable to record attendance.', 500);
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
            $this->api->respond_error('A valid event registration ID is required.', 400);
            return;
        }

        $body = $this->api->body();

        if (!is_array($body)) {
            $this->api->respond_error('Invalid request body.', 400);
            return;
        }

        $status = strtolower(trim((string) ($body['status'] ?? '')));

        if (!in_array($status, ['present', 'late'], true)) {
            $this->api->respond_error('Status must be present or late.', 422);
            return;
        }

        try {
            $existing = $this->run_select(
                'SELECT a.attendance_id, e.dept_id AS event_dept_id
                 FROM attendance a
                 INNER JOIN event_registrations er
                    ON er.event_reg_id = a.event_reg_id
                 INNER JOIN events e ON e.event_id = er.event_id
                 WHERE a.event_reg_id = ?
                 LIMIT 1',
                [(int) $id]
            );

            if (empty($existing)) {
                $this->api->respond_error('Attendance record not found.', 404);
                return;
            }

            if (!$this->can_manage_event($user, $existing[0]->event_dept_id)) {
                $this->api->respond_error(
                    'Only the event department can manage its attendance.',
                    403
                );
                return;
            }

            $this->run_write(
                'UPDATE attendance SET status = ? WHERE event_reg_id = ?',
                [$status, (int) $id]
            );

            $this->api->respond([
                'success' => true,
                'message' => 'Attendance status updated successfully.'
            ], 200);
        } catch (Throwable $e) {
            error_log('AttendanceController update: ' . $e->getMessage());
            $this->api->respond_error('Unable to update attendance.', 500);
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
            $this->api->respond_error('A valid event registration ID is required.', 400);
            return;
        }

        try {
            $existing = $this->run_select(
                'SELECT e.dept_id AS event_dept_id
                 FROM event_registrations er
                 INNER JOIN events e ON e.event_id = er.event_id
                 INNER JOIN attendance a ON a.event_reg_id = er.event_reg_id
                 WHERE er.event_reg_id = ?
                 LIMIT 1',
                [(int) $id]
            );

            if (empty($existing)) {
                $this->api->respond_error('Attendance record not found.', 404);
                return;
            }

            if (!$this->can_manage_event($user, $existing[0]->event_dept_id)) {
                $this->api->respond_error(
                    'Only the event department can manage its attendance.',
                    403
                );
                return;
            }

            $this->run_write(
                'DELETE FROM attendance WHERE event_reg_id = ?',
                [(int) $id]
            );

            $this->api->respond([
                'success' => true,
                'message' => 'Attendance record deleted successfully.'
            ], 200);
        } catch (Throwable $e) {
            error_log('AttendanceController delete: ' . $e->getMessage());
            $this->api->respond_error('Unable to delete attendance record.', 500);
        }
    }

    private function require_admin()
    {
        $claims = $this->api->require_jwt();

        if (
            !is_array($claims) ||
            !isset($claims['sub']) ||
            !$this->valid_id($claims['sub'])
        ) {
            $this->api->respond_error('Invalid authentication token.', 401);
            return null;
        }

        try {
            $rows = $this->run_select(
                'SELECT user_id, role, admin_type, dept_id, status
                 FROM users
                 WHERE user_id = ?
                 LIMIT 1',
                [(int) $claims['sub']]
            );

            if (empty($rows)) {
                $this->api->respond_error('User account not found.', 401);
                return null;
            }

            $user = (array) $rows[0];
            $user['user_id'] = (int) $user['user_id'];
            $user['dept_id'] = ($user['dept_id'] === null || $user['dept_id'] === '')
                ? null
                : (int) $user['dept_id'];
            $user['admin_type'] = $user['admin_type'] ?? 'department';

            if ($user['status'] !== 'active') {
                $this->api->respond_error('This account is inactive.', 403);
                return null;
            }

            if (
                $user['role'] !== 'admin' ||
                in_array($user['admin_type'], ['osse', 'organization'], true)
            ) {
                $this->api->respond_error('Admin attendance access required.', 403);
                return null;
            }

            return $user;
        } catch (Throwable $e) {
            error_log('AttendanceController require_admin: ' . $e->getMessage());
            $this->api->respond_error('Unable to verify the user account.', 500);
            return null;
        }
    }

    private function append_attendance_scope(&$sql, &$params, $user)
    {
        if ($user['admin_type'] !== 'usg') {
            $sql .= ' AND e.dept_id = ?';
            $params[] = (int) $user['dept_id'];
        }
    }

    private function can_manage_event($user, $eventDeptId)
    {
        if ($user['admin_type'] === 'usg') {
            return $eventDeptId === null || $eventDeptId === '';
        }

        return $user['dept_id'] !== null
            && $eventDeptId !== null
            && $eventDeptId !== ''
            && (int) $eventDeptId === (int) $user['dept_id'];
    }

    private function valid_id($id)
    {
        return $id !== null
            && $id !== ''
            && ctype_digit((string) $id)
            && (int) $id > 0;
    }

    private function run_select($sql, $params = [])
    {
        $result = $this->db->raw($sql, $params);

        if (is_object($result) && method_exists($result, 'fetchAll')) {
            return $result->fetchAll(PDO::FETCH_OBJ);
        }

        if (is_array($result)) {
            return $result;
        }

        throw new RuntimeException(
            'Unsupported raw-query result. Check the LavaLust database wrapper API.'
        );
    }

    private function run_write($sql, $params = [])
    {
        return $this->db->raw($sql, $params);
    }
}
