# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev      # local dev server (http://localhost:3000)
npm run build    # production build — run this before every commit that touches app/ or lib/
npm run start    # serve the production build locally
```

There is no lint or test command/config in this project — `npm run build` (which runs Next's type/lint checks via `next build`) is the only automated verification available.

`package.json` has a `db:init` script pointing at `scripts/init-db.mjs`, but that file does not exist in the repo — it's dead/aspirational. To set up the database, run `schema.sql` directly in the Neon SQL Editor once (see README.md).

Local dev needs a `.env.local` with `DATABASE_URL` pointing at a Neon Postgres instance (copy `.env.example`).

## Architecture

Next.js 14 App Router app (JS, no TypeScript), Arabic RTL UI (`app/layout.js` sets `lang="ar" dir="rtl"`), deployed on Vercel with Neon serverless Postgres. Single-tenant attendance tracker for a kids' club — **no authentication anywhere**; every route (including `/admin` and the destructive reset endpoint) is public to anyone with the URL.

### Core flow

1. **`/register`** — parent-facing form. Compresses the uploaded photo client-side to a small base64 JPEG (`compressImage` in `app/register/page.js`) and POSTs to `/api/register`, which generates a `qr_token` (nanoid, unambiguous alphabet, retried up to 5x on the rare unique-constraint collision) and inserts the child row.
2. **`/admin`** — staff view: create groups, assign children to groups, view roster, print/view each child's QR badge (`/admin/child/[id]`, uses `qrcode.react`), and a "delete everything" reset button.
3. **`/attendance`** — staff scans QR codes with the device camera (`html5-qrcode`) to mark a child present; the scan POSTs the raw `qr_token` to `/api/attendance`, which resolves it to a child id server-side (the scanner never needs a group selected — group filtering on this page is just a UI convenience for the roster list below the scanner).
4. **`/history`** — read-only view of past days' attendance, filterable by date/group.

### Database (`schema.sql`)

Three tables: `groups`, `children` (`qr_token TEXT UNIQUE NOT NULL` — the uniqueness constraint doubles as the lookup index, no separate index needed), `attendance` (`UNIQUE(child_id, attendance_date)`). Marking attendance is always an `INSERT ... ON CONFLICT (child_id, attendance_date) DO UPDATE` — there is intentionally never more than one attendance row per child per day; re-scanning the same child the same day updates the existing row instead of creating a duplicate.

`lib/db.js` exports a `sql` tagged-template function backed by a lazily-created `@neondatabase/serverless` client (the client isn't constructed until first query, so importing the module doesn't throw if `DATABASE_URL` is unset at build time).

Photos are stored inline as base64 in `children.photo_base64` — there is no object storage/CDN for images. Keep this in mind before adding features that load many children's photos at once (payload size grows with roster size).

### Caching — read this before touching any API route or fetch call

This app hit a real production bug where Vercel/Next served stale data indefinitely despite correct queries and a confirmed-empty database. The fix requires **all** of the following on every data-reading API route and every client-side fetch of it:

- Route handlers: `export const dynamic = 'force-dynamic'` (all routes already have this; `/api/child-list` additionally has `revalidate = 0`, `fetchCache = 'force-no-store'`, and explicit `Cache-Control`/`CDN-Cache-Control`/`Vercel-CDN-Cache-Control` no-store headers — apply the same if a new route turns out to need it).
- Every `fetch()` call to an internal API route from a client component passes `{ cache: 'no-store' }`.

If you add a new GET route that the UI polls or reads live data from, copy this pattern rather than a bare `NextResponse.json(...)`.

### Route naming quirk

The children-list endpoint lives at **`/api/child-list`**, not `/api/children` — it was renamed during the caching investigation above to rule out a stuck edge cache on the old path. `/api/children/[id]` (single child, GET/PATCH) is unrelated and still at its original path. Don't recreate `/api/children/route.js` — that path is deliberately unused now.

### QR scanning (`app/attendance/page.js`)

- `html5-qrcode` is dynamically `import()`ed but pre-warmed on mount (`import('html5-qrcode').catch(() => {})` in a no-op effect) so the actual import inside the click handler resolves near-instantly — this keeps the `getUserMedia` call inside the same user-activation window as the click, which Safari/iOS requires to show the permission prompt.
- Camera start tries, in order: exact back camera → ideal back camera → front camera → first device from `Html5Qrcode.getCameras()`. Failure at every step surfaces an Arabic message mapped from the `DOMException.name` (see `CAMERA_ERROR_MESSAGES`).
- `stopRequestedRef` handles the race where the user hits "stop" while the camera is still negotiating permission; a `visibilitychange` listener auto-stops the camera when the tab is hidden. Any change to the start/stop lifecycle should preserve both.
- Duplicate-scan protection is a 2.5s per-code cooldown (`SCAN_COOLDOWN_MS`, `lastScanRef`), separate from the DB-level UPSERT that prevents duplicate attendance rows.
- Successful scans play a short beep via a Web Audio API `AudioContext` (`playBeep`), not an audio file. The context is created synchronously inside `startScanner`'s click handler (required for iOS Safari to allow playback later from the async decode callback) and is reused across start/stop cycles, closed only on unmount.
- `.scanner-box` is a fixed `aspect-ratio: 1/1` square in `globals.css` (with `aspectRatio: 1.0` also passed to `html5-qrcode`'s config) specifically so the camera view never shrinks as the roster list below it grows — don't remove the fixed aspect ratio without another way to guarantee a stable camera size.

### `/api/reset`

Wipes `attendance`, `children`, and `groups` completely. Guarded only by requiring the request body to contain `confirm: 'DELETE ALL'` (enforced by a `window.prompt` on the `/admin` button, not real auth). Treat this endpoint as dangerous — there's no soft-delete or backup path in this app.

## File map

Keep this updated whenever a file is added, removed, or renamed.

```
app/
  layout.js                        root layout: <html lang="ar" dir="rtl">, page metadata
  page.js                          home screen — nav tiles + CopyRegisterLink
  globals.css                      all app styling (no CSS framework)
  Header.js                        shared page header (logo + title/subtitle)
  CopyRegisterLink.js               "copy /register link" button on the home page

  register/page.js                 parent-facing registration form → POST /api/register
  admin/page.js                    group CRUD, child→group assignment, roster, reset-all button
  admin/child/[id]/page.js         printable QR badge for one child
  attendance/page.js               camera QR scanner + live roster/status toggle
  history/page.js                  read-only past-day attendance viewer

  api/register/route.js            POST — create child + generate unique qr_token
  api/groups/route.js              GET (list w/ child counts) + POST (create group)
  api/child-list/route.js          GET — full/filtered child roster (see "Route naming quirk")
  api/children/[id]/route.js       GET one child, PATCH group_id
  api/attendance/route.js          GET records for a date/group, POST mark attendance (qrToken or childId)
  api/reset/route.js               POST — wipe all data (see "/api/reset" above)

lib/
  db.js                            lazy Neon Postgres client, exports `sql` tagged-template fn

public/
  logo.png                         club logo used in Header

schema.sql                         one-time DB schema (run manually in Neon SQL Editor)
jsconfig.json                      "@/*" path alias → repo root
next.config.js                     reactStrictMode only, no other overrides
.env.example                       documents required DATABASE_URL
```
