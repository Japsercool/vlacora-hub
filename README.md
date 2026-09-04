# PULSE 0.25.0

**PULSE** is de centrale workspace voor radio- en mediateams.

> **Your station. One team. All in sync.**

PULSE werkt standalone: geen Playout One, Rotation One, SHOUTcast/listenerstatistieken of andere playout-engine is vereist.

## Nieuw in 0.25.0

### Nieuwe merknaam en logo
- Productnaam: **PULSE**.
- Nieuw PULSE-logo in sidebar, login en browsermetadata.
- Zendernamen en bestaande Supabase-accounts blijven ongewijzigd.
- Technische database-/Storage-/RPC-identifiers met `vlacora_*` blijven bewust bestaan zodat bestaande data en deployments niet breken.

### Social Studio + mini-Canva Templatebouwer
- Dagelijkse Social Studio blijft gescheiden van templatebeheer.
- De Templatebouwer werkt als een compacte Canva-achtige editor met canvas, slepen, schalen, lagen, afbeeldingen, invulbare foto’s, vormen, tekst, placeholders, undo/redo en PNG-export.
- Afbeeldingen kunnen worden geüpload of rechtstreeks op het canvas worden gedropt.
- Tekstlagen hebben een echte lettertype-dropdown met preview, gewicht, grootte, uitlijning, regelhoogte, letterafstand, kleuren en outline.
- Nieuwe visueel verschillende starterontwerpen staan bovenaan de templatebibliotheek.

### Workflowbouwer
De vroegere algemene “Sjablonen” is verduidelijkt als **Workflowbouwer**. Een workflow is een herbruikbare blauwdruk voor bijvoorbeeld programma-voorbereiding, social briefing/review of meldpuntopvolging. Oude radio-achtige regels worden niet als kernwerking gebruikt.

### Officiële communicatiecategorieën
- Publicatiemodal gebruikt een echte categoriedropdown.
- Beheerders kunnen categorieën toevoegen, hernoemen, verbergen en verwijderen.
- Centrale categorieën gelden voor alle zenders; daarnaast kunnen zenders eigen categorieën hebben.
- Bestaande officiële berichten blijven hun categorienaam behouden wanneer een categorie later verwijderd wordt.

## Belangrijkste modules
- Supabase Auth, accounts, rollen en fijnmazige menurechten
- Stations en programmering
- Programmapagina’s en presentatorteams gekoppeld aan echte accounts
- Persoonlijke agenda (strikt privé via RLS), zenderagenda en organisatieagenda
- Taken, meldpunt + Meldpuntbeheer, Messenger en officiële communicatie
- Redactie met Talk-items en versiegeschiedenis
- Afwezigheden, impactanalyse en vervanging
- Muziekvergaderingen en muziek-/formatvoorstellen
- Hitlijsten met Excel-import, songgeheugen, historie, trends en speciale lijsten
- Social Studio, Social beheer, Assets en mini-Canva Templatebouwer
- Centrale downloadbare bijlagen

## Supabase
PULSE gebruikt voorlopig:

```text
Browser / PULSE
  ├─ Supabase Auth       (login + user-ID)
  ├─ Supabase PostgreSQL (applicatiedata)
  └─ Supabase Storage    (bestanden/foto's)
```

Voor een bestaande database moeten migraties t/m `040_communication_categories.sql` aanwezig zijn.

Environment:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

## Development

```bash
npm install
npm run dev
```

Productiecontrole:

```bash
npm run build
```

`npm run build` voert eerst de ingebouwde prebuild- en TypeScript-controles uit wanneer dependencies beschikbaar zijn.
