import { Link } from "react-router-dom";

export default function AuthLayout({ children, variant = "" }) {
  return (
    <main className={`auth-page ${variant ? `auth-page-${variant}` : ""}`}>
      <section className="auth-shell">
        <aside className="auth-story">
          <Link to="/login" className="auth-brand">
            <img className="brand-icon" src="/images/msu-seal.png" alt="" />
            <span>
              Campus<span className="brand-highlight">Connect</span>
              <small>University Event Portal</small>
            </span>
          </Link>

          <div className="auth-story-content">
            <span className="auth-story-badge">YOUR CAMPUS, CONNECTED</span>
            <h2>Campus life,<br />all in one place.</h2>
            <p>
              Discover university events, connect with student organizations,
              and keep track of your campus activities through one convenient
              platform.
            </p>

            <ul className="auth-features">
              <li>
                <span aria-hidden="true">▦</span>
                <div>
                  <strong>Discover Campus Events</strong>
                  <small>Explore activities and university programs.</small>
                </div>
              </li>
              <li>
                <span aria-hidden="true">♟</span>
                <div>
                  <strong>Connect with Organizations</strong>
                  <small>Find groups that match your interests.</small>
                </div>
              </li>
              <li>
                <span aria-hidden="true">▤</span>
                <div>
                  <strong>Convenient QR Attendance</strong>
                  <small>Access your event attendance features.</small>
                </div>
              </li>
            </ul>
          </div>

          <small className="auth-story-footer">
            © {new Date().getFullYear()} CampusConnect · University Event Portal
          </small>
        </aside>

        <section className="auth-panel">{children}</section>
      </section>
    </main>
  );
}
