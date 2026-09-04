# PULSE Data Gateway op Windows Server

1. Installeer Node.js LTS.
2. Kopieer deze map naar bijvoorbeeld `C:\PULSE\DataGateway`.
3. Open PowerShell in die map en voer `npm install` uit.
4. Kopieer `.env.example` naar `.env`.
5. Genereer een setup-token en een 32-byte AES-key. Voor de key kan PowerShell bijvoorbeeld 32 cryptografisch willekeurige bytes naar hex omzetten.
6. Vul je huidige Supabase Auth URL/issuer in.
7. Zet `PULSE_ALLOWED_ORIGIN` op de HTTPS-URL van PULSE.
8. Start met `npm start`.
9. Publiceer uitsluitend de Gateway via HTTPS/reverse proxy/tunnel; stel PostgreSQL zelf niet rechtstreeks aan het internet bloot.

De databasegegevens die je in PULSE invult worden met AES-256-GCM versleuteld in `data/postgres.enc`. De master key staat alleen in `.env` op je eigen server.
