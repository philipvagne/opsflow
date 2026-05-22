export default function RightRail({ children }) {
  return (
    <aside className="dashboard-right-rail">
      <div className="rail-section-title">Notifications</div>
      {children}
    </aside>
  );
}
