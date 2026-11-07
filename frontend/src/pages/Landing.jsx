import { Link } from "react-router-dom";
import "./Landing.css";

export default function Landing() {
  return (
    <main className="landing-page">
      <div className="landing-backdrop" aria-hidden="true" />
      <header className="landing-header">
        <Link to="/" className="landing-brand" aria-label="CampusConnect home">
          <img src="/images/msu-seal.png" alt="" />
          <span>
            Campus<span>Connect</span>
            <small>University Event Portal</small>
          </span>
        </Link>
        <span className="landing-eyebrow">MINDORO STATE UNIVERSITY</span>
      </header>

      <section className="landing-content">
        <h1>Your campus, connected.</h1>
        <p>
          Discover university events, connect with student organizations,
          <br className="landing-description-break" /> and stay in the loop with
          everything happening on campus.
        </p>
        <div className="landing-actions">
          <Link to="/login" className="landing-button landing-button-primary">
            Join for CampusConnect <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        CampusConnect <span aria-hidden="true">·</span> University Event Portal
      </footer>
    </main>
  );
}
