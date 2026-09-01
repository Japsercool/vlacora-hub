# VLACORA HUB — demo 0.1

A clickable multi-station radio hub prototype.

## Included demo modules

- Dashboard
- Multi-station selector
- Stations overview
- Tasks / Kanban
- Meldpunt
- Messenger
- Official communication
- Calendar
- Programming schedule
- New music
- Music meetings
- Rotation One playlist editor mock
- Charts / historical movements
- Presenter text editor
- Social Studio mock visual generator
- Listener statistics
- On-Air Control Center
- Team & roles
- Settings

Everything uses mock data for now. Changes such as tasks, chat messages, playlist reordering, votes and presenter text live only in the browser until the page is refreshed.

## Run locally

1. Install Node.js LTS.
2. Extract this project.
3. Open a terminal in the project directory.
4. Run:

```bash
npm install
npm run dev
```

5. Open:

http://localhost:3000

## Put on GitHub

Create a private repository called `vlacora-hub`, then upload/push all files in this folder.

Do NOT upload `.env.local`.

## Deploy on Vercel

1. Import the GitHub repository in Vercel.
2. Framework should be detected as Next.js.
3. Deploy.
4. No environment variables are required for this demo.

## Supabase

`supabase/migrations/001_initial_schema.sql` contains the first proposed multi-station database schema. Do not run it until a Supabase project is ready.

## Important

This is a UI/interaction prototype, not the production radio integration yet:
- no real login
- no database persistence
- no real Messenger backend
- no Rotation One connection
- no Playout One connection
- no SHOUTcast connection

Those are the next development phase.


## GitHub Desktop / Vercel

- Keep `.env.example` in GitHub.
- Do **not** commit `.env.local` or real secrets.
- The included `.gitignore` is configured for Next.js, Node.js, Vercel and VLACORA secrets.
- In Vercel select **Next.js** as the framework preset.
- If `package.json` is visible in the root of your GitHub repository, leave **Root Directory** on `./`.
- No Environment Variables are required for this demo version.


## 0.2.0 interactive demo

This version is intentionally interactive before Supabase is connected.

Working in the browser:
- create/update/delete tasks
- submit/resolve incidents
- send Messenger messages
- publish/read/delete official announcements
- add/delete calendar events
- score and add music tracks
- run music meeting decisions
- reorder/edit/add/delete playlist items
- edit presenter text
- generate and download a demo social PNG
- add/edit team members
- save station settings

Data is stored in browser `localStorage`, so it survives a refresh on the same browser/device.

Real shared multi-user data still requires Supabase, which is the next phase.

## 0.3.0 - Editorial expansion

This version focuses on the daily editorial radio workflow.

### Messenger fix
Messenger channels now have their **own message history**. Switching from Music to Technology or a direct chat no longer shows the same messages. You can also create new group, station and private chats in the demo.

### Presentation text per song
`Presentatie` now contains a station-specific song library. Each song has:
- presenter text
- internal editorial notes
- tags
- a generated text variant

### Program text templates
Programs such as Morning Club and Drive can have an ordered rundown of text items. Items can be moved, added, removed and configured as fixed text, editorial item, song text, playlist item, news/info or promo.

### Social templates
Social Studio now has an editable template library. Create new templates, change layout/label/background/caption patterns, preview variables and store draft posts.

### Music folders PDF
The new `Muziekmappen PDF` module lets you maintain folders/categories and songs, then generate a branded internal VLACORA PDF. The browser generator uses jsPDF. An example output is included at:

`docs/VLACORA_Muziekmappen_Voorbeeld.pdf`

### Backend preparation
`supabase/migrations/002_editorial_extensions.sql` contains the proposed production tables for these new modules.

## 0.4.0
- Messenger: station/user dropdowns + refresh users.
- Music: searchable real song library, artwork, metadata, map and per-song presentation text.
- Music folders: dropdown to move songs between maps + refresh library.
- Social Studio: no prompt dialogs; upload background/logo/artwork and edit all visible text, colors, positions and sizes.


## 0.5.0 — Redactie + radio API architecture

New Redactie module:
- edit playlist order
- write a presenter text and notes for every playlist item
- load the standard presenter text from the music library
- add music from the shared music library
- add editorial talk/weather/traffic/promo items
- link program templates to shows
- automatically insert template blocks into an hour

Rotation One / Playout One:
- Designed for the user's fixed public API IP addresses.
- Browser does NOT call the public radio IP directly.
- Vercel server routes proxy calls so API keys remain server-side and CORS is avoided.
- Configure `ROTATION_ONE_BASE_URL` and `PLAYOUT_ONE_BASE_URL` in Vercel Environment Variables.
- Playlist/status paths are configurable because the exact current Rotation One/Playout One route names may differ.

Important: do not put the API keys in `NEXT_PUBLIC_*` variables.


## 0.6.0 — Secure Rotation One / Playout One bridge

This version adds:
- Radio API control module
- live station dropdown discovery from Rotation One and Playout One
- automatic name-based station mapping
- refreshable station dropdowns
- live Rotation/Playout health check
- Playout One now/next endpoint adapter
- normalization layer for several common JSON field names
- server-side API proxy routes

### Security defaults

Real radio access is **disabled by default**:
- `RADIO_API_ENABLED=false`
- `RADIO_API_WRITE_ENABLED=false`
- plain HTTP is blocked unless explicitly enabled

Before setting `RADIO_API_ENABLED=true`, protect VLACORA with:
- `VLACORA_BASIC_AUTH_USER`
- `VLACORA_BASIC_AUTH_PASSWORD`

This Basic Auth layer is an interim safeguard. The intended production model is Supabase Auth + station/role permissions.

Remote playlist writes have a second kill switch:
- `RADIO_API_WRITE_ENABLED=true`

Do not enable it until read-only playlist import is confirmed correct.

### Fixed public IP

A fixed public IP works from Vercel, but **HTTPS is strongly preferred**. If you use plain HTTP to a public IP, the radio API key can travel unencrypted over the public internet. A TLS reverse proxy / valid HTTPS endpoint is the recommended setup.

Never use `NEXT_PUBLIC_` for radio API keys.


## 0.7.0 — Team & Rights + HTTP fixed IP

### Team & Rights
- redesigned user directory
- search/filter by role and station
- activate/disable users
- multiple station memberships
- role presets
- per-module permission matrix:
  - none
  - view
  - edit
  - publish
  - admin
- "Test as this user" demo mode
- roles include Superadmin, Stationmanager, Muziekredactie, Redactie, Presentator, Social & Marketing, Techniek, Kijker

The current permission editor is still browser-local for prototyping. Production enforcement will move to Supabase Auth/RBAC and server-side checks.

### HTTP radio APIs

Rotation One and Playout One can now use real plain HTTP fixed-IP URLs, e.g.:

ROTATION_ONE_BASE_URL=http://YOUR_FIXED_IP:5090
PLAYOUT_ONE_BASE_URL=http://YOUR_FIXED_IP:5190
RADIO_API_ALLOW_INSECURE_HTTP=true

This works through the Vercel server-side proxy. Radio API keys never need to be exposed to the browser.

For extra protection with a fixed IP, configure:
RADIO_API_ALLOWED_HOSTS=YOUR_FIXED_IP

Important: plain HTTP itself is not encrypted. Use long random API secrets, keep write access disabled until read-only tests are correct, expose only required ports/endpoints, and apply firewall restrictions where possible.

## 0.7.1 — Vercel build fix
- Fixed TypeScript error in `app/api/radio/rotation/playlist/route.ts`.
- Removed direct iteration of `URLSearchParams` under the old ES5 target.
- TypeScript target changed from `es5` to `es2017` to avoid similar iterable API build errors.
- Package version updated to 0.7.1.


## 0.8.0 — Integration setup directly in Beheer

The user no longer needs to configure Vercel Environment Variables just to test Rotation One / Playout One.

In Beheer → Integraties → Instellen:
- choose HTTP or HTTPS
- enter fixed public IPv4
- enter port
- optional base path
- optional API key/shared secret
- change API header/prefix
- configure status/station/playlist/nowplaying paths
- test connection
- fetch stations

Security model for this prototype:
- public URL/port/path settings are stored in browser localStorage
- the API key is NOT stored in localStorage
- the API key is kept only in sessionStorage for the current browser session
- the Vercel manual proxy allows GET/read-only tests only
- private/local IP ranges are blocked server-side to reduce SSRF risk
- redirects are blocked
- requests have a short timeout
- playlist writes are not exposed through this easy setup yet

This is intentionally a safe testing bridge. Persistent shared secrets and real production RBAC will move to Supabase/Auth or another secured backend later.


## 0.8.1 — Vercel Node runtime + diagnostics
- All `/api/radio/**` routes now explicitly use the Node.js runtime.
- Adds a raw TCP connection test before HTTP fetch.
- Shows TCP timeout/refused vs HTTP/auth/API errors separately.
- Shows target URL, phase, TCP duration, error code, Node version and Vercel region.
