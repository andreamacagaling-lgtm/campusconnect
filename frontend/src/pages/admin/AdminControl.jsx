import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import "./AdminControl.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:3000";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/admin/dashboard", icon: "⌂" },
  { label: "Announcements", path: "/admin/announcements", icon: "▤" },
  { label: "Events", path: "/admin/events", icon: "▦" },
  { label: "Organizations", path: "/admin/organizations", icon: "♧" },
  { label: "Attendance", path: "/admin/attendance", icon: "✓" },
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

function displayDate(value) {
  if (!value) return "—";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function AdminSidebar({ activePage, user, navigate }) {
  function logout() {
    localStorage.removeItem("campusconnect_token");
    localStorage.removeItem("campusconnect_user");
    sessionStorage.removeItem("campusconnect_token");
    sessionStorage.removeItem("campusconnect_user");
    navigate("/login", { replace: true });
  }

  return (
    <aside className="control-sidebar">
      <div className="control-brand">
        <span className="control-brand-mark">CC</span>
        <span>
          <strong>CampusConnect</strong>
          <small>UNIVERSITY ADMIN</small>
        </span>
      </div>

      <p className="control-nav-label">FULL CONTROL</p>
      <nav className="control-nav" aria-label="Admin navigation">
        {NAV_ITEMS.map((item) => (
          <button
            type="button"
            className={`control-nav-link ${activePage === item.label ? "active" : ""}`}
            key={item.path}
            onClick={() => navigate(item.path)}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="control-sidebar-bottom">
        <div className="control-account">
          <span className="control-avatar">
            {(user?.full_name || "A").charAt(0).toUpperCase()}
          </span>
          <span>
            <strong>{user?.full_name || "Administrator"}</strong>
            <small>University administrator</small>
          </span>
        </div>
        <button type="button" className="control-logout" onClick={logout}>
          ↪ Sign out
        </button>
      </div>
    </aside>
  );
}

export default function AdminControl() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const user = useMemo(() => getUser(), []);
  const [counts, setCounts] = useState({
    events: null,
    announcements: null,
    organizations: null,
  });
  const [events, setEvents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const section = pathname.replace(/\/+$/, "").split("/").pop() || "dashboard";
  const activePage =
    section === "attendance"
      ? "Attendance"
      : section === "profile"
        ? "Admin Profile"
        : section === "events"
          ? "Events"
          : "Dashboard";

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    const token = getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      if (section === "attendance") {
        const response = await axios.get(`${API_BASE_URL}/api/attendance`, {
          headers,
        });
        const rows = response.data?.data;
        if (!Array.isArray(rows)) {
          throw new Error("Attendance records were not returned by the server.");
        }
        setAttendance(rows);
      } else {
        const [eventsResult, announcementsResult, organizationsResult] =
          await Promise.allSettled([
            axios.get(`${API_BASE_URL}/api/events`, { headers }),
            axios.get(`${API_BASE_URL}/api/announcements`, { headers }),
            axios.get(`${API_BASE_URL}/api/organizations`, { headers }),
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
        const organizationRows =
          organizationsResult.status === "fulfilled"
            ? getRows(organizationsResult.value.data)
            : (failures.push("organizations"), []);

        setEvents(eventRows);
        setCounts({
          events: eventsResult.status === "fulfilled" ? eventRows.length : null,
          announcements:
            announcementsResult.status === "fulfilled"
              ? announcementRows.length
              : null,
          organizations:
            organizationsResult.status === "fulfilled"
              ? organizationRows.length
              : null,
        });

        if (failures.length) {
          setError(`Could not load ${failures.join(", ")} summary data.`);
        }
      }
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        localStorage.removeItem("campusconnect_token");
        sessionStorage.removeItem("campusconnect_token");
        navigate("/login", { replace: true });
        return;
      }
      setError(
        requestError.response?.data?.message ||
          requestError.response?.data?.error ||
          requestError.message ||
          "Unable to load admin data."
      );
    } finally {
      setLoading(false);
    }
  }, [navigate, section]);

  useEffect(() => {
    if (!getToken()) {
      navigate("/login", { replace: true });
      return;
    }

    if (section === "dashboard" || section === "events" || section === "attendance") {
      void Promise.resolve().then(loadData);
    }
  }, [loadData, navigate, section]);

  if (!user || user.role !== "admin" || user.dept_id !== null) {
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

  return (
    <div className="control-layout">
      <AdminSidebar activePage={activePage} user={user} navigate={navigate} />
      <main className="control-main">
        <header className="control-topbar">
          <div>
            <span>CampusConnect / University Admin</span>
            <h1>{activePage}</h1>
          </div>
          <span className="control-admin-badge">Full-control admin</span>
        </header>

        <section className="control-content">
          {error && <div className="control-alert" role="alert">{error}</div>}

          {section === "dashboard" && (
            <>
              <div className="control-welcome">
                <div>
                  <p className="control-eyebrow">UNIVERSITY ADMINISTRATION</p>
                  <h2>Welcome, {user.full_name || "Administrator"}</h2>
                  <p>Manage campus announcements, events, organizations, and attendance.</p>
                </div>
                <span aria-hidden="true">⌂</span>
              </div>

              <div className="control-stat-grid">
                {[
                  ["Events", counts.events, "/admin/events", "▦"],
                  ["Announcements", counts.announcements, "/admin/announcements", "▤"],
                  ["Organizations", counts.organizations, "/admin/organizations", "♧"],
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
                    Department events remain managed in their department portals.
                  </p>
                </div>
                <button type="button" onClick={loadData} disabled={loading}>
                  {loading ? "Refreshing…" : "Refresh"}
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
                      <tr><th>Event</th><th>Venue</th><th>Start</th><th>End</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {events.map((event) => (
                        <tr key={event.event_id}>
                          <td>{event.title}</td>
                          <td>{event.venue || "—"}</td>
                          <td>{displayDate(event.start_datetime)}</td>
                          <td>{displayDate(event.end_datetime)}</td>
                          <td><span className="control-status">{event.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {section === "attendance" && (
            <section className="control-panel">
              <div className="control-panel-heading">
                <div>
                  <h2>Attendance across departments</h2>
                  <p>{attendance.length} registration records</p>
                </div>
                <button type="button" onClick={loadData} disabled={loading}>
                  {loading ? "Refreshing…" : "Refresh"}
                </button>
              </div>
              {loading ? (
                <p className="control-empty">Loading attendance…</p>
              ) : attendance.length === 0 ? (
                <p className="control-empty">No attendance records found.</p>
              ) : (
                <div className="control-table-wrap">
                  <table className="control-table">
                    <thead>
                      <tr><th>Student</th><th>Department</th><th>Event</th><th>Status</th><th>Scanned</th></tr>
                    </thead>
                    <tbody>
                      {attendance.map((record) => (
                        <tr key={record.event_reg_id}>
                          <td>{record.full_name || "—"}<small>{record.student_no || record.email || ""}</small></td>
                          <td>{record.dept_name || "University-wide"}</td>
                          <td>{record.event_title || "—"}</td>
                          <td><span className="control-status">{String(record.attendance_status || "unknown").replace("_", " ")}</span></td>
                          <td>{displayDate(record.scanned_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {section === "profile" && (
            <section className="control-panel control-profile">
              <span className="control-profile-avatar">
                {(user.full_name || "A").charAt(0).toUpperCase()}
              </span>
              <div>
                <h2>{user.full_name || "Administrator"}</h2>
                <p>University administrator with full-control dashboard access.</p>
                <dl>
                  <div><dt>Email</dt><dd>{user.email || "—"}</dd></div>
                  <div><dt>Role</dt><dd>{user.role}</dd></div>
                  <div><dt>Department</dt><dd>University-wide</dd></div>
                  <div><dt>Account status</dt><dd>{user.status || "Active"}</dd></div>
                </dl>
              </div>
            </section>
          )}

          {!["dashboard", "events", "attendance", "profile"].includes(section) && (
            <div className="control-empty">This admin page was not found.</div>
          )}
        </section>
      </main>
    </div>
  );
}
