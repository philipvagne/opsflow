export default function ContextPanel({ children }) {
  const hasDetails = Boolean(children);

  return (
    <section
      className={
        hasDetails
          ? "dashboard-context-panel"
          : "dashboard-context-panel is-empty"
      }
    >
      {hasDetails ? (
        children
      ) : (
        <div className="context-panel-empty">
          Select a task to view details
        </div>
      )}
    </section>
  );
}
