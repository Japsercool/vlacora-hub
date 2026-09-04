# FAQ

**Moet ik een PostgreSQL-wachtwoord kiezen?** Nee. De installer genereert het.

**Waar vind ik het als ik het ooit nodig heb?** Alleen server-side in `pulse-docker/secrets/postgres_password.txt`.

**Is 5432 bereikbaar vanaf internet?** Nee, niet in de meegeleverde compose.

**Blijft login bij Supabase?** Ja.

**Kan de site-URL later veranderen?** Ja, zonder databaseverhuizing.

**Kan ik terug naar Supabase?** Ja; rollback verwijdert de eigen PostgreSQL-data niet.

**Worden toekomstige tabellen automatisch gemaakt?** Nieuwe PULSE serverreleases leveren doelmigraties. De Gateway houdt versies/checksums bij en past ontbrekende migraties toe.
