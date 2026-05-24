import { useEffect, useState } from "react";
import {
  getAuthProfile,
  getOrganizationProjects,
} from "../../api";

export default function CreateTaskPanel({
  token,
  onClose,
  onCreateTask,
}) {
  const [organizations, setOrganizations] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [loadingContext, setLoadingContext] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadOrganizations = async () => {
      setLoadingContext(true);
      setError("");

      try {
        const res = await getAuthProfile(token);
        const orgs = res.data.organizations || [];

        if (active) {
          setOrganizations(orgs);
          setSelectedOrgId(orgs[0]?.id || "");
        }
      } catch (err) {
        if (active) {
          setError("Could not load your workspace context.");
        }
      } finally {
        if (active) {
          setLoadingContext(false);
        }
      }
    };

    loadOrganizations();

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!selectedOrgId) {
      setProjects([]);
      setSelectedProjectId("");
      return;
    }

    let active = true;

    const loadProjects = async () => {
      setLoadingProjects(true);
      setError("");

      try {
        const res = await getOrganizationProjects(token, selectedOrgId);
        const nextProjects = res.data || [];

        if (active) {
          setProjects(nextProjects);
          setSelectedProjectId(nextProjects[0]?.id || "");
        }
      } catch (err) {
        if (active) {
          setProjects([]);
          setSelectedProjectId("");
          setError("Could not load projects for this team.");
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
  }, [selectedOrgId, token]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setError("Task title is required.");
      return;
    }

    if (!selectedOrgId || !selectedProjectId) {
      setError("A project is required before creating tasks.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await onCreateTask({
        orgId: selectedOrgId,
        projectId: selectedProjectId,
        title: trimmedTitle,
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
      });
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not create task."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const hasOrganizations = organizations.length > 0;
  const hasProjects = projects.length > 0;

  return (
    <div className="task-detail-panel">
      <div className="task-detail-header">
        <div>
          <div className="dashboard-eyebrow">Create</div>
          <h2>New Task</h2>
        </div>

        <button
          type="button"
          className="task-detail-close"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      {loadingContext ? (
        <div className="context-panel-empty">
          Loading workspace context...
        </div>
      ) : !hasOrganizations ? (
        <div className="context-panel-empty">
          A project is required before creating tasks. Create or join a
          team first.
        </div>
      ) : (
        <form className="task-create-form" onSubmit={handleSubmit}>
          <section className="task-panel-section">
            <strong>Workspace</strong>

            <label className="form-label">
              Team
              <select
                className="ui-input full-width"
                value={selectedOrgId}
                onChange={(event) => setSelectedOrgId(event.target.value)}
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-label">
              Project
              <select
                className="ui-input full-width"
                value={selectedProjectId}
                onChange={(event) => setSelectedProjectId(event.target.value)}
                disabled={loadingProjects || !hasProjects}
              >
                {hasProjects ? (
                  projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))
                ) : (
                  <option value="">No projects available</option>
                )}
              </select>
            </label>

            {!hasProjects && !loadingProjects && (
              <div className="muted-text">
                Create a project in this team before adding tasks.
              </div>
            )}
          </section>

          <section className="task-panel-section">
            <label className="form-label">
              Title
              <input
                className="ui-input full-width"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Task title"
              />
            </label>

            <label className="form-label">
              Description
              <textarea
                className="ui-textarea"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional description"
                rows={4}
              />
            </label>

            <label className="form-label">
              Due date
              <input
                type="date"
                className="ui-input full-width"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>
          </section>

          {error && <div className="form-error">{error}</div>}

          <div className="button-row">
            <button
              type="submit"
              className="ui-button ui-button-primary"
              disabled={submitting || !hasProjects}
            >
              {submitting ? "Creating..." : "Create task"}
            </button>

            <button
              type="button"
              className="ui-button ui-button-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
