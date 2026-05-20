import { io } from "socket.io-client";
import toast from "react-hot-toast";

export const createSocket = (token) => {
  const socket = io("http://localhost:3000", {
    auth: {
      token,
    },
  });

  socket.on("connect", () => {
    console.log("🟢 Connected:", socket.id);
  });

  socket.on("notification", (data) => {
    toast.success(data.message);
  });

  return socket;
};