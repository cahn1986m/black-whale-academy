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

Local dev needs a `.env.local` with `DATABASE_URL` pointing at a Neon Postgres instance (copy `.env.example`). The `/admin` password is **not** an env var — it's a row in the database (`admin_settings` table, seeded by `schema.sql` with the default `admin123`) and is changed from inside `/admin` itself. See "Auth gate" below.

## Architecture

Next.js 14 App Router app (JS, no TypeScript), Arabic RTL UI (`app/layout.js` sets `lang="ar" dir="rtl"`), deployed on Vercel with Neon serverless Postgres. Sports-academy attendance + subscription tracker. Three separate audiences use different entry points: parents get `/register` (public, no login, no link back into the app), coaches get `/attendance` directly (public, no login), and staff use `/admin` (the only surface behind a password — see "Auth gate" below). `/history` is intentionally also public.

### Core flow

1. **`/register`** — parent-facing form. Compresses the uploaded photo client-side to a small base64 JPEG (`compressImage` in `app/register/page.js`), lets the parent check any number of activities and pick a session package for each, and POSTs to `/api/register`, which generates a `qr_token` (nanoid, unambiguous alphabet, retried up to 5x on the rare unique-constraint collision), inserts the child row, then inserts one `enrollments` row per selected activity.
2. **`/admin`** — staff view: create/edit/delete activities (with any number of session packages each), view the child roster, expand a child to see/renew/cancel their per-activity enrollments, print/view each child's QR badge (`/admin/child/[id]`, uses `qrcode.react`), and a "delete everything" reset button.
3. **`/attendance`** — staff picks **which activity is running right now** (required — this is what determines which enrollment a scan marks attendance for, since a child can be enrolled in several activities), then scans QR codes with the device camera (`html5-qrcode`). The scan POSTs `{ qrToken, activityId }` to `/api/attendance`, which resolves child → their enrollment in that specific activity → upserts today's `activity_attendance` row for that enrollment. If the child isn't enrolled in the selected activity, the scan is rejected with a clear error. If their sessions are used up, the scan still succeeds but the UI shows a loud non-blocking warning (front-desk friction is worse than a billing gap for a kids' club).
4. **`/history`** — read-only view of past days' attendance, optionally filtered by activity; with no filter, a child enrolled in multiple activities correctly shows once per activity.

### Database (`schema.sql`)

Six tables: `activities` (name/emoji/instructor/schedule — admin-managed, not hardcoded), `activity_packages` (session-count/price tiers per activity, e.g. "8 حصص / 300 درهم" and "12 حصة / 400 درهم" on the same activity), `children`, `enrollments` (many-to-many child↔activity join, `UNIQUE(child_id, activity_id)` — one row per child per activity, snapshotting `sessions_total`/`price_paid` at enroll time), `activity_attendance` (`UNIQUE(enrollment_id, attendance_date)`, keyed off the enrollment not the child, so the same child can have independent attendance rows for two different activities on the same day), and `admin_settings` (singleton row holding the `/admin` login password — see "Auth gate").

Two derived-value rules that matter everywhere this data is read:
- **`sessions_used`/`sessions_remaining` are never stored** — always `COUNT(*) FROM activity_attendance WHERE enrollment_id = X AND status = 'present'` vs `enrollments.sessions_total`. This avoids counter drift from the present/absent toggle button on the attendance roster. See the subquery pattern already used in `app/api/attendance/route.js` and `app/api/children/[id]/enrollments/route.js` — reuse it rather than inventing a stored counter.
- **"Renew" is an UPSERT, not a new row** — `POST /api/children/[id]/enrollments` does `INSERT ... ON CONFLICT (child_id, activity_id) DO UPDATE SET sessions_total = enrollments.sessions_total + EXCLUDED.sessions_total, price_paid = ...`, so re-subscribing a child to an activity they're already in just adds to the existing enrollment instead of creating a duplicate.

Marking attendance is always an `INSERT ... ON CONFLICT (enrollment_id, attendance_date) DO UPDATE` — never more than one attendance row per enrollment per day.

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

### Auth gate (`middleware.js`)

Single shared password for all staff, not per-user accounts — and it lives in the **database**, not an env var, specifically so staff can change it themselves from inside `/admin` without touching Vercel. `middleware.js` at the repo root (matches `/admin/:path*` and `/api/:path*`) is the **only** place gating happens — none of the route handlers themselves check auth beyond `/api/admin-password`'s own current-password check. Its `isProtected(pathname, method)` decides what needs a login:
- All of `/admin/*` (pages).
- `/api/activities` only for non-`GET` (POST create) — `GET` must stay public because `/register` reads it to show parents activity/package choices.
- `/api/activities/*`, `/api/packages/*`, `/api/child-list`, `/api/children/*` (covers both `/api/children/[id]` and `/api/children/[id]/enrollments`), `/api/admin-password`, `/api/reset` — protected for every method (full roster w/ contact info, per-child subscription details, activity/package CRUD, destructive reset, changing the password itself).
- `/api/admin-login` and `/api/admin-logout` are explicitly always public (otherwise logging in would require already being logged in).
- Everything else (`/api/attendance`, `/api/register`, and the page-level matcher not touching `/`, `/register`, `/attendance`, `/history`) is untouched.

**Password storage**: `admin_settings` is a singleton table (`id` pinned to `1` via a `CHECK` constraint) with one `password` column, seeded by `schema.sql` to `admin123` — log in with that once and change it immediately via the "🔑 تغيير كلمة المرور" form in `/admin` (`PATCH /api/admin-password`, which re-verifies the current password against the DB before updating, and re-sets the cookie to the new value so the current session doesn't get logged out).

**Password verification**: the auth cookie (`bwa_admin_session`, httpOnly, 30-day) holds the current password value itself rather than a hash/HMAC — deliberate, because Middleware runs on the Edge runtime (no Node `crypto`), and for one shared low-stakes password this is a fine simplification. Since Middleware would otherwise need a DB round-trip on *every single* protected request (page loads, the 15s polling in `/admin`, every fetch), `middleware.js` caches the current password in a module-level variable for `CACHE_TTL_MS` (30s) before re-querying — meaning a password change can take up to ~30s to fully propagate to already-warm Edge instances elsewhere. `app/admin-login/page.js` is deliberately **not** nested under `/admin/` so the matcher doesn't gate the login page itself.

If you ever need to reset the password directly (e.g. locked out), run `UPDATE admin_settings SET password = '...' WHERE id = 1;` in the Neon SQL Editor.

### QR badge → PNG download

Both `app/register/page.js`'s success screen and `app/admin/child/[id]/page.js` have a "📥 تحميل صورة" button that snapshots the whole `.badge-card` div (photo + name + QR + watermark) into a downloadable PNG via `html2canvas`, dynamically `import()`ed inside the click handler (same lazy-loading pattern as `html5-qrcode` — zero bundle cost on pages that don't use it). Deliberately not hand-rolled with the Canvas 2D API: the badge mixes a circular photo, RTL Arabic text, and a QR code, and `html2canvas` snapshots whatever is actually rendered instead of needing a manual re-implementation kept in sync with `.badge-card`'s styling.

### `/api/reset`

Wipes `activity_attendance`, `enrollments`, `children`, `activity_packages`, and `activities` completely (deleted leaf-to-root explicitly, not relying purely on `ON DELETE CASCADE`, so the returned per-table counts are accurate). Guarded only by requiring the request body to contain `confirm: 'DELETE ALL'` (enforced by a `window.prompt` on the `/admin` button, not real auth). Treat this endpoint as dangerous — there's no soft-delete or backup path in this app.

## File map

Keep this updated whenever a file is added, removed, or renamed.

```
app/
  layout.js                        root layout: <html lang="ar" dir="rtl">, page metadata
  page.js                          home screen — nav tiles + two CopyLink cards (register link for
                                    parents, attendance link for coaches)
  globals.css                      all app styling (no CSS framework)
  Header.js                        shared page header (logo + title/subtitle)
  CopyLink.js                      generic "copy <path> link" button, parameterized by `path` prop

  register/page.js                 parent-facing registration form (multi-activity + package picker) → POST /api/register;
                                    no link back into the app; success screen has a PNG-download button
  admin/page.js                    activities CRUD (+ packages), child roster with expandable enrollment
                                    management (renew/unenroll/add), reset-all button, logout + change-password buttons
  admin/child/[id]/page.js         printable/downloadable QR badge for one child
  admin-login/page.js              password form for the /admin gate (not nested under /admin/, see Auth gate)
  attendance/page.js               required activity selector + camera QR scanner + live roster/status toggle
  history/page.js                  read-only past-day attendance viewer, optional activity filter

  api/register/route.js            POST — create child + generate unique qr_token + insert selected enrollments
  api/admin-login/route.js         POST — checks password against admin_settings, sets the bwa_admin_session cookie
  api/admin-logout/route.js        POST — clears the cookie
  api/admin-password/route.js      PATCH — change the admin password (verifies current password first)
  api/activities/route.js          GET (list w/ nested packages + enrolled_count) + POST (create activity)
  api/activities/[id]/route.js     PATCH (edit activity fields) + DELETE (cascades to packages/enrollments/attendance)
  api/activities/[id]/packages/route.js   POST — add a session-count/price package tier to an activity
  api/packages/[id]/route.js       PATCH/DELETE one package tier (flat, not double-nested — package ids are globally unique)
  api/child-list/route.js          GET — full child roster, no filter (see "Route naming quirk")
  api/children/[id]/route.js       GET one child (full_name/photo/qr_token only)
  api/children/[id]/enrollments/route.js  GET this child's enrollments w/ derived sessions_used/remaining;
                                    POST create-or-renew (UPSERT, see Database section); DELETE ?activityId= to unenroll
  api/attendance/route.js          GET roster for activityId+date (or all-activities view w/o activityId),
                                    POST mark attendance via {enrollmentId} or {qrToken, activityId}
  api/reset/route.js               POST — wipe all data (see "/api/reset" above)

lib/
  db.js                            lazy Neon Postgres client, exports `sql` tagged-template fn

public/
  logo.png                         club logo used in Header

schema.sql                         one-time DB schema (run manually in Neon SQL Editor); seeds admin_settings
                                    with the default password admin123 — change it after first login
middleware.js                      the only place that gates /admin + sensitive API routes (see Auth gate)
jsconfig.json                      "@/*" path alias → repo root
next.config.js                     reactStrictMode only, no other overrides
.env.example                       documents required DATABASE_URL (no password env var — see Auth gate)
```
