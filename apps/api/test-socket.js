const { io } = require("socket.io-client");

// replace with your backend URL
const socket = io("http://localhost:3000", {
  auth: {
    userId: "cmpdp7dd30000d37vp9m3tzkk",
  },
});

socket.on("connect", () => {
  console.log("Connected:", socket.id);
});

socket.on("notification", (data) => {
  console.log("🔥 Notification received:", data);
});