import { useCallback, useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import "./AdminAttendanceScanner.css";

const DEPARTMENT_DASHBOARDS = {
  1: "/admin/ccs",
  2: "/admin/ccje",
  3: "/admin/cbm",
  4: "/admin/cas",
  5: "/admin/btvted",
  6: "/admin/bsed",
};

function getDashboardPath() {
  try {
    const user = JSON.parse(
      localStorage.getItem("campusconnect_user") ||
        sessionStorage.getItem("campusconnect_user") ||
        "null"
    );
    return DEPARTMENT_DASHBOARDS[Number(user?.dept_id)] || "/admin/dashboard";
  } catch {
    return "/admin/dashboard";
  }
}

function formatPhilippineDateTime(value) {
  if (!value) return "—";

  const timestamp = Number(value);
  if (
    (typeof value === "number" || /^\d+(?:\.\d+)?$/.test(String(value))) &&
    Number.isFinite(timestamp)
  ) {
    return new Date(timestamp * 1000).toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      dateStyle: "medium",
      timeStyle: "medium",
      hour12: true,
    });
  }

  const dateValue = String(value).trim();
  const normalized = dateValue.includes("T")
    ? dateValue
    : dateValue.replace(" ", "T");
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized);
  const date = new Date(hasTimezone ? normalized : `${normalized}+08:00`);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "medium",
    hour12: true,
  });
}

export default function AdminAttendanceScanner() {
  const navigate = useNavigate();
  const [scanResult, setScanResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const scannerRef = useRef(null);
  const scanInProgressRef = useRef(false);
  const scannerCleanupRef = useRef(Promise.resolve());

  const resumeScanner = useCallback(() => {
    setScanResult(null);
    setError("");
    setSuccessMsg("");
    scanInProgressRef.current = false;

    if (scannerRef.current) {
      try {
        scannerRef.current.resume();
      } catch (resumeError) {
        console.error("Unable to resume QR scanner:", resumeError);
        setError("Unable to restart the camera. Reload this page and try again.");
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let scanner = null;

    const initializeScanner = async () => {
      await scannerCleanupRef.current;
      if (cancelled) return;

      scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );
      scannerRef.current = scanner;

      scanner.render(
        async (decodedText) => {
          if (scanInProgressRef.current) return;
          scanInProgressRef.current = true;

          try {
            scanner.pause(true);
          } catch (pauseError) {
            console.warn("Unable to pause QR scanner:", pauseError);
          }

          setScanResult(null);
          setError("");
          setSuccessMsg("");
          setLoading(true);

          try {
            const response = await api.post("/attendance", {
              qr_token: decodedText,
            });
            const result = response.data?.data;

            if (!response.data?.success || !result) {
              throw new Error(
                response.data?.message || "The attendance scan was not recorded."
              );
            }

            setScanResult(result);
            setSuccessMsg(response.data.message || "Attendance recorded.");
          } catch (requestError) {
            const result = requestError.response?.data?.data;
            if (result) setScanResult(result);
            setError(
              requestError.response?.data?.message ||
                requestError.response?.data?.error ||
                requestError.message ||
                "Unable to record attendance. Check the API connection and try again."
            );
          } finally {
            setLoading(false);
          }
        },
        () => {}
      );
    };

    initializeScanner().catch((initializeError) => {
      console.error("Unable to initialize QR scanner:", initializeError);
      setError("Unable to start the camera. Reload this page and try again.");
    });

    return () => {
      cancelled = true;
      scannerCleanupRef.current = scannerCleanupRef.current.then(async () => {
        if (!scanner) return;
        if (scannerRef.current === scanner) scannerRef.current = null;

        try {
          await scanner.clear();
        } catch (clearError) {
          console.error("Unable to stop QR scanner:", clearError);
        }
      });
    };
  }, []);

  return (
    <main className="admin-scanner-container">
      <button
        className="admin-scanner-back"
        type="button"
        onClick={() => navigate(getDashboardPath())}
      >
        ← Back to Dashboard
      </button>
      <h2>Event Attendance Scanner</h2>
      <p>
        Scan a student&apos;s approved event QR ticket before or during the event.
        Department administrators can only record attendance for their own events.
      </p>

      {error && (
        <div className="admin-scanner-alert error" role="alert">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="admin-scanner-alert success" role="status">
          {successMsg}
        </div>
      )}

      <div id="qr-reader" className="admin-scanner-camera" />

      {loading && <p role="status">Checking ticket and recording attendance…</p>}

      {scanResult && (
        <section
          className="admin-scanner-ticket"
          aria-labelledby="admin-scanner-ticket-title"
        >
          <h3 id="admin-scanner-ticket-title">Scan Result</h3>
          <div className="admin-scanner-result">
            {scanResult.avatar_url && (
              <img
                className="admin-scanner-avatar"
                src={scanResult.avatar_url}
                alt={`${scanResult.full_name || "Student"} profile`}
                onError={(event) => {
                  event.currentTarget.hidden = true;
                }}
              />
            )}
            <div className="admin-scanner-result-details">
              <h4 className="admin-scanner-student-name">
                {scanResult.full_name || "Student"}
              </h4>
              <p className="admin-scanner-student-detail">
                Student ID: <strong>{scanResult.student_no || "N/A"}</strong>
              </p>
              <p className="admin-scanner-student-detail">
                Student department: {scanResult.department || "Unassigned"}
              </p>
              <p className="admin-scanner-student-detail">
                Event: <strong>{scanResult.event_title || "N/A"}</strong>
              </p>
              <p className="admin-scanner-student-detail">
                Event department: {scanResult.event_department || "University-wide"}
              </p>
              {scanResult.attendance_status && (
                <p className="admin-scanner-student-detail">
                  Status: <strong>{scanResult.attendance_status}</strong>
                </p>
              )}
              {scanResult.scanned_at && (
                <p className="admin-scanner-student-detail">
                  Scanned: {formatPhilippineDateTime(scanResult.scanned_at)}
                </p>
              )}
            </div>
          </div>
          <div className="admin-scanner-actions">
            <button
              className="admin-scanner-button confirm"
              type="button"
              onClick={resumeScanner}
              disabled={loading}
            >
              Scan Next Student
            </button>
          </div>
        </section>
      )}

      {error && !scanResult && (
        <div className="admin-scanner-actions">
          <button
            className="admin-scanner-button cancel"
            type="button"
            onClick={resumeScanner}
            disabled={loading}
          >
            Try Another QR Code
          </button>
        </div>
      )}
    </main>
  );
}
