# Domeinen, HTTPS en URL wijzigen

De website-URL, Gateway-URL en database zijn losgekoppeld. Een domeinwijziging vereist **geen datamigratie**.

Voor een nieuwe PULSE site-URL:
1. voeg de nieuwe URL tijdelijk toe aan PULSE/Gateway allowed origins;
2. voeg `https://nieuwe-site/auth/callback` toe aan Supabase Auth redirects;
3. wijzig DNS/deploy;
4. test login;
5. verwijder de oude origin pas later.

Gebruik server-side `SET_PULSE_URLS.ps1` of `.sh` wanneer ook het Gateway-domein verandert. Caddy vraagt dan automatisch een nieuw TLS-certificaat aan.
