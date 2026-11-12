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
        $departmentId = $input['dept_id'] ?? null;
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

        if (
            $departmentId === null ||
            !is_scalar($departmentId) ||
            !ctype_digit((string) $departmentId) ||
            (int) $departmentId < 1
        ) {
            $this->api->respond_error('Please select a valid department.', 422);
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
            $this->api->respond_error('Please select a valid department.', 422);
            return;
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

        $this->db->raw(
            'INSERT INTO users
                (student_no, full_name, email, password_hash, role,
                 dept_id, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                $studentNo,
                $fullName,
                $email,
                $passwordHash,
                'student',
                (int) $department['dept_id'],
                'pending'
            ]
        );

        $user = $this->db->raw(
            'SELECT user_id, student_no, full_name, email, role,
                    admin_type, dept_id, organization_dept_id, status,
                    section_id, yr_id, created_at
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
                'message' => 'Registration submitted. Your account is awaiting OSSE approval.',
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

        if ($email === '' || $password === '') {
            $this->api->respond_error(
                'Email and password are required.',
                422
            );
        }

        $user = $this->db->raw(
            'SELECT user_id, student_no, full_name, email, password_hash,
                    role, admin_type, dept_id, organization_dept_id,
                    status, section_id, yr_id,
                    created_at
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

        $this->respond_login_success($user, $user['dept_id']);
    }

    public function refresh()
    {
        $this->api->require_method('POST');
        $this->api->rate_limit();

        $input = $this->api->body();
        $refreshToken = trim((string) ($input['refresh_token'] ?? ''));
        $claims = $this->api->validate_jwt($refreshToken, 'refresh');

        if (
            !$claims ||
            !ctype_digit((string) ($claims['sub'] ?? '')) ||
            (int) $claims['sub'] < 1 ||
            empty($claims['jti'])
        ) {
            $this->api->respond_error('Invalid refresh token.', 401);
            return;
        }

        $refreshKey = (string) config_item('refresh_token_key');
        $hashedToken = hash_hmac('sha256', $refreshToken, $refreshKey);

        try {
            $user = $this->db->raw(
                'SELECT user_id, student_no, full_name, email, role,
                        admin_type, dept_id, organization_dept_id, status,
                        section_id, yr_id, created_at
                 FROM users
                 WHERE user_id = ?
                 LIMIT 1',
                [(int) $claims['sub']]
            )->fetch(PDO::FETCH_ASSOC);

            if (!$user || $user['status'] !== 'active') {
                $this->api->respond_error(
                    'This account is unavailable. Please sign in again.',
                    401
                );
                return;
            }

            $delete = $this->db->raw(
                'DELETE FROM refresh_tokens
                 WHERE user_id = ? AND token = ? AND jti = ?
                   AND expires_at > NOW()',
                [
                    (int) $user['user_id'],
                    $hashedToken,
                    $claims['jti']
                ]
            );

            if (!$delete || $delete->rowCount() !== 1) {
                $this->api->respond_error(
                    'Refresh token expired or already used.',
                    401
                );
                return;
            }

            $tokens = $this->create_auth_tokens($user);
            $this->api->respond([
                'message' => 'Session refreshed.',
                'access_token' => $tokens['access_token'],
                'refresh_token' => $tokens['refresh_token'],
                'token_type' => 'Bearer',
                'expires_in' => $tokens['expires_in']
            ]);
        } catch (Throwable $e) {
            error_log('AuthController refresh: ' . $e->getMessage());
            $this->api->respond_error(
                'Unable to refresh the session right now.',
                500
            );
        }
    }

    public function google_login()
    {
        $this->api->require_method('POST');
        $this->api->rate_limit();

        $input = $this->api->body();
        $credential = trim((string) ($input['credential'] ?? ''));
        $departmentId = $input['dept_id'] ?? null;
        $mode = strtolower(trim((string) ($input['mode'] ?? 'login')));
        $clientId = trim((string) getenv('GOOGLE_OAUTH_CLIENT_ID'));

        if (!in_array($mode, ['login', 'register', 'auto'], true)) {
            $this->api->respond_error('Invalid Google authentication mode.', 422);
            return;
        }

        if ($credential === '') {
            $this->api->respond_error('Google sign-in credential is required.', 422);
            return;
        }

        if ($clientId === '') {
            $this->api->respond_error('Google sign-in is not configured.', 503);
            return;
        }

        $autoload = ROOT_DIR . 'vendor/autoload.php';

        if (!is_file($autoload)) {
            error_log('AuthController google_login: Composer autoload file was not found.');
            $this->api->respond_error('Google sign-in is unavailable.', 503);
            return;
        }

        require_once $autoload;

        if (!class_exists(\Google\Client::class)) {
            error_log('AuthController google_login: Google API client is not installed.');
            $this->api->respond_error('Google sign-in is unavailable.', 503);
            return;
        }

        try {
            $googleClient = new \Google\Client(['client_id' => $clientId]);
            $googleClient->setHttpClient(
                $this->create_google_verification_http_client()
            );
            $googleUser = $googleClient->verifyIdToken($credential);

            if (
                !is_array($googleUser) ||
                ($googleUser['email_verified'] ?? false) !== true ||
                empty($googleUser['email']) ||
                !filter_var($googleUser['email'], FILTER_VALIDATE_EMAIL) ||
                empty($googleUser['sub'])
            ) {
                $this->api->respond_error(
                    'Google could not verify this account. Please try again.',
                    401
                );
                return;
            }

            $email = strtolower(trim($googleUser['email']));
            $googleId = trim((string) $googleUser['sub']);
            $user = $this->db->raw(
                'SELECT user_id, student_no, full_name, email, role,
                        admin_type, dept_id, organization_dept_id, status,
                        section_id, yr_id, google_id,
                        created_at
                 FROM users
                 WHERE LOWER(email) = ?
                 LIMIT 1',
                [$email]
            )->fetch(PDO::FETCH_ASSOC);

            if ($mode === 'auto' && $user) {
                if (!$this->store_verified_google_identity($user, $googleId, $email)) {
                    return;
                }

                $selectedDepartmentId = $user['dept_id'];
                if (
                    $user['role'] === 'student' &&
                    ($selectedDepartmentId === null || $selectedDepartmentId === '')
                ) {
                    $this->api->respond_error(
                        'This student account has no department assigned. Please contact an administrator.',
                        422
                    );
                    return;
                }

                $this->respond_login_success($user, $selectedDepartmentId);
                return;
            }

            if ($mode === 'register' || $mode === 'auto') {
                if ($mode === 'register' && $user) {
                    $this->api->respond_error(
                        'An account is already registered with this Google email.',
                        409
                    );
                    return;
                }

                $accountDepartmentId = null;
                if ($departmentId === null ||
                    !is_scalar($departmentId) ||
                    !ctype_digit((string) $departmentId) ||
                    (int) $departmentId < 1) {
                    $this->api->respond_error(
                        'Please select your department to finish Google registration.',
                        422
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
                    $this->api->respond_error(
                        'Please select a valid department.',
                        422
                    );
                    return;
                }

                $accountDepartmentId = (int) $department['dept_id'];

                $fullName = trim((string) ($googleUser['name'] ?? ''));

                if ($fullName === '') {
                    $this->api->respond_error(
                        'Google did not provide a verified account name.',
                        422
                    );
                    return;
                }

                $randomPassword = bin2hex(random_bytes(32));
                $passwordHash = password_hash($randomPassword, PASSWORD_DEFAULT);

                if ($passwordHash === false) {
                    $this->api->respond_error(
                        'Unable to create the account right now.',
                        500
                    );
                    return;
                }

                $this->db->raw(
                    'INSERT INTO users
                        (student_no, full_name, email, password_hash, role,
                         dept_id, status, google_id)
                     VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)',
                    [
                        $fullName,
                        $email,
                        $passwordHash,
                        'student',
                        $accountDepartmentId,
                        'pending',
                        $googleId
                    ]
                );

                if ($mode === 'auto') {
                    $createdUser = $this->db->raw(
                        'SELECT user_id, student_no, full_name, email, role,
                                admin_type, dept_id, organization_dept_id,
                                status, section_id, yr_id, google_id,
                                created_at
                         FROM users
                         WHERE LOWER(email) = ?
                         LIMIT 1',
                        [$email]
                    )->fetch(PDO::FETCH_ASSOC);

                    if (!$createdUser) {
                        $this->api->respond_error(
                            'Account created, but the user record could not be loaded.',
                            500
                        );
                        return;
                    }

                    if ($createdUser['status'] === 'pending') {
                        $this->api->respond([
                            'success' => true,
                            'approval_pending' => true,
                            'email' => $createdUser['email'],
                            'message' => 'Google account registered. Your account is awaiting OSSE approval.'
                        ], 201);
                        return;
                    }

                    $this->respond_login_success(
                        $createdUser,
                        $accountDepartmentId
                    );
                    return;
                }

                $this->api->respond([
                    'success' => true,
                    'email' => $email,
                    'approval_pending' => true,
                    'message' => 'Google account registered. Your account is awaiting OSSE approval.'
                ], 201);
                return;
            }

            if (!$user) {
                $this->api->respond_error(
                    'No CampusConnect account is registered with this Google email.',
                    404
                );
                return;
            }

            if (!$this->store_verified_google_identity($user, $googleId, $email)) {
                return;
            }

            $this->respond_login_success($user, $departmentId);
        } catch (Throwable $e) {
            error_log('AuthController google_login: ' . $e->getMessage());
            $this->api->respond_error(
                'Unable to verify your Google account right now.',
                503
            );
        }
    }

    private function store_verified_google_identity(array &$user, $googleId, $email)
    {
        $linkedUser = $this->db->raw(
            'SELECT user_id
             FROM users
             WHERE google_id = ? AND user_id <> ?
             LIMIT 1',
            [$googleId, (int) $user['user_id']]
        )->fetch(PDO::FETCH_ASSOC);

        if ($linkedUser) {
            $this->api->respond_error(
                'This Google account is already linked to another CampusConnect account.',
                409
            );
            return false;
        }

        $currentGoogleId = trim((string) ($user['google_id'] ?? ''));
        if ($currentGoogleId !== '' && $currentGoogleId !== $googleId) {
            $this->api->respond_error(
                'This CampusConnect account is already linked to a different Google account.',
                409
            );
            return false;
        }

        $this->db->raw(
            'UPDATE users
             SET google_id = ?, email = ?
             WHERE user_id = ?',
            [$googleId, $email, (int) $user['user_id']]
        );

        $user['google_id'] = $googleId;
        $user['email'] = $email;
        return true;
    }

    private function create_google_verification_http_client()
    {
        $caBundle = \Composer\CaBundle\CaBundle::getSystemCaRootBundlePath();

        if (!is_file($caBundle) || !is_readable($caBundle)) {
            $caBundle = \Composer\CaBundle\CaBundle::getBundledCaBundlePath();
        }

        if (!is_file($caBundle) || !is_readable($caBundle)) {
            throw new RuntimeException(
                'A readable CA certificate bundle is required for Google token verification.'
            );
        }

        return new \GuzzleHttp\Client(['verify' => $caBundle]);
    }

    private function respond_login_success($user, $departmentId)
    {
        if ($user['status'] === 'pending') {
            $this->api->respond_error(
                'Your student account is awaiting OSSE approval.',
                403
            );
            return;
        }

        if ($user['status'] !== 'active') {
            $this->api->respond_error(
                'This account is inactive. Please contact OSSE.',
                403
            );
            return;
        }

        if ($user['role'] === 'student') {
            if (
                $departmentId === null ||
                !is_scalar($departmentId) ||
                !ctype_digit((string) $departmentId) ||
                (int) $departmentId < 1
            ) {
                $this->api->respond_error(
                    'This student account has no department assigned. Please contact an administrator.',
                    422
                );
                return;
            }

            $department = $this->db->raw(
                'SELECT dept_id, dept_name
                 FROM departments
                 WHERE dept_id = ?
                 LIMIT 1',
                [(int) $departmentId]
            )->fetch(PDO::FETCH_ASSOC);

            if (!$department) {
                $this->api->respond_error('Please select a valid department.', 422);
                return;
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
            $profileDepartmentId = $user['admin_type'] === 'organization'
                ? ($user['organization_dept_id'] ?? null)
                : $user['dept_id'];
            $department = $profileDepartmentId === null
                ? null
                : $this->db->raw(
                    'SELECT dept_name
                     FROM departments
                     WHERE dept_id = ?
                     LIMIT 1',
                    [(int) $profileDepartmentId]
                )->fetch(PDO::FETCH_ASSOC);

            $user['dept_name'] = $department['dept_name'] ?? null;
        }

        $tokens = $this->create_auth_tokens($user);

        unset($user['google_id']);

        $this->api->respond([
            'message' => 'Login successful.',
            'access_token' => $tokens['access_token'],
            'refresh_token' => $tokens['refresh_token'],
            'token_type' => 'Bearer',
            'expires_in' => $tokens['expires_in'],
            'user' => $user
        ]);
    }

    private function create_auth_tokens(array $user)
    {
        $accessTtl = max(60, (int) config_item('payload_token_expiration'));
        $refreshTtl = max(60, (int) config_item('refresh_token_expiration'));
        $refreshKey = (string) config_item('refresh_token_key');
        $role = $user['admin_type'] === 'osse'
            ? 'osse'
            : ($user['admin_type'] === 'organization'
                ? 'organization'
                : $user['role']);

        $accessToken = $this->api->encode_jwt([
            'sub' => (string) $user['user_id'],
            'type' => 'access',
            'role' => $role,
            'admin_type' => $user['admin_type'],
            'dept_id' => $user['dept_id'] === null
                ? null
                : (int) $user['dept_id'],
            'organization_dept_id' =>
                ($user['organization_dept_id'] ?? null) === null
                    ? null
                    : (int) $user['organization_dept_id']
        ], $accessTtl);

        $refreshJti = bin2hex(random_bytes(16));
        $refreshToken = $this->api->encode_jwt([
            'sub' => (string) $user['user_id'],
            'type' => 'refresh',
            'jti' => $refreshJti
        ], $refreshTtl);
        $hashedRefreshToken = hash_hmac(
            'sha256',
            $refreshToken,
            $refreshKey
        );
        $expiresAt = date('Y-m-d H:i:s', time() + $refreshTtl);

        $this->db->raw(
            'DELETE FROM refresh_tokens WHERE expires_at <= NOW()'
        );
        $this->db->raw(
            'INSERT INTO refresh_tokens (user_id, token, expires_at, jti)
             VALUES (?, ?, ?, ?)',
            [
                (int) $user['user_id'],
                $hashedRefreshToken,
                $expiresAt,
                $refreshJti
            ]
        );

        return [
            'access_token' => $accessToken,
            'refresh_token' => $refreshToken,
            'expires_in' => $accessTtl
        ];
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
                    admin_type, dept_id, organization_dept_id,
                    status, section_id, yr_id,
                    created_at
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
