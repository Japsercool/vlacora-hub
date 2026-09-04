# PULSE 0.29 — integratiecheck

## Wat deze UPDATE direct vervangt

`components/modules/database-backend-v2.tsx` heeft bewust dezelfde bestandsnaam als de 0.28-component. Wanneer 0.28 al in **Beheer** is aangesloten, verschijnt de nieuwe omschakelinterface dus zonder extra importwijziging.

De Supabase-migraties zijn zelfstandig/idempotent ontworpen. Op het actieve PULSE-project zijn de 0.29-databasewijzigingen al toegepast.

## Hitlijsten

De weekvergelijking zit nu ook **in de database**. Daardoor worden bestaande schermen die `previousPosition`, `weeks` en `peak` lezen meteen correct nadat de data opnieuw is opgehaald. Een oudere week achteraf toevoegen herberekent de hele reeks.

Voor de nieuwe bulkimport en privé/team-updates zijn losse UI-bouwstenen toegevoegd:

- `components/modules/hitlist-bulk-import-panel.tsx`
- `components/modules/hitlist-updates-panel.tsx`
- `lib/pulse/hitlist-bulk-import.ts`
- `lib/pulse/hitlist-history.ts`

Deze moeten in de hoofd-hitlijstmodule worden geplaatst wanneer die module niet in de UPDATE aanwezig is. De bulkimport hergebruikt bewust de bestaande single-file Excel-parser; er komt geen tweede, afwijkende parser bij.

## Aanvragen & ideeën

`components/modules/admin-request-thread.tsx` geeft een request een echte update/conversatiegeschiedenis met:

- privé antwoord aan de aanvrager;
- interne beheerupdate;
- teamupdate;
- antwoord van de oorspronkelijke aanvrager.

De database staat hiervoor al klaar via `hub_admin_request_updates`.

## Volledige PostgreSQL runtime-cutover

De Gateway kan schema, UUID-identiteitsmirror, data en bestanden daadwerkelijk migreren, aantallen verifiëren en de backendstatus omschakelen. **De webapp zelf moet daarnaast al haar gewone datareads/writes via één centrale PULSE-datalaag laten lopen.** Een module die nog rechtstreeks `supabase.from(...)` gebruikt, blijft anders Supabase aanspreken, ook al staat de Gateway op PostgreSQL.

Daarom zit `scripts/pulse-data-layer-audit.mjs` in deze update. Draai vanuit de volledige PULSE-bron:

```bash
node scripts/pulse-data-layer-audit.mjs
```

Voor een productiecutover hoort dit rapport schoon te zijn (Auth-code uitgezonderd). Dit is de laatste integratiestap die alleen tegen de **volledige actuele bronboom** betrouwbaar kan worden uitgevoerd; deze UPDATE bevat niet alle oorspronkelijke PULSE-modules.

## Geen auth-migratie

Op de eigen PostgreSQL wordt alleen een minimale `auth.users` identity mirror met de Supabase UUID aangemaakt zodat bestaande foreign keys geldig blijven. Er worden **geen wachtwoorden, password hashes, refresh tokens of Supabase-sessies** gekopieerd. `public.profiles` bevat de PULSE-profieldata en behoudt dezelfde UUID.
