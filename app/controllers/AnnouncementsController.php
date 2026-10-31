<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class AnnouncementsController extends Controller
{
    public function __construct()
    {
        parent::__construct();

        $this->call->library('api');
        $this->call->database();
        $this->call->model('AnnouncementModel');

        $this->announcements = new AnnouncementModel();
    }

    public function index($id = null)
    {
        $this->api->require_method('GET');

        try {
            if ($id !== null) {
                if (!$this->valid_id($id)) {
                    $this->api->respond_error(
                        'Invalid announcement ID.',
                        400
                    );
                    return;
                }

                $announcement = $this->announcements->find((int) $id);

                if (!$announcement) {
                    $this->api->respond_error(
                        'Announcement not found.',
                        404
                    );
                    return;
                }

                $this->api->respond([
                    'success' => true,
                    'data' => $announcement
                ], 200);

                return;
            }

            $this->api->respond([
                'success' => true,
                'data' => $this->announcements->all()
            ], 200);

        } catch (Throwable $e) {
            error_log(
                'AnnouncementsController index: ' . $e->getMessage()
            );

            $this->api->respond_error(
                'Unable to retrieve announcements.',
                500
            );
        }
    }

    public function create()
    {
        $this->api->require_method('POST');

        $user = $this->require_admin();

        if ($user === null) {
            return;
        }

        $body = $this->api->body();

        if (!is_array($body)) {
            $this->api->respond_error(
                'Invalid request body.',
                400
            );
            return;
        }

        $title = trim((string) ($body['title'] ?? ''));
        $content = trim((string) ($body['body'] ?? ''));

        $validationError = $this->validate_announcement(
            $title,
            $content
        );

        if ($validationError !== null) {
            $this->api->respond_error($validationError, 422);
            return;
        }

        $data = [
            'title' => $title,
            'body' => $content,
            'posted_by' => (int) $user['sub']
        ];

        try {
            $announcementId = $this->announcements->insert($data);

            if (!$announcementId) {
                error_log(
                    'AnnouncementsController create: insert returned false.'
                );

                $this->api->respond_error(
                    'Failed to create announcement.',
                    500
                );
                return;
            }

            $this->api->respond([
                'success' => true,
                'message' => 'Announcement created successfully.',
                'announcement_id' => $announcementId
            ], 201);

        } catch (Throwable $e) {
            error_log(
                'AnnouncementsController create: ' . $e->getMessage()
            );

            $this->api->respond_error(
                'Unable to create announcement.',
                500
            );
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
            $this->api->respond_error(
                'A valid announcement ID is required.',
                400
            );
            return;
        }

        $existing = $this->announcements->find((int) $id);

        if (!$existing) {
            $this->api->respond_error(
                'Announcement not found.',
                404
            );
            return;
        }

        $body = $this->api->body();

        if (!is_array($body)) {
            $this->api->respond_error(
                'Invalid request body.',
                400
            );
            return;
        }

        $title = trim((string) ($body['title'] ?? ''));
        $content = trim((string) ($body['body'] ?? ''));

        $validationError = $this->validate_announcement(
            $title,
            $content
        );

        if ($validationError !== null) {
            $this->api->respond_error($validationError, 422);
            return;
        }

        $data = [
            'title' => $title,
            'body' => $content
        ];

        try {
            $updated = $this->announcements->update(
                (int) $id,
                $data
            );

            if ($updated === false) {
                $this->api->respond_error(
                    'Failed to update announcement.',
                    500
                );
                return;
            }

            $this->api->respond([
                'success' => true,
                'message' => 'Announcement updated successfully.'
            ], 200);

        } catch (Throwable $e) {
            error_log(
                'AnnouncementsController update: ' . $e->getMessage()
            );

            $this->api->respond_error(
                'Unable to update announcement.',
                500
            );
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
            $this->api->respond_error(
                'A valid announcement ID is required.',
                400
            );
            return;
        }

        $existing = $this->announcements->find((int) $id);

        if (!$existing) {
            $this->api->respond_error(
                'Announcement not found.',
                404
            );
            return;
        }

        try {
            $deleted = $this->announcements->delete((int) $id);

            if ($deleted === false) {
                $this->api->respond_error(
                    'Failed to delete announcement.',
                    500
                );
                return;
            }

            $this->api->respond([
                'success' => true,
                'message' => 'Announcement deleted successfully.'
            ], 200);

        } catch (Throwable $e) {
            error_log(
                'AnnouncementsController delete: ' . $e->getMessage()
            );

            $this->api->respond_error(
                'Unable to delete announcement.',
                500
            );
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
            $this->api->respond_error(
                'Admin access required.',
                403
            );

            return null;
        }

        return $user;
    }

    private function validate_announcement($title, $content)
    {
        if ($title === '') {
            return 'Announcement title is required.';
        }

        if (mb_strlen($title) > 255) {
            return 'Title must not exceed 255 characters.';
        }

        if ($content === '') {
            return 'Announcement body is required.';
        }

        return null;
    }

    private function valid_id($id)
    {
        return $id !== null
            && ctype_digit((string) $id)
            && (int) $id > 0;
    }
}
