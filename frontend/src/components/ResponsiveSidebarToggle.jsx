import { useEffect } from "react";
import { createPortal } from "react-dom";
import "./ResponsiveSidebarToggle.css";

export default function ResponsiveSidebarToggle({ isOpen, onClick }) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClick();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClick]);

  return (
    <>
      {isOpen &&
        createPortal(
          <button
            type="button"
            className="responsive-sidebar-backdrop"
            aria-label="Close navigation"
            onClick={onClick}
          />,
          document.body
        )}
      {createPortal(
        <button
          type="button"
          className={`responsive-sidebar-toggle ${
            isOpen ? "responsive-sidebar-toggle-open" : ""
          }`}
          aria-label={isOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={isOpen}
          onClick={onClick}
        >
          <span />
          <span />
          <span />
        </button>,
        document.body
      )}
    </>
  );
}
