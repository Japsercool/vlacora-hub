# Security hardening

- PostgreSQL 5432 wordt niet naar de host gepubliceerd.
- Alleen Caddy 80/443 is publiek in productie.
- Gateway vereist Supabase JWT + superadmin voor beheeracties.
- Databasewachtwoord staat uitsluitend in Docker secretbestand.
- Setup-code en master key staan in `secrets/` en horen niet in Git.
- Gateway container is read-only, zonder Linux capabilities en met `no-new-privileges`.
- Caddy voegt basis security headers toe.
- Diagnostiek exporteert geen secretbestanden.
- Gebruik HTTPS in productie; lokale `:8787` mode is alleen voor test/LAN.

Supabase Security Advisor kan los van deze server waarschuwingen tonen voor bestaande SECURITY DEFINER functies of Leaked Password Protection. Dat zijn bronproject-zaken en niet hetzelfde als een open PostgreSQL-poort.
