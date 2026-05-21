import { io } from "socket.io-client";

export const createSocket = (token) => {
  const socket = io("http://localhost:3000", {
    auth: {
      token,
    },
  });

  socket.on("connect", () => {
    console.log("Connected:", socket.id);
  });

  return socket;
};