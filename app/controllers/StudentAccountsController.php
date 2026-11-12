<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class StudentAccountsController extends Controller
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

        if ($this->require_osse_admin() === null) {
            return;
        }

        try {
            $students = $this->db->raw(
                "SELECT
                    u.user_id,
                    u.student_no,
                    u.full_name,
                    u.email,
                    u.status,
                    u.created_at,
                    COALESCE(u.dept_id, s.dept_id) AS dept_id,
                    d.dept_name,
                    COALESCE(u.yr_id, s.yr_id) AS yr_id,
                    y.yr_name,
                    u.section_id,
                    s.section_name
                 FROM users u
                 LEFT JOIN sections s ON s.section_id = u.section_id
                 LEFT JOIN departments d
                    ON d.dept_id = COALESCE(u.dept_id, s.dept_id)
                 LEFT JOIN yr_levels y
                    ON y.yr_id = COALESCE(u.yr_id, s.yr_id)
                 WHERE u.role = ?
                 ORDER BY
                    FIELD(u.status, 'pending', 'active', 'inactive'),
                    u.full_name ASC",
                ['student']
            )->fetchAll(PDO::FETCH_ASSOC);

            foreach ($students as &$student) {
                $student['user_id'] = (int) $student['user_id'];
                $student['dept_id'] = $student['dept_id'] === null
                    ? null
                    : (int) $student['dept_id'];
                $student['yr_id'] = $student['yr_id'] === null
                    ? null
                    : (int) $student['yr_id'];
                $student['section_id'] = $student['section_id'] === null
                    ? null
                    : (int) $student['section_id'];
            }
            unset($student);

            $this->api->respond([
                'success' => true,
                'data' => $students
            ]);
        } catch (Throwable $e) {
            error_log('StudentAccountsController index: ' . $e->getMessage());
            $this->api->respond_error(
                'Unable to load student accounts.',
                500
            );
        }
    }

    public function update_status($studentId = null)
    {
        $this->api->require_method('PUT');

        if ($this->require_osse_admin() === null) {
            return;
        }

        if (!$this->valid_id($studentId)) {
            $this->api->respond_error('Invalid student ID.', 400);
            return;
        }

        $input = $this->api->body();
        $status = strtolower(trim((string) ($input['status'] ?? '')));
        if (!in_array($status, ['active', 'inactive'], true)) {
            $this->api->respond_error(
                'Student status must be active or inactive.',
                422
            );
            return;
        }

        try {
            $student = $this->db->raw(
                'SELECT user_id, status
                 FROM users
                 WHERE user_id = ? AND role = ?
                 LIMIT 1',
                [(int) $studentId, 'student']
            )->fetch(PDO::FETCH_ASSOC);

            if (!$student) {
                $this->api->respond_error('Student account not found.', 404);
                return;
            }

            $wasPending = $student['status'] === 'pending';
            if ($student['status'] !== $status) {
                $this->db->raw(
                    'UPDATE users
                     SET status = ?
                     WHERE user_id = ? AND role = ?',
                    [$status, (int) $studentId, 'student']
                );

                if ($status === 'inactive') {
                    $this->db->raw(
                        'DELETE FROM refresh_tokens WHERE user_id = ?',
                        [(int) $studentId]
                    );
                }
            }

            $this->api->respond([
                'success' => true,
                'message' => $status === 'active'
                    ? ($wasPending
                        ? 'Student account approved and activated.'
                        : 'Student account activated.')
                    : 'Student account deactivated.',
                'data' => [
                    'user_id' => (int) $studentId,
                    'status' => $status
                ]
            ]);
        } catch (Throwable $e) {
            error_log(
                'StudentAccountsController update_status: ' .
                $e->getMessage()
            );
            $this->api->respond_error(
                'Unable to update the student account.',
                500
            );
        }
    }

    public function population_report()
    {
        $this->api->require_method('GET');

        if ($this->require_osse_admin() === null) {
            return;
        }

        try {
            $report = $this->db->raw(
                "SELECT
                    d.dept_id,
                    d.dept_name,
                    COUNT(u.user_id) AS total_students,
                    COALESCE(SUM(u.status = 'active'), 0) AS active_students,
                    COALESCE(SUM(u.status = 'pending'), 0) AS pending_students,
                    COALESCE(SUM(u.status = 'inactive'), 0) AS inactive_students
                 FROM departments d
                 LEFT JOIN users u
                    ON u.role = 'student'
                    AND (
                        u.dept_id = d.dept_id
                        OR (
                            u.dept_id IS NULL
                            AND EXISTS (
                                SELECT 1
                                FROM sections s
                                WHERE s.section_id = u.section_id
                                    AND s.dept_id = d.dept_id
                            )
                        )
                    )
                 GROUP BY d.dept_id, d.dept_name
                 UNION ALL
                 SELECT
                    NULL AS dept_id,
                    'Unassigned' AS dept_name,
                    COUNT(u.user_id) AS total_students,
                    COALESCE(SUM(u.status = 'active'), 0) AS active_students,
                    COALESCE(SUM(u.status = 'pending'), 0) AS pending_students,
                    COALESCE(SUM(u.status = 'inactive'), 0) AS inactive_students
                 FROM users u
                 LEFT JOIN sections s ON s.section_id = u.section_id
                 WHERE u.role = 'student'
                    AND COALESCE(u.dept_id, s.dept_id) IS NULL
                 HAVING COUNT(u.user_id) > 0
                 ORDER BY dept_name ASC"
            )->fetchAll(PDO::FETCH_ASSOC);

            foreach ($report as &$department) {
                $department['dept_id'] = $department['dept_id'] === null
                    ? null
                    : (int) $department['dept_id'];
                $department['total_students'] =
                    (int) $department['total_students'];
                $department['active_students'] =
                    (int) $department['active_students'];
                $department['pending_students'] =
                    (int) $department['pending_students'];
                $department['inactive_students'] =
                    (int) $department['inactive_students'];
            }
            unset($department);

            $this->api->respond([
                'success' => true,
                'data' => $report
            ]);
        } catch (Throwable $e) {
            error_log(
                'StudentAccountsController population_report: ' .
                $e->getMessage()
            );
            $this->api->respond_error(
                'Unable to load the student population report.',
                500
            );
        }
    }

    private function require_osse_admin()
    {
        $claims = $this->api->require_jwt();
        $userId = $claims['sub'] ?? null;

        if (!$this->valid_id($userId)) {
            $this->api->respond_error('Invalid authentication token.', 401);
            return null;
        }

        try {
            $user = $this->db->raw(
                'SELECT role, admin_type, status
                 FROM users
                 WHERE user_id = ?
                 LIMIT 1',
                [(int) $userId]
            )->fetch(PDO::FETCH_ASSOC);
        } catch (Throwable $e) {
            error_log(
                'StudentAccountsController require_osse_admin: ' .
                $e->getMessage()
            );
            $this->api->respond_error('Unable to verify the account.', 500);
            return null;
        }

        if (!$user || $user['status'] !== 'active') {
            $this->api->respond_error(
                'Active OSSE administrator access required.',
                401
            );
            return null;
        }

        if ($user['role'] !== 'admin' || $user['admin_type'] !== 'osse') {
            $this->api->respond_error(
                'OSSE student-account access required.',
                403
            );
            return null;
        }

        return $user;
    }

    private function valid_id($value)
    {
        return $value !== null
            && is_scalar($value)
            && ctype_digit((string) $value)
            && (int) $value > 0;
    }
}
