import { useEffect, useState } from "react";
import useTasks from "../hooks/useTasks";
import NotificationBell from "../components/notifications/NotificationBell";
import KanbanColumn from "../components/kanban/KanbanColumn";
import TaskModal from "../components/tasks/TaskModal";
import CreateTaskPanel from "../components/tasks/CreateTaskPanel";
import TopBar from "../components/dashboard/TopBar";
import LeftRail from "../components/dashboard/LeftRail";
import CenterWorkspace from "../components/dashboard/CenterWorkspace";
import RightRail from "../components/dashboard/RightRail";
import ContextPanel from "../components/dashboard/ContextPanel";
import ArchivedTasks from "../components/archive/ArchivedTasks";
import api from "../api";
import { createSocket } from "../socket";
import toast from "react-hot-toast";

export default function Dashboard({ token, onLogout }) {
  const [notifications, setNotifications] = useState([]);
  const [openNotifications, setOpenNotifications] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [activeView, setActiveView] = useState("tasks");
  const [contextMode, setContextMode] = useState("empty");
  
  const {
    tasks,
    todoTasks,
    inProgressTasks,
    doneTasks,
    updateTaskStatus,
    updateTaskDueDate,
    assignTask,
    removeAssignee,
    archiveTask,
    createTask,
  } = useTasks(token);

  const selectedTask =
    tasks.find((task) => task.id === selectedTaskId) || null;

  const selectTask = (task) => {
    setActiveView("tasks");
    setContextMode("details");
    setSelectedTaskId(task.id);
  };

  const changeView = (view) => {
    setActiveView(view);
    setSelectedTaskId(null);
    setContextMode("empty");
  };

  const openCreateTask = () => {
    setActiveView("tasks");
    setSelectedTaskId(null);
    setContextMode("create");
  };

  const closeContextPanel = () => {
    setSelectedTaskId(null);
    setContextMode("empty");
  };

  const handleCreateTask = async (taskInput) => {
    const createdTask = await createTask(taskInput);

    setActiveView("tasks");
    setSelectedTaskId(createdTask.id);
    setContextMode("details");

    return createdTask;
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

useEffect(() => {
  fetchNotifications();

  const socket = createSocket(token);

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

  return () => socket.disconnect();
}, [token]);

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
  const handleEsc = (event) => {
    if (event.key === "Escape") {
      setSelectedTaskId(null);
      setContextMode("empty");
    }
  };

  window.addEventListener("keydown", handleEsc);

  return () => {
    window.removeEventListener("keydown", handleEsc);
  };
}, []);

useEffect(() => {
  if (selectedTaskId && !selectedTask) {
    setSelectedTaskId(null);
    setContextMode("empty");
  }
}, [selectedTaskId, selectedTask]);

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

return (
  <div className="dashboard-shell">
    <TopBar
      title="Dashboard"
      actions={
        <button className="logout-button" onClick={onLogout}>
          Logout
        </button>
      }
    />

    <div className="dashboard-body">
      <LeftRail
        activeView={activeView}
        onViewChange={changeView}
      />

      <div className="dashboard-workspace-stack">
        <CenterWorkspace
          eyebrow={currentWorkspace.eyebrow}
          title={currentWorkspace.title}
          actions={
            activeView === "tasks" ? (
              <button
                type="button"
                className="ui-button ui-button-primary"
                onClick={openCreateTask}
              >
                + New Task
              </button>
            ) : null
          }
        >
          {activeView === "tasks" ? (
            <div className="kanban-board">
              <KanbanColumn
                title="TODO"
                tasks={todoTasks}
                setSelectedTask={selectTask}
              />

              <KanbanColumn
                title="IN PROGRESS"
                tasks={inProgressTasks}
                setSelectedTask={selectTask}
              />

              <KanbanColumn
                title="DONE"
                tasks={doneTasks}
                setSelectedTask={selectTask}
              />
            </div>
          ) : activeView === "archive" ? (
            <ArchivedTasks token={token} />
          ) : (
            <div className="workspace-placeholder">
              {currentWorkspace.placeholder}
            </div>
          )}
        </CenterWorkspace>

        <ContextPanel>
          {contextMode === "create" ? (
            <CreateTaskPanel
              token={token}
              onClose={closeContextPanel}
              onCreateTask={handleCreateTask}
            />
          ) : selectedTask ? (
            <TaskModal
              task={selectedTask}
              onClose={closeContextPanel}
              token={token}
              updateTaskStatus={updateTaskStatus}
              updateTaskDueDate={updateTaskDueDate}
              assignTask={assignTask}
              removeAssignee={removeAssignee}
              archiveTask={archiveTask}
            />
          ) : null}
        </ContextPanel>
      </div>

      <RightRail>
        <NotificationBell
          notifications={notifications}
          openNotifications={openNotifications}
          setOpenNotifications={setOpenNotifications}
          markAsRead={markAsRead}
          deleteNotification={deleteNotification}
        />
      </RightRail>
    </div>
  </div>
);
}
