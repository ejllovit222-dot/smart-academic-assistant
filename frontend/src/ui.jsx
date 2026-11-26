import React from "react";

export const inputCls =
  "w-full rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm outline-none focus:border-ink-500 focus:ring-2 focus:ring-marker/60";

export function Button({ variant = "primary", className = "", ...p }) {
  const v = {
    primary: "bg-ink-900 text-white hover:bg-ink-700",
    marker: "bg-marker text-ink-900 hover:brightness-95",
    ghost: "border border-ink-100 bg-white text-ink-900 hover:bg-ink-50",
  }[variant];
  return (
    <button
      {...p}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${v} ${className}`}
    />
  );
}

export const Card = ({ className = "", children }) => (
  <section className={`rounded-xl border border-ink-100 bg-white p-5 ${className}`}>{children}</section>
);

export const Spinner = ({ label = "Loading…" }) => (
  <div className="flex items-center gap-2 text-sm text-ink-500">
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-100 border-t-ink-900" />
    {label}
  </div>
);

export const ErrorNote = ({ children }) =>
  children ? <p role="alert" className="rounded-lg border border-coral/30 bg-coral/10 px-3 py-2 text-sm text-coral">{children}</p> : null;

export const Empty = ({ children }) => (
  <p className="rounded-lg border border-dashed border-ink-100 px-4 py-8 text-center text-sm text-ink-500">{children}</p>
);

const PRI = { high: "bg-coral/15 text-coral", medium: "bg-marker/50 text-ink-900", low: "bg-sea/15 text-sea", done: "bg-ink-100 text-ink-500" };
export const PriorityBadge = ({ label }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PRI[label] || PRI.low}`}>{label}</span>
);

export const Title = ({ children, sub }) => (
  <header className="mb-5">
    <h1 className="text-2xl font-extrabold tracking-tight">{children}</h1>
    {sub && <p className="mt-1 text-sm text-ink-500">{sub}</p>}
  </header>
);

export const fmt = (s) =>
  new Date(s).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const pad = (n) => String(n).padStart(2, "0");
export const toInput = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
