import { useState } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import { Toaster } from "react-hot-toast";
import "./App.css";

export default function App() {
  const [token, setToken] = useState(
    localStorage.getItem("token")
  );

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
  };

  return (
    <>
      <Toaster position="top-right" />

      {!token ? (
        <Login setToken={setToken} />
      ) : (
        <Dashboard token={token} onLogout={logout} />
      )}
    </>
  );
}
