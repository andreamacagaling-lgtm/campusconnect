<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class AdminProfileController extends Controller
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
        $admin = $this->current_admin();

        if ($admin !== null) {
            $this->api->respond([
                'success' => true,
                'user' => $admin
            ]);
        }
    }

    public function update()
    {
        $this->api->require_method('PUT');
        $admin = $this->current_admin();
        if ($admin === null) {
            return;
        }

        $input = $this->api->body();
        $fullName = trim((string) ($input['full_name'] ?? ''));
        $email = strtolower(trim((string) ($input['email'] ?? '')));

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

        try {
            $existing = $this->db->raw(
                'SELECT user_id FROM users WHERE email = ? AND user_id <> ? LIMIT 1',
                [$email, (int) $admin['user_id']]
            )->fetch(PDO::FETCH_ASSOC);

            if ($existing) {
                $this->api->respond_error(
                    'That email address is already in use.',
                    409
                );
                return;
            }

            $this->db->raw(
                'UPDATE users SET full_name = ?, email = ? WHERE user_id = ?',
                [$fullName, $email, (int) $admin['user_id']]
            );

            $updatedAdmin = $this->find_admin((int) $admin['user_id']);
            if ($updatedAdmin === null) {
                throw new RuntimeException('Updated administrator profile could not be loaded.');
            }

            $this->api->respond([
                'success' => true,
                'message' => 'Administrator profile updated successfully.',
                'user' => $updatedAdmin
            ]);
        } catch (Throwable $e) {
            error_log('AdminProfileController update: ' . $e->getMessage());
            $this->api->respond_error(
                'Unable to update the administrator profile.',
                500
            );
        }
    }

    public function upload_avatar()
    {
        $this->api->require_method('POST');
        $admin = $this->current_admin();
        if ($admin === null) {
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
        $mimeType = (new finfo(FILEINFO_MIME_TYPE))->file($upload['tmp_name']);
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
            error_log('AdminProfileController upload_avatar: Unable to create avatar directory.');
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
            error_log('AdminProfileController upload_avatar: Unable to move uploaded photo.');
            $this->api->respond_error(
                'Unable to save the profile photo right now.',
                500
            );
            return;
        }

        try {
            $profile = $this->db->raw(
                'SELECT avatar
                 FROM student_profiles
                 WHERE user_id = ?
                 LIMIT 1',
                [(int) $admin['user_id']]
            )->fetch(PDO::FETCH_ASSOC);

            if ($profile) {
                $this->db->raw(
                    'UPDATE student_profiles SET avatar = ? WHERE user_id = ?',
                    [$avatarPath, (int) $admin['user_id']]
                );
            } else {
                $this->db->raw(
                    'INSERT INTO student_profiles (user_id, avatar) VALUES (?, ?)',
                    [(int) $admin['user_id'], $avatarPath]
                );
            }

            $updatedAdmin = $this->find_admin((int) $admin['user_id']);
            if ($updatedAdmin === null) {
                throw new RuntimeException('Updated administrator profile could not be loaded.');
            }

            $this->remove_previous_avatar($profile['avatar'] ?? null, $avatarDirectory);
            $this->api->respond([
                'success' => true,
                'message' => 'Profile photo updated successfully.',
                'user' => $updatedAdmin
            ]);
        } catch (Throwable $e) {
            if (is_file($destination) && !unlink($destination)) {
                error_log('AdminProfileController upload_avatar: Unable to remove failed upload.');
            }
            error_log('AdminProfileController upload_avatar: ' . $e->getMessage());
            $this->api->respond_error(
                'Unable to update the profile photo.',
                500
            );
        }
    }

    private function current_admin()
    {
        $claims = $this->api->require_jwt();
        $userId = $claims['sub'] ?? null;

        if ($userId === null || !ctype_digit((string) $userId)) {
            $this->api->respond_error('Invalid authentication token.', 401);
            return null;
        }

        $admin = $this->find_admin((int) $userId);
        if (!$admin || $admin['status'] !== 'active') {
            $this->api->respond_error('Administrator account not found or inactive.', 401);
            return null;
        }

        if (
            $admin['role'] !== 'admin' ||
            !in_array($admin['admin_type'], ['usg', 'organization'], true)
        ) {
            $this->api->respond_error('Administrator access required.', 403);
            return null;
        }

        return $admin;
    }

    private function find_admin($userId)
    {
        $admin = $this->db->raw(
            'SELECT u.user_id, u.full_name, u.email, u.role, u.admin_type, u.dept_id,
                    u.organization_dept_id, d.dept_name, u.status,
                    sp.avatar AS avatar_url
             FROM users u
             LEFT JOIN student_profiles sp ON sp.user_id = u.user_id
             LEFT JOIN departments d
                ON d.dept_id = COALESCE(u.organization_dept_id, u.dept_id)
             WHERE u.user_id = ?
             LIMIT 1',
            [$userId]
        )->fetch(PDO::FETCH_ASSOC);
        if ($admin) {
            $admin['user_id'] = (int) $admin['user_id'];
        }

        return $admin ?: null;
    }

    private function remove_previous_avatar($avatarPath, $avatarDirectory)
    {
        if (
            !is_string($avatarPath) ||
            !preg_match('#^/uploads/avatars/([a-f0-9]{32}\.(?:jpg|png|webp))$#', $avatarPath, $matches)
        ) {
            return;
        }

        $previousFile = $avatarDirectory . DIRECTORY_SEPARATOR . $matches[1];
        if (is_file($previousFile) && !unlink($previousFile)) {
            error_log('AdminProfileController upload_avatar: Unable to remove previous avatar.');
        }
    }
}
