import { useState } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import { Toaster } from "react-hot-toast";

export default function App() {
  const [token, setToken] = useState(
    localStorage.getItem("token")
  );

  return (
    <>
      <Toaster position="top-right" />

      {!token ? (
        <Login setToken={setToken} />
      ) : (
        <Dashboard token={token} />
      )}
    </>
  );
}