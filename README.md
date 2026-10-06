# Taskflow — Professional MERN To-Do App

A production-quality to-do application built with **MongoDB, Express, React, and Node.js**.
Includes a hardened REST API, a polished React client, and a 44-case automated edge-case test suite.

```
todo-mern/
├── server/                 # Express + Mongoose REST API
│   ├── src/
│   │   ├── config/db.js
│   │   ├── models/Todo.js          # Schema, validation, indexes
│   │   ├── controllers/todoController.js
│   │   ├── routes/todos.js
│   │   ├── middleware/             # validators, error handler, async wrapper
│   │   ├── app.js                  # App factory (used by tests too)
│   │   └── server.js               # Entry point: DB connect + listen
│   └── tests/todos.test.js         # 44 edge-case tests (Jest + Supertest)
└── client/                 # React 18 + Vite
    └── src/
        ├── api.js                  # Typed fetch client with error envelopes
        ├── components/             # TodoForm, TodoItem, FilterBar, StatsBar, Pagination
        ├── App.jsx
        └── styles.css
```

## Features

- **Tasks**: create, edit (double-click), toggle, delete with confirmation
- **Organization**: priorities, due dates, notes, tags
- **Views**: filter by status/priority/tag/overdue, full-text search (regex-safe), 5 sort orders, pagination
- **Dashboard**: total / active / done / overdue counts + progress bar, bulk "clear completed"
- **API hardening**: request validation, consistent `{success, data/error}` envelopes, rate limiting (300 req/15 min), Helmet headers, 100 KB body cap, CORS allow-list, graceful shutdown

## Quick start

**Prerequisites:** Node 18+, and MongoDB (local `mongod`, Docker, or Atlas).

```bash
# 1. API
cd server
cp .env.example .env        # set MONGODB_URI
npm install
npm run dev                 # → http://localhost:5000

# 2. Client (new terminal)
cd client
npm install
npm run dev                 # → http://localhost:5173 (proxies /api to :5000)
```

## API reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/todos` | List — `status, priority, search, tag, overdue, sort, page, limit` |
| POST | `/api/todos` | Create — `title*`, `notes`, `completed`, `priority`, `dueDate`, `tags` |
| GET | `/api/todos/:id` | Fetch one |
| PATCH | `/api/todos/:id` | Partial update |
| PATCH | `/api/todos/:id/toggle` | Flip completed (atomic) |
| DELETE | `/api/todos/:id` | Delete one |
| DELETE | `/api/todos/completed` | Bulk-delete completed |
| GET | `/api/todos/stats/summary` | `{total, completed, active, overdue}` |

Errors always look like: `{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }`

## Testing

```bash
cd server
npm test            # 44 tests, in-memory MongoDB (no local mongod needed)
npm run test:coverage
```

**Edge cases covered:** empty/whitespace/oversized/unicode titles · invalid priority, dates, tags, JSON bodies · oversized payloads (413) · malformed vs. nonexistent ObjectIds · empty PATCH bodies · unknown fields · double deletes · route-ordering (`/completed`, `/stats/summary` vs `/:id`) · regex-injection in search · null-due-date sorting · pagination boundaries · 50 parallel creates · 10 concurrent toggles (verified atomic, no lost updates).

During development the suite caught and fixed three real bugs: a lost-update race in toggle, completed tasks leaking into the overdue filter, and null due dates sorting before dated tasks.

## Deploy to Vercel

The repo ships Vercel-ready: `vercel.json` builds the React client as a static
site and serves the Express API through a serverless function (`api/index.js`,
DB connects lazily on cold start).

1. Push this repo to GitHub.
2. In Vercel, **Add New Project → Import** the repo.
3. Set environment variables:
   - `MONGODB_URI` — your MongoDB Atlas connection string (required)
   - `CORS_ORIGIN` — your `https://<project>.vercel.app` URL
4. Deploy. The client calls the API on the same origin (`/api/*` rewrites to the function).

## Production notes

- Set `NODE_ENV=production`, `MONGODB_URI`, and `CORS_ORIGIN` in `server/.env`.
- Serve `client/dist` (from `npm run build`) behind the API or a static host; set `VITE_API_URL` if the API lives on another origin.
