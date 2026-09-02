
# VLACORA HUB 0.20.0 — New chat handoff

Gebruik dit bestand wanneer de ontwikkeling in een nieuwe ChatGPT-chat wordt voortgezet.

## Baseline
- Repo: Next.js 14 + TypeScript
- Deploy: GitHub -> Vercel
- Central data: Supabase Auth/Postgres/Realtime
- Rotation One: source of truth voor stations, muziek, playlists/schedules, hitlijsten
- Playout One: source of truth voor live engine/NOW/NEXT/queue/encoder/stream
- SHOUTcast: public listener/statistics source
- VLACORA: collaboration, editorial, tasks, workflows, operations

## Version 0.20.0
New:
- Mijn uitzending
- Voor mij
- Afwezigheden & vervanging
- Contacten
- Programma-pagina's
- Content-inbox
- Universeel zoeken (Ctrl+K)
- Operationele waarschuwingen
- Programmateam security hardening

## Cost rule
Keep Vercel/Supabase/serverless/realtime/storage/transfer usage low.
Do not add unnecessary polling.
Presence should remain Realtime-based.
Traffic is only fetched when explicitly requested.
Operational checks are throttled/event-oriented.

## Editorial baseline
0.19.9 persistence must not regress:
- VLACORA talks survive Rotation One refreshes
- full workspace stored per station/date/hour
- rich-text HTML is preserved
- autosave + explicit Save
- traffic stays on demand

## Supabase production migrations already applied
- operations_suite_core
- operations_suite_role_alignment
- operations_program_team_security

## Release policy
For every next release provide:
1. FULL/GITHUB_READY ZIP
2. PATCH/UPDATE ZIP
Do not overwrite existing station data, settings, secrets, playlists or Supabase content.
