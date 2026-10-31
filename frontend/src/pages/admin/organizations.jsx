
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./Organizations.css";

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:3000";

const ORGANIZATIONS_API = `${API_BASE_URL}/api/organizations`;

const EMPTY_FORM = {
    org_name: "",
    category: "Academic",
    description: "",
    eligibility: "",
    status: "active",
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
    { label: "Dashboard", path: "/admin/dashboard", icon: "⌂" },
    { label: "Announcements", path: "/admin/announcements", icon: "▤" },
    { label: "Events", path: "/admin/events", icon: "▦" },
    { label: "Organizations", path: "/admin/organizations", icon: "♧" },
    { label: "Attendance", path: "/admin/attendance", icon: "✓" },
    { label: "Admin Profile", path: "/admin/profile", icon: "◎" },
];

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

function AdminSidebar({ activePage }) {
    const navigate = useNavigate();

    function handleLogout() {
        localStorage.removeItem("campusconnect_token");
        sessionStorage.removeItem("campusconnect_token");
        localStorage.removeItem("campusconnect_user");
        sessionStorage.removeItem("campusconnect_user");
        navigate("/login");
    }

    return (
        <aside className="admin-sidebar">
            <div className="admin-brand">
                <div className="admin-brand-logo">CC</div>
                <div>
                    <h2>CampusConnect</h2>
                    <span>ADMIN PORTAL</span>
                </div>
            </div>

            <div className="admin-nav-heading">MAIN MENU</div>

            <nav className="admin-nav">
                {NAV_ITEMS.map((item) => (
                    <button
                        key={item.path}
                        type="button"
                        className={`admin-nav-link ${
                            activePage === item.label ? "active" : ""
                        }`}
                        onClick={() => navigate(item.path)}
                    >
                        <span className="admin-nav-icon">{item.icon}</span>
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>

            <div className="admin-sidebar-bottom">
                <div className="admin-sidebar-note">
                    <span className="admin-online-dot" />
                    <div>
                        <strong>Admin Portal</strong>
                        <small>CampusConnect System</small>
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

export default function Organizations() {
    const navigate = useNavigate();
    const user = useMemo(() => getStoredUser(), []);

    const [organizations, setOrganizations] = useState([]);
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");

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
        fetchOrganizations();
    }, [fetchOrganizations]);

    function openAddModal() {
        setEditingId(null);
        setForm(EMPTY_FORM);
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

        const matchesCategory =
            categoryFilter === "all" ||
            organization.category === categoryFilter;

        const matchesStatus =
            statusFilter === "all" ||
            organization.status === statusFilter;

        return matchesSearch && matchesCategory && matchesStatus;
    });

    const activeCount = organizations.filter(
        (organization) => organization.status === "active"
    ).length;

    const inactiveCount = organizations.filter(
        (organization) => organization.status === "inactive"
    ).length;

    const displayName =
        user?.name ||
        user?.full_name ||
        user?.username ||
        "Administrator";

    return (
        <div className="admin-layout org-page">
            <AdminSidebar activePage="Organizations" />

            <main className="admin-main">
                <header className="admin-topbar">
                    <div>
                        <span className="admin-breadcrumb">
                            Admin / Organizations
                        </span>
                        <h1>Organization Management</h1>
                        <p>Manage university organizations and their details.</p>
                    </div>

                    <div className="admin-user-chip">
                        <span className="admin-user-avatar">
                            {displayName.charAt(0).toUpperCase()}
                        </span>
                        <div>
                            <strong>{displayName}</strong>
                            <small>System Admin</small>
                        </div>
                    </div>
                </header>

                <section className="org-content">
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

                    {error && !showModal && (
                        <div className="org-alert error">{error}</div>
                    )}

                    {success && (
                        <div className="org-alert success">{success}</div>
                    )}

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
                                    value={categoryFilter}
                                    onChange={(event) =>
                                        setCategoryFilter(event.target.value)
                                    }
                                    aria-label="Filter by category"
                                >
                                    <option value="all">All Categories</option>
                                    {CATEGORIES.map((category) => (
                                        <option key={category} value={category}>
                                            {category}
                                        </option>
                                    ))}
                                </select>

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
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
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
