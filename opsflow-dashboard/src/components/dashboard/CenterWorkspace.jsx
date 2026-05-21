export default function CenterWorkspace({
  eyebrow = "Workspace",
  title,
  actions,
  children,
}) {
  return (
    <main className="dashboard-center-workspace">
      <div className="workspace-header">
        <div>
          <div className="dashboard-eyebrow">{eyebrow}</div>
          <h3>{title}</h3>
        </div>

        {actions && (
          <div className="workspace-header-actions">
            {actions}
          </div>
        )}
      </div>

      {children}
    </main>
  );
}
