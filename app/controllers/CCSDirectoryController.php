<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class CCSDirectoryController extends Controller
{
    public function __construct()
    {
        parent::__construct();

        $this->call->library('api');
        $this->call->database();
    }

    /**
     * GET /api/ccs-directory
     * Returns student records belonging to the CCS department.
     */
    public function index()
    {
        try {
            $this->api->require_method('GET');

            // Require a valid JWT token.
            $claims = $this->api->require_jwt();

            // Get authenticated user ID from JWT subject.
            $userId = $claims['sub'] ?? null;

            if (!$userId || !is_numeric($userId)) {
                $this->api->respond_error(
                    'Invalid authenticated user.',
                    401
                );
                return;
            }

            // Verify the user's role and department using the database.
            $result = $this->db->raw(
                'SELECT user_id, role, admin_type, dept_id, status
                 FROM users
                 WHERE user_id = ?
                 LIMIT 1',
                [(int) $userId]
            );

            $admin = $result->fetch(PDO::FETCH_ASSOC);

            if (!$admin || $admin['status'] !== 'active') {
                $this->api->respond_error(
                    'Your account is not active or does not exist.',
                    403
                );
                return;
            }

            // Only CCS Department Admins can access this directory.
            if (
                $admin['role'] !== 'admin' ||
                $admin['admin_type'] !== 'department' ||
                (int) $admin['dept_id'] !== 1
            ) {
                $this->api->respond_error(
                    'Only CCS Department Admins can access this directory.',
                    403
                );
                return;
            }

            // Fetch real CCS student records; no sample data.
            $studentsResult = $this->db->raw(
                "SELECT
                    u.user_id,
                    u.student_no,
                    u.full_name,
                    u.email,
                    u.status,
                    u.created_at,
                    d.dept_name,
                    y.yr_name,
                    s.section_name,
                    sp.contact_number,
                    sp.avatar
                FROM users u
                LEFT JOIN departments d
                    ON d.dept_id = u.dept_id
                LEFT JOIN yr_levels y
                    ON y.yr_id = u.yr_id
                LEFT JOIN sections s
                    ON s.section_id = u.section_id
                LEFT JOIN student_profiles sp
                    ON sp.user_id = u.user_id
                WHERE u.role = 'student'
                  AND u.dept_id = ?
                ORDER BY u.full_name ASC",
                [1]
            );

            $students = $studentsResult->fetchAll(PDO::FETCH_ASSOC);

            foreach ($students as &$student) {
                $student['user_id'] = (int) $student['user_id'];
            }
            unset($student);

            $this->api->respond([
                'success' => true,
                'message' => 'CCS directory retrieved successfully.',
                'data' => $students,
                'total' => count($students)
            ], 200);

        } catch (Throwable $e) {
            error_log(
                'CCSDirectoryController::index error: ' .
                $e->getMessage()
            );

            $this->api->respond_error(
                'Unable to retrieve the CCS directory.',
                500
            );
        }
    }
}
