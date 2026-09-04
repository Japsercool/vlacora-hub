# Wat wordt niet als login-data gemigreerd

Niet naar de eigen PULSE database als authenticatiebron:
- Supabase password hashes;
- refresh tokens;
- actieve Auth sessies;
- MFA secrets;
- Auth provider credentials.

Wel behouden voor PULSE-relaties:
- de vaste user UUID's;
- PULSE `profiles`;
- rollen, station memberships en moduletoegang;
- alle PULSE business data;
- PULSE-bestanden die door de migratie-engine worden meegenomen.
