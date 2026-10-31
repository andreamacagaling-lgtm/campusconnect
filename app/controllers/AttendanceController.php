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
                e.start_datetime,
                e.end_datetime,
                e.status AS event_status,
                u.user_id,
                u.student_no,
                u.full_name,
                u.email,
                d.dept_id,
                d.dept_code,
                d.dept_name,
                yl.yr_id,
                yl.yr_name,
                s.section_id,
                s.section_name,
                a.attendance_id,
                a.scanned_at,
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
            LEFT JOIN departments d ON d.dept_id = s.dept_id
            LEFT JOIN yr_levels yl ON yl.yr_id = u.yr_id
            LEFT JOIN attendance a ON a.event_reg_id = er.event_reg_id
            WHERE 1 = 1
        ";

        $params = [];

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
            LEFT JOIN departments d ON d.dept_id = s.dept_id
            LEFT JOIN yr_levels yl ON yl.yr_id = u.yr_id
            LEFT JOIN attendance a ON a.event_reg_id = er.event_reg_id
            WHERE er.event_id = ?
        ";

        $params = [(int) $eventId];

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
                e.start_datetime,
                e.end_datetime,
                e.status AS event_status,
                u.user_id,
                u.student_no,
                u.full_name,
                d.dept_name,
                yl.yr_name,
                s.section_name,
                a.attendance_id,
                a.status AS existing_status,
                a.scanned_at AS existing_scanned_at
            FROM event_registrations er
            INNER JOIN events e ON e.event_id = er.event_id
            INNER JOIN users u ON u.user_id = er.user_id
            LEFT JOIN sections s ON s.section_id = u.section_id
            LEFT JOIN departments d ON d.dept_id = s.dept_id
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

            if ($registration->event_status !== 'ongoing') {
                $this->api->respond_error(
                    'The event must be ongoing before attendance can be scanned.',
                    409
                );
                return;
            }

            $now = time();
            $start = strtotime($registration->start_datetime);
            $end = strtotime($registration->end_datetime);

            if ($start === false || $end === false || $now < $start || $now > $end) {
                $this->api->respond_error(
                    'The current time is outside the event attendance window.',
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
                        'event_title' => $registration->event_title,
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
                (int) $user['sub'],
                $attendanceStatus
            ]);

            $this->api->respond([
                'success' => true,
                'message' => 'Attendance recorded successfully.',
                'data' => [
                    'event_reg_id' => (int) $registration->event_reg_id,
                    'event_id' => (int) $registration->event_id,
                    'event_title' => $registration->event_title,
                    'student_no' => $registration->student_no,
                    'full_name' => $registration->full_name,
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
                'SELECT attendance_id FROM attendance WHERE event_reg_id = ? LIMIT 1',
                [(int) $id]
            );

            if (empty($existing)) {
                $this->api->respond_error('Attendance record not found.', 404);
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
        $user = $this->api->require_jwt();

        if (
            !is_array($user) ||
            !isset($user['sub'], $user['role']) ||
            $user['role'] !== 'admin'
        ) {
            $this->api->respond_error('Admin access required.', 403);
            return null;
        }

        return $user;
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
