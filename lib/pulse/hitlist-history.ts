export type HitlistTrend = "new" | "up" | "down" | "same";

export type HitlistEntry = {
  id?: string;
  artist?: string;
  title?: string;
  songId?: string;
  spotifyUrl?: string;
  position?: number;
  previousPosition?: number | null;
  weeks?: number;
  peak?: number;
  trend?: HitlistTrend;
  delta?: number | null;
  songKey?: string;
  [key: string]: unknown;
};

export type HitlistEdition = {
  id: string;
  station_slug: string;
  series_key: string;
  edition_year?: number | null;
  edition_week?: number | null;
  valid_from?: string | null;
  publish_date?: string | null;
  created_at?: string | null;
  previous_edition_id?: string | null;
  entries: HitlistEntry[];
};

function clean(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(feat(?:uring)?|ft)\.?\b/g, "feat")
    .replace(/\s*&\s*/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function hitlistSongKey(entry: Pick<HitlistEntry, "artist" | "title" | "songId" | "spotifyUrl">) {
  const songId = String(entry.songId || "").trim();
  if (songId) return `id:${songId}`;
  const spotify = String(entry.spotifyUrl || "").trim();
  if (spotify) return `spotify:${spotify.toLowerCase()}`;
  return `${clean(String(entry.artist || ""))}|${clean(String(entry.title || ""))}`;
}

export function canonicalSeriesKey(name: string, existing = "") {
  if (/\-week\-\d+$/i.test(existing)) return existing.replace(/\-week\-\d+$/i, "");
  if (existing.trim()) return existing.trim();
  return clean(name.replace(/\s+week\s+\d+.*$/i, ""));
}

export function inferWeekYearFromFilename(filename: string, fallbackYear = new Date().getFullYear()) {
  const week = filename.match(/(?:week|wk|w)\s*[-_ ]?\s*(\d{1,2})/i)?.[1];
  const year = filename.match(/(?:19|20)\d{2}/)?.[0];
  return {
    week: week ? Math.max(1, Math.min(53, Number(week))) : null,
    year: year ? Number(year) : fallbackYear,
  };
}

function editionOrder(a: HitlistEdition, b: HitlistEdition) {
  const ay = a.edition_year ?? 9999;
  const by = b.edition_year ?? 9999;
  if (ay !== by) return ay - by;
  const aw = a.edition_week ?? 99;
  const bw = b.edition_week ?? 99;
  if (aw !== bw) return aw - bw;
  const ad = a.valid_from || a.publish_date || a.created_at || "9999-12-31";
  const bd = b.valid_from || b.publish_date || b.created_at || "9999-12-31";
  return ad.localeCompare(bd);
}

export function recomputeHitlistHistory(editions: HitlistEdition[]) {
  const sorted = [...editions].sort(editionOrder);
  const history = new Map<string, { weeks: number; peak: number }>();
  let previousPositions = new Map<string, number>();
  let previousEditionId: string | null = null;

  return sorted.map((edition) => {
    const currentPositions = new Map<string, number>();
    const entries = edition.entries.map((entry, index) => {
      const position = index + 1;
      const songKey = hitlistSongKey(entry);
      const previousPosition = previousPositions.get(songKey) ?? null;
      const old = history.get(songKey);
      const weeks = (old?.weeks || 0) + 1;
      const peak = Math.min(position, old?.peak ?? position);
      const delta = previousPosition == null ? null : previousPosition - position;
      const trend: HitlistTrend = previousPosition == null ? "new" : delta! > 0 ? "up" : delta! < 0 ? "down" : "same";
      currentPositions.set(songKey, position);
      history.set(songKey, { weeks, peak });
      return { ...entry, position, songKey, previousPosition, weeks, peak, trend, delta };
    });
    const next = { ...edition, previous_edition_id: previousEditionId, entries };
    previousPositions = currentPositions;
    previousEditionId = edition.id;
    return next;
  });
}

export function compareEditions(previous: HitlistEdition | null, current: HitlistEdition) {
  const prev = new Map<string, { position: number; entry: HitlistEntry }>();
  (previous?.entries || []).forEach((entry, index) => prev.set(hitlistSongKey(entry), { position: index + 1, entry }));
  const nowKeys = new Set(current.entries.map(hitlistSongKey));
  const rows = current.entries.map((entry, index) => {
    const position = index + 1;
    const old = prev.get(hitlistSongKey(entry));
    const delta = old ? old.position - position : null;
    return {
      ...entry,
      position,
      previousPosition: old?.position ?? null,
      trend: old ? (delta! > 0 ? "up" : delta! < 0 ? "down" : "same") : "new",
      delta,
    };
  });
  const dropped = [...prev.entries()]
    .filter(([key]) => !nowKeys.has(key))
    .map(([, value]) => ({ ...value.entry, previousPosition: value.position }));
  return { rows, dropped };
}

export function hitlistSummary(entries: HitlistEntry[]) {
  const withDelta = entries.filter((e) => typeof e.delta === "number") as Array<HitlistEntry & { delta: number }>;
  const biggestRiser = withDelta.length ? [...withDelta].sort((a, b) => b.delta - a.delta)[0] : null;
  const biggestFaller = withDelta.length ? [...withDelta].sort((a, b) => a.delta - b.delta)[0] : null;
  const newCount = entries.filter((e) => e.trend === "new" || e.previousPosition == null).length;
  const longest = entries.length ? [...entries].sort((a, b) => Number(b.weeks || 0) - Number(a.weeks || 0))[0] : null;
  return { biggestRiser, biggestFaller, newCount, longest };
}
