import { useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "./SessionControls.css";

function LogoutConfirmation({ closeToast, onConfirm }) {
    return (
        <div className="logout-confirmation">
            <p>Are you sure you want to log out?</p>
            <div>
                <button
                    type="button"
                    className="logout-confirmation-cancel"
                    onClick={closeToast}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    className="logout-confirmation-confirm"
                    onClick={onConfirm}
                >
                    Log out
                </button>
            </div>
        </div>
    );
}

export default function SessionControls() {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const isAuthenticatedPage =
        pathname.startsWith("/admin") || pathname.startsWith("/students");
    const hasSession = Boolean(
        localStorage.getItem("campusconnect_token") ||
            sessionStorage.getItem("campusconnect_token") ||
            localStorage.getItem("token") ||
            sessionStorage.getItem("token")
    );

    const showLogoutConfirmation = useCallback(() => {
        toast.info(
            ({ closeToast }) => (
                <LogoutConfirmation
                    closeToast={closeToast}
                    onConfirm={() => {
                        toast.dismiss();
                        [
                            "campusconnect_token",
                            "campusconnect_user",
                            "campusconnect_remember",
                            "token",
                            "user",
                        ].forEach((key) => {
                            localStorage.removeItem(key);
                            sessionStorage.removeItem(key);
                        });
                        navigate("/login", { replace: true });
                    }}
                />
            ),
            {
                autoClose: false,
                closeButton: false,
                closeOnClick: false,
                draggable: false,
            }
        );
    }, [navigate]);

    useEffect(() => {
        function handleLogoutRequest() {
            showLogoutConfirmation();
        }

        window.addEventListener("campusconnect:logout-request", handleLogoutRequest);
        return () =>
            window.removeEventListener(
                "campusconnect:logout-request",
                handleLogoutRequest
            );
    }, [showLogoutConfirmation]);

    if (!isAuthenticatedPage || !hasSession) return null;

    return (
        <button
            type="button"
            className="session-logout-button"
            onClick={showLogoutConfirmation}
        >
            <span aria-hidden="true">↪</span>
            Log out
        </button>
    );
}
