
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { getAuthDestination, persistAuthSession } from "../authSession";
import AuthLayout from "../components/AuthLayout";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { notifySuccess } from "../notifications";

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: "",
    student_no: "",
    email: "",
    dept_id: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [departmentsError, setDepartmentsError] = useState("");
  const [pendingGoogleCredential, setPendingGoogleCredential] = useState("");

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
        if (active) setDepartmentsLoading(false);
      }
    }

    loadDepartments();
    return () => {
      active = false;
    };
  }, []);

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
    if (
      !form.full_name.trim() ||
      !form.email.trim() ||
      !form.dept_id ||
      !form.password
    ) {
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
        dept_id: form.dept_id,
        password: form.password,
      };

      if (form.student_no.trim()) {
        payload.student_no = form.student_no.trim();
      }

      const response = await api.post("/auth/register", payload);

      notifySuccess(
        response.data?.message ||
          "Registration submitted. Your account is awaiting OSSE approval."
      );

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

  const submitGoogleCredential = async (credential) => {
    setError("");
    setGoogleLoading(true);

    try {
      const response = await api.post("/auth/google", {
        credential,
        dept_id: form.dept_id || null,
        mode: "auto",
      });

      if (response.data?.approval_pending) {
        notifySuccess(
          response.data.message ||
            "Your account is awaiting OSSE approval."
        );
        setPendingGoogleCredential("");
        setTimeout(() => {
          navigate("/login", {
            replace: true,
            state: {
              registered: true,
              email: response.data.email || "",
            },
          });
        }, 1000);
        return;
      }

      if (!persistAuthSession(response.data)) {
        setError("Invalid response from the server. Please try again.");
        return;
      }

      setPendingGoogleCredential("");
      navigate(getAuthDestination(response.data.user), { replace: true });
    } catch (requestError) {
      const status = requestError.response?.status;
      const serverMessage =
        requestError.response?.data?.message ||
        requestError.response?.data?.error;

      if (!requestError.response) {
        setError("Cannot connect to the server. Please try again.");
      } else if (
        status === 422 &&
        serverMessage === "Please select your department to finish Google registration."
      ) {
        setPendingGoogleCredential(credential);
        setError("Choose your department above, then continue with Google.");
      } else {
        setError(serverMessage || "Google account verification failed. Please try again.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleCredential = (credential) => {
    setPendingGoogleCredential("");
    submitGoogleCredential(credential);
  };

  const continueGoogleRegistration = () => {
    if (pendingGoogleCredential && form.dept_id) {
      submitGoogleCredential(pendingGoogleCredential);
    }
  };

  return (
    <AuthLayout variant="register">
      <section className="auth-card auth-card-register">
        <div className="auth-heading">
          <h1>Create your account</h1>
          <p>Stay updated with university events and organizations.</p>
        </div>

        {error && (
          <div className="auth-alert" role="alert">
            <span aria-hidden="true">!</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form auth-form-register">
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
            <label htmlFor="register-department">Department *</label>
            <select
              id="register-department"
              name="dept_id"
              value={form.dept_id}
              onChange={handleChange}
              disabled={departmentsLoading || departments.length === 0}
              required
            >
              <option value="">
                {departmentsLoading
                  ? "Loading departments..."
                  : "Choose your department"}
              </option>
              {departments.map((department) => (
                <option key={department.dept_id} value={department.dept_id}>
                  {department.dept_name}
                </option>
              ))}
            </select>
            {departmentsError && (
              <small className="department-error" role="status">
                {departmentsError}
              </small>
            )}
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
            disabled={loading || googleLoading}
          >
            {loading ? "Creating account..." : "Create Account"}
            {!loading && <span aria-hidden="true">→</span>}
          </button>
        </form>

        <div className="auth-divider"><span>or</span></div>
        <GoogleSignInButton
          onCredential={handleGoogleCredential}
          disabled={loading || googleLoading || Boolean(pendingGoogleCredential)}
          iconOnly
        />
        {googleLoading && (
          <p className="auth-google-note" role="status">
            Verifying your Google account...
          </p>
        )}
        {pendingGoogleCredential && (
          <>
            <button
              type="button"
              className="auth-submit auth-google-continue"
              onClick={continueGoogleRegistration}
              disabled={!form.dept_id || googleLoading}
            >
              Continue with Google
              <span aria-hidden="true">→</span>
            </button>
          </>
        )}

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>

      </section>
    </AuthLayout>
  );
}
