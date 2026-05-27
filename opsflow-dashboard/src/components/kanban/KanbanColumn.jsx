import TaskCard from "./TaskCard";
import { useDroppable } from "@dnd-kit/core";

export default function KanbanColumn({
  id,
  title,
  tasks,
  setSelectedTask,
}) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={
        isOver
          ? "kanban-column drop-target-active"
          : "kanban-column"
      }
    >
      <div className="kanban-column-header">
        <h4>{title}</h4>

        <span className="count-pill">
          {tasks.length}
        </span>
      </div>

      <div className="kanban-column-list">
        {tasks.length === 0 ? (
          <div className="kanban-empty">
            No tasks here
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={setSelectedTask}
            />
          ))
        )}
      </div>
    </div>
  );
}
