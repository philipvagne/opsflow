export default function NotificationBell({
  notifications,
  openNotifications,
  setOpenNotifications,
  markAsRead,
  deleteNotification,
}) {
  const unreadCount = notifications.filter(
    (n) => !n.isRead
  ).length;

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
      }}
    >
      {/* BUTTON */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpenNotifications((prev) => !prev);
        }}
      >
        Notifications{" "}
        {unreadCount > 0 && `(${unreadCount})`}
      </button>

      {/* DROPDOWN */}
      {openNotifications && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: "40px",
            right: "0",
            width: "320px",
            background: "white",
            border: "1px solid #ddd",
            borderRadius: "10px",
            boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
            zIndex: 1000,
            overflow: "hidden",
          }}
        >
          {/* HEADER */}
          <div
            style={{
              padding: "10px",
              borderBottom: "1px solid #eee",
              fontWeight: "bold",
            }}
          >
            Notifications
          </div>

          {/* CONTENT */}
          <div
            style={{
              maxHeight: "300px",
              overflowY: "auto",
            }}
          >
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: "10px",
                  color: "#666",
                }}
              >
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    markAsRead(n.id);
                  }}
                  style={{
                    padding: "10px",
                    borderBottom: "1px solid #f1f1f1",
                    fontWeight: n.isRead
                      ? "normal"
                      : "bold",
                    fontSize: "14px",
                    cursor: "pointer",
                    background: n.isRead
                      ? "white"
                      : "#f5f9ff",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                    }}
                  >
                    <span>{n.message}</span>

                    {n.isRead && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(n.id);
                        }}
                        style={{
                          border: "none",
                          background: "#f3f4f6",
                          borderRadius: "5px",
                          cursor: "pointer",
                          padding: "4px 7px",
                          color: "#444",
                          fontSize: "12px",
                          flexShrink: 0,
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
