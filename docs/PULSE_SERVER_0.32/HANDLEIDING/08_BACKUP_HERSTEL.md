# Backup en herstel

`BACKUP_PULSE_DOCKER` maakt:
- `database.dump` (custom pg_dump);
- `files.tar.gz`;
- `gateway-state.tar.gz`;
- configuratiekopie;
- recovery secrets tenzij expliciet uitgesloten;
- SHA256 checksums.

Standaardretentie is 30 dagen. Pas `PULSE_BACKUP_RETENTION_DAYS` aan in `.env`.

**Backups zijn gevoelig** omdat volledige recovery ook secrets nodig heeft. Bewaar ze op een beveiligde backupschijf of versleutelde offsite locatie.

Herstel: `RESTORE_PULSE_DOCKER.ps1 -BackupPath ...` of `./RESTORE_PULSE_DOCKER.sh /pad`. Het script vraagt de bevestiging `HERSTEL`.
