import { useEffect, useState } from "react";
import {
  createTaskUpdate,
  getTaskUpdates,
  searchUsers,
} from "../../api";
import { createSocket } from "../../socket";

export default function TaskModal({
  task,
  onClose,
  token,
  updateTaskStatus,
  updateTaskDueDate,
  assignTask,
  removeAssignee,
  archiveTask,
}) {
  const [assigneeQuery, setAssigneeQuery] = useState("");
  const [dueDateValue, setDueDateValue] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [taskUpdates, setTaskUpdates] = useState([]);
  const [newUpdateMessage, setNewUpdateMessage] = useState("");
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const [archiveError, setArchiveError] = useState("");
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (!task) {
      return;
    }

    setAssigneeQuery("");
    setDueDateValue(task.dueDate ? task.dueDate.slice(0, 10) : "");
    setUserResults([]);
    setSearchError("");
    setNewUpdateMessage("");
    setUpdateError("");
    setArchiveError("");
  }, [task?.id, task?.dueDate]);

  useEffect(() => {
    if (!task || !token) {
      setTaskUpdates([]);
      return;
    }

    let active = true;

    const fetchUpdates = async () => {
      setUpdatesLoading(true);
      setUpdateError("");

      try {
        const res = await getTaskUpdates(token, task.id);

        if (active) {
          setTaskUpdates(res.data);
        }
      } catch (err) {
        if (active) {
          setUpdateError("Could not load updates.");
        }
      } finally {
        if (active) {
          setUpdatesLoading(false);
        }
      }
    };

    fetchUpdates();

    return () => {
      active = false;
    };
  }, [task?.id, token]);

  useEffect(() => {
    if (!task || !token) {
      return;
    }

    const socket = createSocket(token);

    socket.on("task_update_created", (data) => {
      if (data.taskId !== task.id) {
        return;
      }

      setTaskUpdates((current) => {
        const exists = current.some(
          (update) => update.id === data.update.id
        );

        if (exists) {
          return current;
        }

        return [...current, data.update];
      });
    });

    return () => {
      socket.off("task_update_created");
      socket.disconnect();
    };
  }, [task?.id, token]);

  useEffect(() => {
    const query = assigneeQuery.trim();

    if (!token || query.length < 2) {
      setUserResults([]);
      setSearchError("");
      return;
    }

    let active = true;

    const timeoutId = setTimeout(async () => {
      setSearchingUsers(true);
      setSearchError("");

      try {
        const res = await searchUsers(token, query);

        if (active) {
          setUserResults(res.data);
        }
      } catch (err) {
        if (active) {
          setSearchError("Could not search users.");
        }
      } finally {
        if (active) {
          setSearchingUsers(false);
        }
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [assigneeQuery, token]);

  const assignSelectedUser = async (userId) => {
    if (!userId) {
      return;
    }

    await assignTask(task.id, userId);
    setAssigneeQuery("");
    setUserResults([]);
  };

  const submitTaskUpdate = async () => {
    const message = newUpdateMessage.trim();

    if (!message) {
      setUpdateError("Write an update before posting.");
      return;
    }

    setUpdateError("");

    try {
      const res = await createTaskUpdate(token, task.id, message);

      setTaskUpdates((current) => {
        const exists = current.some(
          (update) => update.id === res.data.id
        );

        if (exists) {
          return current;
        }

        return [...current, res.data];
      });
      setNewUpdateMessage("");
    } catch (err) {
      setUpdateError("Could not post update.");
    }
  };

  const handleArchive = async () => {
    if (!task || task.status !== "DONE" || task.archivedAt) {
      return;
    }

    setArchiving(true);
    setArchiveError("");

    try {
      await archiveTask(task.id);
      onClose();
    } catch (err) {
      setArchiveError(
        err.response?.data?.message || "Could not archive task."
      );
    } finally {
      setArchiving(false);
    }
  };

  const formattedDueDate = task?.dueDate
    ? new Date(task.dueDate).toLocaleDateString()
    : "No due date";

  const isOverdue =
    task?.dueDate &&
    task.status !== "DONE" &&
    new Date(task.dueDate).setHours(0, 0, 0, 0) <
      new Date().setHours(0, 0, 0, 0);

  if (!task) return null;

  return (
    <div
      onClick={onClose}
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
          <h2 style={{ margin: 0 }}>{task.title}</h2>

          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "18px",
              cursor: "pointer",
            }}
          >
            x
          </button>
        </div>

        {/* STATUS */}
        <div style={{ marginBottom: "15px" }}>
          <strong>Status</strong>

          <div style={{ marginTop: "10px", display: "flex", gap: "8px" }}>
            <button onClick={() => updateTaskStatus(task.id, "TODO")}>
              TODO
            </button>

            <button onClick={() => updateTaskStatus(task.id, "IN_PROGRESS")}>
              IN PROGRESS
            </button>

            <button onClick={() => updateTaskStatus(task.id, "DONE")}>
              DONE
            </button>
          </div>

          <div style={{ marginTop: "10px", fontSize: "12px", color: "#666" }}>
            Current: <strong>{task.status}</strong>
          </div>

          {task.status === "DONE" && !task.archivedAt && (
            <div style={{ marginTop: "12px" }}>
              <button
                onClick={handleArchive}
                disabled={archiving}
                style={{
                  background: "#111827",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 10px",
                  cursor: archiving ? "not-allowed" : "pointer",
                  opacity: archiving ? 0.7 : 1,
                }}
              >
                {archiving ? "Archiving..." : "Archive completed task"}
              </button>

              {archiveError && (
                <div
                  style={{
                    fontSize: "12px",
                    color: "#991b1b",
                    marginTop: "6px",
                  }}
                >
                  {archiveError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* DUE DATE */}
        <div style={{ marginTop: "20px" }}>
          <strong>Due Date</strong>

          <div
            style={{
              marginTop: "8px",
              fontSize: "13px",
              color: isOverdue ? "#b91c1c" : "#444",
              fontWeight: isOverdue ? "bold" : "normal",
            }}
          >
            {formattedDueDate}
            {isOverdue && " - Overdue"}
          </div>

          <div
            style={{
              display: "flex",
              gap: "8px",
              marginTop: "10px",
            }}
          >
            <input
              type="date"
              value={dueDateValue}
              onChange={(e) => setDueDateValue(e.target.value)}
              style={{
                padding: "8px",
                borderRadius: "6px",
                border: "1px solid #ccc",
              }}
            />

            <button
              onClick={() =>
                updateTaskDueDate(task.id, dueDateValue || null)
              }
            >
              Save
            </button>

            <button
              onClick={() => {
                setDueDateValue("");
                updateTaskDueDate(task.id, null);
              }}
            >
              Clear
            </button>
          </div>
        </div>

      {/* ASSIGN */}
      <div style={{ marginTop: "20px" }}>
        <strong>Assign Task</strong>

        {/* ASSIGNED USERS */}
        <div style={{ marginBottom: "15px", marginTop: "10px" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            {task.assignments?.length ? (
              task.assignments.map((assignment) => (
          <div
            key={assignment.id}
            style={{
              padding: "6px 10px",
              background: "#f3f4f6",
              borderRadius: "999px",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>
              {assignment.user?.fullName ||
                assignment.user?.email ||
                assignment.userId}
            </span>

            <button
              onClick={() =>
                removeAssignee(task.id, assignment.userId)
              }

                onMouseOver={(e) => {
                  e.currentTarget.style.background = "#d1d5db";
                }}

                onMouseOut={(e) => {
                  e.currentTarget.style.background = "#e5e7eb";
                }}

                style={{
                  border: "none",
                  background: "#e5e7eb",
                  cursor: "pointer",
                  fontWeight: "bold",
                  color: "#444",
                  borderRadius: "50%",
                  width: "18px",
                  height: "18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  fontSize: "12px",
                  transition: "0.15s ease",
                }}
            >
              x
            </button>
          </div>
              ))
            ) : (
              <div
                style={{
                  fontSize: "13px",
                  color: "#777",
                }}
              >
                No assignees
              </div>
            )}
          </div>
        </div>

        <input
          type="text"
          placeholder="Search name, username, email, or enter user ID"
          value={assigneeQuery}
          onChange={(e) => setAssigneeQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              assignSelectedUser(e.target.value.trim());
            }
          }}
          style={{
            padding: "8px",
            width: "100%",
            borderRadius: "6px",
            border: "1px solid #ccc",
            marginTop: "10px",
          }}
        />

        {searchingUsers && (
          <div style={{ fontSize: "12px", color: "#666", marginTop: "6px" }}>
            Searching users...
          </div>
        )}

        {searchError && (
          <div style={{ fontSize: "12px", color: "#991b1b", marginTop: "6px" }}>
            {searchError}
          </div>
        )}

        {userResults.length > 0 && (
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              marginTop: "8px",
              overflow: "hidden",
            }}
          >
            {userResults.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => assignSelectedUser(user.id)}
                style={{
                  width: "100%",
                  border: "none",
                  borderBottom: "1px solid #f3f4f6",
                  background: "white",
                  cursor: "pointer",
                  padding: "8px 10px",
                  textAlign: "left",
                }}
              >
                <div style={{ fontSize: "13px", fontWeight: "bold" }}>
                  {user.fullName || user.username || user.email}
                </div>
                <div style={{ fontSize: "12px", color: "#666" }}>
                  {user.username ? `@${user.username} - ` : ""}
                  {user.email}
                </div>
              </button>
            ))}
          </div>
        )}

        <div style={{ fontSize: "12px", color: "#666", marginTop: "6px" }}>
          Select a user from search, or press Enter to assign by raw user ID.
        </div>
      </div>

        {/* PROGRESS UPDATES */}
        <div style={{ marginTop: "20px" }}>
          <strong>Progress Updates</strong>

          <div style={{ marginTop: "10px" }}>
            <textarea
              value={newUpdateMessage}
              onChange={(e) => setNewUpdateMessage(e.target.value)}
              placeholder="Share a progress update..."
              rows={3}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "8px",
                borderRadius: "6px",
                border: "1px solid #ccc",
                resize: "vertical",
                font: "inherit",
              }}
            />

            <button
              onClick={submitTaskUpdate}
              style={{ marginTop: "8px" }}
            >
              Post Update
            </button>
          </div>

          {updateError && (
            <div style={{ fontSize: "12px", color: "#991b1b", marginTop: "6px" }}>
              {updateError}
            </div>
          )}

          <div
            style={{
              marginTop: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              maxHeight: "180px",
              overflowY: "auto",
            }}
          >
            {updatesLoading ? (
              <div style={{ fontSize: "13px", color: "#666" }}>
                Loading updates...
              </div>
            ) : taskUpdates.length === 0 ? (
              <div style={{ fontSize: "13px", color: "#777" }}>
                No progress updates yet
              </div>
            ) : (
              taskUpdates.map((update) => {
                const author =
                  update.user?.fullName ||
                  update.user?.username ||
                  update.user?.email ||
                  "Unknown user";

                return (
                  <div
                    key={update.id}
                    style={{
                      padding: "10px",
                      background: "#f9fafb",
                      border: "1px solid #edf0f3",
                      borderRadius: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "10px",
                        fontSize: "12px",
                        color: "#666",
                        marginBottom: "5px",
                      }}
                    >
                      <span>{author}</span>
                      <span>{new Date(update.createdAt).toLocaleString()}</span>
                    </div>

                    <div style={{ fontSize: "14px", color: "#333" }}>
                      {update.message}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* DESCRIPTION */}
        <div style={{ marginTop: "20px" }}>
          <strong>Description</strong>
          <p style={{ marginTop: "8px", color: "#444" }}>
            {task.description || "No description"}
          </p>
        </div>

        {/* FOOTER */}
        <div
          style={{
            marginTop: "25px",
            fontSize: "12px",
            color: "#888",
          }}
        >
          Task ID: {task.id}
        </div>
      </div>
    </div>
  );
}
