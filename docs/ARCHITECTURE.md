# VLACORA HUB architecture

## Demo
This repository is a frontend prototype with local mock data. It is safe to deploy to Vercel for testing.

## Intended production architecture

Cloud:
- Next.js / VLACORA web app
- Supabase PostgreSQL
- Supabase Auth
- Supabase Realtime
- Supabase Storage

Radio server:
- `Vlacora.Agent` (.NET 8 Worker Service)
- Rotation One API
- Playout One API
- SHOUTcast API

Flow:

VLACORA Web -> VLACORA API / Supabase -> command queue -> Vlacora.Agent -> Rotation One / Playout One

Rotation One and Playout One remain source-of-truth for radio-engine data.

## Planned API contracts

- GET /api/v1/stations
- GET /api/v1/stations/{stationId}/playlists?date=YYYY-MM-DD
- GET /api/v1/playlists/{playlistId}
- POST /api/v1/playlists/{playlistId}/items
- PATCH /api/v1/playlists/{playlistId}/items/{itemId}
- POST /api/v1/playlists/{playlistId}/items/{itemId}/move
- POST /api/v1/playlists/{playlistId}/items/{itemId}/replace
- POST /api/v1/playlists/{playlistId}/export

## Security
Never commit `.env.local`, service-role keys, database passwords or radio API secrets.
