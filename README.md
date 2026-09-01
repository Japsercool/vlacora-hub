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
