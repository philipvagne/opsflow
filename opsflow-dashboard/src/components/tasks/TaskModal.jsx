import { useEffect, useState } from "react";
import { searchUsers } from "../../api";

export default function TaskModal({
  task,
  onClose,
  token,
  updateTaskStatus,
  updateTaskDueDate,
  assignTask,
  removeAssignee,
}) {
  const [assigneeQuery, setAssigneeQuery] = useState("");
  const [dueDateValue, setDueDateValue] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    if (!task) {
      return;
    }

    setAssigneeQuery("");
    setDueDateValue(task.dueDate ? task.dueDate.slice(0, 10) : "");
    setUserResults([]);
    setSearchError("");
  }, [task?.id, task?.dueDate]);

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
                  {user.username ? `@${user.username} · ` : ""}
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
