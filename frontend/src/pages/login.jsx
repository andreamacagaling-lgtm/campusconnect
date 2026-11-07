
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../api";
import { getAuthDestination, persistAuthSession } from "../authSession";
import AuthLayout from "../components/AuthLayout";
import GoogleSignInButton from "../components/GoogleSignInButton";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState(location.state?.email || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const finishLogin = (data) => {
    const { access_token, user } = data;
    if (!access_token || !user) {
      setError("Invalid response from the server. Please try again.");
      return;
    }

    const destination = getAuthDestination(user);
    if (destination === "/login") {
      setError(
        user.admin_type === "organization"
          ? "This organization admin account has no valid department assignment. Please contact the university administrator."
          : "This admin account has no valid department assignment. Please contact the university administrator."
      );
      return;
    }

    persistAuthSession(data, rememberMe);
    navigate(destination, { replace: true });
  };

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
      });

      finishLogin(response.data);
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

  const submitGoogleCredential = async (credential) => {
    setError("");
    setGoogleLoading(true);

    try {
      const response = await api.post("/auth/google", {
        credential,
        mode: "auto",
      });
      finishLogin(response.data);
    } catch (requestError) {
      const status = requestError.response?.status;
      const serverMessage =
        requestError.response?.data?.message ||
        requestError.response?.data?.error;

      if (!requestError.response) {
        setError("Cannot connect to the server. Please try again.");
      } else if (status === 404) {
        setError("No account is registered with this Google email. Create an account first.");
      } else {
        setError(serverMessage || "Google sign-in failed. Please try again.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleCredential = (credential) => {
    submitGoogleCredential(credential);
  };

  return (
    <AuthLayout>
      <section className="auth-card">
        <div className="auth-heading">
          <h1>Welcome back!</h1>
          <p>Sign in to your account to continue to CampusConnect.</p>
        </div>

        <p className="auth-method-prompt">Choose how you want to sign in:</p>

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
            disabled={loading || googleLoading}
          >
            {loading ? "Logging in..." : "Log in"}
            {!loading && <span aria-hidden="true">→</span>}
          </button>
        </form>

        <div className="auth-divider"><span>or</span></div>
        <GoogleSignInButton
          onCredential={handleGoogleCredential}
          disabled={loading || googleLoading}
          iconOnly
        />
        {googleLoading && (
          <p className="auth-google-note" role="status">
            Verifying your Google account...
          </p>
        )}
        <p className="auth-switch">
          Don&apos;t have an account? <Link to="/register">Create account</Link>
        </p>

      </section>
    </AuthLayout>
  );
}
