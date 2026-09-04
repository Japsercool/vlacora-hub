# PULSE architecture — standalone workspace

PULSE is een zelfstandige editorial/organisation workspace. De actieve applicatie heeft geen dependency op een playout-engine, rotation-engine, encoder, stream of listener-statistics provider.

## Huidige architectuur

```text
Browser / PULSE
        |
        +-- Supabase Auth
        |      `-- vaste user UUID / login
        |
        +-- Supabase PostgreSQL
        |      |- hub_stations
        |      |- profiles / station_memberships
        |      |- station_programs / hub_program_team
        |      |- hub_calendar_events
        |      |- hub_absences / hub_program_overrides
        |      |- editorial workspaces + versions
        |      |- hitlists / music proposals / meetings
        |      |- social workflow
        |      |- messenger / tasks / incidents
        |      `- official communication / settings
        |
        `-- Supabase Storage
               |- profile/program/social assets
               `- private generic HUB attachments
```

## Zenderbeheer

Zenders zijn PULSE-records in `public.hub_stations`. Alleen `superadmin` mag zenders aanmaken, wijzigen, activeren/deactiveren en verwijderen. Configuratie kan via `vlacora_clone_station_configuration(...)` per sectie naar een andere zender worden gekopieerd. Gebruikersaccounts zelf worden niet gekloond.

## Programma-identiteit

`station_programs` beschrijft het programma; `hub_program_team` koppelt echte Supabase user UUID's met rollen zoals hoofdpresentator en extra teamleden. “Mijn programma” en afwezigheidsimpact worden altijd via user-ID bepaald. Het vrije hosttekstveld is alleen een leesbare/compatibele weergave.

## Agenda/privacy

`hub_calendar_events` kent drie scopes:

- `personal`: uitsluitend de eigenaar; admins hebben geen lees-bypass;
- `station`: gedeeld met bevoegde leden van de zender;
- `organization`: PULSE-breed.

Bronitems zoals social planning en muziekmeetings kunnen in de UI worden samengevoegd zonder hun data dubbel in de agenda op te slaan.

## Afwezigheid/vervanging

Afwezigheden worden gekoppeld aan echte accounts. Impactregels en `hub_program_overrides` tonen per uitzenddatum of vervanging nodig is, de uitzending met overblijvend team kan doorgaan, of een vervanger bevestigd werd. Alleen bevoegde beheerrollen wijzigen de effectieve vervanging.

## Redactie en versiehistoriek

Editorial workspaces gebruiken Talk-items en bewaren wijzigingen in `hub_editorial_workspace_versions`. Versies zijn append-only historiek; de werkruimte blijft de actuele toestand.

## Social workflow

Social Studio is voor dagelijkse contentproductie; Social beheer is voor brand kit/assets en de aparte Templatebouwer werkt als mini-Canva met canvas, lagen, drag/drop, afbeeldingen, vormen, placeholders, lettertypekeuze en export. Automatische publicatie naar Meta/TikTok is bewust nog niet ingebouwd om extra provider-afhankelijkheid, tokens, polling en kosten te vermijden.

## Bestanden

`hub_attachments` bevat metadata/koppeling; de bytes staan in de private bucket `vlacora-hub-files`. Zo gebruikt PULSE één upload/download-infrastructuur in plaats van een aparte opslagimplementatie per module.

## Toekomstige PostgreSQL-migratie

Supabase Auth kan permanent blijven terwijl applicatiedata later naar een eigen PostgreSQL-server verhuist. De user UUID uit Supabase Auth blijft daarbij de referentie in de externe database.

Veilige omschakeling:

1. extern PostgreSQL-doel server-side configureren;
2. schema voorbereiden;
3. data kopiëren;
4. aantallen/constraints/referenties controleren;
5. korte read-only/finale delta-sync;
6. nieuwe backend activeren;
7. rollbackperiode behouden;
8. oude Supabase-applicatiedata pas daarna selectief verwijderen;
9. Supabase Auth-users nooit meenemen in die cleanup.

Secrets horen server-side, nooit in browser/localStorage of `NEXT_PUBLIC_*`.

## Kosten/usage

De HUB vermijdt constante polling. Data wordt geladen wanneer een module opent of na een relevante write; Realtime wordt alleen gebruikt waar samenwerking er werkelijk voordeel van heeft. Bestanden worden alleen geüpload op expliciete gebruikersactie. Dit beperkt database-, storage- en serverless-verbruik.
