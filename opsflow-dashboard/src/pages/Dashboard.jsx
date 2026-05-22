import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import useTasks from "../hooks/useTasks";
import usePersistentState from "../hooks/usePersistentState";
import NotificationBell from "../components/notifications/NotificationBell";
import KanbanColumn from "../components/kanban/KanbanColumn";
import TaskModal from "../components/tasks/TaskModal";
import CreateTaskPanel from "../components/tasks/CreateTaskPanel";
import TaskTable from "../components/tasks/TaskTable";
import TaskCalendar from "../components/tasks/TaskCalendar";
import TaskProductivityToolbar from "../components/tasks/TaskProductivityToolbar";
import TopBar from "../components/dashboard/TopBar";
import LeftRail from "../components/dashboard/LeftRail";
import CenterWorkspace from "../components/dashboard/CenterWorkspace";
import ContextPanel from "../components/dashboard/ContextPanel";
import CommandPalette from "../components/command/CommandPalette";
import ArchivedTasks from "../components/archive/ArchivedTasks";
import OrganizationsWorkspace from "../components/organizations/OrganizationsWorkspace";
import ProjectsWorkspace from "../components/projects/ProjectsWorkspace";
import api from "../api";
import { createSocket } from "../socket";
import toast from "react-hot-toast";

const defaultTaskFilters = {
  search: "",
  status: "ALL",
  assignee: "ALL",
  due: "ALL",
  project: "ALL",
  sort: "DUE_DATE",
};

function getUserIdFromToken(token) {
  try {
    const payload = token.split(".")[1];
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      "="
    );
    return JSON.parse(atob(paddedPayload)).sub;
  } catch {
    return null;
  }
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
}

function isSameDay(date, timestamp) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value.getTime() === timestamp;
}

function isTaskAssignedTo(task, userId) {
  return task.assignments?.some(
    (assignment) =>
      assignment.userId === userId ||
      assignment.user?.id === userId
  );
}

function getTaskTime(task, field) {
  const value = task[field];
  return value ? new Date(value).getTime() : 0;
}

export default function Dashboard({ token, onLogout }) {
  const [notifications, setNotifications] = useState([]);
  const [openNotifications, setOpenNotifications] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = usePersistentState(
    "opsflow.selectedTaskId",
    null
  );
  const [activeView, setActiveView] = usePersistentState(
    "opsflow.activeView",
    "tasks"
  );
  const [activeTaskLayout, setActiveTaskLayout] = usePersistentState(
    "opsflow.activeTaskView",
    "kanban"
  );
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [taskFilters, setTaskFilters] = usePersistentState(
    "opsflow.taskFilters",
    defaultTaskFilters
  );
  const [contextMode, setContextMode] = useState(
    selectedTaskId ? "details" : "empty"
  );
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [taskViewersByTask, setTaskViewersByTask] = useState({});
  const [presenceSocket, setPresenceSocket] = useState(null);
  const viewedTaskIdRef = useRef(null);
  
  const {
    tasks,
    updateTaskStatus,
    updateTaskDueDate,
    assignTask,
    removeAssignee,
    archiveTask,
    createTask,
  } = useTasks(token);

  const selectedTask =
    tasks.find((task) => task.id === selectedTaskId) || null;
  const selectedTaskViewers = selectedTaskId
    ? taskViewersByTask[selectedTaskId] || []
    : [];

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  const selectTask = (task) => {
    setActiveView("tasks");
    setContextMode("details");
    setSelectedTaskId(task.id);
  };

  const changeView = (view) => {
    setSelectedTaskId(null);

    if (view === "tasks") {
      setActiveView("tasks");
      setContextMode("empty");
      return;
    }

    setActiveView(view);
    setContextMode("workspace");
  };

  const openCreateTask = () => {
    setActiveView("tasks");
    setSelectedTaskId(null);
    setContextMode("create");
  };

  const handleCommandSelect = (result) => {
    if (result.type === "view") {
      changeView(result.view);
    }

    if (result.type === "create-task") {
      openCreateTask();
    }

    if (result.type === "open-task") {
      selectTask(result.task);
    }

    setCommandPaletteOpen(false);
  };

  const closeContextPanel = () => {
    setSelectedTaskId(null);
    setActiveView("tasks");
    setContextMode("empty");
  };

  const handleCreateTask = async (taskInput) => {
    const createdTask = await createTask(taskInput);

    setActiveView("tasks");
    setSelectedTaskId(createdTask.id);
    setContextMode("details");

    return createdTask;
  };

  const handleTaskDragEnd = async (event) => {
    const { active, over } = event;

    if (!over) {
      return;
    }

    const taskId = active.id;
    const nextStatus = over.id;
    const currentStatus = active.data.current?.status;

    if (!taskId || !nextStatus || currentStatus === nextStatus) {
      return;
    }

    await updateTaskStatus(taskId, nextStatus);
  };

  const workspaceMeta = {
    tasks: {
      eyebrow: "Kanban",
      title: "Active Tasks",
    },
    archive: {
      eyebrow: "Archive",
      title: "Archived Tasks",
      placeholder: "Archived tasks will appear here",
    },
    projects: {
      eyebrow: "Projects",
      title: "Projects",
      placeholder: "Projects workspace coming soon",
    },
    organizations: {
      eyebrow: "Organizations",
      title: "Organizations",
      placeholder: "Organization management coming soon",
    },
    settings: {
      eyebrow: "Settings",
      title: "Settings",
      placeholder: "Settings coming soon",
    },
    profile: {
      eyebrow: "Profile",
      title: "Profile",
      placeholder: "Profile coming soon",
    },
  };

  const currentWorkspace =
    workspaceMeta[activeView] || workspaceMeta.tasks;
  const currentUserId = useMemo(() => getUserIdFromToken(token), [token]);
  const activeTasks = tasks.filter((task) => !task.archivedAt);
  const normalizedTaskFilters = {
    ...defaultTaskFilters,
    ...taskFilters,
  };
  const assigneeOptions = useMemo(() => {
    const users = new Map();

    activeTasks.forEach((task) => {
      task.assignments?.forEach((assignment) => {
        const user = assignment.user;
        const id = assignment.userId || user?.id;

        if (!id || users.has(id)) {
          return;
        }

        users.set(id, {
          id,
          label:
            user?.fullName ||
            user?.username ||
            user?.email ||
            "Unknown user",
        });
      });
    });

    return Array.from(users.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [activeTasks]);
  const projectOptions = useMemo(() => {
    const projects = new Map();

    activeTasks.forEach((task) => {
      if (task.project?.id && !projects.has(task.project.id)) {
        projects.set(task.project.id, task.project);
      }
    });

    return Array.from(projects.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [activeTasks]);

  const filteredTasks = useMemo(() => {
    const today = startOfToday();
    const searchTerm = normalizedTaskFilters.search.trim().toLowerCase();

    return activeTasks
      .filter((task) => {
        if (searchTerm) {
          const searchable = `${task.title || ""} ${
            task.description || ""
          }`.toLowerCase();

          if (!searchable.includes(searchTerm)) {
            return false;
          }
        }

        if (
          normalizedTaskFilters.status !== "ALL" &&
          task.status !== normalizedTaskFilters.status
        ) {
          return false;
        }

        if (normalizedTaskFilters.assignee === "ME") {
          if (!currentUserId || !isTaskAssignedTo(task, currentUserId)) {
            return false;
          }
        } else if (normalizedTaskFilters.assignee === "UNASSIGNED") {
          if (task.assignments?.length > 0) {
            return false;
          }
        } else if (normalizedTaskFilters.assignee !== "ALL") {
          if (!isTaskAssignedTo(task, normalizedTaskFilters.assignee)) {
            return false;
          }
        }

        if (normalizedTaskFilters.due === "OVERDUE") {
          if (
            !task.dueDate ||
            task.status === "DONE" ||
            new Date(task.dueDate).setHours(0, 0, 0, 0) >= today
          ) {
            return false;
          }
        } else if (normalizedTaskFilters.due === "TODAY") {
          if (!task.dueDate || !isSameDay(task.dueDate, today)) {
            return false;
          }
        } else if (normalizedTaskFilters.due === "UPCOMING") {
          if (
            !task.dueDate ||
            new Date(task.dueDate).setHours(0, 0, 0, 0) < today
          ) {
            return false;
          }
        } else if (normalizedTaskFilters.due === "NONE") {
          if (task.dueDate) {
            return false;
          }
        }

        if (
          normalizedTaskFilters.project !== "ALL" &&
          task.project?.id !== normalizedTaskFilters.project
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (normalizedTaskFilters.sort === "TITLE") {
          return (a.title || "").localeCompare(b.title || "");
        }

        if (normalizedTaskFilters.sort === "UPDATED") {
          return getTaskTime(b, "updatedAt") - getTaskTime(a, "updatedAt");
        }

        if (normalizedTaskFilters.sort === "CREATED") {
          return getTaskTime(b, "createdAt") - getTaskTime(a, "createdAt");
        }

        const aDue = a.dueDate
          ? new Date(a.dueDate).getTime()
          : Number.MAX_SAFE_INTEGER;
        const bDue = b.dueDate
          ? new Date(b.dueDate).getTime()
          : Number.MAX_SAFE_INTEGER;

        return aDue - bDue;
      });
  }, [activeTasks, currentUserId, normalizedTaskFilters]);

  const filteredTodoTasks = filteredTasks.filter(
    (task) => task.status === "TODO"
  );
  const filteredInProgressTasks = filteredTasks.filter(
    (task) => task.status === "IN_PROGRESS"
  );
  const filteredDoneTasks = filteredTasks.filter(
    (task) => task.status === "DONE"
  );
  const activeFilterCount = [
    normalizedTaskFilters.search.trim(),
    normalizedTaskFilters.status !== "ALL",
    normalizedTaskFilters.assignee !== "ALL",
    normalizedTaskFilters.due !== "ALL",
    normalizedTaskFilters.project !== "ALL",
    normalizedTaskFilters.sort !== "DUE_DATE",
  ].filter(Boolean).length;

  const resetWorkspaceState = () => {
    window.localStorage.removeItem("opsflow.activeView");
    window.localStorage.removeItem("opsflow.activeTaskView");
    window.localStorage.removeItem("opsflow.taskFilters");
    window.localStorage.removeItem("opsflow.selectedTaskId");
    window.localStorage.removeItem("opsflow.projects.selectedOrgId");
    window.localStorage.removeItem("opsflow.projects.selectedProjectId");
    setActiveView("tasks");
    setActiveTaskLayout("kanban");
    setTaskFilters(defaultTaskFilters);
    setSelectedTaskId(null);
    setContextMode("empty");
  };

  const renderActiveTasks = () => {
    if (activeTaskLayout === "kanban") {
      return (
        <DndContext
          sensors={sensors}
          onDragEnd={handleTaskDragEnd}
        >
          <div className="kanban-board">
            <KanbanColumn
              id="TODO"
              title="TODO"
              tasks={filteredTodoTasks}
              setSelectedTask={selectTask}
            />

            <KanbanColumn
              id="IN_PROGRESS"
              title="IN PROGRESS"
              tasks={filteredInProgressTasks}
              setSelectedTask={selectTask}
            />

            <KanbanColumn
              id="DONE"
              title="DONE"
              tasks={filteredDoneTasks}
              setSelectedTask={selectTask}
            />
          </div>
        </DndContext>
      );
    }

    if (activeTaskLayout === "table") {
      return (
        <TaskTable
          tasks={filteredTasks}
          onSelectTask={selectTask}
        />
      );
    }

    return (
      <TaskCalendar
        tasks={filteredTasks}
        onSelectTask={selectTask}
      />
    );
  };

  const renderCanvasContent = () => {
    if (contextMode === "create") {
      return (
        <CreateTaskPanel
          token={token}
          onClose={closeContextPanel}
          onCreateTask={handleCreateTask}
        />
      );
    }

    if (selectedTask) {
      return (
        <TaskModal
          task={selectedTask}
          onClose={closeContextPanel}
          token={token}
          updateTaskStatus={updateTaskStatus}
          updateTaskDueDate={updateTaskDueDate}
          assignTask={assignTask}
          removeAssignee={removeAssignee}
          archiveTask={archiveTask}
          viewers={selectedTaskViewers}
        />
      );
    }

    if (contextMode !== "workspace") {
      return null;
    }

    const workspaceTitle =
      activeView === "archive"
        ? "Archived Tasks"
        : currentWorkspace.title;

    const renderWorkspaceCardBody = () => {
      if (activeView === "archive") {
        return <ArchivedTasks token={token} />;
      }

      if (activeView === "organizations") {
        return <OrganizationsWorkspace token={token} />;
      }

      if (activeView === "projects") {
        return <ProjectsWorkspace token={token} />;
      }

      if (activeView !== "tasks") {
        return (
          <div className="workspace-placeholder canvas-placeholder">
            <div className="settings-placeholder">
              <span>{currentWorkspace.placeholder}</span>
              {activeView === "settings" && (
                <button
                  type="button"
                  className="ui-button ui-button-secondary"
                  onClick={resetWorkspaceState}
                >
                  Reset workspace
                </button>
              )}
            </div>
          </div>
        );
      }

      return null;
    };

    return (
      <div className="workspace-card-shell">
        <div className="workspace-card-header">
          <div>
            <div className="dashboard-eyebrow">Workspace</div>
            <h2>{workspaceTitle}</h2>
          </div>

          <button
            type="button"
            className="task-detail-close"
            onClick={closeContextPanel}
          >
            Close
          </button>
        </div>

        {renderWorkspaceCardBody()}
      </div>
    );
  };

useEffect(() => {
  if (
    activeView !== "tasks" &&
    contextMode !== "workspace" &&
    !selectedTaskId
  ) {
    setContextMode("workspace");
  }
}, [activeView, contextMode, selectedTaskId]);

useEffect(() => {
  fetchNotifications();

  const socket = createSocket(token);
  setPresenceSocket(socket);

  socket.on("notification", (data) => {
    toast.success(data.message);

    const normalized = {
      id: data.id || data.notificationId,
      message: data.message,
      type: data.type,
      taskId: data.taskId,
      isRead: data.isRead ?? false,
    };

    setNotifications((prev) => {
      const exists = prev.some(
        (n) => n.id === normalized.id
      );

      if (exists) return prev;

      return [normalized, ...prev];
    });
  });

  socket.on("presence_online_users", (data) => {
    setOnlineUsers(data.users || []);
  });

  socket.on("task_viewers_updated", (data) => {
    setTaskViewersByTask((current) => ({
      ...current,
      [data.taskId]: data.viewers || [],
    }));
  });

  return () => {
    const viewedTaskId = viewedTaskIdRef.current;

    if (viewedTaskId) {
      socket.emit("task_viewing_leave", {
        taskId: viewedTaskId,
      });
      viewedTaskIdRef.current = null;
    }

    socket.disconnect();
    setPresenceSocket(null);
  };
}, [token]);

useEffect(() => {
  if (!presenceSocket) {
    return;
  }

  const nextViewedTaskId =
    contextMode === "details" ? selectedTaskId : null;
  const previousViewedTaskId = viewedTaskIdRef.current;

  if (previousViewedTaskId && previousViewedTaskId !== nextViewedTaskId) {
    presenceSocket.emit("task_viewing_leave", {
      taskId: previousViewedTaskId,
    });
  }

  if (nextViewedTaskId && previousViewedTaskId !== nextViewedTaskId) {
    presenceSocket.emit("task_viewing_join", {
      taskId: nextViewedTaskId,
    });
  }

  viewedTaskIdRef.current = nextViewedTaskId;
}, [contextMode, presenceSocket, selectedTaskId]);

  // CLICK OUTSIDE CLOSE
  useEffect(() => {
    const handleClickOutside = () => {
      if (openNotifications) {
        setOpenNotifications(false);
      }
    };

    document.addEventListener(
      "click",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "click",
        handleClickOutside
      );
    };
  }, [openNotifications]);

useEffect(() => {
  const handleKeys = (event) => {
    const isCommandShortcut =
      event.key.toLowerCase() === "k" &&
      (event.metaKey || event.ctrlKey);

    if (isCommandShortcut) {
      event.preventDefault();
      setCommandPaletteOpen((current) => !current);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();

      if (commandPaletteOpen) {
        setCommandPaletteOpen(false);
        return;
      }

      closeContextPanel();
    }
  };

  window.addEventListener("keydown", handleKeys);

  return () => {
    window.removeEventListener("keydown", handleKeys);
  };
}, [commandPaletteOpen]);

useEffect(() => {
  if (tasks.length > 0 && selectedTaskId && !selectedTask) {
    setSelectedTaskId(null);
    setContextMode("empty");
  }
}, [selectedTaskId, selectedTask, setSelectedTaskId, tasks.length]);

  // FETCH NOTIFICATIONS
  const fetchNotifications = async () => {
    try {
      const res = await api.get(
        "/tasks/notifications",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setNotifications(res.data);
    } catch (err) {
      console.error(
        "Failed to fetch notifications:",
        err
      );
    }
  };

  // MARK AS READ
  const markAsRead = async (notificationId) => {
    try {
      await api.patch(
        `/notifications/${notificationId}/read`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // update local state instantly
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId
            ? { ...n, isRead: true }
            : n
        )
      );
    } catch (err) {
      console.error(
        "Failed to mark notification as read:",
        err
      );
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await api.delete(
        `/notifications/${notificationId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setNotifications((prev) =>
        prev.filter((n) => n.id !== notificationId)
      );
    } catch (err) {
      console.error(
        "Failed to delete notification:",
        err
      );
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch(
        "/tasks/notifications/mark-all-read",
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setNotifications((prev) =>
        prev.map((notification) => ({
          ...notification,
          isRead: true,
        }))
      );
    } catch (err) {
      console.error(
        "Failed to mark all notifications as read:",
        err
      );
    }
  };

return (
  <div className="dashboard-shell">
    <TopBar
      activeView={activeView}
      onViewChange={changeView}
      actions={
        <>
          <div className="view-toggle" aria-label="Task view">
            <button
              type="button"
              className={
                activeTaskLayout === "kanban" ? "active" : ""
              }
              onClick={() => setActiveTaskLayout("kanban")}
            >
              Kanban
            </button>
            <button
              type="button"
              className={
                activeTaskLayout === "table" ? "active" : ""
              }
              onClick={() => setActiveTaskLayout("table")}
            >
              Table
            </button>
            <button
              type="button"
              className={
                activeTaskLayout === "calendar" ? "active" : ""
              }
              onClick={() => setActiveTaskLayout("calendar")}
            >
              Calendar
            </button>
          </div>
          <button
            type="button"
            className="ui-button ui-button-primary"
            onClick={openCreateTask}
          >
            + New Task
          </button>
          <button
            type="button"
            className="shortcut-hint"
            onClick={() => setCommandPaletteOpen(true)}
            title="Open command palette"
          >
            Ctrl K
          </button>
          <NotificationBell
            notifications={notifications}
            openNotifications={openNotifications}
            setOpenNotifications={setOpenNotifications}
            markAsRead={markAsRead}
            markAllAsRead={markAllAsRead}
            deleteNotification={deleteNotification}
          />
          <button className="logout-button" onClick={onLogout}>
            Logout
          </button>
        </>
      }
    />

    <div className="dashboard-body">
      <LeftRail
        onlineUsers={onlineUsers}
      />

      <div className="dashboard-workspace-stack">
        <CenterWorkspace
          eyebrow="Live workspace"
          title="Active Tasks"
        >
          <TaskProductivityToolbar
            filters={normalizedTaskFilters}
            onFiltersChange={setTaskFilters}
            assigneeOptions={assigneeOptions}
            projectOptions={projectOptions}
            activeFilterCount={activeFilterCount}
            onClear={() => setTaskFilters(defaultTaskFilters)}
          />
          {renderActiveTasks()}
        </CenterWorkspace>

        <ContextPanel>{renderCanvasContent()}</ContextPanel>
      </div>

    </div>

    <CommandPalette
      isOpen={commandPaletteOpen}
      tasks={activeTasks}
      onClose={() => setCommandPaletteOpen(false)}
      onSelect={handleCommandSelect}
    />
  </div>
);
}
