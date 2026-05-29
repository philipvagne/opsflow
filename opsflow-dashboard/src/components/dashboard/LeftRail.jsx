function getInitials(value) {
  return (value || "OF")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const primaryNavItems = [
  { id: "organizations", label: "Teams", icon: "teams" },
  { id: "projects", label: "Projects", icon: "projects" },
  { id: "profile", label: "Profile", icon: "profile" },
  { id: "settings", label: "Settings", icon: "settings" },
];

export default function LeftRail({
  summaryItems = [],
  currentUser,
  activeView,
  onViewChange,
}) {
  return (
    <aside className="dashboard-left-rail dashboard-left-rail-structured">
      <section className="left-rail-today-card">
        <div className="left-rail-card-header">
          <h2>Today</h2>
        </div>

        <div className="left-rail-summary-list">
          {summaryItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className="left-rail-summary-item"
              onClick={() => onViewChange?.("tasks")}
            >
              <span
                className={`left-rail-summary-dot ${item.tone || ""}`}
                aria-hidden="true"
              />
              <span className="left-rail-summary-label">
                <span className="left-rail-summary-value">{item.value}</span>{" "}
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </section>

      <nav className="left-rail-primary-nav" aria-label="Primary navigation">
        {primaryNavItems.map((item) => {
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              type="button"
              className={isActive ? "left-rail-nav-item active" : "left-rail-nav-item"}
              onClick={() => onViewChange?.(item.id)}
            >
              <span
                className={`left-rail-nav-icon left-rail-nav-icon-${item.icon}`}
                aria-hidden="true"
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <section className="left-rail-profile-card">
        <div className="left-rail-profile-avatar">
          {getInitials(currentUser?.name || currentUser?.email)}
        </div>
        <div className="left-rail-profile-copy">
          <strong>{currentUser?.name || "OpsFlow Member"}</strong>
          <span>{currentUser?.email || "workspace@opsflow.com"}</span>
        </div>
        <button
          type="button"
          className="left-rail-profile-action"
          onClick={() => onViewChange?.("profile")}
          aria-label="Open profile"
          title="Open profile"
        >
          <span aria-hidden="true" className="left-rail-profile-chevron" />
        </button>
      </section>
    </aside>
  );
}
