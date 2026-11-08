import { useEffect, useRef, useState } from "react";

const GOOGLE_IDENTITY_SCRIPT = "google-identity-services";
let initializedClientId = null;
let activeCredentialHandler = null;

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google);
  }

  return new Promise((resolve, reject) => {
    let script = document.getElementById(GOOGLE_IDENTITY_SCRIPT);

    if (!script) {
      script = document.createElement("script");
      script.id = GOOGLE_IDENTITY_SCRIPT;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    script.addEventListener("load", () => {
      if (window.google?.accounts?.id) {
        resolve(window.google);
      } else {
        reject(new Error("Google sign-in could not be initialized."));
      }
    }, { once: true });

    script.addEventListener("error", () => {
      reject(new Error("Unable to load Google sign-in."));
    }, { once: true });
  });
}

export default function GoogleSignInButton({
  onCredential,
  disabled,
  iconOnly = false,
}) {
  const buttonRef = useRef(null);
  const onCredentialRef = useRef(onCredential);
  const [error, setError] = useState("");
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const isEmbeddedBrowser =
    /(FBAN|FBAV|FB_IAB|Messenger|Instagram|; wv\))/i.test(
      navigator.userAgent
    );
  const isAndroid = /Android/i.test(navigator.userAgent);
  const chromeIntentUrl = (() => {
    const currentUrl = new URL(window.location.href);
    const fallbackUrl = encodeURIComponent(currentUrl.href);
    const path = `${currentUrl.host}${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;

    return `intent://${path}#Intent;scheme=${currentUrl.protocol.slice(
      0,
      -1
    )};package=com.android.chrome;S.browser_fallback_url=${fallbackUrl};end`;
  })();

  useEffect(() => {
    onCredentialRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    const buttonElement = buttonRef.current;
    if (!clientId || !buttonElement || isEmbeddedBrowser) return undefined;

    let active = true;
    const credentialHandler = (credential) => {
      if (!credential) {
        setError("Google did not return a verified sign-in credential.");
        return;
      }

      onCredentialRef.current(credential);
    };
    activeCredentialHandler = credentialHandler;

    loadGoogleIdentity()
      .then((google) => {
        if (!active) return;

        if (initializedClientId === null) {
          google.accounts.id.initialize({
            client_id: clientId,
            callback: (response) => {
              activeCredentialHandler?.(response.credential || null);
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          });
          initializedClientId = clientId;
        } else if (initializedClientId !== clientId) {
          throw new Error(
            "Google sign-in is already initialized with a different client ID. Reload the page."
          );
        }

        google.accounts.id.renderButton(buttonElement, {
          type: iconOnly ? "icon" : "standard",
          theme: "outline",
          size: "large",
          ...(iconOnly
            ? { shape: "circle" }
            : {
                text: "continue_with",
                shape: "rect",
                width: Math.min(buttonElement.clientWidth, 400),
              }),
        });
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      });

    return () => {
      active = false;
      if (activeCredentialHandler === credentialHandler) {
        activeCredentialHandler = null;
      }
      buttonElement.replaceChildren();
    };
  }, [clientId, iconOnly, isEmbeddedBrowser]);

  return (
    <div
      className={[
        "auth-google",
        disabled && "is-disabled",
        iconOnly && "is-icon-only",
      ].filter(Boolean).join(" ")}
    >
      {isEmbeddedBrowser ? (
        <div className="auth-google-browser-message" role="status">
          <p>
            Google sign-in does not work inside Messenger or other in-app
            browsers.{" "}
            {isAndroid
              ? "Open CampusConnect in Chrome, then try again."
              : "Open this page in your phone's browser, then try again."}
          </p>
          {isAndroid && (
            <a className="auth-google-browser-link" href={chromeIntentUrl}>
              Open in Chrome
            </a>
          )}
        </div>
      ) : clientId ? (
        <>
          <div ref={buttonRef} />
          {iconOnly && (
            <span
              className="auth-google-icon-overlay"
              aria-hidden="true"
            >
              G
            </span>
          )}
        </>
      ) : (
        <button
          type="button"
          className="auth-google-placeholder"
          disabled
          aria-label={iconOnly
            ? "Continue with Google"
            : "Continue with Google, currently unavailable"}
          title="Google OAuth must be configured to enable this option."
        >
          <span className="auth-google-g" aria-hidden="true">G</span>
          {!iconOnly && <span>Continue with Google</span>}
        </button>
      )}
      {error && <p className="auth-google-note" role="alert">{error}</p>}
    </div>
  );
}
