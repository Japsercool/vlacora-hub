# Architectuur

```text
Browser / PULSE website
  |
  +--> Supabase Auth: login, sessies, wachtwoordreset, user UUID
  |
  +--> HTTPS PULSE Data Gateway
          |
          +--> valideert Supabase JWT
          +--> voert migratie- en beheeracties uit
          +--> PostgreSQL 17 (intern Docker-netwerk)
          +--> PULSE file store (hostmap data/files)
```

**Nooit publiek:** PostgreSQL 5432, databasewachtwoord, Gateway master key.

De eigen database bevat een minimale `auth.users` identity mirror met UUID's om bestaande relaties intact te houden. Dat is geen tweede login-database: geen password hashes, refresh tokens of Supabase sessies.
