# VLACORA HUB 0.24.2

VLACORA HUB is de zelfstandige organisatie-, programmatie-, redactie- en social-HUB. Deze editie werkt **zonder Playout One, Rotation One, SHOUTcast/listenerstatistieken of een andere playout-engine**.

Zie `VERSION.txt` voor de release-inhoud en `VALIDATION_0.24.2.txt` voor de uitgevoerde controles.

## Belangrijkste modules

- Supabase-login, accounts, rollen en rechten
- Standalone zenderbeheer door de superadmin
- Taken, meldpunt, meldingen en officiële communicatie
- Messenger + generieke downloadbare bijlagen
- Agenda: privé persoonlijk, gedeeld per zender en VLACORA-breed
- Programmering en visuele programmapagina’s
- Programmateams gekoppeld aan echte Supabase-accounts
- DJ-/presentatorfoto’s en programma-covers
- Afwezigheden, impactanalyse en vervangpresentator
- Redactie met Talk-items en versiegeschiedenis
- Muziekvergaderingen en muziek-/format-/playlistvoorstellen
- Hitlijsten: weeklijsten, historische lijsten, jaar-/speciale lijsten en Excel-import
- Social Studio voor dagelijkse content + apart Social beheer en een laag-gebaseerde Templatebouwer
- Team, contacten, templates en superadminbeheer

## Opslag

Supabase blijft voorlopig de backend:

```text
Browser / VLACORA HUB
        |
        +-- Supabase Auth (login en user-ID's)
        +-- Supabase PostgreSQL (HUB-data)
        `-- Supabase Storage (bestanden/foto's)
```

Belangrijke HUB-data is centraal. Browseropslag mag alleen als tijdelijke cache/fallback dienen, niet als bron van waarheid voor zenders of accountkoppelingen.

### Persoonlijke agenda

Een persoonlijk agenda-item heeft `scope = personal` en is via PostgreSQL RLS uitsluitend leesbaar voor `owner_user_id = auth.uid()`. Beheerders krijgen **geen bypass** naar andermans persoonlijke agenda. Zender- en VLACORA-agenda’s zijn aparte gedeelde scopes.

### Programma’s en accounts

Programma’s worden gekoppeld aan echte accounts in `hub_program_team`. De primaire presentator en extra teamleden/co-presentatoren worden dus op Supabase user-ID gekoppeld. Daardoor werken “Mijn programma”, “Mijn uitzending”, afwezigheid en vervanging onafhankelijk van een los tekstveld met een naam.

### Bijlagen

Generieke HUB-bijlagen worden geregistreerd in `hub_attachments` en opgeslagen in de private Storage-bucket `vlacora-hub-files`. Dezelfde infrastructuur kan worden gebruikt bij Messenger, meldpunt, taken, aanvragen, redactie, socials, officiële communicatie en muziek-/formatvoorstellen.

## Supabase setup / upgrade

Voor een bestaande database: pas de nog niet uitgevoerde migraties in numerieke volgorde toe, tot en met:

```text
supabase/migrations/037_hitlist_song_memory.sql
```

Op het momenteel gekoppelde Supabase-project zijn de 0.23.x databasewijzigingen al toegepast.

Voor een nieuwe installatie: voer alle behouden migraties in numerieke volgorde uit.

## Environment

Configureer:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Supabase Auth is verplicht voor `/hub`. Service-role keys en databasewachtwoorden mogen nooit in `NEXT_PUBLIC_*` terechtkomen.

## Development

```bash
npm install
npm run dev
```

Productiecontrole:

```bash
npm run build
```

## Toekomstige eigen PostgreSQL-backend

De applicatiedata kan later achter een server-side datalaag naar een eigen PostgreSQL-server verhuizen terwijl Supabase Auth de user-identiteit blijft leveren. Databasewachtwoorden worden nooit in de browser bewaard. Oude Supabase-applicatiedata mag pas worden verwijderd nadat schema, data, delta-sync en rollback zijn gecontroleerd.

Zie `docs/ARCHITECTURE.md`.


## 0.23.3 build guard

`npm run build` voert eerst `scripts/prebuild-check.mjs` uit. Die controleert alle App Router `route.ts`-handlers op de expliciete native `globalThis.Request` signature en controleert de bekende Autoprefixer `start/end` valkuil.

## 0.24.2 — Hitlijst Sheet, Beheercentrum en Social Template Builder

De hitlijstmodule werkt nu als een compacte spreadsheet: rechtstreeks rijen bewerken, verslepen en songs opnieuw kiezen uit een centraal songgeheugen. Het geheugen combineert eerdere hitlijsten en de VLACORA muziekbibliotheek en wordt persistent opgeslagen per station.

Beheerfuncties staan voortaan in een apart **BEHEER**-blok in de zijbalk. Hitlijstbeheer, Social beheer en de nieuwe Templatebouwer zijn daar afzonderlijke onderdelen, naast het bestaande zender-, team- en algemene beheer.

Social Studio is bewust gesplitst: de dagelijkse contentworkflow blijft eenvoudig, terwijl grafische templates in een aparte builder met canvas/lagen worden beheerd. De startertemplates verschillen wezenlijk van elkaar en kunnen per station verder worden aangepast.

Voor een bestaande database voer je `supabase/migrations/037_hitlist_song_memory.sql` uit. Op de actieve VLACORA Supabase kan deze migratie vooraf worden toegepast.


### 0.24.2 build hardening

De Templatebouwer gebruikt één generieke pointer-handler voor canvaslagen en resize-handles, zodat DIV- en SPAN-events typeveilig dezelfde drag/resize-logica kunnen gebruiken. De prebuild voert op een normale installatie/Vercel bovendien eerst `tsc --noEmit` uit. Zo worden alle TypeScript-fouten in één controle gemeld vóór Next.js aan de productiebuild begint.
