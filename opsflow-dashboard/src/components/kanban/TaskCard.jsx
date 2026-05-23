import { useDraggable } from "@dnd-kit/core";

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

  const statusColors = {
    TODO: "#f59e0b",
    IN_PROGRESS: "#3b82f6",
    DONE: "#10b981",
  };
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
      style={{
        borderLeft: `4px solid ${statusColors[task.status] || "#ccc"}`,
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        opacity: isDragging ? 0.7 : 1,
      }}
    >
      <div className="task-card-header">
        <div className="task-card-title">
          {task.title}
        </div>

        <button
          type="button"
          className="task-drag-handle"
          aria-label={`Drag ${task.title}`}
          onClick={(event) => event.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          ::
        </button>
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
