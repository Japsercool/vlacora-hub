# PULSE Managed Docker Server 0.30

## Doel
Deze stack maakt automatisch een eigen PostgreSQL + PULSE Data Gateway aan. PostgreSQL-poort 5432 wordt **niet** gepubliceerd. De browser praat uitsluitend met de Gateway.

## Snelste installatie
Windows:

```powershell
PowerShell -ExecutionPolicy Bypass -File .\INSTALL_PULSE_DOCKER.ps1
```

Linux:

```bash
./INSTALL_PULSE_DOCKER.sh
```

De installer maakt zelf aan:
- sterk PostgreSQL-wachtwoord;
- Gateway setup-code;
- 256-bit Gateway master key;
- Docker volumes voor PostgreSQL, PULSE-bestanden en Gateway-state;
- intern Docker-netwerk;
- optioneel HTTPS via Caddy.

Na installatie gebruik je bij de **eerste koppeling** in **PULSE > Beheer > Database-backend** alleen:
1. Gateway URL;
2. Setup-code uit `PULSE_SERVER_KOPPELING.txt`.

Daarna is de setup-code niet meer nodig. Databasehost, databasegebruiker en databasewachtwoord worden in beheerde Docker-modus nooit in de browser ingevoerd.

## HTTPS
Een Vercel/HTTPS PULSE-site kan in normale browsers niet veilig naar een HTTP Gateway bellen. Gebruik daarom voor extern gebruik een domeinnaam die naar de PULSE-server wijst en laat de installer het Caddy-profiel starten. Alleen poorten 80/443 hoeven dan naar deze server; PostgreSQL 5432 blijft dicht.

## Website of Gateway later van URL veranderen

De database hoeft daarvoor niet opnieuw gemigreerd te worden. Wijzig de PULSE website-URL in **Beheer > Database-backend > Domeinen & URL's**. De Gateway bewaart de toegestane origins live in zijn state-volume.

Voor een nieuwe publieke Gateway-domeinnaam/HTTPS-host voer je op de server uit:

```powershell
.\SET_PULSE_URLS.ps1
```

of op Linux:

```sh
./SET_PULSE_URLS.sh
```

De scripts wijzigen alleen URL/configuratie en herladen Gateway/Caddy. PostgreSQL- en bestandsvolumes worden niet verwijderd.
