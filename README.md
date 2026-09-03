# VLACORA HUB 0.22.2 — Standalone Team Hub

VLACORA HUB is an internal platform for radio-team organisation, editorial work and collaboration. This edition works **without any playout or rotation engine** and contains **no listener/stream statistics integration**.

## Main modules

- TODAY / personal inbox / notifications
- Standalone station management
- Tasks and responsibilities
- Incident/reporting workflow
- Admin requests and content inbox
- Messenger and official communication
- Central calendar: personal, per station and VLACORA-wide
- Programming and program pages
- Absences and contacts
- Templates
- Music library and music meetings
- Editorial preparation
- Traffic information on demand
- Hitlists
- Presenter workspace
- Social Studio with briefing, workflow, review and content calendar
- Team, roles and permissions
- Superadmin management

## Data storage

Supabase is currently used as the backend. Supabase stores HUB data in PostgreSQL and provides authentication and Row Level Security.

Important data is stored centrally. Browser storage may only be used as a temporary cache/fallback and is not the source of truth for stations, calendar items or social workflow data.

### Stations

Migration `029_standalone_stations.sql` adds `public.hub_stations`. A superadmin can manage stations from **Alle zenders → Beheer**.

### Central calendar

Migration `030_calendar_social_workflow.sql` adds a real PostgreSQL calendar with three levels:

- **Personal** — owned by one team member, optionally with invitees.
- **Station** — visible for the selected station.
- **VLACORA-wide** — organisation-level events.

Managers can use the **Per persoon** view. Scheduled Social Studio posts and music meetings are shown alongside the calendar without duplicating them into the calendar table.

### Social Studio 0.22

Social Studio now supports more than visuals/captions:

- platform selection (Instagram, Story, Facebook, TikTok, YouTube Shorts, LinkedIn)
- campaign and content pillar
- objective
- owner and reviewer
- internal deadline and publication time
- pre-publication checklist
- internal notes
- review / approval history
- publication URL after publishing
- targeted HUB notifications for reviewer/owner

No automatic Meta/TikTok publishing API is added in this release. This avoids extra provider dependencies, permissions, polling and possible recurring costs while the editorial workflow is being built out.

### Future PostgreSQL backend

The Beheer page contains the future database target configuration. Version 0.22.2 remains on Supabase; it does not expose or store a PostgreSQL password in the browser. A future external PostgreSQL connection URL belongs in a server-side secret such as `VLACORA_POSTGRES_URL`.

See `docs/ARCHITECTURE.md` for the migration design.

## Supabase setup / upgrade

For an existing 0.20.x database, run in order:

```text
supabase/migrations/029_standalone_stations.sql
supabase/migrations/030_calendar_social_workflow.sql
```

For an existing 0.21.0 database, only run:

```text
supabase/migrations/030_calendar_social_workflow.sql
```

For a fresh installation, apply the retained migrations in numerical order.

## Environment

Copy `.env.example` and configure:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Do not expose service-role keys or database passwords through `NEXT_PUBLIC_*` variables.

## Development

```bash
npm install
npm run dev
```

Production validation:

```bash
npm run build
```

## Version 0.22.2

**Build fixes:**
- behoudt de herstelde CSV/PDF-export uit 0.22.1;
- herstelt de typed return van het redactionele draaiboek (`saveEditorialWorkspace`);
- gebruikt `source_revision` consequent als `revision`;
- maakt de Social Studio reviewer-naamlookup strikt TypeScript-veilig met `Map<string,string>`.


- Central PostgreSQL calendar
- Personal / station / organisation agenda scopes
- Manager view per person
- Invitees on calendar events
- Social posts and music meetings surfaced in the central agenda
- Social owner/reviewer/deadline/campaign/platform workflow
- Social publishing checklist and internal notes
- Targeted social review notifications
- Fix: editing an existing planned social post no longer starts a blank replacement concept
- Supabase remains active; future PostgreSQL migration stays prepared
- Still no Playout/Rotation integration and no listener statistics
