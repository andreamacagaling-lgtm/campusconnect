
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { confirmLogout } from "../../authSession";
import ResponsiveSidebarToggle from "../../components/ResponsiveSidebarToggle";
import { notifySuccess } from "../../notifications";
import "./Announcements.css";

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "";

const ANNOUNCEMENTS_API = `${API_BASE_URL}/api/announcements`;

const EMPTY_FORM = {
    title: "",
    body: "",
    event_id: "",
};

const NAV_ITEMS = [
    { label: "Dashboard", path: "/admin/dashboard", icon: "⌂" },
    { label: "Announcements", path: "/admin/announcements", icon: "▤" },
    { label: "Events", path: "/admin/events", icon: "▦" },
    { label: "Attendance", path: "/admin/attendance", icon: "✓" },
    { label: "Fines Monitoring", path: "/admin/fines", icon: "₱" },
    { label: "QR Scanner", path: "/admin/scanner", icon: "▣" },
    { label: "Admin Profile", path: "/admin/adminprofile", icon: "◎" },
];

const DEPARTMENT_ADMIN_ROUTES = {
    1: "/admin/ccs",
    2: "/admin/ccje",
    3: "/admin/cbm",
    4: "/admin/cas",
    5: "/admin/btvted",
    6: "/admin/bsed",
};

function getToken() {
    return (
        localStorage.getItem("campusconnect_token") ||
        sessionStorage.getItem("campusconnect_token") ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        ""
    );
}

function getUser() {
    try {
        return JSON.parse(
            localStorage.getItem("campusconnect_user") ||
                sessionStorage.getItem("campusconnect_user") ||
                "null"
        );
    } catch {
        return null;
    }
}

function getErrorMessage(err, fallback) {
    return (
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        fallback
    );
}

function formatDateTime(value, { timeZone = "Asia/Manila", assumeTimeZone = "Asia/Manila" } = {}) {
    if (!value) return "—";

    const numericValue = Number(value);
    const isTimestamp =
        (typeof value === "number" || /^\d+(?:\.\d+)?$/.test(String(value))) &&
        Number.isFinite(numericValue);
    const normalized = typeof value === "string" ? value.trim().replace(" ", "T") : value;
    const hasTimeZone =
        typeof normalized === "string" &&
        /(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized);
    const date = isTimestamp
        ? new Date(numericValue * 1000)
        : new Date(
              typeof normalized === "string" && !hasTimeZone
                  ? `${normalized}${assumeTimeZone === "UTC" ? "Z" : "+08:00"}`
                  : normalized
          );

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString("en-PH", {
        timeZone,
        dateStyle: "medium",
        timeStyle: "short",
        hour12: true,
    });
}

function parsePhilippineDateTime(value) {
    if (!value) return null;

    const normalized = String(value).trim().replace(" ", "T");
    const hasTimeZone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized);
    const date = new Date(
        hasTimeZone ? normalized : `${normalized}+08:00`
    );

    return Number.isNaN(date.getTime()) ? null : date;
}

function getAnnouncementTimestamp(announcement) {
    const timestamp = Number(announcement.created_at_timestamp);
    if (Number.isFinite(timestamp) && timestamp > 0) return timestamp * 1000;

    const value = String(announcement.created_at ?? "").trim().replace(" ", "T");
    if (!value) return 0;

    const hasTimeZone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
    const parsed = new Date(hasTimeZone ? value : `${value}Z`).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
}

function AdminSidebar({ activePage, user }) {
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const departmentRoute =
        DEPARTMENT_ADMIN_ROUTES[Number(user?.dept_id)];
    const isDepartmentAdmin =
        user?.role === "admin" &&
        user?.admin_type === "department" &&
        Boolean(departmentRoute);
    const navItems = isDepartmentAdmin
        ? [
              { label: "Dashboard", path: departmentRoute, icon: "⌂" },
              { label: "Events", path: `${departmentRoute}/events`, icon: "▦" },
              { label: "Announcements", path: `${departmentRoute}/announcements`, icon: "▤" },
              { label: "Attendance", path: `${departmentRoute}/attendance`, icon: "✓" },
              { label: "QR Scanner", path: "/admin/scanner", icon: "▣" },
              { label: "Admin Profile", path: `${departmentRoute}/profile`, icon: "◎" },
          ]
        : NAV_ITEMS;

    function handleLogout() {
        if (!confirmLogout()) return;

        localStorage.removeItem("campusconnect_token");
        sessionStorage.removeItem("campusconnect_token");
        localStorage.removeItem("campusconnect_user");
        sessionStorage.removeItem("campusconnect_user");
        localStorage.removeItem("token");
        sessionStorage.removeItem("token");

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
                    <span>ADMIN PORTAL</span>
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
                        onClick={() => navigate(item.path)}
                    >
                        <span className="admin-nav-icon">{item.icon}</span>
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>

            <div className="admin-sidebar-bottom responsive-sidebar-bottom">
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
    const user = getUser();
    const adminType = user?.admin_type;
    const adminDeptId = user?.dept_id;
    const isDepartmentAdmin =
        user?.role === "admin" &&
        adminType === "department" &&
        Boolean(DEPARTMENT_ADMIN_ROUTES[Number(adminDeptId)]);
    const departmentName = user?.dept_name || "Department";
    const pageTitle = isDepartmentAdmin
        ? `${departmentName} Announcements`
        : "Announcement Management";
    const pageDescription = isDepartmentAdmin
        ? `Send announcements to active student email accounts in ${departmentName}.`
        : "Share important updates and notices with university students.";
    const canNotifyForEvents =
        user?.role === "admin" &&
        ["usg", "department"].includes(adminType);

    const [announcements, setAnnouncements] = useState([]);
    const [upcomingEvents, setUpcomingEvents] = useState([]);
    const [loadingUpcomingEvents, setLoadingUpcomingEvents] = useState(false);
    const [upcomingEventsError, setUpcomingEventsError] = useState("");
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
        void Promise.resolve().then(fetchAnnouncements);
    }, [fetchAnnouncements]);

    useEffect(() => {
        if (!showModal || editingId !== null || !canNotifyForEvents) return undefined;

        let active = true;
        void Promise.resolve()
            .then(() => {
                if (!active) return undefined;
                setLoadingUpcomingEvents(true);
                setUpcomingEventsError("");
                return axios.get(`${API_BASE_URL}/api/events`, {
                    headers: getHeaders(),
                });
            })
            .then((response) => {
                if (!active || !response) return;
                const rows = response.data?.data;
                if (!Array.isArray(rows)) {
                    throw new Error("Upcoming events were not returned by the server.");
                }

                const availableEvents = rows.filter((event) => {
                    const end = parsePhilippineDateTime(event.end_datetime);
                    const eventDeptId =
                        event.dept_id === null || event.dept_id === ""
                            ? null
                            : Number(event.dept_id);
                    const accountDeptId =
                        adminDeptId === null || adminDeptId === ""
                            ? null
                            : Number(adminDeptId);
                    const isManagedEvent =
                        adminType === "usg"
                            ? eventDeptId === null
                            : eventDeptId === accountDeptId &&
                              accountDeptId !== null;

                    return (
                        isManagedEvent &&
                        event.approval_status === "approved" &&
                        ["upcoming", "ongoing"].includes(event.status) &&
                        end !== null &&
                        end.getTime() > Date.now()
                    );
                });
                setUpcomingEvents(availableEvents);
            })
            .catch((requestError) => {
                if (!active) return;
                if (!handleUnauthorized(requestError)) {
                    setUpcomingEventsError(
                        getErrorMessage(
                            requestError,
                            "Unable to load approved upcoming events."
                        )
                    );
                }
            })
            .finally(() => {
                if (active) setLoadingUpcomingEvents(false);
            });

        return () => {
            active = false;
        };
    }, [
        showModal,
        editingId,
        canNotifyForEvents,
        adminType,
        adminDeptId,
        getHeaders,
        handleUnauthorized,
    ]);

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
            event_id: item.event_id ? String(item.event_id) : "",
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
            let response;

            if (editingId !== null) {
                response = await axios.put(
                    `${ANNOUNCEMENTS_API}/${editingId}`,
                    payload,
                    { headers: getHeaders() }
                );
            } else {
                response = await axios.post(
                    ANNOUNCEMENTS_API,
                    {
                        ...payload,
                        ...(form.event_id
                            ? { event_id: Number(form.event_id) }
                            : {}),
                    },
                    { headers: getHeaders() }
                );
            }

            setShowModal(false);
            setEditingId(null);
            setForm(EMPTY_FORM);

            await fetchAnnouncements();

            const notifications = [
                response.data?.event_email_notification,
                response.data?.email_notification,
            ].filter(Boolean);
            const failedNotifications = notifications.filter(
                (notification) => notification.success === false
            );

            if (failedNotifications.length > 0) {
                const notificationMessages = [
                    ...new Set(
                        failedNotifications
                            .map((notification) => notification.message)
                            .filter(Boolean)
                    ),
                ];
                setError(
                    notificationMessages.join(" ") ||
                        response.data?.message ||
                        "Announcement published, but email notifications could not be sent."
                );
            } else if (!response.data?.email_notification) {
                setError(
                    "Announcement published, but the server did not confirm email delivery. Check the deployed backend and SMTP settings."
                );
            } else {
                notifySuccess(
                    response.data?.message ||
                        (editingId !== null
                            ? "Announcement updated successfully."
                            : "Announcement added successfully.")
                );
            }
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

            notifySuccess("Announcement deleted successfully.");
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

    const sortedAnnouncements = [...filteredAnnouncements].sort(
        (a, b) => getAnnouncementTimestamp(b) - getAnnouncementTimestamp(a)
    );

    const latestAnnouncement = [...announcements].sort(
        (a, b) => getAnnouncementTimestamp(b) - getAnnouncementTimestamp(a)
    )[0];

    return (
        <div className="admin-layout">
            <AdminSidebar activePage="Announcements" user={user} />

            <main className="admin-main">
                <header className="admin-topbar">
                    <div>
                        <span className="admin-breadcrumb">
                            {isDepartmentAdmin
                                ? `${departmentName} Admin / Announcements`
                                : "Admin / Announcements"}
                        </span>
                        <h1>{pageTitle}</h1>
                        <p>{pageDescription}</p>
                    </div>

                    <div className="admin-user-chip">
                        <span className="admin-user-avatar">
                            {(user?.full_name || departmentName || "A")
                                .charAt(0)
                                .toUpperCase()}
                        </span>
                        <div>
                            <strong>
                                {user?.full_name ||
                                    (isDepartmentAdmin
                                        ? `${departmentName} Admin`
                                        : "Administrator")}
                            </strong>
                            <small>
                                {isDepartmentAdmin
                                    ? "Department Administrator"
                                    : "System Admin"}
                            </small>
                        </div>
                    </div>
                </header>

                <section className="announcements-content">
                    <div className="announcements-heading">
                        <div>
                            <h2>
                                {isDepartmentAdmin
                                    ? `${departmentName} Announcements`
                                    : "All Announcements"}
                            </h2>
                            <p>
                                {isDepartmentAdmin
                                    ? "View and manage announcements for your department."
                                    : "View, publish, edit, and manage campus notices."}
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
                                        ? formatDateTime(
                                              latestAnnouncement.created_at_timestamp ??
                                                  latestAnnouncement.created_at,
                                              { timeZone: "Asia/Manila", assumeTimeZone: "UTC" }
                                          )
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
                                                    {formatDateTime(
                                                        item.created_at_timestamp ??
                                                            item.created_at,
                                                        { timeZone: "Asia/Manila", assumeTimeZone: "UTC" }
                                                    )}
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

                            {canNotifyForEvents && editingId === null && (
                                <div className="announcements-form-group">
                                    <label htmlFor="announcement-event">
                                        Notify students about an event
                                    </label>
                                    <select
                                        id="announcement-event"
                                        name="event_id"
                                        value={form.event_id}
                                        onChange={handleChange}
                                        disabled={loadingUpcomingEvents || saving}
                                    >
                                        <option value="">No event notification</option>
                                        {upcomingEvents.map((event) => (
                                            <option
                                                key={event.event_id}
                                                value={event.event_id}
                                            >
                                                {event.title} — {formatDateTime(event.start_datetime)}
                                            </option>
                                        ))}
                                    </select>
                                    <small>
                                        You can send multiple email announcements for an approved event until it ends. Each announcement emails eligible students and adds an event alert in the student portal; registered students receive a start-time reminder.
                                    </small>
                                    {loadingUpcomingEvents && (
                                        <small>Loading approved active campus events…</small>
                                    )}
                                    {!loadingUpcomingEvents &&
                                        !upcomingEventsError &&
                                        upcomingEvents.length === 0 && (
                                            <small>
                                                No approved events that are still in progress are available for your account.
                                            </small>
                                        )}
                                    {upcomingEventsError && (
                                        <small role="alert">
                                            {upcomingEventsError}
                                        </small>
                                    )}
                                </div>
                            )}

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
