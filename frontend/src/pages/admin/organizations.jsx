
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { confirmLogout } from "../../authSession";
import ResponsiveSidebarToggle from "../../components/ResponsiveSidebarToggle";
import "./Organizations.css";

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "";

const ORGANIZATIONS_API = `${API_BASE_URL}/api/organizations`;

const EMPTY_FORM = {
    org_name: "",
    category: "Academic",
    description: "",
    eligibility: "",
    status: "active",
    dept_id: "",
};

const CATEGORIES = [
    "Academic",
    "Student Government",
    "Cultural",
    "Sports",
    "Environment",
    "Business",
    "Other",
];

const NAV_ITEMS = [
    { label: "Organizations", path: "/admin/organizations", icon: "♧" },
];

const DEPARTMENT_NAMES = {
    1: "CCS",
    2: "CCJE",
    3: "CBM",
    4: "CAS",
    5: "BTVTED/BTLED",
    6: "BSED",
};

const DEPARTMENT_ADMIN_ROUTES = {
    1: "/adminOrg/orgA",
    2: "/adminOrg/orgB",
    3: "/adminOrg/orgC",
    4: "/adminOrg/orgD",
    5: "/adminOrg/orgE",
    6: "/adminOrg/orgF",
};

function getToken() {
    return (
        localStorage.getItem("campusconnect_token") ||
        sessionStorage.getItem("campusconnect_token")
    );
}

function getStoredUser() {
    try {
        const raw =
            localStorage.getItem("campusconnect_user") ||
            sessionStorage.getItem("campusconnect_user");

        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function getErrorMessage(err, fallback) {
    return (
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        fallback
    );
}

function AdminSidebar({
    activePage,
    user,
    profile,
    departmentName,
    onOrganizations,
    onProfile,
}) {
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const departmentId = user?.admin_type === "organization"
        ? user?.organization_dept_id
        : user?.dept_id;
    const organizationDashboard =
        DEPARTMENT_ADMIN_ROUTES[Number(departmentId)];
    const navItems = organizationDashboard
        ? [
              { ...NAV_ITEMS[0], path: organizationDashboard },
              { label: "Edit Profile", path: "profile", icon: "◎" },
          ]
        : NAV_ITEMS;

    function handleLogout() {
        if (!confirmLogout()) return;

        localStorage.removeItem("campusconnect_token");
        sessionStorage.removeItem("campusconnect_token");
        localStorage.removeItem("campusconnect_user");
        sessionStorage.removeItem("campusconnect_user");
        navigate("/login");
    }

    return (
        <aside
            className={`admin-sidebar responsive-sidebar ${
                mobileMenuOpen ? "responsive-sidebar-open" : ""
            }`}
        >
            <div className="admin-brand responsive-sidebar-brand">
                <img className="admin-brand-logo" src="/images/msu-seal.png" alt="" />
                <div>
                    <h2>CampusConnect</h2>
                    <span>ORGANIZATION ADMIN PORTAL</span>
                </div>
                <ResponsiveSidebarToggle
                    isOpen={mobileMenuOpen}
                    onClick={() => setMobileMenuOpen((open) => !open)}
                />
            </div>

            <div className="admin-nav-heading responsive-sidebar-label">MAIN MENU</div>

            <nav
                className="admin-nav responsive-sidebar-nav"
                onClick={() => setMobileMenuOpen(false)}
            >
                {navItems.map((item) => (
                    <button
                        key={item.path}
                        type="button"
                        className={`admin-nav-link ${
                            activePage === item.label ? "active" : ""
                        }`}
                        onClick={() =>
                            item.path === "profile"
                                ? onProfile()
                                : onOrganizations
                                    ? onOrganizations()
                                : navigate(item.path)
                        }
                    >
                        <span className="admin-nav-icon">{item.icon}</span>
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>

            <div className="admin-sidebar-bottom responsive-sidebar-bottom">
                <div className="admin-sidebar-note">
                    <span className="org-sidebar-avatar">
                        <span className="admin-online-dot" />
                        {profile?.avatar_url && (
                            <img
                                src={profile.avatar_url}
                                alt=""
                                onError={(event) => {
                                    event.currentTarget.hidden = true;
                                }}
                            />
                        )}
                    </span>
                    <div>
                        <strong>{departmentName || "Department"} Organization</strong>
                        <small>CampusConnect Organization Portal</small>
                    </div>
                </div>

                <button
                    type="button"
                    className="admin-nav-link admin-logout"
                    onClick={handleLogout}
                >
                    <span className="admin-nav-icon">↪</span>
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    );
}

export default function Organizations({ expectedDepartmentId = null } = {}) {
    const navigate = useNavigate();
    const user = useMemo(() => getStoredUser(), []);
    const isUniversityAdmin =
        user?.role === "admin" &&
        user?.admin_type === "usg" &&
        (user.dept_id === null || user.dept_id === "");
    const isOrganizationAdmin =
        user?.role === "admin" && user?.admin_type === "organization";

    const [organizations, setOrganizations] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [membershipRequests, setMembershipRequests] = useState([]);
    const [membershipRequestsLoading, setMembershipRequestsLoading] =
        useState(false);
    const [membershipRequestsError, setMembershipRequestsError] = useState("");
    const [membershipActionId, setMembershipActionId] = useState(null);
    const [membershipSectionFilter, setMembershipSectionFilter] = useState("");
    const [membershipYearFilter, setMembershipYearFilter] = useState("");
    const [activePanel, setActivePanel] = useState("organizations");
    const [activePage, setActivePage] = useState("Organizations");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [adminProfile, setAdminProfile] = useState(user);
    const [profileForm, setProfileForm] = useState({
        full_name: user?.full_name || "",
        email: user?.email || "",
    });
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileUploading, setProfileUploading] = useState(false);
    const [profileError, setProfileError] = useState("");
    const [profileNotice, setProfileNotice] = useState("");

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const getHeaders = useCallback(() => {
        const token = getToken();

        return token
            ? { Authorization: `Bearer ${token}` }
            : {};
    }, []);

    const handleUnauthorized = useCallback(
        (err) => {
            if (err?.response?.status === 401) {
                localStorage.removeItem("campusconnect_token");
                sessionStorage.removeItem("campusconnect_token");
                localStorage.removeItem("campusconnect_user");
                sessionStorage.removeItem("campusconnect_user");
                navigate("/login");
                return true;
            }

            return false;
        },
        [navigate]
    );

    const fetchOrganizations = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const response = await axios.get(ORGANIZATIONS_API, {
                headers: getHeaders(),
            });

            const payload = response.data;
            const list = Array.isArray(payload)
                ? payload
                : payload?.organizations ?? payload?.data ?? [];

            if (!Array.isArray(list)) {
                throw new Error("Invalid organizations API response.");
            }

            setOrganizations(list);
        } catch (err) {
            if (!handleUnauthorized(err)) {
                setError(
                    getErrorMessage(
                        err,
                        "Check API connections."
                    )
                );
            }
        } finally {
            setLoading(false);
        }
    }, [getHeaders, handleUnauthorized]);

    useEffect(() => {
        void Promise.resolve().then(fetchOrganizations);
    }, [fetchOrganizations]);

    useEffect(() => {
        if (!isUniversityAdmin) return;

        async function fetchDepartments() {
            try {
                const response = await axios.get(
                    `${API_BASE_URL}/api/auth/departments`,
                    { headers: getHeaders() }
                );
                const rows = response.data?.data;

                if (!Array.isArray(rows)) {
                    throw new Error("Invalid departments API response.");
                }

                setDepartments(rows);
            } catch (err) {
                if (!handleUnauthorized(err)) {
                    setError(
                        getErrorMessage(err, "Unable to load departments.")
                    );
                }
            }
        }

        fetchDepartments();
    }, [getHeaders, handleUnauthorized, isUniversityAdmin]);

    const fetchMembershipRequests = useCallback(async () => {
        setMembershipRequestsLoading(true);
        setMembershipRequestsError("");

        try {
            const response = await axios.get(
                `${ORGANIZATIONS_API}/membership-requests`,
                { headers: getHeaders() }
            );
            const rows = response.data?.data;

            if (!Array.isArray(rows)) {
                throw new Error("Invalid membership applications API response.");
            }

            setMembershipRequests(rows);
        } catch (err) {
            if (!handleUnauthorized(err)) {
                setMembershipRequestsError(
                    getErrorMessage(
                        err,
                        "Unable to load membership applications."
                    )
                );
            }
        } finally {
            setMembershipRequestsLoading(false);
        }
    }, [getHeaders, handleUnauthorized]);

    useEffect(() => {
        if (!isOrganizationAdmin || activePage !== "Edit Profile") return undefined;
        let active = true;
        setProfileError("");
        axios
            .get(`${API_BASE_URL}/api/admin/profile`, {
                headers: getHeaders(),
            })
            .then((response) => {
                const profile = response.data?.user;
                if (!profile) {
                    throw new Error("The organization admin profile was not returned by the server.");
                }
                if (active) {
                    setAdminProfile(profile);
                    setProfileForm({
                        full_name: profile.full_name || "",
                        email: profile.email || "",
                    });
                    const storage = localStorage.getItem("campusconnect_user")
                        ? localStorage
                        : sessionStorage;
                    storage.setItem("campusconnect_user", JSON.stringify(profile));
                }
            })
            .catch((requestError) => {
                if (active && !handleUnauthorized(requestError)) {
                    setProfileError(
                        getErrorMessage(requestError, "Unable to load your profile.")
                    );
                }
            });
        return () => {
            active = false;
        };
    }, [activePage, getHeaders, handleUnauthorized, isOrganizationAdmin]);

    async function reviewMembershipRequest(request, status) {
        setMembershipRequestsError("");
        setSuccess("");
        setMembershipActionId(request.reg_id);

        try {
            const response = await axios.put(
                `${ORGANIZATIONS_API}/membership-requests/${request.reg_id}`,
                { status },
                { headers: getHeaders() }
            );
            setSuccess(
                response.data?.message ||
                    `Membership application ${status}.`
            );
            await fetchMembershipRequests();
        } catch (err) {
            if (!handleUnauthorized(err)) {
                setMembershipRequestsError(
                    getErrorMessage(
                        err,
                        "Unable to update membership application."
                    )
                );
            }
        } finally {
            setMembershipActionId(null);
        }
    }

    async function saveOrganizationProfile(event) {
        event.preventDefault();
        setProfileError("");
        setProfileNotice("");
        setProfileSaving(true);
        try {
            const response = await axios.put(
                `${API_BASE_URL}/api/admin/profile`,
                profileForm,
                { headers: getHeaders() }
            );
            if (!response.data?.user) {
                throw new Error("The updated organization profile was not returned.");
            }
            setAdminProfile(response.data.user);
            setProfileForm({
                full_name: response.data.user.full_name || "",
                email: response.data.user.email || "",
            });
            const storage = localStorage.getItem("campusconnect_user")
                ? localStorage
                : sessionStorage;
            storage.setItem(
                "campusconnect_user",
                JSON.stringify(response.data.user)
            );
            setProfileNotice(response.data.message || "Profile updated successfully.");
        } catch (requestError) {
            if (!handleUnauthorized(requestError)) {
                setProfileError(
                    getErrorMessage(requestError, "Unable to update your profile.")
                );
            }
        } finally {
            setProfileSaving(false);
        }
    }

    async function uploadOrganizationProfilePhoto(event) {
        const input = event.currentTarget;
        const file = input.files?.[0];
        if (!file) return;
        setProfileError("");
        setProfileNotice("");
        if (file.size > 2000 * 1024 * 1024) {
            setProfileError("Profile photos must be 2000 MB or smaller.");
            input.value = "";
            return;
        }
        const formData = new FormData();
        formData.append("avatar", file);
        setProfileUploading(true);
        try {
            const response = await axios.post(
                `${API_BASE_URL}/api/admin/profile/avatar`,
                formData,
                {
                    headers: {
                        ...getHeaders(),
                        "Content-Type": "multipart/form-data",
                    },
                }
            );
            if (!response.data?.user) {
                throw new Error("The updated profile photo was not returned.");
            }
            setAdminProfile(response.data.user);
            const storage = localStorage.getItem("campusconnect_user")
                ? localStorage
                : sessionStorage;
            storage.setItem(
                "campusconnect_user",
                JSON.stringify(response.data.user)
            );
            setProfileNotice(response.data.message || "Profile photo updated.");
        } catch (requestError) {
            if (!handleUnauthorized(requestError)) {
                setProfileError(
                    getErrorMessage(requestError, "Unable to update your profile photo.")
                );
            }
        } finally {
            setProfileUploading(false);
            input.value = "";
        }
    }

    function openAddModal() {
        setEditingId(null);
        setForm({
            ...EMPTY_FORM,
            dept_id: isUniversityAdmin ? "" : String(user?.dept_id ?? ""),
        });
        setError("");
        setSuccess("");
        setShowModal(true);
    }

    function openEditModal(organization) {
        setEditingId(organization.org_id);

        setForm({
            org_name: organization.org_name ?? "",
            category: organization.category ?? "Other",
            description: organization.description ?? "",
            eligibility: organization.eligibility ?? "",
            status: organization.status ?? "active",
            dept_id: organization.dept_id == null
                ? ""
                : String(organization.dept_id),
        });

        setError("");
        setSuccess("");
        setShowModal(true);
    }

    function closeModal() {
        if (saving) return;

        setShowModal(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
        setError("");
    }

    function handleChange(event) {
        const { name, value } = event.target;

        setForm((current) => ({
            ...current,
            [name]: value,
        }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");
        setSuccess("");

        const payload = {
            org_name: form.org_name.trim(),
            category: form.category.trim(),
            description: form.description.trim(),
            eligibility: form.eligibility.trim(),
            status: form.status,
            dept_id: isUniversityAdmin
                ? form.dept_id
                : String(
                    isOrganizationAdmin
                        ? user?.organization_dept_id ?? ""
                        : user?.dept_id ?? ""
                ),
        };

        if (
            !payload.org_name ||
            !payload.category ||
            !payload.description
        ) {
            setError(
                "Organization name, category, and description are required."
            );
            return;
        }

        setSaving(true);

        try {
            if (editingId) {
                await axios.put(
                    `${ORGANIZATIONS_API}/${editingId}`,
                    payload,
                    { headers: getHeaders() }
                );

                setSuccess("Organization updated successfully.");
            } else {
                await axios.post(ORGANIZATIONS_API, payload, {
                    headers: getHeaders(),
                });

                setSuccess("Organization added successfully.");
            }

            setShowModal(false);
            setEditingId(null);
            setForm(EMPTY_FORM);

            await fetchOrganizations();
        } catch (err) {
            if (!handleUnauthorized(err)) {
                setError(
                    getErrorMessage(
                        err,
                        "Check required fields and API."
                    )
                );
            }
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(organization) {
        const confirmed = window.confirm(
            `Are you sure you want to delete "${organization.org_name}"?`
        );

        if (!confirmed) return;

        setError("");
        setSuccess("");
        setDeletingId(organization.org_id);

        try {
            await axios.delete(
                `${ORGANIZATIONS_API}/${organization.org_id}`,
                { headers: getHeaders() }
            );

            setSuccess("Organization  deleted successfully.");
            await fetchOrganizations();
        } catch (err) {
            if (!handleUnauthorized(err)) {
                setError(
                    getErrorMessage(
                        err,
                        "Can't delete."
                    )
                );
            }
        } finally {
            setDeletingId(null);
        }
    }

    const filteredOrganizations = organizations.filter((organization) => {
        const searchText = search.trim().toLowerCase();

        const matchesSearch = [
            organization.org_name,
            organization.category,
            organization.description,
            organization.eligibility,
        ].some((value) =>
            String(value ?? "").toLowerCase().includes(searchText)
        );

        const matchesStatus =
            statusFilter === "all" ||
            organization.status === statusFilter;

        return matchesSearch && matchesStatus;
    });
    const membershipSections = [...new Set(
        membershipRequests
            .map((request) => request.applicant_section)
            .filter(Boolean)
    )].sort((a, b) => String(a).localeCompare(String(b)));
    const membershipYears = [...new Set(
        membershipRequests
            .map((request) => request.applicant_year_level)
            .filter(Boolean)
    )].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
    const filteredMembershipRequests = membershipRequests.filter((request) =>
        (!membershipSectionFilter ||
            request.applicant_section === membershipSectionFilter) &&
        (!membershipYearFilter ||
            request.applicant_year_level === membershipYearFilter)
    );

    const activeCount = organizations.filter(
        (organization) => organization.status === "active"
    ).length;

    const inactiveCount = organizations.filter(
        (organization) => organization.status === "inactive"
    ).length;
    const pendingMembershipCount = membershipRequests.filter(
        (request) => request.status === "pending"
    ).length;

    const displayName =
        adminProfile?.name ||
        adminProfile?.full_name ||
        adminProfile?.username ||
        "Administrator";
    const departmentName =
        user?.dept_name ||
        departments.find(
            (department) =>
                Number(department.dept_id) ===
                Number(isOrganizationAdmin ? user?.organization_dept_id : user?.dept_id)
        )?.dept_name;
    const assignedDepartmentName =
        departmentName ||
        DEPARTMENT_NAMES[Number(user?.organization_dept_id)] ||
        "your department";

    const hasDashboardAccess = expectedDepartmentId === null
        ? isUniversityAdmin
        : isOrganizationAdmin &&
          Number(user?.organization_dept_id) === expectedDepartmentId;

    if (!hasDashboardAccess) {
        return (
            <main className="org-page">
                <section className="org-content">
                    <div className="org-list-section">
                        <h1>Organization admin access required</h1>
                        <p>
                            Sign in with the organization administrator account
                            assigned to this department.
                        </p>
                        <button
                            type="button"
                            className="org-primary-btn"
                            onClick={() => navigate("/login", { replace: true })}
                        >
                            Return to sign in
                        </button>
                    </div>
                </section>
            </main>
        );
    }

    return (
        <div className="admin-layout org-page">
            <AdminSidebar
                activePage={activePage}
                user={user}
                profile={adminProfile}
                departmentName={
                    DEPARTMENT_NAMES[Number(user?.organization_dept_id)] ||
                    departmentName
                }
                onOrganizations={() => setActivePage("Organizations")}
                onProfile={() => setActivePage("Edit Profile")}
            />

            <main className="admin-main">
                <header className="admin-topbar">
                    <div>
                        <span className="admin-breadcrumb">
                            Organization Admin / Organizations
                        </span>
                        <h1>Organization Management</h1>
                        <p>
                            Manage organizations and membership applications for{" "}
                            {assignedDepartmentName}.
                        </p>
                    </div>

                    <div className="admin-user-chip">
                        <span className="admin-user-avatar">
                            {displayName.charAt(0).toUpperCase()}
                            {adminProfile?.avatar_url && (
                                <img
                                    src={adminProfile.avatar_url}
                                    alt=""
                                    onError={(event) => {
                                        event.currentTarget.hidden = true;
                                    }}
                                />
                            )}
                        </span>
                        <div>
                            <strong>{displayName}</strong>
                            <small>Organization Admin</small>
                        </div>
                    </div>
                </header>

                <section className="org-content">
                    {activePage === "Edit Profile" ? (
                        <>
                            {profileError && (
                                <div className="org-alert error" role="alert">
                                    {profileError}
                                </div>
                            )}
                            {profileNotice && (
                                <div className="org-alert success" role="status">
                                    {profileNotice}
                                </div>
                            )}
                            <section className="org-list-section org-profile">
                                <div className="org-profile-summary">
                                    <span className="org-profile-avatar">
                                        {(adminProfile?.full_name || "A")
                                            .charAt(0)
                                            .toUpperCase()}
                                        {adminProfile?.avatar_url && (
                                            <img
                                                src={adminProfile.avatar_url}
                                                alt={`${adminProfile.full_name || "Organization admin"} profile`}
                                                onError={(event) => {
                                                    event.currentTarget.hidden = true;
                                                }}
                                            />
                                        )}
                                    </span>
                                    <div>
                                        <h2>{adminProfile?.full_name || "Organization Admin"}</h2>
                                        <p>{assignedDepartmentName} organization administrator.</p>
                                        <label className="org-profile-photo">
                                            {profileUploading ? "Uploading photo…" : "Change profile photo"}
                                            <input
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp"
                                                onChange={uploadOrganizationProfilePhoto}
                                                disabled={profileUploading}
                                            />
                                        </label>
                                        <small>JPEG, PNG, or WebP; up to 2000 MB.</small>
                                    </div>
                                </div>
                                <form
                                    className="org-profile-form"
                                    onSubmit={saveOrganizationProfile}
                                >
                                    <label>
                                        Full name
                                        <input
                                            value={profileForm.full_name}
                                            onChange={(event) =>
                                                setProfileForm({
                                                    ...profileForm,
                                                    full_name: event.target.value,
                                                })
                                            }
                                            maxLength={150}
                                            required
                                        />
                                    </label>
                                    <label>
                                        Email address
                                        <input
                                            type="email"
                                            value={profileForm.email}
                                            onChange={(event) =>
                                                setProfileForm({
                                                    ...profileForm,
                                                    email: event.target.value,
                                                })
                                            }
                                            maxLength={255}
                                            required
                                        />
                                    </label>
                                    <dl>
                                        <div><dt>Role</dt><dd>Organization Admin</dd></div>
                                        <div><dt>Department</dt><dd>{assignedDepartmentName}</dd></div>
                                        <div><dt>Account status</dt><dd>{adminProfile?.status || "Active"}</dd></div>
                                    </dl>
                                    <button type="submit" className="org-primary-btn" disabled={profileSaving}>
                                        {profileSaving ? "Saving…" : "Save profile"}
                                    </button>
                                </form>
                            </section>
                        </>
                    ) : (
                    <>
                    <div className="org-heading">
                        <div>
                            <h2>Manage Organizations</h2>
                            <p>
                                Add, view, edit, and manage campus organizations.
                            </p>
                        </div>

                        <button
                            type="button"
                            className="org-primary-btn"
                            onClick={openAddModal}
                        >
                            <span>＋</span> Add Organization
                        </button>
                    </div>

                    <div className="org-panel-tabs" role="tablist">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activePanel === "organizations"}
                            className={
                                activePanel === "organizations" ? "active" : ""
                            }
                            onClick={() => setActivePanel("organizations")}
                        >
                            Organizations
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activePanel === "membership-requests"}
                            className={
                                activePanel === "membership-requests"
                                    ? "active"
                                    : ""
                            }
                            onClick={() => {
                                setActivePanel("membership-requests");
                                fetchMembershipRequests();
                            }}
                        >
                            Membership Requests
                            <span>{pendingMembershipCount}</span>
                        </button>
                    </div>

                    {error && !showModal && (
                        <div className="org-alert error">{error}</div>
                    )}

                    {success && (
                        <div className="org-alert success">{success}</div>
                    )}

                    {activePanel === "organizations" && (
                    <>
                    <div className="org-stat-grid">
                        <div className="org-stat-card">
                            <div className="org-stat-icon total">♧</div>
                            <div>
                                <span>Total Organizations</span>
                                <strong>{organizations.length}</strong>
                            </div>
                        </div>

                        <div className="org-stat-card">
                            <div className="org-stat-icon active">✓</div>
                            <div>
                                <span>Active Organizations</span>
                                <strong>{activeCount}</strong>
                            </div>
                        </div>

                        <div className="org-stat-card">
                            <div className="org-stat-icon inactive">◷</div>
                            <div>
                                <span>Inactive Organizations</span>
                                <strong>{inactiveCount}</strong>
                            </div>
                        </div>
                    </div>

                    <section className="org-list-section">
                        <div className="org-toolbar">
                            <div>
                                <h3>Organization List</h3>
                                <span>
                                    {filteredOrganizations.length} result(s)
                                </span>
                            </div>

                            <div className="org-filters">
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="Search organizations..."
                                    aria-label="Search organizations"
                                />

                                <select
                                    value={statusFilter}
                                    onChange={(event) =>
                                        setStatusFilter(event.target.value)
                                    }
                                    aria-label="Filter by status"
                                >
                                    <option value="all">All Status</option>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>

                        {loading ? (
                            <div className="org-empty">
                                <div className="org-spinner" />
                                <p>Loading organizations...</p>
                            </div>
                        ) : filteredOrganizations.length === 0 ? (
                            <div className="org-empty">
                                <span className="org-empty-icon">♧</span>
                                <strong>No organizations found</strong>
                                <p>
                                    Try changing your search or add a new
                                    organization.
                                </p>
                                {organizations.length === 0 && (
                                    <button
                                        type="button"
                                        className="org-primary-btn"
                                        onClick={openAddModal}
                                    >
                                        ＋ Add First Organization
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="org-card-grid">
                                {filteredOrganizations.map((organization) => (
                                    <article
                                        className="org-card"
                                        key={organization.org_id}
                                    >
                                        <div className="org-card-banner">
                                            <div className="org-card-emblem">
                                                {organization.org_name
                                                    ?.trim()
                                                    .charAt(0)
                                                    .toUpperCase() || "O"}
                                            </div>

                                            <span
                                                className={`org-status status-${organization.status}`}
                                            >
                                                {organization.status}
                                            </span>
                                        </div>

                                        <div className="org-card-body">
                                            <span className="org-category">
                                                {organization.category}
                                            </span>

                                            <h3>{organization.org_name}</h3>

                                            <p className="org-description">
                                                {organization.description}
                                            </p>

                                            <div className="org-eligibility">
                                                <strong>Eligibility</strong>
                                                <p>
                                                    {organization.eligibility ||
                                                        "No eligibility details provided."}
                                                </p>
                                            </div>

                                            <div className="org-card-meta">
                                                <span>
                                                    {organization.dept_name ||
                                                        "University-wide"}
                                                </span>
                                                <span>
                                                    ID: {organization.org_id}
                                                </span>
                                                {organization.created_at && (
                                                    <span>
                                                        Created{" "}
                                                        {String(
                                                            organization.created_at
                                                        ).slice(0, 10)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="org-card-actions">
                                                <button
                                                    type="button"
                                                    className="org-edit-btn"
                                                    onClick={() =>
                                                        openEditModal(organization)
                                                    }
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    className="org-delete-btn"
                                                    onClick={() =>
                                                        handleDelete(organization)
                                                    }
                                                    disabled={
                                                        deletingId ===
                                                        organization.org_id
                                                    }
                                                >
                                                    {deletingId ===
                                                    organization.org_id
                                                        ? "Deleting..."
                                                        : "Delete"}
                                                </button>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                    </>
                    )}

                    {activePanel === "membership-requests" && (
                        <section className="org-list-section">
                            <div className="org-toolbar">
                                <div>
                                    <h3>Organization Membership Applications</h3>
                                    <span>
                                        {pendingMembershipCount} pending ·{" "}
                                        {membershipRequests.length} total
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    className="org-refresh-btn"
                                    onClick={fetchMembershipRequests}
                                    disabled={membershipRequestsLoading}
                                >
                                    {membershipRequestsLoading
                                        ? "Refreshing..."
                                        : "Refresh"}
                                </button>
                            </div>

                            {membershipRequestsError && (
                                <div className="org-alert error">
                                    {membershipRequestsError}
                                </div>
                            )}

                            {membershipRequestsLoading ? (
                                <div className="org-empty">
                                    <div className="org-spinner" />
                                    <p>Loading membership applications...</p>
                                </div>
                            ) : membershipRequests.length === 0 ? (
                                <div className="org-empty">
                                    <span className="org-empty-icon">♧</span>
                                    <strong>No membership applications yet</strong>
                                    <p>
                                        Student applications will appear here
                                        after they submit the organization form.
                                    </p>
                                </div>
                            ) : (
                                <>
                                <div className="org-membership-filters">
                                    <label>
                                        Filter by year
                                        <select
                                            value={membershipYearFilter}
                                            onChange={(event) =>
                                                setMembershipYearFilter(event.target.value)
                                            }
                                        >
                                            <option value="">All year levels</option>
                                            {membershipYears.map((year) => (
                                                <option key={year} value={year}>{year}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        Filter by section
                                        <select
                                            value={membershipSectionFilter}
                                            onChange={(event) =>
                                                setMembershipSectionFilter(event.target.value)
                                            }
                                        >
                                            <option value="">All sections</option>
                                            {membershipSections.map((section) => (
                                                <option key={section} value={section}>{section}</option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                                {filteredMembershipRequests.length === 0 ? (
                                    <div className="org-empty">
                                        <strong>No applications match these filters</strong>
                                    </div>
                                ) : (
                                <div className="org-membership-list">
                                    {filteredMembershipRequests.map((request) => (
                                        <article
                                            className="org-membership-card"
                                            key={request.reg_id}
                                        >
                                            <div className="org-membership-card-heading">
                                                <div>
                                                    <span className="org-category">
                                                        {request.org_name}
                                                    </span>
                                                    <h4>
                                                        {request.applicant_full_name ||
                                                            "Student name not provided"}
                                                    </h4>
                                                    <span className="org-membership-meta">
                                                        Submitted{" "}
                                                        {request.registered_at ||
                                                            "date unavailable"}
                                                    </span>
                                                </div>
                                                <span
                                                    className={`org-status org-membership-status status-${request.status}`}
                                                >
                                                    {request.status}
                                                </span>
                                            </div>
                                            <dl className="org-membership-details">
                                                <div>
                                                    <dt>Department</dt>
                                                    <dd>
                                                        {request.applicant_department ||
                                                            "—"}
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt>Section</dt>
                                                    <dd>
                                                        {request.applicant_section ||
                                                            "—"}
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt>Year level</dt>
                                                    <dd>
                                                        {request.applicant_year_level ||
                                                            "—"}
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt>Student account</dt>
                                                    <dd>
                                                        {request.student_no ||
                                                            request.email ||
                                                            `ID ${request.user_id}`}
                                                    </dd>
                                                </div>
                                            </dl>
                                            {request.status === "pending" && (
                                                <div className="org-membership-actions">
                                                    <button
                                                        type="button"
                                                        className="org-membership-reject"
                                                        onClick={() =>
                                                            reviewMembershipRequest(
                                                                request,
                                                                "rejected"
                                                            )
                                                        }
                                                        disabled={
                                                            membershipActionId !==
                                                            null
                                                        }
                                                    >
                                                        {membershipActionId ===
                                                        request.reg_id
                                                            ? "Saving..."
                                                            : "Reject"}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="org-membership-approve"
                                                        onClick={() =>
                                                            reviewMembershipRequest(
                                                                request,
                                                                "approved"
                                                            )
                                                        }
                                                        disabled={
                                                            membershipActionId !==
                                                            null
                                                        }
                                                    >
                                                        {membershipActionId ===
                                                        request.reg_id
                                                            ? "Saving..."
                                                            : "Approve"}
                                                    </button>
                                                </div>
                                            )}
                                        </article>
                                    ))}
                                </div>
                                )}
                                </>
                            )}
                        </section>
                    )}
                    </>
                    )}
                </section>
            </main>

            {showModal && (
                <div
                    className="org-modal-overlay"
                    onMouseDown={closeModal}
                >
                    <section
                        className="org-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="org-modal-title"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <div className="org-modal-header">
                            <div>
                                <span className="org-modal-eyebrow">
                                    ORGANIZATION DETAILS
                                </span>
                                <h2 id="org-modal-title">
                                    {editingId
                                        ? "Edit Organization"
                                        : "Add New Organization"}
                                </h2>
                                <p>
                                    Fill in the organization information below.
                                </p>
                            </div>

                            <button
                                type="button"
                                className="org-modal-close"
                                onClick={closeModal}
                                disabled={saving}
                                aria-label="Close modal"
                            >
                                ×
                            </button>
                        </div>

                        {error && (
                            <div className="org-alert error">{error}</div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div className="org-form-grid">
                                <label className="org-form-full">
                                    Organization Name *
                                    <input
                                        name="org_name"
                                        value={form.org_name}
                                        onChange={handleChange}
                                        placeholder="e.g. IT Society"
                                        maxLength={150}
                                        required
                                    />
                                </label>

                                <label>
                                    Category *
                                    <select
                                        name="category"
                                        value={form.category}
                                        onChange={handleChange}
                                        required
                                    >
                                        {CATEGORIES.map((category) => (
                                            <option
                                                key={category}
                                                value={category}
                                            >
                                                {category}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label>
                                    Status *
                                    <select
                                        name="status"
                                        value={form.status}
                                        onChange={handleChange}
                                        required
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </label>

                                {isUniversityAdmin && (
                                    <label className="org-form-full">
                                        Department
                                        <select
                                            name="dept_id"
                                            value={form.dept_id}
                                            onChange={handleChange}
                                        >
                                            <option value="">
                                                University-wide
                                            </option>
                                            {departments.map((department) => (
                                                <option
                                                    key={department.dept_id}
                                                    value={department.dept_id}
                                                >
                                                    {department.dept_name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                )}

                                <label className="org-form-full">
                                    Description *
                                    <textarea
                                        name="description"
                                        value={form.description}
                                        onChange={handleChange}
                                        placeholder="Describe the organization and its purpose..."
                                        rows={4}
                                        required
                                    />
                                </label>

                                <label className="org-form-full">
                                    Eligibility
                                    <textarea
                                        name="eligibility"
                                        value={form.eligibility}
                                        onChange={handleChange}
                                        placeholder="Who can join this organization?"
                                        rows={3}
                                    />
                                </label>
                            </div>

                            <div className="org-modal-actions">
                                <button
                                    type="button"
                                    className="org-cancel-btn"
                                    onClick={closeModal}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="org-primary-btn"
                                    disabled={saving}
                                >
                                    {saving
                                        ? "Saving..."
                                        : editingId
                                        ? "Save Changes"
                                        : "Create Organization"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </div>
    );
}
