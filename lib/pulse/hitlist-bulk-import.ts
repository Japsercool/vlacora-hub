import type { HitlistBulkImportFile } from "@/components/modules/hitlist-bulk-import-panel";
import { canonicalSeriesKey } from "@/lib/pulse/hitlist-history";

export type ParsedHitlistImport = {
  name: string;
  entries: Array<Record<string, unknown>>;
  size?: number;
  program_name?: string;
  notes?: string;
  source_label?: string;
};

export type HitlistBulkImportAdapter = {
  parseFile: (file: File) => Promise<ParsedHitlistImport>;
  saveEdition: (row: {
    station_slug: string;
    series_key: string;
    name: string;
    edition_label: string;
    edition_year: number;
    edition_week: number;
    entries: Array<Record<string, unknown>>;
    size: number;
    status: "draft" | "published";
    program_name: string;
    notes: string;
    source_label: string;
  }) => Promise<void>;
  onProgress?: (value: { index: number; total: number; filename: string; year: number; week: number }) => void;
};

export async function importHistoricalHitlists({
  files,
  stationSlug,
  seriesName,
  seriesKey,
  status = "published",
  adapter,
}: {
  files: HitlistBulkImportFile[];
  stationSlug: string;
  seriesName: string;
  seriesKey?: string;
  status?: "draft" | "published";
  adapter: HitlistBulkImportAdapter;
}) {
  const ordered = [...files]
    .filter((x): x is HitlistBulkImportFile & { week: number } => Boolean(x.week))
    .sort((a, b) => a.year - b.year || a.week - b.week);
  const key = canonicalSeriesKey(seriesName, seriesKey || "");

  for (let index = 0; index < ordered.length; index++) {
    const item = ordered[index];
    adapter.onProgress?.({ index: index + 1, total: ordered.length, filename: item.filename, year: item.year, week: item.week });
    const parsed = await adapter.parseFile(item.file);
    await adapter.saveEdition({
      station_slug: stationSlug,
      series_key: key,
      name: seriesName,
      edition_label: `Week ${item.week} • ${item.year}`,
      edition_year: item.year,
      edition_week: item.week,
      entries: parsed.entries,
      size: parsed.size || parsed.entries.length,
      status,
      program_name: parsed.program_name || "",
      notes: parsed.notes || "",
      source_label: parsed.source_label || item.filename,
    });
  }

  // De database-trigger pulse_hitlist_recompute_after_change bouwt na iedere save
  // automatisch de volledige chronologische historiek opnieuw op. Daardoor mag
  // een oudere week zelfs later nog worden toegevoegd.
  return { imported: ordered.length, seriesKey: key };
}
