import { useState } from "react";
import api from "../api";

const initialForm = {
  fullName: "",
  username: "",
  email: "",
  password: "",
};

function getErrorMessage(error, mode) {
  const message = error.response?.data?.message;

  if (Array.isArray(message)) {
    return message.join(" ");
  }

  if (message) {
    return message;
  }

  return mode === "login"
    ? "Could not log in. Check your email and password."
    : "Could not create your account. Please try again.";
}

export default function Login({ setToken }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError("");
  };

  const validate = () => {
    if (isSignup && !form.fullName.trim()) {
      return "Full name is required.";
    }

    if (isSignup && !form.username.trim()) {
      return "Username is required.";
    }

    if (!form.email.trim()) {
      return "Email is required.";
    }

    if (!form.password) {
      return "Password is required.";
    }

    return "";
  };

  const submit = async (event) => {
    event.preventDefault();

    const validationError = validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const endpoint = isSignup ? "/auth/register" : "/auth/login";
      const payload = isSignup
        ? {
            fullName: form.fullName.trim(),
            username: form.username.trim(),
            email: form.email.trim(),
            password: form.password,
          }
        : {
            email: form.email.trim(),
            password: form.password,
          };

      const res = await api.post(endpoint, payload);

      setToken(res.data.access_token);
      localStorage.setItem("token", res.data.access_token);
    } catch (err) {
      setError(getErrorMessage(err, mode));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-copy">
          <p className="auth-eyebrow">OpsFlow</p>
          <h1>{isSignup ? "Create your workspace account" : "Welcome back"}</h1>
          <p>
            {isSignup
              ? "Set up your account to start tracking tasks, projects, and team updates."
              : "Log in to continue managing your projects and realtime task updates."}
          </p>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <div className="auth-tabs" aria-label="Authentication mode">
            <button
              className={mode === "login" ? "active" : ""}
              type="button"
              onClick={() => switchMode("login")}
            >
              Login
            </button>
            <button
              className={mode === "signup" ? "active" : ""}
              type="button"
              onClick={() => switchMode("signup")}
            >
              Sign up
            </button>
          </div>

          {isSignup && (
            <>
              <label>
                Full name
                <input
                  autoComplete="name"
                  value={form.fullName}
                  onChange={(e) => updateField("fullName", e.target.value)}
                  placeholder="Philip Agne"
                />
              </label>

              <label>
                Username
                <input
                  autoComplete="username"
                  value={form.username}
                  onChange={(e) => updateField("username", e.target.value)}
                  placeholder="philip"
                />
              </label>
            </>
          )}

          <label>
            Email
            <input
              autoComplete="email"
              inputMode="email"
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label>
            Password
            <input
              autoComplete={isSignup ? "new-password" : "current-password"}
              type="password"
              value={form.password}
              onChange={(e) => updateField("password", e.target.value)}
              placeholder="Enter your password"
            />
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? "Please wait..." : isSignup ? "Create account" : "Login"}
          </button>
        </form>
      </section>
    </main>
  );
}
