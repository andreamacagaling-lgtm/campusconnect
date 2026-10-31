<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class AuthController extends Controller
{
    public function __construct()
    {
        parent::__construct();

        $this->call->library('api');
        $this->call->database();
    }

    public function register()
    {
        $this->api->require_method('POST');
        $this->api->rate_limit();

        $input = $this->api->body();

        $studentNo = trim((string) ($input['student_no'] ?? ''));
        $fullName  = trim((string) ($input['full_name'] ?? ''));
        $email     = strtolower(trim((string) ($input['email'] ?? '')));
        $password  = (string) ($input['password'] ?? '');

        if ($fullName === '' || $email === '' || $password === '') {
            $this->api->respond_error(
                'Full name, email, and password are required.',
                422
            );
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->api->respond_error('Invalid email address.', 422);
        }

        if (strlen($password) < 8) {
            $this->api->respond_error(
                'Password must be at least 8 characters.',
                422
            );
        }

        $existingEmail = $this->db->raw(
            'SELECT user_id FROM users WHERE email = ? LIMIT 1',
            [$email]
        )->fetch(PDO::FETCH_ASSOC);

        if ($existingEmail) {
            $this->api->respond_error(
                'This email is already registered.',
                409
            );
        }

        $studentNo = $studentNo === '' ? null : $studentNo;

        if ($studentNo !== null) {
            $existingStudentNo = $this->db->raw(
                'SELECT user_id FROM users WHERE student_no = ? LIMIT 1',
                [$studentNo]
            )->fetch(PDO::FETCH_ASSOC);

            if ($existingStudentNo) {
                $this->api->respond_error(
                    'This student number is already registered.',
                    409
                );
            }
        }

        $passwordHash = password_hash($password, PASSWORD_DEFAULT);

        if ($passwordHash === false) {
            $this->api->respond_error(
                'Unable to create the account right now.',
                500
            );
        }

        // Public registration always creates a student.
        // Never accept role or dept_id from registration input.
        $this->db->raw(
            'INSERT INTO users
                (student_no, full_name, email, password_hash, role,
                 dept_id, status)
             VALUES (?, ?, ?, ?, ?, NULL, ?)',
            [
                $studentNo,
                $fullName,
                $email,
                $passwordHash,
                'student',
                'active'
            ]
        );

        $user = $this->db->raw(
            'SELECT user_id, student_no, full_name, email, role,
                    dept_id, status, section_id, yr_id, created_at
             FROM users
             WHERE email = ?
             LIMIT 1',
            [$email]
        )->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            $this->api->respond_error(
                'Account created, but the user record could not be loaded.',
                500
            );
        }

        $this->api->respond(
            [
                'message' => 'Registration successful.',
                'user' => $user
            ],
            201
        );
    }

    public function login()
    {
        $this->api->require_method('POST');
        $this->api->rate_limit();

        $input = $this->api->body();

        $email = strtolower(trim((string) ($input['email'] ?? '')));
        $password = (string) ($input['password'] ?? '');
        $departmentId = $input['dept_id'] ?? null;

        if ($email === '' || $password === '') {
            $this->api->respond_error(
                'Email and password are required.',
                422
            );
        }

        $user = $this->db->raw(
            'SELECT user_id, student_no, full_name, email, password_hash,
                    role, dept_id, status, section_id, yr_id, created_at
             FROM users
             WHERE email = ?
             LIMIT 1',
            [$email]
        )->fetch(PDO::FETCH_ASSOC);

        if (
            !$user ||
            !password_verify($password, $user['password_hash'])
        ) {
            $this->api->respond_error(
                'Invalid email or password.',
                401
            );
        }

        if ($user['status'] !== 'active') {
            $this->api->respond_error(
                'This account is inactive. Please contact the administrator.',
                403
            );
        }

        if ($user['role'] === 'student') {
            if (
                $departmentId === null ||
                !is_scalar($departmentId) ||
                !ctype_digit((string) $departmentId) ||
                (int) $departmentId < 1
            ) {
                $this->api->respond_error(
                    'Please select your department to continue.',
                    422
                );
            }

            $department = $this->db->raw(
                'SELECT dept_id, dept_name
                 FROM departments
                 WHERE dept_id = ?
                 LIMIT 1',
                [(int) $departmentId]
            )->fetch(PDO::FETCH_ASSOC);

            if (!$department) {
                $this->api->respond_error(
                    'Please select a valid department.',
                    422
                );
            }

            $this->db->raw(
                'UPDATE users
                 SET dept_id = ?
                 WHERE user_id = ? AND role = ?',
                [
                    (int) $department['dept_id'],
                    (int) $user['user_id'],
                    'student'
                ]
            );

            $user['dept_id'] = (int) $department['dept_id'];
            $user['dept_name'] = $department['dept_name'];
        } else {
            $department = $user['dept_id'] === null
                ? null
                : $this->db->raw(
                    'SELECT dept_name
                     FROM departments
                     WHERE dept_id = ?
                     LIMIT 1',
                    [(int) $user['dept_id']]
                )->fetch(PDO::FETCH_ASSOC);

            $user['dept_name'] = $department['dept_name'] ?? null;
        }

        $accessToken = $this->api->encode_jwt([
            'sub' => (string) $user['user_id'],
            'role' => $user['role'],
            'dept_id' => $user['dept_id'] === null
                ? null
                : (int) $user['dept_id']
        ]);

        unset($user['password_hash']);

        $this->api->respond([
            'message' => 'Login successful.',
            'access_token' => $accessToken,
            'token_type' => 'Bearer',
            'expires_in' => 900,
            'user' => $user
        ]);
    }

    public function departments()
    {
        $this->api->require_method('GET');

        $departments = $this->db->raw(
            'SELECT dept_id, dept_name
             FROM departments
             ORDER BY dept_name ASC'
        )->fetchAll(PDO::FETCH_ASSOC);

        foreach ($departments as &$department) {
            $department['dept_id'] = (int) $department['dept_id'];
        }
        unset($department);

        $this->api->respond([
            'success' => true,
            'data' => $departments
        ]);
    }

    public function me()
    {
        $this->api->require_method('GET');

        $auth = $this->api->require_jwt();
        $userId = $auth['sub'] ?? null;

        if (
            $userId === null ||
            !ctype_digit((string) $userId)
        ) {
            $this->api->respond_error(
                'Invalid token subject.',
                401
            );
        }

        // Read the current role and department assignment from the database.
        $user = $this->db->raw(
            'SELECT user_id, student_no, full_name, email, role,
                    dept_id, status, section_id, yr_id, created_at
             FROM users
             WHERE user_id = ?
             LIMIT 1',
            [(int) $userId]
        )->fetch(PDO::FETCH_ASSOC);

        if (!$user || $user['status'] !== 'active') {
            $this->api->respond_error(
                'User account not found or inactive.',
                401
            );
        }

        $this->api->respond(['user' => $user]);
    }
}
