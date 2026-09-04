# Snelstart Windows

1. Pak de ZIP uit, liefst op de schijf waar je PULSE-serverbestanden wilt bewaren, bv. `D:\PULSE-SERVER`.
2. Start Docker en controleer `docker version` en `docker compose version`.
3. Start `pulse-docker\QUICK_SETUP_WINDOWS.cmd` als administrator.
4. Kies **production** wanneer de Gateway via een echte domeinnaam bereikbaar wordt.
5. Vul PULSE website-URL, Supabase Auth URL, publishable key en Gateway-domein in.
6. De installer genereert PostgreSQL- en Gateway-secrets zelf.
7. Controleer `pulse-docker\PULSE_SERVER_KOPPELING.txt`.
8. Open in PULSE: **Beheer > Database-backend > Beheerde PULSE Docker-server**.
9. Koppel met Gateway URL + setup-code.
10. Doe achtereenvolgens: verbinding testen, database voorbereiden, migreren, controleren, finale sync, omschakelen.
11. Maak na succesvolle migratie meteen een backup.
