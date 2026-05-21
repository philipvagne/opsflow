import { useEffect, useState } from "react";
import api from "../api";
import { createSocket } from "../socket";

export default function useTasks(token) {
  const [tasks, setTasks] = useState([]);

  // FETCH TASKS
  const fetchTasks = async () => {
    try {
      const res = await api.get("/tasks/my", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setTasks([...res.data.data]);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    }
  };

  // UPDATE STATUS
  const updateTaskStatus = async (
    taskId,
    newStatus
  ) => {
    try {
      await api.patch(
        `/tasks/${taskId}`,
        { status: newStatus },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: newStatus }
            : t
        )
      );
    } catch (err) {
      console.error(
        "Failed to update status:",
        err
      );
    }
  };

const assignTask = async (taskId, assigneeId) => {
  try {
    await api.patch(
      `/tasks/${taskId}/assign`,
      { assigneeId },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // optimistic update (NEW STRUCTURE)
setTasks((prev) =>
  prev.map((t) =>
    t.id === taskId
      ? {
          ...t,
          assignments: t.assignments, // DO NOTHING HERE
        }
      : t
  )
);
  } catch (err) {
    console.error("Failed to assign task:", err);
  }
};

const removeAssignee = async (taskId, assigneeId) => {
  try {
    await api.delete(`/tasks/${taskId}/assign/${assigneeId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (err) {
    console.error("Failed to remove assignee:", err);
  }
};

  
  // SOCKETS
useEffect(() => {
  fetchTasks();

  const socket = createSocket(token);

  // TASK STATUS / CONTENT UPDATES
socket.on("task_updated", (data) => {
  console.log("task_updated RECEIVED:", data);

  setTasks((prev) => {
    const exists = prev.some(
      (task) => task.id === data.taskId
    );

    // UPDATE EXISTING TASK
    if (exists) {
      return prev.map((task) =>
        task.id === data.taskId
          ? {
              ...task,
              status: data.status,
              title: data.title,
              assignments: data.assignments || [],
            }
          : task
      );
    }

    // INSERT NEWLY ASSIGNED TASK
    return [
      ...prev,
      {
        id: data.taskId,
        title: data.title,
        status: data.status,
        assignments: data.assignments || [],
      },
    ];
  });
});;

  // CLEANUP (VERY IMPORTANT)
  return () => {
    socket.off("task_updated");
    socket.disconnect();
  };
}, [token]);

  // GROUP TASKS
  const todoTasks = tasks.filter(
    (t) => t.status === "TODO"
  );

  const inProgressTasks = tasks.filter(
    (t) => t.status === "IN_PROGRESS"
  );

  const doneTasks = tasks.filter(
    (t) => t.status === "DONE"
  );

return {
  tasks,
  todoTasks,
  inProgressTasks,
  doneTasks,
  fetchTasks,
  updateTaskStatus,
  assignTask,
  removeAssignee,
};
}