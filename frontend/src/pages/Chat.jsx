import React, { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { api } from "../api.js";
import { Button, Card, ErrorNote, Spinner, Title, inputCls } from "../ui.jsx";

const IDEAS = ["Explain recursion with a simple example", "What should I focus on this week?", "Give me tips for a 2-hour study session"];

export default function Chat() {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const end = useRef(null);

  useEffect(() => { api.get("/ai/chat").then((d) => setMsgs(d.messages)).catch((e) => setError(e.message)); }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const send = async (message) => {
    if (!message.trim() || busy) return;
    setError(""); setBusy(true); setText("");
    setMsgs((m) => [...m, { role: "user", content: message }]);
    try {
      const d = await api.post("/ai/chat", { message });
      setMsgs((m) => [...m, { role: "model", content: d.reply }]);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  return (
    <div className="flex h-[calc(100vh-11rem)] min-h-[420px] flex-col md:h-[calc(100vh-8rem)]">
      <div className="flex items-start justify-between">
        <Title sub="Ask about coursework, concepts or your schedule. The assistant can see your open tasks.">Ask AI</Title>
        {msgs.length > 0 && <Button variant="ghost" onClick={() => api.del("/ai/chat").then(() => setMsgs([]))}>Clear chat</Button>}
      </div>
      <Card className="flex-1 space-y-3 overflow-auto">
        {msgs.length === 0 && !busy && (
          <div className="space-y-2">
            <p className="text-sm text-ink-500">Try one of these:</p>
            {IDEAS.map((i) => <button key={i} onClick={() => send(i)} className="block rounded-lg border border-ink-100 px-3 py-2 text-left text-sm hover:bg-ink-50">{i}</button>)}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : ""}`}>
            <p className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-ink-900 text-white" : "bg-ink-50"}`}>{m.content}</p>
          </div>
        ))}
        {busy && <Spinner label="Thinking…" />}
        <div ref={end} />
      </Card>
      <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>
      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="mt-3 flex gap-2">
        <input className={inputCls} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask a question…" aria-label="Message" maxLength={4000} />
        <Button disabled={busy || !text.trim()} aria-label="Send"><Send size={16} /> Send</Button>
      </form>
    </div>
  );
}
