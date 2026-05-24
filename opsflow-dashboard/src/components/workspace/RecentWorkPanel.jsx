function formatRecentTime(value) {
  if (!value) {
    return "";
  }

  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return "";
  }

  const diff = Date.now() - timestamp;
  const minutes = Math.max(1, Math.round(diff / 60000));

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);

  if (days < 7) {
    return `${days}d ago`;
  }

  return new Date(value).toLocaleDateString();
}

function RecentWorkSection({
  title,
  items,
  emptyText,
  onSelect,
}) {
  return (
    <section className="recent-work-section">
      <div className="recent-work-section-title">{title}</div>

      {items.length === 0 ? (
        <div className="recent-work-empty">{emptyText}</div>
      ) : (
        <div className="recent-work-list">
          {items.map((item) => (
            <button
              key={`${item.type || title}-${item.id}`}
              type="button"
              className="recent-work-item"
              onClick={() => onSelect?.(item)}
            >
              <div className="recent-work-item-topline">
                <span>{item.label}</span>
                <span>{formatRecentTime(item.recentAt)}</span>
              </div>
              <strong>{item.title}</strong>
              {item.meta ? (
                <div className="recent-work-item-meta">{item.meta}</div>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export default function RecentWorkPanel({
  isOpen,
  recentOrganizations,
  recentTasks,
  recentProjects,
  recentNotes,
  onSelectOrganization,
  onSelectTask,
  onSelectProject,
  onSelectNote,
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="recent-work-panel" onClick={(event) => event.stopPropagation()}>
      <div className="recent-work-panel-header">
        <div className="dashboard-eyebrow">Recent Work</div>
        <span>Quiet continuity</span>
      </div>

      <div className="recent-work-panel-body">
        <RecentWorkSection
        title="Teams"
        items={recentOrganizations}
        emptyText="No recent team context yet."
        onSelect={onSelectOrganization}
      />

        <RecentWorkSection
          title="Tasks"
          items={recentTasks}
          emptyText="No recent task work yet."
          onSelect={onSelectTask}
        />

        <RecentWorkSection
          title="Projects"
          items={recentProjects}
          emptyText="No recent project work yet."
          onSelect={onSelectProject}
        />

        <RecentWorkSection
          title="Notes"
          items={recentNotes}
          emptyText="No recent notes yet."
          onSelect={onSelectNote}
        />
      </div>
    </div>
  );
}
