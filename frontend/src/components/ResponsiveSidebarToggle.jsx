import "./ResponsiveSidebarToggle.css";

export default function ResponsiveSidebarToggle({ isOpen, onClick }) {
  return (
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
    </button>
  );
}
