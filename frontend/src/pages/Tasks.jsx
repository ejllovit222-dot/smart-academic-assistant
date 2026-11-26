import React, { useEffect, useState } from "react";
import { Sparkles, Trash2 } from "lucide-react";
import { api } from "../api.js";
import { Button, Card, Empty, ErrorNote, PriorityBadge, Spinner, Title, fmt, inputCls, toInput } from "../ui.jsx";

const blank = () => {
  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(23, 59, 0, 0);
  return { title: "", course: "", description: "", due_date: toInput(d), estimated_hours: 2, importance: 3 };
};
const FILTERS = [["open", "Open"], ["done", "Done"], ["all", "All"]];

export default function Tasks() {
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("open");
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);
  const [rank, setRank] = useState(null);
  const [ranking, setRanking] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const load = () => api.get("/tasks").then((d) => setTasks(d.tasks)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault(); setSaving(true); setError("");
    try { await api.post("/tasks", form); setForm(blank()); await load(); }
    catch (err) { setError(err.message); }
    setSaving(false);
  };
  const act = async (fn) => { setError(""); try { await fn(); await load(); } catch (e) { setError(e.message); } };
  const runRank = async () => {
    setRanking(true); setError("");
    try { setRank(await api.post("/ai/prioritize")); } catch (e) { setError(e.message); }
    setRanking(false);
  };

  const shown = (tasks || []).filter((t) => filter === "all" || (filter === "done") === (t.status === "done"));
  return (
    <div className="space-y-5">
      <Title sub="Tasks are ranked automatically by deadline, importance and effort.">Tasks</Title>

      <Card>
        <form onSubmit={add} className="grid gap-3 md:grid-cols-6">
          <input className={`${inputCls} md:col-span-3`} placeholder="Task title" value={form.title} onChange={set("title")} required aria-label="Task title" />
          <input className={`${inputCls} md:col-span-3`} placeholder="Course (optional)" value={form.course} onChange={set("course")} aria-label="Course" />
          <label className="text-xs font-semibold md:col-span-2">Due
            <input type="datetime-local" className={`${inputCls} mt-1 font-normal`} value={form.due_date} onChange={set("due_date")} required />
          </label>
          <label className="text-xs font-semibold md:col-span-2">Estimated hours
            <input type="number" min="0.25" step="0.25" className={`${inputCls} mt-1 font-normal`} value={form.estimated_hours} onChange={set("estimated_hours")} />
          </label>
          <label className="text-xs font-semibold md:col-span-2">Importance
            <select className={`${inputCls} mt-1 font-normal`} value={form.importance} onChange={set("importance")}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} {n === 1 ? "(low)" : n === 5 ? "(critical)" : ""}</option>)}
            </select>
          </label>
          <textarea className={`${inputCls} md:col-span-6`} rows={2} placeholder="Notes (optional)" value={form.description} onChange={set("description")} aria-label="Notes" />
          <Button disabled={saving} className="md:col-span-6">{saving ? "Adding…" : "Add task"}</Button>
        </form>
      </Card>

      <ErrorNote>{error}</ErrorNote>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-ink-100 bg-white p-1">
          {FILTERS.map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)} className={`rounded-md px-3 py-1 text-sm font-semibold ${filter === id ? "bg-ink-900 text-white" : "text-ink-500"}`}>{label}</button>
          ))}
        </div>
        <Button variant="marker" onClick={runRank} disabled={ranking}><Sparkles size={16} /> {ranking ? "Ranking…" : "Re-rank with AI"}</Button>
      </div>

      {rank && (
        <Card>
          <p className="mb-3 text-sm text-ink-500">{rank.source === "gemini" ? "Ranked by Gemini." : "Ranked by the built-in scoring rules (Gemini was unavailable)."}</p>
          {rank.ranked.length === 0 ? <Empty>No open tasks to rank.</Empty> : (
            <ol className="space-y-2">
              {rank.ranked.map((t) => (
                <li key={t.id} className="flex gap-3 text-sm"><span className="font-extrabold">{t.rank}.</span><span><b>{t.title}</b> {t.reason}</span></li>
              ))}
            </ol>
          )}
        </Card>
      )}

      {!tasks ? <Spinner /> : shown.length === 0 ? <Empty>No tasks here yet. Add one above.</Empty> : (
        <ul className="space-y-2">
          {shown.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-100 bg-white p-4">
              <input type="checkbox" className="h-5 w-5 accent-ink-900" checked={t.status === "done"} aria-label={`Mark ${t.title} done`}
                onChange={(e) => act(() => api.patch(`/tasks/${t.id}`, { status: e.target.checked ? "done" : "todo" }))} />
              <div className="min-w-0 flex-1">
                <p className={`font-semibold ${t.status === "done" ? "text-ink-500 line-through" : ""}`}>{t.title}</p>
                <p className={`text-xs ${t.is_overdue ? "font-semibold text-coral" : "text-ink-500"}`}>
                  {t.is_overdue ? "Overdue · " : ""}{t.course ? `${t.course} · ` : ""}due {fmt(t.due_date)} · {t.estimated_hours}h
                </p>
              </div>
              {t.status !== "done" && <PriorityBadge label={t.priority_label} />}
              <select className="rounded-lg border border-ink-100 bg-white px-2 py-1 text-sm" value={t.status} aria-label="Status"
                onChange={(e) => act(() => api.patch(`/tasks/${t.id}`, { status: e.target.value }))}>
                <option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option>
              </select>
              <button aria-label={`Delete ${t.title}`} className="rounded-lg p-2 text-ink-500 hover:bg-coral/10 hover:text-coral" onClick={() => act(() => api.del(`/tasks/${t.id}`))}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
