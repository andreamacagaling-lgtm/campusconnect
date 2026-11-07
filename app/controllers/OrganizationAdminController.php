<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class OrganizationAdminController extends Controller
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
        if ($this->require_usg_admin() === null) {
            return;
        }

        try {
            $departments = $this->db->raw(
                'SELECT dept_id, dept_name
                 FROM departments
                 WHERE dept_id BETWEEN 1 AND 6
                 ORDER BY dept_id'
            )->fetchAll(PDO::FETCH_ASSOC);

            $accounts = $this->db->raw(
                'SELECT u.user_id, u.full_name, u.email,
                        u.organization_dept_id,
                        u.status, u.created_at, d.dept_name
                 FROM users u
                 LEFT JOIN departments d
                    ON d.dept_id = u.organization_dept_id
                 WHERE u.role = ? AND u.admin_type = ?
                 ORDER BY u.organization_dept_id IS NULL,
                          d.dept_id, u.full_name',
                ['admin', 'organization']
            )->fetchAll(PDO::FETCH_ASSOC);

            $this->api->respond([
                'success' => true,
                'departments' => $departments,
                'accounts' => $accounts
            ]);
        } catch (Throwable $e) {
            error_log('OrganizationAdminController index: ' . $e->getMessage());
            $this->api->respond_error(
                'Unable to load organization administrator accounts.',
                500
            );
        }
    }

    public function create()
    {
        $this->api->require_method('POST');
        if ($this->require_usg_admin() === null) {
            return;
        }

        $input = $this->api->body();
        $fullName = trim((string) ($input['full_name'] ?? ''));
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $password = (string) ($input['password'] ?? '');
        $departmentId = $input['organization_dept_id'] ?? null;

        if ($fullName === '' || mb_strlen($fullName) > 150) {
            $this->api->respond_error(
                'Full name is required and must be 150 characters or fewer.',
                422
            );
            return;
        }

        if (
            $email === '' ||
            strlen($email) > 255 ||
            !filter_var($email, FILTER_VALIDATE_EMAIL)
        ) {
            $this->api->respond_error('Enter a valid email address.', 422);
            return;
        }

        if (strlen($password) < 8) {
            $this->api->respond_error(
                'Password must be at least 8 characters.',
                422
            );
            return;
        }

        if (
            !is_scalar($departmentId) ||
            !ctype_digit((string) $departmentId) ||
            (int) $departmentId < 1 ||
            (int) $departmentId > 6
        ) {
            $this->api->respond_error(
                'Select one of the six supported departments.',
                422
            );
            return;
        }

        try {
            $department = $this->db->raw(
                'SELECT dept_id
                 FROM departments
                 WHERE dept_id = ?
                 LIMIT 1',
                [(int) $departmentId]
            )->fetch(PDO::FETCH_ASSOC);

            if (!$department) {
                $this->api->respond_error('Department not found.', 422);
                return;
            }

            $existingDepartmentAccount = $this->db->raw(
                'SELECT user_id
                 FROM users
                 WHERE role = ? AND admin_type = ?
                   AND organization_dept_id = ?
                 LIMIT 1',
                ['admin', 'organization', (int) $department['dept_id']]
            )->fetch(PDO::FETCH_ASSOC);

            if ($existingDepartmentAccount) {
                $this->api->respond_error(
                    'An organization administrator account already exists for this department.',
                    409
                );
                return;
            }

            $existing = $this->db->raw(
                'SELECT user_id FROM users WHERE email = ? LIMIT 1',
                [$email]
            )->fetch(PDO::FETCH_ASSOC);

            if ($existing) {
                $this->api->respond_error(
                    'This email is already registered.',
                    409
                );
                return;
            }

            $passwordHash = password_hash($password, PASSWORD_DEFAULT);
            if ($passwordHash === false) {
                throw new RuntimeException('Unable to hash the account password.');
            }

            try {
                $this->db->raw(
                    'INSERT INTO users
                        (student_no, full_name, email, password_hash, role,
                         admin_type, dept_id, organization_dept_id, status)
                     VALUES (NULL, ?, ?, ?, ?, ?, NULL, ?, ?)',
                    [
                        $fullName,
                        $email,
                        $passwordHash,
                        'admin',
                        'organization',
                        (int) $department['dept_id'],
                        'active'
                    ]
                );
            } catch (Throwable $e) {
                if (stripos($e->getMessage(), 'duplicate') !== false) {
                    $this->api->respond_error(
                        'An organization administrator account already exists for this department.',
                        409
                    );
                    return;
                }
                throw $e;
            }

            $account = $this->db->raw(
                'SELECT u.user_id, u.full_name, u.email,
                        u.organization_dept_id,
                        u.status, u.created_at, d.dept_name
                 FROM users u
                 INNER JOIN departments d
                    ON d.dept_id = u.organization_dept_id
                 WHERE u.email = ?
                 LIMIT 1',
                [$email]
            )->fetch(PDO::FETCH_ASSOC);

            if (!$account) {
                throw new RuntimeException('Created account could not be loaded.');
            }

            $this->api->respond([
                'success' => true,
                'message' => 'Organization administrator account created.',
                'account' => $account
            ], 201);
        } catch (Throwable $e) {
            error_log('OrganizationAdminController create: ' . $e->getMessage());
            $this->api->respond_error(
                'Unable to create the organization administrator account.',
                500
            );
        }
    }

    public function assign_department($id)
    {
        $this->api->require_method('PUT');
        if ($this->require_usg_admin() === null) {
            return;
        }

        if (!ctype_digit((string) $id) || (int) $id < 1) {
            $this->api->respond_error('Invalid organization admin account.', 422);
            return;
        }

        $input = $this->api->body();
        $departmentId = $input['organization_dept_id'] ?? null;
        if (
            !is_scalar($departmentId) ||
            !ctype_digit((string) $departmentId) ||
            (int) $departmentId < 1 ||
            (int) $departmentId > 6
        ) {
            $this->api->respond_error(
                'Select one of the six supported departments.',
                422
            );
            return;
        }

        try {
            $account = $this->db->raw(
                'SELECT user_id
                 FROM users
                 WHERE user_id = ? AND role = ? AND admin_type = ?
                 LIMIT 1',
                [(int) $id, 'admin', 'organization']
            )->fetch(PDO::FETCH_ASSOC);

            if (!$account) {
                $this->api->respond_error(
                    'Organization administrator account not found.',
                    404
                );
                return;
            }

            $department = $this->db->raw(
                'SELECT dept_id
                 FROM departments
                 WHERE dept_id = ?
                 LIMIT 1',
                [(int) $departmentId]
            )->fetch(PDO::FETCH_ASSOC);

            if (!$department) {
                $this->api->respond_error('Department not found.', 422);
                return;
            }

            $assignedAccount = $this->db->raw(
                'SELECT user_id
                 FROM users
                 WHERE role = ? AND admin_type = ?
                   AND organization_dept_id = ? AND user_id <> ?
                 LIMIT 1',
                [
                    'admin',
                    'organization',
                    (int) $department['dept_id'],
                    (int) $id
                ]
            )->fetch(PDO::FETCH_ASSOC);

            if ($assignedAccount) {
                $this->api->respond_error(
                    'An organization administrator account already exists for this department.',
                    409
                );
                return;
            }

            $this->db->raw(
                'UPDATE users
                 SET organization_dept_id = ?, dept_id = NULL, student_no = NULL
                 WHERE user_id = ? AND role = ? AND admin_type = ?',
                [
                    (int) $department['dept_id'],
                    (int) $id,
                    'admin',
                    'organization'
                ]
            );

            $this->api->respond([
                'success' => true,
                'message' => 'Organization administrator department assigned.'
            ]);
        } catch (Throwable $e) {
            error_log(
                'OrganizationAdminController assign_department: ' .
                $e->getMessage()
            );
            $this->api->respond_error(
                'Unable to assign the organization administrator department.',
                500
            );
        }
    }

    private function require_usg_admin()
    {
        $claims = $this->api->require_jwt();
        $userId = $claims['sub'] ?? null;

        if (
            $userId === null ||
            !ctype_digit((string) $userId) ||
            ($claims['role'] ?? null) !== 'admin' ||
            ($claims['admin_type'] ?? null) !== 'usg'
        ) {
            $this->api->respond_error('University admin access required.', 403);
            return null;
        }

        $admin = $this->db->raw(
            'SELECT user_id, role, admin_type, dept_id, status
             FROM users
             WHERE user_id = ?
             LIMIT 1',
            [(int) $userId]
        )->fetch(PDO::FETCH_ASSOC);

        if (
            !$admin ||
            $admin['role'] !== 'admin' ||
            $admin['admin_type'] !== 'usg' ||
            $admin['dept_id'] !== null ||
            $admin['status'] !== 'active'
        ) {
            $this->api->respond_error('University admin access required.', 403);
            return null;
        }

        return $admin;
    }
}
