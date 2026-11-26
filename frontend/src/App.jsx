import React, { useEffect, useRef, useState } from "react";
import { Bell, BookOpenText, CalendarRange, LayoutDashboard, ListChecks, LogOut, MessageCircle } from "lucide-react";
import { api, getToken, setToken } from "./api.js";
import { Spinner } from "./ui.jsx";
import Auth from "./pages/Auth.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Tasks from "./pages/Tasks.jsx";
import Chat from "./pages/Chat.jsx";
import Notes from "./pages/Notes.jsx";
import Planner from "./pages/Planner.jsx";

const NAV = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["tasks", "Tasks", ListChecks],
  ["chat", "Ask AI", MessageCircle],
  ["notes", "Notes", BookOpenText],
  ["planner", "Study plan", CalendarRange],
];
const LEVEL = { overdue: "bg-coral", urgent: "bg-coral", soon: "bg-marker" };

function Notifications({ go }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const seen = useRef(new Set());

  useEffect(() => {
    const load = () =>
      api.get("/notifications").then((d) => {
        setItems(d.notifications);
        if ("Notification" in window && Notification.permission === "granted") {
          d.notifications
            .filter((n) => n.level !== "soon" && !seen.current.has(n.id))
            .forEach((n) => new Notification("Smart Academic Assistant", { body: n.message }));
        }
        d.notifications.forEach((n) => seen.current.add(n.id));
      }).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} aria-label="Deadline notifications" className="relative rounded-lg border border-ink-100 bg-white p-2 hover:bg-ink-50">
        <Bell size={18} />
        {items.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1 text-xs font-bold text-white">{items.length}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-ink-100 bg-white p-3">
          <p className="mb-2 text-sm font-bold">Deadlines</p>
          {items.length === 0 && <p className="py-3 text-sm text-ink-500">Nothing due in the next 3 days.</p>}
          <ul className="max-h-72 space-y-1 overflow-auto">
            {items.map((n) => (
              <li key={n.id}>
                <button onClick={() => { setOpen(false); go("tasks"); }} className="flex w-full items-start gap-2 rounded-lg p-2 text-left text-sm hover:bg-ink-50">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${LEVEL[n.level]}`} />
                  {n.message}
                </button>
              </li>
            ))}
          </ul>
          {"Notification" in window && Notification.permission === "default" && (
            <button onClick={() => Notification.requestPermission()} className="mt-2 w-full rounded-lg bg-marker px-3 py-2 text-sm font-semibold">
              Turn on desktop alerts
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(!getToken());
  const [page, setPage] = useState("dashboard");

  useEffect(() => {
    if (getToken()) api.get("/auth/me").then((d) => setUser(d.user)).catch(() => setToken(null)).finally(() => setReady(true));
    const expired = () => setUser(null);
    window.addEventListener("auth-expired", expired);
    return () => window.removeEventListener("auth-expired", expired);
  }, []);

  if (!ready) return <div className="p-8"><Spinner /></div>;
  if (!user) return <Auth onAuth={(u) => { setUser(u); setPage("dashboard"); }} />;

  const logout = () => { setToken(null); setUser(null); };
  const Page = { dashboard: Dashboard, tasks: Tasks, chat: Chat, notes: Notes, planner: Planner }[page];

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-60 shrink-0 flex-col bg-ink-900 p-4 text-white md:flex">
        <p className="px-2 pb-6 pt-2 text-lg font-extrabold leading-tight">Smart Academic<br />Assistant</p>
        <nav className="flex-1 space-y-1">
          {NAV.map(([id, label, Icon]) => (
            <button key={id} onClick={() => setPage(id)} aria-current={page === id ? "page" : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition ${page === id ? "bg-marker text-ink-900" : "text-ink-100 hover:bg-ink-800"}`}>
              <Icon size={18} /> {label}
            </button>
          ))}
        </nav>
        <div className="border-t border-ink-700 pt-4">
          <p className="truncate px-2 text-sm font-semibold">{user.name}</p>
          <p className="truncate px-2 pb-2 text-xs text-ink-100/70">{user.email}</p>
          <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-100 hover:bg-ink-800"><LogOut size={16} /> Sign out</button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <div className="flex items-center justify-between px-4 pt-4 md:justify-end md:px-8">
          <p className="font-extrabold md:hidden">Smart Academic Assistant</p>
          <div className="flex items-center gap-2">
            <Notifications go={setPage} />
            <button onClick={logout} aria-label="Sign out" className="rounded-lg border border-ink-100 bg-white p-2 hover:bg-ink-50 md:hidden"><LogOut size={18} /></button>
          </div>
        </div>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-8"><Page user={user} go={setPage} /></main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-ink-100 bg-white py-1 md:hidden">
        {NAV.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setPage(id)} className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${page === id ? "bg-marker" : "text-ink-500"}`}>
            <Icon size={18} /> {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
