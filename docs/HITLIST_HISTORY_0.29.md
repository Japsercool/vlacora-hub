# PULSE 0.29 — hitlijsthistoriek

## Probleem dat hiermee wordt opgelost

De werkbladinterface mocht niet vertrouwen op `previousPosition`, `weeks` en `peak` uit een Excel-import. Die waarden zijn afgeleid van de volledige historische reeks en moeten dus door PULSE worden berekend.

Vanaf migratie `051_hitlist_auto_history_recompute.sql` gebeurt dat in de database:

- `series_key` wordt voor weeklijsten gecanonicaliseerd (`SUPER 50 week 35` en week 36 horen bij `super-50`);
- edities worden chronologisch gesorteerd op jaar/week;
- `previousPosition` komt uit de onmiddellijk vorige editie;
- `trend` wordt `new`, `up`, `down` of `same`;
- `delta` is positief bij stijgen en negatief bij dalen;
- `weeks` telt eerdere verschijningen in de reeks;
- `peak` is de beste positie uit alle beschikbare edities;
- `previous_edition_id` wordt opnieuw gekoppeld;
- wanneer later een oudere week wordt geïmporteerd, wordt de hele reeks automatisch opnieuw berekend.

De twee testbestanden `Super 50 week 35.xlsx` en `Super 50 week 36(1).xlsx` geven hierdoor onder meer:

- Hugel — 1 → 1 — `same`, 2 weken, peak 1;
- Sienna Spiro — 5 → 3 — `up`, delta +2;
- Bausa — 3 → 5 — `down`, delta -2;
- ANOTR — 9 → 6 — `up`, delta +3;
- Sombr — 6 → 10 — `down`, delta -4;
- Topic & Becky G — 8 → 14 — `down`, delta -6.

## Bulkimport

`HitlistBulkImportPanel` ondersteunt selectie van meerdere `.xlsx/.xls` bestanden tegelijk. Het paneel haalt week en jaar uit de bestandsnaam en laat die waarden vóór import corrigeren.

De daadwerkelijke werkboekparser uit de bestaande hitlijstmodule wordt via `importHistoricalHitlists()` hergebruikt. Er hoeft dus geen tweede Excel-parser te ontstaan. Elke editie wordt met dezelfde `series_key` opgeslagen; de database herberekent automatisch de hele geschiedenis.

## Updates / privénotities

Migratie `049_hitlist_history_notes_imports.sql` maakt `hub_chart_updates` aan.

Een update kan gelden voor:

- de volledige editie (`song_key = null`);
- één song (`song_key` + optionele `entry_position`).

Privacy:

- `private`: uitsluitend de maker;
- `managers`: maker + station/hitlijstbeheer;
- `team`: gebruikers met toegang tot de zender.

Gebruik `HitlistUpdatesPanel` in het editiedetail of in het rechter songdetailpaneel.
