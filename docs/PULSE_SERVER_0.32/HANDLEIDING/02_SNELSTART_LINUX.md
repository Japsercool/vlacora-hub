# Snelstart Linux

```bash
unzip PULSE_SERVER_0.31.0_DOCKER_COMPLETE.zip
cd PULSE_SERVER_0.31.0_DOCKER_COMPLETE/pulse-docker
chmod +x scripts/*.sh
./scripts/INSTALL_PULSE_DOCKER.sh
```

Voor productie moet `api.pulse.jouwdomein.be` naar de server wijzen en TCP 80/443 bereikbaar zijn voor Caddy. PostgreSQL 5432 blijft intern.
