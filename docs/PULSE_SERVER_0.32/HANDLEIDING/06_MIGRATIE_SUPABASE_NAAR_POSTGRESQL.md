# Migratie Supabase -> eigen PostgreSQL

Gebruik de knoppen in deze volgorde:
1. **Gateway testen** - HTTPS/Gateway bereikbaar.
2. **PostgreSQL testen** - managed Docker DB is healthy.
3. **Preflight** - opslag schrijfbaar, vrije ruimte, backendstatus.
4. **Database voorbereiden** - PULSE schema/migraties.
5. **Eerste migratie** - kopieert data, UUID identity mirror en bestanden.
6. **Controle** - vergelijkt rijaantallen per tabel.
7. **Finale synchronisatie** - vervangt stagingdata met de nieuwste brondata en controleert opnieuw.
8. **Omschakelen** - alleen na volledig groene controle.

Supabase Auth blijft actief. Verwijder de Supabase brondata niet direct; bewaar rollback minimaal totdat de eigen backend langere tijd stabiel is.

### Belangrijke go-live controle
De website moet moduledata via de centrale PULSE datalaag/Gateway gebruiken. Een scherm dat nog rechtstreeks `supabase.from(...)` gebruikt, kan na de backendwissel anders nog uit Supabase lezen/schrijven. Gebruik daarom de meegeleverde `AUDIT_PULSE_WEBAPP` als aanvullende controle.
