import { useEffect, useState } from "react";
import {
  createNote,
  createTaskUpdate,
  deleteNote,
  getTaskNotes,
  getTaskUpdates,
  searchUsers,
  updateNote,
} from "../../api";
import { createSocket } from "../../socket";

const formatNoteDate = (value) =>
  value ? new Date(value).toLocaleDateString() : "Unknown";

const getNoteAuthor = (note) =>
  note.createdBy?.fullName ||
  note.createdBy?.username ||
  note.createdBy?.email ||
  "Unknown";

const getNotePreview = (content) => {
  const text = content?.trim();

  if (!text) {
    return "No context yet";
  }

  return text.length > 120 ? `${text.slice(0, 120)}...` : text;
};

export default function TaskModal({
  task,
  onClose,
  token,
  updateTaskStatus,
  updateTaskDueDate,
  assignTask,
  removeAssignee,
  archiveTask,
  viewers = [],
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
  const [relatedNotes, setRelatedNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState("");
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [creatingNote, setCreatingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editNoteTitle, setEditNoteTitle] = useState("");
  const [editNoteContent, setEditNoteContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState(null);

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
    setNewNoteTitle("");
    setNewNoteContent("");
    setEditingNoteId(null);
    setEditNoteTitle("");
    setEditNoteContent("");
    setNotesError("");
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
      setRelatedNotes([]);
      return;
    }

    let active = true;

    const fetchRelatedNotes = async () => {
      setNotesLoading(true);
      setNotesError("");

      try {
        const res = await getTaskNotes(token, task.id);

        if (active) {
          setRelatedNotes(res.data);
        }
      } catch (err) {
        if (active) {
          setNotesError("Could not load related notes.");
        }
      } finally {
        if (active) {
          setNotesLoading(false);
        }
      }
    };

    fetchRelatedNotes();

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

  const openNoteEditor = (note) => {
    setEditingNoteId(note.id);
    setEditNoteTitle(note.title || "");
    setEditNoteContent(note.content || "");
    setNotesError("");
  };

  const submitLinkedNote = async () => {
    const title = newNoteTitle.trim();
    const organizationId =
      task?.project?.organizationId || task?.organizationId || null;

    if (!title || !organizationId) {
      setNotesError(
        !title
          ? "Note title is required."
          : "This task is missing organization context. Refresh or reopen the task."
      );
      return;
    }

    setCreatingNote(true);
    setNotesError("");

    try {
      const res = await createNote(token, {
        title,
        content: newNoteContent,
        organizationId,
        projectId: task.project?.id || undefined,
        taskId: task.id,
      });

      setRelatedNotes((current) => [res.data, ...current]);
      setNewNoteTitle("");
      setNewNoteContent("");
      openNoteEditor(res.data);
    } catch (err) {
      setNotesError(
        err.response?.data?.message || "Could not create linked note."
      );
    } finally {
      setCreatingNote(false);
    }
  };

  const saveLinkedNote = async () => {
    const title = editNoteTitle.trim();

    if (!editingNoteId || !title) {
      setNotesError("Note title is required.");
      return;
    }

    setSavingNote(true);
    setNotesError("");

    try {
      const res = await updateNote(token, editingNoteId, {
        title,
        content: editNoteContent,
      });

      setRelatedNotes((current) =>
        current.map((note) =>
          note.id === res.data.id ? res.data : note
        )
      );
    } catch (err) {
      setNotesError(
        err.response?.data?.message || "Could not save linked note."
      );
    } finally {
      setSavingNote(false);
    }
  };

  const removeLinkedNote = async (noteId) => {
    setDeletingNoteId(noteId);
    setNotesError("");

    try {
      await deleteNote(token, noteId);
      setRelatedNotes((current) =>
        current.filter((note) => note.id !== noteId)
      );

      if (editingNoteId === noteId) {
        setEditingNoteId(null);
        setEditNoteTitle("");
        setEditNoteContent("");
      }
    } catch (err) {
      setNotesError(
        err.response?.data?.message || "Could not delete linked note."
      );
    } finally {
      setDeletingNoteId(null);
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
    <div className="task-detail-panel">
        <div
          className="task-detail-header"
        >
          <h2>{task.title}</h2>

          <button
            type="button"
            aria-label="Close task details"
            className="task-detail-close"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <section className="task-panel-section compact">
          <strong>Viewing this task</strong>

          {viewers.length === 0 ? (
            <div className="muted-text">No active viewers</div>
          ) : (
            <div className="presence-list inline">
              {viewers.map((viewer) => {
                const name =
                  viewer.fullName ||
                  viewer.username ||
                  viewer.email ||
                  "User";
                const initials = name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <div key={viewer.id} className="presence-user compact">
                    <div className="presence-avatar">
                      {initials}
                    </div>
                    <span>{name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="task-panel-section">
          <strong>Status</strong>

          <div className="button-row">
            <button
              className="ui-button ui-button-secondary"
              onClick={() => updateTaskStatus(task.id, "TODO")}
            >
              TODO
            </button>

            <button
              className="ui-button ui-button-secondary"
              onClick={() => updateTaskStatus(task.id, "IN_PROGRESS")}
            >
              IN PROGRESS
            </button>

            <button
              className="ui-button ui-button-secondary"
              onClick={() => updateTaskStatus(task.id, "DONE")}
            >
              DONE
            </button>
          </div>

          <div className="muted-text">
            Current: <strong>{task.status}</strong>
          </div>

          {task.status === "DONE" && !task.archivedAt && (
            <div className="section-action">
              <button
                className="ui-button ui-button-dark"
                onClick={handleArchive}
                disabled={archiving}
              >
                {archiving ? "Archiving..." : "Archive completed task"}
              </button>

              {archiveError && (
                <div className="form-error">
                  {archiveError}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="task-panel-section">
          <strong>Due Date</strong>

          <div
            className={isOverdue ? "due-date-text overdue" : "due-date-text"}
          >
            {formattedDueDate}
            {isOverdue && " - Overdue"}
          </div>

          <div className="button-row">
            <input
              type="date"
              value={dueDateValue}
              onChange={(e) => setDueDateValue(e.target.value)}
              className="ui-input"
            />

            <button
              className="ui-button ui-button-primary"
              onClick={() =>
                updateTaskDueDate(task.id, dueDateValue || null)
              }
            >
              Save
            </button>

            <button
              className="ui-button ui-button-secondary"
              onClick={() => {
                setDueDateValue("");
                updateTaskDueDate(task.id, null);
              }}
            >
              Clear
            </button>
          </div>
        </section>

      <section className="task-panel-section">
        <strong>Assign Task</strong>

        <div className="assignee-list">
            {task.assignments?.length ? (
              task.assignments.map((assignment) => (
          <div
            key={assignment.id}
            className="assignee-chip"
          >
            <span>
              {assignment.user?.fullName ||
                assignment.user?.email ||
                assignment.userId}
            </span>

            <button
              className="assignee-remove"
              onClick={() =>
                removeAssignee(task.id, assignment.userId)
              }
            >
              x
            </button>
          </div>
              ))
            ) : (
              <div className="muted-text">
                No assignees
              </div>
            )}
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
          className="ui-input full-width"
        />

        {searchingUsers && (
          <div className="muted-text">
            Searching users...
          </div>
        )}

        {searchError && (
          <div className="form-error">
            {searchError}
          </div>
        )}

        {userResults.length > 0 && (
          <div className="user-search-results">
            {userResults.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => assignSelectedUser(user.id)}
                className="user-search-result"
              >
                <div className="user-search-name">
                  {user.fullName || user.username || user.email}
                </div>
                <div className="muted-text">
                  {user.username ? `@${user.username} - ` : ""}
                  {user.email}
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="muted-text">
          Select a user from search, or press Enter to assign by raw user ID.
        </div>
      </section>

        <section className="task-panel-section">
          <strong>Progress Updates</strong>

          <div className="stack-sm">
            <textarea
              value={newUpdateMessage}
              onChange={(e) => setNewUpdateMessage(e.target.value)}
              placeholder="Share a progress update..."
              rows={3}
              className="ui-textarea"
            />

            <button
              className="ui-button ui-button-primary"
              onClick={submitTaskUpdate}
            >
              Post Update
            </button>
          </div>

          {updateError && (
            <div className="form-error">
              {updateError}
            </div>
          )}

          <div className="task-updates-list">
            {updatesLoading ? (
              <div className="muted-text">
                Loading updates...
              </div>
            ) : taskUpdates.length === 0 ? (
              <div className="muted-text">
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
                    className="task-update-card"
                  >
                    <div className="task-update-meta">
                      <span>{author}</span>
                      <span>{new Date(update.createdAt).toLocaleString()}</span>
                    </div>

                    <div className="task-update-message">
                      {update.message}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="task-panel-section">
          <strong>Related Notes</strong>

          <div className="stack-sm">
            <input
              type="text"
              value={newNoteTitle}
              onChange={(e) => setNewNoteTitle(e.target.value)}
              placeholder="Create linked note title"
              className="ui-input"
            />

            <textarea
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Instructions, context, procedure, or reference..."
              rows={3}
              className="ui-textarea"
            />

            <button
              className="ui-button ui-button-primary"
              onClick={submitLinkedNote}
              disabled={creatingNote}
            >
              {creatingNote ? "Creating..." : "Create linked note"}
            </button>
          </div>

          {notesError && (
            <div className="form-error">
              {notesError}
            </div>
          )}

          <div className="task-related-notes">
            {notesLoading ? (
              <div className="muted-text">Loading related notes...</div>
            ) : relatedNotes.length === 0 ? (
              <div className="muted-text">
                No related notes yet
              </div>
            ) : (
              relatedNotes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  className={
                    note.id === editingNoteId
                      ? "task-note-card active"
                      : "task-note-card"
                  }
                  onClick={() => openNoteEditor(note)}
                >
                  <div className="task-note-meta">
                    <span>{formatNoteDate(note.updatedAt)}</span>
                    <span>{getNoteAuthor(note)}</span>
                  </div>
                  <strong>{note.title}</strong>
                  <p>{getNotePreview(note.content)}</p>
                </button>
              ))
            )}
          </div>

          {editingNoteId && (
            <div className="task-note-editor">
              <label className="form-label">
                Title
                <input
                  className="ui-input"
                  value={editNoteTitle}
                  onChange={(e) => setEditNoteTitle(e.target.value)}
                />
              </label>

              <label className="form-label">
                Content
                <textarea
                  className="ui-textarea task-note-editor-textarea"
                  value={editNoteContent}
                  onChange={(e) => setEditNoteContent(e.target.value)}
                  rows={6}
                />
              </label>

              <div className="button-row">
                <button
                  className="ui-button ui-button-dark"
                  onClick={saveLinkedNote}
                  disabled={savingNote}
                >
                  {savingNote ? "Saving..." : "Save note"}
                </button>

                <button
                  className="ui-button ui-button-danger"
                  onClick={() => removeLinkedNote(editingNoteId)}
                  disabled={deletingNoteId === editingNoteId}
                >
                  {deletingNoteId === editingNoteId
                    ? "Deleting..."
                    : "Delete note"}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="task-panel-section">
          <strong>Description</strong>
          <p className="task-description">
            {task.description || "No description"}
          </p>
        </section>

        <div className="task-id">
          Task ID: {task.id}
        </div>
    </div>
  );
}
