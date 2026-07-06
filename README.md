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

- `server/` – Express + TypeScript + SQLite API (JWT auth, family invite codes).
- `client/` – React + TypeScript + Vite single-page app.

## Running locally

In one terminal:

```
cd server
cp .env.example .env
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
