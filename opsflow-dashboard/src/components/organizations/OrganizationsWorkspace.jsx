import { useEffect, useMemo, useState } from "react";
import {
  addOrganizationMember,
  createOrganization,
  getMyOrganizations,
  getOrganizationMembers,
  getOrganizationProjects,
  removeOrganizationMember,
} from "../../api";
import usePersistentState from "../../hooks/usePersistentState";

const manageableRoles = ["OWNER", "ADMIN"];
const memberRoleOptions = ["ALL", "OWNER", "ADMIN", "MEMBER", "VIEWER"];

const displayUserName = (user) =>
  user?.fullName || user?.username || user?.email || "Unknown user";

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString() : "Unknown";

const getOrganizationInitials = (organization) => {
  const label = organization?.name?.trim() || "";

  if (!label) {
    return "O";
  }

  const parts = label.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
};

const getMemberRoleRank = (role) => {
  if (role === "OWNER") return 0;
  if (role === "ADMIN") return 1;
  if (role === "MEMBER") return 2;
  if (role === "VIEWER") return 3;
  return 4;
};

export default function OrganizationsWorkspace({ token }) {
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = usePersistentState(
    "opsflow.organizations.selectedOrgId",
    ""
  );
  const [activeOrganizationTab, setActiveOrganizationTab] = usePersistentState(
    "opsflow.organizations.activeTab",
    "overview"
  );
  const [members, setMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [memberCountsByOrgId, setMemberCountsByOrgId] = useState({});
  const [projectCountsByOrgId, setProjectCountsByOrgId] = useState({});
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [memberLookup, setMemberLookup] = useState("");
  const [memberRole, setMemberRole] = useState("MEMBER");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberRoleFilter, setMemberRoleFilter] = useState("ALL");
  const [creatingOrganization, setCreatingOrganization] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [removingMember, setRemovingMember] = useState(false);
  const [showOrganizationCreateForm, setShowOrganizationCreateForm] =
    useState(false);
  const [showOrganizationMemberAddForm, setShowOrganizationMemberAddForm] =
    useState(false);
  const [showOrganizationMemberRemoveForm, setShowOrganizationMemberRemoveForm] =
    useState(false);
  const [selectedRemovalMembershipId, setSelectedRemovalMembershipId] =
    useState("");
  const [error, setError] = useState("");

  const selectedOrganization = useMemo(
    () =>
      organizations.find((organization) => organization.id === selectedOrgId) ||
      null,
    [organizations, selectedOrgId]
  );

  const canManageSelectedOrganization =
    selectedOrganization &&
    manageableRoles.includes(selectedOrganization.role);
  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();

    return [...members]
      .filter((membership) => {
        if (
          memberRoleFilter !== "ALL" &&
          membership.role !== memberRoleFilter
        ) {
          return false;
        }

        if (!query) {
          return true;
        }

        const name = displayUserName(membership.user).toLowerCase();
        const email = membership.user?.email?.toLowerCase() || "";
        const username = membership.user?.username?.toLowerCase() || "";

        return (
          name.includes(query) ||
          email.includes(query) ||
          username.includes(query)
        );
      })
      .sort((left, right) => {
        const roleDelta =
          getMemberRoleRank(left.role) - getMemberRoleRank(right.role);

        if (roleDelta !== 0) {
          return roleDelta;
        }

        return displayUserName(left.user).localeCompare(
          displayUserName(right.user)
        );
      });
  }, [memberRoleFilter, memberSearch, members]);
  const selectedRemovalMember = useMemo(
    () =>
      members.find((membership) => membership.id === selectedRemovalMembershipId) ||
      null,
    [members, selectedRemovalMembershipId]
  );
  const activeOrganizationPopup = showOrganizationCreateForm
    ? "create-organization"
    : showOrganizationMemberAddForm
      ? "add-member"
      : showOrganizationMemberRemoveForm && selectedRemovalMember
        ? "remove-member"
        : "";

  useEffect(() => {
    let isMounted = true;

    const loadOrganizations = async () => {
      setLoadingOrganizations(true);
      setError("");

      try {
        const res = await getMyOrganizations(token);

        if (!isMounted) return;

        const nextOrganizations = res.data || [];
        setOrganizations(nextOrganizations);
        setSelectedOrgId((currentId) =>
          nextOrganizations.some((organization) => organization.id === currentId)
            ? currentId
            : currentId
              ? ""
              : nextOrganizations[0]?.id || ""
        );
      } catch (err) {
        if (!isMounted) return;
        setError(
          err.response?.data?.message || "Could not load your organizations."
        );
      } finally {
        if (isMounted) {
          setLoadingOrganizations(false);
        }
      }
    };

    loadOrganizations();

    return () => {
      isMounted = false;
    };
  }, [setSelectedOrgId, token]);

  useEffect(() => {
    let isMounted = true;

    const loadMembers = async () => {
      if (!selectedOrgId) {
        setMembers([]);
        return;
      }

      setLoadingMembers(true);
      setError("");

      try {
        const res = await getOrganizationMembers(token, selectedOrgId);

        if (!isMounted) {
          return;
        }

        const nextMembers = res.data || [];
        setMembers(nextMembers);
        setMemberCountsByOrgId((current) => ({
          ...current,
          [selectedOrgId]: nextMembers.length,
        }));
      } catch (err) {
        if (!isMounted) return;
        setMembers([]);
        setError(
          err.response?.data?.message ||
            "Could not load organization members."
        );
      } finally {
        if (isMounted) {
          setLoadingMembers(false);
        }
      }
    };

    loadMembers();

    return () => {
      isMounted = false;
    };
  }, [selectedOrgId, token]);

  useEffect(() => {
    setShowOrganizationCreateForm(false);
    setShowOrganizationMemberAddForm(false);
    setShowOrganizationMemberRemoveForm(false);
    setSelectedRemovalMembershipId("");
  }, [selectedOrgId, activeOrganizationTab]);

  useEffect(() => {
    if (!activeOrganizationPopup) {
      return undefined;
    }

    const handlePopupEscape = (event) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      closeOrganizationPopup();
    };

    window.addEventListener("keydown", handlePopupEscape, true);

    return () => {
      window.removeEventListener("keydown", handlePopupEscape, true);
    };
  }, [activeOrganizationPopup]);

  useEffect(() => {
    let isMounted = true;

    const loadProjects = async () => {
      if (!selectedOrgId) {
        setProjects([]);
        return;
      }

      setLoadingProjects(true);
      setError("");

      try {
        const res = await getOrganizationProjects(token, selectedOrgId);

        if (!isMounted) {
          return;
        }

        const nextProjects = res.data || [];
        setProjects(nextProjects);
        setProjectCountsByOrgId((current) => ({
          ...current,
          [selectedOrgId]: nextProjects.length,
        }));
      } catch (err) {
        if (!isMounted) return;
        setProjects([]);
        setError(
          err.response?.data?.message ||
            "Could not load organization projects."
        );
      } finally {
        if (isMounted) {
          setLoadingProjects(false);
        }
      }
    };

    loadProjects();

    return () => {
      isMounted = false;
    };
  }, [selectedOrgId, token]);

  const handleCreateOrganization = async (event) => {
    event.preventDefault();

    const trimmedName = organizationName.trim();

    if (!trimmedName) {
      setError("Organization name is required.");
      return;
    }

    setCreatingOrganization(true);
    setError("");

    try {
      const payload = {
        name: trimmedName,
      };

      if (organizationSlug.trim()) {
        payload.slug = organizationSlug.trim();
      }

      const res = await createOrganization(token, payload);
      const createdOrganization = res.data;

      setOrganizations((current) => [...current, createdOrganization]);
      setSelectedOrgId(createdOrganization.id);
      setActiveOrganizationTab("overview");
      setShowOrganizationCreateForm(false);
      setOrganizationName("");
      setOrganizationSlug("");
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not create organization."
      );
    } finally {
      setCreatingOrganization(false);
    }
  };

  const handleAddMember = async (event) => {
    event.preventDefault();

    const lookup = memberLookup.trim();

    if (!lookup || !selectedOrgId) {
      setError("Email or username is required.");
      return;
    }

    setAddingMember(true);
    setError("");

    try {
      const res = await addOrganizationMember(token, selectedOrgId, {
        emailOrUsername: lookup,
        role: memberRole,
      });

      const createdMember = res.data;

      setMembers((current) => {
        const nextMembers = [...current, createdMember];
        setMemberCountsByOrgId((counts) => ({
          ...counts,
          [selectedOrgId]: nextMembers.length,
        }));
        return nextMembers;
      });
      setShowOrganizationMemberAddForm(false);
      setMemberLookup("");
      setMemberRole("MEMBER");
    } catch (err) {
      setError(err.response?.data?.message || "Could not add member.");
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedOrgId || !selectedRemovalMembershipId) {
      return;
    }

    setRemovingMember(true);
    setError("");

    try {
      await removeOrganizationMember(
        token,
        selectedOrgId,
        selectedRemovalMembershipId
      );

      setMembers((current) => {
        const nextMembers = current.filter(
          (membership) => membership.id !== selectedRemovalMembershipId
        );
        setMemberCountsByOrgId((counts) => ({
          ...counts,
          [selectedOrgId]: nextMembers.length,
        }));
        return nextMembers;
      });
      closeOrganizationPopup();
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not remove organization member."
      );
    } finally {
      setRemovingMember(false);
    }
  };

  const closeOrganizationPopup = () => {
    setShowOrganizationCreateForm(false);
    setShowOrganizationMemberAddForm(false);
    setShowOrganizationMemberRemoveForm(false);
    setSelectedRemovalMembershipId("");
  };

  const handleSelectOrganization = (organizationId) => {
    setSelectedOrgId(organizationId);
    setActiveOrganizationTab("overview");
  };

  if (loadingOrganizations) {
    return (
      <div className="workspace-placeholder">Loading organizations...</div>
    );
  }

  return (
    <div className="organizations-workspace">
      {error ? <div className="form-error org-error">{error}</div> : null}

      <section className="project-panel organization-collection-pane">
        <div className="project-panel-header project-collection-header">
          <div>
            <div className="dashboard-eyebrow">Organizations</div>
            <h4>Operational groups</h4>
          </div>
        </div>

        <div className="organization-collection-body">
          <div className="organization-collection-controls">
            <div className="organization-create-block">
              <div className="dashboard-eyebrow">Create</div>
              <div className="contextual-create-block">
                <button
                  className="contextual-create-button"
                  type="button"
                  onClick={() => {
                    setShowOrganizationCreateForm(true);
                  }}
                >
                  + Create Organization
                </button>
              </div>
            </div>
          </div>

          <div className="project-list-panel organization-list-panel">
            <div className="project-panel-header project-list-header">
              <div>
                <div className="dashboard-eyebrow">Collection</div>
                <h4>Your organizations</h4>
              </div>
            </div>

            {organizations.length === 0 ? (
              <div className="org-empty-state">
                <h4>No organization yet</h4>
                <p>
                  Create an organization to group members, projects, and shared
                  workspaces.
                </p>
              </div>
            ) : (
              <div className="project-card-grid organization-card-grid">
                {organizations.map((organization) => {
                  const memberCount =
                    organization.memberCount ??
                    memberCountsByOrgId[organization.id] ??
                    null;

                  return (
                    <button
                      key={organization.id}
                      type="button"
                      className={
                        organization.id === selectedOrgId
                          ? "project-card organization-card active"
                          : "project-card organization-card"
                      }
                      onClick={() => handleSelectOrganization(organization.id)}
                    >
                      <div className="organization-card-head">
                        <span className="organization-avatar">
                          {getOrganizationInitials(organization)}
                        </span>
                        <div className="organization-card-copy">
                          <strong>{organization.name}</strong>
                          <span>{organization.slug || "Operational workspace"}</span>
                        </div>
                      </div>

                      <div className="project-card-footer organization-card-footer">
                        <div className="project-count-row organization-count-row">
                          <span>{organization.role}</span>
                          {memberCount !== null ? (
                            <span>
                              {memberCount} member{memberCount === 1 ? "" : "s"}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="project-panel organization-detail-panel">
        {selectedOrganization ? (
          <>
            <div className="project-opened-strip">
              <div className="project-opened-tab" aria-label="Opened organization">
                <div className="project-opened-tab-main">
                  <span
                    className="project-opened-tab-icon organization-opened-tab-icon"
                    aria-hidden="true"
                  >
                    {getOrganizationInitials(selectedOrganization)}
                  </span>
                  <div className="project-opened-tab-copy">
                    <span className="project-opened-tab-label">
                      Opened Organization
                    </span>
                    <strong>{selectedOrganization.name}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="project-opened-tab-close"
                  onClick={() => setSelectedOrgId("")}
                  aria-label={`Close ${selectedOrganization.name}`}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="project-panel-header project-detail-header">
              <div>
                <div className="dashboard-eyebrow">Organization Surface</div>
                <h4>{selectedOrganization.name}</h4>
              </div>
              <span className="role-pill">{selectedOrganization.role}</span>
            </div>

            <div
              className="project-surface-tabs"
              role="tablist"
              aria-label="Organization detail tabs"
            >
              <button
                type="button"
                className={
                  activeOrganizationTab === "overview"
                    ? "project-surface-tab active"
                    : "project-surface-tab"
                }
                onClick={() => setActiveOrganizationTab("overview")}
              >
                Overview
              </button>
              <button
                type="button"
                className={
                  activeOrganizationTab === "members"
                    ? "project-surface-tab active"
                    : "project-surface-tab"
                }
                onClick={() => setActiveOrganizationTab("members")}
              >
                Members
              </button>
              <button
                type="button"
                className={
                  activeOrganizationTab === "projects"
                    ? "project-surface-tab active"
                    : "project-surface-tab"
                }
                onClick={() => setActiveOrganizationTab("projects")}
              >
                Projects
              </button>
              <button
                type="button"
                className={
                  activeOrganizationTab === "settings"
                    ? "project-surface-tab active"
                    : "project-surface-tab"
                }
                onClick={() => setActiveOrganizationTab("settings")}
              >
                Settings
              </button>
            </div>

            <div className="project-detail-content organization-detail-content">
              {activeOrganizationTab === "overview" ? (
                <div className="project-overview-surface organization-overview-surface">
                  <div className="project-detail-stats">
                    <div>
                      <strong>
                        {memberCountsByOrgId[selectedOrganization.id] ?? members.length}
                      </strong>
                      <span>Members</span>
                    </div>
                    <div>
                      <strong>
                        {projectCountsByOrgId[selectedOrganization.id] ?? projects.length}
                      </strong>
                      <span>Projects</span>
                    </div>
                    <div>
                      <strong>{selectedOrganization.slug || "Default"}</strong>
                      <span>Slug</span>
                    </div>
                  </div>

                  <div className="project-detail-meta">
                    <span>Created {formatDate(selectedOrganization.createdAt)}</span>
                    {selectedOrganization.updatedAt ? (
                      <span>
                        Updated {formatDate(selectedOrganization.updatedAt)}
                      </span>
                    ) : null}
                    <span>Your role {selectedOrganization.role}</span>
                  </div>

                  <p className="project-surface-description">
                    This organization surface keeps your people, project access,
                    and shared workspace structure in one calmer operational
                    layer.
                  </p>
                </div>
              ) : null}

              {activeOrganizationTab === "members" ? (
                <section className="project-surface-section project-members-surface organization-members-surface">
                  <div className="project-surface-section-header">
                    <div>
                      <div className="dashboard-eyebrow">Organization Members</div>
                      <h5>People in this workspace</h5>
                    </div>
                  </div>

                  {loadingMembers ? (
                    <div className="muted-text">Loading members...</div>
                  ) : members.length === 0 ? (
                    <div className="muted-text">
                      No members are connected to this organization yet.
                    </div>
                  ) : (
                    <div className="organization-members-toolbar">
                      <label className="organization-members-control">
                        <span>Search</span>
                        <input
                          className="ui-input"
                          value={memberSearch}
                          onChange={(event) => setMemberSearch(event.target.value)}
                          placeholder="Name, email, or username"
                        />
                      </label>
                      <label className="organization-members-control organization-members-control-compact">
                        <span>Role</span>
                        <select
                          className="ui-input"
                          value={memberRoleFilter}
                          onChange={(event) => setMemberRoleFilter(event.target.value)}
                        >
                          {memberRoleOptions.map((role) => (
                            <option key={role} value={role}>
                              {role === "ALL" ? "All roles" : role}
                            </option>
                          ))}
                        </select>
                      </label>
                      {canManageSelectedOrganization ? (
                        <button
                          type="button"
                          className="contextual-create-button"
                          onClick={() => {
                            closeOrganizationPopup();
                            setShowOrganizationMemberAddForm(true);
                          }}
                        >
                          Add Member
                        </button>
                      ) : null}
                    </div>
                  )}

                  {!loadingMembers && members.length > 0 ? (
                    filteredMembers.length === 0 ? (
                      <div className="muted-text">
                        No members match the current search or role filter.
                      </div>
                    ) : (
                    <div className="project-members-list-shell">
                      <div className="project-members-list">
                        {filteredMembers.map((membership) => (
                          <div key={membership.id} className="project-member-row">
                            <span className="project-member-avatar project-member-avatar-large">
                              {getOrganizationInitials({
                                name: displayUserName(membership.user),
                              })}
                            </span>

                            <div className="project-member-copy">
                              <strong>{displayUserName(membership.user)}</strong>
                              {membership.user?.email ? (
                                <span>{membership.user.email}</span>
                              ) : null}
                            </div>

                            {membership.role ? (
                              <span className="project-member-role">
                                {membership.role}
                              </span>
                            ) : null}

                            {canManageSelectedOrganization ? (
                              <button
                                type="button"
                                className="contextual-card-action danger"
                                onClick={() => {
                                  closeOrganizationPopup();
                                  setSelectedRemovalMembershipId(membership.id);
                                  setShowOrganizationMemberRemoveForm(true);
                                }}
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                    )
                  ) : null}
                </section>
              ) : null}

              {activeOrganizationTab === "projects" ? (
                <section className="project-surface-section organization-projects-surface">
                  <div className="project-surface-section-header">
                    <div>
                      <div className="dashboard-eyebrow">Projects</div>
                      <h5>Connected project spaces</h5>
                    </div>
                  </div>

                  {loadingProjects ? (
                    <div className="muted-text">Loading projects...</div>
                  ) : projects.length === 0 ? (
                    <div className="muted-text">
                      No projects belong to this organization yet.
                    </div>
                  ) : (
                    <div className="organization-project-list-shell">
                      <div className="organization-project-list">
                        {projects.map((project) => (
                          <div key={project.id} className="organization-project-row">
                            <div className="organization-project-row-main">
                              <strong>{project.name}</strong>
                              <div className="organization-project-row-meta">
                                <span>
                                  {project.taskCounts?.totalActive || 0} active
                                </span>
                                <span>{project.taskCounts?.done || 0} done</span>
                                <span>
                                  {project.members?.length || 0} member
                                  {(project.members?.length || 0) === 1 ? "" : "s"}
                                </span>
                              </div>
                            </div>
                            <span className="organization-project-row-note">
                              {project.description || "No description yet"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              ) : null}

              {activeOrganizationTab === "settings" ? (
                <section className="project-surface-section organization-foundation-surface">
                  <div className="project-surface-section-header">
                    <div>
                      <div className="dashboard-eyebrow">Settings</div>
                      <h5>Workspace configuration</h5>
                    </div>
                  </div>

                  <div className="organization-settings-summary">
                    <div className="organization-settings-row">
                      <span>Name</span>
                      <strong>{selectedOrganization.name}</strong>
                    </div>
                    <div className="organization-settings-row">
                      <span>Slug</span>
                      <strong>{selectedOrganization.slug || "Default"}</strong>
                    </div>
                    <div className="organization-settings-row">
                      <span>Your role</span>
                      <strong>{selectedOrganization.role}</strong>
                    </div>
                  </div>

                  <p className="muted-text organization-foundation-copy">
                    Organization editing is not currently supported in this
                    workspace, so settings stay read-first for now.
                  </p>
                </section>
              ) : null}
            </div>
          </>
        ) : (
          <div className="org-empty-state">
            <h4>Open an organization</h4>
            <p>
              Members, project access, and future workspace settings will gather
              here without taking over the page.
            </p>
          </div>
        )}
      </section>

      {activeOrganizationPopup ? (
        <div className="project-workspace-popup-layer" role="presentation">
          <button
            type="button"
            className="project-workspace-popup-backdrop"
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              closeOrganizationPopup();
            }}
            aria-label="Close workspace popup"
          />

          <div
            className="project-workspace-popup-shell"
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            {activeOrganizationPopup === "create-organization" ? (
              <form
                className="project-form contextual-create-surface workspace-action-popup"
                onSubmit={handleCreateOrganization}
              >
                <div className="workspace-action-popup-header">
                  <div className="dashboard-eyebrow">Create</div>
                  <strong>New Organization</strong>
                </div>
                <label className="form-label">
                  Organization name
                  <input
                    className="ui-input"
                    value={organizationName}
                    onChange={(event) => setOrganizationName(event.target.value)}
                    placeholder="Acme Operations"
                  />
                </label>

                <label className="form-label">
                  Slug optional
                  <input
                    className="ui-input"
                    value={organizationSlug}
                    onChange={(event) => setOrganizationSlug(event.target.value)}
                    placeholder="acme-operations"
                  />
                </label>

                <div className="button-row contextual-create-actions">
                  <button
                    type="submit"
                    className="ui-button ui-button-primary"
                    disabled={creatingOrganization}
                  >
                    {creatingOrganization ? "Creating..." : "Save organization"}
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button-secondary"
                    onClick={closeOrganizationPopup}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}

            {activeOrganizationPopup === "add-member" ? (
              <form
                className="project-form contextual-create-surface workspace-action-popup"
                onSubmit={handleAddMember}
              >
                <div className="workspace-action-popup-header">
                  <div className="dashboard-eyebrow">Members</div>
                  <strong>Add member to {selectedOrganization?.name}</strong>
                </div>

                <label className="form-label">
                  Add existing user
                  <input
                    className="ui-input"
                    value={memberLookup}
                    onChange={(event) => setMemberLookup(event.target.value)}
                    placeholder="email@example.com or username"
                  />
                </label>

                <label className="form-label">
                  Role
                  <select
                    className="ui-input"
                    value={memberRole}
                    onChange={(event) => setMemberRole(event.target.value)}
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                </label>

                <div className="button-row contextual-create-actions">
                  <button
                    type="submit"
                    className="ui-button ui-button-primary"
                    disabled={addingMember}
                  >
                    {addingMember ? "Adding..." : "Add member"}
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button-secondary"
                    onClick={closeOrganizationPopup}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}

            {activeOrganizationPopup === "remove-member" &&
            selectedOrganization &&
            selectedRemovalMember ? (
              <div className="project-form contextual-create-surface workspace-action-popup">
                <div className="workspace-action-popup-header">
                  <div className="dashboard-eyebrow">Members</div>
                  <strong>
                    Remove {displayUserName(selectedRemovalMember.user)}?
                  </strong>
                </div>
                <p className="workspace-action-popup-copy">
                  {selectedRemovalMember.user?.email || "This member"} will lose
                  access to {selectedOrganization.name}, but their user account
                  will remain untouched.
                </p>
                <div className="button-row contextual-create-actions">
                  <button
                    type="button"
                    className="ui-button ui-button-danger"
                    onClick={handleRemoveMember}
                    disabled={removingMember}
                  >
                    {removingMember ? "Removing..." : "Remove member"}
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button-secondary"
                    onClick={closeOrganizationPopup}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
