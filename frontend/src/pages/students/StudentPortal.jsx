import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import api from "../../api";
import { confirmLogout } from "../../authSession";
import ResponsiveSidebarToggle from "../../components/ResponsiveSidebarToggle";
import { notifySuccess } from "../../notifications";
import "./StudentPortal.css";

const NAV_ITEMS = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "events", label: "Events", icon: "▦" },
  { id: "announcements", label: "Announcements", icon: "▤" },
  { id: "organizations", label: "Organizations", icon: "♧" },
  { id: "attendance", label: "Attendance", icon: "✓" },
  { id: "profile", label: "My Profile", icon: "◉" },
];

const EVENT_FILTERS = [
  { id: "all", label: "All events" },
  { id: "department", label: "My department" },
  { id: "university", label: "University-wide" },
];

const EMPTY_EVENTS = [];
const EMPTY_ACADEMIC_OPTIONS = [];

function getEventStatus(event) {
  if (event.status === "cancelled") return "cancelled";
  if (event.status === "completed") return "completed";

  const start = new Date(String(event.start_datetime || "").replace(" ", "T"));
  const end = new Date(String(event.end_datetime || "").replace(" ", "T"));

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return event.status || "upcoming";
  }

  const now = new Date();
  if (now >= start && now <= end) return "ongoing";
  if (now < start) return "upcoming";
  return "completed";
}

function formatDate(value, options = {}) {
  if (!value) return "Schedule to be announced";

  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true,
    ...options,
  });
}

function getErrorMessage(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    fallback
  );
}

function notifyMembershipChanges(organizations, profileUserId) {
  try {
    const currentUser = JSON.parse(
      localStorage.getItem("campusconnect_user") ||
        sessionStorage.getItem("campusconnect_user") ||
        "null"
    );
    const studentId =
      profileUserId || currentUser?.user_id || currentUser?.sub || "student";
    const membershipKey = `campusconnect_memberships_${studentId}`;
    const storedMemberships = JSON.parse(
      localStorage.getItem(membershipKey) || "{}"
    );
    const previousMemberships =
      storedMemberships && typeof storedMemberships === "object"
        ? storedMemberships
        : {};
    const currentMemberships = { ...previousMemberships };

    for (const organization of organizations) {
      const status = organization.membership_status;
      if (!status) continue;

      currentMemberships[organization.org_id] = status;
      if (
        status === "approved" &&
        previousMemberships[organization.org_id] === "pending"
      ) {
        notifySuccess(
          `Your membership in ${organization.org_name} was approved. You are now a member.`
        );
      }
    }

    localStorage.setItem(membershipKey, JSON.stringify(currentMemberships));
  } catch (storageError) {
    console.error("Unable to track organization membership updates:", storageError);
  }
}

function StudentAvatar({ profile, className = "" }) {
  return (
    <span className={`${className} student-avatar`}>
      {(profile?.full_name || "S").charAt(0).toUpperCase()}
      {profile?.avatar && (
        <img
          src={profile.avatar}
          alt=""
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      )}
    </span>
  );
}

function StudentSidebar({ section, profile, navigate }) {
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
      className={`student-sidebar responsive-sidebar ${
        mobileMenuOpen ? "responsive-sidebar-open" : ""
      }`}
    >
      <div className="student-brand-row responsive-sidebar-brand">
        <Link to="/students/home" className="student-brand">
          <img className="student-brand-mark" src="/images/msu-seal.png" alt="" />
          <span>
            <strong>CampusConnect</strong>
            <small>STUDENT PORTAL</small>
          </span>
        </Link>
        <button
          type="button"
          className="student-mobile-signout"
          aria-label="Sign out"
          onClick={logout}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 17l5-5-5-5M15 12H3m9-7h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6" />
          </svg>
        </button>
        <ResponsiveSidebarToggle
          isOpen={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((open) => !open)}
        />
      </div>

      <p className="student-nav-label responsive-sidebar-label">MENU</p>
      <nav
        className="student-nav responsive-sidebar-nav"
        aria-label="Student navigation"
        onClick={() => setMobileMenuOpen(false)}
      >
        {NAV_ITEMS.map((item) => (
          <Link
            className={`student-nav-link ${
              section === item.id ? "active" : ""
            }`}
            key={item.id}
            to={`/students/${item.id}`}
            aria-current={section === item.id ? "page" : undefined}
          >
            <span className="student-nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="student-sidebar-bottom responsive-sidebar-bottom">
        <div className="student-sidebar-profile">
          <StudentAvatar profile={profile} />
          <span className="student-sidebar-name">
            <strong>{profile?.full_name || "Student"}</strong>
            <small>{profile?.dept_name || "Student account"}</small>
          </span>
        </div>
        <button
          type="button"
          className="student-signout"
          onClick={logout}
        >
          ↪ Log out
        </button>
      </div>
    </aside>
  );
}

function EventCard({ event, onRegister, registering }) {
  const status = getEventStatus(event);
  const end = event.end_datetime
    ? new Date(String(event.end_datetime).replace(" ", "T"))
    : null;
  const registrationClosed =
    status === "cancelled" ||
    status === "completed" ||
    !end ||
    Number.isNaN(end.getTime()) ||
    end <= new Date();

  return (
    <article
      className="student-event-card"
      id={`student-event-${event.event_id}`}
      tabIndex={-1}
    >
      {event.image ? (
        <img
          className="student-event-image"
          src={event.image}
          alt=""
          loading="lazy"
        />
      ) : (
        <div className="student-event-image student-event-image-empty">
          <span aria-hidden="true">▦</span>
          <small>{event.category_name || "Campus event"}</small>
        </div>
      )}

      <div className="student-event-card-content">
        <div className="student-event-card-topline">
          <span className="student-event-category">
            {event.org_name ||
              (event.dept_id === null || event.dept_id === ""
              ? "University-wide"
              : event.dept_name || "Department event")}
          </span>
          <span className={`student-status ${status}`}>{status}</span>
        </div>

        <h3>{event.title}</h3>
        <p className="student-event-description">
          {event.description || "More event details will be announced soon."}
        </p>

        <dl className="student-event-details">
          <div>
            <dt>Date</dt>
            <dd>{formatDate(event.start_datetime)}</dd>
          </div>
          <div>
            <dt>Venue</dt>
            <dd>{event.venue || "Venue to be announced"}</dd>
          </div>
        </dl>

        <div className="student-event-card-footer">
          {event.is_registered ? (
            <span className="student-registration-state registered">
              ✓ Registered
            </span>
          ) : registrationClosed ? (
            <span className="student-registration-state closed">
              Registration closed
            </span>
          ) : (
            <button
              type="button"
              className="student-button primary"
              onClick={() => onRegister(event)}
              disabled={registering}
            >
              {registering ? "Registering..." : "Register for event"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function EventSection({
  id,
  title,
  description,
  events,
  onRegister,
  registeringEventId,
  emptyMessage,
}) {
  return (
    <section id={id} className="student-section student-dashboard-anchor">
      <div className="student-section-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <span className="student-section-count">{events.length}</span>
      </div>

      {events.length === 0 ? (
        <div className="student-empty-state">
          <span aria-hidden="true">▦</span>
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <div className="student-event-grid">
          {events.map((event) => (
            <EventCard
              event={event}
              key={event.event_id}
              onRegister={onRegister}
              registering={registeringEventId === event.event_id}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function EventAnnouncementNotice({
  announcement,
  event,
}) {
  return (
    <article
      className={`student-announcement-card ${
        event ? "student-event-announcement" : ""
      }`}
    >
      <div className="student-announcement-heading">
        <h3>{announcement.title}</h3>
        {announcement.created_at && (
          <time dateTime={announcement.created_at}>
            {formatDate(announcement.created_at)}
          </time>
        )}
      </div>
      <p>{announcement.body}</p>
      {event && (
        <div className="student-announcement-event">
          <div>
            <strong>{event.title}</strong>
            <span>
              {formatDate(event.start_datetime)} ·{" "}
              {event.venue || "Venue to be announced"}
            </span>
          </div>
        </div>
      )}
    </article>
  );
}

export default function StudentPortal() {
  const navigate = useNavigate();
  const { pathname, search: locationSearch } = useLocation();
  const routeSection = pathname.split("/")[2] || "home";
  const section = routeSection === "history" ? "events" : routeSection;

  const [portal, setPortal] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [announcementsError, setAnnouncementsError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [registeringEventId, setRegisteringEventId] = useState(null);
  const [joiningOrganizationId, setJoiningOrganizationId] = useState(null);
  const [membershipOrganization, setMembershipOrganization] = useState(null);
  const [membershipForm, setMembershipForm] = useState({
    full_name: "",
    department: "",
    section: "",
    year_level: "",
  });
  const [eventSearch, setEventSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const [profileForm, setProfileForm] = useState({
    full_name: "",
    student_no: "",
    contact_number: "",
    yr_id: "",
    section_id: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const loadAnnouncements = useCallback(async () => {
    try {
      const response = await api.get("/announcements");
      const rows = response.data?.data;
      if (!Array.isArray(rows)) {
        throw new Error("Announcement data was not returned by the server.");
      }
      setAnnouncements(rows);
      setAnnouncementsError("");
    } catch (requestError) {
      setAnnouncements([]);
      setAnnouncementsError(
        getErrorMessage(requestError, "Unable to load announcements.")
      );
    } finally {
      setLoadingAnnouncements(false);
    }
  }, []);

  const loadPortal = useCallback(async () => {
    try {
      const response = await api.get("/student/portal");
      const data = response.data?.data;

      if (!data?.profile || !Array.isArray(data.events)) {
        throw new Error("The student portal response was incomplete.");
      }

      notifyMembershipChanges(
        Array.isArray(data.organizations) ? data.organizations : [],
        data.profile.user_id
      );

      setError("");
      setPortal(data);
      setProfileForm({
        full_name: data.profile.full_name || "",
        student_no: data.profile.student_no || "",
        contact_number: data.profile.contact_number || "",
        yr_id: data.profile.yr_id ? String(data.profile.yr_id) : "",
        section_id: data.profile.section_id
          ? String(data.profile.section_id)
          : "",
      });
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        localStorage.removeItem("campusconnect_token");
        sessionStorage.removeItem("campusconnect_token");
        navigate("/login", { replace: true });
        return;
      }

      setError(
        getErrorMessage(
          requestError,
          requestError.message ||
            "Unable to load your student portal. Please try again."
        )
      );
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const checkMembershipUpdates = useCallback(async () => {
    try {
      const response = await api.get("/student/portal");
      const data = response.data?.data;
      if (!data?.profile || !Array.isArray(data.organizations)) {
        throw new Error("Membership status was not returned by the server.");
      }

      notifyMembershipChanges(data.organizations, data.profile.user_id);
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        localStorage.removeItem("campusconnect_token");
        sessionStorage.removeItem("campusconnect_token");
        navigate("/login", { replace: true });
        return;
      }

      console.error(
        "Unable to check organization membership updates:",
        requestError
      );
    }
  }, [navigate]);

  useEffect(() => {
    void Promise.resolve().then(loadPortal);
  }, [loadPortal]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void checkMembershipUpdates();
      }
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [checkMembershipUpdates]);

  useEffect(() => {
    void Promise.resolve().then(loadAnnouncements);
  }, [loadAnnouncements]);

  useEffect(() => {
    if (section !== "events") return;

    const eventId = new URLSearchParams(locationSearch).get("event_id");
    if (!eventId) return;

    document
      .getElementById(`student-event-${eventId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [locationSearch, portal, section]);

  const profile = portal?.profile;
  const academicOptions =
    portal?.academic_options || EMPTY_ACADEMIC_OPTIONS;
  const profileYearOptions = useMemo(() => {
    const years = new Map();
    academicOptions.forEach((option) => {
      years.set(String(option.yr_id), option.yr_name);
    });
    return [...years.entries()];
  }, [academicOptions]);
  const profileSectionOptions = useMemo(
    () =>
      academicOptions.filter(
        (option) => String(option.yr_id) === profileForm.yr_id
      ).sort((left, right) =>
        left.section_name.localeCompare(right.section_name, undefined, {
          numeric: true,
        })
      ),
    [academicOptions, profileForm.yr_id]
  );
  const allEvents = portal?.events || EMPTY_EVENTS;
  const organizations = portal?.organizations || [];
  const myEvents = useMemo(
    () => allEvents.filter((event) => event.is_registered),
    [allEvents]
  );
  const ongoingEvents = useMemo(
    () =>
      allEvents.filter(
        (event) =>
          getEventStatus(event) === "ongoing" &&
          event.status !== "cancelled"
      ),
    [allEvents]
  );
  const upcomingEvents = useMemo(
    () =>
      allEvents
        .filter((event) => getEventStatus(event) === "upcoming")
        .sort(
          (left, right) =>
            new Date(left.start_datetime) - new Date(right.start_datetime)
        ),
    [allEvents]
  );
  const filteredEvents = useMemo(() => {
    const searchTerm = eventSearch.trim().toLowerCase();

    const statusOrder = {
      upcoming: 0,
      ongoing: 1,
      completed: 2,
      cancelled: 3,
    };

    return allEvents
      .filter((event) => {
        const isUniversityEvent =
          event.dept_id === null || event.dept_id === "";
        const matchesFilter =
          eventFilter === "all" ||
          (eventFilter === "department" && !isUniversityEvent) ||
          (eventFilter === "university" && isUniversityEvent);
        const matchesSearch = [
          event.title,
          event.description,
          event.venue,
          event.category_name,
          event.dept_name,
          event.org_name,
        ].some((value) =>
          String(value || "").toLowerCase().includes(searchTerm)
        );

        return matchesFilter && matchesSearch;
      })
      .sort((left, right) => {
        const leftStatus = getEventStatus(left);
        const rightStatus = getEventStatus(right);
        const statusDifference =
          (statusOrder[leftStatus] ?? 4) - (statusOrder[rightStatus] ?? 4);

        if (statusDifference !== 0) return statusDifference;

        const leftStart = new Date(
          String(left.start_datetime || "").replace(" ", "T")
        ).getTime();
        const rightStart = new Date(
          String(right.start_datetime || "").replace(" ", "T")
        ).getTime();

        if (!Number.isFinite(leftStart) && !Number.isFinite(rightStart)) return 0;
        if (!Number.isFinite(leftStart)) return 1;
        if (!Number.isFinite(rightStart)) return -1;
        return leftStart - rightStart;
      });
  }, [allEvents, eventFilter, eventSearch]);
  const activeEvents = useMemo(
    () =>
      filteredEvents.filter((event) => getEventStatus(event) !== "completed"),
    [filteredEvents]
  );
  const completedEvents = useMemo(
    () =>
      filteredEvents
        .filter((event) => getEventStatus(event) === "completed")
        .sort((left, right) => {
          const leftEnd = new Date(
            String(left.end_datetime || left.start_datetime || "").replace(
              " ",
              "T"
            )
          ).getTime();
          const rightEnd = new Date(
            String(right.end_datetime || right.start_datetime || "").replace(
              " ",
              "T"
            )
          ).getTime();

          if (!Number.isFinite(leftEnd) && !Number.isFinite(rightEnd)) return 0;
          if (!Number.isFinite(leftEnd)) return 1;
          if (!Number.isFinite(rightEnd)) return -1;
          return rightEnd - leftEnd;
        }),
    [filteredEvents]
  );
  const eventAnnouncementRows = useMemo(
    () =>
      announcements.flatMap((announcement) => {
        const event = allEvents.find(
          (item) => String(item.event_id) === String(announcement.event_id)
        );
        return event ? [{ announcement, event }] : [];
      }),
    [allEvents, announcements]
  );
  const upcomingEventAnnouncementRows = useMemo(
    () =>
      eventAnnouncementRows
        .filter(({ event }) => getEventStatus(event) === "upcoming")
        .slice(0, 3),
    [eventAnnouncementRows]
  );

  async function handleRegister(event) {
    setError("");
    setNotice("");
    setRegisteringEventId(event.event_id);

    try {
      const response = await api.post(
        `/student/events/${event.event_id}/register`
      );
      notifySuccess(response.data?.message || "Event registration successful.");
      await loadPortal();
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Unable to register for this event.")
      );
    } finally {
      setRegisteringEventId(null);
    }
  }

  function handleJoinOrganization(organization) {
    setMembershipForm({
      full_name: "",
      department: "",
      section: "",
      year_level: "",
    });
    setMembershipOrganization(organization);
  }

  async function submitMembershipApplication(event) {
    event.preventDefault();
    if (!membershipOrganization) return;

    setError("");
    setNotice("");
    setJoiningOrganizationId(membershipOrganization.org_id);

    try {
      const response = await api.post(
        `/student/organizations/${membershipOrganization.org_id}/join`,
        membershipForm
      );
      notifySuccess(
        response.data?.message || "Membership application submitted."
      );
      setMembershipOrganization(null);
      await loadPortal();
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "Unable to submit the membership application."
        )
      );
    } finally {
      setJoiningOrganizationId(null);
    }
  }

  function closeMembershipApplication() {
    if (joiningOrganizationId !== null) return;
    setMembershipOrganization(null);
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    const contactNumber = profileForm.contact_number.trim();
    if (!profile?.avatar) {
      setError("Upload a profile photo before saving your profile.");
      return;
    }
    if (!/^\d{11}$/.test(contactNumber)) {
      setError("Contact number is required and must be exactly 11 digits.");
      return;
    }
    if (!profileForm.yr_id) {
      setError("Please select your year level.");
      return;
    }
    if (!profileForm.section_id) {
      setError("Please select your section.");
      return;
    }

    setSavingProfile(true);

    try {
      const response = await api.put("/student/profile", {
        ...profileForm,
        yr_id: profileForm.yr_id || null,
        section_id: profileForm.section_id || null,
      });
      notifySuccess(response.data?.message || "Profile updated successfully.");

      let savedUser = null;
      let cacheUpdateFailed = false;
      try {
        savedUser = JSON.parse(
          localStorage.getItem("campusconnect_user") ||
            sessionStorage.getItem("campusconnect_user") ||
            "null"
        );
      } catch {
        cacheUpdateFailed = true;
      }

      if (savedUser) {
        savedUser.full_name = profileForm.full_name.trim();
        const storage = localStorage.getItem("campusconnect_user")
          ? localStorage
          : sessionStorage;
        storage.setItem("campusconnect_user", JSON.stringify(savedUser));
      }

      await loadPortal();
      navigate("/students/home", { replace: true });
      if (cacheUpdateFailed) {
        setError(
          "Profile saved, but the cached account details could not be updated."
        );
      }
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Unable to update your profile.")
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAvatarUpload(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setError("");
    setNotice("");

    if (file.size > 2000 * 1024 * 1024) {
      setError("Profile photos must be 2000 MB or smaller.");
      input.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);
    setUploadingAvatar(true);

    try {
      const response = await api.post("/student/profile/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      notifySuccess(
        response.data?.message || "Profile photo updated successfully."
      );
      await loadPortal();
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Unable to upload your profile photo.")
      );
    } finally {
      setUploadingAvatar(false);
      input.value = "";
    }
  }

  const pageTitle =
    NAV_ITEMS.find((item) => item.id === section)?.label || "Home";

  if (loading && !portal) {
    return (
      <main className="student-loading">
        <div className="student-loader" />
        <p>Loading your campus community...</p>
      </main>
    );
  }

  if (!portal) {
    return (
      <main className="student-loading">
        <div className="student-load-error" role="alert">
          <h1>Student portal unavailable</h1>
          <p>{error}</p>
          <button
            className="student-button primary"
            type="button"
            onClick={() => {
              setLoading(true);
              loadPortal();
            }}
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="student-layout">
      <StudentSidebar
        section={section}
        profile={profile}
        navigate={navigate}
      />

      <main className="student-main">
        <header className="student-topbar">
          <div>
            <span className="student-breadcrumb">
              CampusConnect / {pageTitle}
            </span>
            <h1>{pageTitle}</h1>
          </div>
          <div className="student-topbar-user">
            <StudentAvatar profile={profile} />
            <span>
              <strong>{profile.full_name}</strong>
              <small>{profile.dept_name || "Department not assigned"}</small>
            </span>
          </div>
        </header>

        <div className="student-content">
          {error && (
            <div className="student-alert error" role="alert">
              <span>{error}</span>
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
            <div className="student-alert success" role="status">
              <span>{notice}</span>
              <button
                type="button"
                onClick={() => setNotice("")}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          )}

          {section === "home" && (
            <>
              <section className="student-welcome">
                <div>
                  <span className="student-eyebrow">YOUR CAMPUS, CONNECTED</span>
                  <h2>Welcome, {profile.full_name?.split(" ")[0] || "Student"}!</h2>
                  <p>
                    {profile.dept_name
                      ? `Discover what's happening in ${profile.dept_name} and across the university.`
                      : "Discover upcoming events and activities across the university."}
                  </p>
                  <Link to="/students/events" className="student-button light">
                    Explore events <span aria-hidden="true">→</span>
                  </Link>
                </div>
                <div className="student-welcome-art" aria-hidden="true">
                  <span className="welcome-ring ring-one" />
                  <span className="welcome-ring ring-two" />
                  <span className="welcome-star">✦</span>
                  <span className="welcome-calendar">
                    <strong>{upcomingEvents.length}</strong>
                    <small>upcoming</small>
                  </span>
                </div>
              </section>

              <section className="student-overview-stats">
                <a href="#ongoing-events" aria-label="View ongoing events">
                  <span className="overview-icon green">▦</span>
                  <span><small>Ongoing now</small><strong>{ongoingEvents.length}</strong></span>
                </a>
                <a href="#upcoming-events" aria-label="View upcoming events">
                  <span className="overview-icon blue">◷</span>
                  <span><small>Coming up</small><strong>{upcomingEvents.length}</strong></span>
                </a>
                <a href="#my-events" aria-label="View my event registrations">
                  <span className="overview-icon orange">✓</span>
                  <span><small>My registrations</small><strong>{myEvents.length}</strong></span>
                </a>
              </section>

              {upcomingEventAnnouncementRows.length > 0 && (
                <section className="student-section">
                  <div className="student-section-heading">
                    <div>
                      <h2>Upcoming event alerts</h2>
                      <p>
                        Administrator announcements about upcoming events.
                      </p>
                    </div>
                    <Link
                      to="/students/announcements"
                      className="student-text-link"
                    >
                      All announcements <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                  <div className="student-announcement-list">
                    {upcomingEventAnnouncementRows.map(
                      ({ announcement, event }) => (
                        <EventAnnouncementNotice
                          key={announcement.announcement_id}
                          announcement={announcement}
                          event={event}
                        />
                      )
                    )}
                  </div>
                </section>
              )}

              <EventSection
                id="ongoing-events"
                title="Ongoing Events"
                description="Events happening on campus right now."
                events={ongoingEvents}
                onRegister={handleRegister}
                registeringEventId={registeringEventId}
                emptyMessage="No events are happening right now. Check back for what's next."
              />
              <EventSection
                id="upcoming-events"
                title="Upcoming Events"
                description="Plan ahead and reserve your spot."
                events={upcomingEvents.slice(0, 3)}
                onRegister={handleRegister}
                registeringEventId={registeringEventId}
                emptyMessage="There are no upcoming events at the moment."
              />

              <section id="my-events" className="student-section student-dashboard-anchor">
                <div className="student-section-heading">
                  <div>
                    <h2>My Events</h2>
                    <p>Events you have registered for.</p>
                  </div>
                  <Link to="/students/attendance" className="student-text-link">
                    View attendance <span aria-hidden="true">→</span>
                  </Link>
                </div>
                {myEvents.length === 0 ? (
                  <div className="student-empty-state compact">
                    <span aria-hidden="true">✓</span>
                    <p>You haven't registered for any events yet.</p>
                  </div>
                ) : (
                  <div className="student-my-events">
                    {myEvents.slice(0, 4).map((event) => (
                      <div className="student-my-event" key={event.event_id}>
                        <span className="student-my-event-date">
                          {new Date(event.start_datetime).toLocaleDateString(
                            "en-PH",
                            { month: "short", day: "numeric" }
                          )}
                        </span>
                        <span className="student-my-event-info">
                          <strong>{event.title}</strong>
                          <small>{event.venue} · {formatDate(event.start_datetime, { dateStyle: undefined, timeStyle: "short" })}</small>
                        </span>
                        <span className="student-registration-state registered">
                          Registered
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {section === "events" && (
            <section className="student-section student-events-page">
              <div className="student-section-heading">
                <div>
                  <h2>Discover Events</h2>
                  <p>
                    Browse department and university-wide events you can join.
                  </p>
                </div>
              </div>
              <div className="student-event-toolbar">
                <input
                  type="search"
                  placeholder="Search events, venue, or category..."
                  aria-label="Search events"
                  value={eventSearch}
                  onChange={(event) => setEventSearch(event.target.value)}
                />
                <div className="student-filter-tabs" role="group" aria-label="Filter event type">
                  {EVENT_FILTERS.map((filter) => (
                    <button
                      type="button"
                      key={filter.id}
                      className={eventFilter === filter.id ? "selected" : ""}
                      onClick={() => setEventFilter(filter.id)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="student-event-grid">
                {activeEvents.map((event) => (
                  <EventCard
                    event={event}
                    key={event.event_id}
                    onRegister={handleRegister}
                    registering={registeringEventId === event.event_id}
                  />
                ))}
              </div>
              {activeEvents.length === 0 && (
                <div className="student-empty-state">
                  <span aria-hidden="true">⌕</span>
                  <p>No upcoming or ongoing events match this search or filter.</p>
                </div>
              )}

              <div className="student-section-heading student-history-heading">
                <div>
                  <h2>History</h2>
                  <p>Completed events, with the most recent listed first.</p>
                </div>
                <span className="student-section-count">
                  {completedEvents.length}
                </span>
              </div>
              {completedEvents.length > 0 ? (
                <div className="student-history-list">
                  {completedEvents.map((event) => (
                    <div className="student-history-row" key={event.event_id}>
                      <time dateTime={event.start_datetime}>
                        {event.start_datetime
                          ? new Date(
                              String(event.start_datetime).replace(" ", "T")
                            ).toLocaleDateString("en-PH", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Date not specified"}
                      </time>
                      <div className="student-history-info">
                        <strong>{event.title}</strong>
                        <span>
                          {event.venue || "Venue not specified"}
                          {event.dept_name ? ` · ${event.dept_name}` : ""}
                        </span>
                      </div>
                      <span className="student-history-status">Completed</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="student-empty-state">
                  <span aria-hidden="true">◷</span>
                  <p>No completed events match this search or filter.</p>
                </div>
              )}
            </section>
          )}

          {section === "announcements" && (
            <section className="student-section">
              <div className="student-section-heading">
                <div>
                  <h2>Campus Announcements</h2>
                  <p>Updates and notices from your campus administrators.</p>
                </div>
                <span className="student-section-count">
                  {announcements.length}
                </span>
              </div>
              {announcementsError ? (
                <div className="student-empty-state" role="alert">
                  <p>{announcementsError}</p>
                </div>
              ) : loadingAnnouncements ? (
                <div className="student-empty-state">
                  <p>Loading announcements...</p>
                </div>
              ) : announcements.length === 0 ? (
                <div className="student-empty-state">
                  <span aria-hidden="true">▤</span>
                  <p>There are no announcements yet.</p>
                </div>
              ) : (
                <div className="student-announcement-list">
                  {announcements.map((announcement) => {
                    const event = allEvents.find(
                      (item) =>
                        String(item.event_id) ===
                        String(announcement.event_id)
                    );

                    return (
                      <EventAnnouncementNotice
                        key={announcement.announcement_id}
                        announcement={announcement}
                        event={event}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {section === "organizations" && (
            <section className="student-section">
              <div className="student-section-heading">
                <div>
                  <h2>Campus Organizations</h2>
                  <p>
                    Apply for membership and review the student details sent
                    with your application.
                  </p>
                </div>
                <span className="student-section-count">
                  {organizations.length}
                </span>
              </div>
              {organizations.length === 0 ? (
                <div className="student-empty-state">
                  <span aria-hidden="true">♧</span>
                  <p>No active organizations are listed yet.</p>
                </div>
              ) : (
                <div className="student-organization-grid">
                  {organizations.map((organization) => (
                    <article
                      className="student-organization-card"
                      key={organization.org_id}
                    >
                      <span className="student-org-mark" aria-hidden="true">
                        {organization.org_name.charAt(0).toUpperCase()}
                      </span>
                      <span className="student-org-category">
                        {organization.category}
                      </span>
                      <h3>{organization.org_name}</h3>
                      <p>{organization.description}</p>
                      {organization.eligibility && (
                        <div className="student-org-eligibility">
                          <strong>Membership</strong>
                          <span>{organization.eligibility}</span>
                        </div>
                      )}
                      {organization.membership_status ? (
                        <span
                          className={`student-membership-state ${organization.membership_status}`}
                        >
                          {organization.membership_status === "approved"
                            ? "✓ Member"
                            : organization.membership_status === "rejected"
                              ? "Request not approved"
                              : "Request pending"}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="student-button primary"
                          onClick={() =>
                            handleJoinOrganization(organization)
                          }
                          disabled={
                            joiningOrganizationId === organization.org_id
                          }
                        >
                          {joiningOrganizationId === organization.org_id
                            ? "Submitting..."
                            : "Apply for membership"}
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {membershipOrganization && (
            <div
              className="student-modal-backdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  closeMembershipApplication();
                }
              }}
            >
              <section
                className="student-membership-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="membership-application-title"
              >
                <div className="student-membership-modal-heading">
                  <div>
                    <span className="student-org-category">
                      ORGANIZATION MEMBERSHIP
                    </span>
                    <h2 id="membership-application-title">
                      {membershipOrganization.org_name}
                    </h2>
                    <p>
                      Enter your student information to apply for membership.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="student-membership-close"
                    onClick={closeMembershipApplication}
                    disabled={joiningOrganizationId !== null}
                    aria-label="Close membership application"
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={submitMembershipApplication}>
                  <div className="student-membership-fields">
                    <label>
                      Full name
                      <input
                        name="full_name"
                        value={membershipForm.full_name}
                        onChange={(event) =>
                          setMembershipForm((current) => ({
                            ...current,
                            full_name: event.target.value,
                          }))
                        }
                        maxLength={150}
                        autoComplete="name"
                        required
                      />
                    </label>
                    <label>
                      Department
                      <input
                        name="department"
                        value={membershipForm.department}
                        onChange={(event) =>
                          setMembershipForm((current) => ({
                            ...current,
                            department: event.target.value,
                          }))
                        }
                        maxLength={150}
                        required
                      />
                    </label>
                    <label>
                      Section
                      <input
                        name="section"
                        value={membershipForm.section}
                        onChange={(event) =>
                          setMembershipForm((current) => ({
                            ...current,
                            section: event.target.value,
                          }))
                        }
                        maxLength={100}
                        required
                      />
                    </label>
                    <label>
                      Year level
                      <input
                        name="year_level"
                        value={membershipForm.year_level}
                        onChange={(event) =>
                          setMembershipForm((current) => ({
                            ...current,
                            year_level: event.target.value,
                          }))
                        }
                        maxLength={50}
                        required
                      />
                    </label>
                  </div>
                  <p className="student-membership-note">
                    All four fields are required for your application.
                  </p>
                  <div className="student-membership-actions">
                    <button
                      type="button"
                      className="student-button secondary"
                      onClick={closeMembershipApplication}
                      disabled={joiningOrganizationId !== null}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="student-button primary"
                      disabled={joiningOrganizationId !== null}
                    >
                      {joiningOrganizationId === membershipOrganization.org_id
                        ? "Submitting..."
                        : "Submit application"}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}

          {section === "attendance" && (
            <section className="student-section">
              <div className="student-section-heading">
                <div>
                  <h2>My Attendance</h2>
                  <p>
                    Your event registrations and recorded attendance.
                  </p>
                </div>
                <span className="student-section-count">
                  {myEvents.length}
                </span>
              </div>
              {myEvents.length === 0 ? (
                <div className="student-empty-state">
                  <span aria-hidden="true">✓</span>
                  <p>Registered events and attendance records will appear here.</p>
                  <Link to="/students/events" className="student-text-link">
                    Browse events <span aria-hidden="true">→</span>
                  </Link>
                </div>
              ) : (
                <div className="student-table-wrap">
                  <table className="student-table">
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Date</th>
                        <th>Registered</th>
                        <th>Attendance</th>
                        <th>QR Ticket</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myEvents.map((event) => {
                        const attendanceStatus =
                          event.attendance_status ||
                          (new Date(event.end_datetime) < new Date()
                            ? "absent"
                            : "not_scanned");

                        return (
                          <tr key={event.event_id}>
                            <td>
                              <strong>{event.title}</strong>
                              <small>{event.venue}</small>
                            </td>
                            <td>{formatDate(event.start_datetime)}</td>
                            <td>{formatDate(event.registered_at)}</td>
                            <td>
                              <span
                                className={`student-attendance-state ${attendanceStatus}`}
                              >
                                {attendanceStatus.replace("_", " ")}
                              </span>
                            </td>
                            <td>
                              {event.qr_token ? (
                                <div className="student-event-qr">
                                  {profile.avatar && (
                                    <img
                                      className="student-event-qr-avatar"
                                      src={profile.avatar}
                                      alt={`${profile.full_name} profile`}
                                    />
                                  )}
                                  <QRCodeSVG
                                    value={event.qr_token}
                                    size={112}
                                    level="M"
                                  />
                                  <span>
                                    Show this QR to the event admin.
                                  </span>
                                </div>
                              ) : (
                                <span
                                  className="student-event-qr-unavailable"
                                  role="status"
                                >
                                  QR ticket unavailable. Refresh or contact an
                                  admin.
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {section === "profile" && (
            <section className="student-section student-profile-page">
              <div className="student-section-heading">
                <div>
                  <h2>My Profile</h2>
                  <p>View and update your student information.</p>
                </div>
              </div>
              <form className="student-profile-form" onSubmit={handleProfileSubmit}>
                <div className="student-profile-summary">
                  <span className="student-profile-avatar">
                    {(profile.full_name || "S").charAt(0).toUpperCase()}
                    {profile.avatar && (
                      <img
                        src={profile.avatar}
                        alt={`${profile.full_name} profile`}
                        onError={(event) => {
                          event.currentTarget.hidden = true;
                        }}
                      />
                    )}
                  </span>
                  <div>
                    <strong>{profile.full_name}</strong>
                    <span>{profile.email}</span>
                    <label className="student-avatar-upload">
                      {uploadingAvatar
                        ? "Uploading photo..."
                        : "Change profile photo *"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleAvatarUpload}
                        disabled={uploadingAvatar}
                        aria-label="Upload required profile photo"
                      />
                    </label>
                    <small>
                      Profile photo is required. JPEG, PNG, or WebP; up to 2000 MB.
                    </small>
                  </div>
                </div>
                <div className="student-profile-fields">
                  <label>
                    Full name *
                    <input
                      value={profileForm.full_name}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          full_name: event.target.value,
                        }))
                      }
                      maxLength={150}
                      required
                    />
                  </label>
                  <label>
                    Student number
                    <input
                      value={profileForm.student_no}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          student_no: event.target.value,
                        }))
                      }
                      maxLength={50}
                    />
                  </label>
                  <label>
                    Email address
                    <input value={profile.email || ""} readOnly />
                  </label>
                  <label>
                    Contact number *
                    <input
                      type="tel"
                      value={profileForm.contact_number}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          contact_number: event.target.value
                            .replace(/\D/g, "")
                            .slice(0, 11),
                        }))
                      }
                      placeholder="09XXXXXXXXX"
                      inputMode="numeric"
                      pattern="[0-9]{11}"
                      minLength={11}
                      maxLength={11}
                      title="Enter exactly 11 digits."
                      required
                    />
                  </label>
                  <label>
                    Department
                    <input value={profile.dept_name || "Not assigned"} readOnly />
                  </label>
                  <label>
                    Year level *
                    <select
                      value={profileForm.yr_id}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          yr_id: event.target.value,
                          section_id: "",
                        }))
                      }
                      disabled={savingProfile || profileYearOptions.length === 0}
                      required
                    >
                      <option value="">Select year level</option>
                      {profileYearOptions.map(([yearId, yearName]) => (
                        <option key={yearId} value={yearId}>
                          {yearName}
                        </option>
                      ))}
                    </select>
                    {profileYearOptions.length === 0 && (
                      <small className="student-profile-help">
                        Year and section options are unavailable. Run the
                        pending database migrations and refresh this page.
                      </small>
                    )}
                  </label>
                  <label>
                    Section *
                    <select
                      value={profileForm.section_id}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          section_id: event.target.value,
                        }))
                      }
                      disabled={
                        savingProfile ||
                        !profileForm.yr_id ||
                        profileSectionOptions.length === 0
                      }
                      required
                    >
                      <option value="">Select section</option>
                      {profileSectionOptions.map((option) => (
                        <option
                          key={option.section_id}
                          value={option.section_id}
                        >
                          {option.section_name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="student-profile-actions">
                  <button
                    type="submit"
                    className="student-button primary"
                    disabled={savingProfile}
                  >
                    {savingProfile ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
