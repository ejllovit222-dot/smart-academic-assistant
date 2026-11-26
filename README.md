# Smart Academic Assistant & Task Automation System

A full-stack AI automation project for students: task management with automatic prioritization, deadline notifications, an AI tutor chatbot, note summarization, and an AI study planner.

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Python Flask (REST API), JWT auth |
| Database | SQLite (file: `backend/academic.db`, created automatically) |
| AI | Google Gemini API, called **only from the backend** |

## Project structure

```
smart-academic-assistant/
├── backend/
│   ├── app.py              # Flask API: auth, tasks, stats, notifications, AI routes
│   ├── ai.py               # Gemini client (reads GEMINI_API_KEY from the environment)
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/App.jsx         # Layout, navigation, notification bell
    ├── src/api.js          # Fetch wrapper (adds the JWT)
    ├── src/ui.jsx          # Shared components
    ├── src/pages/          # Auth, Dashboard, Tasks, Chat, Notes, Planner
    └── package.json, vite.config.js, tailwind.config.js
```

## Run locally

Requirements: Python 3.10+, Node.js 18+, and a free Gemini API key from https://aistudio.google.com/apikey.

### 1. Backend (terminal 1)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # Windows: copy .env.example .env
# Edit .env: set GEMINI_API_KEY and a long random SECRET_KEY
python app.py                    # http://localhost:5000
```

Check it works: open http://localhost:5000/api/health. You should see `{"ai_configured": true, "ok": true}`.

### 2. Frontend (terminal 2)

```bash
cd frontend
npm install
npm run dev                      # http://localhost:5173
```

Vite proxies `/api` to Flask, so no frontend configuration is needed. Open http://localhost:5173, create an account, and start adding tasks.

## Build and test in stages

1. **Stage 1: Backend foundation.** Start Flask, then register, log in and create tasks with curl or Postman (`/api/auth/*`, `/api/tasks`). Data persists in SQLite across restarts.
2. **Stage 2: Automation logic.** Add tasks with different deadlines and check `/api/stats` and `/api/notifications`. Priority scores and deadline alerts need no AI.
3. **Stage 3: Gemini features.** With a valid key, try `/api/ai/chat`, `/api/ai/summarize`, `/api/ai/study-plan` and `/api/ai/prioritize`.
4. **Stage 4: Frontend.** Run the React app and use every page end to end.

## How the automation works

- **Automatic task prioritization.** Every task gets a 0 to 100 score: `0.55 × urgency + 0.30 × importance + 0.15 × effort`. Urgency is `100 / (1 + hours_left / 24)`, so it rises sharply as a deadline approaches, and overdue tasks are always high. Tasks are sorted by this score. The "Re-rank with AI" button asks Gemini for a ranking with reasons, and falls back to the rules if Gemini is unavailable.
- **Deadline notifications.** The backend flags tasks that are overdue, due within 24 hours, or due within 3 days. The frontend polls every 60 seconds, shows a bell badge, and sends browser desktop notifications once the user allows them.
- **Chatbot.** Sends the last 12 messages plus the student's open tasks as context, and stores the conversation per user.
- **Summarizer and planner.** Gemini is asked for strict JSON, which the backend parses, validates and stores.

## API overview

All routes except register, login and health need `Authorization: Bearer <token>`.

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | Create account / sign in |
| GET | `/api/auth/me` | Current user |
| GET, POST | `/api/tasks` | List (sorted by priority) / create |
| PATCH, DELETE | `/api/tasks/<id>` | Update / delete |
| GET | `/api/stats`, `/api/notifications` | Dashboard data / deadline alerts |
| GET, POST, DELETE | `/api/ai/chat` | History / send message / clear |
| POST, GET | `/api/ai/summarize`, `/api/notes` | Summarize and save / list |
| POST | `/api/ai/prioritize` | AI task ranking |
| POST, GET | `/api/ai/study-plan`, `/api/ai/study-plans` | Generate / list plans |

## Security notes

- The Gemini key lives only in `backend/.env` (git-ignored). The browser never sees it.
- Passwords are hashed (Werkzeug). Sessions are JWTs that expire after 7 days.
- Every query is scoped to the signed-in user and uses parameterized SQL.
- Before any real deployment: set a strong `SECRET_KEY`, serve over HTTPS, run with a production server such as gunicorn, and add rate limiting.

## Troubleshooting

- **"Gemini API key is not configured"**: set `GEMINI_API_KEY` in `backend/.env` and restart Flask.
- **Gemini error 404 about the model**: set `GEMINI_MODEL` in `.env` to a model your key can access.
- **"Cannot reach the server"**: make sure Flask is running on port 5000.
- **CORS errors**: add your frontend URL to `CORS_ORIGINS`.
- **Reset all data**: stop the server and delete `backend/academic.db`.

## Ideas to extend it

Email deadline reminders with a scheduler (APScheduler), file upload for PDF notes, recurring tasks, a calendar view, and unit tests with pytest.
