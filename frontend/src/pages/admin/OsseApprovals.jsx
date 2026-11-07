import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api";
import { confirmLogout } from "../../authSession";
import ResponsiveSidebarToggle from "../../components/ResponsiveSidebarToggle";
import { notifySuccess } from "../../notifications";
import "./OsseApprovals.css";

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

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "Request failed."
  );
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
        hour12: true,
      });
}

function EventApprovalCard({ event, departmentName, onSelect }) {
  return (
    <article
      className="osse-event-card"
      tabIndex={0}
      role="button"
      aria-label={`View details for ${event.title}`}
      onClick={() => onSelect(event)}
      onKeyDown={(keyEvent) => {
        if (
          keyEvent.target === keyEvent.currentTarget &&
          (keyEvent.key === "Enter" || keyEvent.key === " ")
        ) {
          keyEvent.preventDefault();
          onSelect(event);
        }
      }}
    >
      {event.image && (
        <img
          className="osse-event-card-image"
          src={event.image}
          alt=""
          loading="lazy"
        />
      )}
      <div className="osse-event-card-heading">
        <span className="osse-event-category">
          {event.category_name || "Event"}
        </span>
        <span className="osse-event-department">{departmentName}</span>
      </div>
      <h4>{event.title}</h4>
      <span className="osse-event-card-hint">Click to view event details</span>
    </article>
  );
}

export default function OsseApprovals() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const user = getUser();
  const [events, setEvents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const filteredEvents = useMemo(
    () =>
      departmentFilter
        ? events.filter(
            (event) =>
              (event.dept_id === null || event.dept_id === "")
                ? departmentFilter === "campus"
                : String(event.dept_id) === departmentFilter
          )
        : events,
    [departmentFilter, events]
  );
  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [response, departmentsResponse] = await Promise.all([
        api.get("/events/pending-approvals"),
        api.get("/auth/departments"),
      ]);
      if (
        !Array.isArray(response.data?.data) ||
        !Array.isArray(departmentsResponse.data?.data)
      ) {
        throw new Error(
          "Pending events or department options were not returned by the server."
        );
      }
      setEvents(response.data.data);
      setDepartments(departmentsResponse.data.data);
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        navigate("/login", { replace: true });
        return;
      }
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (!getToken()) {
      navigate("/login", { replace: true });
      return;
    }
    if (user?.role === "admin" && user?.admin_type === "osse") {
      void Promise.resolve().then(loadEvents);
    }
  }, [loadEvents, navigate, user?.admin_type, user?.role]);

  useEffect(() => {
    if (!selectedEvent) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") setSelectedEvent(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedEvent]);

  async function reviewEvent(event, action) {
    let approvalNote;
    if (action === "reject") {
      approvalNote = window.prompt("Reason for rejection (optional):");
      if (approvalNote === null) return;
    }

    setWorkingId(event.event_id);
    setError("");
    setNotice("");

    try {
      const response = await api.post(
        `/events/${event.event_id}/${action}`,
        action === "reject" ? { approval_note: approvalNote.trim() } : {}
      );
      setSelectedEvent(null);
      notifySuccess(
        response.data?.message ||
          (action === "approve" ? "Event approved." : "Event rejected.")
      );
      const calendarSyncError =
        response.data?.google_calendar_sync?.success === false
          ? response.data.google_calendar_sync.message ||
            "Unknown sync error."
          : "";
      await loadEvents();
      if (calendarSyncError) {
        setError(
          `Event approved, but Google Calendar sync failed: ${calendarSyncError}`
        );
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setWorkingId(null);
    }
  }

  function logout() {
    if (!confirmLogout()) return;

    localStorage.removeItem("campusconnect_token");
    localStorage.removeItem("campusconnect_user");
    sessionStorage.removeItem("campusconnect_token");
    sessionStorage.removeItem("campusconnect_user");
    navigate("/login", { replace: true });
  }

  if (!user || user.role !== "admin" || user.admin_type !== "osse") {
    return (
      <main className="osse-denied">
        <section>
          <h1>OSSE access required</h1>
          <p>This page is only available to OSSE event approvers.</p>
          <button type="button" onClick={() => navigate("/login", { replace: true })}>
            Return to sign in
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="osse-layout">
      <aside
        className={`osse-sidebar responsive-sidebar ${
          mobileMenuOpen ? "responsive-sidebar-open" : ""
        }`}
      >
        <div className="osse-brand responsive-sidebar-brand">
          <img className="osse-brand-mark" src="/images/msu-seal.png" alt="" />
          <span>
            <strong>CampusConnect</strong>
            <small>UNIVERSITY ADMIN</small>
          </span>
          <ResponsiveSidebarToggle
            isOpen={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
          />
        </div>

        <p className="osse-nav-label responsive-sidebar-label">OSSE WORKSPACE</p>
        <nav
          className="osse-nav responsive-sidebar-nav"
          aria-label="OSSE navigation"
          onClick={() => setMobileMenuOpen(false)}
        >
          <Link
            className="osse-nav-link active"
            to="/admin/osse/events"
            aria-current="page"
          >
            <span aria-hidden="true">▦</span>
            Event approvals
          </Link>
        </nav>

        <div className="osse-sidebar-bottom responsive-sidebar-bottom">
          <div className="osse-account">
            <span className="osse-avatar">
              {(user?.full_name || "O").charAt(0).toUpperCase()}
            </span>
            <span>
              <strong>{user?.full_name || "OSSE Administrator"}</strong>
              <small>OSSE event approver</small>
            </span>
          </div>
          <button type="button" className="osse-signout" onClick={logout}>
            ↪ Log out
          </button>
        </div>
      </aside>

      <main className="osse-page">
        <header className="osse-header">
          <div>
            <span>CampusConnect / OSSE</span>
            <h1>Event approvals</h1>
            <p>Review campus, department, and organization event submissions.</p>
          </div>
          <div className="osse-header-actions">
            <button type="button" onClick={loadEvents} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </header>

        <section className="osse-panel">
          <div className="osse-panel-heading">
            <div>
              <h2>Pending submissions by department</h2>
              <p>{filteredEvents.length} event(s) awaiting review</p>
            </div>
            <label className="osse-department-filter">
              <span>Filter by department</span>
              <select
                value={departmentFilter}
                onChange={(event) => setDepartmentFilter(event.target.value)}
                disabled={loading}
              >
                <option value="">All Events</option>
                <option value="campus">USG</option>
                {departments.map((department) => (
                  <option key={department.dept_id} value={department.dept_id}>
                    {department.dept_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error && <div className="osse-alert error" role="alert">{error}</div>}
          {notice && <div className="osse-alert success" role="status">{notice}</div>}

          {loading ? (
            <p className="osse-empty">Loading event submissions…</p>
          ) : error ? null : filteredEvents.length === 0 ? (
            <p className="osse-empty">No pending event submissions.</p>
          ) : (
            <div className="osse-event-grid">
              {filteredEvents.map((event) => {
                const departmentId =
                  event.dept_id === null || event.dept_id === ""
                    ? "campus"
                    : String(event.dept_id);
                const departmentName =
                  event.dept_name ||
                  departments.find(
                    (department) =>
                      String(department.dept_id) === departmentId
                  )?.dept_name ||
                  "USG";

                return (
                  <EventApprovalCard
                    key={event.event_id}
                    event={event}
                    departmentName={departmentName}
                    onSelect={setSelectedEvent}
                  />
                );
              })}
            </div>
          )}
        </section>
      </main>
      {selectedEvent && (
        <div
          className="osse-event-modal-backdrop"
          onMouseDown={(mouseEvent) => {
            if (mouseEvent.target === mouseEvent.currentTarget) {
              setSelectedEvent(null);
            }
          }}
        >
          <section
            className="osse-event-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="osse-event-modal-title"
          >
            <header className="osse-event-modal-header">
              <div>
                <span className="osse-event-category">
                  {selectedEvent.category_name || "Event"}
                </span>
                <h2 id="osse-event-modal-title">{selectedEvent.title}</h2>
                <p>
                  {selectedEvent.dept_name || "Campus-wide"}
                  {selectedEvent.org_name ? ` · ${selectedEvent.org_name}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="osse-event-modal-close"
                aria-label="Close event details"
                onClick={() => setSelectedEvent(null)}
              >
                ×
              </button>
            </header>
            <div className="osse-event-modal-content">
              <h3>Event details</h3>
              <p className="osse-event-modal-description">
                {selectedEvent.description || "No description provided."}
              </p>
              <dl className="osse-event-details">
                <div>
                  <dt>Start</dt>
                  <dd>{formatDate(selectedEvent.start_datetime)}</dd>
                </div>
                <div>
                  <dt>End</dt>
                  <dd>{formatDate(selectedEvent.end_datetime)}</dd>
                </div>
                <div>
                  <dt>Venue</dt>
                  <dd>{selectedEvent.venue || "Not specified"}</dd>
                </div>
                <div>
                  <dt>Submitted by</dt>
                  <dd>{selectedEvent.submitted_by || "—"}</dd>
                </div>
              </dl>
              <div className="osse-actions osse-event-modal-actions">
                <button
                  type="button"
                  className="approve"
                  disabled={workingId !== null}
                  onClick={() => reviewEvent(selectedEvent, "approve")}
                >
                  {workingId === selectedEvent.event_id
                    ? "Saving…"
                    : "Approve"}
                </button>
                <button
                  type="button"
                  className="reject"
                  disabled={workingId !== null}
                  onClick={() => reviewEvent(selectedEvent, "reject")}
                >
                  Reject
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
