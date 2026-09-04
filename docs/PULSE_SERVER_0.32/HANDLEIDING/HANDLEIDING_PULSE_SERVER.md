# PULSE Server 0.31.0 - Volledige Docker handleiding

## 1. Doel van deze bundel
Deze bundel maakt een nieuwe PULSE-dataserver zo automatisch mogelijk. Het gewenste eindbeeld is: **Supabase Auth blijft login en identiteit doen; PULSE-data en bestanden draaien op je eigen server.** Jij hoeft voor de beheerde Docker-installatie geen PostgreSQL-database, gebruiker, wachtwoord of mapstructuur te ontwerpen.

## 2. Wat je vooraf nodig hebt
- een server waarop Docker + Docker Compose v2 werkt;
- de publieke URL van de PULSE website;
- de Supabase project/Auth URL;
- de Supabase publishable key;
- voor publieke productie een DNS-naam voor de Gateway, bv. `api.pulse.vlacora.be`;
- inkomende poorten 80/443 naar die server voor Caddy/HTTPS.

## 3. Wat de installer automatisch maakt
- PostgreSQL 17 container;
- database `pulse`;
- interne databaseuser `pulse_app`;
- cryptografisch random databasewachtwoord;
- PULSE Gateway setup-code;
- Gateway master key;
- Docker netwerk `pulse_internal`;
- PostgreSQL volume;
- `data/files`, `data/gateway`, `backups`, `logs`, `secrets`;
- Caddy reverse proxy voor HTTPS;
- koppelingstekst voor PULSE.

## 4. Architectuur
```text
PULSE WEBSITE
  |
  +--- Supabase Auth
  |      login / sessie / wachtwoorden / user UUID
  |
  +--- HTTPS ---> PULSE DATA GATEWAY
                   |
                   +--- PostgreSQL 17 in Docker
                   |      GEEN publieke 5432
                   |
                   +--- PULSE files op de server
```

De Gateway valideert de Supabase JWT en gebruikt de UUID voor PULSE-identiteit. De eigen database is dus geen tweede wachtwoorddatabase.

## 5. Windows installatie
1. Pak de ZIP uit, bv. `D:\PULSE-SERVER`.
2. Start Docker.
3. Rechtsklik `pulse-docker\QUICK_SETUP_WINDOWS.cmd` en kies uitvoeren als administrator.
4. Vul de PULSE site-URL in.
5. Vul Supabase Auth URL in.
6. Vul Supabase publishable key in.
7. Vul de Gateway-domeinnaam in voor productie.
8. Wacht tot PostgreSQL healthy is.
9. Open `PULSE_SERVER_KOPPELING.txt`.

Je hoeft geen databasewachtwoord in PULSE in te vullen.

## 6. Linux installatie
```bash
cd pulse-docker
chmod +x scripts/*.sh
./scripts/INSTALL_PULSE_DOCKER.sh
```

## 7. PULSE koppelen
Ga in PULSE naar Beheer > Database-backend. Kies de beheerde Docker-server. Vul alleen Gateway URL en de setup-code uit `PULSE_SERVER_KOPPELING.txt` in.

## 8. Migratievolgorde
**Nooit meteen omschakelen.** Gebruik: testen -> preflight -> voorbereiden -> eerste migratie -> controle -> finale sync -> omschakelen. De migratie vergelijkt rijaantallen en blokkeert bij file-copy fouten.

## 9. Hitlijsten en nieuwe PULSE-data
De nieuwe database krijgt dezelfde PULSE-tabellen en de draagbare doelmigraties, waaronder hitlijstgeschiedenis, privé/team updates, aanvraagthreads en domeinruntime. Toekomstige releases voegen nieuwe genummerde SQL-doelmigraties toe.

## 10. Rollback
Rollback zet de actieve backendstatus terug op Supabase maar verwijdert de eigen PostgreSQL-data niet. Daardoor kun je eerst veilig testen.

## 11. Backup
Voer `BACKUP_PULSE_DOCKER` uit. De backup bevat een PostgreSQL dump, PULSE files, Gateway state en - voor volledige recovery - recovery secrets. SHA256 checksums worden toegevoegd.

## 12. Restore
Gebruik `RESTORE_PULSE_DOCKER` en typ expliciet `HERSTEL`. De database en files worden hersteld en de containers opnieuw gestart.

## 13. Automatische dagelijkse backup
Windows: `INSTALL_BACKUP_SCHEDULE.ps1`. Linux: `INSTALL_BACKUP_SCHEDULE.sh`. Standaard 03:00. Retentie standaard 30 dagen.

## 14. Updates
Gebruik `UPDATE_PULSE_DOCKER`. Dat maakt standaard eerst een backup. De Gateway controleert target migrations op checksum en past ontbrekende migraties toe.

## 15. Domein wijzigen
Gebruik `SET_PULSE_URLS`. Een nieuwe website-URL vereist geen databaseverhuizing. Vergeet de nieuwe `/auth/callback` in Supabase Auth redirects niet.

## 16. Security
De databasepoort wordt niet gepubliceerd. Secrets staan alleen in de servermap. De Gateway container is read-only en draait met capabilities gedropt. Productie gebruikt Caddy HTTPS.

## 17. Diagnostiek
`EXPORT_DIAGNOSTICS` maakt een supportpakket met logs, versions en redacted env. Secretbestanden worden niet toegevoegd.

## 18. Webapp go-live audit
Een database-omschakeling is pas echt compleet als alle PULSE modules via de centrale datalaag lopen. Gebruik `AUDIT_PULSE_WEBAPP` op de volledige bron. Directe `supabase.from()` of Storage calls zijn een go-live blokkering voor die module.

## 19. Wat Supabase blijft doen
Supabase Auth blijft gebruikers aanmelden, JWT's uitgeven, password reset doen en sessies beheren. Die informatie wordt niet naar PostgreSQL Docker gekopieerd.

## 20. Noodherstel
Op een nieuwe server: installer draaien -> backup kopiëren -> restore -> DNS wijzigen -> verify -> PULSE testen. Gebruikers hoeven geen nieuw wachtwoord.

## 21. Productiecheck
- PostgreSQL healthy;
- 5432 niet gepubliceerd;
- Gateway ready;
- HTTPS geldig;
- Supabase callback correct;
- migratie 100% groen;
- bestanden 100% groen;
- recente backup;
- data-layer audit uitgevoerd;
- rollback beschikbaar.

## 22. Scripts overzicht
- INSTALL: eerste installatie;
- STATUS: snelle status;
- VERIFY: technische controle;
- UPDATE: serverupdate met backup;
- REPAIR: containers/config herstellen zonder data te wissen;
- BACKUP / RESTORE;
- SET_PULSE_URLS;
- ROTATE_SETUP_CODE;
- ROTATE_POSTGRES_PASSWORD;
- EXPORT_DIAGNOSTICS;
- INSTALL/REMOVE_BACKUP_SCHEDULE;
- optionele firewall scripts;
- UNINSTALL met preserve-data standaard;
- AUDIT_PULSE_WEBAPP.
