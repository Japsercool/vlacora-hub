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


## 0.9.0 — Live Radio Data
- Radio API module no longer has demo mode or fake stations/now-playing.
- Rotation One station discovery is cached from the real `/api/v1/stations` response.
- Redactie starts with an empty playlist and loads the real Rotation One schedule for the selected hour.
- Rotation schedule defaults now match the verified API: `/api/v1/health`, `/api/v1/stations`, `/api/v1/stations/{stationId}/schedule`, coverage and revision.
- Real station mapping is shared between Radio API and Redactie.
- Generic read-only Vercel Node proxy added for real configured endpoints.
- Playout One is prepared for the same flow, but its exact public Hub/API endpoints must be confirmed per build. No fake Playout data is shown.
- Remote writes remain disabled until the read path and production authentication are fully validated.


## 0.9.1 — Native HTTP transport fix
- Replaces Node/undici `fetch()` for browser-configured radio reads with native `node:http` / `node:https`.
- Sends `Connection: close` for compatibility with self-hosted Rotation One APIs.
- Removes the extra TCP preflight before a normal successful request; TCP is only probed after an HTTP failure.
- Increases read timeout to 20–25 seconds.
- Error code `20` is no longer shown as if it were an HTTP status; timeouts are reported as `ETIMEDOUT` / `HTTP timeout`.
- Live station and schedule reads use the same native transport.

## 0.10.0 — Live Stations, Programmering, Music Folder PDF & Login

### Rotation One becomes the HUB station registry
- `GET /api/v1/stations` is now the canonical source for the station selector.
- After **Stations ophalen**, every real Rotation One station becomes a VLACORA station option.
- No static Versuz/Club FM demo station list is required for the radio modules.
- If Supabase is active, the discovered Rotation One station registry is also synchronized to the team cloud so another logged-in browser can load the same station list.

### Programmering
- New station-specific editable weekly programming screen.
- Add, edit, duplicate and remove programs.
- Set start/end, presenter/team, format, notes and active state.
- Copy a complete day to another weekday.
- Works locally without Supabase.
- When real login/Supabase is active, programming is synchronized to `station_programs` for the logged-in team.
- This is the VLACORA editorial/program schedule. It does **not** invent a Rotation One write endpoint; sending programming changes back into Rotation One must wait for a confirmed writable API contract.

### Rotation One music folder -> PDF
- Music-folder PDF has a **Rotation One live** source.
- It can request a real folder list, show the folders in a dropdown, request the real songs for the selected folder and generate the branded PDF from those songs.
- The public Rotation One endpoints confirmed so far expose stations/schedules, but no confirmed database-folder REST route is included in the available integration evidence.
- Therefore VLACORA deliberately leaves these two paths configurable instead of guessing them:
  - Music folders path
  - Songs in folder path (`{folderId}` supported)
- Once Rotation One exposes those two read endpoints, the HUB flow is already prepared.

### Real team login — Supabase Auth
- Cookie-based Supabase Auth protects `/hub/*` once configured.
- Open signup is not exposed; create team accounts in Supabase Auth.
- No service-role secret is needed in this build.
- The Supabase project must be fixed globally for the deployment; otherwise a fresh browser could bypass a cookie-only setup.
- Configure it with either:
  - Vercel: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, or
  - edit the public values in `lib/supabase/public-config.ts` before pushing.
- These are public client values; never put a service-role key there.
- Run `supabase/migrations/010_vlacora_hub_core.sql` once in the Supabase SQL Editor. It creates profiles, the shared Rotation station registry and shared programming tables with authenticated-team RLS policies.

### Playout One
- Playout One remains a separate station mapping per HUB station for actual on-air state (now/next, engine/player/stream status).
- No guessed Playout endpoints are added. Configure the exact public endpoints from the actual Playout One build when confirmed.


## 0.11.0 — Volledige Hitlijsten

Hitlijsten zijn niet langer een vaste demo Top 50. Per echt station kun je nu meerdere lijsten en edities beheren.

Functies:
- nieuwe Top 10/20/30/40/50/100/500 of andere editie aanmaken
- lijstnaam, editie, publicatiedatum en geldigheid van/tot beheren
- koppelen aan een programma uit Programmering
- vorige editie koppelen voor automatische vorige positie, trend, weken en peak
- volgende editie maken met huidige rangschikking als startpunt
- songs toevoegen uit VLACORA Muziek, uit een ingestelde Rotation One-map, handmatig of via Excel/bulk paste
- dubbele songs blokkeren
- rangschikking slepen of met pijlen wijzigen
- concept, gepubliceerd en archief
- PDF en CSV export
- meerdere lijsten per station, bijvoorbeeld TOP 50, Ibiza 100, Jaarlijst en specials
- optionele Supabase Teamcloud synchronisatie via migration `011_hitlists.sql`

### Supabase
Als Supabase al actief is, voer ook `supabase/migrations/011_hitlists.sql` uit. Zonder Supabase blijft de editor lokaal bruikbaar.


## 0.12.0 — Rotation One Chart Bridge

Hitlijsten kunnen nu uit Rotation One komen in plaats van uit demo/lokale brondata.

Workflow:
- Hitlijsten → `↻ Rotation One`
- één chart kiezen
- alleen edities van die chart ophalen
- één editie openen in de bestaande VLACORA editor
- lokale wijzigingen krijgen een duidelijke `LOKAAL GEWIJZIGD` status
- terugschrijven is alleen mogelijk als:
  1. Supabase-login echt actief is;
  2. de gebruiker ingelogd is;
  3. `Hitlijsten terugschrijven` expliciet is ingeschakeld;
  4. Rotation One het write-endpoint ondersteunt.

Resource policy:
- no continuous chart polling
- optional lightweight revision check
- lazy loading of editions/details
- no full Top 500 download until the operator opens that edition

Rotation One server contract:
`docs/ROTATION_ONE_CHART_API_CONTRACT.md`


## 0.13.0 — Live Collaboration & Required Notifications

This release turns the old decorative bell into a real collaboration layer.

### Live presence — who is doing what
- one Supabase Realtime Presence channel per open HUB session
- shows user, station, module and selected work item
- instrumented editors:
  - Programmering: selected program + time
  - Hitlijsten: chart + edition
  - Muziek: selected song
  - Redactie/Playlists: selected playlist item + hour
- presence is ephemeral: it is NOT written to Postgres on every click
- local BroadcastChannel fallback in setup mode

### Real notifications
- notification drawer behind the bell
- dedicated `Meldingen` page
- unread count is real, not a hard-coded badge
- read state is personal per logged-in user
- realtime inserts/receipt updates through the same collaboration channel
- official communication can create a notification
- high-severity incident automatically creates a critical notification

### "Moet je zien"
Official communication can be marked **Moet iedereen gezien hebben**.
Such a notification:
- opens as a blocking required-notification dialog
- cannot be dismissed with X/backdrop
- disappears only after `Ik heb dit gezien & bevestigd`
- stores acknowledgement per user

### TODAY
Dashboard navigation is now labelled `TODAY` and includes:
- personal important/unread notifications
- required acknowledgement count
- live team activity / who is working on what

### Resource policy
Designed specifically to stay light on free-tier limits:
- no presence database writes
- no notification polling loop
- one realtime channel per open HUB session
- maximum 100 recent notifications loaded
- realtime refresh only when a notification or receipt actually changes

### Supabase
Run:
`supabase/migrations/013_collaboration_notifications.sql`

This creates:
- `station_memberships`
- `hub_notifications`
- `hub_notification_receipts`
- RLS policies
- Realtime publication for the two small notification tables

Without Supabase the UI still works in local/setup mode, but cross-device presence and team-wide notifications require Supabase Auth + this migration.


## 0.13.1 — Playout One 0.11.19 defaults
Nieuwe Playout One-koppelingen gebruiken standaard Hub-poort `5099` met `/api/v1/integration/health`, `/api/v1/integration/stations` en `/api/v1/integration/stations/{stationId}/status`. Hierdoor werkt Test verbinding / Stations ophalen / NOW-NEXT direct met Playout One 0.11.19.


## 0.13.2 — Wachtwoord vergeten

De echte Supabase-teamlogin heeft nu volledig wachtwoordherstel:

1. `Wachtwoord vergeten?` op `/login`
2. gebruiker vult e-mailadres in
3. Supabase Auth stuurt een recovery mail
4. recovery-link landt via `/auth/callback?next=/reset-password`
5. VLACORA wisselt de PKCE-code in voor de eigen sessie
6. gebruiker kiest een nieuw wachtwoord
7. na opslaan gaat de gebruiker terug naar de HUB

Security:
- login blijft een gesloten teamlogin; er is geen registratieknop
- de UI zegt nooit of een ingevoerd e-mailadres wel/niet bestaat
- resetmail heeft client-side 60s cooldown tegen per ongeluk spammen
- resetlink gebruikt de bestaande Supabase Auth recovery-flow
- minimaal 10 tekens voor het nieuwe wachtwoord
- geen service-role key nodig

Free-tier policy:
Wachtwoordherstel maakt alleen een Auth-call wanneer iemand expliciet een resetmail vraagt.
Er is geen polling, background job of extra database-opslag. Houd wel rekening met de normale
Auth/e-mail rate limits van je gekozen Supabase mailconfiguratie.


## 0.13.3 — Supabase project preconfigured

The public Supabase project URL and publishable key are filled in under:

`lib/supabase/public-config.ts`

No service-role/admin secret is embedded.

Database migrations have been prepared/applied on the connected Supabase project for:
- profiles
- radio_stations
- station_programs
- hitlists
- station_memberships
- hub_notifications
- hub_notification_receipts
- realtime publication for notifications/receipts

Still configure in Supabase Dashboard:
- Authentication → URL Configuration → Site URL
- allowed redirect URL ending in `/auth/callback**`
- Auth users / invitations


## 0.14.0 — Centrale instellingen, echt team, meldpunt-workflow, sjablonen & SHOUTcast

### Instellingen blijven behouden
- publieke Rotation One / Playout One integratieconfig staat centraal in `hub_settings`
- SHOUTcast-config is per station centraal opgeslagen
- stationinstellingen staan in Supabase in plaats van alleen in de browser
- bestaande lokale config wordt bij de eerste run waar mogelijk éénmalig naar Supabase gemigreerd
- API-secrets worden bewust niet als leesbare setting in Postgres/GitHub gezet

### Echte teamgebruikers
- Team & rechten leest echte Supabase Auth-gebruikers/profielen
- superadmin kan teamleden uitnodigen
- rol, functie, actief/inactief, stations en rechtenmatrix worden centraal opgeslagen
- wachtwoord-resetlink kan vanuit Team & rechten worden verstuurd
- station_memberships worden echt gebruikt door RLS
- huidige eigenaar is gekoppeld aan het echte Supabase-account

### Meldpunt
- workflow: Open → In behandeling → Wachten op info → Opgelost → Gesloten
- onbeperkt updates/tijdlijn per melding
- statusupdates, werknotities en oplossing blijven bewaard
- hoge/kritieke melding kan via de bestaande notification-laag onder de aandacht worden gebracht

### Sjablonen
- onbeperkt veel eigen velden via JSON
- veldtypes zoals tekst, lange tekst, nummer, datum, tijd, keuze en checkbox
- automatische regels: bij start, na X songs, na X items, op minuut, op tijdstip en bij einde
- voorbeeldregel “na de tweede song”
- regels zijn centraal en versie-onafhankelijk opgeslagen
- directe on-air writes blijven uit tot de specifieke Rotation/Playout write-API expliciet is toegestaan

### SHOUTcast luistercijfers
- per station eigen SHOUTcast v2 endpoint, standaard `/stats?sid=1&json=1`
- live listeners, piek, unieke listeners, gemiddelde luistertijd, bitrate en huidige song
- live refresh alleen wanneer relevante pagina/dashboard open is
- maximaal één database-sample per 10 minuten per station
- daggrafiek wordt uit die lichte samples opgebouwd

### Supabase
Productiemigraties voor deze release:
- `014_persistent_settings_team_incidents_templates.sql`
- `015_shoutcast_listener_samples.sql`
- `016_team_security_hardening.sql`
- `017_function_acl_hardening.sql`

Voor het gekoppelde VLACORA-project zijn deze migrations al toegepast.


## 0.14.1 — Vercel build fix

Vercel/Next.js type-checkte per ongeluk ook `supabase/functions/**/*.ts`.
Die bestanden draaien in de Supabase Deno runtime en gebruiken geldige Deno/npm-specifiers
zoals `npm:@supabase/supabase-js@2`, maar Next.js hoort ze niet te compileren.

Fix:
- `supabase/functions/**/*` toegevoegd aan `tsconfig.json -> exclude`
- de Edge Function blijft gewoon in de repository en blijft deploybaar naar Supabase
- geen wijziging aan de werkende Supabase functie of database


## 0.14.2 — Rotation + Playout + SHOUTcast zichtbaar per station

- Station mapping toont nu drie duidelijke koppelingen: Rotation One, Playout One en SHOUTcast.
- Als Playout One 0 stations teruggeeft, toont VLACORA expliciet of de Bearer-key ontbreekt of dat de stationslijst nog moet worden opgehaald.
- Extra knop `Playout stations ophalen` rechtstreeks op de mapping.
- Playout wordt automatisch gematcht op gelijk station-ID (bijvoorbeeld `hits` → `hits`) vóór naam-matching.
- SHOUTcast is geen aparte stationlijst: de host/poort/SID-config hoort per VLACORA-station. De mapping toont daarom de echte stream endpoint.
- `Test alle live koppelingen` test Rotation One, Playout One én SHOUTcast in één actie.
- Stationmapping wordt naast localStorage ook centraal in Supabase `hub_settings` bewaard, zodat hij niet verdwijnt bij deploys of op een andere pc.
- Geen extra achtergrondpolling: automatische Playout discovery gebeurt alleen als er nog geen cache is en er in de huidige sessie een API-key bestaat.

- Playout One station discovery wordt na een geslaagde fetch ook als publieke stationmetadata in Supabase `radio_stations` bewaard. Daardoor blijft de dropdown op andere toestellen zichtbaar zonder opnieuw discovery uit te voeren.


## 0.14.3 — Refresh fix

De refresh in stationmapping is herschreven:
- force refresh met no-store/no-cache
- Playout stations direct opnieuw uit Hub :5099
- dropdown wordt meteen vernieuwd
- automatische mapping wordt meteen opnieuw berekend en centraal opgeslagen
- duidelijke HTTP 401 / ontbrekende Bearer-key melding
- Playout stations uit Beheer worden ook centraal in Supabase gesynchroniseerd
- SHOUTcast “Nu vernieuwen” toont weer een echte laadstatus en haalt verse data
