
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import EventImageUpload from "./EventImageUpload";
import { confirmLogout } from "../../authSession";
import ResponsiveSidebarToggle from "../../components/ResponsiveSidebarToggle";
import { notifySuccess } from "../../notifications";
import "./BSEDAdmin.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "";

const DEPARTMENT_ID = 6;
const DEPARTMENT_CODE = "BSED";
const DEPARTMENT_NAME = "Bachelor of Secondary Education";
const ADMIN_ROUTE = "/admin/bsed";
const EVENTS_API = `${API_BASE_URL}/api/events`;
const GOOGLE_CALENDAR_SYNC_API =
  `${API_BASE_URL}/api/google-calendar/sync-events`;

const CATEGORIES = [
  { category_id: 1, category_name: "Academic" },
  { category_id: 2, category_name: "Cultural" },
  { category_id: 3, category_name: "Sports" },
  { category_id: 4, category_name: "Technology" },
  { category_id: 5, category_name: "University Event" },
  { category_id: 6, category_name: "Workshop" },
  { category_id: 7, category_name: "Seminar" },
  { category_id: 8, category_name: "Other" },
];

const EMPTY_FORM = {
  category_id: "",
  org_id: "",
  title: "",
  description: "",
  venue: "",
  image: "",
  start_datetime: "",
  end_datetime: "",
  status: "upcoming",
};

const STATUS_OPTIONS = [
  "upcoming",
  "ongoing",
  "completed",
  "cancelled",
];

function getToken() {
  return (
    localStorage.getItem("campusconnect_token") ||
    sessionStorage.getItem("campusconnect_token")
  );
}

function getHeaders() {
  const token = getToken();

  return token
    ? { Authorization: `Bearer ${token}` }
    : {};
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

function formatDate(value) {
  if (!value) return "—";

  const normalized = String(value).replace(" ", "T");
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
  });
}

function toDateTimeLocal(value) {
  if (!value) return "";

  return String(value).replace(" ", "T").slice(0, 16);
}

function responseMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    fallback
  );
}

function AdminSidebar({
  navigate,
  departmentCode,
  departmentName,
  route,
  activeSection,
  fullNavigation,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const logout = () => {
    if (!confirmLogout()) return;

    localStorage.removeItem("campusconnect_token");
    localStorage.removeItem("campusconnect_user");
    sessionStorage.removeItem("campusconnect_token");
    sessionStorage.removeItem("campusconnect_user");
    navigate("/login", { replace: true });
  };

  return (
    <aside
      className={`bsed-sidebar responsive-sidebar ${
        mobileMenuOpen ? "responsive-sidebar-open" : ""
      }`}
    >
      <div className="bsed-brand responsive-sidebar-brand">
        <img className="bsed-brand-icon" src="/images/msu-seal.png" alt="" />
        <div>
          <strong>CampusConnect</strong>
          <span>{departmentCode} ADMIN PORTAL</span>
        </div>
        <ResponsiveSidebarToggle
          isOpen={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((open) => !open)}
        />
      </div>

      <div className="bsed-menu-label responsive-sidebar-label">
        {departmentCode} MANAGEMENT
      </div>

      <nav
        className="bsed-nav responsive-sidebar-nav"
        onClick={() => setMobileMenuOpen(false)}
      >
        <button
          type="button"
          className={`bsed-nav-link ${activeSection === "dashboard" ? "active" : ""}`}
          onClick={() => navigate(route)}
        >
          <span>▤</span>
          {departmentCode} Dashboard
        </button>

        <button
          type="button"
          className={`bsed-nav-link ${activeSection === "events" ? "active" : ""}`}
          onClick={() => navigate(fullNavigation ? `${route}/events` : route)}
        >
          <span>▦</span>
          {departmentCode} Events
        </button>

        {fullNavigation && (
          <>
            <button
              type="button"
              className="bsed-nav-link"
              onClick={() => navigate(`${route}/announcements`)}
            >
              <span>▤</span>
              Announcements
            </button>
            <button
              type="button"
              className={`bsed-nav-link ${activeSection === "attendance" ? "active" : ""}`}
              onClick={() => navigate(`${route}/attendance`)}
            >
              <span>✓</span>
              Attendance
            </button>
            <button
              type="button"
              className={`bsed-nav-link ${activeSection === "fines" ? "active" : ""}`}
              onClick={() => navigate(`${route}/fines`)}
            >
              <span>₱</span>
              Fines Monitoring
            </button>
            <button
              type="button"
              className="bsed-nav-link"
              onClick={() => navigate("/admin/scanner")}
            >
              <span>▣</span>
              QR Scanner
            </button>
            <button
              type="button"
              className={`bsed-nav-link ${activeSection === "profile" ? "active" : ""}`}
              onClick={() => navigate(`${route}/profile`)}
            >
              <span>◎</span>
              Admin Profile
            </button>
          </>
        )}
      </nav>

      <div className="bsed-sidebar-bottom responsive-sidebar-bottom">
        <div className="bsed-account">
          <div className="bsed-avatar">{departmentCode}</div>
          <div className="bsed-account-info">
            <strong>{departmentCode} Admin</strong>
            <span>{departmentName}</span>
          </div>
        </div>

        <button
          type="button"
          className="bsed-logout"
          onClick={logout}
        >
          ↪ Log Out
        </button>
      </div>
    </aside>
  );
}

export default function BSEDAdmin() {
  const navigate = useNavigate();
  const location = useLocation();
  const departmentId = DEPARTMENT_ID;
  const departmentCode = DEPARTMENT_CODE;
  const departmentName = DEPARTMENT_NAME;
  const route = ADMIN_ROUTE;
  const fullNavigation = true;

  const [events, setEvents] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");
  const [attendanceYearFilter, setAttendanceYearFilter] = useState("");
  const [attendanceSectionFilter, setAttendanceSectionFilter] = useState("");

  const user = getUser();
  const attendanceQuery = new URLSearchParams(location.search);
  const attendanceEventId = attendanceQuery.get("event_id") || "";
  const attendanceStatus =
    attendanceQuery.get("status") ||
    (location.pathname.endsWith("/fines") ? "fined" : "");
  const activeSection = fullNavigation
    ? location.pathname.endsWith("/fines")
      ? "fines"
      : location.pathname.endsWith("/attendance")
        ? "attendance"
      : location.pathname.endsWith("/profile")
        ? "profile"
        : location.pathname.endsWith("/events")
          ? "events"
          : "dashboard"
    : "events";

  const isDepartmentAdmin =
    user?.role === "admin" &&
    user?.admin_type === "department" &&
    Number(user?.dept_id) === departmentId;

  const attendanceYearOptions = useMemo(() => {
    const years = new Map();
    attendanceRecords.forEach((record) => {
      if (record.yr_id !== null && record.yr_id !== "") {
        years.set(String(record.yr_id), record.yr_name || "Year level");
      }
    });
    return [...years.entries()].sort((left, right) =>
      left[1].localeCompare(right[1], undefined, { numeric: true })
    );
  }, [attendanceRecords]);

  const attendanceSectionOptions = useMemo(() => {
    const sections = new Map();
    attendanceRecords.forEach((record) => {
      if (
        record.section_id !== null &&
        record.section_id !== "" &&
        (!attendanceYearFilter ||
          String(record.yr_id) === attendanceYearFilter)
      ) {
        sections.set(
          String(record.section_id),
          record.section_name || "Section"
        );
      }
    });
    return [...sections.entries()].sort((left, right) =>
      left[1].localeCompare(right[1], undefined, { numeric: true })
    );
  }, [attendanceRecords, attendanceYearFilter]);

  const filteredAttendanceRecords = useMemo(
    () =>
      attendanceRecords.filter(
        (record) =>
          (!attendanceYearFilter ||
            String(record.yr_id) === attendanceYearFilter) &&
          (!attendanceSectionFilter ||
            String(record.section_id) === attendanceSectionFilter)
      ),
    [attendanceRecords, attendanceSectionFilter, attendanceYearFilter]
  );

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await axios.get(EVENTS_API, {
        headers: getHeaders(),
      });

      const payload = response.data;
      const records = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.events)
            ? payload.events
            : [];

      // Show only events owned by this department.
      setEvents(
        records.filter(
          (event) => Number(event.dept_id) === departmentId
        )
      );
    } catch (err) {
      if (err?.response?.status === 401) {
        setError("Session expired. Please sign in again.");
      } else if (err?.response?.status === 403) {
        setError(`${departmentCode} Admin access is required.`);
      } else {
        setError(
          responseMessage(
            err,
            "Unable to load events. Check the backend and database connection."
          )
        );
      }
    } finally {
      setLoading(false);
    }
  }, [departmentCode, departmentId]);

  const fetchOrganizations = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/organizations`, {
        headers: getHeaders(),
      });
      const records = response.data?.data;
      if (!Array.isArray(records)) {
        throw new Error("Organizations were not returned by the server.");
      }
      setOrganizations(records);
    } catch (requestError) {
      setError(
        responseMessage(
          requestError,
          "Unable to load department organizations."
        )
      );
    }
  }, []);

  const fetchAttendance = useCallback(async () => {
    setAttendanceLoading(true);
    setAttendanceError("");

    try {
      const response = await axios.get(`${API_BASE_URL}/api/attendance`, {
        headers: getHeaders(),
        params: {
          ...(attendanceEventId ? { event_id: attendanceEventId } : {}),
          ...(attendanceStatus ? { status: attendanceStatus } : {}),
        },
      });
      const records = response.data?.data;

      if (!Array.isArray(records)) {
        throw new Error("Attendance records were not returned by the server.");
      }

      setAttendanceRecords(records);
    } catch (requestError) {
      setAttendanceError(
        responseMessage(requestError, "Unable to load attendance records.")
      );
    } finally {
      setAttendanceLoading(false);
    }
  }, [attendanceEventId, attendanceStatus]);

  useEffect(() => {
    if (!getToken()) {
      navigate("/login", { replace: true });
      return;
    }

    if (!isDepartmentAdmin) {
      return;
    }

    void Promise.resolve().then(fetchEvents);
    void Promise.resolve().then(fetchOrganizations);
  }, [departmentCode, fetchEvents, fetchOrganizations, isDepartmentAdmin, navigate]);

  useEffect(() => {
    if (
      fullNavigation &&
      ["attendance", "fines"].includes(activeSection) &&
      isDepartmentAdmin
    ) {
      void Promise.resolve().then(fetchAttendance);
    }
  }, [activeSection, fetchAttendance, fullNavigation, isDepartmentAdmin]);

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase();

    return events.filter((event) => {
      const matchesSearch = [
        event.title,
        event.description,
        event.venue,
        event.status,
        event.approval_status,
        event.category_name,
        organizations.find(
          (organization) => Number(organization.org_id) === Number(event.org_id)
        )?.org_name,
      ].some((value) =>
        String(value || "").toLowerCase().includes(term)
      );

      const matchesStatus =
        statusFilter === "all" ||
        event.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [events, organizations, search, statusFilter]);

  const stats = useMemo(
    () => ({
      total: events.length,
      upcoming: events.filter(
        (event) => event.status === "upcoming"
      ).length,
      ongoing: events.filter(
        (event) => event.status === "ongoing"
      ).length,
      completed: events.filter(
        (event) => event.status === "completed"
      ).length,
    }),
    [events]
  );

  const calendarDays = useMemo(() => {
    const firstWeekday = calendarMonth.getDay();
    const daysInMonth = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth() + 1,
      0
    ).getDate();
    const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

    return Array.from({ length: cellCount }, (_, index) => {
      const date = new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth(),
        index - firstWeekday + 1
      );
      const dateKey = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");

      return {
        date,
        dateKey,
        inMonth: date.getMonth() === calendarMonth.getMonth(),
      };
    });
  }, [calendarMonth]);

  const calendarEventsByDate = useMemo(() => {
    return events.reduce((eventsByDate, event) => {
      const dateKey = String(event.start_datetime || "")
        .replace(" ", "T")
        .slice(0, 10);

      if (!dateKey) return eventsByDate;

      if (!eventsByDate[dateKey]) {
        eventsByDate[dateKey] = [];
      }

      eventsByDate[dateKey].push(event);
      return eventsByDate;
    }, {});
  }, [events]);

  function openAddModal() {
    setEditingId(null);
    setImageFile(null);
    setForm({ ...EMPTY_FORM });
    setError("");
    setNotice("");
    setModalOpen(true);
  }

  function openEditModal(event) {
    setEditingId(event.event_id);
    setImageFile(null);

    setForm({
      category_id: String(event.category_id || ""),
      org_id: String(event.org_id || ""),
      title: event.title || "",
      description: event.description || "",
      venue: event.venue || "",
      image: event.image || "",
      start_datetime: toDateTimeLocal(event.start_datetime),
      end_datetime: toDateTimeLocal(event.end_datetime),
      status: event.status || "upcoming",
    });

    setError("");
    setNotice("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditingId(null);
    setImageFile(null);
    setForm({ ...EMPTY_FORM });
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!form.category_id) {
      setError("Please select an event category.");
      return;
    }

    if (
      !form.title.trim() ||
      !form.description.trim() ||
      !form.venue.trim() ||
      !form.start_datetime ||
      !form.end_datetime
    ) {
      setError("Please complete all required fields.");
      return;
    }

    if (
      new Date(form.end_datetime).getTime() <
      new Date(form.start_datetime).getTime()
    ) {
      setError("End date and time cannot be earlier than the start.");
      return;
    }

    const payload = {
      category_id: Number(form.category_id),
      org_id: form.org_id ? Number(form.org_id) : null,
      title: form.title.trim(),
      description: form.description.trim(),
      venue: form.venue.trim(),
      image: form.image.trim() || null,
      start_datetime: form.start_datetime.replace("T", " "),
      end_datetime: form.end_datetime.replace("T", " "),
      status: form.status,
    };

    setSaving(true);

    let calendarSyncWarning = "";

    try {
      if (editingId) {
        const response = await axios.put(
          `${EVENTS_API}/${editingId}`,
          payload,
          { headers: getHeaders() }
        );

        notifySuccess(response.data?.message || "Event updated successfully.");
        if (response.data?.google_calendar_sync?.success === false) {
          calendarSyncWarning =
            response.data.google_calendar_sync.message ||
            "The event was saved, but Google Calendar sync failed.";
        }
      } else {
        // Backend assigns dept_id from the authenticated department admin.
        const formData = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          formData.append(key, value === null ? "" : String(value));
        });
        if (imageFile) {
          formData.append("image_file", imageFile);
        }

        const response = await axios.post(
          EVENTS_API,
          formData,
          {
            headers: {
              ...getHeaders(),
              "Content-Type": "multipart/form-data",
            },
          }
        );

        notifySuccess(response.data?.message || "Event created successfully.");
        if (response.data?.google_calendar_sync?.success === false) {
          calendarSyncWarning =
            response.data.google_calendar_sync.message ||
            "The event was saved, but Google Calendar sync failed.";
        }
      }

      setModalOpen(false);
      setEditingId(null);
      setImageFile(null);
      setForm({ ...EMPTY_FORM });

      await fetchEvents();
      if (calendarSyncWarning) {
        setError(calendarSyncWarning);
      }
    } catch (err) {
      setError(
        responseMessage(
          err,
          "Unable to save the event. Please check the backend response."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(event) {
    const confirmed = window.confirm(
      `Delete "${event.title}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      const response = await axios.delete(
        `${EVENTS_API}/${event.event_id}`,
        { headers: getHeaders() }
      );

      notifySuccess(response.data?.message || "Event deleted successfully.");
      await fetchEvents();

      if (response.data?.google_calendar_sync?.success === false) {
        setError(
          response.data.google_calendar_sync.message ||
          "The event was deleted, but Google Calendar sync failed."
        );
      }
    } catch (err) {
      setError(
        responseMessage(
          err,
          "Unable to delete this event. It may have related registrations."
        )
      );
    }
  }

  async function handleCalendarSync() {
    setError("");
    setNotice("");
    setSyncingCalendar(true);

    try {
      const response = await axios.post(
        GOOGLE_CALENDAR_SYNC_API,
        {},
        { headers: getHeaders() }
      );
      const syncedCount = Number(response.data?.synced_count || 0);
      const failedCount = Number(response.data?.failed_count || 0);
      const firstFailure = response.data?.results?.find(
        (result) => !result.success
      );

      await fetchEvents();

      notifySuccess(
        `Google Calendar sync complete: ${syncedCount} synced, ${failedCount} failed.`
      );

      if (firstFailure) {
        setError(
          `Event #${firstFailure.event_id}: ${firstFailure.message}`
        );
      }
    } catch (err) {
      setError(
        responseMessage(
          err,
          "Unable to sync events to Google Calendar. Check the backend configuration."
        )
      );
    } finally {
      setSyncingCalendar(false);
    }
  }

  if (!isDepartmentAdmin) {
    return (
      <div className="bsed-access-denied">
        <h2>{departmentCode} Admin Access Required</h2>
        <p>
          Please sign in using an active {departmentCode} Admin account
          assigned to {departmentName}.
        </p>
        {error && <p className="bsed-alert error">{error}</p>}
        <button
          type="button"
          onClick={() => navigate("/login", { replace: true })}
        >
          Return to Login
        </button>
      </div>
    );
  }

  return (
    <div className="bsed-layout">
      <AdminSidebar
        navigate={navigate}
        departmentCode={departmentCode}
        departmentName={departmentName}
        route={route}
        activeSection={activeSection}
        fullNavigation={fullNavigation}
      />

      <main className="bsed-main">
        <header className="bsed-topbar">
          <div>
            <span className="bsed-breadcrumb">
              {departmentCode} Admin / {activeSection}
            </span>
            <h1>
              {activeSection === "dashboard"
                ? `${departmentCode} Dashboard`
                : activeSection === "fines"
                  ? `${departmentCode} Fines`
                  : activeSection === "attendance"
                  ? `${departmentCode} Attendance`
                  : activeSection === "profile"
                    ? "Admin Profile"
                    : `${departmentCode} Events`}
            </h1>
          </div>

          <div className="bsed-topbar-user">
            <div className="bsed-avatar">{departmentCode}</div>
            <div>
              <strong>{departmentCode} Admin</strong>
              <span>Department Administrator</span>
            </div>
          </div>
        </header>

        <section className="bsed-content">
          <div className="bsed-page-heading">
            <div>
              <h2>
                {activeSection === "dashboard"
                  ? "Dashboard Overview"
                  : activeSection === "fines"
                    ? "Fines Monitoring"
                    : activeSection === "attendance"
                    ? "Attendance Records"
                    : activeSection === "profile"
                      ? "Admin Profile"
                      : "Event Management"}
              </h2>
              <p>
                {activeSection === "fines"
                  ? `Review unpaid attendance fines for ${departmentName}.`
                  : activeSection === "attendance"
                  ? `Review attendance for ${departmentName} events.`
                  : activeSection === "profile"
                    ? "View your administrator account information."
                    : activeSection === "dashboard"
                      ? `Manage ${departmentName} events and view the calendar.`
                      : `Create and manage events assigned to ${departmentName}.`}
              </p>
            </div>

            {activeSection === "events" ? (
              <div className="bsed-page-actions">
                <button
                  type="button"
                  className="bsed-secondary-button"
                  onClick={handleCalendarSync}
                  disabled={syncingCalendar || loading}
                >
                  {syncingCalendar ? "Syncing..." : "Sync Calendar"}
                </button>

                <button
                  type="button"
                  className="bsed-primary-button"
                  onClick={openAddModal}
                >
                  <span>＋</span> Add Event
                </button>
              </div>
            ) : activeSection === "dashboard" ? (
              <button
                type="button"
                className="bsed-primary-button"
                onClick={() => navigate(`${route}/events`)}
              >
                Manage Events
              </button>
            ) : null}
          </div>

          {error && (
            <div className="bsed-alert error" role="alert">
              {error}
              <button
                type="button"
                onClick={() => setError("")}
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          )}

          {notice && (
            <div className="bsed-alert success" role="status">
              {notice}
              <button
                type="button"
                onClick={() => setNotice("")}
                aria-label="Dismiss notice"
              >
                ×
              </button>
            </div>
          )}

          {["attendance", "fines"].includes(activeSection) ? (
            <section className="bsed-panel">
              <div className="bsed-panel-heading">
                <div>
                  <h3>{activeSection === "fines" ? "Fines Monitoring" : "Attendance Records"}</h3>
                  <p>
                    {filteredAttendanceRecords.length}{" "}
                    {activeSection === "fines"
                      ? `fine(s) · ₱${filteredAttendanceRecords.reduce((total, record) => total + Number(record.fine_amount || 0), 0).toFixed(2)} total`
                      : attendanceEventId ? "attendee(s)" : "record(s)"}
                    {attendanceEventId
                      ? ` for ${events.find((event) => String(event.event_id) === attendanceEventId)?.title || `event #${attendanceEventId}`}`
                      : ` for ${departmentCode}`}
                  </p>
                </div>
                <button
                  type="button"
                  className="bsed-secondary-button"
                  onClick={fetchAttendance}
                  disabled={attendanceLoading}
                >
                  {attendanceLoading ? "Refreshing..." : "↻ Refresh"}
                </button>
              </div>

              <div className="attendance-filter-toolbar">
                <label>
                  Event
                  <select
                    value={attendanceEventId}
                    onChange={(event) => {
                      const query = event.target.value
                        ? `?event_id=${encodeURIComponent(event.target.value)}${activeSection === "attendance" ? "&status=attended" : ""}`
                        : "";
                      navigate(`${route}/${activeSection}${query}`);
                    }}
                    disabled={attendanceLoading}
                  >
                    <option value="">All events</option>
                    {events.map((event) => (
                      <option key={event.event_id} value={event.event_id}>
                        {event.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Year level
                  <select
                    value={attendanceYearFilter}
                    onChange={(event) => {
                      setAttendanceYearFilter(event.target.value);
                      setAttendanceSectionFilter("");
                    }}
                    disabled={attendanceLoading}
                  >
                    <option value="">All year levels</option>
                    {attendanceYearOptions.map(([yearId, yearName]) => (
                      <option key={yearId} value={yearId}>{yearName}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Section
                  <select
                    value={attendanceSectionFilter}
                    onChange={(event) =>
                      setAttendanceSectionFilter(event.target.value)
                    }
                    disabled={attendanceLoading}
                  >
                    <option value="">All sections</option>
                    {attendanceSectionOptions.map(([sectionId, sectionName]) => (
                      <option key={sectionId} value={sectionId}>{sectionName}</option>
                    ))}
                  </select>
                </label>
                {attendanceEventId && (
                  <button
                    type="button"
                    onClick={() => navigate(`${route}/${activeSection}`)}
                  >
                    {activeSection === "fines" ? "All department fines" : "All event attendance"}
                  </button>
                )}
              </div>

              {attendanceError && (
                <div className="bsed-alert error" role="alert">
                  {attendanceError}
                </div>
              )}

              <div className="bsed-table-wrap">
                <table className="bsed-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Student Department</th>
                      <th>Event</th>
                      <th>Year / Section</th>
                      <th>Status</th>
                      {activeSection === "fines" && <><th>Fine</th><th>Fined At</th></>}
                      <th>Scanned At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceLoading ? (
                      <tr>
                        <td colSpan={activeSection === "fines" ? 8 : 6} className="bsed-empty">
                          Loading attendance records...
                        </td>
                      </tr>
                    ) : filteredAttendanceRecords.length === 0 ? (
                      <tr>
                        <td colSpan={activeSection === "fines" ? 8 : 6} className="bsed-empty">
                          {activeSection === "fines"
                            ? "No fines are due for the selected event and filters."
                            : attendanceEventId
                            ? "No attendees found for this event."
                            : `No attendance records found for ${departmentCode}.`}
                        </td>
                      </tr>
                    ) : (
                      filteredAttendanceRecords.map((record) => (
                        <tr key={record.event_reg_id}>
                          <td>
                            <strong>{record.full_name || "Student"}</strong>
                            <span className="bsed-table-secondary">
                              {record.student_no || record.email || "—"}
                            </span>
                          </td>
                          <td>{record.dept_name || "Unassigned"}</td>
                          <td>{record.event_title || "—"}</td>
                          <td>
                            {[record.yr_name, record.section_name]
                              .filter(Boolean)
                              .join(" / ") || "—"}
                          </td>
                          <td>
                            <span
                              className={`bsed-status ${record.attendance_status}`}
                            >
                              {String(record.attendance_status || "unknown")
                                .replace("_", " ")}
                            </span>
                          </td>
                          {activeSection === "fines" && (
                            <>
                              <td>₱{Number(record.fine_amount || 0).toFixed(2)}<small className="bsed-table-secondary">Unpaid</small></td>
                              <td>{formatDate(record.fined_at || record.start_datetime)}</td>
                            </>
                          )}
                          <td>{formatDate(record.scanned_at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : activeSection === "profile" ? (
            <section className="bsed-panel bsed-profile-panel">
              <div className="bsed-profile-avatar">
                {String(user?.full_name || departmentCode)
                  .split(/\s+/)
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div className="bsed-profile-details">
                <h3>{user?.full_name || `${departmentCode} Administrator`}</h3>
                <p>Department Administrator</p>
                <dl>
                  <div>
                    <dt>Email</dt>
                    <dd>{user?.email || "—"}</dd>
                  </div>
                  <div>
                    <dt>Department</dt>
                    <dd>{departmentName}</dd>
                  </div>
                  <div>
                    <dt>Account status</dt>
                    <dd>{user?.status || "Active"}</dd>
                  </div>
                </dl>
              </div>
            </section>
          ) : (
            <>
          <div className="bsed-stat-grid">
            <div className="bsed-stat-card">
              <span>Total {departmentCode} Events</span>
              <strong>{stats.total}</strong>
              <small>Events in the database</small>
            </div>
            <div className="bsed-stat-card">
              <span>Upcoming</span>
              <strong>{stats.upcoming}</strong>
              <small>Scheduled events</small>
            </div>
            <div className="bsed-stat-card">
              <span>Ongoing</span>
              <strong>{stats.ongoing}</strong>
              <small>Currently in progress</small>
            </div>
            <div className="bsed-stat-card">
              <span>Completed</span>
              <strong>{stats.completed}</strong>
              <small>Finished events</small>
            </div>
          </div>

          <section className="bsed-panel bsed-calendar-panel">
            <div className="bsed-panel-heading">
              <div>
                <h3>{departmentCode} Events Calendar</h3>
                <p>
                  Events saved here are automatically synced to Google
                  Calendar.
                </p>
              </div>

              <div className="bsed-calendar-controls">
                <button
                  type="button"
                  className="bsed-secondary-button"
                  onClick={() =>
                    setCalendarMonth(
                      (month) =>
                        new Date(
                          month.getFullYear(),
                          month.getMonth() - 1,
                          1
                        )
                    )
                  }
                  aria-label="Previous month"
                >
                  ‹
                </button>
                <strong>
                  {calendarMonth.toLocaleDateString("en-PH", {
                    month: "long",
                    year: "numeric",
                  })}
                </strong>
                <button
                  type="button"
                  className="bsed-secondary-button"
                  onClick={() =>
                    setCalendarMonth(
                      (month) =>
                        new Date(
                          month.getFullYear(),
                          month.getMonth() + 1,
                          1
                        )
                    )
                  }
                  aria-label="Next month"
                >
                  ›
                </button>
                <button
                  type="button"
                  className="bsed-secondary-button"
                  onClick={() =>
                    setCalendarMonth(
                      new Date(
                        new Date().getFullYear(),
                        new Date().getMonth(),
                        1
                      )
                    )
                  }
                >
                  Today
                </button>
              </div>
            </div>

            <div className="bsed-calendar-scroll">
              <div className="bsed-calendar-grid">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (weekday) => (
                    <div
                      className="bsed-calendar-weekday"
                      key={weekday}
                    >
                      {weekday}
                    </div>
                  )
                )}

                {calendarDays.map(({ date, dateKey, inMonth }) => {
                  const dayEvents = calendarEventsByDate[dateKey] || [];
                  const isToday =
                    dateKey ===
                    [
                      new Date().getFullYear(),
                      String(new Date().getMonth() + 1).padStart(2, "0"),
                      String(new Date().getDate()).padStart(2, "0"),
                    ].join("-");

                  return (
                    <div
                      className={[
                        "bsed-calendar-day",
                        inMonth ? "" : "outside-month",
                        isToday ? "today" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={dateKey}
                    >
                      <span className="bsed-calendar-date">
                        {date.getDate()}
                      </span>
                      <div className="bsed-calendar-day-events">
                        {dayEvents.map((event) => (
                          <button
                            type="button"
                            className={`bsed-calendar-event ${event.status}`}
                            key={event.event_id}
                            onClick={() => openEditModal(event)}
                            title={`${event.title} — ${formatDate(
                              event.start_datetime
                            )}`}
                          >
                            <span>{event.title}</span>
                            <small>
                              {new Date(
                                String(event.start_datetime).replace(" ", "T")
                              ).toLocaleTimeString("en-PH", {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </small>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {activeSection === "events" && (
          <section className="bsed-panel">
            <div className="bsed-panel-heading">
              <div>
                <h3>All {departmentCode} Events</h3>
                <p>Records retrieved from your database.</p>
              </div>

              <button
                type="button"
                className="bsed-secondary-button"
                onClick={fetchEvents}
                disabled={loading}
              >
                ↻ Refresh
              </button>
            </div>

            <div className="bsed-toolbar">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, venue, category..."
                aria-label="Search events"
              />

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="bsed-table-wrap">
              <table className="bsed-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Category</th>
                    <th>Venue</th>
                    <th>Schedule</th>
                    <th>Status</th>
                    <th>Approval</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="bsed-empty">
                        Loading events from database...
                      </td>
                    </tr>
                  ) : filteredEvents.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="bsed-empty">
                        {events.length === 0
                          ? `No ${departmentCode} events have been saved yet. Select Add Event to create your first event.`
                          : "No events match your search or status filter."}
                      </td>
                    </tr>
                  ) : (
                    filteredEvents.map((event) => (
                      <tr key={event.event_id}>
                        <td>
                          <div className="bsed-event-cell">
                            {event.image ? (
                              <img
                                src={event.image}
                                alt=""
                                className="bsed-event-image"
                              />
                            ) : (
                              <div className="bsed-event-placeholder">
                                ▦
                              </div>
                            )}

                            <div>
                              <strong>{event.title}</strong>
                              {event.org_id && (
                                <span>
                                  {organizations.find(
                                    (organization) =>
                                      Number(organization.org_id) === Number(event.org_id)
                                  )?.org_name || "Organization event"}
                                </span>
                              )}
                              <span>
                                ID: {event.event_id}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          {event.category_name ||
                            CATEGORIES.find(
                              (category) =>
                                Number(category.category_id) ===
                                Number(event.category_id)
                            )?.category_name ||
                            `Category ${event.category_id}`}
                        </td>

                        <td>{event.venue}</td>

                        <td>
                          <div className="bsed-schedule">
                            <span>{formatDate(event.start_datetime)}</span>
                            <small>
                              to {formatDate(event.end_datetime)}
                            </small>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`bsed-status ${event.status}`}
                          >
                            {event.status}
                          </span>
                        </td>

                        <td>
                          <span className={`bsed-status ${event.approval_status || "approved"}`}>
                            {event.approval_status || "approved"}
                          </span>
                        </td>

                        <td>
                          <div className="bsed-actions">
                            <button
                              type="button"
                              className="bsed-edit-button"
                              onClick={() =>
                                navigate(
                                  `${route}/attendance?event_id=${encodeURIComponent(event.event_id)}&status=attended`
                                )
                              }
                            >
                              Attendance
                            </button>
                            <button
                              type="button"
                              className="bsed-edit-button"
                              onClick={() =>
                                navigate(
                                  `${route}/fines?event_id=${encodeURIComponent(event.event_id)}`
                                )
                              }
                            >
                              Fines
                            </button>
                            <button
                              type="button"
                              className="bsed-edit-button"
                              onClick={() => openEditModal(event)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="bsed-delete-button"
                              onClick={() => handleDelete(event)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="bsed-table-footer">
              Showing {filteredEvents.length} of {events.length} {departmentCode} events
            </div>
          </section>
          )}
            </>
          )}
        </section>
      </main>

      {modalOpen && (
        <div
          className="bsed-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <section
            className="bsed-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bsed-modal-title"
          >
            <div className="bsed-modal-heading">
              <div>
                <h2 id="bsed-modal-title">
                  {editingId ? "Edit Event" : `Create ${departmentCode} Event`}
                </h2>
                <p>
                  Fields marked with * are required.
                </p>
              </div>

              <button
                type="button"
                className="bsed-modal-close"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="bsed-form-grid">
                <label className="bsed-field full">
                  Event Title *
                  <input
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    maxLength={255}
                    required
                  />
                </label>

                <label className="bsed-field">
                  Category *
                  <select
                    name="category_id"
                    value={form.category_id}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select category</option>
                    {CATEGORIES.map((category) => (
                      <option
                        key={category.category_id}
                        value={category.category_id}
                      >
                        {category.category_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="bsed-field">
                  Organization
                  <select
                    name="org_id"
                    value={form.org_id}
                    onChange={handleChange}
                  >
                    <option value="">Department event</option>
                    {organizations.filter((organization) => organization.status === "active").map((organization) => (
                      <option key={organization.org_id} value={organization.org_id}>
                        {organization.org_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="bsed-field">
                  Status *
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    required
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() +
                          status.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="bsed-field full">
                  Description *
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    rows={4}
                    required
                  />
                </label>

                <label className="bsed-field full">
                  Venue *
                  <input
                    name="venue"
                    value={form.venue}
                    onChange={handleChange}
                    maxLength={255}
                    required
                  />
                </label>

                {!editingId && (
                  <EventImageUpload
                    className="bsed-field full"
                    file={imageFile}
                    onChange={setImageFile}
                    disabled={saving}
                  />
                )}

                <label className="bsed-field">
                  Start Date & Time *
                  <input
                    type="datetime-local"
                    lang="en-US"
                    name="start_datetime"
                    value={form.start_datetime}
                    onChange={handleChange}
                    required
                  />
                </label>

                <label className="bsed-field">
                  End Date & Time *
                  <input
                    type="datetime-local"
                    lang="en-US"
                    name="end_datetime"
                    value={form.end_datetime}
                    onChange={handleChange}
                    min={form.start_datetime || undefined}
                    required
                  />
                </label>
              </div>

              {error && (
                <div className="bsed-alert error">{error}</div>
              )}

              <div className="bsed-modal-actions">
                <button
                  type="button"
                  className="bsed-secondary-button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="bsed-primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Save Changes"
                      : "Create Event"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
