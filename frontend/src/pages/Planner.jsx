import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { Button, Card, Empty, ErrorNote, Spinner, Title, fmt, inputCls } from "../ui.jsx";

export default function Planner() {
  const [plans, setPlans] = useState(null);
  const [form, setForm] = useState({ goal: "", days: 7, hours_per_day: 3 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => { api.get("/ai/study-plans").then((d) => setPlans(d.plans)).catch((e) => setError(e.message)); }, []);

  const generate = async (e) => {
    e.preventDefault(); setBusy(true); setError("");
    try { const d = await api.post("/ai/study-plan", form); setPlans((p) => [d.plan, ...(p || [])]); }
    catch (err) { setError(err.message); }
    setBusy(false);
  };

  const latest = plans?.[0];
  return (
    <div className="space-y-5">
      <Title sub="The planner schedules your open tasks by priority and deadline.">Study plan</Title>
      <Card>
        <form onSubmit={generate} className="grid gap-3 md:grid-cols-6">
          <input className={`${inputCls} md:col-span-6`} placeholder="Goal (optional), e.g. Prepare for the midterm exam" value={form.goal} onChange={set("goal")} aria-label="Goal" />
          <label className="text-xs font-semibold md:col-span-2">Days
            <input type="number" min="1" max="14" className={`${inputCls} mt-1 font-normal`} value={form.days} onChange={set("days")} />
          </label>
          <label className="text-xs font-semibold md:col-span-2">Hours per day
            <input type="number" min="0.5" max="12" step="0.5" className={`${inputCls} mt-1 font-normal`} value={form.hours_per_day} onChange={set("hours_per_day")} />
          </label>
          <Button disabled={busy} className="self-end md:col-span-2">{busy ? "Planning…" : "Generate plan"}</Button>
        </form>
      </Card>
      <ErrorNote>{error}</ErrorNote>
      {busy && <Spinner label="Building your schedule…" />}
      {!plans ? <Spinner /> : !latest ? <Empty>Generate your first plan above.</Empty> : (
        <div className="space-y-4">
          <Card>
            <p className="text-xs text-ink-500">Created {fmt(latest.created_at)} · {latest.days} days · {latest.hours_per_day}h/day{latest.goal ? ` · ${latest.goal}` : ""}</p>
            <p className="mt-2 text-sm leading-relaxed">{latest.plan.overview}</p>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            {latest.plan.days.map((d, i) => (
              <Card key={i}>
                <h2 className="font-bold">{d.date}</h2>
                <ul className="mt-2 divide-y divide-ink-100">
                  {(d.sessions || []).map((s, j) => (
                    <li key={j} className="py-2 text-sm"><div className="flex justify-between gap-2"><b>{s.task}</b><span className="shrink-0 text-ink-500">{s.minutes} min</span></div><p className="text-ink-500">{s.focus}</p></li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
          {latest.plan.tips?.length > 0 && (
            <Card><h2 className="mb-1 font-bold">Tips</h2><ul className="list-disc space-y-1 pl-5 text-sm">{latest.plan.tips.map((t, i) => <li key={i}>{t}</li>)}</ul></Card>
          )}
        </div>
      )}
    </div>
  );
}
