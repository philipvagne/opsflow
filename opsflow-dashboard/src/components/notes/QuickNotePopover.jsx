import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  createNote,
  getMyOrganizations,
  getOrganizationProjects,
} from "../../api";
import { emitNoteCreated } from "../../lib/noteEvents";

function buildQuickNoteTitle(title, content) {
  const trimmedTitle = title.trim();

  if (trimmedTitle) {
    return trimmedTitle;
  }

  const trimmedContent = content.trim();

  if (!trimmedContent) {
    return "";
  }

  const [firstLine] = trimmedContent
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const source = firstLine || trimmedContent;

  if (source.length <= 40) {
    return source;
  }

  return `${source.slice(0, 40).trim()}...`;
}

export default function QuickNotePopover({
  token,
  isOpen,
  onClose,
  selectedTask,
  selectedProjectId,
  currentOrganizationId,
}) {
  const contentRef = useRef(null);
  const [organizations, setOrganizations] = useState([]);
  const [projects, setProjects] = useState([]);
  const [organizationId, setOrganizationId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loadingContext, setLoadingContext] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const hasOrganization = Boolean(organizationId);
  const taskOrganizationId = selectedTask?.project?.organizationId || "";
  const taskProjectId = selectedTask?.project?.id || "";

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => organization.id === organizationId) || null,
    [organizationId, organizations]
  );

  const resetForm = () => {
    setError("");
    setTitle("");
    setContent("");
    setSaving(false);
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    contentRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let active = true;

    const loadContext = async () => {
      setLoadingContext(true);
      setError("");

      try {
        const organizationsRes = await getMyOrganizations(token);
        const nextOrganizations = organizationsRes.data || [];

        if (!active) {
          return;
        }

        setOrganizations(nextOrganizations);

        const notesOrgId =
          window.localStorage.getItem("opsflow.notes.selectedOrgId") || "";
        const projectsOrgId =
          window.localStorage.getItem("opsflow.projects.selectedOrgId") || "";
        const validOrganizationIds = new Set(
          nextOrganizations.map((organization) => organization.id)
        );
        const nextOrganizationId =
          [
            taskOrganizationId,
            currentOrganizationId,
            notesOrgId,
            projectsOrgId,
            nextOrganizations[0]?.id || "",
          ].find(
            (organizationCandidate) =>
              organizationCandidate &&
              validOrganizationIds.has(organizationCandidate)
          ) || "";

        if (!nextOrganizationId) {
          setOrganizationId("");
          setProjectId("");
          setTaskId("");
          setError("Create or join a team before saving notes.");
          return;
        }

        setOrganizationId(nextOrganizationId);
        setTaskId(taskOrganizationId ? selectedTask.id : "");

        try {
          const projectsRes = await getOrganizationProjects(token, nextOrganizationId);
          const nextProjects = projectsRes.data || [];

          if (!active) {
            return;
          }

          setProjects(nextProjects);

          const storedProjectId =
            window.localStorage.getItem("opsflow.projects.selectedProjectId") || "";
          const projectCandidate =
            taskProjectId ||
            (selectedProjectId && selectedProjectId !== "ALL"
              ? selectedProjectId
              : "") ||
            storedProjectId;

          const matchedProject = nextProjects.find(
            (project) => project.id === projectCandidate
          );

          setProjectId(matchedProject?.id || "");
        } catch {
          if (active) {
            setProjects([]);
            setProjectId("");
          }
        }
      } catch {
        if (active) {
          setOrganizations([]);
          setProjects([]);
          setOrganizationId("");
          setProjectId("");
          setTaskId("");
          setError("Could not load note context.");
        }
      } finally {
        if (active) {
          setLoadingContext(false);
        }
      }
    };

    loadContext();

    return () => {
      active = false;
    };
  }, [
    currentOrganizationId,
    isOpen,
    selectedProjectId,
    selectedTask,
    taskOrganizationId,
    taskProjectId,
    token,
  ]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextTitle = buildQuickNoteTitle(title, content);
    const trimmedContent = content.trim();

    if (!hasOrganization) {
      setError("Create or join a team before saving notes.");
      return;
    }

    if (!nextTitle) {
      setError("Write a quick note before saving.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await createNote(token, {
        title: nextTitle,
        content: trimmedContent,
        kind: "NOTE",
        organizationId,
        projectId: projectId || undefined,
        taskId: taskId || undefined,
      });

      emitNoteCreated(res.data);
      toast.success("Quick note saved");
      resetForm();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save quick note.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="quick-note-shell"
      onClick={(event) => event.stopPropagation()}
    >
      <form className="quick-note-popover" onSubmit={handleSubmit}>
        <div className="quick-note-header">
          <div>
            <div className="dashboard-eyebrow">Quick Note</div>
            <h4>Capture context</h4>
          </div>

          <button
            type="button"
            className="task-detail-close"
            onClick={() => {
              resetForm();
              onClose();
            }}
          >
            Close
          </button>
        </div>

        {loadingContext ? (
          <div className="muted-text">Loading note context...</div>
        ) : (
          <>
            <div className="quick-note-context">
              <span>{selectedOrganization?.name || "No team"}</span>
              {projectId ? (
                <span>
                  {
                    projects.find((project) => project.id === projectId)?.name
                  }
                </span>
              ) : null}
              {taskId && selectedTask ? (
                <span>{selectedTask.title}</span>
              ) : null}
            </div>

            <label className="form-label">
              Title
              <input
                className="ui-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Optional title"
              />
            </label>

            <label className="form-label">
              Note
              <textarea
                ref={contentRef}
                className="ui-textarea quick-note-textarea"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Capture a decision, reference, reminder, or procedure..."
                rows={6}
                onKeyDown={(event) => {
                  if (
                    event.key === "Escape" &&
                    !event.metaKey &&
                    !event.ctrlKey
                  ) {
                    event.preventDefault();
                    resetForm();
                    onClose();
                  }

                  if (
                    event.key === "Enter" &&
                    (event.metaKey || event.ctrlKey)
                  ) {
                    event.preventDefault();
                    handleSubmit(event);
                  }
                }}
              />
            </label>

            <div className="quick-note-helper">
              Leave the title empty and OpsFlow will generate one from the note.
            </div>

            {error ? <div className="form-error">{error}</div> : null}

            <div className="button-row">
              <button
                type="submit"
                className="ui-button ui-button-primary"
                disabled={saving || loadingContext || !hasOrganization}
              >
                {saving ? "Saving..." : "Save quick note"}
              </button>

              <button
                type="button"
                className="ui-button ui-button-secondary"
                onClick={() => {
                  resetForm();
                  onClose();
                }}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
