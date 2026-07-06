# Co-Parent

A shared calendar for co-parents. Each parent signs in with their own account and
sees one shared family calendar with:

- **Custody blocks** – who has the kids and when.
- **Activities** – extracurriculars (practice, lessons, appointments), optionally
  tied to a specific child.
- **Unavailability** – a parent can mark themselves 100% unavailable for a window
  of time (e.g. work travel), which the other parent can see and respond to.
- **Swap requests** – either parent can propose a schedule change (e.g. covering
  custody during the other's unavailable window); the request must be accepted
  before the calendar changes.

## Structure

- `server/` – Express + TypeScript + Postgres API (JWT auth, family invite codes).
- `client/` – React + TypeScript + Vite single-page app.

## Running locally

You'll need a Postgres database. The quickest option is a free
[Neon](https://neon.tech) project (grab the connection string it gives you);
alternatively run Postgres locally.

In one terminal:

```
cd server
cp .env.example .env   # then fill in DATABASE_URL
npm install
npm run dev   # http://localhost:4000
```

In another terminal:

```
cd client
npm install
npm run dev   # http://localhost:5173
```

The client dev server proxies `/api` requests to the backend, so just open
http://localhost:5173.

## Deploying (so you can use it from your phone)

This deploys the backend and frontend as two separate free hosted services.

### 1. Database — Neon (free)

1. Create a free account at [neon.tech](https://neon.tech) and a new project.
2. Copy the connection string it gives you (starts with `postgres://`).

### 2. Backend — Render (free)

1. Create a free account at [render.com](https://render.com) and connect your
   GitHub account.
2. Click **New > Blueprint**, pick this repo — it will pick up `render.yaml`
   at the repo root and create a `coparent-api` web service.
3. When prompted for env vars, set `DATABASE_URL` to the Neon connection
   string. Leave `CORS_ORIGIN` blank for now (you'll set it after step 3).
   `JWT_SECRET` is auto-generated.
4. Once deployed, copy the service's URL (something like
   `https://coparent-api.onrender.com`).

Note: Render's free web services spin down after ~15 minutes of inactivity —
the first request after that takes a few extra seconds to wake back up. The
database itself (on Neon) is unaffected and always has your data.

### 3. Frontend — Vercel (free)

1. Create a free account at [vercel.com](https://vercel.com) and connect your
   GitHub account.
2. Import this repo as a new project. Set the **Root Directory** to `client`.
3. Add an environment variable `VITE_API_URL` set to your Render backend URL
   from step 2 (no trailing slash).
4. Deploy. Vercel gives you a URL like `https://coparent-xyz.vercel.app` —
   that's what you open on your phone.

### 4. Lock down CORS (recommended)

Back in Render, set the backend's `CORS_ORIGIN` env var to your Vercel URL
(e.g. `https://coparent-xyz.vercel.app`) and redeploy, so only your deployed
frontend can call the API.

## Using it

1. One parent registers and chooses "Start a new family," which generates an
   invite code (shown under **Invite code** in the header).
2. The other parent registers with "Join my co-parent" and enters that code.
3. Add children, extracurricular activities, custody blocks, and unavailable
   windows from the calendar. Clicking a day or an existing event opens the
   event form.
4. If a parent is unavailable during a scheduled custody block, the other
   parent can open that event and click **Propose a swap** to suggest new
   dates/times. The recipient accepts or declines from the sidebar.
