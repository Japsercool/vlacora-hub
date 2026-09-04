# PULSE 0.28.1 UPDATE

Deze update voegt drie grote blokken toe aan de bestaande PULSE-bronboom.

## 1. Moduletoegang per gebruiker

`components/modules/module-access-matrix.tsx`

De matrix is bedoeld voor **Beheer > Team/Rechten**. Elke cel kan cyclisch ingesteld worden op:

- `Rol` — geen override; bestaande rol/rechten blijven leidend.
- `Kijken` — module zichtbaar, read-only.
- `Bewerken` — normale bewerking toegestaan.
- `Beheren` — volledige modulebeheerrechten.
- `Geblokkeerd` — module niet zichtbaar en niet toegankelijk.

Overrides worden opgeslagen in `hub_module_access_overrides` en hebben voorrang op de standaardrol.

## 2. Lezers & Polls

`components/modules/announcement-readers-panel.tsx`

Te plaatsen als tweede tab naast **Inhoud** bij officiële communicatie. Het paneel bevat:

- totaal aantal ontvangers;
- gelezen;
- bevestigd;
- geantwoord op poll;
- lijst met alle ontvangers en status;
- gesprek/reactie per ontvanger;
- polls en antwoorden.

Nieuwe tabellen:

- `hub_announcement_recipients`
- `hub_announcement_polls`
- `hub_announcement_poll_options`
- `hub_announcement_poll_votes`
- `hub_announcement_replies`

## 3. Eigen PostgreSQL als PULSE-data-backend

`components/modules/database-backend-v2.tsx`

Doelarchitectuur:

```text
Browser / PULSE
   |
   +-- Supabase Auth              (blijft)
   |      `-- user UUID/JWT
   |
   `-- PULSE Data Gateway         (eigen server)
          `-- PostgreSQL          (eigen server)
```

De browser verbindt **nooit rechtstreeks met PostgreSQL**. Database host/user/wachtwoord worden uitsluitend naar de Data Gateway gestuurd en daar lokaal versleuteld opgeslagen. Supabase bewaart alleen ongevaarlijke bootstrapinformatie zoals gateway-URL, databasenaam en status.

### Knoppen in de UI

1. **Verbinding testen** — test Gateway + PostgreSQL.
2. **Configuratie veilig opslaan** — laat de Gateway de DB-instellingen lokaal versleutelen.
3. **Migreren & controleren** — start kopieer-/verificatiejob.
4. **Activeren** — zet de data-backend pas om nadat verificatie geslaagd is.
5. **Rollback** — schakelt terug naar Supabase-data zolang rollback beschikbaar is.

Supabase Auth blijft altijd de identiteit leveren. Dezelfde `sub`/UUID wordt in de eigen PostgreSQL gebruikt.

## Integratie

De huidige volledige 0.25.0+ bron-ZIP is niet als fysiek bestand in deze chatruntime beschikbaar. Daarom bevat dit pakket de nieuwe/gewijzigde 0.28.1-bestanden als **overlay** en geen verzonnen kopie van de overige PULSE-bestanden.

Plaats de bestanden over de overeenkomstige bronboom. Voor de definitieve FULL_SOURCE-release moet deze overlay op de meest recente PULSE-ZIP worden toegepast en daarna met `npm run build` gevalideerd worden.


## 0.28.1 hotfix
- Fix voor Next.js/TypeScript TS2774 in de drie nieuwe clientmodules.
- `isSupabaseBrowserConfigured` is een functie en wordt nu correct aangeroepen als `isSupabaseBrowserConfigured()`.
