# VLACORA HUB architecture — standalone edition

VLACORA HUB 0.22.0 is a standalone editorial and organisation platform. It has no dependency on a playout engine, rotation engine, encoder, stream or listener-statistics provider.

## Current architecture

```text
Browser / VLACORA HUB
        |
        +-- Supabase Auth
        |
        +-- Supabase PostgreSQL
             |- hub_stations
             |- profiles / station_memberships
             |- hub_calendar_events / attendees
             |- tasks
             |- incidents / notifications
             |- programming / program pages
             |- editorial workspaces and templates
             |- music meetings / hitlists
             |- social studio / review workflow
             |- messenger / collaboration
             `- hub_settings
```

Supabase is currently the managed backend. PostgreSQL remains the data model and source of truth.

## Station management

Stations are owned by VLACORA itself in `public.hub_stations`. Only a `superadmin` may add, edit, activate/deactivate or delete a station. A station slug stays stable when the visible name changes.

## Calendar model

`hub_calendar_events` is intentionally independent of any playout system.

- `personal`: an owner plus optional attendees
- `station`: one station slug
- `organization`: all VLACORA users

The calendar UI can additionally surface source records such as Social Studio posts and music meetings. Those records are read from their own tables instead of being duplicated into `hub_calendar_events`.

This keeps writes low, avoids synchronisation loops and makes a later PostgreSQL move simpler.

## Social workflow

Social Studio stores production metadata directly on `hub_social_posts`: platforms, campaign, content pillar, objective, owner, reviewer, deadline, checklist, internal notes and publication URL. Review events stay append-only in `hub_social_review_events`.

The current release does not auto-publish to external social networks. A future connector can be added behind a server-side adapter without changing the core editorial data model.

## Future PostgreSQL migration

The superadmin screen contains a non-secret migration target configuration. A future external PostgreSQL password/connection URL must be configured server-side as a secret, never in the browser or ordinary database settings.

Intended migration flow:

1. Configure the future PostgreSQL target server-side.
2. Export/copy schema and data.
3. Run compatibility checks.
4. Put the HUB briefly in migration/read-only mode.
5. Perform final delta sync.
6. Activate the new backend from the superadmin migration workflow.
7. Keep rollback information until validation is complete.

Version 0.22.0 keeps Supabase active. The data model is deliberately PostgreSQL-oriented and avoids making core team data dependent on a playout engine or an external social provider.

## Cost / usage rule

VLACORA avoids constant polling. Data is loaded when a module opens, refreshed after writes, and Realtime is only used where collaboration benefits from it. Calendar source data is queried only for the visible month. Social assets are uploaded only when a user explicitly chooses a file.
