import { useMemo, useState } from "react";

const notificationFilters = [
  { id: "ALL", label: "All" },
  { id: "UNREAD", label: "Unread" },
  { id: "ASSIGNMENTS", label: "Assignments" },
  { id: "UPDATES", label: "Updates" },
  { id: "DUE_DATES", label: "Due dates" },
  { id: "STATUS", label: "Status" },
  { id: "SYSTEM", label: "System" },
];

const typeCategoryMap = {
  TASK_ASSIGNED: "ASSIGNMENTS",
  TASK_UNASSIGNED: "ASSIGNMENTS",
  TASK_UPDATE_POSTED: "UPDATES",
  TASK_NOTE_ADDED: "UPDATES",
  TASK_DUE_DATE_ADDED: "DUE_DATES",
  TASK_DUE_DATE_CHANGED: "DUE_DATES",
  TASK_DUE_DATE_CLEARED: "DUE_DATES",
  TASK_STATUS_CHANGED: "STATUS",
  TASK_ARCHIVED: "SYSTEM",
  TASK_RESTORED: "SYSTEM",
};

const categoryLabels = {
  ASSIGNMENTS: "Assignment",
  UPDATES: "Update",
  DUE_DATES: "Due date",
  STATUS: "Status",
  SYSTEM: "System",
};

function getNotificationCategory(type) {
  return typeCategoryMap[type] || "SYSTEM";
}

function getTypeLabel(type) {
  return categoryLabels[getNotificationCategory(type)] || "System";
}

function getGroupedNotifications(notifications) {
  return notifications.reduce((groups, notification) => {
    const key = `${notification.taskId || "global"}:${notification.type}`;
    const existing = groups.find((group) => group.key === key);

    if (existing) {
      existing.items.push(notification);
      return groups;
    }

    groups.push({
      key,
      items: [notification],
    });

    return groups;
  }, []);
}

export default function NotificationBell({
  notifications,
  openNotifications,
  setOpenNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  showTrigger = true,
  showPanel = true,
  embedded = false,
}) {
  const [activeFilter, setActiveFilter] = useState("ALL");
  const unreadCount = notifications.filter(
    (n) => !n.isRead
  ).length;
  const filteredNotifications = useMemo(() => {
    if (activeFilter === "ALL") {
      return notifications;
    }

    if (activeFilter === "UNREAD") {
      return notifications.filter((notification) => !notification.isRead);
    }

    return notifications.filter(
      (notification) =>
        getNotificationCategory(notification.type) === activeFilter
    );
  }, [activeFilter, notifications]);
  const groupedNotifications = getGroupedNotifications(filteredNotifications);

  return (
    <div className="notification-shell">
      {showTrigger ? (
        <button
          className="dashboard-topbar-action-button notification-trigger"
          data-count={unreadCount > 0 ? unreadCount : ""}
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
          title="Notifications"
          onClick={(e) => {
            e.stopPropagation();
            setOpenNotifications((prev) => !prev);
          }}
        >
          Notifications{" "}
          {unreadCount > 0 && `(${unreadCount})`}
        </button>
      ) : null}

      {showPanel && openNotifications && (
        <div
          className={embedded ? "notification-menu notification-menu-embedded" : "notification-menu"}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="notification-menu-header">
            <div>
              <strong>Notifications</strong>
              <span>{unreadCount} unread</span>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                className="notification-mark-all"
                onClick={markAllAsRead}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="notification-filter-row">
            {notificationFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={activeFilter === filter.id ? "active" : ""}
                onClick={() => setActiveFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="notification-list">
            {groupedNotifications.length === 0 ? (
              <div className="notification-empty">
                No notifications in this view
              </div>
            ) : (
              groupedNotifications.map((group) => {
                const n = group.items[0];
                const repeatedCount = group.items.length;

                return (
                <div
                  key={group.key}
                  className={
                    n.isRead
                      ? "notification-item"
                      : "notification-item unread"
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    markAsRead(n.id);
                  }}
                >
                  <div className="notification-meta-row">
                    <span className="notification-type-pill">
                      {getTypeLabel(n.type)}
                    </span>
                    {repeatedCount > 1 && (
                      <span className="notification-repeat-count">
                        {repeatedCount} related
                      </span>
                    )}
                  </div>

                  <div className="notification-item-row">
                    <span>{n.message}</span>

                    {n.isRead && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(n.id);
                        }}
                        className="ui-button ui-button-ghost notification-delete"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
