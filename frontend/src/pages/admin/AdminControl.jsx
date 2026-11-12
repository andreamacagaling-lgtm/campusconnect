import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../api";
import { confirmLogout } from "../../authSession";
import EventImageUpload from "./EventImageUpload";
import ResponsiveSidebarToggle from "../../components/ResponsiveSidebarToggle";
import { notifySuccess } from "../../notifications";
import "./AdminControl.css";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/admin/dashboard", icon: "⌂" },
  { label: "Announcements", path: "/admin/announcements", icon: "▤" },
  { label: "Events", path: "/admin/events", icon: "▦" },
  { label: "Attendance", path: "/admin/attendance", icon: "✓" },
  { label: "Fines Monitoring", path: "/admin/fines", icon: "₱" },
  { label: "QR Scanner", path: "/admin/scanner", icon: "▣" },
  { label: "Admin Profile", path: "/admin/profile", icon: "◎" },
];

function getToken() {
  return (
    localStorage.getItem("campusconnect_token") ||
    sessionStorage.getItem("campusconnect_token")
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

function getRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.events)) return payload.events;
  return [];
}

function getRequestErrorMessage(error) {
  const message =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "Request failed.";
  const status = error?.response?.status;
  return status ? `${message} (HTTP ${status})` : message;
}

function displayDate(value) {
  if (!value) return "—";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
  });
}

function getEventActivityTime(event) {
  const activityDate =
    event.approval_status === "approved" && event.reviewed_at
      ? event.reviewed_at
      : event.created_at || event.start_datetime;
  const timestamp = new Date(String(activityDate || "").replace(" ", "T")).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function sortEventsByRecentActivity(rows) {
  return [...rows].sort(
    (left, right) => getEventActivityTime(right) - getEventActivityTime(left)
  );
}

function displayPhilippineDate(value) {
  if (!value) return "—";

  const timestamp = Number(value);
  if (
    (typeof value === "number" || /^\d+(?:\.\d+)?$/.test(String(value))) &&
    Number.isFinite(timestamp)
  ) {
    return new Date(timestamp * 1000).toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      dateStyle: "medium",
      timeStyle: "short",
      hour12: true,
    });
  }

  const dateValue = String(value).trim();
  const normalized = dateValue.includes("T")
    ? dateValue
    : dateValue.replace(" ", "T");
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized);
  const date = new Date(hasTimezone ? normalized : `${normalized}+08:00`);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
  });
}

function parseEventDate(value) {
  if (!value) return null;
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function CalendarView({ events }) {
  const today = new Date();
  const [visibleMonth, setVisibleMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(startOfDay(today));
  const firstDay = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth(),
    1
  );
  const gridStart = new Date(
    firstDay.getFullYear(),
    firstDay.getMonth(),
    firstDay.getDay() * -1
  );
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
  const eventsForDate = (date) =>
    events
      .filter((event) => {
        const start = parseEventDate(event.start_datetime);
        const end = parseEventDate(event.end_datetime) || start;
        if (!start || !end) return false;
        const day = startOfDay(date).getTime();
        return (
          startOfDay(start).getTime() <= day &&
          startOfDay(end).getTime() >= day
        );
      })
      .sort(
        (a, b) =>
          (parseEventDate(a.start_datetime)?.getTime() || 0) -
          (parseEventDate(b.start_datetime)?.getTime() || 0)
      );
  const selectedEvents = eventsForDate(selectedDate);

  function changeMonth(offset) {
    const nextMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + offset,
      1
    );
    setVisibleMonth(nextMonth);
    setSelectedDate(nextMonth);
  }

  function showToday() {
    const currentDate = new Date();
    setVisibleMonth(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
    setSelectedDate(startOfDay(currentDate));
  }

  return (
    <div className="control-calendar-layout">
      <section className="control-panel control-calendar">
        <div className="control-calendar-heading">
          <div>
            <h2>Campus events calendar</h2>
            <p>Events across the university, including their approval status.</p>
          </div>
          <div className="control-calendar-controls">
            <button type="button" onClick={showToday}>Today</button>
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => changeMonth(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => changeMonth(1)}
            >
              ›
            </button>
          </div>
        </div>
        <h3 className="control-calendar-month">
          {visibleMonth.toLocaleDateString("en-PH", {
            month: "long",
            year: "numeric",
          })}
        </h3>
        <div className="control-calendar-grid" role="grid" aria-label="Events calendar">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div className="control-calendar-weekday" role="columnheader" key={day}>
              {day}
            </div>
          ))}
          {calendarDays.map((date) => {
            const dateEvents = eventsForDate(date);
            const isCurrentMonth = date.getMonth() === visibleMonth.getMonth();
            const isSelected = getDateKey(date) === getDateKey(selectedDate);
            const isToday = getDateKey(date) === getDateKey(today);

            return (
              <button
                type="button"
                className={[
                  "control-calendar-day",
                  !isCurrentMonth && "outside-month",
                  isSelected && "selected",
                  isToday && "today",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={getDateKey(date)}
                onClick={() => setSelectedDate(startOfDay(date))}
                aria-pressed={isSelected}
                aria-label={`${date.toLocaleDateString("en-PH", {
                  dateStyle: "full",
                })}, ${dateEvents.length} event(s)`}
              >
                <span className="control-calendar-day-number">{date.getDate()}</span>
                {dateEvents.slice(0, 2).map((event) => (
                  <span className="control-calendar-event" key={event.event_id}>
                    {event.title}
                  </span>
                ))}
                {dateEvents.length > 2 && (
                  <span className="control-calendar-more">
                    +{dateEvents.length - 2} more
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <aside className="control-panel control-calendar-agenda">
        <div className="control-calendar-agenda-heading">
          <h2>
            {selectedDate.toLocaleDateString("en-PH", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </h2>
          <p>{selectedEvents.length} event(s)</p>
        </div>
        {selectedEvents.length === 0 ? (
          <p className="control-empty">No events scheduled for this day.</p>
        ) : (
          <div className="control-calendar-agenda-list">
            {selectedEvents.map((event) => {
              const status = String(event.approval_status || "approved")
                .toLowerCase()
                .replace(/[^a-z0-9-]/g, "-");
              return (
                <article className="control-calendar-agenda-event" key={event.event_id}>
                  <span className={`control-calendar-status ${status}`}>
                    {event.approval_status || "approved"}
                  </span>
                  <h3>{event.title}</h3>
                  <p>{displayDate(event.start_datetime)}</p>
                  <p>{event.venue || "Venue not specified"}</p>
                  {event.status && (
                    <small>Event status: {event.status}</small>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </aside>
    </div>
  );
}

function AdminSidebar({ activePage, user, navigate, onNavigate }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function logout() {
    if (!confirmLogout()) return;

    localStorage.removeItem("campusconnect_token");
    localStorage.removeItem("campusconnect_user");
    sessionStorage.removeItem("campusconnect_token");
    sessionStorage.removeItem("campusconnect_user");
    navigate("/login", { replace: true });
  }

  return (
    <aside
      className={`control-sidebar responsive-sidebar ${
        mobileMenuOpen ? "responsive-sidebar-open" : ""
      }`}
    >
      <div className="control-brand responsive-sidebar-brand">
        <img className="control-brand-mark" src="/images/msu-seal.png" alt="" />
        <span>
          <strong>CampusConnect</strong>
          <small>UNIVERSITY STUDENT ADMIN</small>
        </span>
        <ResponsiveSidebarToggle
          isOpen={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((open) => !open)}
        />
      </div>

      <p className="control-nav-label responsive-sidebar-label">FULL CONTROL</p>
      <nav
        className="control-nav responsive-sidebar-nav"
        aria-label="Admin navigation"
        onClick={() => setMobileMenuOpen(false)}
      >
        {NAV_ITEMS.map((item) => (
          <button
            type="button"
            className={`control-nav-link ${activePage === item.label ? "active" : ""}`}
            key={item.path}
            onClick={() => onNavigate(item.path)}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="control-sidebar-bottom responsive-sidebar-bottom">
        <div className="control-account">
          <span className="control-avatar">
            {(user?.full_name || "A").charAt(0).toUpperCase()}
            {user?.avatar_url && (
              <img
                src={user.avatar_url}
                alt=""
                onError={(event) => {
                  event.currentTarget.hidden = true;
                }}
              />
            )}
          </span>
          <span>
            <strong>{user?.full_name || "Administrator"}</strong>
            <small>University student administrator</small>
          </span>
        </div>
        <button type="button" className="control-logout" onClick={logout}>
          ↪ Log out
        </button>
      </div>
    </aside>
  );
}

export default function AdminControl() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const user = useMemo(() => getUser(), []);
  const [adminProfile, setAdminProfile] = useState(user);
  const [profileForm, setProfileForm] = useState({
    full_name: user?.full_name || "",
    email: user?.email || "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingProfilePhoto, setUploadingProfilePhoto] = useState(false);
  const [profileNotice, setProfileNotice] = useState("");
  const [profileError, setProfileError] = useState("");
  const [counts, setCounts] = useState({
    events: null,
    announcements: null,
  });
  const [events, setEvents] = useState([]);
  const [eventView, setEventView] = useState("list");
  const [attendance, setAttendance] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [attendanceDepartmentId, setAttendanceDepartmentId] = useState("");
  const [attendanceYearId, setAttendanceYearId] = useState("");
  const [attendanceSectionId, setAttendanceSectionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [submittingEvent, setSubmittingEvent] = useState(false);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [eventImageFile, setEventImageFile] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [eventForm, setEventForm] = useState({
    category_id: "",
    title: "",
    description: "",
    venue: "",
    start_datetime: "",
    end_datetime: "",
  });

  const section = pathname.replace(/\/+$/, "").split("/").pop() || "dashboard";
  const attendanceQuery = new URLSearchParams(search);
  const attendanceEventId = attendanceQuery.get("event_id") || "";
  const attendanceStatus =
    attendanceQuery.get("status") || (section === "fines" ? "fined" : "");
  const updateAttendanceQuery = (key, value) => {
    const query = new URLSearchParams(search);
    if (value) {
      query.set(key, value);
    } else {
      query.delete(key);
    }
    const queryString = query.toString();
    navigate(`/admin/${section}${queryString ? `?${queryString}` : ""}`);
  };
  const activePage =
    section === "attendance"
      ? "Attendance"
      : section === "fines"
        ? "Fines Monitoring"
        : section === "profile"
          ? "Admin Profile"
          : section === "events"
            ? "Events"
            : "Dashboard";

  const attendanceYearOptions = useMemo(() => {
    const years = new Map();
    attendance.forEach((record) => {
      if (record.yr_id !== null && record.yr_id !== "") {
        years.set(String(record.yr_id), record.yr_name || "Year level");
      }
    });
    return [...years.entries()].sort((left, right) =>
      left[1].localeCompare(right[1], undefined, { numeric: true })
    );
  }, [attendance]);

  const attendanceSectionOptions = useMemo(() => {
    const sections = new Map();
    attendance.forEach((record) => {
      if (
        record.section_id !== null &&
        record.section_id !== "" &&
        (!attendanceYearId ||
          String(record.yr_id) === attendanceYearId)
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
  }, [attendance, attendanceYearId]);

  const filteredAttendance = useMemo(
    () =>
      attendance.filter(
        (record) =>
          (!attendanceYearId ||
            String(record.yr_id) === attendanceYearId) &&
          (!attendanceSectionId ||
            String(record.section_id) === attendanceSectionId)
      ),
    [attendance, attendanceSectionId, attendanceYearId]
  );
  const attendanceFineTotal = useMemo(
    () =>
      filteredAttendance.reduce(
        (total, record) => total + Number(record.fine_amount || 0),
        0
      ),
    [filteredAttendance]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    const token = getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      if (section === "attendance" || section === "fines") {
        const [response, departmentsResponse, eventsResponse] = await Promise.all([
          api.get("/attendance", {
            headers,
            params: {
              ...(attendanceDepartmentId
                ? { dept_id: attendanceDepartmentId }
                : {}),
              ...(attendanceEventId ? { event_id: attendanceEventId } : {}),
              ...(attendanceStatus ? { status: attendanceStatus } : {}),
            },
          }),
          api.get("/auth/departments", { headers }),
          api.get("/events", { headers }),
        ]);
        const rows = response.data?.data;
        const departmentRows = departmentsResponse.data?.data;
        const eventRows = getRows(eventsResponse.data);
        if (
          !Array.isArray(rows) ||
          !Array.isArray(departmentRows) ||
          !Array.isArray(eventRows)
        ) {
          throw new Error(
            "Attendance records, event records, or department options were not returned by the server."
          );
        }
        setAttendance(rows);
        setDepartments(departmentRows);
        setEvents(sortEventsByRecentActivity(eventRows));
      } else {
        const [eventsResult, announcementsResult] = await Promise.allSettled([
          api.get("/events", { headers }),
          api.get("/announcements", { headers }),
        ]);

        const failures = [];
        const eventRows =
          eventsResult.status === "fulfilled"
            ? getRows(eventsResult.value.data)
            : (failures.push("events"), []);
        const announcementRows =
          announcementsResult.status === "fulfilled"
            ? getRows(announcementsResult.value.data)
            : (failures.push("announcements"), []);
        if (
          eventsResult.status === "rejected" &&
          eventsResult.reason.response?.status === 401
        ) {
          localStorage.removeItem("campusconnect_token");
          sessionStorage.removeItem("campusconnect_token");
          navigate("/login", { replace: true });
          return;
        }

        const sortedEvents = sortEventsByRecentActivity(eventRows);
        setEvents(sortedEvents);
        setCounts({
          events: eventsResult.status === "fulfilled" ? sortedEvents.length : null,
          announcements:
            announcementsResult.status === "fulfilled"
              ? announcementRows.length
              : null,
        });

        if (failures.length) {
          const failureDetails = [
            ["events", eventsResult],
            ["announcements", announcementsResult],
          ]
            .filter(([, result]) => result.status === "rejected")
            .map(
              ([name, result]) =>
                `${name}: ${getRequestErrorMessage(result.reason)}`
            );
          setError(`Could not load summary data — ${failureDetails.join("; ")}`);
        }
      }
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        localStorage.removeItem("campusconnect_token");
        sessionStorage.removeItem("campusconnect_token");
        navigate("/login", { replace: true });
        return;
      }
      setError(getRequestErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [
    attendanceDepartmentId,
    attendanceEventId,
    attendanceStatus,
    navigate,
    section,
  ]);

  useEffect(() => {
    if (!getToken()) {
      navigate("/login", { replace: true });
      return;
    }

    if (section === "profile") {
      let active = true;
      api.get("/admin/profile")
        .then((response) => {
          const currentProfile = response.data?.user;
          if (!currentProfile) {
            throw new Error("The administrator profile was not returned by the server.");
          }
          if (active) {
            setAdminProfile(currentProfile);
            setProfileForm({
              full_name: currentProfile.full_name || "",
              email: currentProfile.email || "",
            });
          }
        })
        .catch((requestError) => {
          if (active) setProfileError(getRequestErrorMessage(requestError));
          if (requestError.response?.status === 401) {
            localStorage.removeItem("campusconnect_token");
            sessionStorage.removeItem("campusconnect_token");
            navigate("/login", { replace: true });
          }
        });
      return () => {
        active = false;
      };
    }

    if (
      section === "dashboard" ||
      section === "events" ||
      section === "attendance" ||
      section === "fines"
    ) {
      void Promise.resolve().then(loadData);
    }
  }, [loadData, navigate, section]);

  useEffect(() => {
    if (!eventFormOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !submittingEvent) {
        setEventFormOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [eventFormOpen, submittingEvent]);

  if (
    !user ||
    user.role !== "admin" ||
    user.admin_type !== "usg" ||
    (user.dept_id !== null && user.dept_id !== "")
  ) {
    return (
      <main className="control-denied">
        <section>
          <h1>University admin access required</h1>
          <p>
            This dashboard is for an active admin account without a department
            assignment. Department admins should use their department portal.
          </p>
          <button type="button" onClick={() => navigate("/login", { replace: true })}>
            Return to sign in
          </button>
        </section>
      </main>
    );
  }

  async function submitCampusEvent(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSubmittingEvent(true);

    try {
      const token = getToken();
      const payload = new FormData();
      Object.entries({
        ...eventForm,
        category_id: Number(eventForm.category_id),
        start_datetime: eventForm.start_datetime.replace("T", " "),
        end_datetime: eventForm.end_datetime.replace("T", " "),
      }).forEach(([key, value]) => {
        payload.append(key, value);
      });
      if (eventImageFile) {
        payload.append("image_file", eventImageFile);
      }

      const response = await api.post(
        "/events",
        payload,
        {
          headers: token
            ? {
                Authorization: "Bearer " + token,
                "Content-Type": "multipart/form-data",
              }
            : { "Content-Type": "multipart/form-data" },
        }
      );

      notifySuccess(
        response.data?.message || "Campus event submitted to OSSE for approval."
      );
      setEventForm({
        category_id: "",
        title: "",
        description: "",
        venue: "",
        start_datetime: "",
        end_datetime: "",
      });
      setEventImageFile(null);
      setEventFormOpen(false);
      await loadData();
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError));
    } finally {
      setSubmittingEvent(false);
    }
  }

  function persistAdminProfile(updatedUser) {
    setAdminProfile(updatedUser);
    setProfileForm({
      full_name: updatedUser.full_name || "",
      email: updatedUser.email || "",
    });
    const storage = localStorage.getItem("campusconnect_user")
      ? localStorage
      : sessionStorage;
    storage.setItem("campusconnect_user", JSON.stringify(updatedUser));
  }

  async function saveAdminProfile(event) {
    event.preventDefault();
    setProfileError("");
    setProfileNotice("");
    setSavingProfile(true);
    try {
      const response = await api.put("/admin/profile", profileForm);
      if (!response.data?.user) {
        throw new Error("The updated administrator profile was not returned by the server.");
      }
      persistAdminProfile(response.data.user);
      notifySuccess(response.data.message || "Profile updated successfully.");
    } catch (requestError) {
      setProfileError(getRequestErrorMessage(requestError));
    } finally {
      setSavingProfile(false);
    }
  }

  async function uploadAdminProfilePhoto(event) {
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
    setUploadingProfilePhoto(true);
    try {
      const response = await api.post("/admin/profile/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (!response.data?.user) {
        throw new Error("The updated profile photo was not returned by the server.");
      }
      persistAdminProfile(response.data.user);
      notifySuccess(
        response.data.message || "Profile photo updated successfully."
      );
    } catch (requestError) {
      setProfileError(getRequestErrorMessage(requestError));
    } finally {
      setUploadingProfilePhoto(false);
      input.value = "";
    }
  }

  return (
    <div className="control-layout">
      <AdminSidebar
        activePage={activePage}
        user={adminProfile}
        navigate={navigate}
        onNavigate={(path) => {
          setEventFormOpen(false);
          navigate(path);
        }}
      />
      <main className="control-main">
        <header className="control-topbar">
          <div>
            <span>CampusConnect / University Admin</span>
            <h1>{activePage}</h1>
          </div>
          <span className="control-admin-badge">Full-control admin</span>
        </header>

        <section className="control-content">
          {error && !(section === "events" && eventFormOpen) && (
            <div className="control-alert" role="alert">{error}</div>
          )}
          {notice && <div className="control-notice" role="status">{notice}</div>}

          {section === "dashboard" && (
            <>
              <div className="control-welcome">
                <div>
                  <p className="control-eyebrow">UNIVERSITY ADMINISTRATION</p>
                  <h2>Welcome, {adminProfile?.full_name || "Administrator"}</h2>
                  <p>Manage campus announcements, events, and attendance.</p>
                </div>
                <span aria-hidden="true">⌂</span>
              </div>

              <div className="control-stat-grid">
                {[
                  ["Events", counts.events, "/admin/events", "▦"],
                  ["Announcements", counts.announcements, "/admin/announcements", "▤"],
                ].map(([label, count, path, icon]) => (
                  <button
                    type="button"
                    className="control-stat-card"
                    key={label}
                    onClick={() => navigate(path)}
                  >
                    <span>{icon}</span>
                    <small>{label}</small>
                    <strong>{loading && count === null ? "…" : count ?? "—"}</strong>
                    <em>Open management →</em>
                  </button>
                ))}
              </div>

              <section className="control-panel">
                <div className="control-panel-heading">
                  <div>
                    <h2>Recent university-wide events</h2>
                    <p>Events currently visible to this administrator account.</p>
                  </div>
                  <button type="button" onClick={() => navigate("/admin/events")}>
                    View events
                  </button>
                </div>
                {loading ? (
                  <p className="control-empty">Loading events…</p>
                ) : events.length === 0 ? (
                  <p className="control-empty">No university-wide events found.</p>
                ) : (
                  <div className="control-table-wrap">
                    <table className="control-table">
                      <thead>
                        <tr><th>Event</th><th>Venue</th><th>Start</th><th>Status</th></tr>
                      </thead>
                      <tbody>
                        {events.slice(0, 6).map((event) => (
                          <tr key={event.event_id}>
                            <td>{event.title}</td>
                            <td>{event.venue || "—"}</td>
                            <td>{displayDate(event.start_datetime)}</td>
                            <td><span className="control-status">{event.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          {section === "events" && (
            <section className="control-panel">
              <div className="control-panel-heading">
                <div>
                  <h2>University-wide events</h2>
                  <p>
                    Submit campus-wide events to OSSE for approval before students can see them.
                  </p>
                </div>
                <button
                  type="button"
                  className="control-event-add"
                  onClick={() => setEventFormOpen(true)}
                >
                  Submit an event
                </button>
              </div>
              {eventFormOpen && (
                <div
                  className="control-event-modal-backdrop"
                  role="presentation"
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget && !submittingEvent) {
                      setEventFormOpen(false);
                    }
                  }}
                >
                  <section
                    className="control-event-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="control-event-modal-title"
                  >
                    <div className="control-event-modal-heading">
                      <h2 id="control-event-modal-title">Submit a campus-wide event</h2>
                      <button
                        type="button"
                        aria-label="Close event form"
                        onClick={() => setEventFormOpen(false)}
                        disabled={submittingEvent}
                      >
                        ×
                      </button>
                    </div>
                    {error && <div className="control-alert control-event-modal-alert" role="alert">{error}</div>}
              <form className="control-event-form" onSubmit={submitCampusEvent}>
                <div className="control-event-grid">
                  <label>
                    Event title
                    <input
                      value={eventForm.title}
                      onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                      maxLength={255}
                      required
                    />
                  </label>
                  <label>
                    Category
                    <select
                      value={eventForm.category_id}
                      onChange={(e) => setEventForm({ ...eventForm, category_id: e.target.value })}
                      required
                    >
                      <option value="">Select category</option>
                      {[
                        [1, "Academic"], [2, "Cultural"], [3, "Sports"],
                        [4, "Technology"], [5, "University Event"],
                        [6, "Workshop"], [7, "Seminar"], [8, "Other"],
                      ].map(([id, label]) => (
                        <option key={id} value={id}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="wide">
                    Description
                    <textarea
                      value={eventForm.description}
                      onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                      rows={3}
                      required
                    />
                  </label>
                  <label className="wide">
                    Venue
                    <input
                      value={eventForm.venue}
                      onChange={(e) => setEventForm({ ...eventForm, venue: e.target.value })}
                      maxLength={255}
                      required
                    />
                  </label>
                  <label>
                    Start date and time
                    <input
                      type="datetime-local"
                      lang="en-US"
                      value={eventForm.start_datetime}
                      onChange={(e) => setEventForm({ ...eventForm, start_datetime: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    End date and time
                    <input
                      type="datetime-local"
                      lang="en-US"
                      min={eventForm.start_datetime || undefined}
                      value={eventForm.end_datetime}
                      onChange={(e) => setEventForm({ ...eventForm, end_datetime: e.target.value })}
                      required
                    />
                  </label>
                  <EventImageUpload
                    className="wide"
                    file={eventImageFile}
                    onChange={setEventImageFile}
                    disabled={submittingEvent}
                  />
                </div>
                <button type="submit" disabled={submittingEvent}>
                  {submittingEvent ? "Submitting…" : "Submit for OSSE approval"}
                </button>
              </form>
                  </section>
                </div>
              )}
              <div className="control-events-view-bar">
                <div className="control-events-view-tabs" role="tablist" aria-label="Event view">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={eventView === "list"}
                    className={eventView === "list" ? "active" : ""}
                    onClick={() => setEventView("list")}
                  >
                    Event list
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={eventView === "calendar"}
                    className={eventView === "calendar" ? "active" : ""}
                    onClick={() => setEventView("calendar")}
                  >
                    Calendar
                  </button>
                </div>
                <button
                  type="button"
                  className="control-event-refresh"
                  onClick={loadData}
                  disabled={loading}
                >
                  {loading ? "Refreshing…" : "Refresh"}
                </button>
              </div>
              {eventView === "calendar" ? (
                loading ? (
                  <p className="control-empty">Loading calendar events…</p>
                ) : (
                  <CalendarView events={events} />
                )
              ) : loading ? (
                <p className="control-empty">Loading events…</p>
              ) : events.length === 0 ? (
                <p className="control-empty">No university-wide events found.</p>
              ) : (
                <div className="control-table-wrap">
                  <table className="control-table control-events-table">
                    <thead>
                      <tr><th>Event</th><th>Venue</th><th>Start</th><th>End</th><th>Event status</th><th>Approval</th><th>Attendance</th></tr>
                    </thead>
                    <tbody>
                      {events.map((event) => (
                        <tr key={event.event_id}>
                          <td><strong>{event.title}</strong></td>
                          <td>{event.venue || "—"}</td>
                          <td>{displayDate(event.start_datetime)}</td>
                          <td>{displayDate(event.end_datetime)}</td>
                          <td>
                            <span className={`control-status event-${event.status || "unknown"}`}>
                              {event.status || "Unknown"}
                            </span>
                          </td>
                          <td>
                            <span className={`control-status approval-${event.approval_status || "approved"}`}>
                              {event.approval_status || "approved"}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="control-table-action"
                              onClick={() =>
                                navigate(
                                  `/admin/attendance?event_id=${encodeURIComponent(event.event_id)}&status=attended`
                                )
                              }
                            >
                              View attendees
                            </button>
                            <button
                              type="button"
                              className="control-table-action secondary"
                              onClick={() =>
                                navigate(
                                  `/admin/fines?event_id=${encodeURIComponent(event.event_id)}`
                                )
                              }
                            >
                              View fines
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {(section === "attendance" || section === "fines") && (
            <section className="control-panel">
              <div className="control-panel-heading control-attendance-heading">
                <div>
                  <h2>
                    {section === "fines"
                      ? attendanceEventId
                        ? `Event fines — ${events.find((event) => String(event.event_id) === attendanceEventId)?.title || `Event #${attendanceEventId}`}`
                        : "Fines Monitoring"
                      : attendanceEventId
                      ? `Event attendees — ${events.find((event) => String(event.event_id) === attendanceEventId)?.title || `Event #${attendanceEventId}`}`
                      : "Attendance by department"}
                  </h2>
                  <p>
                    {section === "fines"
                      ? `${filteredAttendance.length} fine(s) · ₱${attendanceFineTotal.toFixed(2)} total`
                      : `${filteredAttendance.length} ${
                          attendanceEventId ? "attendee(s)" : "registration records"
                        }`}
                  </p>
                </div>
                <div className="control-attendance-actions">
                  <label className="control-attendance-filter">
                    <span>Event</span>
                    <select
                      value={attendanceEventId}
                      onChange={(event) =>
                        updateAttendanceQuery("event_id", event.target.value)
                      }
                      disabled={loading}
                    >
                      <option value="">All events</option>
                      {events.map((event) => (
                        <option key={event.event_id} value={event.event_id}>
                          {event.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  {section === "attendance" && (
                    <label className="control-attendance-filter">
                      <span>Attendance status</span>
                      <select
                        value={attendanceStatus}
                        onChange={(event) =>
                          updateAttendanceQuery("status", event.target.value)
                        }
                        disabled={loading}
                      >
                        <option value="">All statuses</option>
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                      </select>
                    </label>
                  )}
                  <label className="control-attendance-filter">
                    <span>Student department</span>
                    <select
                      value={attendanceDepartmentId}
                      onChange={(event) => {
                        setAttendanceDepartmentId(event.target.value)
                        setAttendanceYearId("");
                        setAttendanceSectionId("");
                      }}
                      disabled={loading}
                    >
                      <option value="">All departments</option>
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
                  <label className="control-attendance-filter">
                    <span>Year level</span>
                    <select
                      value={attendanceYearId}
                      onChange={(event) => {
                        setAttendanceYearId(event.target.value);
                        setAttendanceSectionId("");
                      }}
                      disabled={loading}
                    >
                      <option value="">All year levels</option>
                      {attendanceYearOptions.map(([yearId, yearName]) => (
                        <option key={yearId} value={yearId}>
                          {yearName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="control-attendance-filter">
                    <span>Section</span>
                    <select
                      value={attendanceSectionId}
                      onChange={(event) =>
                        setAttendanceSectionId(event.target.value)
                      }
                      disabled={loading}
                    >
                      <option value="">All sections</option>
                      {attendanceSectionOptions.map(
                        ([sectionId, sectionName]) => (
                          <option key={sectionId} value={sectionId}>
                            {sectionName}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                  <button type="button" onClick={loadData} disabled={loading}>
                    {loading ? "Refreshing…" : "Refresh"}
                  </button>
                </div>
              </div>
              {loading && attendance.length === 0 ? (
                <p className="control-empty">Loading attendance…</p>
              ) : filteredAttendance.length === 0 ? (
                <p className="control-empty">
                  {loading
                    ? "Loading attendance…"
                    : section === "fines"
                    ? "No fines are due for the selected event and filters."
                    : attendanceEventId
                    ? "No attendees found for this event."
                    : "No attendance records found."}
                </p>
              ) : (
                <div
                  className="control-table-wrap"
                  aria-busy={loading}
                >
                  {loading && (
                    <p className="control-table-refreshing" role="status">
                      Refreshing attendance…
                    </p>
                  )}
                  <table className="control-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Student department</th>
                        <th>Year level</th>
                        <th>Section</th>
                        <th>Event</th>
                        <th>Event department</th>
                        <th>Status</th>
                        {section === "fines" && <><th>Fine</th><th>Fined at</th></>}
                        <th>Scanned</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAttendance.map((record) => (
                        <tr key={record.event_reg_id}>
                          <td>{record.full_name || "—"}<small>{record.student_no || record.email || ""}</small></td>
                          <td>{record.dept_name || "Unassigned"}</td>
                          <td>{record.yr_name || "—"}</td>
                          <td>{record.section_name || "—"}</td>
                          <td>{record.event_title || "—"}</td>
                          <td>{record.event_dept_name || "University-wide"}</td>
                          <td><span className="control-status">{String(record.attendance_status || "unknown").replace("_", " ")}</span></td>
                          {section === "fines" && (
                            <>
                              <td>₱{Number(record.fine_amount || 0).toFixed(2)}<small>Unpaid</small></td>
                              <td>{displayDate(record.fined_at || record.start_datetime)}</td>
                            </>
                          )}
                          <td>{displayPhilippineDate(record.scanned_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {section === "profile" && (
            <>
              {profileError && <div className="control-alert" role="alert">{profileError}</div>}
              {profileNotice && <div className="control-notice" role="status">{profileNotice}</div>}
              <section className="control-panel control-profile">
                <div className="control-profile-summary">
                  <span className="control-profile-avatar">
                    {(adminProfile?.full_name || "A").charAt(0).toUpperCase()}
                    {adminProfile?.avatar_url && (
                      <img
                        src={adminProfile.avatar_url}
                        alt={`${adminProfile.full_name || "Administrator"} profile`}
                        onError={(event) => {
                          event.currentTarget.hidden = true;
                        }}
                      />
                    )}
                  </span>
                  <div>
                    <h2>{adminProfile?.full_name || "Administrator"}</h2>
                    <p>University administrator with full-control dashboard access.</p>
                    <label className="control-profile-photo">
                      {uploadingProfilePhoto ? "Uploading photo…" : "Change profile photo"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={uploadAdminProfilePhoto}
                        disabled={uploadingProfilePhoto}
                      />
                    </label>
                    <small className="control-profile-photo-hint">
                      JPEG, PNG, or WebP; up to 2000 MB.
                    </small>
                  </div>
                </div>
                <form className="control-profile-form" onSubmit={saveAdminProfile}>
                  <label>
                    Full name
                    <input
                      value={profileForm.full_name}
                      onChange={(event) =>
                        setProfileForm({ ...profileForm, full_name: event.target.value })
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
                        setProfileForm({ ...profileForm, email: event.target.value })
                      }
                      maxLength={255}
                      required
                    />
                  </label>
                  <dl>
                    <div><dt>Role</dt><dd>{adminProfile?.role || "admin"}</dd></div>
                    <div><dt>Department</dt><dd>University-wide</dd></div>
                    <div><dt>Account status</dt><dd>{adminProfile?.status || "Active"}</dd></div>
                  </dl>
                  <button type="submit" disabled={savingProfile}>
                    {savingProfile ? "Saving…" : "Save profile"}
                  </button>
                </form>
              </section>
            </>
          )}

          {!["dashboard", "events", "attendance", "fines", "profile"].includes(section) && (
            <div className="control-empty">This admin page was not found.</div>
          )}
        </section>
      </main>
    </div>
  );
}
