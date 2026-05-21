import { useEffect, useState } from "react";
import api from "../api";
import { createSocket } from "../socket";

function getUserIdFromToken(token) {
  try {
    const payload = token.split(".")[1];
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "="
    );
    const decodedPayload = JSON.parse(atob(paddedPayload));

    return decodedPayload.sub;
  } catch (err) {
    console.error("Failed to read user id from token:", err);
    return null;
  }
}

function isTaskAssignedToUser(assignments, userId) {
  return assignments.some(
    (assignment) =>
      assignment.userId === userId ||
      assignment.user?.id === userId
  );
}

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
  const updateTask = async (taskId, updates) => {
    try {
      await api.patch(
        `/tasks/${taskId}`,
        updates,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, ...updates }
            : t
        )
      );
    } catch (err) {
      console.error(
        "Failed to update task:",
        err
      );
    }
  };

  const updateTaskStatus = async (
    taskId,
    newStatus
  ) => {
    return updateTask(taskId, { status: newStatus });
  };

  const updateTaskDueDate = async (
    taskId,
    dueDate
  ) => {
    return updateTask(taskId, { dueDate });
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
  const currentUserId = getUserIdFromToken(token);

  // TASK STATUS / CONTENT UPDATES
socket.on("task_updated", (data) => {
  console.log("task_updated RECEIVED:", data);

  if (!currentUserId) {
    return;
  }

  const assignments = data.assignments || [];
  const isAssignedToCurrentUser = isTaskAssignedToUser(
    assignments,
    currentUserId
  );

  setTasks((prev) => {
    if (!isAssignedToCurrentUser) {
      return prev.filter((task) => task.id !== data.taskId);
    }

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
              dueDate: data.dueDate,
              assignments,
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
        dueDate: data.dueDate,
        assignments,
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
  updateTask,
  updateTaskStatus,
  updateTaskDueDate,
  assignTask,
  removeAssignee,
};
}
