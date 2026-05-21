export default function TaskCard({ task, onClick }) {
  const statusColors = {
    TODO: "#f59e0b",
    IN_PROGRESS: "#3b82f6",
    DONE: "#10b981",
  };
  const hasDueDate = Boolean(task.dueDate);
  const isOverdue =
    hasDueDate &&
    task.status !== "DONE" &&
    new Date(task.dueDate).setHours(0, 0, 0, 0) <
      new Date().setHours(0, 0, 0, 0);

  return (
    <div
      onClick={() => onClick(task)}
      style={{
        background: "white",
        cursor: "pointer",
        padding: "12px",
        borderRadius: "10px",
        marginBottom: "10px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
        borderLeft: `4px solid ${statusColors[task.status] || "#ccc"}`,
        transition: "transform 0.1s ease",
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = "scale(1.02)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {/* TITLE */}
      <div style={{ fontWeight: "bold", lineHeight: 1.35 }}>
        {task.title}
      </div>

      {hasDueDate && (
        <div
          style={{
            display: "inline-flex",
            marginTop: "8px",
            padding: "3px 7px",
            borderRadius: "999px",
            background: isOverdue ? "#fee2e2" : "#f3f4f6",
            color: isOverdue ? "#991b1b" : "#555",
            fontSize: "12px",
            fontWeight: isOverdue ? "bold" : "normal",
          }}
        >
          Due {new Date(task.dueDate).toLocaleDateString()}
        </div>
      )}

      {/* ASSIGNEE AVATAR STACK */}
      {task.assignments?.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: "12px",
          }}
        >
          {task.assignments.map((assignment, index) => {
            const name =
              assignment.user?.fullName ||
              assignment.user?.email ||
              "U";

            const initials = name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

            return (
              <div
                key={assignment.id}
                title={name}
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#4f46e5",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  fontWeight: "bold",
                  marginLeft: index === 0 ? "0" : "-8px",
                  border: "2px solid white",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              >
                {initials}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
