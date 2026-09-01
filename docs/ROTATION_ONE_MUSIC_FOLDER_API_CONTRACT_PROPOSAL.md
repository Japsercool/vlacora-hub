# Proposed Rotation One read-only Music Folder API for VLACORA

This is a **proposal**, not a claim that these endpoints already exist.
VLACORA 0.10 deliberately leaves the paths configurable until Rotation One implements/confirm them.

## 1. List music folders

`GET /api/v1/stations/{stationId}/music/folders`

Suggested response:

```json
{
  "stationId": "hits",
  "folders": [
    {
      "id": "folder-a",
      "name": "A-ROTATIE",
      "description": "Hoogste rotatie",
      "count": 42
    }
  ]
}
```

## 2. List songs in one folder

`GET /api/v1/stations/{stationId}/music/folders/{folderId}/songs`

Suggested response:

```json
{
  "stationId": "hits",
  "folderId": "folder-a",
  "songs": [
    {
      "id": "30123",
      "artist": "Artist",
      "title": "Title",
      "category": "A",
      "year": 2026,
      "durationMs": 198000
    }
  ]
}
```

## Security

- Bearer authentication, same integration key model as the confirmed Rotation One API.
- Read-only permission/scope, e.g. `music.read`.
- Do not return physical Windows paths unless a client actually needs them.
- No write action is required for the VLACORA PDF feature.

## VLACORA configuration after implementation

- Music folders endpoint: `/api/v1/stations/{stationId}/music/folders`
- Songs-in-folder endpoint: `/api/v1/stations/{stationId}/music/folders/{folderId}/songs`

The 0.10 normalizer accepts common casing/key variants and can render the result directly in the folder dropdown and PDF generator.
