"""Smart Academic Assistant - Flask API (SQLite + Gemini)."""
import datetime as dt
import json
import os
import sqlite3
from functools import wraps

import jwt
from dotenv import load_dotenv
from flask import Flask, g, jsonify, request
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash

load_dotenv()
import ai  # noqa: E402  (after load_dotenv so env vars are visible)

BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.getenv("DATABASE_PATH", os.path.join(BASE, "academic.db"))
SECRET = os.getenv("SECRET_KEY", "dev-secret-change-me")

app = Flask(__name__)
CORS(app, origins=[
    "http://localhost:5173",
    "https://smart-academic-assistant.netlify.app"
])

SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tasks(
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, course TEXT DEFAULT '', description TEXT DEFAULT '', due_date TEXT NOT NULL,
  estimated_hours REAL DEFAULT 1, importance INTEGER DEFAULT 3, status TEXT DEFAULT 'todo',
  created_at TEXT NOT NULL, completed_at TEXT);
CREATE TABLE IF NOT EXISTS notes(
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, original TEXT NOT NULL, summary TEXT NOT NULL, key_points TEXT NOT NULL,
  questions TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS chat_messages(
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS study_plans(
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal TEXT DEFAULT '', days INTEGER NOT NULL, hours_per_day REAL NOT NULL, plan TEXT NOT NULL, created_at TEXT NOT NULL);
"""


# ---------- helpers ----------
def now():
    return dt.datetime.now().replace(microsecond=0)


def parse_dt(s):
    return dt.datetime.fromisoformat(s.replace("Z", "")).replace(tzinfo=None)


def db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db


@app.teardown_appcontext
def close_db(_):
    con = g.pop("db", None)
    if con:
        con.close()


def init_db():
    con = sqlite3.connect(DB_PATH)
    con.executescript(SCHEMA)
    con.commit()
    con.close()


def rows(sql, args=()):
    return [dict(r) for r in db().execute(sql, args).fetchall()]


def err(msg, status=400):
    return jsonify(error=msg), status


@app.errorhandler(ai.AIError)
def handle_ai_error(e):
    return err(str(e), e.status)


def auth(fn):
    @wraps(fn)
    def wrapper(*a, **kw):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return err("Please sign in.", 401)
        try:
            g.user_id = int(jwt.decode(header[7:], SECRET, algorithms=["HS256"])["sub"])
        except (jwt.PyJWTError, ValueError, KeyError):
            return err("Your session expired. Please sign in again.", 401)
        return fn(*a, **kw)

    return wrapper


def make_token(user_id):
    return jwt.encode({"sub": str(user_id), "exp": now() + dt.timedelta(days=7)}, SECRET, algorithm="HS256")


# ---------- automatic prioritization ----------
def priority(t):
    """Score 0-100 from deadline urgency (55%), importance (30%) and effort (15%)."""
    if t["status"] == "done":
        return 0, "done"
    hours_left = (parse_dt(t["due_date"]) - now()).total_seconds() / 3600
    urgency = 100 if hours_left <= 0 else 100 / (1 + hours_left / 24)
    score = 0.55 * urgency + 0.30 * (t["importance"] / 5 * 100) + 0.15 * (min(t["estimated_hours"], 10) / 10 * 100)
    score = round(score)
    label = "high" if hours_left <= 0 or score >= 65 else "medium" if score >= 40 else "low"
    return score, label


def rule_reason(t):
    h = (parse_dt(t["due_date"]) - now()).total_seconds() / 3600
    when = "is overdue" if h < 0 else f"is due in {round(h)}h" if h < 48 else f"is due in {round(h / 24)} days"
    return f"{t['title']} {when}; importance {t['importance']}/5, about {t['estimated_hours']:g}h of work."


def task_out(row):
    t = dict(row)
    t["priority_score"], t["priority_label"] = priority(t)
    t["is_overdue"] = t["status"] != "done" and parse_dt(t["due_date"]) < now()
    return t


def pending_tasks():
    ts = [task_out(r) for r in rows("SELECT * FROM tasks WHERE user_id=? AND status!='done'", (g.user_id,))]
    return sorted(ts, key=lambda t: -t["priority_score"])


def clean_task(d, partial=False):
    out = {}
    if "title" in d or not partial:
        title = str(d.get("title") or "").strip()
        if not title:
            raise ValueError("Title is required.")
        out["title"] = title[:200]
    if "due_date" in d or not partial:
        try:
            out["due_date"] = parse_dt(str(d.get("due_date", ""))).isoformat()
        except ValueError:
            raise ValueError("A valid due date is required.")
    for k in ("course", "description"):
        if k in d:
            out[k] = str(d[k] or "").strip()[:2000]
    try:
        if "estimated_hours" in d:
            out["estimated_hours"] = max(0.25, min(float(d["estimated_hours"]), 100))
        if "importance" in d:
            out["importance"] = max(1, min(int(d["importance"]), 5))
    except (TypeError, ValueError):
        raise ValueError("Hours and importance must be numbers.")
    if "status" in d:
        if d["status"] not in ("todo", "in_progress", "done"):
            raise ValueError("Invalid status.")
        out["status"] = d["status"]
    return out


# ---------- auth ----------
@app.get("/api/health")
def health():
    return jsonify(ok=True, ai_configured=bool(os.getenv("GEMINI_API_KEY", "").strip()) and not os.getenv("GEMINI_API_KEY", "").startswith("your_"))


@app.post("/api/auth/register")
def register():
    d = request.get_json(silent=True) or {}
    name, email, pw = str(d.get("name", "")).strip(), str(d.get("email", "")).strip().lower(), str(d.get("password", ""))
    if not name or "@" not in email or len(pw) < 6:
        return err("Enter your name, a valid email, and a password of at least 6 characters.")
    if rows("SELECT id FROM users WHERE email=?", (email,)):
        return err("An account with this email already exists.", 409)
    cur = db().execute("INSERT INTO users(name,email,password_hash,created_at) VALUES(?,?,?,?)",
                       (name, email, generate_password_hash(pw), now().isoformat()))
    db().commit()
    return jsonify(token=make_token(cur.lastrowid), user={"id": cur.lastrowid, "name": name, "email": email}), 201


@app.post("/api/auth/login")
def login():
    d = request.get_json(silent=True) or {}
    u = rows("SELECT * FROM users WHERE email=?", (str(d.get("email", "")).strip().lower(),))
    if not u or not check_password_hash(u[0]["password_hash"], str(d.get("password", ""))):
        return err("Incorrect email or password.", 401)
    u = u[0]
    return jsonify(token=make_token(u["id"]), user={"id": u["id"], "name": u["name"], "email": u["email"]})


@app.get("/api/auth/me")
@auth
def me():
    u = rows("SELECT id,name,email FROM users WHERE id=?", (g.user_id,))
    return jsonify(user=u[0]) if u else err("Account not found.", 401)


# ---------- tasks ----------
@app.get("/api/tasks")
@auth
def list_tasks():
    ts = [task_out(r) for r in rows("SELECT * FROM tasks WHERE user_id=?", (g.user_id,))]
    ts.sort(key=lambda t: (t["status"] == "done", -t["priority_score"]))
    return jsonify(tasks=ts)


@app.post("/api/tasks")
@auth
def create_task():
    try:
        out = clean_task(request.get_json(silent=True) or {})
    except ValueError as e:
        return err(str(e))
    cols = ["user_id", "created_at"] + list(out)  # keys are whitelisted by clean_task
    cur = db().execute(f"INSERT INTO tasks({','.join(cols)}) VALUES({','.join('?' * len(cols))})",
                       [g.user_id, now().isoformat()] + list(out.values()))
    db().commit()
    return jsonify(task=task_out(rows("SELECT * FROM tasks WHERE id=?", (cur.lastrowid,))[0])), 201


@app.patch("/api/tasks/<int:tid>")
@auth
def update_task(tid):
    if not rows("SELECT id FROM tasks WHERE id=? AND user_id=?", (tid, g.user_id)):
        return err("Task not found.", 404)
    try:
        out = clean_task(request.get_json(silent=True) or {}, partial=True)
    except ValueError as e:
        return err(str(e))
    if "status" in out:
        out["completed_at"] = now().isoformat() if out["status"] == "done" else None
    if out:
        db().execute(f"UPDATE tasks SET {', '.join(k + '=?' for k in out)} WHERE id=?", list(out.values()) + [tid])
        db().commit()
    return jsonify(task=task_out(rows("SELECT * FROM tasks WHERE id=?", (tid,))[0]))


@app.delete("/api/tasks/<int:tid>")
@auth
def delete_task(tid):
    db().execute("DELETE FROM tasks WHERE id=? AND user_id=?", (tid, g.user_id))
    db().commit()
    return jsonify(ok=True)


# ---------- stats & notifications ----------
@app.get("/api/stats")
@auth
def stats():
    ts = [task_out(r) for r in rows("SELECT * FROM tasks WHERE user_id=?", (g.user_id,))]
    open_ = sorted([t for t in ts if t["status"] != "done"], key=lambda t: -t["priority_score"])
    done = [t for t in ts if t["status"] == "done"]
    today = now().date()
    weekly = []
    for i in range(6, -1, -1):
        day = today - dt.timedelta(days=i)
        n = sum(1 for t in done if t["completed_at"] and parse_dt(t["completed_at"]).date() == day)
        weekly.append({"day": day.strftime("%a"), "count": n})
    courses = {}
    for t in open_:
        courses[t["course"] or "General"] = courses.get(t["course"] or "General", 0) + 1
    week_end = now() + dt.timedelta(days=7)
    return jsonify(
        total=len(ts), completed=len(done), pending=len(open_),
        overdue=sum(1 for t in open_ if t["is_overdue"]),
        completion_rate=round(len(done) / len(ts) * 100) if ts else 0,
        hours_remaining=round(sum(t["estimated_hours"] for t in open_), 1),
        due_this_week=sum(1 for t in open_ if parse_dt(t["due_date"]) <= week_end),
        weekly=weekly, upcoming=open_[:5],
        by_course=[{"course": c, "count": n} for c, n in sorted(courses.items(), key=lambda x: -x[1])],
    )


@app.get("/api/notifications")
@auth
def notifications():
    out = []
    for t in pending_tasks():
        h = (parse_dt(t["due_date"]) - now()).total_seconds() / 3600
        if h < 0:
            level, text = "overdue", f"Overdue: {t['title']}"
        elif h <= 24:
            level, text = "urgent", f"Due within {max(1, round(h))}h: {t['title']}"
        elif h <= 72:
            level, text = "soon", f"Due in {round(h / 24)} days: {t['title']}"
        else:
            continue
        out.append({"id": f"{t['id']}-{level}", "task_id": t["id"], "level": level, "message": text, "due_date": t["due_date"]})
    return jsonify(notifications=out)


# ---------- AI: chat ----------
def chat_system():
    me = rows("SELECT name FROM users WHERE id=?", (g.user_id,))[0]["name"]
    tasks = "\n".join(f"- {t['title']} ({t['course'] or 'no course'}), due {t['due_date']}, priority {t['priority_label']}"
                      for t in pending_tasks()[:10]) or "none"
    return (f"You are Smart Academic Assistant, a friendly, accurate tutor for {me}, a college student. "
            "Explain clearly, use short examples, and say when you are unsure. Keep answers concise. "
            f"Today is {now():%A, %B %d, %Y}. The student's open tasks:\n{tasks}")


@app.get("/api/ai/chat")
@auth
def chat_history():
    return jsonify(messages=rows("SELECT role,content,created_at FROM chat_messages WHERE user_id=? ORDER BY id", (g.user_id,)))


@app.post("/api/ai/chat")
@auth
def chat():
    msg = str((request.get_json(silent=True) or {}).get("message", "")).strip()
    if not msg:
        return err("Type a message first.")
    hist = rows("SELECT role,content FROM chat_messages WHERE user_id=? ORDER BY id DESC LIMIT 12", (g.user_id,))[::-1]
    contents = [{"role": h["role"], "parts": [{"text": h["content"]}]} for h in hist] + [{"role": "user", "parts": [{"text": msg[:4000]}]}]
    reply = ai.generate(contents, system=chat_system())
    for role, text in (("user", msg[:4000]), ("model", reply)):
        db().execute("INSERT INTO chat_messages(user_id,role,content,created_at) VALUES(?,?,?,?)", (g.user_id, role, text, now().isoformat()))
    db().commit()
    return jsonify(reply=reply)


@app.delete("/api/ai/chat")
@auth
def clear_chat():
    db().execute("DELETE FROM chat_messages WHERE user_id=?", (g.user_id,))
    db().commit()
    return jsonify(ok=True)


# ---------- AI: notes ----------
def note_out(r):
    return {**r, "key_points": json.loads(r["key_points"]), "questions": json.loads(r["questions"])}


@app.get("/api/notes")
@auth
def list_notes():
    return jsonify(notes=[note_out(r) for r in rows("SELECT * FROM notes WHERE user_id=? ORDER BY id DESC", (g.user_id,))])


@app.post("/api/ai/summarize")
@auth
def summarize():
    d = request.get_json(silent=True) or {}
    text, title = str(d.get("text", "")).strip(), str(d.get("title", "")).strip() or "Untitled note"
    if len(text) < 40:
        return err("Paste at least a few sentences of notes to summarize.")
    result = ai.generate(
        "Summarize the student's notes. Respond ONLY with JSON: "
        '{"summary": string (3-5 sentences), "key_points": [5-8 short strings], "questions": [3 review questions]}.\n\nNOTES:\n' + text[:20000],
        json_mode=True, temperature=0.3)
    if not isinstance(result, dict):
        raise ai.AIError("Gemini returned an unexpected format. Please try again.")
    summary = str(result.get("summary", "")).strip()
    kp = [str(x) for x in result.get("key_points", [])][:10]
    qs = [str(x) for x in result.get("questions", [])][:5]
    cur = db().execute("INSERT INTO notes(user_id,title,original,summary,key_points,questions,created_at) VALUES(?,?,?,?,?,?,?)",
                       (g.user_id, title[:200], text, summary, json.dumps(kp), json.dumps(qs), now().isoformat()))
    db().commit()
    return jsonify(note=note_out(rows("SELECT * FROM notes WHERE id=?", (cur.lastrowid,))[0])), 201


@app.delete("/api/notes/<int:nid>")
@auth
def delete_note(nid):
    db().execute("DELETE FROM notes WHERE id=? AND user_id=?", (nid, g.user_id))
    db().commit()
    return jsonify(ok=True)


# ---------- AI: prioritization & study planner ----------
@app.post("/api/ai/prioritize")
@auth
def ai_prioritize():
    ts = pending_tasks()
    fallback = [{**t, "rank": i + 1, "reason": rule_reason(t)} for i, t in enumerate(ts)]
    if not ts:
        return jsonify(source="rules", ranked=[])
    payload = [{"id": t["id"], "title": t["title"], "course": t["course"], "due": t["due_date"],
                "hours": t["estimated_hours"], "importance": t["importance"], "rule_score": t["priority_score"]} for t in ts]
    try:
        res = ai.generate(
            f"Now is {now().isoformat()}. Rank these student tasks from most to least important to start. Consider deadlines, "
            "importance, effort and dependencies. Respond ONLY with a JSON array of "
            '{"id": number, "reason": "one short sentence"} in ranked order.\n' + json.dumps(payload), json_mode=True, temperature=0.2)
        if isinstance(res, dict):
            res = next((v for v in res.values() if isinstance(v, list)), [])
        by_id, ranked, seen = {t["id"]: t for t in ts}, [], set()
        for item in res:
            tid = item.get("id") if isinstance(item, dict) else None
            if tid in by_id and tid not in seen:
                seen.add(tid)
                ranked.append({**by_id[tid], "rank": len(ranked) + 1, "reason": str(item.get("reason", "")).strip()})
        for t in ts:
            if t["id"] not in seen:
                ranked.append({**t, "rank": len(ranked) + 1, "reason": rule_reason(t)})
        return jsonify(source="gemini", ranked=ranked)
    except (ai.AIError, AttributeError, TypeError):
        return jsonify(source="rules", ranked=fallback)


@app.get("/api/ai/study-plans")
@auth
def list_plans():
    ps = rows("SELECT * FROM study_plans WHERE user_id=? ORDER BY id DESC LIMIT 10", (g.user_id,))
    return jsonify(plans=[{**p, "plan": json.loads(p["plan"])} for p in ps])


@app.post("/api/ai/study-plan")
@auth
def study_plan():
    d = request.get_json(silent=True) or {}
    try:
        days, hours = max(1, min(int(d.get("days", 7)), 14)), max(0.5, min(float(d.get("hours_per_day", 3)), 12))
    except (TypeError, ValueError):
        return err("Days and hours per day must be numbers.")
    goal = str(d.get("goal", "")).strip()[:500]
    ts = pending_tasks()
    if not ts and not goal:
        return err("Add a task or describe a goal so the planner has something to schedule.")
    tasks = [{"title": t["title"], "course": t["course"], "due": t["due_date"], "hours": t["estimated_hours"], "priority": t["priority_label"]} for t in ts[:20]]
    plan = ai.generate(
        f"Today is {now():%Y-%m-%d}. Build a {days}-day study plan starting today with at most {hours:g} study hours per day. "
        f"Goal: {goal or 'finish pending tasks on time'}. Pending tasks: {json.dumps(tasks)}. Schedule urgent work first, finish each task before its due date, "
        "and include short breaks. Respond ONLY with JSON: "
        '{"overview": string, "days": [{"date": "YYYY-MM-DD", "sessions": [{"task": string, "minutes": number, "focus": string}]}], "tips": [string]}.',
        json_mode=True, temperature=0.4)
    if not isinstance(plan, dict) or not isinstance(plan.get("days"), list):
        raise ai.AIError("Gemini returned an unexpected plan format. Please try again.")
    cur = db().execute("INSERT INTO study_plans(user_id,goal,days,hours_per_day,plan,created_at) VALUES(?,?,?,?,?,?)",
                       (g.user_id, goal, days, hours, json.dumps(plan), now().isoformat()))
    db().commit()
    return jsonify(plan={"id": cur.lastrowid, "goal": goal, "days": days, "hours_per_day": hours, "plan": plan, "created_at": now().isoformat()}), 201


init_db()

if __name__ == "__main__":
    app.run(port=5000, debug=os.getenv("FLASK_DEBUG") == "1")
