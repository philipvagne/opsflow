import { useEffect, useState } from "react";
import api from "../api";
import { createSocket } from "../socket";

export default function Dashboard({ token }) {
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [openNotifications, setOpenNotifications] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // Optional (useful later)
  const userId = JSON.parse(atob(token.split(".")[1])).sub;

  // Unread badge count
  const unreadCount = notifications.filter(
    (n) => !n.isRead
  ).length;

  const normalizeNotification = (n) => ({
  id: n.id || n.notificationId,
  message: n.message,
  type: n.type,
  taskId: n.taskId,
  isRead: n.isRead ?? false,
});

const normalizeTask = (t) => ({
  id: t.id || t.taskId,
  title: t.title,
  description: t.description,
  status: t.status,
  assigneeId: t.assigneeId,
});

  // LOAD DATA + SOCKET
  useEffect(() => {
  fetchTasks();
  fetchNotifications();

  const socket = createSocket(token);

  // 🔔 NOTIFICATIONS
  socket.on("notification", (data) => {
    const normalized = {
      id: data.id || data.notificationId,
      message: data.message,
      type: data.type,
      taskId: data.taskId,
      isRead: data.isRead ?? false,
    };

    setNotifications((prev) => {
      const exists = prev.some((n) => n.id === normalized.id);
      if (exists) return prev;
      return [normalized, ...prev];
    });

      // 🔥 THIS IS THE REAL FIX
  if (normalized.type === "TASK_ASSIGNED") {
    fetchTasks();
  }

  });
 
  // 📌 TASK UPDATED
socket.on("task_updated", () => {
  console.log("TASK_UPDATED → refetching tasks");

  fetchTasks(); // 🔥 source of truth
});

return () => socket.disconnect();
}, [token]);

  // CLICK OUTSIDE CLOSE
  useEffect(() => {
    const handleClickOutside = () => {
      if (openNotifications) {
        setOpenNotifications(false);
      }
    };

    document.addEventListener(
      "click",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "click",
        handleClickOutside
      );
    };
  }, [openNotifications]);

  useEffect(() => {
  const handleEsc = (event) => {
    if (event.key === "Escape") {
      setSelectedTask(null);
    }
  };

  window.addEventListener("keydown", handleEsc);

  return () => {
    window.removeEventListener("keydown", handleEsc);
  };
}, []);

  // FETCH TASKS
const fetchTasks = async () => {
  try {
    const res = await api.get("/tasks/my", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    setTasks([...res.data.data]); // force fresh reference
  } catch (err) {
    console.error("Failed to fetch tasks:", err);
  }
};

  // FETCH NOTIFICATIONS
  const fetchNotifications = async () => {
    try {
      const res = await api.get(
        "/tasks/notifications",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setNotifications(res.data);
    } catch (err) {
      console.error(
        "Failed to fetch notifications:",
        err
      );
    }
  };

  // MARK AS READ
  const markAsRead = async (notificationId) => {
    try {
      await api.patch(
        `/notifications/${notificationId}/read`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // update local state instantly
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId
            ? { ...n, isRead: true }
            : n
        )
      );
    } catch (err) {
      console.error(
        "Failed to mark notification as read:",
        err
      );
    }
  };

  const updateTaskStatus = async (taskId, newStatus) => {
  try {
    const res = await api.patch(
      `/tasks/${taskId}`,
      { status: newStatus },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // update local state immediately
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: newStatus }
          : t
      )
    );

    // also update modal if open
    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) => ({
        ...prev,
        status: newStatus,
      }));
    }
  } catch (err) {
    console.error("Failed to update status:", err);
  }
};

const assignTask = async (taskId, assigneeId) => {
  try {
    const res = await api.patch(
      `/tasks/${taskId}/assign`,
      { assigneeId },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // update local task state
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, assigneeId }
          : t
      )
    );

    // update modal if open
    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) => ({
        ...prev,
        assigneeId,
      }));
    }
  } catch (err) {
    console.error("Failed to assign task:", err);
  }
};

  // TASK GROUPS
  const todoTasks = tasks.filter(
    (t) => t.status === "TODO"
  );

  const inProgressTasks = tasks.filter(
    (t) => t.status === "IN_PROGRESS"
  );

  const doneTasks = tasks.filter(
    (t) => t.status === "DONE"
  );

  return (
    <div>
      <h2>Dashboard</h2>

      {/* NOTIFICATION SYSTEM */}
      <div
        style={{
          position: "relative",
          display: "inline-block",
        }}
      >
        {/* BUTTON */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpenNotifications((prev) => !prev);
          }}
        >
          🔔 Notifications{" "}
          {unreadCount > 0 &&
            `(${unreadCount})`}
        </button>

        {/* DROPDOWN */}
        {openNotifications && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: "40px",
              right: "0",
              width: "320px",
              background: "white",
              border: "1px solid #ddd",
              borderRadius: "10px",
              boxShadow:
                "0 8px 20px rgba(0,0,0,0.12)",
              zIndex: 1000,
              overflow: "hidden",
            }}
          >
            {/* HEADER */}
            <div
              style={{
                padding: "10px",
                borderBottom:
                  "1px solid #eee",
                fontWeight: "bold",
              }}
            >
              Notifications
            </div>

            {/* CONTENT */}
            <div
              style={{
                maxHeight: "300px",
                overflowY: "auto",
              }}
            >
              {notifications.length === 0 ? (
                <div
                  style={{
                    padding: "10px",
                    color: "#666",
                  }}
                >
                  No notifications yet
                </div>
              ) : (
                notifications.map((n, i) => (
                  <div
                    key={n.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsRead(n.id);
                    }}
                    style={{
                      padding: "10px",
                      borderBottom:
                        "1px solid #f1f1f1",
                      fontWeight: n.isRead
                        ? "normal"
                        : "bold",
                      fontSize: "14px",
                      cursor: "pointer",
                      background: n.isRead
                        ? "white"
                        : "#f5f9ff",
                    }}
                  >
                    {n.message}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* KANBAN BOARD */}
      <h3 style={{ marginTop: "30px" }}>
        Kanban Board
      </h3>

      <div
        style={{
          display: "flex",
          gap: "20px",
          alignItems: "flex-start",
          marginTop: "20px",
        }}
      >

        {/* TODO COLUMN */}
        <div
          style={{
            flex: 1,
            background: "#f5f5f5",
            padding: "15px",
            borderRadius: "10px",
            minHeight: "400px",
          }}
        >
          <h4>TODO</h4>

          {todoTasks.map((task) => (
            <div
              key={task.id}
              onClick={() => setSelectedTask(task)}
              style={{
                background: "white",
                cursor: "pointer",
                padding: "12px",
                borderRadius: "8px",
                marginBottom: "10px",
                boxShadow:
                  "0 2px 6px rgba(0,0,0,0.08)",
              }}
            >
              {task.title}
            </div>
          ))}
        </div>

        {/* IN PROGRESS COLUMN */}
        <div
          style={{
            flex: 1,
            background: "#f5f5f5",
            padding: "15px",
            borderRadius: "10px",
            minHeight: "400px",
          }}
        >
          <h4>IN PROGRESS</h4>

          {inProgressTasks.map((task) => (
            <div
              key={task.id}
              onClick={() => setSelectedTask(task)}
              style={{
                background: "white",
                cursor: "pointer",
                padding: "12px",
                borderRadius: "8px",
                marginBottom: "10px",
                boxShadow:
                  "0 2px 6px rgba(0,0,0,0.08)",
              }}
            >
              {task.title}
            </div>
          ))}
        </div>

        {/* DONE COLUMN */}
        <div
          style={{
            flex: 1,
            background: "#f5f5f5",
            padding: "15px",
            borderRadius: "10px",
            minHeight: "400px",
          }}
        >
          <h4>DONE</h4>

          {doneTasks.map((task) => (
            <div
              key={task.id}
              onClick={() => setSelectedTask(task)}
              style={{
                background: "white",
                cursor: "pointer",
                padding: "12px",
                borderRadius: "8px",
                marginBottom: "10px",
                boxShadow:
                  "0 2px 6px rgba(0,0,0,0.08)",
              }}
            >
              {task.title}
            </div>
          ))}
        </div>

      </div>
     
      {/* TASK MODAL */}
      {selectedTask && (
        <div
          onClick={() => setSelectedTask(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 2000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              width: "520px",
              maxWidth: "90%",
              borderRadius: "14px",
              padding: "24px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            {/* HEADER */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <h2 style={{ margin: 0 }}>
              {selectedTask.title}
            </h2>

            <button
              onClick={() => setSelectedTask(null)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: "18px",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>

          {/* STATUS CONTROLS */}
          <div style={{ marginBottom: "15px" }}>
            <strong>Status</strong>

            <div style={{ marginTop: "10px", display: "flex", gap: "8px" }}>
              <button
                onClick={() =>
                  updateTaskStatus(selectedTask.id, "TODO")
                }
              >
                TODO
              </button>

              <button
                onClick={() =>
                  updateTaskStatus(selectedTask.id, "IN_PROGRESS")
                }
              >
                IN PROGRESS
              </button>

              <button
                onClick={() =>
                  updateTaskStatus(selectedTask.id, "DONE")
                }
              >
                DONE
              </button>
            </div>

            <div style={{ marginTop: "10px", fontSize: "12px", color: "#666" }}>
              Current: <strong>{selectedTask.status}</strong>
            </div>
          </div>

          {/* ASSIGN TASK */}
          <div style={{ marginTop: "20px" }}>
            <strong>Assign Task</strong>

            <div style={{ marginTop: "10px" }}>
              <input
                type="text"
                placeholder="Enter user ID"
                defaultValue={selectedTask.assigneeId || ""}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    assignTask(
                      selectedTask.id,
                      e.target.value
                    );
                  }
                }}
                style={{
                  padding: "8px",
                  width: "100%",
                  borderRadius: "6px",
                  border: "1px solid #ccc",
                }}
              />
            </div>

            <div style={{ fontSize: "12px", color: "#666", marginTop: "6px" }}>
              Press Enter to assign
            </div>
          </div>

          {/* DESCRIPTION */}
          <div style={{ marginTop: "20px" }}>
            <strong>Description</strong>
            <p style={{ marginTop: "8px", color: "#444" }}>
              {selectedTask.description || "No description"}
            </p>
          </div>

          {/* FOOTER INFO */}
          <div
            style={{
              marginTop: "25px",
              fontSize: "12px",
              color: "#888",
            }}
          >
            Task ID: {selectedTask.id}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}