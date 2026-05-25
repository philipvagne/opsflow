import { useEffect, useMemo, useState } from "react";
import {
  addOrganizationMember,
  createOrganization,
  deleteOrganization as deleteOrganizationApi,
  getMyOrganizations,
  getOrganizationMembers,
  getOrganizationProjects,
  removeOrganizationMember,
  updateOrganization as updateOrganizationApi,
} from "../../api";
import usePersistentState from "../../hooks/usePersistentState";

const manageableRoles = ["OWNER", "ADMIN"];
const memberRoleOptions = ["ALL", "OWNER", "ADMIN", "MEMBER", "VIEWER"];

const displayUserName = (user) =>
  user?.fullName || user?.username || user?.email || "Unknown user";

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

const getOrganizationPreviewMembers = (organization, fallbackMembers = []) => {
  const directMembers = Array.isArray(organization?.members)
    ? organization.members
    : [];
  const memberPreview = Array.isArray(organization?.memberPreview)
    ? organization.memberPreview
    : [];
  const memberships = Array.isArray(organization?.memberships)
    ? organization.memberships
        .map((membership) => membership?.user || membership)
        .filter(Boolean)
    : [];

  const source = directMembers.length
    ? directMembers
    : memberPreview.length
      ? memberPreview
      : memberships.length
        ? memberships
        : fallbackMembers;

  return source
    .map((member) => member?.user || member)
    .filter(Boolean);
};

const formatProjectStatus = (status) => {
  if (!status) return "";

  const normalized = String(status).toUpperCase();

  if (normalized === "IN_PROGRESS") return "In Progress";
  if (normalized === "DONE") return "Done";
  if (normalized === "TODO") return "Todo";

  return String(status)
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const formatProjectDueDate = (date) => {
  if (!date) return "";
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toLocaleDateString();
};

const formatMembershipJoinedDate = (membership) => {
  const value = membership?.joinedAt || membership?.createdAt || "";

  if (!value) {
    return "";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toLocaleDateString();
};

const getProjectStatusState = (project) => {
  const rawStatus = String(project?.status || "").toUpperCase();
  const dueDate = project?.dueDate ? new Date(project.dueDate) : null;
  const isValidDueDate =
    dueDate instanceof Date && !Number.isNaN(dueDate.getTime());
  const isDone = ["DONE", "COMPLETED", "ARCHIVED", "CLOSED"].includes(rawStatus);

  if (!isDone && isValidDueDate && dueDate.getTime() < Date.now()) {
    return { label: "Overdue", tone: "overdue" };
  }

  if (rawStatus === "DONE" || rawStatus === "COMPLETED") {
    return { label: "Done", tone: "done" };
  }

  if (rawStatus === "IN_PROGRESS") {
    return { label: "In Progress", tone: "in-progress" };
  }

  if (rawStatus === "TODO") {
    return { label: "Todo", tone: "todo" };
  }

  return {
    label: formatProjectStatus(project?.status) || "Active",
    tone: "neutral",
  };
};

const getMemberRoleRank = (role) => {
  if (role === "OWNER") return 0;
  if (role === "ADMIN") return 1;
  if (role === "MEMBER") return 2;
  if (role === "VIEWER") return 3;
  return 4;
};

export default function OrganizationsWorkspace({
  token,
  onOpenProject,
  onOpenProjectsWorkspace,
  onRememberOrganization,
}) {
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
  const [editOrganizationName, setEditOrganizationName] = useState("");
  const [editOrganizationSlug, setEditOrganizationSlug] = useState("");
  const [memberLookup, setMemberLookup] = useState("");
  const [memberRole, setMemberRole] = useState("MEMBER");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberRoleFilter, setMemberRoleFilter] = useState("ALL");
  const [creatingOrganization, setCreatingOrganization] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [removingMember, setRemovingMember] = useState(false);
  const [savingOrganization, setSavingOrganization] = useState(false);
  const [deletingOrganization, setDeletingOrganization] = useState(false);
  const [showOrganizationCreateForm, setShowOrganizationCreateForm] =
    useState(false);
  const [showOrganizationEditForm, setShowOrganizationEditForm] =
    useState(false);
  const [showOrganizationDeleteForm, setShowOrganizationDeleteForm] =
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

  const handleOpenProjectWorkspace = (project) => {
    const organizationId =
      project?.organizationId || project?.orgId || selectedOrganization?.id || "";

    if (!project?.id || !organizationId) {
      return;
    }

    onOpenProject?.({
      id: project.id,
      orgId: organizationId,
      organizationId,
      name: project.name,
      title: project.name,
      orgName:
        selectedOrganization?.name || project.organization?.name || "Team",
      label:
        selectedOrganization?.name || project.organization?.name || "Team",
    });
  };
  const handleOpenProjectsWorkspace = () => {
    if (!selectedOrganization) {
      return;
    }

    onOpenProjectsWorkspace?.({
      id: selectedOrganization.id,
      organizationId: selectedOrganization.id,
      name: selectedOrganization.name,
      title: selectedOrganization.name,
      label: selectedOrganization.name,
    });
  };

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
  const selectedOrganizationMemberCount = selectedOrganization
    ? memberCountsByOrgId[selectedOrganization.id] ?? members.length
    : 0;
  const selectedOrganizationProjectCount = selectedOrganization
    ? projectCountsByOrgId[selectedOrganization.id] ?? projects.length
    : 0;
  const organizationOverviewStats = useMemo(() => {
    const now = Date.now();
    let activeProjectCount = 0;
    let doneProjectCount = 0;
    let overdueProjectCount = 0;

    projects.forEach((project) => {
      const status = String(project?.status || "").toUpperCase();
      const activeTasks = Number(project?.taskCounts?.totalActive || 0);
      const doneTasks = Number(project?.taskCounts?.done || 0);
      const dueDate = project?.dueDate ? new Date(project.dueDate) : null;
      const hasValidDueDate =
        dueDate instanceof Date && !Number.isNaN(dueDate.getTime());
      const isDone = status
        ? ["DONE", "COMPLETED", "ARCHIVED", "CLOSED"].includes(status)
        : activeTasks === 0 && doneTasks > 0;
      const isActive = status ? !isDone : !isDone;

      if (isDone) {
        doneProjectCount += 1;
      }

      if (isActive) {
        activeProjectCount += 1;
      }

      if (isActive && hasValidDueDate && dueDate.getTime() < now) {
        overdueProjectCount += 1;
      }
    });

    return {
      activeProjectCount,
      doneProjectCount,
      overdueProjectCount,
    };
  }, [projects]);
  const organizationsNeedingSummaryHydration = useMemo(
    () =>
      organizations.filter((organization) => {
        const hasMemberCount =
          organization.memberCount !== undefined &&
          organization.memberCount !== null;
        const hasProjectCount =
          organization.projectCount !== undefined &&
          organization.projectCount !== null;
        const hasMemberPreview =
          getOrganizationPreviewMembers(organization).length > 0;

        return !hasMemberCount || !hasProjectCount || !hasMemberPreview;
      }),
    [organizations]
  );
  const organizationSummaryHydrationKey = useMemo(
    () =>
      organizationsNeedingSummaryHydration
        .map((organization) => organization.id)
        .sort()
        .join("|"),
    [organizationsNeedingSummaryHydration]
  );

  useEffect(() => {
    if (!selectedOrganization) {
      return;
    }

    onRememberOrganization?.({
      ...selectedOrganization,
      memberCount:
        memberCountsByOrgId[selectedOrganization.id] ??
        selectedOrganization.memberCount,
      projectCount:
        projectCountsByOrgId[selectedOrganization.id] ??
        selectedOrganization.projectCount,
    });
  }, [
    memberCountsByOrgId,
    onRememberOrganization,
    projectCountsByOrgId,
    selectedOrganization,
  ]);

  const activeOrganizationPopup = showOrganizationCreateForm
    ? "create-organization"
    : showOrganizationEditForm
      ? "edit-organization"
      : showOrganizationDeleteForm
        ? "delete-organization"
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
          err.response?.data?.message || "Could not load your teams."
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
    if (!token || organizationsNeedingSummaryHydration.length === 0) {
      return undefined;
    }

    let isMounted = true;

    const hydrateOrganizationSummaries = async () => {
      const results = await Promise.allSettled(
        organizationsNeedingSummaryHydration.map(async (organization) => {
          const [membersRes, projectsRes] = await Promise.all([
            getOrganizationMembers(token, organization.id),
            getOrganizationProjects(token, organization.id),
          ]);

          const hydratedMembers = membersRes.data || [];
          const hydratedProjects = projectsRes.data || [];

          return {
            id: organization.id,
            memberCount: hydratedMembers.length,
            projectCount: hydratedProjects.length,
            memberPreview: hydratedMembers
              .slice(0, 4)
              .map((membership) => membership?.user || membership)
              .filter(Boolean),
          };
        })
      );

      if (!isMounted) {
        return;
      }

      const hydratedSummaries = results
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value);

      if (hydratedSummaries.length === 0) {
        return;
      }

      setMemberCountsByOrgId((current) => ({
        ...current,
        ...Object.fromEntries(
          hydratedSummaries.map((summary) => [summary.id, summary.memberCount])
        ),
      }));
      setProjectCountsByOrgId((current) => ({
        ...current,
        ...Object.fromEntries(
          hydratedSummaries.map((summary) => [summary.id, summary.projectCount])
        ),
      }));
      setOrganizations((current) =>
        current.map((organization) => {
          const hydratedSummary = hydratedSummaries.find(
            (summary) => summary.id === organization.id
          );

          return hydratedSummary
            ? {
                ...organization,
                memberCount: hydratedSummary.memberCount,
                projectCount: hydratedSummary.projectCount,
                memberPreview: hydratedSummary.memberPreview,
              }
            : organization;
        })
      );
    };

    hydrateOrganizationSummaries();

    return () => {
      isMounted = false;
    };
  }, [organizationSummaryHydrationKey, organizationsNeedingSummaryHydration, token]);

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
        setOrganizations((current) =>
          current.map((organization) =>
            organization.id === selectedOrgId
              ? {
                  ...organization,
                  memberCount: nextMembers.length,
                  memberPreview: nextMembers
                    .slice(0, 4)
                    .map((membership) => membership?.user || membership)
                    .filter(Boolean),
                }
              : organization
          )
        );
      } catch (err) {
        if (!isMounted) return;
        setMembers([]);
        setError(
          err.response?.data?.message ||
            "Could not load team members."
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
    setEditOrganizationName(selectedOrganization?.name || "");
    setEditOrganizationSlug(selectedOrganization?.slug || "");
  }, [selectedOrganization]);

  useEffect(() => {
    setShowOrganizationCreateForm(false);
    setShowOrganizationEditForm(false);
    setShowOrganizationDeleteForm(false);
    setShowOrganizationMemberAddForm(false);
    setShowOrganizationMemberRemoveForm(false);
    resetOrganizationPopupState();
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
        setOrganizations((current) =>
          current.map((organization) =>
            organization.id === selectedOrgId
              ? {
                  ...organization,
                  projectCount: nextProjects.length,
                }
              : organization
          )
        );
      } catch (err) {
        if (!isMounted) return;
        setProjects([]);
        setError(
          err.response?.data?.message ||
            "Could not load team projects."
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
      setError("Team name is required.");
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
        err.response?.data?.message || "Could not create team."
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

  const handleUpdateOrganization = async (event) => {
    event.preventDefault();

    if (!selectedOrganization) {
      return;
    }

    const trimmedName = editOrganizationName.trim();

    if (!trimmedName) {
      setError("Team name is required.");
      return;
    }

    setSavingOrganization(true);
    setError("");

    try {
      const res = await updateOrganizationApi(token, selectedOrganization.id, {
        name: trimmedName,
        slug: editOrganizationSlug,
      });

      const updatedOrganization = res.data;

      setOrganizations((current) =>
        current.map((organization) =>
          organization.id === updatedOrganization.id
            ? {
                ...organization,
                ...updatedOrganization,
              }
            : organization
        )
      );
      closeOrganizationPopup();
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not update team."
      );
    } finally {
      setSavingOrganization(false);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!selectedOrganization) {
      return;
    }

    setDeletingOrganization(true);
    setError("");

    try {
      await deleteOrganizationApi(token, selectedOrganization.id);

      setOrganizations((current) =>
        current.filter((organization) => organization.id !== selectedOrganization.id)
      );
      setMembers([]);
      setProjects([]);
      setSelectedOrgId("");
      closeOrganizationPopup();
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not delete team."
      );
    } finally {
      setDeletingOrganization(false);
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
        err.response?.data?.message || "Could not remove team member."
      );
    } finally {
      setRemovingMember(false);
    }
  };

  const resetOrganizationPopupState = () => {
    setOrganizationName("");
    setOrganizationSlug("");
    setEditOrganizationName(selectedOrganization?.name || "");
    setEditOrganizationSlug(selectedOrganization?.slug || "");
    setMemberLookup("");
    setMemberRole("MEMBER");
    setSelectedRemovalMembershipId("");
  };

  const closeOrganizationPopup = () => {
    setShowOrganizationCreateForm(false);
    setShowOrganizationEditForm(false);
    setShowOrganizationDeleteForm(false);
    setShowOrganizationMemberAddForm(false);
    setShowOrganizationMemberRemoveForm(false);
    resetOrganizationPopupState();
  };

  const handleSelectOrganization = (organizationId) => {
    setSelectedOrgId(organizationId);
    setActiveOrganizationTab("overview");
  };

  if (loadingOrganizations) {
    return (
      <div className="workspace-placeholder">Loading teams...</div>
    );
  }

  return (
    <div className="organizations-workspace">
      {error ? <div className="form-error org-error">{error}</div> : null}

      <section className="project-panel organization-collection-pane">
        <div className="organization-collection-body">
          <div className="organization-collection-topbar">
            <div>
              <h4>Your Teams</h4>
              <p>Switch between shared team workspaces.</p>
            </div>
            <button
              className="contextual-create-button"
              type="button"
              onClick={() => {
                setShowOrganizationCreateForm(true);
              }}
            >
              + Create Team
            </button>
          </div>

          <div className="project-list-panel organization-list-panel">
            {organizations.length === 0 ? (
              <div className="org-empty-state">
                <h4>No teams yet</h4>
                <p>
                  Create a team to group members, projects, and shared
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
                  const projectCount =
                    organization.projectCount ??
                    projectCountsByOrgId[organization.id] ??
                    null;
                  const previewMembers = getOrganizationPreviewMembers(
                    organization,
                    organization.id === selectedOrgId ? members : []
                  );
                  const visiblePreviewMembers = previewMembers.slice(0, 2);
                  const remainingPreviewCount = Math.max(
                    0,
                    (memberCount ?? previewMembers.length) - visiblePreviewMembers.length
                  );

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
                      <div className="organization-card-head organization-card-main">
                        <span className="organization-avatar">
                          {getOrganizationInitials(organization)}
                        </span>
                        <div className="organization-card-copy">
                          <strong>{organization.name}</strong>
                          <div className="project-count-row organization-count-row">
                            {projectCount !== null ? (
                              <span>
                                {projectCount} project{projectCount === 1 ? "" : "s"}
                              </span>
                            ) : null}
                            {memberCount !== null ? (
                              <span>
                                {memberCount} member{memberCount === 1 ? "" : "s"}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="project-member-avatar-stack organization-member-avatar-stack">
                          {visiblePreviewMembers.map((member, index) => (
                            <span
                              key={`${organization.id}-member-preview-${member.id || member.email || index}`}
                              className="project-member-avatar organization-member-avatar"
                            >
                              {getOrganizationInitials({
                                name: displayUserName(member),
                              })}
                            </span>
                          ))}
                          {remainingPreviewCount > 0 ? (
                            <span className="project-member-avatar project-member-avatar-more organization-member-avatar">
                              +{remainingPreviewCount}
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

      <section className="project-panel project-detail-panel organization-detail-panel">
        {selectedOrganization ? (
          <>
            <div className="project-opened-strip">
              <div className="project-opened-tab" aria-label="Opened team">
                <div className="project-opened-tab-main">
                  <span
                    className="project-opened-tab-icon organization-opened-tab-icon"
                    aria-hidden="true"
                  >
                    {getOrganizationInitials(selectedOrganization)}
                  </span>
                  <div className="project-opened-tab-copy">
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

            <div
              className="project-surface-tabs"
              role="tablist"
              aria-label="Team detail tabs"
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
                  <div className="organization-overview-summary">
                    <div className="organization-overview-copy">
                      <h5>{selectedOrganization.name}</h5>
                      <div className="organization-overview-context">
                        <span>{selectedOrganizationMemberCount} members</span>
                        <span>{selectedOrganizationProjectCount} projects</span>
                      </div>
                      <p className="project-surface-description">
                        This team surface keeps your people, project access,
                        and shared workspace structure in one calmer operational
                        layer.
                      </p>

                      {canManageSelectedOrganization ? (
                        <div className="project-overview-actions organization-overview-actions">
                          <button
                            type="button"
                            className="contextual-create-button"
                            onClick={() => {
                              closeOrganizationPopup();
                              setEditOrganizationName(selectedOrganization.name);
                              setEditOrganizationSlug(selectedOrganization.slug || "");
                              setShowOrganizationEditForm(true);
                            }}
                          >
                            Edit Team
                          </button>
                          <button
                            type="button"
                            className="contextual-create-button contextual-create-button-danger"
                            onClick={() => {
                              closeOrganizationPopup();
                              setShowOrganizationDeleteForm(true);
                            }}
                          >
                            Delete Team
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="project-detail-stats organization-overview-stats">
                      <div>
                        <strong>{organizationOverviewStats.activeProjectCount}</strong>
                        <span>Active projects</span>
                      </div>
                      <div>
                        <strong>{organizationOverviewStats.doneProjectCount}</strong>
                        <span>Done projects</span>
                      </div>
                      <div>
                        <strong>{organizationOverviewStats.overdueProjectCount}</strong>
                        <span>Overdue projects</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeOrganizationTab === "members" ? (
                <section className="project-surface-section project-members-surface organization-members-surface">
                  <div className="project-surface-section-header">
                    <div>
                      <div className="dashboard-eyebrow">Team Members</div>
                    </div>
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

                  {loadingMembers ? (
                    <div className="muted-text">Loading members...</div>
                  ) : members.length === 0 ? (
                    <div className="muted-text">
                      No members are connected to this team yet.
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
                    </div>
                  )}

                  {!loadingMembers && members.length > 0 ? (
                    filteredMembers.length === 0 ? (
                      <div className="muted-text">
                      No team members match the current search or role filter.
                      </div>
                    ) : (
                    <div className="organization-members-list-shell">
                      <div className="organization-members-registry-head" aria-hidden="true">
                        <span>Member</span>
                        <span>Role</span>
                        <span>Joined</span>
                        <span />
                      </div>
                      <div className="organization-members-list">
                        {filteredMembers.map((membership) => (
                          <div key={membership.id} className="organization-member-row">
                            <div className="organization-member-primary">
                              <span className="project-member-avatar project-member-avatar-large organization-member-avatar-large">
                                {getOrganizationInitials({
                                  name: displayUserName(membership.user),
                                })}
                              </span>

                              <div className="project-member-copy organization-member-copy">
                                <strong>{displayUserName(membership.user)}</strong>
                                {membership.user?.email ? (
                                  <span>{membership.user.email}</span>
                                ) : null}
                              </div>
                            </div>

                            <div className="organization-member-meta organization-member-role-cell">
                              {membership.role ? (
                                <span className="project-member-role organization-member-role">
                                  {membership.role}
                                </span>
                              ) : null}
                            </div>

                            <div className="organization-member-joined-cell">
                              {formatMembershipJoinedDate(membership) ? (
                                <span className="organization-member-joined">
                                  {formatMembershipJoinedDate(membership)}
                                </span>
                              ) : null}
                            </div>

                            <div className="organization-member-actions">
                              {canManageSelectedOrganization ? (
                                <button
                                  type="button"
                                  className="contextual-card-action organization-member-action-menu"
                                  aria-label={`Member actions for ${displayUserName(membership.user)}`}
                                  title={`Remove ${displayUserName(membership.user)}`}
                                  onClick={() => {
                                    closeOrganizationPopup();
                                    setSelectedRemovalMembershipId(membership.id);
                                    setShowOrganizationMemberRemoveForm(true);
                                  }}
                                >
                                  ...
                                </button>
                              ) : null}
                            </div>
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
                      <h5>Project spaces on this team</h5>
                      <p className="organization-projects-helper">
                        Open a project space to move straight into its active work.
                      </p>
                    </div>
                    {canManageSelectedOrganization ? (
                      <button
                        type="button"
                        className="contextual-create-button"
                        onClick={handleOpenProjectsWorkspace}
                      >
                        Add Project
                      </button>
                    ) : null}
                  </div>

                  {loadingProjects ? (
                    <div className="muted-text">Loading projects...</div>
                  ) : projects.length === 0 ? (
                    <div className="muted-text">
                      No projects belong to this team yet.
                    </div>
                  ) : (
                    <div className="organization-project-list-shell">
                      <div className="organization-project-registry-head" aria-hidden="true">
                        <span>Project</span>
                        <span>Status</span>
                        <span>Owner</span>
                        <span>Members</span>
                        <span>Due date</span>
                      </div>

                      <div className="organization-project-list">
                        {projects.map((project) => (
                          (() => {
                            const previewMembers = (project.members || [])
                              .map((member) => member?.user || member)
                              .filter(Boolean);
                            const visibleMembers = previewMembers.slice(0, 3);
                            const memberCount = previewMembers.length;
                            const remainingMembers = Math.max(
                              0,
                              memberCount - visibleMembers.length
                            );
                            const ownerUser =
                              project.owner ||
                              project.assignee ||
                              null;
                            const projectOwner = ownerUser
                              ? displayUserName(ownerUser)
                              : "";
                            const projectStatus = getProjectStatusState(project);
                            const dueDate = formatProjectDueDate(project.dueDate);

                            return (
                              <button
                                key={project.id}
                                type="button"
                                className="organization-project-row"
                                onClick={() => handleOpenProjectWorkspace(project)}
                              >
                                <div className="organization-project-cell organization-project-cell-primary organization-project-row-main">
                                  <span className="organization-project-mobile-label">
                                    Project
                                  </span>
                                  <div className="organization-project-row-heading">
                                    <strong>{project.name}</strong>
                                  </div>

                                  {project.description ? (
                                    <p className="organization-project-row-description">
                                      {project.description}
                                    </p>
                                  ) : null}
                                </div>

                                <div className="organization-project-cell organization-project-cell-status">
                                  <span className="organization-project-mobile-label">
                                    Status
                                  </span>
                                  <span className={`organization-project-status-pill ${projectStatus.tone}`}>
                                    {projectStatus.label}
                                  </span>
                                </div>

                                <div className="organization-project-cell organization-project-cell-owner">
                                  <span className="organization-project-mobile-label">
                                    Owner
                                  </span>
                                  {projectOwner ? (
                                    <div className="organization-project-owner">
                                      <span className="organization-project-owner-avatar">
                                        {getOrganizationInitials({ name: projectOwner })}
                                      </span>
                                      <span className="organization-project-owner-name">
                                        {projectOwner}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="organization-project-empty-value">
                                      No owner
                                    </span>
                                  )}
                                </div>

                                <div className="organization-project-cell organization-project-cell-members">
                                  <span className="organization-project-mobile-label">
                                    Members
                                  </span>
                                  {memberCount > 0 ? (
                                    <div className="organization-project-members">
                                      <div
                                        className="project-member-avatar-stack organization-project-avatar-stack"
                                        aria-label={`${memberCount} members`}
                                      >
                                        {visibleMembers.map((member, index) => (
                                          <span
                                            key={`${project.id}-member-${member.id || member.email || index}`}
                                            className="project-member-avatar organization-project-avatar"
                                            title={displayUserName(member)}
                                          >
                                            {getOrganizationInitials({
                                              name: displayUserName(member),
                                            })}
                                          </span>
                                        ))}
                                        {remainingMembers > 0 ? (
                                          <span className="project-member-avatar project-member-avatar-more organization-project-avatar">
                                            +{remainingMembers}
                                          </span>
                                        ) : null}
                                      </div>
                                      <span className="organization-project-member-count">
                                        {memberCount}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="organization-project-empty-value">
                                      No members
                                    </span>
                                  )}
                                </div>

                                <div className="organization-project-cell organization-project-cell-due">
                                  <span className="organization-project-mobile-label">
                                    Due date
                                  </span>
                                  <span className="organization-project-due">
                                    {dueDate || "No due date"}
                                  </span>
                                </div>
                              </button>
                            );
                          })()
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
                      <div className="dashboard-eyebrow">Team Settings</div>
                      <h5>Team configuration</h5>
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

                  {canManageSelectedOrganization ? (
                    <div className="organization-settings-actions">
                      <button
                        type="button"
                        className="contextual-create-button"
                        onClick={() => {
                          closeOrganizationPopup();
                          setEditOrganizationName(selectedOrganization.name);
                          setEditOrganizationSlug(selectedOrganization.slug || "");
                          setShowOrganizationEditForm(true);
                        }}
                      >
                        Edit Team
                      </button>
                      <button
                        type="button"
                        className="contextual-create-button contextual-create-button-danger"
                        onClick={() => {
                          closeOrganizationPopup();
                          setShowOrganizationDeleteForm(true);
                        }}
                      >
                        Delete Team
                      </button>
                    </div>
                  ) : null}

                  <p className="muted-text organization-foundation-copy">
                    Team settings stay calm and read-first until you
                    intentionally choose to update or remove this workspace.
                  </p>
                </section>
              ) : null}
            </div>
          </>
        ) : (
          <div className="org-empty-state">
            <h4>Open a team</h4>
            <p>
              Team members, project access, and future workspace settings will gather
              here without taking over the page.
            </p>
          </div>
        )}
      </section>

      {activeOrganizationPopup ? (
        <div className="project-workspace-popup-layer workspace-floating-window-layer" role="presentation">
          <button
            type="button"
            className="project-workspace-popup-backdrop workspace-floating-window-backdrop"
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
            className="project-workspace-popup-shell workspace-floating-window-shell"
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            {activeOrganizationPopup === "create-organization" ? (
              <form
                className="project-form contextual-create-surface workspace-action-popup workspace-floating-window"
                onSubmit={handleCreateOrganization}
              >
                <div className="workspace-action-popup-header workspace-floating-window-header">
                  <div className="workspace-floating-window-title">
                    <div className="dashboard-eyebrow">Create</div>
                    <strong>New Team</strong>
                  </div>
                  <button
                    type="button"
                    className="workspace-floating-window-close"
                    onClick={closeOrganizationPopup}
                    aria-label="Close window"
                  >
                    ×
                  </button>
                </div>
                <label className="form-label">
                  Team name
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

                <div className="button-row contextual-create-actions workspace-floating-window-actions">
                  <button
                    type="submit"
                    className="ui-button ui-button-primary"
                    disabled={creatingOrganization}
                  >
                    {creatingOrganization ? "Creating..." : "Save team"}
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
                className="project-form contextual-create-surface workspace-action-popup workspace-floating-window"
                onSubmit={handleAddMember}
              >
                <div className="workspace-action-popup-header workspace-floating-window-header">
                  <div className="workspace-floating-window-title">
                    <div className="dashboard-eyebrow">Members</div>
                    <strong>Add member to team {selectedOrganization?.name}</strong>
                  </div>
                  <button
                    type="button"
                    className="workspace-floating-window-close"
                    onClick={closeOrganizationPopup}
                    aria-label="Close window"
                  >
                    ×
                  </button>
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

                <div className="button-row contextual-create-actions workspace-floating-window-actions">
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

            {activeOrganizationPopup === "edit-organization" &&
            selectedOrganization ? (
              <form
                className="project-form contextual-create-surface workspace-action-popup workspace-floating-window"
                onSubmit={handleUpdateOrganization}
              >
                <div className="workspace-action-popup-header workspace-floating-window-header">
                  <div className="workspace-floating-window-title">
                    <div className="dashboard-eyebrow">Edit</div>
                    <strong>{selectedOrganization.name}</strong>
                  </div>
                  <button
                    type="button"
                    className="workspace-floating-window-close"
                    onClick={closeOrganizationPopup}
                    aria-label="Close window"
                  >
                    ×
                  </button>
                </div>
                <label className="form-label">
                  Team name
                  <input
                    className="ui-input"
                    value={editOrganizationName}
                    onChange={(event) => setEditOrganizationName(event.target.value)}
                    placeholder="Team name"
                  />
                </label>

                <label className="form-label">
                  Slug
                  <input
                    className="ui-input"
                    value={editOrganizationSlug}
                    onChange={(event) => setEditOrganizationSlug(event.target.value)}
                    placeholder="team-slug"
                  />
                </label>

                <div className="button-row contextual-create-actions workspace-floating-window-actions">
                  <button
                    type="submit"
                    className="ui-button ui-button-primary"
                    disabled={savingOrganization}
                  >
                    {savingOrganization ? "Saving..." : "Save team"}
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

            {activeOrganizationPopup === "delete-organization" &&
            selectedOrganization ? (
              <div className="project-form contextual-create-surface workspace-action-popup workspace-floating-window">
                <div className="workspace-action-popup-header workspace-floating-window-header">
                  <div className="workspace-floating-window-title">
                    <div className="dashboard-eyebrow">Delete</div>
                    <strong>Delete team {selectedOrganization.name}?</strong>
                  </div>
                  <button
                    type="button"
                    className="workspace-floating-window-close"
                    onClick={closeOrganizationPopup}
                    aria-label="Close window"
                  >
                    ×
                  </button>
                </div>
                <p className="workspace-action-popup-copy">
                  This will permanently remove the team and its related
                  projects, members, and workspace context. Your user account
                  will stay intact.
                </p>
                <div className="button-row contextual-create-actions workspace-floating-window-actions">
                  <button
                    type="button"
                    className="ui-button ui-button-danger"
                    onClick={handleDeleteOrganization}
                    disabled={deletingOrganization}
                  >
                    {deletingOrganization ? "Deleting..." : "Delete team"}
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

            {activeOrganizationPopup === "remove-member" &&
            selectedOrganization &&
            selectedRemovalMember ? (
              <div className="project-form contextual-create-surface workspace-action-popup workspace-floating-window">
                <div className="workspace-action-popup-header workspace-floating-window-header">
                  <div className="workspace-floating-window-title">
                    <div className="dashboard-eyebrow">Members</div>
                    <strong>
                      Remove {displayUserName(selectedRemovalMember.user)}?
                    </strong>
                  </div>
                  <button
                    type="button"
                    className="workspace-floating-window-close"
                    onClick={closeOrganizationPopup}
                    aria-label="Close window"
                  >
                    ×
                  </button>
                </div>
                <p className="workspace-action-popup-copy">
                  {selectedRemovalMember.user?.email || "This member"} will lose
                  access to team {selectedOrganization.name}, but their user account
                  will remain untouched.
                </p>
                <div className="button-row contextual-create-actions workspace-floating-window-actions">
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
