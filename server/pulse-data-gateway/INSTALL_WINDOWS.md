# PULSE Data Gateway 0.30

Voor nieuwe installaties wordt de losse Node.js-installatie niet meer aanbevolen. Gebruik bij voorkeur:

```text
../pulse-docker/INSTALL_PULSE_DOCKER.ps1
```

Die installer maakt PostgreSQL, Docker secrets, volumes en de Gateway samen aan.

De losse Gateway blijft beschikbaar voor gevorderde installaties met een bestaande PostgreSQL-server.

## Beheerde Docker-modus

De Gateway krijgt vanuit Docker onder andere:

```env
PULSE_POSTGRES_AUTOCONFIG=1
PULSE_POSTGRES_HOST=postgres
PULSE_POSTGRES_PORT=5432
PULSE_POSTGRES_DB=pulse
PULSE_POSTGRES_USER=pulse_app
PULSE_POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password
PULSE_GATEWAY_SETUP_TOKEN_FILE=/run/secrets/gateway_setup_token
PULSE_GATEWAY_MASTER_KEY_FILE=/run/secrets/gateway_master_key
```

In deze modus worden databasecredentials nooit vanuit de browser aangeleverd.
