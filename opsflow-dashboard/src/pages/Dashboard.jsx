import { useEffect, useState } from "react";
import api from "../api";
import { createSocket } from "../socket";

export default function Dashboard({ token }) {
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const userId = JSON.parse(atob(token.split(".")[1])).sub;

useEffect(() => {
  fetchTasks();

  const socket = createSocket(token);

  socket.on("notification", (data) => {
    setNotifications((prev) => [data, ...prev]);
  });

  return () => socket.disconnect();
}, []);

  const fetchTasks = async () => {
    const res = await api.get("/tasks/my", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    setTasks(res.data.data);
  };

  return (
    <div>
      <h2>Dashboard</h2>

      <h3>Notifications</h3>
      {notifications.map((n, i) => (
        <div key={i}>{n.message}</div>
      ))}

      <h3>Tasks</h3>
      {tasks.map((t) => (
        <div key={t.id}>
          {t.title} - {t.status}
        </div>
      ))}
    </div>
  );
}