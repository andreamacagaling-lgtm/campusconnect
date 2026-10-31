<?php

defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

class OrganizationsController extends Controller
{
    private $organizations;

    public function __construct()
    {
        parent::__construct();

        $this->call->library('api');
        $this->call->database();
        $this->call->model('OrganizationsModel');

        $this->organizations = new OrganizationsModel();
    }

    public function index($id = null)
    {
        $this->api->require_method('GET');

        try {
            if ($id !== null) {
                if (!$this->valid_id($id)) {
                    $this->api->respond_error(
                        'Invalid organization ID.',
                        400
                    );
                    return;
                }

                $organization = $this->organizations->find((int) $id);

                if (!$organization) {
                    $this->api->respond_error(
                        'Organization not found.',
                        404
                    );
                    return;
                }

                $this->api->respond([
                    'success' => true,
                    'data' => $organization
                ], 200);

                return;
            }

            $this->api->respond([
                'success' => true,
                'data' => $this->organizations->all()
            ], 200);
        } catch (Throwable $e) {
            error_log(
                'OrganizationsController index: ' . $e->getMessage()
            );

            $this->api->respond_error(
                'Unable to retrieve organizations.',
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

        $orgName = trim((string) ($body['org_name'] ?? ''));
        $category = trim((string) ($body['category'] ?? ''));
        $description = trim((string) ($body['description'] ?? ''));
        $eligibility = trim((string) ($body['eligibility'] ?? ''));
        $status = trim((string) ($body['status'] ?? 'active'));

        $validationError = $this->validate_organization(
            $orgName,
            $category,
            $description,
            $status
        );

        if ($validationError !== null) {
            $this->api->respond_error($validationError, 422);
            return;
        }

        $data = [
            'org_name' => $orgName,
            'category' => $category,
            'description' => $description,
            'eligibility' => $eligibility !== '' ? $eligibility : null,
            'status' => $status
        ];

        try {
            $organizationId = $this->organizations->insert($data);

            if (!$organizationId) {
                $this->api->respond_error(
                    'Failed to create organization.',
                    500
                );
                return;
            }

            $this->api->respond([
                'success' => true,
                'message' => 'Organization created successfully.',
                'org_id' => $organizationId
            ], 201);
        } catch (Throwable $e) {
            error_log(
                'OrganizationsController create: ' . $e->getMessage()
            );

            // The org_name column has a UNIQUE constraint.
            if (stripos($e->getMessage(), 'duplicate') !== false) {
                $this->api->respond_error(
                    'An organization with this name already exists.',
                    409
                );
                return;
            }

            $this->api->respond_error(
                'Unable to create organization.',
                500
            );
        }
    }

    /**
     * PUT /api/organizations/{id}
     */
    public function update($id = null)
    {
        $this->api->require_method('PUT');

        $user = $this->require_admin();

        if ($user === null) {
            return;
        }

        if (!$this->valid_id($id)) {
            $this->api->respond_error(
                'A valid organization ID is required.',
                400
            );
            return;
        }

        $existingOrganization = $this->organizations->find((int) $id);

        if (!$existingOrganization) {
            $this->api->respond_error(
                'Organization not found.',
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

        $orgName = trim((string) ($body['org_name'] ?? ''));
        $category = trim((string) ($body['category'] ?? ''));
        $description = trim((string) ($body['description'] ?? ''));
        $eligibility = trim((string) ($body['eligibility'] ?? ''));
        $status = trim((string) ($body['status'] ?? ''));

        $validationError = $this->validate_organization(
            $orgName,
            $category,
            $description,
            $status
        );

        if ($validationError !== null) {
            $this->api->respond_error($validationError, 422);
            return;
        }

        $data = [
            'org_name' => $orgName,
            'category' => $category,
            'description' => $description,
            'eligibility' => $eligibility !== '' ? $eligibility : null,
            'status' => $status
        ];

        try {
            $updated = $this->organizations->update((int) $id, $data);

            if ($updated === false) {
                $this->api->respond_error(
                    'Failed to update organization.',
                    500
                );
                return;
            }

            $this->api->respond([
                'success' => true,
                'message' => 'Organization updated successfully.'
            ], 200);
        } catch (Throwable $e) {
            error_log(
                'OrganizationsController update: ' . $e->getMessage()
            );

            if (stripos($e->getMessage(), 'duplicate') !== false) {
                $this->api->respond_error(
                    'An organization with this name already exists.',
                    409
                );
                return;
            }

            $this->api->respond_error(
                'Unable to update organization.',
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
                'A valid organization ID is required.',
                400
            );
            return;
        }

        $existingOrganization = $this->organizations->find((int) $id);

        if (!$existingOrganization) {
            $this->api->respond_error(
                'Organization not found.',
                404
            );
            return;
        }

        try {
            $deleted = $this->organizations->delete((int) $id);

            if ($deleted === false) {
                $this->api->respond_error(
                    'Failed to delete organization.',
                    500
                );
                return;
            }

            $this->api->respond([
                'success' => true,
                'message' => 'Organization deleted successfully.'
            ], 200);
        } catch (Throwable $e) {
            error_log(
                'OrganizationsController delete: ' . $e->getMessage()
            );

            $this->api->respond_error(
                'Unable to delete organization. Check server logs and database constraints.',
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

    private function validate_organization(
        $orgName,
        $category,
        $description,
        $status
    ) {
        if (
            $orgName === '' ||
            $category === '' ||
            $description === ''
        ) {
            return 'Organization name, category, and description are required.';
        }

        if (!in_array($status, ['active', 'inactive'], true)) {
            return 'Invalid organization status. Use active or inactive.';
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