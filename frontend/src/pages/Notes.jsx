import React, { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { api } from "../api.js";
import { Button, Card, Empty, ErrorNote, Spinner, Title, fmt, inputCls } from "../ui.jsx";

export default function Notes() {
  const [notes, setNotes] = useState(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () => api.get("/notes").then((d) => setNotes(d.notes)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError("");
    try { await api.post("/ai/summarize", { title, text }); setTitle(""); setText(""); await load(); }
    catch (err) { setError(err.message); }
    setBusy(false);
  };

  return (
    <div className="space-y-5">
      <Title sub="Paste lecture notes or reading excerpts. You get a summary, key points and review questions.">Note summarizer</Title>
      <Card>
        <form onSubmit={submit} className="space-y-3">
          <input className={inputCls} placeholder="Title (e.g. Operating Systems, Week 5)" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Note title" />
          <textarea className={inputCls} rows={8} placeholder="Paste your notes here…" value={text} onChange={(e) => setText(e.target.value)} required aria-label="Notes" />
          <div className="flex items-center justify-between"><span className="text-xs text-ink-500">{text.length.toLocaleString()} characters</span><Button disabled={busy || text.trim().length < 40}>{busy ? "Summarizing…" : "Summarize"}</Button></div>
        </form>
      </Card>
      <ErrorNote>{error}</ErrorNote>
      {!notes ? <Spinner /> : notes.length === 0 ? <Empty>Your summaries will appear here.</Empty> : notes.map((n) => (
        <Card key={n.id}>
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="text-lg font-bold">{n.title}</h2><p className="text-xs text-ink-500">{fmt(n.created_at)}</p></div>
            <button aria-label={`Delete ${n.title}`} className="rounded-lg p-2 text-ink-500 hover:bg-coral/10 hover:text-coral" onClick={() => api.del(`/notes/${n.id}`).then(load)}><Trash2 size={16} /></button>
          </div>
          <p className="mt-3 text-sm leading-relaxed">{n.summary}</p>
          <h3 className="mb-1 mt-4 text-sm font-bold">Key points</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">{n.key_points.map((k, i) => <li key={i}>{k}</li>)}</ul>
          <h3 className="mb-1 mt-4 text-sm font-bold">Check yourself</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">{n.questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
        </Card>
      ))}
    </div>
  );
}
