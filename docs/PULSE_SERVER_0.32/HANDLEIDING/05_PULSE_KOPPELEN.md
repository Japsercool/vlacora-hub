# PULSE koppelen

Na installatie staat in `pulse-docker/PULSE_SERVER_KOPPELING.txt`:
- Gateway URL;
- eenmalige setup-code.

In PULSE ga je naar **Beheer > Database-backend**. Kies **Beheerde PULSE Docker-server** en vul alleen deze twee waarden in. De databasehost `postgres`, user `pulse_app` en het random wachtwoord blijven server-side.

De setup-code is alleen voor pairing. Daarna autoriseert PULSE beheeracties met je gewone Supabase-superadmin sessie.
