import { useCallback, useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import api from "../../api";
import "./AdminAttendanceScanner.css";

export default function AdminAttendanceScanner() {
  const [scanResult, setScanResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const scannerRef = useRef(null);
  const scanInProgressRef = useRef(false);

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
    const scanner = new Html5QrcodeScanner(
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

    return () => {
      scannerRef.current = null;
      scanner.clear().catch((clearError) => {
        console.error("Unable to stop QR scanner:", clearError);
      });
    };
  }, []);

  return (
    <main className="admin-scanner-container">
      <h2>Event Attendance Scanner</h2>
      <p>
        Scan a student&apos;s event QR ticket. Attendance is recorded as soon as
        the ticket is accepted.
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
          <h4 className="admin-scanner-student-name">
            {scanResult.full_name || "Student"}
          </h4>
          <p className="admin-scanner-student-detail">
            Student ID: <strong>{scanResult.student_no || "N/A"}</strong>
          </p>
          <p className="admin-scanner-student-detail">
            Department: {scanResult.department || "N/A"}
          </p>
          <p className="admin-scanner-student-detail">
            Event: <strong>{scanResult.event_title || "N/A"}</strong>
          </p>
          {scanResult.attendance_status && (
            <p className="admin-scanner-student-detail">
              Status: <strong>{scanResult.attendance_status}</strong>
            </p>
          )}
          {scanResult.scanned_at && (
            <p className="admin-scanner-student-detail">
              Scanned: {scanResult.scanned_at}
            </p>
          )}
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
