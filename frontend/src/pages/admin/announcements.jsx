
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./Announcements.css";

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:3000";

const ANNOUNCEMENTS_API = `${API_BASE_URL}/api/announcements`;

const EMPTY_FORM = {
    title: "",
    body: "",
};

const NAV_ITEMS = [
    { label: "Dashboard", path: "/admin/dashboard", icon: "⌂" },
    { label: "Announcements", path: "/admin/announcements", icon: "▤" },
    { label: "Events", path: "/admin/events", icon: "▦" },
    { label: "Organizations", path: "/admin/organizations", icon: "♧" },
    { label: "Attendance", path: "/admin/attendance", icon: "✓" },
    { label: "Admin Profile", path: "/admin/adminprofile", icon: "◎" },
];

function getToken() {
    return (
        localStorage.getItem("campusconnect_token") ||
        sessionStorage.getItem("campusconnect_token") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        ""
    );
}

function getErrorMessage(err, fallback) {
    return (
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        fallback
    );
}

function formatDateTime(value) {
    if (!value) return "—";

    const normalized =
        typeof value === "string" ? value.replace(" ", "T") : value;

    const date = new Date(normalized);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

function AdminSidebar({ activePage }) {
    const navigate = useNavigate();

    function handleLogout() {
        const confirmed = window.confirm(
            "Are you sure you want to log out?"
        );

        if (!confirmed) return;

        localStorage.removeItem("campusconnect_token");
        sessionStorage.removeItem("campusconnect_token");
        localStorage.removeItem("campusconnect_user");
        sessionStorage.removeItem("campusconnect_user");
        localStorage.removeItem("token");
        sessionStorage.removeItem("token");

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

export default function Announcements() {
    const navigate = useNavigate();

    const [announcements, setAnnouncements] = useState([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);

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
                localStorage.removeItem("token");
                sessionStorage.removeItem("token");

                navigate("/login");
                return true;
            }

            return false;
        },
        [navigate]
    );

    const fetchAnnouncements = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const response = await axios.get(ANNOUNCEMENTS_API, {
                headers: getHeaders(),
            });

            const payload = response.data;

            const list = Array.isArray(payload)
                ? payload
                : payload?.data ?? payload?.announcements ?? [];

            setAnnouncements(Array.isArray(list) ? list : []);
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
        fetchAnnouncements();
    }, [fetchAnnouncements]);

    function openAddModal() {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setError("");
        setSuccess("");
        setShowModal(true);
    }

    function openEditModal(item) {
        setEditingId(item.announcement_id);

        setForm({
            title: item.title ?? "",
            body: item.body ?? "",
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

        const title = form.title.trim();
        const body = form.body.trim();

        if (!title || !body) {
            setError("Please fill in both the title and announcement details.");
            return;
        }

        if (title.length > 255) {
            setError("The announcement title must not exceed 255 characters.");
            return;
        }

        setSaving(true);

        try {
            const payload = { title, body };

            if (editingId !== null) {
                await axios.put(
                    `${ANNOUNCEMENTS_API}/${editingId}`,
                    payload,
                    { headers: getHeaders() }
                );

                setSuccess("Annoucement updated successfully.");
            } else {
                await axios.post(
                    ANNOUNCEMENTS_API,
                    payload,
                    { headers: getHeaders() }
                );

                setSuccess("Announcement added successfully.");
            }

            setShowModal(false);
            setEditingId(null);
            setForm(EMPTY_FORM);

            await fetchAnnouncements();
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

    async function handleDelete(item) {
        const confirmed = window.confirm(
            `Are you sure you want to delete "${item.title}"?`
        );

        if (!confirmed) return;

        setError("");
        setSuccess("");

        try {
            await axios.delete(
                `${ANNOUNCEMENTS_API}/${item.announcement_id}`,
                { headers: getHeaders() }
            );

            setSuccess("Announcement deleted successfully.");
            await fetchAnnouncements();
        } catch (err) {
            if (!handleUnauthorized(err)) {
                setError(
                    getErrorMessage(
                        err,
                        "Can't delete."
                    )
                );
            }
        }
    }

    const filteredAnnouncements = announcements.filter((item) => {
        const keyword = search.trim().toLowerCase();

        return [
            item.title,
            item.body,
            item.posted_by,
        ].some((value) =>
            String(value ?? "").toLowerCase().includes(keyword)
        );
    });

    const sortedAnnouncements = [...filteredAnnouncements].sort((a, b) => {
        const dateA = new Date(
            String(a.created_at ?? "").replace(" ", "T")
        ).getTime();

        const dateB = new Date(
            String(b.created_at ?? "").replace(" ", "T")
        ).getTime();

        return (Number.isNaN(dateB) ? 0 : dateB) -
            (Number.isNaN(dateA) ? 0 : dateA);
    });

    const latestAnnouncement = [...announcements].sort((a, b) => {
        const dateA = new Date(
            String(a.created_at ?? "").replace(" ", "T")
        ).getTime();

        const dateB = new Date(
            String(b.created_at ?? "").replace(" ", "T")
        ).getTime();

        return (Number.isNaN(dateB) ? 0 : dateB) -
            (Number.isNaN(dateA) ? 0 : dateA);
    })[0];

    return (
        <div className="admin-layout">
            <AdminSidebar activePage="Announcements" />

            <main className="admin-main">
                <header className="admin-topbar">
                    <div>
                        <span className="admin-breadcrumb">
                            Admin / Announcements
                        </span>
                        <h1>Announcement Management</h1>
                        <p>
                            Share important updates and notices with university students.
                        </p>
                    </div>

                    <div className="admin-user-chip">
                        <span className="admin-user-avatar">A</span>
                        <div>
                            <strong>Administrator</strong>
                            <small>System Admin</small>
                        </div>
                    </div>
                </header>

                <section className="announcements-content">
                    <div className="announcements-heading">
                        <div>
                            <h2>All Announcements</h2>
                            <p>
                                View, publish, edit, and manage campus notices.
                            </p>
                        </div>

                        <button
                            type="button"
                            className="announcements-primary-btn"
                            onClick={openAddModal}
                        >
                            <span>＋</span> Add Announcement
                        </button>
                    </div>

                    <div className="announcements-stat-grid">
                        <div className="announcements-stat-card">
                            <span className="announcements-stat-icon">▤</span>
                            <div>
                                <span>Total Announcements</span>
                                <strong>{announcements.length}</strong>
                            </div>
                        </div>

                        <div className="announcements-stat-card">
                            <span className="announcements-stat-icon latest">◷</span>
                            <div>
                                <span>Latest Announcement</span>
                                <strong className="announcements-latest-value">
                                    {latestAnnouncement
                                        ? formatDateTime(latestAnnouncement.created_at)
                                        : "None yet"}
                                </strong>
                            </div>
                        </div>
                    </div>

                    {error && !showModal && (
                        <div className="announcements-alert error" role="alert">
                            <span>!</span>
                            <p>{error}</p>
                            <button
                                type="button"
                                onClick={() => setError("")}
                                aria-label="Dismiss error"
                            >
                                ×
                            </button>
                        </div>
                    )}

                    {success && (
                        <div className="announcements-alert success" role="status">
                            <span>✓</span>
                            <p>{success}</p>
                            <button
                                type="button"
                                onClick={() => setSuccess("")}
                                aria-label="Dismiss success message"
                            >
                                ×
                            </button>
                        </div>
                    )}

                    <section className="announcements-table-card">
                        <div className="announcements-toolbar">
                            <div>
                                <h3>Announcement List</h3>
                                <span>
                                    {filteredAnnouncements.length} result(s)
                                </span>
                            </div>

                            <div className="announcements-filters">
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Search announcements..."
                                    aria-label="Search announcements"
                                />
                            </div>
                        </div>

                        {loading ? (
                            <div className="announcements-empty">
                                <span className="announcements-spinner" />
                                <p>Loading announcements...</p>
                            </div>
                        ) : sortedAnnouncements.length === 0 ? (
                            <div className="announcements-empty">
                                <span className="announcements-empty-icon">▤</span>
                                <strong>
                                    {search
                                        ? "No announcements found"
                                        : "No announcements yet"}
                                </strong>
                                <p>
                                    {search
                                        ? "Try another search keyword."
                                        : "Add your first announcement to inform students."}
                                </p>

                                {!search && (
                                    <button
                                        type="button"
                                        className="announcements-primary-btn"
                                        onClick={openAddModal}
                                    >
                                        ＋ Create Announcement
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="announcements-table-wrapper">
                                <table className="announcements-table">
                                    <thead>
                                        <tr>
                                            <th>Announcement</th>
                                            <th>Posted By</th>
                                            <th>Date Posted</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {sortedAnnouncements.map((item) => (
                                            <tr key={item.announcement_id}>
                                                <td>
                                                    <div className="announcements-title-cell">
                                                        <div className="announcements-row-icon">
                                                            ▤
                                                        </div>
                                                        <div>
                                                            <strong>{item.title}</strong>
                                                            <p>{item.body}</p>
                                                            <small>
                                                                ID: {item.announcement_id}
                                                            </small>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td>
                                                    {item.posted_by
                                                        ? `Admin #${item.posted_by}`
                                                        : "Administrator"}
                                                </td>

                                                <td>
                                                    {formatDateTime(item.created_at)}
                                                </td>

                                                <td>
                                                    <div className="announcements-action-group">
                                                        <button
                                                            type="button"
                                                            className="announcements-edit-btn"
                                                            onClick={() => openEditModal(item)}
                                                        >
                                                            Edit
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="announcements-delete-btn"
                                                            onClick={() => handleDelete(item)}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </section>
            </main>

            {showModal && (
                <div
                    className="announcements-modal-overlay"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeModal();
                        }
                    }}
                >
                    <section
                        className="announcements-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="announcement-modal-title"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <div className="announcements-modal-header">
                            <div>
                                <h2 id="announcement-modal-title">
                                    {editingId !== null
                                        ? "Edit Announcement"
                                        : "Add New Announcement"}
                                </h2>
                                <p>
                                    Fill in the announcement information below.
                                </p>
                            </div>

                            <button
                                type="button"
                                className="announcements-modal-close"
                                onClick={closeModal}
                                disabled={saving}
                                aria-label="Close modal"
                            >
                                ×
                            </button>
                        </div>

                        {error && (
                            <div className="announcements-alert error" role="alert">
                                <p>{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div className="announcements-form-group">
                                <label htmlFor="announcement-title">
                                    Announcement Title *
                                </label>
                                <input
                                    id="announcement-title"
                                    name="title"
                                    type="text"
                                    value={form.title}
                                    onChange={handleChange}
                                    maxLength={255}
                                    placeholder="Enter announcement title"
                                    required
                                />
                                <small>Maximum of 255 characters.</small>
                            </div>

                            <div className="announcements-form-group">
                                <label htmlFor="announcement-body">
                                    Announcement Details *
                                </label>
                                <textarea
                                    id="announcement-body"
                                    name="body"
                                    value={form.body}
                                    onChange={handleChange}
                                    rows={7}
                                    placeholder="Write the announcement details here..."
                                    required
                                />
                            </div>

                            <div className="announcements-modal-actions">
                                <button
                                    type="button"
                                    className="announcements-cancel-btn"
                                    onClick={closeModal}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="announcements-primary-btn"
                                    disabled={saving}
                                >
                                    {saving
                                        ? "Saving..."
                                        : editingId !== null
                                        ? "Save Changes"
                                        : "Publish Announcement"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </div>
    );
}
