# Rotation One ↔ VLACORA Hitlijst API contract

VLACORA 0.12.0 is voorbereid om Rotation One als **source of truth** voor hitlijsten te gebruiken.

## Waarom deze API
Rotation One heeft intern al gerangschikte lijsten/edities en uitzending-datumbereiken. De web-HUB moet diezelfde data lezen en, na login + expliciete write-opt-in, terug kunnen schrijven.

## Endpoints

### 1. Lijsten
`GET /api/v1/stations/{stationId}/charts`

Voorbeeld:
```json
{
  "revision": "184",
  "charts": [
    { "id":"versuz-top-50", "name":"Versuz TOP 50", "size":50, "currentEditionId":"2026-w36" }
  ]
}
```

### 2. Edities van één lijst
`GET /api/v1/stations/{stationId}/charts/{chartId}/editions`

Voorbeeld:
```json
{
  "editions": [
    {
      "id":"2026-w36",
      "chartId":"versuz-top-50",
      "label":"Week 36 • 2026",
      "validFrom":"2026-09-05",
      "validTo":"2026-09-09",
      "publishDate":"2026-09-05",
      "status":"published",
      "size":50,
      "revision":"88"
    }
  ]
}
```

### 3. Volledige editie
`GET /api/v1/stations/{stationId}/charts/{chartId}/editions/{editionId}`

```json
{
  "id":"2026-w36",
  "chartId":"versuz-top-50",
  "label":"Week 36 • 2026",
  "validFrom":"2026-09-05",
  "validTo":"2026-09-09",
  "publishDate":"2026-09-05",
  "status":"published",
  "size":50,
  "revision":"88",
  "entries":[
    {
      "id":"p1",
      "position":1,
      "previousPosition":3,
      "songId":"12345",
      "artist":"Artist",
      "title":"Title",
      "weeks":8,
      "peak":1,
      "notes":""
    }
  ]
}
```

### 4. Kleine revision-check
`GET /api/v1/stations/{stationId}/charts/revision`

```json
{ "revision":"184" }
```

VLACORA gebruikt deze kleine call om onnodige downloads te vermijden. Er is **geen continue zware polling**.

### 5. Editie wijzigen
`PUT /api/v1/stations/{stationId}/charts/{chartId}/editions/{editionId}`

Body is dezelfde editie-structuur als bij GET. Rotation One valideert:
- station/chart/edition bestaan;
- positie uniek en >= 1;
- geen dubbele positie;
- datumrange geldig;
- API-key heeft chart-write recht;
- revision/conflictcontrole indien beschikbaar.

Aanbevolen response:
```json
{ "ok":true, "revision":"89" }
```

## Rechten
Aanbevolen scopes voor Rotation One integration keys:
- `charts.read`
- `charts.write`
- `stations.read`

Gebruik bij voorkeur een aparte sleutel `VLACORA HUB`.

## Zuinig gebruik
VLACORA 0.12.0:
1. haalt alleen de chart-index op als gebruiker synchroniseert;
2. gebruikt revision om een ongewijzigde index niet opnieuw te downloaden;
3. haalt alleen edities van de gekozen chart op;
4. haalt pas de volledige songlijst op als één editie wordt geopend;
5. schrijft alleen op expliciete gebruikersactie.

Daardoor blijft Vercel/Supabase/API-verbruik laag.
