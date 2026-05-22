function getPresenceName(user) {
  return user.fullName || user.username || user.email || "User";
}

function getInitials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function LeftRail({ onlineUsers = [] }) {
  return (
    <aside className="dashboard-left-rail">
      <section className="launcher-presence">
        <div className="rail-section-title">Members Online</div>

        {onlineUsers.length === 0 ? (
          <div className="presence-empty">No users online</div>
        ) : (
          <div className="presence-list launcher-presence-list">
            {onlineUsers.map((user) => {
              const name = getPresenceName(user);

              return (
                <div key={user.id} className="presence-user compact">
                  <div className="presence-avatar">
                    {getInitials(name)}
                  </div>
                  <span>{name}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </aside>
  );
}
