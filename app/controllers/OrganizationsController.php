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

        $user = $this->require_admin(true);

        if ($user === null) {
            return;
        }

        $departmentId = $this->department_scope($user);

        if ($departmentId === false) {
            return;
        }

        try {
            if ($id !== null) {
                if (!$this->valid_id($id)) {
                    $this->api->respond_error(
                        'Invalid organization ID.',
                        400
                    );
                    return;
                }

                $sql = '
                    SELECT o.*, d.dept_name
                    FROM organizations o
                    LEFT JOIN departments d ON d.dept_id = o.dept_id
                    WHERE o.org_id = ?';
                $params = [(int) $id];

                if ($departmentId !== null) {
                    $sql .= ' AND o.dept_id = ?';
                    $params[] = $departmentId;
                }

                $organization = $this->db->raw($sql, $params)
                    ->fetch(PDO::FETCH_ASSOC);

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
                'data' => $this->get_organizations($departmentId)
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

    public function membership_requests()
    {
        $this->api->require_method('GET');

        $user = $this->require_admin();

        if ($user === null) {
            return;
        }

        $departmentId = $this->department_scope($user);

        if ($departmentId === false) {
            return;
        }

        $status = strtolower(trim((string) ($_GET['status'] ?? '')));
        if (!in_array($status, ['', 'pending', 'approved', 'rejected'], true)) {
            $this->api->respond_error('Invalid membership status.', 400);
            return;
        }

        try {
            $sql = '
                SELECT
                    r.reg_id,
                    r.org_id,
                    r.user_id,
                    r.status,
                    r.registered_at,
                    r.applicant_full_name,
                    COALESCE(d.dept_name, r.applicant_department)
                        AS applicant_department,
                    r.applicant_section,
                    r.applicant_year_level,
                    o.org_name,
                    d.dept_name AS dept_name,
                    u.student_no,
                    u.email
                FROM org_registrations r
                INNER JOIN organizations o ON o.org_id = r.org_id
                INNER JOIN users u ON u.user_id = r.user_id
                LEFT JOIN sections s ON s.section_id = u.section_id
                LEFT JOIN departments d
                    ON d.dept_id = COALESCE(u.dept_id, s.dept_id)';
            $params = [];
            $conditions = [];

            if ($departmentId !== null) {
                $conditions[] = $user['admin_type'] === 'organization'
                    ? 'o.dept_id = ?'
                    : 'COALESCE(u.dept_id, s.dept_id) = ?';
                $params[] = $departmentId;
            }

            if ($status !== '') {
                $conditions[] = 'r.status = ?';
                $params[] = $status;
            }

            if ($conditions) {
                $sql .= ' WHERE ' . implode(' AND ', $conditions);
            }

            $sql .= " ORDER BY
                CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END,
                r.registered_at DESC";

            $requests = $this->db->raw($sql, $params)
                ->fetchAll(PDO::FETCH_ASSOC);

            $this->api->respond([
                'success' => true,
                'data' => $requests
            ], 200);
        } catch (Throwable $e) {
            error_log(
                'OrganizationsController membership_requests: ' .
                $e->getMessage()
            );
            $this->api->respond_error(
                'Unable to retrieve membership applications.',
                500
            );
        }
    }

    public function update_membership_status($id = null)
    {
        $this->api->require_method('PUT');

        if (!$this->valid_id($id)) {
            $this->api->respond_error(
                'A valid membership application ID is required.',
                400
            );
            return;
        }

        $user = $this->require_admin();

        if ($user === null) {
            return;
        }

        $departmentId = $this->department_scope($user);

        if ($departmentId === false) {
            return;
        }

        $body = $this->api->body();
        $status = strtolower(trim((string) ($body['status'] ?? '')));
        if (!in_array($status, ['approved', 'rejected'], true)) {
            $this->api->respond_error(
                'Membership status must be approved or rejected.',
                422
            );
            return;
        }

        try {
            $sql = '
                SELECT r.reg_id, r.status, o.dept_id AS organization_dept_id,
                    COALESCE(u.dept_id, s.dept_id) AS dept_id
                FROM org_registrations r
                INNER JOIN organizations o ON o.org_id = r.org_id
                INNER JOIN users u ON u.user_id = r.user_id
                LEFT JOIN sections s ON s.section_id = u.section_id
                WHERE r.reg_id = ?';
            $params = [(int) $id];

            if ($departmentId !== null) {
                $sql .= $user['admin_type'] === 'organization'
                    ? ' AND o.dept_id = ?'
                    : ' AND COALESCE(u.dept_id, s.dept_id) = ?';
                $params[] = $departmentId;
            }

            $request = $this->db->raw($sql . ' LIMIT 1', $params)
                ->fetch(PDO::FETCH_ASSOC);

            if (!$request) {
                $this->api->respond_error(
                    'Membership application not found.',
                    404
                );
                return;
            }

            if ($request['status'] !== 'pending') {
                $this->api->respond_error(
                    'Only pending membership applications can be reviewed.',
                    409
                );
                return;
            }

            $updateSql = '
                UPDATE org_registrations r
                INNER JOIN organizations o ON o.org_id = r.org_id
                INNER JOIN users u ON u.user_id = r.user_id
                LEFT JOIN sections s ON s.section_id = u.section_id
                SET r.status = ?
                WHERE r.reg_id = ? AND r.status = ?';
            $updateParams = [$status, (int) $id, 'pending'];

            if ($departmentId !== null) {
                $updateSql .= $user['admin_type'] === 'organization'
                    ? ' AND o.dept_id = ?'
                    : ' AND COALESCE(u.dept_id, s.dept_id) = ?';
                $updateParams[] = $departmentId;
            }

            $updated = $this->db->raw($updateSql, $updateParams);

            if ($updated->rowCount() !== 1) {
                $this->api->respond_error(
                    'Membership application changed before it could be reviewed.',
                    409
                );
                return;
            }

            $this->api->respond([
                'success' => true,
                'message' => 'Membership application ' . $status . '.'
            ], 200);
        } catch (Throwable $e) {
            error_log(
                'OrganizationsController update_membership_status: ' .
                $e->getMessage()
            );
            $this->api->respond_error(
                'Unable to update membership application.',
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

        $departmentId = $this->department_scope($user);

        if ($departmentId === false) {
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
        $status = 'pending';
        $requestedDepartmentId = $body['dept_id'] ?? '';

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

        if ($departmentId !== null) {
            $organizationDepartmentId = $departmentId;
        } elseif ($requestedDepartmentId === '') {
            $organizationDepartmentId = null;
        } elseif ($this->valid_id($requestedDepartmentId)) {
            $organizationDepartmentId = (int) $requestedDepartmentId;
        } else {
            $this->api->respond_error('Invalid organization department.', 422);
            return;
        }

        if (
            $organizationDepartmentId !== null &&
            !$this->department_exists($organizationDepartmentId)
        ) {
            $this->api->respond_error('Organization department not found.', 422);
            return;
        }

        $data = [
            'org_name' => $orgName,
            'category' => $category,
            'description' => $description,
            'eligibility' => $eligibility !== '' ? $eligibility : null,
            'status' => $status,
            'dept_id' => $organizationDepartmentId
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

        $departmentId = $this->department_scope($user);

        if ($departmentId === false) {
            return;
        }

        if (!$this->valid_id($id)) {
            $this->api->respond_error(
                'A valid organization ID is required.',
                400
            );
            return;
        }

        $existingOrganization = $this->find_organization(
            (int) $id,
            $departmentId
        );

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
        $status = 'pending';
        $requestedDepartmentId = $body['dept_id'] ?? '';

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

        if ($departmentId !== null) {
            $organizationDepartmentId = $departmentId;
        } elseif ($requestedDepartmentId === '') {
            $organizationDepartmentId = null;
        } elseif ($this->valid_id($requestedDepartmentId)) {
            $organizationDepartmentId = (int) $requestedDepartmentId;
        } else {
            $this->api->respond_error('Invalid organization department.', 422);
            return;
        }

        if (
            $organizationDepartmentId !== null &&
            !$this->department_exists($organizationDepartmentId)
        ) {
            $this->api->respond_error('Organization department not found.', 422);
            return;
        }

        $data = [
            'org_name' => $orgName,
            'category' => $category,
            'description' => $description,
            'eligibility' => $eligibility !== '' ? $eligibility : null,
            'status' => $status,
            'dept_id' => $organizationDepartmentId
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

        $departmentId = $this->department_scope($user);

        if ($departmentId === false) {
            return;
        }

        if (!$this->valid_id($id)) {
            $this->api->respond_error(
                'A valid organization ID is required.',
                400
            );
            return;
        }

        $existingOrganization = $this->find_organization(
            (int) $id,
            $departmentId
        );

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

    private function require_admin($allowDepartmentRead = false)
    {
        $claims = $this->api->require_jwt();
        $userId = $claims['sub'] ?? null;

        if (
            $userId === null ||
            !ctype_digit((string) $userId)
        ) {
            $this->api->respond_error('Invalid authentication token.', 401);
            return null;
        }

        $user = $this->db->raw(
            'SELECT user_id, role, admin_type, dept_id,
                    organization_dept_id, status
             FROM users
             WHERE user_id = ?
             LIMIT 1',
            [(int) $userId]
        )->fetch(PDO::FETCH_ASSOC);

        if (!$user || $user['status'] !== 'active') {
            $this->api->respond_error('Admin account not found or inactive.', 401);
            return null;
        }

        $isUniversityAdmin =
            $user['role'] === 'admin' &&
            $user['admin_type'] === 'usg' &&
            ($claims['role'] ?? null) === 'admin';
        $isOrganizationAdmin =
            $user['role'] === 'admin' &&
            $user['admin_type'] === 'organization' &&
            ($claims['role'] ?? null) === 'organization';
        $isDepartmentAdminRead =
            $allowDepartmentRead &&
            $user['role'] === 'admin' &&
            $user['admin_type'] === 'department' &&
            $user['dept_id'] !== null &&
            ($claims['role'] ?? null) === 'admin';

        if (
            !$isUniversityAdmin &&
            !$isOrganizationAdmin &&
            !$isDepartmentAdminRead
        ) {
            $this->api->respond_error('Organization administrator access required.', 403);
            return null;
        }

        return $user;
    }

    private function department_scope($user)
    {
        $departmentId = $user['admin_type'] === 'organization'
            ? ($user['organization_dept_id'] ?? null)
            : ($user['dept_id'] ?? null);

        if (
            $user['admin_type'] === 'organization' &&
            ($departmentId === null || $departmentId === '')
        ) {
            $this->api->respond_error(
                'Organization administrator department assignment is missing.',
                403
            );
            return false;
        }

        if (
            $user['admin_type'] !== 'organization' &&
            !array_key_exists('dept_id', $user)
        ) {
            $this->api->respond_error(
                'Department information is missing. Please sign in again.',
                401
            );
            return false;
        }

        if ($departmentId === null || $departmentId === '') {
            return null;
        }

        if (!$this->valid_id($departmentId)) {
            $this->api->respond_error('Invalid department assignment.', 403);
            return false;
        }

        return (int) $departmentId;
    }

    private function get_organizations($departmentId)
    {
        $sql = '
            SELECT o.*, d.dept_name
            FROM organizations o
            LEFT JOIN departments d ON d.dept_id = o.dept_id';
        $params = [];

        if ($departmentId !== null) {
            $sql .= ' WHERE o.dept_id = ?';
            $params[] = $departmentId;
        }

        $sql .= ' ORDER BY o.created_at DESC, o.org_name ASC';

        return $this->db->raw($sql, $params)->fetchAll(PDO::FETCH_ASSOC);
    }

    private function find_organization($id, $departmentId)
    {
        $sql = '
            SELECT o.*, d.dept_name
            FROM organizations o
            LEFT JOIN departments d ON d.dept_id = o.dept_id
            WHERE o.org_id = ?';
        $params = [$id];

        if ($departmentId !== null) {
            $sql .= ' AND o.dept_id = ?';
            $params[] = $departmentId;
        }

        return $this->db->raw($sql . ' LIMIT 1', $params)
            ->fetch(PDO::FETCH_ASSOC);
    }

    private function department_exists($departmentId)
    {
        return (bool) $this->db->raw(
            'SELECT dept_id FROM departments WHERE dept_id = ? LIMIT 1',
            [$departmentId]
        )->fetch(PDO::FETCH_ASSOC);
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