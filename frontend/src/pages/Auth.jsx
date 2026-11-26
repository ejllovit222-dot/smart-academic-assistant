import React, { useState } from "react";
import { api, setToken } from "../api.js";
import { Button, ErrorNote, inputCls } from "../ui.jsx";

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const d = await api.post(mode === "login" ? "/auth/login" : "/auth/register", f);
      setToken(d.token);
      onAuth(d.user);
    } catch (err) { setError(err.message); }
    setBusy(false);
  };

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="flex flex-col justify-end bg-ink-900 p-8 text-white md:p-14">
        <h1 className="max-w-md text-4xl font-extrabold leading-tight md:text-5xl">Your coursework, sorted by what matters next.</h1>
        <p className="mt-4 max-w-md text-ink-100">Track deadlines, let the assistant rank your tasks, summarize lecture notes, and get a day-by-day study plan.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <h2 className="text-2xl font-extrabold">{mode === "login" ? "Sign in" : "Create your account"}</h2>
          {mode === "register" && (
            <label className="block text-sm font-semibold">Name
              <input className={`${inputCls} mt-1 font-normal`} value={f.name} onChange={set("name")} required autoComplete="name" />
            </label>
          )}
          <label className="block text-sm font-semibold">Email
            <input type="email" className={`${inputCls} mt-1 font-normal`} value={f.email} onChange={set("email")} required autoComplete="email" />
          </label>
          <label className="block text-sm font-semibold">Password
            <input type="password" minLength={6} className={`${inputCls} mt-1 font-normal`} value={f.password} onChange={set("password")} required autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </label>
          <ErrorNote>{error}</ErrorNote>
          <Button className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</Button>
          <p className="text-sm text-ink-500">
            {mode === "login" ? "New here?" : "Already registered?"}{" "}
            <button type="button" className="font-semibold text-ink-900 underline" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
