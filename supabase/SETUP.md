# VLACORA real login - quick setup

1. Create a Supabase project.
2. In **SQL Editor**, run `supabase/migrations/010_vlacora_hub_core.sql`.
3. In **Authentication -> Users**, create the VLACORA team accounts.
4. Connect the project globally to VLACORA using **one** of these options:
   - Vercel Environment Variables: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; or
   - paste those same public values into `lib/supabase/public-config.ts` before pushing to GitHub.
5. Redeploy/open `/login` and sign in.

Once one global Supabase project is configured, `/hub/*` requires a real Supabase session.

The Project URL and publishable key are public client configuration. Never paste a service-role key into public config.
