
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: "",
    student_no: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.full_name.trim() || !form.email.trim() || !form.password) {
      setError("Please complete all required fields.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      };

      if (form.student_no.trim()) {
        payload.student_no = form.student_no.trim();
      }

      await api.post("/auth/register", payload);

      setSuccess("Account created successfully! Redirecting to sign in...");

      // Registration does not automatically grant an admin role.
      setTimeout(() => {
        navigate("/login", {
          replace: true,
          state: { registered: true, email: form.email.trim().toLowerCase() },
        });
      }, 1000);
    } catch (err) {
      const status = err.response?.status;
      const serverMessage = err.response?.data?.message;

      if (!err.response) {
        setError(
          "Cannot connect to the server. Make sure your LavaLust backend is running."
        );
      } else if (status === 409) {
        setError(serverMessage || "This email or student number is already registered.");
      } else if (status === 422) {
        setError(serverMessage || "Please check your information and try again.");
      } else {
        setError(serverMessage || "Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card auth-card-register">
        <Link to="/login" className="auth-brand">
          <span className="brand-icon">C</span>
          <span>Campus<span className="brand-highlight">Connect</span></span>
        </Link>

        <div className="auth-heading">
          <p className="auth-eyebrow">JOIN YOUR COMMUNITY</p>
          <h1>Create your account</h1>
          <p>Stay updated with university events and organizations.</p>
        </div>

        {error && (
          <div className="auth-alert" role="alert">
            <span aria-hidden="true">!</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="auth-success" role="status">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-field">
            <label htmlFor="register-full-name">Full name *</label>
            <input
              id="register-full-name"
              name="full_name"
              type="text"
              placeholder="Juan Dela Cruz"
              value={form.full_name}
              onChange={handleChange}
              autoComplete="name"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="register-student-no">Student ID</label>
            <input
              id="register-student-no"
              name="student_no"
              type="text"
              placeholder="Enter your student ID (optional)"
              value={form.student_no}
              onChange={handleChange}
              autoComplete="off"
            />
          </div>

          <div className="form-field">
            <label htmlFor="register-email">Email address *</label>
            <input
              id="register-email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="register-password">Password *</label>
            <div className="password-wrapper">
              <input
                id="register-password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="At least 8 characters"
                value={form.password}
                onChange={handleChange}
                autoComplete="new-password"
                minLength={8}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="register-confirm-password">Confirm password *</label>
            <div className="password-wrapper">
              <input
                id="register-confirm-password"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter your password"
                value={form.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword((current) => !current)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <p className="auth-terms">
            By creating an account, you agree to follow your university's
            community guidelines.
          </p>

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Create Account"}
            {!loading && <span aria-hidden="true">→</span>}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>

        <p className="auth-footer">
          Your campus community, all in one place.
        </p>
      </section>
    </main>
  );
}
