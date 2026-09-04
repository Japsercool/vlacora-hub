# Changelog 0.31.0

- complete serverbundle en uitgebreide handleiding;
- veilige productiecompose zonder publieke PostgreSQL-poort;
- lokale test-override apart;
- uitgebreide Windows- en Linux-installers;
- backup + restore + retention + checksums;
- update, repair, status, verify, diagnostics;
- setup-code en PostgreSQL-secret rotatie;
- URL/domain wijzigingsscripts;
- optionele firewall scripts;
- backup planning;
- veilige uninstall met data-preserve als standaard;
- webapp data-layer audit;
- Gateway 0.31.0 met `/health/live`, `/health/ready`, `/admin/preflight`, `/admin/upgrade`, `/admin/diagnostics`;
- fix: managed Docker targetmigraties worden ook na omschakeling bij Gateway-start gecontroleerd;
- fix: rollback schrijft target metadata ook in managed Docker mode.
