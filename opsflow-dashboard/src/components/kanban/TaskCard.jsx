import { useDraggable } from "@dnd-kit/core";

export function TaskCardPreview({ task }) {
  const priorityColors = {
    LOW: "#16a34a",
    MEDIUM: "#f59e0b",
    HIGH: "#ef4444",
    DEFAULT: "rgba(125, 120, 153, 0.4)",
  };
  const rawPriority =
    task.priority ??
    task.priorityLevel ??
    task.priority_label ??
    task.priorityLabel ??
    "";
  const normalizedPriority = String(rawPriority).trim().toUpperCase();
  const priorityStripeColor =
    priorityColors[normalizedPriority] || priorityColors.DEFAULT;
  const assigneeCount = task.assignments?.length || 0;

  return (
    <div
      className="task-card task-card-drag-overlay"
      style={{
        borderLeft: `4px solid ${priorityStripeColor}`,
      }}
    >
      <div className="task-card-header">
        <div className="task-card-title">{task.title}</div>
        <span className="task-card-corner-slot" aria-hidden="true" />
      </div>

      {task.assignments?.length > 0 ? (
        <div className="task-card-footer">
          <div className="avatar-stack">
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
                  className="user-avatar"
                  title={name}
                  style={{
                    marginLeft: index === 0 ? "0" : "-7px",
                  }}
                >
                  {initials}
                </div>
              );
            })}
          </div>

          {assigneeCount > 2 ? (
            <span className="task-card-meta-text">
              {assigneeCount} assignees
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function TaskCard({ task, onClick }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: task.id,
    data: {
      status: task.status,
    },
  });

  const priorityColors = {
    LOW: "#16a34a",
    MEDIUM: "#f59e0b",
    HIGH: "#ef4444",
    DEFAULT: "#602dfe",
  };
  const rawPriority =
    task.priority ??
    task.priorityLevel ??
    task.priority_label ??
    task.priorityLabel ??
    "";
  const normalizedPriority = String(rawPriority).trim().toUpperCase();
  const priorityStripeColor =
    priorityColors[normalizedPriority] || priorityColors.DEFAULT;
  const hasDueDate = Boolean(task.dueDate);
  const unreadNoteCount = task.unreadNoteCount || 0;
  const isOverdue =
    hasDueDate &&
    task.status !== "DONE" &&
    new Date(task.dueDate).setHours(0, 0, 0, 0) <
      new Date().setHours(0, 0, 0, 0);
  const assigneeCount = task.assignments?.length || 0;

  return (
    <div
      ref={setNodeRef}
      className="task-card"
      onClick={() => onClick(task)}
      {...attributes}
      {...listeners}
      style={{
        borderLeft: `2px solid ${priorityStripeColor}`,
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        opacity: isDragging ? 0.22 : 1,
        position: "relative",
        zIndex: isDragging ? 30 : 1,
      }}
    >
      <div className="task-card-header">
        <div className="task-card-title">
          {task.title}
        </div>

        <span className="task-card-corner-slot" aria-hidden="true" />
      </div>

      {hasDueDate && (
        <div
          className={
            isOverdue
              ? "task-card-date overdue"
              : "task-card-date"
          }
        >
          Due {new Date(task.dueDate).toLocaleDateString()}
        </div>
      )}

      {task.assignments?.length > 0 && (
        <div className="task-card-footer">
          <div className="avatar-stack">
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
                className="user-avatar"
                title={name}
                style={{
                  marginLeft: index === 0 ? "0" : "-7px",
                }}
              >
                {initials}
              </div>
            );
          })}
          </div>

          {assigneeCount > 2 ? (
            <span className="task-card-meta-text">
              {assigneeCount} assignees
            </span>
          ) : null}
        </div>
      )}

      {unreadNoteCount > 0 && (
        <div className="task-card-awareness-footer">
          <span className="task-awareness-text">
            {unreadNoteCount} new note{unreadNoteCount > 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
}
