# Updates en automatische migraties

Gebruik altijd `UPDATE_PULSE_DOCKER`. Het script maakt eerst een backup, bouwt de nieuwe Gateway, start de containers en controleert de gezondheid.

De Gateway houdt `pulse_meta.schema_migrations` bij. SQL-bestanden in `pulse-data-gateway/migrations` worden één keer toegepast en hebben een checksum. Een al toegepaste migratie die achteraf is gewijzigd wordt geweigerd.

Na omschakeling controleert Gateway 0.31 ook in **managed Docker mode** automatisch de doelmigraties bij startup.
