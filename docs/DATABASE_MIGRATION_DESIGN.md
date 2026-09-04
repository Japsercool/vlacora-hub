# PULSE 0.29 — eigen PostgreSQL met Supabase Auth

## Doel

```text
PULSE browser
   |
   +-- Supabase Auth -------------------- blijft
   |     login / sessies / wachtwoorden / user UUID
   |
   `-- PULSE Data Gateway --------------- eigen server
          |
          +-- PostgreSQL ---------------- alle PULSE-appdata
          `-- File root ----------------- bijlagen/assets
```

De doel-PostgreSQL mag een gewone PostgreSQL-installatie zijn. Self-hosted Supabase is optioneel, niet verplicht.

## Eénknopsmigratie

De beheerinterface bevat zowel losse diagnostische stappen als één grote omschakelknop. De éénknopsflow doet eerst alle veiligheidscontroles en activeert pas na een geslaagde eindcontrole.

### Schema

De Gateway vraagt via de beveiligde Supabase RPC `pulse_export_catalog()` de actuele tabellen, kolomtypen, defaults, constraints en indexen op. Daardoor hoeft een nieuwe lege PostgreSQL niet vooraf handmatig ingericht te worden.

### Data

`pulse_export_table()` levert maximaal 1000 rijen per pagina. De Gateway importeert met `jsonb_populate_recordset`, zodat UUID, arrays, JSONB, timestamps en numerieke types behouden blijven.

### Controle

Voor elke tabel wordt bron/copy/doel bijgehouden. Een verschil in aantallen blokkeert de status `ready` en dus ook activering.

### Bestanden

`hub_attachments.storage_path` wordt gebruikt om private Supabase Storage-objecten naar `PULSE_FILE_ROOT` op de eigen server te kopiëren. Mislukte bestanden worden als waarschuwing bijgehouden zonder stil te verdwijnen.

## Rollback

Rollback schakelt de Gateway terug naar `supabase`. De gekopieerde PostgreSQL-data wordt niet verwijderd. Ook de oorspronkelijke Supabase-data wordt tijdens migratie nooit automatisch verwijderd.

## Updates na de eerste omschakeling

Doelmigraties staan in:

```text
server/pulse-data-gateway/migrations/*.sql
```

De Gateway registreert per bestand versie + SHA-256-checksum in:

```text
pulse_meta.schema_migrations
```

Ontbrekende migraties worden automatisch toegepast wanneer een reeds actieve externe backend start. Een reeds toegepaste migratie waarvan de inhoud achteraf werd gewijzigd, wordt bewust geweigerd om schema-drift te voorkomen.

## Belangrijke integratieregel

Nieuwe PULSE-modules moeten data via de centrale PULSE-datalaag benaderen. Supabase Auth mag rechtstreeks gebruikt blijven worden voor login/session, maar nieuwe appdata hoort niet opnieuw hard aan één Supabase-project gekoppeld te worden.
