export default function TopBar({
  centerSlot,
  actions,
}) {
  return (
    <header className="dashboard-topbar">
      <div className="topbar-brand-group">
        <div className="topbar-brand brand-wordmark" aria-label="Zorune">
          <span className="brand-wordmark-anchor">Zo</span>
          <span className="brand-wordmark-gradient">rune</span>
        </div>
      </div>

      <div className="topbar-search-slot">{centerSlot}</div>

      <div className="dashboard-topbar-actions">
        {actions}
      </div>
    </header>
  );
}
