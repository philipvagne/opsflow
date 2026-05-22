const navItems = [
  {
    id: "tasks",
    label: "Active Tasks",
    icon: "[]",
  },
  {
    id: "archive",
    label: "Archived Tasks",
    icon: "##",
  },
  {
    id: "projects",
    label: "Projects",
    icon: "//",
  },
  {
    id: "organizations",
    label: "Organizations",
    icon: "::",
  },
  {
    id: "profile",
    label: "Profile",
    icon: "@@",
  },
  {
    id: "settings",
    label: "Settings",
    icon: "**",
  },
];

export default function TopBar({
  activeView,
  onViewChange,
  actions,
}) {
  return (
    <header className="dashboard-topbar">
      <nav className="top-launcher" aria-label="Workspace navigation">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={activeView === item.id ? "active" : ""}
            title={item.label}
            aria-label={item.label}
            onClick={() => onViewChange(item.id)}
          >
            {item.icon}
          </button>
        ))}
      </nav>

      <div className="dashboard-topbar-actions">
        {actions}
      </div>
    </header>
  );
}
