function getPresenceName(user) {
  return user.fullName || user.username || user.email || "User";
}

function getInitials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const workspaceGroups = [
  {
    title: "Task Views",
    items: [
      { id: "kanban", label: "Kanban", kind: "layout" },
      { id: "table", label: "Table View", kind: "layout" },
      { id: "calendar", label: "Calendar View", kind: "layout" },
    ],
  },
  {
    title: "Workspace",
    items: [
      { id: "archive", label: "Archived Tasks", kind: "view" },
      { id: "projects", label: "Projects", kind: "view" },
      { id: "notes", label: "Notes", kind: "view" },
    ],
  },
  {
    title: "Account",
    items: [
      { id: "organizations", label: "Teams", kind: "view" },
      { id: "profile", label: "Profile", kind: "view" },
      { id: "settings", label: "Settings", kind: "view" },
    ],
  },
];

export default function LeftRail({
  onlineUsers = [],
  activeView,
  activeTaskLayout,
  onViewChange,
  onTaskLayoutChange,
}) {
  return (
    <aside className="dashboard-left-rail">
      <div className="rail-identity">
        <div className="rail-brand">Workspace</div>
        <div className="rail-subcopy">Quiet team awareness</div>
      </div>

      <section className="launcher-presence">
        <div className="rail-section-title">Members Online</div>

        {onlineUsers.length === 0 ? (
          <div className="presence-empty">No users online</div>
        ) : (
          <div className="presence-list launcher-presence-list">
            {onlineUsers.map((user) => {
              const name = getPresenceName(user);

              return (
                <div key={user.id} className="presence-user compact">
                  <div className="presence-avatar">
                    {getInitials(name)}
                  </div>
                  <span>{name}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="rail-nav-groups">
        {workspaceGroups.map((group) => (
          <section key={group.title} className="rail-nav-group">
            <div className="rail-section-title">{group.title}</div>

            <div className="rail-nav-list">
              {group.items.map((item) => {
                const isLayout = item.kind === "layout";
                const isActive = isLayout
                  ? activeView === "tasks" && activeTaskLayout === item.id
                  : activeView === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={isActive ? "rail-nav-item active" : "rail-nav-item"}
                    onClick={() => {
                      if (isLayout) {
                        onTaskLayoutChange?.(item.id);
                      } else {
                        onViewChange?.(item.id);
                      }
                    }}
                  >
                    <span className="rail-nav-icon" aria-hidden="true">
                      {isLayout ? "·" : "•"}
                    </span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
