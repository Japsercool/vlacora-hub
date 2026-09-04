# Databaseomschakeling — PULSE 0.28

## Vast principe

- Supabase Auth blijft de loginlaag.
- `auth.users` en wachtwoorden worden niet naar de eigen database gekopieerd.
- `profiles.id` blijft exact dezelfde UUID als de `sub` in het Supabase JWT.
- Applicatiedata gaat naar PostgreSQL op de eigen server.
- PostgreSQL wordt niet rechtstreeks vanuit de browser benaderd.
- De Data Gateway controleert het Supabase JWT via de publieke JWKS.

## Gewenste éénknopsflow

`Test -> Configure -> Preflight -> Schema -> Data copy -> Files copy -> Verify -> Activate`

Activeren mag alleen wanneer:

- alle verwachte tabellen aanwezig zijn;
- row counts overeenkomen;
- referentiële checks geslaagd zijn;
- belangrijke steekproeven per module geslaagd zijn;
- de Gateway healthcheck groen is.

Na activatie wordt de oude Supabase-applicatiedata eerst alleen read-only als rollbackbron behouden. Verwijderen gebeurt pas later handmatig.

## Geen betaalde vaste outbound IP nodig

PULSE/Vercel hoeft niet rechtstreeks op poort 5432 van de eigen server te verbinden. De Gateway staat naast PostgreSQL en wordt via HTTPS bereikt. Zo hoeft PostgreSQL zelf niet publiek bereikbaar te zijn en is geen betaalde Vercel fixed-egress-oplossing vereist.

## Status van dit UPDATE-pakket

De UI, configuratietabellen en veilige Gateway-configuratie zijn aanwezig. De daadwerkelijke volledige snapshot-exportadapter moet in de actuele volledige PULSE-bron worden gekoppeld, omdat die alle bestaande modules/tabelcontracten moet kennen. Die bron-ZIP is in deze chatruntime niet fysiek beschikbaar; daarom doet de Gateway in dit overlaypakket bij `/admin/migrate` bewust alleen preflight in plaats van te doen alsof alle 64 huidige tabellen al veilig worden gekopieerd.
