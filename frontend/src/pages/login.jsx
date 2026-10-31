
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [departments, setDepartments] = useState([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [departmentsError, setDepartmentsError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadDepartments() {
      try {
        const response = await api.get("/auth/departments");
        const data = response.data?.data;

        if (!Array.isArray(data)) {
          throw new Error("Department list was not returned by the server.");
        }

        if (active) {
          setDepartments(data);
          setDepartmentsError("");
        }
      } catch (requestError) {
        if (active) {
          setDepartmentsError(
            requestError.response?.data?.message ||
              requestError.response?.data?.error ||
              requestError.message ||
              "Unable to load departments."
          );
        }
      } finally {
        if (active) {
          setDepartmentsLoading(false);
        }
      }
    }

    loadDepartments();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      const response = await api.post("/auth/login", {
        email: email.trim().toLowerCase(),
        password,
        dept_id: departmentId || null,
      });

      const { access_token, user } = response.data;

      if (!access_token || !user) {
        setError("Invalid response from the server. Please try again.");
        return;
      }

      // Save authentication data.
      localStorage.setItem("campusconnect_token", access_token);
      localStorage.setItem("campusconnect_user", JSON.stringify(user));

      // Keep the user logged in for the current browser session
      // unless Remember Me is selected.
      if (rememberMe) {
        localStorage.setItem("campusconnect_remember", "true");
      } else {
        localStorage.removeItem("campusconnect_remember");
      }

      // Redirect based on the actual role returned by the API.
      if (user.role === "admin") {
        if (user.dept_id === null || user.dept_id === "") {
          navigate("/admin/dashboard", { replace: true });
          return;
        }

        const departmentAdminRoutes = {
          1: "/admin/ccs",
          2: "/admin/ccje",
          3: "/admin/cbm",
          4: "/admin/cas",
          5: "/admin/btvted",
          6: "/admin/bsed",
        };
        const adminRoute = departmentAdminRoutes[Number(user.dept_id)];
        navigate(adminRoute || "/login", { replace: true });
      } else {
        navigate("/students/home", { replace: true });
      }
    } catch (err) {
      const status = err.response?.status;
      const serverMessage =
        err.response?.data?.message || err.response?.data?.error;

      if (!err.response) {
        setError(
          "Cannot connect to the server. Make sure your LavaLust backend is running."
        );
      } else if (status === 401) {
        setError("Incorrect email or password.");
      } else if (status === 403) {
        setError(
          serverMessage || "Your account is inactive. Please contact the administrator."
        );
      } else {
        setError(
          serverMessage || "Login failed. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link to="/login" className="auth-brand">
          <span className="brand-icon">C</span>
          <span>Campus<span className="brand-highlight">Connect</span></span>
        </Link>

        <div className="auth-heading">
          <p className="auth-eyebrow">WELCOME BACK</p>
          <h1>Sign in to your account</h1>
          <p>Connect with campus events and your university community.</p>
        </div>

        {error && (
          <div className="auth-alert" role="alert">
            <span aria-hidden="true">!</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-field">
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="login-password">Password</label>
            <div className="password-wrapper">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
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
            <label htmlFor="login-department">
              Department <span className="muted-small">(students)</span>
            </label>
            <select
              id="login-department"
              value={departmentId}
              onChange={(event) => setDepartmentId(event.target.value)}
              disabled={departmentsLoading || departments.length === 0}
            >
              <option value="">
                {departmentsLoading
                  ? "Loading departments..."
                  : "Select your department"}
              </option>
              {departments.map((department) => (
                <option key={department.dept_id} value={department.dept_id}>
                  {department.dept_name}
                </option>
              ))}
            </select>
            <small className="department-help">
              Students choose their department to see its events and university-wide events.
            </small>
            {departmentsError && (
              <small className="department-error" role="status">
                {departmentsError}
              </small>
            )}
          </div>

          <div className="auth-options">
            <label className="remember-option">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              <span>Remember me</span>
            </label>
            <span className="muted-small">Secure sign in</span>
          </div>

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
            {!loading && <span aria-hidden="true">→</span>}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account? <Link to="/register">Create one</Link>
        </p>

        <p className="auth-footer">
          Your campus community, all in one place.
        </p>
      </section>
    </main>
  );
}
