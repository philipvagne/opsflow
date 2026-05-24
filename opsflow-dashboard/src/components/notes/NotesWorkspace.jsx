import { useEffect, useMemo, useState } from "react";
import {
  addNoteLink,
  deleteNote,
  getNoteLinks,
  getMyOrganizations,
  getNotes,
  getOrganizationProjects,
  removeNoteLink,
  updateNote,
} from "../../api";
import usePersistentState from "../../hooks/usePersistentState";
import { subscribeToNoteCreated } from "../../lib/noteEvents";

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString() : "Unknown";

const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Unknown";

const getCreatorName = (note) =>
  note.createdBy?.fullName ||
  note.createdBy?.username ||
  note.createdBy?.email ||
  "Unknown";

const getSnippet = (content) => {
  const text = content?.trim();

  if (!text) {
    return "No content yet";
  }

  return text.length > 160 ? `${text.slice(0, 160)}...` : text;
};

const getSearchableText = (note) => {
  const outgoingLinks =
    note.sourceLinks
      ?.map((link) =>
        [
          link.targetNote?.title,
          link.targetNote?.kind,
          link.targetNote?.project?.name,
          link.targetNote?.task?.title,
        ]
          .filter(Boolean)
          .join(" ")
      )
      .join(" ") || "";

  const incomingLinks =
    note.targetLinks
      ?.map((link) =>
        [
          link.sourceNote?.title,
          link.sourceNote?.kind,
          link.sourceNote?.project?.name,
          link.sourceNote?.task?.title,
        ]
          .filter(Boolean)
          .join(" ")
      )
      .join(" ") || "";

  return [
    note.title || "",
    note.content || "",
    note.kind || "",
    note.project?.name || "",
    note.task?.title || "",
    outgoingLinks,
    incomingLinks,
  ]
    .join(" ")
    .toLowerCase();
};

const renderHighlightedText = (text, query) => {
  const safeText = typeof text === "string" ? text : text ? String(text) : "";

  if (!query.trim()) {
    return safeText;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const normalizedText = safeText.toLowerCase();
  const index = normalizedText.indexOf(normalizedQuery);

  if (index === -1) {
    return safeText;
  }

  const before = safeText.slice(0, index);
  const match = safeText.slice(index, index + query.trim().length);
  const after = safeText.slice(index + query.trim().length);

  return (
    <>
      {before}
      <mark className="search-highlight">{match}</mark>
      {after}
    </>
  );
};

const compareNotes = (left, right) => {
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

  const leftCreatedAt = left.createdAt
    ? new Date(left.createdAt).getTime()
    : 0;
  const rightCreatedAt = right.createdAt
    ? new Date(right.createdAt).getTime()
    : 0;

  return rightCreatedAt - leftCreatedAt;
};

const matchesNoteSearch = (note, search) => {
  const query = search.trim().toLowerCase();

  if (!query) {
    return true;
  }

  return getSearchableText(note).includes(query);
};

const getProjectId = (note) => note.projectId || note.project?.id || "";
const getTaskId = (note) => note.taskId || note.task?.id || "";

export default function NotesWorkspace({
  token,
  onOpenProject,
  onOpenTask,
  onRememberNote,
}) {
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = usePersistentState(
    "opsflow.notes.selectedOrgId",
    ""
  );
  const [projects, setProjects] = useState([]);
  const [organizationNotes, setOrganizationNotes] = useState([]);
  const [selectedNoteId, setSelectedNoteId] = usePersistentState(
    "opsflow.notes.selectedNoteId",
    ""
  );
  const [search, setSearch] = usePersistentState("opsflow.notes.search", "");
  const [selectedProjectFilterId, setSelectedProjectFilterId] =
    usePersistentState("opsflow.notes.projectFilterId", "");
  const [selectedTaskFilterId, setSelectedTaskFilterId] = usePersistentState(
    "opsflow.notes.taskFilterId",
    ""
  );
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editProjectId, setEditProjectId] = useState("");
  const [editKind, setEditKind] = useState("NOTE");
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [linkedNotes, setLinkedNotes] = useState([]);
  const [linkQuery, setLinkQuery] = useState("");
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pinningNoteId, setPinningNoteId] = useState(null);
  const [linkingNoteId, setLinkingNoteId] = useState(null);
  const [unlinkingNoteId, setUnlinkingNoteId] = useState(null);
  const [error, setError] = useState("");
  const [linkError, setLinkError] = useState("");

  const selectedOrganization = useMemo(
    () =>
      organizations.find((organization) => organization.id === selectedOrgId) ||
      null,
    [organizations, selectedOrgId]
  );
  const selectedNote = useMemo(
    () => organizationNotes.find((note) => note.id === selectedNoteId) || null,
    [organizationNotes, selectedNoteId]
  );
  const sortedNotes = useMemo(
    () => [...organizationNotes].sort(compareNotes),
    [organizationNotes]
  );
  const projectOptions = useMemo(
    () =>
      [...projects].sort((left, right) =>
        (left.name || "").localeCompare(right.name || "")
      ),
    [projects]
  );
  const taskOptions = useMemo(() => {
    const tasks = new Map();

    organizationNotes.forEach((note) => {
      const taskId = getTaskId(note);

      if (!taskId) {
        return;
      }

      const projectId = getProjectId(note);

      if (selectedProjectFilterId && projectId !== selectedProjectFilterId) {
        return;
      }

      if (!tasks.has(taskId)) {
        tasks.set(taskId, {
          id: taskId,
          title: note.task?.title || "Untitled task",
          projectId,
        });
      }
    });

    return Array.from(tasks.values()).sort((left, right) =>
      left.title.localeCompare(right.title)
    );
  }, [organizationNotes, selectedProjectFilterId]);
  const visibleNotes = useMemo(() => {
    return sortedNotes.filter((note) => {
      if (!matchesNoteSearch(note, search)) {
        return false;
      }

      if (
        selectedProjectFilterId &&
        getProjectId(note) !== selectedProjectFilterId
      ) {
        return false;
      }

      if (selectedTaskFilterId && getTaskId(note) !== selectedTaskFilterId) {
        return false;
      }

      return true;
    });
  }, [search, selectedProjectFilterId, selectedTaskFilterId, sortedNotes]);
  const pinnedNotes = useMemo(
    () => visibleNotes.filter((note) => note.isPinned),
    [visibleNotes]
  );
  const recentNotes = useMemo(
    () => visibleNotes.filter((note) => !note.isPinned),
    [visibleNotes]
  );
  const linkableNotes = useMemo(() => {
    const linkedIds = new Set(linkedNotes.map((note) => note.id));

    return organizationNotes
      .filter((note) => note.id !== selectedNoteId)
      .filter((note) => !linkedIds.has(note.id))
      .filter((note) => matchesNoteSearch(note, linkQuery))
      .slice(0, 8);
  }, [linkQuery, linkedNotes, organizationNotes, selectedNoteId]);
  const matchingCount = visibleNotes.length;
  const selectedNoteVisible = Boolean(
    selectedNoteId && visibleNotes.some((note) => note.id === selectedNoteId)
  );

  useEffect(() => {
    if (!selectedNote) {
      return;
    }

    onRememberNote?.({
      ...selectedNote,
      organizationId:
        selectedNote.organizationId ||
        selectedOrganization?.id ||
        selectedOrgId ||
        "",
    });
  }, [onRememberNote, selectedNote, selectedOrganization, selectedOrgId]);

  const handleSelectNote = (note) => {
    if (!note?.id) {
      return;
    }

    onRememberNote?.({
      ...note,
      noteId: note.id,
      organizationId:
        note.organizationId || selectedOrganization?.id || selectedOrgId || "",
      projectId: note.projectId || note.project?.id || "",
      taskId: note.taskId || note.task?.id || "",
    });
    setSelectedNoteId(note.id);
  };

  const handleOpenProjectFromNote = (note) => {
    const projectId = getProjectId(note);
    const organizationId =
      note?.organizationId ||
      note?.project?.organizationId ||
      selectedOrganization?.id ||
      selectedOrgId;

    if (!projectId || !organizationId) {
      return;
    }

    onOpenProject?.({
      id: projectId,
      orgId: organizationId,
      organizationId,
      name: note?.project?.name || "Project",
      title: note?.project?.name || "Project",
      orgName: selectedOrganization?.name || note?.organization?.name || "Team",
      label: selectedOrganization?.name || note?.organization?.name || "Team",
    });
  };

  const handleOpenTaskFromNote = (note) => {
    const taskId = getTaskId(note);

    if (!taskId) {
      return;
    }

    onOpenTask?.({
      id: taskId,
      title: note?.task?.title || "Task",
      description: note?.task?.description || "",
      project: note?.project
        ? {
            id: getProjectId(note),
            name: note.project.name || "Project",
          }
        : null,
    });
  };

  const upsertOrganizationNote = (nextNote) => {
    setOrganizationNotes((current) => {
      const exists = current.some((note) => note.id === nextNote.id);

      if (exists) {
        return current
          .map((note) => (note.id === nextNote.id ? nextNote : note))
          .sort(compareNotes);
      }

      return [nextNote, ...current].sort(compareNotes);
    });
  };

  const upsertOrganizationNotes = (...nextNotes) => {
    nextNotes.filter(Boolean).forEach((note) => {
      upsertOrganizationNote(note);
    });
  };

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
          setError("Could not load teams.");
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
    const resetWorkspaceData = () => {
      setProjects([]);
      setOrganizationNotes([]);
      setSelectedNoteId("");
      setSelectedProjectFilterId("");
      setSelectedTaskFilterId("");
      setIsEditingNote(false);
    };

    if (!selectedOrgId) {
      resetWorkspaceData();
      return;
    }

    let active = true;

    const loadWorkspaceData = async () => {
      setLoadingNotes(true);
      setError("");

      try {
        const [projectsRes, allNotesRes] = await Promise.all([
          getOrganizationProjects(token, selectedOrgId),
          getNotes(token, {
            organizationId: selectedOrgId,
          }),
        ]);

        if (!active) return;

        const nextProjects = projectsRes.data || [];
        const nextOrganizationNotes = allNotesRes.data || [];
        setProjects(nextProjects);
        setOrganizationNotes(nextOrganizationNotes);
        setSelectedNoteId((currentId) =>
          nextOrganizationNotes.some((note) => note.id === currentId)
            ? currentId
            : ""
        );
      } catch {
        if (active) {
          setProjects([]);
          setOrganizationNotes([]);
          setSelectedNoteId("");
          setError("Could not load notes.");
        }
      } finally {
        if (active) {
          setLoadingNotes(false);
        }
      }
    };

    loadWorkspaceData();

    return () => {
      active = false;
    };
  }, [
    selectedOrgId,
    setSelectedNoteId,
    setSelectedProjectFilterId,
    setSelectedTaskFilterId,
    token,
  ]);

  useEffect(() => {
    setSelectedProjectFilterId((currentId) =>
      currentId && projectOptions.some((project) => project.id === currentId)
        ? currentId
        : ""
    );
  }, [projectOptions, setSelectedProjectFilterId]);

  useEffect(() => {
    setSelectedTaskFilterId((currentId) =>
      currentId && taskOptions.some((task) => task.id === currentId)
        ? currentId
        : ""
    );
  }, [setSelectedTaskFilterId, taskOptions]);

  useEffect(() => {
    setEditTitle(selectedNote?.title || "");
    setEditContent(selectedNote?.content || "");
    setEditProjectId(selectedNote?.projectId || "");
    setEditKind(selectedNote?.kind || "NOTE");
    setLinkQuery("");
    setLinkError("");
    setIsEditingNote(false);
  }, [selectedNote]);

  useEffect(() => {
    if (
      selectedNoteId &&
      organizationNotes.length > 0 &&
      !organizationNotes.some((note) => note.id === selectedNoteId)
    ) {
      setSelectedNoteId("");
    }
  }, [organizationNotes, selectedNoteId, setSelectedNoteId]);

  useEffect(() => {
    if (!selectedNoteId) {
      setLinkedNotes([]);
      return;
    }

    let active = true;

    const loadLinkedNotes = async () => {
      setLoadingLinks(true);
      setLinkError("");

      try {
        const res = await getNoteLinks(token, selectedNoteId);

        if (!active) return;

        setLinkedNotes(res.data || []);
      } catch (err) {
        if (active) {
          setLinkedNotes([]);
          setLinkError(
            err.response?.data?.message || "Could not load linked notes."
          );
        }
      } finally {
        if (active) {
          setLoadingLinks(false);
        }
      }
    };

    loadLinkedNotes();

    return () => {
      active = false;
    };
  }, [selectedNoteId, token]);

  useEffect(() => {
    return subscribeToNoteCreated((note) => {
      if (note.organizationId !== selectedOrgId) {
        return;
      }

      upsertOrganizationNote(note);
    });
  }, [selectedOrgId]);

  const updateNoteInState = (noteId, updater) => {
    setOrganizationNotes((current) =>
      current
        .map((note) => (note.id === noteId ? updater(note) : note))
        .sort(compareNotes)
    );
  };

  const handleUpdateNote = async (event) => {
    event.preventDefault();

    if (!selectedNote) return;

    const title = editTitle.trim();

    if (!title) {
      setError("Note title is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await updateNote(token, selectedNote.id, {
        title,
        content: editContent,
        projectId: editProjectId || null,
        kind: editKind,
      });

      const updatedNote = res.data;
      upsertOrganizationNote(updatedNote);
      setIsEditingNote(false);
    } catch (err) {
      setError(err.response?.data?.message || "Could not save note.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!selectedNote) return;

    setDeleting(true);
    setError("");

    try {
      await deleteNote(token, selectedNote.id);
      setOrganizationNotes((current) =>
        current.filter((note) => note.id !== selectedNote.id)
      );
      setSelectedNoteId("");
      setIsEditingNote(false);
    } catch (err) {
      setError(err.response?.data?.message || "Could not delete note.");
    } finally {
      setDeleting(false);
    }
  };

  const handleTogglePin = async (note) => {
    const nextPinned = !note.isPinned;
    const optimisticPinnedAt = nextPinned ? new Date().toISOString() : null;

    setPinningNoteId(note.id);
    setError("");

    updateNoteInState(note.id, (current) => ({
      ...current,
      isPinned: nextPinned,
      pinnedAt: optimisticPinnedAt,
    }));

    try {
      const res = await updateNote(token, note.id, {
        isPinned: nextPinned,
      });

      updateNoteInState(note.id, () => res.data);
    } catch (err) {
      updateNoteInState(note.id, (current) => ({
        ...current,
        isPinned: note.isPinned,
        pinnedAt: note.pinnedAt,
      }));
      setError(err.response?.data?.message || "Could not update pin.");
    } finally {
      setPinningNoteId(null);
    }
  };

  const handleAddLink = async (linkedNote) => {
    if (!selectedNoteId) {
      return;
    }

    setLinkingNoteId(linkedNote.id);
    setLinkError("");

    try {
      const res = await addNoteLink(token, selectedNoteId, linkedNote.id);
      const { linkedNote: linkedNoteState, sourceNote } = res.data;
      setLinkedNotes((current) =>
        [
          ...current.filter((note) => note.id !== linkedNoteState.id),
          linkedNoteState,
        ].sort(compareNotes)
      );
      upsertOrganizationNotes(sourceNote, linkedNoteState);
      setLinkQuery("");
    } catch (err) {
      setLinkError(err.response?.data?.message || "Could not link note.");
    } finally {
      setLinkingNoteId(null);
    }
  };

  const handleRemoveLink = async (linkedNoteId) => {
    if (!selectedNoteId) {
      return;
    }

    setUnlinkingNoteId(linkedNoteId);
    setLinkError("");

    try {
      const res = await removeNoteLink(token, selectedNoteId, linkedNoteId);
      setLinkedNotes((current) =>
        current.filter((note) => note.id !== linkedNoteId)
      );
      upsertOrganizationNotes(res.data?.sourceNote, res.data?.linkedNote);
    } catch (err) {
      setLinkError(err.response?.data?.message || "Could not unlink note.");
    } finally {
      setUnlinkingNoteId(null);
    }
  };

  if (loadingOrganizations) {
    return <div className="workspace-placeholder">Loading notes...</div>;
  }

  return (
    <div className="notes-workspace">
      {error ? <div className="form-error notes-error">{error}</div> : null}

      <section className="note-panel notes-collection-pane">
        <div className="note-panel-header">
          <div>
            <div className="dashboard-eyebrow">Notes</div>
            <h4>Operational memory</h4>
          </div>
        </div>

        {organizations.length === 0 ? (
          <div className="org-empty-state">
            <h4>No team yet</h4>
            <p>Create a team before shared notes can gather here.</p>
          </div>
        ) : (
          <>
            <div className="notes-collection-controls">
              <label className="form-label">
                Team
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

              <label className="form-label">
                Search notes
                <input
                  className="ui-input"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Decision, reference, handoff..."
                />
              </label>

              <div className="notes-filter-grid">
                <label className="form-label">
                  Project
                  <select
                    className="ui-input"
                    value={selectedProjectFilterId}
                    onChange={(event) => setSelectedProjectFilterId(event.target.value)}
                  >
                    <option value="">All projects</option>
                    {projectOptions.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-label">
                  Task
                  <select
                    className="ui-input"
                    value={selectedTaskFilterId}
                    onChange={(event) => setSelectedTaskFilterId(event.target.value)}
                  >
                    <option value="">All tasks</option>
                    {taskOptions.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="notes-search-summary">
                {matchingCount === 0
                  ? "No matching notes"
                  : `${matchingCount} matching ${matchingCount === 1 ? "note" : "notes"}`}
                {!selectedNoteVisible && selectedNote
                  ? " - current note remains open"
                  : ""}
              </div>
            </div>

            <div className="notes-list-shell">
              {loadingNotes ? (
                <div className="workspace-placeholder">Loading notes...</div>
              ) : visibleNotes.length === 0 ? (
                <div className="org-empty-state notes-inline-empty">
                  <h4>No notes match this view</h4>
                  <p>Try another team, project, task, or search term.</p>
                </div>
              ) : (
                <div className="notes-list-sections">
                  {pinnedNotes.length > 0 ? (
                    <div className="notes-list-section">
                      <div className="notes-section-heading">
                        <span className="dashboard-eyebrow">Pinned Notes</span>
                        <span>{pinnedNotes.length}</span>
                      </div>
                      <div className="note-list">
                        {pinnedNotes.map((note) => (
                          <article
                            key={note.id}
                            className={
                              note.id === selectedNoteId
                                ? `note-list-item ${
                                    note.kind === "REFERENCE"
                                      ? "reference selected"
                                      : "selected"
                                  }`
                                : note.kind === "REFERENCE"
                                  ? "note-list-item reference"
                                  : "note-list-item"
                            }
                          >
                            <button
                              type="button"
                              className="note-list-item-main"
                              onClick={() => handleSelectNote(note)}
                            >
                              <div className="note-list-item-header">
                                <span>{note.project?.name || "General note"}</span>
                                <span>{formatDate(note.updatedAt)}</span>
                              </div>
                              <strong>
                                {renderHighlightedText(note.title, search)}
                              </strong>
                              <p>
                                {renderHighlightedText(getSnippet(note.content), search)}
                              </p>
                              <div className="note-list-item-footer">
                                <span>{getCreatorName(note)}</span>
                                {note.task?.title ? <span>{note.task.title}</span> : null}
                              </div>
                            </button>
                            <button
                              type="button"
                              className="note-pin-button"
                              disabled={pinningNoteId === note.id}
                              onClick={() => handleTogglePin(note)}
                            >
                              {note.isPinned ? "Unpin" : "Pin"}
                            </button>
                          </article>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="notes-list-section">
                    <div className="notes-section-heading">
                      <span className="dashboard-eyebrow">
                        {pinnedNotes.length > 0 ? "Recent Notes" : "Notes"}
                      </span>
                      <span>{recentNotes.length}</span>
                    </div>
                    <div className="note-list">
                      {recentNotes.map((note) => (
                        <article
                          key={note.id}
                          className={
                            note.id === selectedNoteId
                              ? `note-list-item ${
                                  note.kind === "REFERENCE"
                                    ? "reference selected"
                                    : "selected"
                                }`
                              : note.kind === "REFERENCE"
                                ? "note-list-item reference"
                                : "note-list-item"
                          }
                        >
                          <button
                            type="button"
                            className="note-list-item-main"
                            onClick={() => handleSelectNote(note)}
                          >
                            <div className="note-list-item-header">
                              <span>{note.project?.name || "General note"}</span>
                              <span>{formatDate(note.updatedAt)}</span>
                            </div>
                            <strong>
                              {renderHighlightedText(note.title, search)}
                            </strong>
                            <p>
                              {renderHighlightedText(getSnippet(note.content), search)}
                            </p>
                            <div className="note-list-item-footer">
                              <span>{getCreatorName(note)}</span>
                              {note.task?.title ? <span>{note.task.title}</span> : null}
                            </div>
                          </button>
                          <button
                            type="button"
                            className="note-pin-button"
                            disabled={pinningNoteId === note.id}
                            onClick={() => handleTogglePin(note)}
                          >
                            {note.isPinned ? "Unpin" : "Pin"}
                          </button>
                        </article>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <section className="note-panel notes-detail-pane">
        {selectedNote ? (
          <div className="notes-detail-shell">
            <div className="project-opened-strip">
              <div className="project-opened-tab" aria-label="Opened note">
                <div className="project-opened-tab-main">
                  <span className="project-opened-tab-icon" aria-hidden="true">
                    N
                  </span>
                  <div className="project-opened-tab-copy">
                    <span className="project-opened-tab-label">Opened Note</span>
                    <strong>{selectedNote.title}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="project-opened-tab-close"
                  onClick={() => setSelectedNoteId("")}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="note-panel-header notes-detail-header">
              <div>
                <div className="dashboard-eyebrow">Workspace Surface</div>
                <h4>{selectedNote.title}</h4>
                <div className="workspace-surface-subtitle">
                  {selectedOrganization?.name || "Team memory"}
                </div>
              </div>

              <div className="note-reader-actions">
                <button
                  type="button"
                  className="note-pin-button"
                  disabled={pinningNoteId === selectedNote.id}
                  onClick={() => handleTogglePin(selectedNote)}
                >
                  {selectedNote.isPinned ? "Unpin note" : "Pin note"}
                </button>
                <button
                  type="button"
                  className="ui-button ui-button-secondary"
                  onClick={() => setIsEditingNote((current) => !current)}
                >
                  {isEditingNote ? "Close Edit" : "Edit Note"}
                </button>
              </div>
            </div>

            <div className="note-detail-meta">
              {selectedNote.isPinned ? <span>Pinned</span> : null}
              <span>{selectedNote.kind === "REFERENCE" ? "Reference" : "Note"}</span>
              <span>{selectedNote.project?.name || "No linked project"}</span>
              {selectedNote.task?.title ? (
                <span>Task: {selectedNote.task.title}</span>
              ) : null}
              <span>Updated {formatDateTime(selectedNote.updatedAt)}</span>
              <span>By {getCreatorName(selectedNote)}</span>
            </div>

            <article className="note-reader-surface">
              <div className="note-reader-context-grid">
                <div className="note-reader-context-card">
                  <span className="dashboard-eyebrow">Project</span>
                  <strong>{selectedNote.project?.name || "General context"}</strong>
                  <p>
                    {selectedNote.project?.description ||
                      "This note is not attached to a specific project."}
                  </p>
                  {getProjectId(selectedNote) ? (
                    <button
                      type="button"
                      className="workspace-context-link"
                      onClick={() => handleOpenProjectFromNote(selectedNote)}
                    >
                      Open project
                    </button>
                  ) : null}
                </div>

                <div className="note-reader-context-card">
                  <span className="dashboard-eyebrow">Task</span>
                  <strong>{selectedNote.task?.title || "No linked task"}</strong>
                  <p>
                    {selectedNote.task?.description ||
                      "Task-linked context will show here when a note belongs to active work."}
                  </p>
                  {getTaskId(selectedNote) ? (
                    <button
                      type="button"
                      className="workspace-context-link"
                      onClick={() => handleOpenTaskFromNote(selectedNote)}
                    >
                      Open task
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="note-reader-content">
                {selectedNote.content?.trim() ? (
                  selectedNote.content
                    .trim()
                    .split(/\n{2,}/)
                    .map((paragraph, index) => <p key={index}>{paragraph}</p>)
                ) : (
                  <p className="muted-text">
                    This note does not have content yet.
                  </p>
                )}
              </div>
            </article>

            <details className="note-links-section">
              <summary className="note-links-header">
                <strong>Connected notes</strong>
                <span className="muted-text">
                  {loadingLinks
                    ? "Loading..."
                    : linkedNotes.length === 0
                      ? "None"
                      : `${linkedNotes.length} connected`}
                </span>
              </summary>

              <div className="note-links-body">
                <label className="form-label">
                  Link another note
                  <input
                    className="ui-input"
                    value={linkQuery}
                    onChange={(event) => setLinkQuery(event.target.value)}
                    placeholder="Search title, content, or kind..."
                  />
                </label>

                {linkError ? <div className="form-error">{linkError}</div> : null}

                {linkQuery.trim() ? (
                  <div className="linked-note-picker">
                    {linkableNotes.length === 0 ? (
                      <div className="muted-text">
                        No matching notes available to link
                      </div>
                    ) : (
                      linkableNotes.map((note) => (
                        <button
                          key={note.id}
                          type="button"
                          className="linked-note-picker-item"
                          onClick={() => handleAddLink(note)}
                          disabled={linkingNoteId === note.id}
                        >
                          <div>
                            <strong>{note.title}</strong>
                            <div className="muted-text">
                              {note.kind === "REFERENCE" ? "Reference" : "Note"}
                              {" - "}
                              {note.project?.name || "General"}
                            </div>
                          </div>
                          <span>
                            {linkingNoteId === note.id ? "Linking..." : "Link"}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}

                <div className="linked-notes-list">
                  {loadingLinks ? (
                    <div className="muted-text">Loading linked notes...</div>
                  ) : linkedNotes.length === 0 ? (
                    <div className="muted-text">No linked context yet</div>
                  ) : (
                    linkedNotes.map((note) => (
                      <div key={note.id} className="linked-note-card">
                        <button
                          type="button"
                          className="linked-note-main"
                          onClick={() => handleSelectNote(note)}
                        >
                          <div className="note-card-topline">
                            <span>{note.project?.name || "General"}</span>
                            <span>{formatDate(note.updatedAt)}</span>
                          </div>
                          <strong>{note.title}</strong>
                          <p>{getSnippet(note.content)}</p>
                          <div className="linked-note-meta">
                            {note.task?.title ? (
                              <span>Task: {note.task.title}</span>
                            ) : null}
                            {note.project?.name ? (
                              <span>Project: {note.project.name}</span>
                            ) : null}
                            {note.isPinned ? <span>Pinned</span> : null}
                          </div>
                        </button>

                        <div className="linked-note-actions">
                          {note.kind === "REFERENCE" ? (
                            <span className="note-kind-pill reference">
                              Reference
                            </span>
                          ) : null}
                          <button
                            type="button"
                            className="note-pin-button"
                            onClick={() => handleRemoveLink(note.id)}
                            disabled={unlinkingNoteId === note.id}
                          >
                            {unlinkingNoteId === note.id ? "Removing..." : "Unlink"}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </details>

            {isEditingNote ? (
              <form className="note-form note-editor-shell" onSubmit={handleUpdateNote}>
                <div className="note-editor-header">
                  <div>
                    <div className="dashboard-eyebrow">Edit Note</div>
                    <strong>{selectedNote.title}</strong>
                  </div>
                </div>

                <label className="form-label">
                  Title
                  <input
                    className="ui-input"
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                  />
                </label>

                <div className="notes-filter-grid">
                  <label className="form-label">
                    Type
                    <select
                      className="ui-input"
                      value={editKind}
                      onChange={(event) => setEditKind(event.target.value)}
                    >
                      <option value="NOTE">Note</option>
                      <option value="REFERENCE">Reference</option>
                    </select>
                  </label>

                  <label className="form-label">
                    Project link
                    <select
                      className="ui-input"
                      value={editProjectId}
                      onChange={(event) => setEditProjectId(event.target.value)}
                    >
                      <option value="">No project</option>
                      {projectOptions.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="form-label">
                  Content
                  <textarea
                    className="ui-textarea note-content-editor"
                    value={editContent}
                    onChange={(event) => setEditContent(event.target.value)}
                    rows={10}
                  />
                </label>

                <div className="button-row">
                  <button
                    type="button"
                    className="ui-button ui-button-secondary"
                    onClick={() => {
                      setEditTitle(selectedNote.title || "");
                      setEditContent(selectedNote.content || "");
                      setEditProjectId(selectedNote.projectId || "");
                      setEditKind(selectedNote.kind || "NOTE");
                      setIsEditingNote(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="ui-button ui-button-dark"
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save note"}
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button-danger"
                    disabled={deleting}
                    onClick={handleDeleteNote}
                  >
                    {deleting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        ) : (
          <div className="org-empty-state notes-detail-empty">
            <h4>Open a note</h4>
            <p>
              Search across pinned, recent, project-linked, and task-linked notes
              from the left side to keep context close to the work.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
