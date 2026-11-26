import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { Button, Card, Empty, ErrorNote, PriorityBadge, Spinner, Title, fmt } from "../ui.jsx";

const Stat = ({ label, value, tone = "" }) => (
  <Card><p className="text-sm text-ink-500">{label}</p><p className={`mt-1 text-3xl font-extrabold ${tone}`}>{value}</p></Card>
);

export default function Dashboard({ user, go }) {
  const [s, setS] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api.get("/stats").then(setS).catch((e) => setError(e.message)); }, []);
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!s) return <Spinner />;

  const top = s.upcoming[0];
  const max = Math.max(1, ...s.weekly.map((w) => w.count));
  return (
    <div className="space-y-5">
      <Title sub={`${s.due_this_week} due this week · ${s.hours_remaining}h of work left`}>Hi {user.name.split(" ")[0]}</Title>

      <section className="rounded-xl bg-marker p-6">
        <p className="text-sm font-semibold">Do this first</p>
        {top ? (
          <>
            <p className="mt-1 text-2xl font-extrabold">{top.title}</p>
            <p className="mt-1 text-sm">{top.course || "General"} · due {fmt(top.due_date)} · about {top.estimated_hours}h</p>
            <Button className="mt-4" onClick={() => go("tasks")}>Open tasks</Button>
          </>
        ) : (
          <>
            <p className="mt-1 text-2xl font-extrabold">You have no open tasks.</p>
            <Button className="mt-4" onClick={() => go("tasks")}>Add a task</Button>
          </>
        )}
      </section>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Total tasks" value={s.total} />
        <Stat label="Completed" value={s.completed} tone="text-sea" />
        <Stat label="Pending" value={s.pending} />
        <Stat label="Overdue" value={s.overdue} tone={s.overdue ? "text-coral" : ""} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="flex items-baseline justify-between"><h2 className="font-bold">Completion rate</h2><span className="text-2xl font-extrabold">{s.completion_rate}%</span></div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-ink-100"><div className="h-full bg-sea" style={{ width: `${s.completion_rate}%` }} /></div>
          <h2 className="mb-2 mt-6 font-bold">Completed this week</h2>
          <div className="flex h-28 items-end gap-2">
            {s.weekly.map((w, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs text-ink-500">{w.count}</span>
                <div className="w-full rounded-t bg-ink-900" style={{ height: `${Math.max(4, (w.count / max) * 80)}px` }} />
                <span className="text-xs text-ink-500">{w.day}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 font-bold">Next up</h2>
          {s.upcoming.length === 0 ? <Empty>Nothing pending. Nice work.</Empty> : (
            <ul className="divide-y divide-ink-100">
              {s.upcoming.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{t.title}</p><p className="text-xs text-ink-500">{fmt(t.due_date)}</p></div>
                  <PriorityBadge label={t.priority_label} />
                </li>
              ))}
            </ul>
          )}
          {s.by_course.length > 0 && (
            <p className="mt-4 text-xs text-ink-500">Open by course: {s.by_course.map((c) => `${c.course} (${c.count})`).join(", ")}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
