# PULSE Server 0.32.0 — Docker

Dit is de productie-stack voor de eigen PULSE-dataomgeving.

## Wat draait er?

- **PostgreSQL 17** — alle persistente PULSE-data na omschakeling.
- **PostgREST** — interne Data API boven PostgreSQL; niet publiek gepubliceerd.
- **PULSE Data Gateway** — valideert Supabase Auth JWT's, voert migraties uit, proxyt de Data API en beheert bestanden.
- **Caddy** — optionele HTTPS reverse proxy voor de Gateway.

PostgreSQL-poort 5432 en PostgREST-poort 3000 worden niet naar buiten gepubliceerd.

## Windows snelstart

1. Installeer Docker Desktop / Docker Engine.
2. Pak deze map uit op de server.
3. Start `QUICK_SETUP_WINDOWS.cmd` als administrator.
4. Vul alleen in wat de wizard vraagt: PULSE-site-URL, Supabase Auth URL + publishable key en (productie) Gateway-domein.
5. Het script genereert zelf databasewachtwoord, Gateway setup-code, master key, PostgREST signing secret, volumes en configuratie.
6. Open daarna `PULSE_SERVER_KOPPELING.txt` en vul Gateway URL + eenmalige setup-code in bij **PULSE → Beheer → Database-backend**.

## Linux snelstart

```bash
chmod +x scripts/*.sh
sudo ./scripts/INSTALL_PULSE_DOCKER.sh
```

## Belangrijk

- Supabase blijft de login-/identiteitsprovider.
- De eigen server bewaart geen Supabase-wachtwoorden, password hashes of refresh tokens.
- Bij migratie worden PULSE-tabellen, relaties, indexen, relevante functies, triggers, RLS-beleid en PULSE Storage-assets gecontroleerd overgezet.
- De oude Supabase-data wordt bij de eerste omschakeling niet verwijderd, zodat rollback mogelijk blijft.
