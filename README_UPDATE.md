# PULSE 0.30.1 UPDATE

Deze update bouwt voort op 0.29.0 en maakt van de eigen PostgreSQL-server een **beheerde PULSE Docker-server**. Het doel is dat je in PULSE zelf geen databasewachtwoord, PostgreSQL-host of interne Docker-structuur meer hoeft te beheren.

## Nieuw: beheerde PULSE Docker-server

Nieuwe map:

```text
server/pulse-docker/
```

Belangrijkste bestanden:

- `INSTALL_PULSE_DOCKER.ps1` — Windows installer;
- `INSTALL_PULSE_DOCKER.sh` — Linux installer;
- `docker-compose.yml` — PostgreSQL + Data Gateway + optionele Caddy HTTPS;
- `UPDATE_PULSE_DOCKER.ps1` — serverupdate;
- `REPAIR_PULSE_DOCKER.ps1` — healthcheck/reparatiehulp;
- `BACKUP_PULSE_DOCKER.ps1` — PostgreSQL-backup;
- `PULSE_SERVER_KOPPELING.txt` — wordt door de installer gemaakt en bevat alleen de gegevens die je in PULSE nodig hebt.

De installer genereert zelf:

- een sterk PostgreSQL-wachtwoord;
- database `pulse`;
- databasegebruiker `pulse_app`;
- Gateway setup-code;
- 256-bit Gateway master key;
- intern Docker-netwerk;
- PostgreSQL-volume;
- PULSE-bestandsvolume;
- Gateway-statevolume.

**PostgreSQL-poort 5432 wordt niet naar buiten gepubliceerd.**

## Nieuwe database-interface

`components/modules/database-backend-v2.tsx` heeft nu twee modi.

### 1. Beheerde PULSE Docker-server — aanbevolen

In PULSE vul je bij de eerste koppeling alleen in:

1. **PULSE Data Gateway URL**;
2. **eenmalige server setup-code**.

Na een succesvolle koppeling is de setup-code niet meer nodig; de Gateway vertrouwt daarna alleen geldige Supabase-superadmin sessies van jouw PULSE-project. Host, poort, databasegebruiker en databasewachtwoord worden automatisch server-side beheerd.

De knop **Omschakelen naar eigen PostgreSQL** voert daarna uit:

```text
Gateway controleren
→ beheerde PostgreSQL testen
→ schema voorbereiden
→ Supabase user-UUID mirror maken
→ alle PULSE-tabellen kopiëren
→ constraints/indexen controleren
→ PULSE-doelmigraties uitvoeren
→ aantallen vergelijken
→ bijlagen migreren
→ finale sync
→ eigen PostgreSQL activeren
```

Supabase Auth blijft actief voor login, sessies en wachtwoorden.

### 2. Bestaande PostgreSQL-server — gevorderd

Alleen als je bewust een andere PostgreSQL-instance wilt gebruiken, verschijnen opnieuw host, poort, database, gebruiker, wachtwoord en SSL.

## Gateway 0.30

De PULSE Data Gateway ondersteunt nu ook `PULSE_POSTGRES_AUTOCONFIG=1`.

In die modus leest de Gateway zijn databasewachtwoord rechtstreeks uit een Docker secret. Het wachtwoord komt dus nooit in:

- de browser;
- Supabase-tabellen;
- `NEXT_PUBLIC_*` variabelen;
- de PULSE frontend build.

Nieuw endpoint:

```text
POST /admin/postgres/managed-test
```

Dit test de door PULSE zelf beheerde Docker-PostgreSQL zonder dat de browser databasecredentials moet meesturen.

## HTTPS

Voor een PULSE-webapp die via HTTPS/Vercel draait, moet de Gateway extern ook via HTTPS bereikbaar zijn. De Docker-bundle bevat daarom optioneel Caddy voor automatische TLS. PostgreSQL zelf blijft uitsluitend op het interne Docker-netwerk.

## Database

Nieuwe migratie:

```text
056_managed_docker_backend.sql
```

De huidige gekoppelde PULSE-Supabase is reeds voorbereid op deze 0.30 metadata.

## Andere opmerkingen blijven behouden

0.30 bevat ook opnieuw de eerdere 0.28/0.29-functionaliteit:

- correcte hitlijsthistoriek (`NEW`, vorige positie, trend, weken, peak);
- historische/bulk Excel-import per week;
- automatische herberekening wanneer een oudere week later wordt toegevoegd;
- privé-, hitlijstbeheer- en teamupdates;
- privé/interne/teamupdates voor Aanvragen & ideeën;
- Lezers & Polls bij officiële communicatie;
- moduletoegang per gebruiker;
- Bug Reports;
- programmeringsperiodes en beschikbaarheid;
- voorbereiding voor toekomstige automatische PostgreSQL-migraties;
- Supabase Auth blijft de identiteitsbron.

## Installatie

1. Kopieer deze UPDATE over de bestaande PULSE-bronboom.
2. Deploy de webapp opnieuw.
3. Op de nieuwe server: open `server/pulse-docker/`.
4. Start `INSTALL_PULSE_DOCKER.ps1` (Windows) of `INSTALL_PULSE_DOCKER.sh` (Linux).
5. Neem Gateway URL + setup-code uit `PULSE_SERVER_KOPPELING.txt`.
6. Ga in PULSE naar **Beheer → Database-backend**.
7. Kies **Beheerde PULSE Docker-server**.
8. Vul alleen Gateway URL + setup-code in.
9. Klik **Omschakelen naar eigen PostgreSQL**.

## 0.30.1 — domein/URL wisselen zonder datamigratie

- Nieuwe centrale `public_site_url` voor de website waarop gebruikers PULSE openen.
- De bestaande `gateway_url` blijft centraal instelbaar en is niet hardcoded in PULSE-modules.
- Gateway-CORS kan vanuit Beheer live worden bijgewerkt; oud en nieuw domein kunnen tijdens een verhuis tijdelijk tegelijk toegelaten worden.
- Een domeinwissel verandert **geen** PostgreSQL-data, gebruikers-UUID's of Supabase Auth-accounts.
- Nieuwe Supabase Auth callback wordt in Beheer getoond als `<nieuwe-site>/auth/callback`.
- Dockerpakket bevat `SET_PULSE_URLS.ps1` en `SET_PULSE_URLS.sh` voor een nieuwe Gateway-domeinnaam/HTTPS-configuratie zonder verlies van volumes.
- De PostgreSQL-container blijft intern; alleen de Gateway-URL kan publiek veranderen.

Let op: PULSE kan de eigen configuratie/CORS aanpassen, maar DNS/Vercel en de toegestane Supabase Auth redirect-URL moeten uiteraard ook naar het nieuwe domein wijzen.

Voor integratie in de volledige bron is ook `scripts/pulse-url-audit.mjs` toegevoegd. Interne PULSE-links horen relatief te blijven (`/hub/...`, `/auth/callback`) zodat een sitewissel nooit zoeken/vervangen door React-bestanden vereist.
