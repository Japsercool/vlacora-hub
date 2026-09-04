# Noodherstel op een volledig nieuwe server

1. installeer Docker;
2. pak dezelfde PULSE serverbundle uit;
3. run installer om lege containers/structuur te maken;
4. kopieer een volledige PULSE backup naar de nieuwe server;
5. run restore;
6. pas DNS naar de nieuwe Gateway aan;
7. run verify;
8. test PULSE login en data;
9. pas site/Gateway URL aan indien nodig.

Omdat login bij Supabase Auth blijft, hoeven gebruikersaccounts en wachtwoorden niet opnieuw te worden aangemaakt.
