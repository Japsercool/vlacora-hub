# PULSE Server 0.31.0 - Complete Docker Bundle

Deze bundel is bedoeld om een **nieuwe PULSE-dataserver** zo automatisch mogelijk op te zetten. PostgreSQL draait intern in Docker; Supabase blijft uitsluitend de login/identiteit leveren. De PULSE Data Gateway is de beveiligde laag tussen de website en de eigen database.

## Wat de installer automatisch doet
- maakt alle servermappen aan;
- genereert een sterk random PostgreSQL-wachtwoord;
- genereert Gateway setup-code + encryptiesleutel;
- start PostgreSQL 17 in Docker;
- publiceert **geen** databasepoort 5432;
- start de PULSE Data Gateway;
- kan HTTPS via Caddy automatisch regelen;
- maakt `PULSE_SERVER_KOPPELING.txt`;
- voorziet backup, restore, repair, update, status, URL-wijziging, secret rotation, firewall-hulp en diagnostiek.

## Eerst lezen
Open `00_START_HIER.txt` en daarna `HANDLEIDING/HANDLEIDING_PULSE_SERVER.pdf`.

## Productieprincipe
```text
PULSE website -> Supabase Auth (login/JWT)
             -> HTTPS PULSE Gateway -> PostgreSQL Docker + lokale PULSE files
```

## Veiligheidsregel
Een definitieve omschakeling is pas veilig wanneer de PULSE-webapp geen moduledata meer rechtstreeks met Supabase benadert. Gebruik `pulse-docker/scripts/AUDIT_PULSE_WEBAPP.*` als aanvullende controle.
