import { useEffect, useMemo, useState } from "react";
import {
  createProject,
  getMyOrganizations,
  getOrganizationProjects,
  updateProject,
} from "../../api";

const canManageProject = (role) => ["OWNER", "ADMIN"].includes(role);

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString() : "Unknown";

export default function ProjectsWorkspace({ token }) {
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [error, setError] = useState("");

  const selectedOrganization = useMemo(
    () => organizations.find((org) => org.id === selectedOrgId) || null,
    [organizations, selectedOrgId]
  );
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );
  const canManage = canManageProject(selectedOrganization?.role);

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
        setSelectedOrgId(nextOrganizations[0]?.id || "");
      } catch (err) {
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

        if (!active) return;

        const nextProjects = res.data || [];
        setProjects(nextProjects);
        setSelectedProjectId(nextProjects[0]?.id || "");
      } catch (err) {
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
  }, [selectedOrgId, token]);

  useEffect(() => {
    setEditName(selectedProject?.name || "");
    setEditDescription(selectedProject?.description || "");
  }, [selectedProject]);

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
    } catch (err) {
      setError(err.response?.data?.message || "Could not save project.");
    } finally {
      setSaving(false);
    }
  };

  if (loadingOrganizations) {
    return <div className="workspace-placeholder">Loading projects...</div>;
  }

  return (
    <div className="projects-workspace">
      {error ? <div className="form-error project-error">{error}</div> : null}

      <section className="project-panel">
        <div className="project-panel-header">
          <div>
            <div className="dashboard-eyebrow">Projects</div>
            <h4>Workspace hubs</h4>
          </div>
        </div>

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

        {canManage ? (
          <form className="project-form" onSubmit={handleCreateProject}>
            <label className="form-label">
              New project
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
            <button
              type="submit"
              className="ui-button ui-button-primary"
              disabled={creating || !selectedOrgId}
            >
              {creating ? "Creating..." : "Create project"}
            </button>
          </form>
        ) : selectedOrganization ? (
          <div className="muted-text">
            Only organization owners and admins can create projects.
          </div>
        ) : null}
      </section>

      <section className="project-panel project-list-panel">
        {loadingProjects ? (
          <div className="workspace-placeholder">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="org-empty-state">
            <h4>No projects yet</h4>
            <p>Projects created in this organization will appear here.</p>
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
                onClick={() => setSelectedProjectId(project.id)}
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
      </section>

      <section className="project-panel project-detail-panel">
        {selectedProject ? (
          <>
            <div className="project-panel-header">
              <div>
                <div className="dashboard-eyebrow">Project Detail</div>
                <h4>{selectedProject.name}</h4>
              </div>
            </div>

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

            <div className="muted-text">
              Created {formatDate(selectedProject.createdAt)}
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
                    rows={4}
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
            ) : (
              <p className="muted-text">
                You can view this project. Owners and admins can edit it.
              </p>
            )}
          </>
        ) : (
          <div className="org-empty-state">
            <h4>Select a project</h4>
            <p>Project details and task counts will appear here.</p>
          </div>
        )}
      </section>
    </div>
  );
}
