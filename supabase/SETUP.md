# PULSE 0.25.0 — Supabase setup

PULSE uses Supabase as its current backend. The persistent data store is PostgreSQL.

1. Use one Supabase project for PULSE.
2. In **SQL Editor**, run the SQL files in `supabase/migrations/` in numeric order.
3. For an existing 0.20.x database, at minimum apply every migration you have not yet run and finish with `029_standalone_stations.sql`.
4. Create team accounts in **Authentication → Users**.
5. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Vercel (or your local `.env`).
6. Redeploy and sign in at `/login`.

## Standalone stations

Migration `029_standalone_stations.sql` creates `hub_stations`. All authenticated users may read the station registry; only users whose profile role is `superadmin` may add, change or delete stations.

## Future PostgreSQL move

In **Alle zenders → Beheer → Database-backend**, a superadmin can already store the non-secret target metadata for a future PostgreSQL/self-hosted Supabase migration. Never store a PostgreSQL password in public configuration or browser storage. A future connection URL belongs in a server-side secret such as `VLACORA_POSTGRES_URL`.

The Project URL and publishable key are public client configuration. Never expose a service-role key.
