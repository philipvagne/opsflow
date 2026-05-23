import { useEffect, useMemo, useState } from "react";
import api, {
  createNote,
  createProject,
  createTask as createProjectTask,
  deleteNote,
  getMyOrganizations,
  getNotes,
  getOrganizationProjects,
  getProject,
  getProjectTasks,
  updateNote,
  updateProject,
} from "../../api";
import usePersistentState from "../../hooks/usePersistentState";
import { subscribeToNoteCreated } from "../../lib/noteEvents";
import { createSocket } from "../../socket";

const canManageProject = (role) => ["OWNER", "ADMIN"].includes(role);
const canContributeToProject = (role) =>
  Boolean(role) && !["VIEWER", "GUEST"].includes(role);

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString() : "Unknown";

const formatStatus = (status) =>
  status === "IN_PROGRESS" ? "In progress" : status;

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

  return text.length > 140 ? `${text.slice(0, 140)}...` : text;
};

const compareProjectNotes = (left, right) => {
  if (left.isPinned !== right.isPinned) {
    return left.isPinned ? -1 : 1;
  }

  const leftPinnedAt = left.pinnedAt ? new Date(left.pinnedAt).getTime() : 0;
  const rightPinnedAt = right.pinnedAt ? new Date(right.pinnedAt).getTime() : 0;

  if (leftPinnedAt !== rightPinnedAt) {
    return rightPinnedAt - leftPinnedAt;
  }

  const leftUpdatedAt = left.updatedAt
    ? new Date(left.updatedAt).getTime()
    : 0;
  const rightUpdatedAt = right.updatedAt
    ? new Date(right.updatedAt).getTime()
    : 0;

  if (leftUpdatedAt !== rightUpdatedAt) {
    return rightUpdatedAt - leftUpdatedAt;
  }

  return 0;
};

const getTaskAssigneeLabel = (task) => {
  const count = task.assignments?.length || 0;

  if (!count) return "Unassigned";
  if (count === 1) {
    const user = task.assignments[0].user;
    return user?.fullName || user?.username || user?.email || "1 assignee";
  }

  return `${count} assignees`;
};

const isTaskOverdue = (task) =>
  task.dueDate &&
  task.status !== "DONE" &&
  new Date(task.dueDate).setHours(0, 0, 0, 0) <
    new Date().setHours(0, 0, 0, 0);

const getUserIdFromToken = (token) => {
  try {
    const payload = token.split(".")[1];
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "="
    );
    const decodedPayload = JSON.parse(atob(paddedPayload));

    return decodedPayload.sub;
  } catch {
    return null;
  }
};

const sortProjectTasks = (tasks) =>
  [...tasks].sort(
    (left, right) =>
      new Date(right.updatedAt || right.createdAt || 0) -
      new Date(left.updatedAt || left.createdAt || 0)
  );

export default function ProjectsWorkspace({
  token,
  onSelectTask,
  onRememberProject,
}) {
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = usePersistentState(
    "opsflow.projects.selectedOrgId",
    ""
  );
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = usePersistentState(
    "opsflow.projects.selectedProjectId",
    ""
  );
  const [activeProjectTab, setActiveProjectTab] = usePersistentState(
    "opsflow.projects.activeTab",
    "overview"
  );
  const [projectDetail, setProjectDetail] = useState(null);
  const [projectTasks, setProjectTasks] = useState([]);
  const [projectNotes, setProjectNotes] = useState([]);
  const [selectedProjectNoteId, setSelectedProjectNoteId] = useState("");
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingProjectSurface, setLoadingProjectSurface] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [creatingNote, setCreatingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState(null);
  const [showProjectCreateForm, setShowProjectCreateForm] = useState(false);
  const [showProjectTaskCreateForm, setShowProjectTaskCreateForm] =
    useState(false);
  const [showProjectNoteCreateForm, setShowProjectNoteCreateForm] =
    useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editNoteTitle, setEditNoteTitle] = useState("");
  const [editNoteContent, setEditNoteContent] = useState("");
  const [error, setError] = useState("");

  const selectedOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrgId) || null,
    [organizations, selectedOrgId]
  );
  const selectedProject = useMemo(
    () => projectDetail || projects.find((project) => project.id === selectedProjectId) || null,
    [projectDetail, projects, selectedProjectId]
  );
  const selectedProjectNote = useMemo(
    () =>
      projectNotes.find((note) => note.id === selectedProjectNoteId) || null,
    [projectNotes, selectedProjectNoteId]
  );
  const canManage = canManageProject(selectedOrganization?.role);
  const canContribute = canContributeToProject(selectedOrganization?.role);
  const pinnedProjectNotes = useMemo(
    () => projectNotes.filter((note) => note.isPinned),
    [projectNotes]
  );
  const regularProjectNotes = useMemo(
    () => projectNotes.filter((note) => !note.isPinned),
    [projectNotes]
  );
  const currentUserId = useMemo(() => getUserIdFromToken(token), [token]);

  useEffect(() => {
    let active = true;

    const loadOrganizations = async () => {
      setLoadingOrganizations(true);
      setError("");

      try {
        const res = await getMyOrganizations(token);

        if (!active) return;

        const nextOrganizations = res.data || [];
        setOrganizations(nextOrganizations);
        setSelectedOrgId((currentId) =>
          nextOrganizations.some((org) => org.id === currentId)
            ? currentId
            : nextOrganizations[0]?.id || ""
        );
      } catch {
        if (active) {
          setError("Could not load organizations.");
        }
      } finally {
        if (active) {
          setLoadingOrganizations(false);
        }
      }
    };

    loadOrganizations();

    return () => {
      active = false;
    };
  }, [setSelectedOrgId, token]);

  useEffect(() => {
    if (!selectedOrgId) {
      Promise.resolve().then(() => {
        setProjects([]);
        setSelectedProjectId("");
        setProjectDetail(null);
        setProjectTasks([]);
        setProjectNotes([]);
        setSelectedProjectNoteId("");
      });
      return;
    }

    let active = true;

    const loadProjects = async () => {
      setLoadingProjects(true);
      setError("");

      try {
        const res = await getOrganizationProjects(token, selectedOrgId);

        if (!active) return;

        const nextProjects = res.data || [];
        setProjects(nextProjects);
        setSelectedProjectId((currentId) =>
          nextProjects.some((project) => project.id === currentId)
            ? currentId
            : nextProjects[0]?.id || ""
        );
      } catch {
        if (active) {
          setProjects([]);
          setSelectedProjectId("");
          setError("Could not load projects.");
        }
      } finally {
        if (active) {
          setLoadingProjects(false);
        }
      }
    };

    loadProjects();

    return () => {
      active = false;
    };
  }, [selectedOrgId, setSelectedProjectId, token]);

  useEffect(() => {
    if (!selectedProjectId) {
      Promise.resolve().then(() => {
        setProjectDetail(null);
        setProjectTasks([]);
        setProjectNotes([]);
        setSelectedProjectNoteId("");
      });
      return;
    }

    let active = true;

    const loadProjectSurface = async () => {
      setLoadingProjectSurface(true);
      setError("");

      try {
        const [projectRes, tasksRes, notesRes] = await Promise.all([
          getProject(token, selectedProjectId),
          getProjectTasks(token, selectedProjectId),
          getNotes(token, {
            projectId: selectedProjectId,
          }),
        ]);

        if (!active) return;

        const nextProject = projectRes.data || null;
        const nextTasks = (tasksRes.data || []).filter(
          (task) => !task.archivedAt
        );
        const nextNotes = [...(notesRes.data || [])].sort(compareProjectNotes);

        setProjectDetail(nextProject);
        setProjectTasks(nextTasks);
        setProjectNotes(nextNotes);
        setProjects((current) =>
          current.map((project) =>
            project.id === nextProject?.id ? nextProject : project
          )
        );
        setSelectedProjectNoteId((currentId) =>
          nextNotes.some((note) => note.id === currentId)
            ? currentId
            : nextNotes[0]?.id || ""
        );
      } catch {
        if (active) {
          setProjectDetail(null);
          setProjectTasks([]);
          setProjectNotes([]);
          setSelectedProjectNoteId("");
          setError("Could not load project surface.");
        }
      } finally {
        if (active) {
          setLoadingProjectSurface(false);
        }
      }
    };

    loadProjectSurface();

    return () => {
      active = false;
    };
  }, [selectedProjectId, token]);

  useEffect(() => {
    Promise.resolve().then(() => {
      setEditName(selectedProject?.name || "");
      setEditDescription(selectedProject?.description || "");
    });
  }, [selectedProject]);

  useEffect(() => {
    Promise.resolve().then(() => {
      setEditNoteTitle(selectedProjectNote?.title || "");
      setEditNoteContent(selectedProjectNote?.content || "");
    });
  }, [selectedProjectNote]);

  useEffect(() => {
    setShowProjectTaskCreateForm(false);
    setShowProjectNoteCreateForm(false);
    setNewTaskTitle("");
    setNewTaskDescription("");
    setNewTaskDueDate("");
    setNewNoteTitle("");
    setNewNoteContent("");
  }, [selectedProjectId]);

  useEffect(() => {
    setShowProjectCreateForm(false);
    setNewName("");
    setNewDescription("");
  }, [selectedOrgId]);

  useEffect(() => {
    setShowProjectTaskCreateForm(false);
    setShowProjectNoteCreateForm(false);
  }, [activeProjectTab]);

  useEffect(() => {
    if (!selectedProjectId || !token) {
      return;
    }

    return subscribeToNoteCreated((note) => {
      if (note.projectId !== selectedProjectId) {
        return;
      }

      setProjectNotes((current) => {
        const exists = current.some((currentNote) => currentNote.id === note.id);

        if (exists) {
          return current;
        }

        return [note, ...current].sort(compareProjectNotes);
      });
      onRememberProject?.(
        {
          id: selectedProjectId,
          name: selectedProject?.name,
          organizationId: selectedOrganization?.id,
          orgName: selectedOrganization?.name,
        },
        note.updatedAt
      );
      setProjectDetail((current) =>
        current ? { ...current, recentActivityAt: note.updatedAt } : current
      );
      setProjects((current) =>
        current.map((project) =>
          project.id === selectedProjectId
            ? { ...project, recentActivityAt: note.updatedAt }
            : project
        )
      );
      setSelectedProjectNoteId((currentId) => currentId || note.id);
    });
  }, [
    onRememberProject,
    selectedOrganization?.id,
    selectedOrganization?.name,
    selectedProject?.name,
    selectedProjectId,
    token,
  ]);

  useEffect(() => {
    if (!selectedProjectId || !token) {
      return;
    }

    const socket = createSocket(token);

    socket.on("task_updated", (data) => {
      if (data.project?.id !== selectedProjectId) {
        return;
      }

      setProjectTasks((current) => {
        const isArchived =
          data.archivedAt !== null && data.archivedAt !== undefined;

        if (isArchived) {
          return current.filter((task) => task.id !== data.taskId);
        }

        const existingTask = current.find((task) => task.id === data.taskId);
        const nextTask = existingTask
          ? {
              ...existingTask,
              status: data.status,
              title: data.title,
              description: data.description ?? existingTask.description,
              dueDate: data.dueDate,
              archivedAt: data.archivedAt,
              createdAt: data.createdAt ?? existingTask.createdAt,
              updatedAt: data.updatedAt ?? existingTask.updatedAt,
              project: data.project ?? existingTask.project,
              assignments: data.assignments ?? existingTask.assignments,
              unreadNoteCount:
                data.unreadNoteCount ?? existingTask.unreadNoteCount ?? 0,
              hasUnreadNotes:
                data.hasUnreadNotes ?? existingTask.hasUnreadNotes ?? false,
              recentNoteActivityAt:
                data.recentNoteActivityAt ??
                existingTask.recentNoteActivityAt ??
                null,
              recentActivityAt:
                data.recentActivityAt ?? existingTask.recentActivityAt ?? null,
              isRecentlyActive:
                data.isRecentlyActive ?? existingTask.isRecentlyActive ?? false,
            }
          : {
              id: data.taskId,
              title: data.title,
              description: data.description || "",
              status: data.status,
              dueDate: data.dueDate,
              archivedAt: data.archivedAt,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
              project: data.project,
              assignments: data.assignments || [],
              unreadNoteCount: data.unreadNoteCount ?? 0,
              hasUnreadNotes: data.hasUnreadNotes ?? false,
              recentNoteActivityAt: data.recentNoteActivityAt ?? null,
              recentActivityAt: data.recentActivityAt ?? null,
              isRecentlyActive: data.isRecentlyActive ?? false,
            };

        if (existingTask) {
          return current
            .map((task) => (task.id === nextTask.id ? nextTask : task))
            .sort((left, right) =>
              new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0)
            );
        }

        return [...current, nextTask].sort(
          (left, right) =>
            new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0)
        );
      });
      onRememberProject?.(
        {
          id: selectedProjectId,
          name: selectedProject?.name,
          organizationId: selectedOrganization?.id,
          orgName: selectedOrganization?.name,
        },
        data.recentActivityAt || data.updatedAt || new Date().toISOString()
      );
      setProjectDetail((current) =>
        current
          ? {
              ...current,
              recentActivityAt: data.recentActivityAt || data.updatedAt || current.recentActivityAt,
            }
          : current
      );
      setProjects((current) =>
        current.map((project) =>
          project.id === selectedProjectId
            ? {
                ...project,
                recentActivityAt:
                  data.recentActivityAt || data.updatedAt || project.recentActivityAt,
              }
            : project
        )
      );
    });

    return () => {
      socket.off("task_updated");
      socket.disconnect();
    };
  }, [
    onRememberProject,
    selectedOrganization?.id,
    selectedOrganization?.name,
    selectedProject?.name,
    selectedProjectId,
    token,
  ]);

  const handleCreateProject = async (event) => {
    event.preventDefault();

    const trimmedName = newName.trim();

    if (!trimmedName || !selectedOrgId) {
      setError("Project name is required.");
      return;
    }

    setCreating(true);
    setError("");

    try {
      const res = await createProject(token, selectedOrgId, {
        name: trimmedName,
        description: newDescription.trim() || undefined,
      });

      const createdProject = res.data;
      setProjects((current) => [createdProject, ...current]);
      setSelectedProjectId(createdProject.id);
      setShowProjectCreateForm(false);
      setNewName("");
      setNewDescription("");
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not create project."
      );
    } finally {
      setCreating(false);
    }
  };

  const handleSelectProject = (project) => {
    onRememberProject?.({
      id: project.id,
      name: project.name,
      organizationId: selectedOrganization?.id,
      orgName: selectedOrganization?.name,
    });
    setActiveProjectTab("overview");
    setSelectedProjectId(project.id);
  };

  const handleUpdateProject = async (event) => {
    event.preventDefault();

    if (!selectedProject) return;

    const trimmedName = editName.trim();

    if (!trimmedName) {
      setError("Project name is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await updateProject(token, selectedProject.id, {
        name: trimmedName,
        description: editDescription.trim() || "",
      });

      const updatedProject = res.data;
      setProjects((current) =>
        current.map((project) =>
          project.id === updatedProject.id ? updatedProject : project
        )
      );
      setProjectDetail(updatedProject);
    } catch (err) {
      setError(err.response?.data?.message || "Could not save project.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProjectNote = async (event) => {
    event.preventDefault();

    const title = newNoteTitle.trim();

    if (!title || !selectedProject || !selectedOrganization) {
      setError("Project note title is required.");
      return;
    }

    setCreatingNote(true);
    setError("");

    try {
      const res = await createNote(token, {
        title,
        content: newNoteContent,
        organizationId: selectedOrganization.id,
        projectId: selectedProject.id,
      });

      const createdNote = res.data;
      setProjectNotes((current) =>
        [createdNote, ...current].sort(compareProjectNotes)
      );
      setSelectedProjectNoteId(createdNote.id);
      setShowProjectNoteCreateForm(false);
      setNewNoteTitle("");
      setNewNoteContent("");
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not create project note."
      );
    } finally {
      setCreatingNote(false);
    }
  };

  const handleCreateProjectTask = async (event) => {
    event.preventDefault();

    const title = newTaskTitle.trim();

    if (!title || !selectedProject || !selectedOrganization) {
      setError("Task title is required.");
      return;
    }

    setCreatingTask(true);
    setError("");

    try {
      const res = await createProjectTask(
        token,
        selectedOrganization.id,
        selectedProject.id,
        {
          title,
          description: newTaskDescription.trim() || undefined,
          dueDate: newTaskDueDate || undefined,
        }
      );

      const createdTask = res.data;

      if (currentUserId) {
        await api.patch(
          `/tasks/${createdTask.id}/assign`,
          { assigneeId: currentUserId },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      }

      const visibleTask = {
        ...createdTask,
        project: createdTask.project || selectedProject,
        unreadNoteCount: 0,
        hasUnreadNotes: false,
        recentNoteActivityAt: null,
        recentActivityAt:
          createdTask.updatedAt || createdTask.createdAt || new Date().toISOString(),
        isRecentlyActive: true,
        assignments: currentUserId
          ? [
              {
                id: `current-user-${createdTask.id}`,
                taskId: createdTask.id,
                userId: currentUserId,
                user: {
                  id: currentUserId,
                },
              },
            ]
          : createdTask.assignments || [],
      };

      setProjectTasks((current) => sortProjectTasks([visibleTask, ...current]));
      setProjectDetail((current) =>
        current
          ? {
              ...current,
              recentActivityAt: visibleTask.recentActivityAt,
              taskCounts: {
                ...current.taskCounts,
                totalActive: (current.taskCounts?.totalActive || 0) + 1,
              },
            }
          : current
      );
      setProjects((current) =>
        current.map((project) =>
          project.id === selectedProject.id
            ? {
                ...project,
                recentActivityAt: visibleTask.recentActivityAt,
                taskCounts: {
                  ...project.taskCounts,
                  totalActive: (project.taskCounts?.totalActive || 0) + 1,
                },
              }
            : project
        )
      );
      onRememberProject?.(
        {
          id: selectedProject.id,
          name: selectedProject.name,
          organizationId: selectedOrganization.id,
          orgName: selectedOrganization.name,
        },
        visibleTask.recentActivityAt
      );
      setShowProjectTaskCreateForm(false);
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskDueDate("");
    } catch (err) {
      setError(err.response?.data?.message || "Could not create task.");
    } finally {
      setCreatingTask(false);
    }
  };

  const handleSaveProjectNote = async () => {
    const title = editNoteTitle.trim();

    if (!selectedProjectNote || !title) {
      setError("Project note title is required.");
      return;
    }

    setSavingNote(true);
    setError("");

    try {
      const res = await updateNote(token, selectedProjectNote.id, {
        title,
        content: editNoteContent,
      });

      setProjectNotes((current) =>
        current
          .map((note) => (note.id === res.data.id ? res.data : note))
          .sort(compareProjectNotes)
      );
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not save project note."
      );
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteProjectNote = async (noteId) => {
    setDeletingNoteId(noteId);
    setError("");

    try {
      await deleteNote(token, noteId);
      setProjectNotes((current) =>
        current.filter((note) => note.id !== noteId)
      );
      setSelectedProjectNoteId((currentId) =>
        currentId === noteId ? "" : currentId
      );
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not delete project note."
      );
    } finally {
      setDeletingNoteId(null);
    }
  };

  if (loadingOrganizations) {
    return <div className="workspace-placeholder">Loading projects...</div>;
  }

  return (
    <div className="projects-workspace">
      {error ? <div className="form-error project-error">{error}</div> : null}

      <section className="project-panel project-collection-pane">
        <div className="project-panel-header project-collection-header">
          <div>
            <div className="dashboard-eyebrow">Projects</div>
            <h4>Project spaces</h4>
          </div>
        </div>

        <div className="project-collection-body">
          <div className="project-collection-controls">
            {organizations.length === 0 ? (
              <div className="org-empty-state">
                <h4>No organization yet</h4>
                <p>Create an organization before creating projects.</p>
              </div>
            ) : (
              <label className="form-label">
                Organization
                <select
                  className="ui-input"
                  value={selectedOrgId}
                  onChange={(event) => setSelectedOrgId(event.target.value)}
                >
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {canManage && selectedOrgId ? (
              <div className="contextual-create-block">
                <button
                  type="button"
                  className="contextual-create-button"
                  onClick={() =>
                    setShowProjectCreateForm((current) => !current)
                  }
                >
                  + Create Project
                </button>

                {showProjectCreateForm ? (
                  <form
                    className="project-form contextual-create-surface"
                    onSubmit={handleCreateProject}
                  >
                    <label className="form-label">
                      Project name
                      <input
                        className="ui-input"
                        value={newName}
                        onChange={(event) => setNewName(event.target.value)}
                        placeholder="Project name"
                      />
                    </label>
                    <label className="form-label">
                      Description
                      <textarea
                        className="ui-textarea"
                        value={newDescription}
                        onChange={(event) => setNewDescription(event.target.value)}
                        placeholder="Optional project description"
                        rows={3}
                      />
                    </label>
                    <div className="button-row contextual-create-actions">
                      <button
                        type="submit"
                        className="ui-button ui-button-primary"
                        disabled={creating}
                      >
                        {creating ? "Creating..." : "Save project"}
                      </button>
                      <button
                        type="button"
                        className="ui-button ui-button-secondary"
                        onClick={() => {
                          setShowProjectCreateForm(false);
                          setNewName("");
                          setNewDescription("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="project-list-panel">
            <div className="project-panel-header project-list-header">
              <div>
                <div className="dashboard-eyebrow">Collection</div>
                <h4>Your projects</h4>
              </div>
            </div>

            {loadingProjects ? (
              <div className="workspace-placeholder">Loading projects...</div>
            ) : projects.length === 0 ? (
              <div className="org-empty-state">
                <h4>This organization is quiet right now</h4>
                <p>
                  Projects created here will appear when the work is ready for
                  them.
                </p>
              </div>
            ) : (
              <div className="project-card-grid">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    className={
                      project.id === selectedProjectId
                        ? "project-card active"
                        : "project-card"
                    }
                    onClick={() => handleSelectProject(project)}
                  >
                    <strong>{project.name}</strong>
                    <span>{project.description || "No description yet"}</span>
                    <div className="project-count-row">
                      <span>{project.taskCounts?.totalActive || 0} active</span>
                      <span>{project.taskCounts?.done || 0} done</span>
                      <span>{project.taskCounts?.overdue || 0} overdue</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="project-panel project-detail-panel">
        {loadingProjectSurface ? (
          <div className="workspace-placeholder">Loading project surface...</div>
        ) : selectedProject ? (
          <>
            <div className="project-opened-strip">
              <div className="project-opened-tab" aria-label="Opened project">
                <div className="project-opened-tab-main">
                  <span className="project-opened-tab-icon" aria-hidden="true">
                    P
                  </span>
                  <div className="project-opened-tab-copy">
                    <span className="project-opened-tab-label">Opened Project</span>
                    <strong>{selectedProject.name}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="project-opened-tab-close"
                  onClick={() => setSelectedProjectId("")}
                  aria-label={`Close ${selectedProject.name}`}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="project-panel-header project-detail-header">
              <div>
                <div className="dashboard-eyebrow">Project Surface</div>
                <h4>{selectedProject.name}</h4>
              </div>
            </div>

            <div
              className="project-surface-tabs"
              role="tablist"
              aria-label="Project detail tabs"
            >
              <button
                type="button"
                className={
                  activeProjectTab === "overview"
                    ? "project-surface-tab active"
                    : "project-surface-tab"
                }
                onClick={() => setActiveProjectTab("overview")}
              >
                Overview
              </button>
              <button
                type="button"
                className={
                  activeProjectTab === "tasks"
                    ? "project-surface-tab active"
                    : "project-surface-tab"
                }
                onClick={() => setActiveProjectTab("tasks")}
              >
                Tasks
              </button>
              <button
                type="button"
                className={
                  activeProjectTab === "notes"
                    ? "project-surface-tab active"
                    : "project-surface-tab"
                }
                onClick={() => setActiveProjectTab("notes")}
              >
                Notes
              </button>
            </div>

            <div className="project-detail-content">
              {activeProjectTab === "overview" ? (
                <div className="project-overview-surface">
                  <div className="project-detail-stats">
                    <div>
                      <strong>{selectedProject.taskCounts?.totalActive || 0}</strong>
                      <span>Active</span>
                    </div>
                    <div>
                      <strong>{selectedProject.taskCounts?.done || 0}</strong>
                      <span>Done</span>
                    </div>
                    <div>
                      <strong>{selectedProject.taskCounts?.overdue || 0}</strong>
                      <span>Overdue</span>
                    </div>
                  </div>

                  <div className="project-detail-meta">
                    <span>Created {formatDate(selectedProject.createdAt)}</span>
                    {selectedProject.recentActivityAt ? (
                      <span>
                        Recent activity {formatDate(selectedProject.recentActivityAt)}
                      </span>
                    ) : null}
                  </div>

                  {canManage ? (
                    <form className="project-form" onSubmit={handleUpdateProject}>
                      <label className="form-label">
                        Name
                        <input
                          className="ui-input"
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                        />
                      </label>
                      <label className="form-label">
                        Description
                        <textarea
                          className="ui-textarea"
                          value={editDescription}
                          onChange={(event) =>
                            setEditDescription(event.target.value)
                          }
                          rows={3}
                        />
                      </label>
                      <button
                        type="submit"
                        className="ui-button ui-button-dark"
                        disabled={saving}
                      >
                        {saving ? "Saving..." : "Save project"}
                      </button>
                    </form>
                  ) : selectedProject.description ? (
                    <p className="project-surface-description">
                      {selectedProject.description}
                    </p>
                  ) : (
                    <p className="muted-text">
                      You can view this project. Owners and admins can edit it.
                    </p>
                  )}
                </div>
              ) : null}

              {activeProjectTab === "tasks" ? (
                <section className="project-surface-section project-tasks-surface">
                  <div className="project-surface-section-header">
                    <div>
                      <div className="dashboard-eyebrow">Project Tasks</div>
                      <h5>Work in this project</h5>
                    </div>

                    {canContribute ? (
                      <button
                        type="button"
                        className="contextual-create-button"
                        onClick={() =>
                          setShowProjectTaskCreateForm((current) => !current)
                        }
                      >
                        + Create Task
                      </button>
                    ) : null}
                  </div>

                  {canContribute && showProjectTaskCreateForm ? (
                    <form
                      className="project-form contextual-create-surface"
                      onSubmit={handleCreateProjectTask}
                    >
                      <label className="form-label">
                        Task title
                        <input
                          className="ui-input"
                          value={newTaskTitle}
                          onChange={(event) => setNewTaskTitle(event.target.value)}
                          placeholder="Task title"
                        />
                      </label>
                      <label className="form-label">
                        Description
                        <textarea
                          className="ui-textarea"
                          value={newTaskDescription}
                          onChange={(event) =>
                            setNewTaskDescription(event.target.value)
                          }
                          placeholder="Optional description"
                          rows={3}
                        />
                      </label>
                      <label className="form-label">
                        Due date
                        <input
                          type="date"
                          className="ui-input"
                          value={newTaskDueDate}
                          onChange={(event) => setNewTaskDueDate(event.target.value)}
                        />
                      </label>
                      <div className="button-row contextual-create-actions">
                        <button
                          type="submit"
                          className="ui-button ui-button-primary"
                          disabled={creatingTask}
                        >
                          {creatingTask ? "Creating..." : "Save task"}
                        </button>
                        <button
                          type="button"
                          className="ui-button ui-button-secondary"
                          onClick={() => {
                            setShowProjectTaskCreateForm(false);
                            setNewTaskTitle("");
                            setNewTaskDescription("");
                            setNewTaskDueDate("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : null}

                  {projectTasks.length === 0 ? (
                    <div className="muted-text">
                      This project is quiet right now.
                    </div>
                  ) : (
                    <div className="project-tasks-list-shell">
                      <div className="project-task-list">
                        {projectTasks.map((task) => (
                          <button
                            key={task.id}
                            type="button"
                            className="project-task-row"
                            onClick={() => onSelectTask?.(task)}
                          >
                            <div className="project-task-row-main">
                              <strong>{task.title}</strong>
                              <div className="project-task-meta">
                                <span>{formatStatus(task.status)}</span>
                                <span>{getTaskAssigneeLabel(task)}</span>
                                {task.dueDate ? (
                                  <span
                                    className={
                                      isTaskOverdue(task)
                                        ? "task-table-date overdue"
                                        : "task-table-date"
                                    }
                                  >
                                    Due {formatDate(task.dueDate)}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            {task.unreadNoteCount > 0 ? (
                              <span className="task-awareness-text">
                                {task.unreadNoteCount} new note
                                {task.unreadNoteCount > 1 ? "s" : ""}
                              </span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              ) : null}

              {activeProjectTab === "notes" ? (
                <section className="project-surface-section project-notes-surface">
                  <div className="project-surface-section-header">
                    <div>
                      <div className="dashboard-eyebrow">Project Notes</div>
                      <h5>Context and references</h5>
                    </div>

                    {canContribute ? (
                      <button
                        type="button"
                        className="contextual-create-button"
                        onClick={() =>
                          setShowProjectNoteCreateForm((current) => !current)
                        }
                      >
                        + Create Note
                      </button>
                    ) : null}
                  </div>

                  {canContribute && showProjectNoteCreateForm ? (
                    <form
                      className="project-form contextual-create-surface"
                      onSubmit={handleCreateProjectNote}
                    >
                      <label className="form-label">
                        Note title
                        <input
                          className="ui-input"
                          value={newNoteTitle}
                          onChange={(event) => setNewNoteTitle(event.target.value)}
                          placeholder="Note title"
                        />
                      </label>
                      <label className="form-label">
                        Content
                        <textarea
                          className="ui-textarea"
                          value={newNoteContent}
                          onChange={(event) => setNewNoteContent(event.target.value)}
                          placeholder="Reference, decision, or operational context..."
                          rows={3}
                        />
                      </label>
                      <div className="button-row contextual-create-actions">
                        <button
                          type="submit"
                          className="ui-button ui-button-primary"
                          disabled={creatingNote}
                        >
                          {creatingNote ? "Creating..." : "Save note"}
                        </button>
                        <button
                          type="button"
                          className="ui-button ui-button-secondary"
                          onClick={() => {
                            setShowProjectNoteCreateForm(false);
                            setNewNoteTitle("");
                            setNewNoteContent("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : null}

                  {projectNotes.length === 0 ? (
                    <div className="muted-text">
                      No project context yet.
                    </div>
                  ) : (
                    <div className="project-notes-workspace">
                      <div className="project-notes-list-shell">
                        <div className="project-note-list">
                          {pinnedProjectNotes.length > 0 && (
                            <div className="project-note-group">
                              <div className="dashboard-eyebrow">Pinned</div>
                              {pinnedProjectNotes.map((note) => (
                                <button
                                  key={note.id}
                                  type="button"
                                  className={
                                    note.id === selectedProjectNoteId
                                      ? "task-note-card active"
                                      : "task-note-card"
                                  }
                                  onClick={() => setSelectedProjectNoteId(note.id)}
                                >
                                  <div className="task-note-meta">
                                    <span className="task-note-pin-pill">Pinned</span>
                                    {note.kind === "REFERENCE" && (
                                      <span className="task-note-kind-pill">
                                        Reference
                                      </span>
                                    )}
                                    <span>{formatDate(note.updatedAt)}</span>
                                    <span>{getNoteAuthor(note)}</span>
                                  </div>
                                  <strong>{note.title}</strong>
                                  <p>{getNotePreview(note.content)}</p>
                                </button>
                              ))}
                            </div>
                          )}

                          {regularProjectNotes.length > 0 && (
                            <div className="project-note-group">
                              <div className="dashboard-eyebrow">
                                {pinnedProjectNotes.length > 0 ? "Notes" : "All Notes"}
                              </div>
                              {regularProjectNotes.map((note) => (
                                <button
                                  key={note.id}
                                  type="button"
                                  className={
                                    note.id === selectedProjectNoteId
                                      ? "task-note-card active"
                                      : "task-note-card"
                                  }
                                  onClick={() => setSelectedProjectNoteId(note.id)}
                                >
                                  <div className="task-note-meta">
                                    {note.kind === "REFERENCE" && (
                                      <span className="task-note-kind-pill">
                                        Reference
                                      </span>
                                    )}
                                    <span>{formatDate(note.updatedAt)}</span>
                                    <span>{getNoteAuthor(note)}</span>
                                  </div>
                                  <strong>{note.title}</strong>
                                  <p>{getNotePreview(note.content)}</p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {selectedProjectNote ? (
                        <div className="task-note-editor project-note-editor">
                          <label className="form-label">
                            Title
                            <input
                              className="ui-input"
                              value={editNoteTitle}
                              onChange={(event) =>
                                setEditNoteTitle(event.target.value)
                              }
                            />
                          </label>

                          <label className="form-label">
                            Content
                            <textarea
                              className="ui-textarea task-note-editor-textarea"
                              value={editNoteContent}
                              onChange={(event) =>
                                setEditNoteContent(event.target.value)
                              }
                              rows={6}
                            />
                          </label>

                          <div className="button-row">
                            <button
                              type="button"
                              className="ui-button ui-button-dark"
                              onClick={handleSaveProjectNote}
                              disabled={savingNote}
                            >
                              {savingNote ? "Saving..." : "Save note"}
                            </button>
                            <button
                              type="button"
                              className="ui-button ui-button-danger"
                              onClick={() =>
                                handleDeleteProjectNote(selectedProjectNote.id)
                              }
                              disabled={deletingNoteId === selectedProjectNote.id}
                            >
                              {deletingNoteId === selectedProjectNote.id
                                ? "Deleting..."
                                : "Delete note"}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </section>
              ) : null}
            </div>
          </>
        ) : (
          <div className="org-empty-state">
            <h4>Open a project</h4>
            <p>Tasks, notes, and recent context will gather here without taking over the workspace.</p>
          </div>
        )}
      </section>
    </div>
  );
}
