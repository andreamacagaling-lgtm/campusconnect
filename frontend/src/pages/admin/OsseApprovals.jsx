import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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

function StudentAccountsPanel({
  students,
  departments,
  loading,
  onRefresh,
  workingId,
  onUpdateStatus,
}) {
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const yearOptions = useMemo(() => {
    const years = new Map();
    students.forEach((student) => {
      if (
        student.yr_id !== null &&
        student.yr_id !== "" &&
        (!departmentFilter || String(student.dept_id) === departmentFilter)
      ) {
        years.set(String(student.yr_id), student.yr_name || "Year level");
      }
    });
    return [...years.entries()].sort((left, right) =>
      left[1].localeCompare(right[1], undefined, { numeric: true })
    );
  }, [departmentFilter, students]);

  const sectionOptions = useMemo(() => {
    const sections = new Map();
    students.forEach((student) => {
      if (
        student.section_id !== null &&
        student.section_id !== "" &&
        (!departmentFilter || String(student.dept_id) === departmentFilter) &&
        (!yearFilter || String(student.yr_id) === yearFilter)
      ) {
        sections.set(
          String(student.section_id),
          student.section_name || "Section"
        );
      }
    });
    return [...sections.entries()].sort((left, right) =>
      left[1].localeCompare(right[1], undefined, { numeric: true })
    );
  }, [departmentFilter, students, yearFilter]);

  const filteredStudents = useMemo(
    () =>
      students.filter(
        (student) =>
          (!departmentFilter || String(student.dept_id) === departmentFilter) &&
          (!yearFilter || String(student.yr_id) === yearFilter) &&
          (!sectionFilter || String(student.section_id) === sectionFilter) &&
          (!statusFilter || student.status === statusFilter)
      ),
    [departmentFilter, sectionFilter, statusFilter, students, yearFilter]
  );
  const pendingCount = students.filter(
    (student) => student.status === "pending"
  ).length;

  function renderStudentRow(student) {
    const isPending = student.status === "pending";
    const nextStatus = student.status === "active" ? "inactive" : "active";
    return (
      <tr key={student.user_id}>
        <td>
          <strong>{student.full_name}</strong>
          <small>{student.student_no || student.email || "—"}</small>
        </td>
        <td>{student.dept_name || "—"}</td>
        <td>{student.yr_name || "—"}</td>
        <td>{student.section_name || "—"}</td>
        <td>
          <span className={`osse-status-badge ${student.status}`}>
            {student.status}
          </span>
        </td>
        <td>{formatDate(student.created_at)}</td>
        <td>
          <button
            type="button"
            className={isPending || nextStatus === "active" ? "approve" : "reject"}
            disabled={workingId !== null}
            onClick={() =>
              onUpdateStatus(student, isPending ? "active" : nextStatus)
            }
          >
            {workingId === student.user_id
              ? "Saving…"
              : isPending
                ? "Approve"
                : nextStatus === "active"
                  ? "Activate"
                  : "Deactivate"}
          </button>
        </td>
      </tr>
    );
  }

  return (
    <section className="osse-panel osse-student-accounts-panel">
      <div className="osse-panel-heading osse-student-accounts-heading">
        <div>
          <h2>Student accounts</h2>
          <p>
            {filteredStudents.length} account(s) shown
            {pendingCount > 0 ? ` · ${pendingCount} pending OSSE approval` : ""}
          </p>
        </div>
        <div className="osse-student-filters">
          <label className="osse-department-filter">
            <span>Student department</span>
            <select
              value={departmentFilter}
              onChange={(event) => {
                setDepartmentFilter(event.target.value);
                setYearFilter("");
                setSectionFilter("");
              }}
              disabled={loading}
            >
              <option value="">All departments</option>
              {departments.map((department) => (
                <option key={department.dept_id} value={department.dept_id}>
                  {department.dept_name}
                </option>
              ))}
            </select>
          </label>
          <label className="osse-department-filter">
            <span>Year level</span>
            <select
              value={yearFilter}
              onChange={(event) => {
                setYearFilter(event.target.value);
                setSectionFilter("");
              }}
              disabled={loading}
            >
              <option value="">All year levels</option>
              {yearOptions.map(([yearId, yearName]) => (
                <option key={yearId} value={yearId}>
                  {yearName}
                </option>
              ))}
            </select>
          </label>
          <label className="osse-department-filter">
            <span>Section</span>
            <select
              value={sectionFilter}
              onChange={(event) => setSectionFilter(event.target.value)}
              disabled={loading}
            >
              <option value="">All sections</option>
              {sectionOptions.map(([sectionId, sectionName]) => (
                <option key={sectionId} value={sectionId}>
                  {sectionName}
                </option>
              ))}
            </select>
          </label>
          <label className="osse-department-filter">
            <span>Account status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              disabled={loading}
            >
              <option value="">All accounts</option>
              <option value="pending">Pending approval</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <button type="button" onClick={onRefresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>
      {filteredStudents.length === 0 ? (
        <p className="osse-empty">
          {students.length === 0
            ? "No student accounts are available."
            : "No student accounts match the selected filters."}
        </p>
      ) : (
        <div className="osse-table-wrap">
          <table className="osse-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Student department</th>
                <th>Year level</th>
                <th>Section</th>
                <th>Status</th>
                <th>Registered</th>
                <th>Account action</th>
              </tr>
            </thead>
            <tbody>{filteredStudents.map(renderStudentRow)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StudentPopulationReport({ departments }) {
  const departmentCount = departments.filter(
    (department) => department.dept_id !== null
  ).length;
  const unassignedCount = departments.find(
    (department) => department.dept_id === null
  )?.total_students || 0;
  const totals = departments.reduce(
    (result, department) => ({
      total: result.total + department.total_students,
      active: result.active + department.active_students,
      pending: result.pending + department.pending_students,
      inactive: result.inactive + department.inactive_students,
    }),
    { total: 0, active: 0, pending: 0, inactive: 0 }
  );

  return (
    <div className="osse-report-dashboard">
      <section className="osse-report-welcome">
        <div>
          <p className="osse-report-eyebrow">OSSE OVERVIEW</p>
          <h2>Student population</h2>
          <p>Monitor enrollment and account status across all departments.</p>
        </div>
        <span className="osse-report-welcome-icon" aria-hidden="true">▤</span>
      </section>

      <div className="osse-population-summary">
        <article className="osse-population-card">
          <span aria-hidden="true">♙</span>
          <small>Total students</small>
          <strong>{totals.total}</strong>
          <em>
            Across {departmentCount} departments
            {unassignedCount > 0 ? ` · ${unassignedCount} unassigned` : ""}
          </em>
        </article>
        <article className="osse-population-card">
          <span aria-hidden="true">✓</span>
          <small>Active accounts</small>
          <strong>{totals.active}</strong>
          <em>Approved and able to sign in</em>
        </article>
        <article className="osse-population-card">
          <span aria-hidden="true">◷</span>
          <small>Pending approval</small>
          <strong>{totals.pending}</strong>
          <em>Awaiting OSSE review</em>
        </article>
        <article className="osse-population-card">
          <span aria-hidden="true">⊘</span>
          <small>Inactive accounts</small>
          <strong>{totals.inactive}</strong>
          <em>Currently unable to sign in</em>
        </article>
      </div>

      <section className="osse-panel osse-report-table-panel">
        <div className="osse-panel-heading">
          <div>
            <h2>Population by department</h2>
            <p>
              {totals.total} student account(s) across {departmentCount}{" "}
              department(s)
              {unassignedCount > 0
                ? `, including ${unassignedCount} unassigned`
                : ""}
            </p>
          </div>
        </div>
        {departments.length === 0 ? (
          <p className="osse-empty">No departments are available for this report.</p>
        ) : (
          <div className="osse-table-wrap">
            <table className="osse-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Total students</th>
                  <th>Active</th>
                  <th>Pending</th>
                  <th>Inactive</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((department) => (
                  <tr key={department.dept_id ?? "unassigned"}>
                    <td><strong>{department.dept_name}</strong></td>
                    <td>{department.total_students}</td>
                    <td>{department.active_students}</td>
                    <td>{department.pending_students}</td>
                    <td>{department.inactive_students}</td>
                  </tr>
                ))}
                <tr className="osse-total-row">
                  <td><strong>All students</strong></td>
                  <td><strong>{totals.total}</strong></td>
                  <td><strong>{totals.active}</strong></td>
                  <td><strong>{totals.pending}</strong></td>
                  <td><strong>{totals.inactive}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function OsseApprovals() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const user = getUser();
  const [events, setEvents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [students, setStudents] = useState([]);
  const [population, setPopulation] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const currentPage = location.pathname.endsWith("/students")
    ? "students"
    : location.pathname.endsWith("/reports")
      ? "reports"
      : "events";

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

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [response, departmentsResponse] = await Promise.all([
        api.get("/admin/osse/students"),
        api.get("/auth/departments"),
      ]);
      if (
        !Array.isArray(response.data?.data) ||
        !Array.isArray(departmentsResponse.data?.data)
      ) {
        throw new Error("Student accounts were not returned by the server.");
      }
      setStudents(response.data.data);
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

  const loadPopulation = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/admin/osse/student-population");
      if (!Array.isArray(response.data?.data)) {
        throw new Error("The student population report was not returned by the server.");
      }
      setPopulation(response.data.data);
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
      const loader =
        currentPage === "students"
          ? loadStudents
          : currentPage === "reports"
            ? loadPopulation
            : loadEvents;
      void Promise.resolve().then(loader);
    }
  }, [
    currentPage,
    loadEvents,
    loadPopulation,
    loadStudents,
    navigate,
    user?.admin_type,
    user?.role,
  ]);

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

  async function updateStudentStatus(student, status) {
    setWorkingId(student.user_id);
    setError("");
    setNotice("");

    try {
      const response = await api.put(
        `/admin/osse/students/${student.user_id}/status`,
        { status }
      );
      notifySuccess(response.data?.message || "Student account updated.");
      await loadStudents();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setWorkingId(null);
    }
  }

  function refreshCurrentPage() {
    if (currentPage === "students") return loadStudents();
    if (currentPage === "reports") return loadPopulation();
    return loadEvents();
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
            className={`osse-nav-link ${currentPage === "events" ? "active" : ""}`}
            to="/admin/osse/events"
            aria-current={currentPage === "events" ? "page" : undefined}
          >
            <span aria-hidden="true">▦</span>
            Event approvals
          </Link>
          <Link
            className={`osse-nav-link ${currentPage === "students" ? "active" : ""}`}
            to="/admin/osse/students"
            aria-current={currentPage === "students" ? "page" : undefined}
          >
            <span aria-hidden="true">♙</span>
            Student accounts
          </Link>
          <Link
            className={`osse-nav-link ${currentPage === "reports" ? "active" : ""}`}
            to="/admin/osse/reports"
            aria-current={currentPage === "reports" ? "page" : undefined}
          >
            <span aria-hidden="true">▤</span>
            Population reports
          </Link>
        </nav>

        <div className="osse-sidebar-bottom responsive-sidebar-bottom">
          <div className="osse-account">
            <span className="osse-avatar">
              {(user?.full_name || "O").charAt(0).toUpperCase()}
            </span>
            <span>
              <strong>{user?.full_name || "OSSE Administrator"}</strong>
              <small>OSSE administrator</small>
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
            <h1>
              {currentPage === "students"
                ? "Student accounts"
                : currentPage === "reports"
                  ? "Student population reports"
                  : "Event approvals"}
            </h1>
            <p>
              {currentPage === "students"
                ? "Approve registrations and manage student account access."
                : currentPage === "reports"
                  ? "View student population and account status by department."
                  : "Review campus, department, and organization event submissions."}
            </p>
          </div>
          {currentPage !== "students" && (
            <div className="osse-header-actions">
              <button type="button" onClick={refreshCurrentPage} disabled={loading}>
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          )}
        </header>

        {currentPage === "students" ? (
          <div className="osse-content-stack">
            {error && <div className="osse-alert error" role="alert">{error}</div>}
            {loading ? (
              <section className="osse-panel">
                <p className="osse-empty">Loading student accounts…</p>
              </section>
            ) : error ? null : (
              <StudentAccountsPanel
                students={students}
                departments={departments}
                loading={loading}
                onRefresh={loadStudents}
                workingId={workingId}
                onUpdateStatus={updateStudentStatus}
              />
            )}
          </div>
        ) : currentPage === "reports" ? (
          <div className="osse-content-stack">
            {error && <div className="osse-alert error" role="alert">{error}</div>}
            {loading ? (
              <section className="osse-panel">
                <p className="osse-empty">Loading student population report…</p>
              </section>
            ) : error ? null : (
              <StudentPopulationReport departments={population} />
            )}
          </div>
        ) : <section className="osse-panel">
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
        </section>}
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
