# PULSE 0.32.0 — FULL / GITHUB READY

Deze release is gebouwd op de volledige `vlacora-hub.zip` en is geen overlay-update.

## Belangrijkste integraties

- Beheer gebruikt daadwerkelijk `DatabaseBackendV2` (oude databaseplan-interface verwijderd uit de actieve route).
- PULSE Docker/Gateway-bundle uit de uitgebreide 0.31-serverlijn is mee opgenomen onder `server/`.
- Supabase Auth blijft de vaste login/identiteitslaag.
- Nieuwe zichtbare module **Beschikbaarheid** met:
  - Mijn standaardweek
  - uitzonderingen per datum
  - prikmomenten
  - Events & specials (Top 1000, Top 500, Ibiza 100, …)
  - rollen en shifts
  - shiftbevestiging
  - koppeling aan een hitlijst
  - teamplanning voor beheerders
- Hitlijsten:
  - meerdere historische Excel-weken tegelijk importeren
  - automatische chronologische herberekening
  - vorige positie / stijger / daler / weken / peak
  - editie-updates met Privé / Hitlijstbeheer / Team
  - update/notitie per song
  - rechtstreekse knop naar eventbeschikbaarheid
- Nieuwe schemafiles `058_availability_events_full.sql` en Gateway target migration `0007_availability_event_runtime.sql`.

## Installatie webapp

1. Pak deze ZIP uit.
2. Controleer `.env.example` en zet in Vercel alleen de Supabase Auth public values.
3. Push de volledige map naar GitHub.
4. Deploy op Vercel.
5. Open **Beheer → Database-backend** als superadmin voor de eigen servermigratie.

## Docker server

Zie `docs/PULSE_SERVER_0.31/HANDLEIDING/HANDLEIDING_PULSE_SERVER.pdf` en `server/pulse-docker/`.

## Validatie

- PULSE prebuild-check: OK.
- 84 TS/TSX-bronbestanden syntactisch getranspileerd: OK.
- Gateway Node syntax: OK.
- Bash scripts: OK.
- Docker Compose YAML: OK.
- Oude actieve databaseplan-interface: verwijderd.

Een volledige `next build` kon in deze buildomgeving niet lokaal uitgevoerd worden omdat npm dependency-installatie hier geen registry-download voltooide. Vercel zal met de meegeleverde `package.json` de echte dependency- en TypeScript-build uitvoeren.
