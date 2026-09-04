"use client";

import { useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { inferWeekYearFromFilename } from "@/lib/pulse/hitlist-history";
import styles from "./hitlist-bulk-import-panel.module.css";

export type HitlistBulkImportFile = {
  file: File;
  filename: string;
  year: number;
  week: number | null;
};

export function HitlistBulkImportPanel({ onImport }: { onImport: (items: HitlistBulkImportFile[]) => Promise<void> }) {
  const input = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<HitlistBulkImportFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const valid = useMemo(() => items.length > 0 && items.every((x) => x.week && x.year >= 2000), [items]);

  function choose(files: FileList | null) {
    const next = Array.from(files || []).map((file) => {
      const inferred = inferWeekYearFromFilename(file.name);
      return { file, filename: file.name, year: inferred.year, week: inferred.week };
    }).sort((a, b) => a.year - b.year || Number(a.week || 99) - Number(b.week || 99));
    setItems(next);
    setError("");
  }

  async function importAll() {
    if (!valid) return;
    setBusy(true); setError("");
    try { await onImport(items); }
    catch (caught) { setError((caught as { message?: string }).message || String(caught)); }
    finally { setBusy(false); }
  }

  return <section className={styles.panel}>
    <div className={styles.head}><div><strong>Meerdere weken importeren</strong><small>Selecteer al je historische Excel-lijsten tegelijk. Week en jaar worden uit de bestandsnaam gehaald en kunnen vóór import worden gecorrigeerd.</small></div><button onClick={() => input.current?.click()}>Excel-bestanden kiezen</button></div>
    <input ref={input} hidden type="file" multiple accept=".xlsx,.xls" onChange={(e: ChangeEvent<HTMLInputElement>) => choose(e.target.files)} />
    {items.length > 0 && <div className={styles.table}><div className={styles.header}><span>Bestand</span><span>Jaar</span><span>Week</span></div>{items.map((item, index) => <div className={styles.line} key={`${item.filename}-${index}`}><span title={item.filename}>{item.filename}</span><input type="number" value={item.year} onChange={(e: ChangeEvent<HTMLInputElement>) => setItems((all) => all.map((x, i) => i === index ? { ...x, year: Number(e.target.value) } : x))}/><input type="number" min={1} max={53} value={item.week ?? ""} onChange={(e: ChangeEvent<HTMLInputElement>) => setItems((all) => all.map((x, i) => i === index ? { ...x, week: e.target.value ? Number(e.target.value) : null } : x))}/></div>)}</div>}
    {error && <div className={styles.error}>{error}</div>}
    <div className={styles.foot}><span>Na elke import herberekent PULSE automatisch de volledige serie: vorige positie, stijger/daler, weken, peak en nieuwe/uitgevallen songs.</span><button disabled={!valid || busy} onClick={() => void importAll()}>{busy ? "Importeren…" : `Importeer ${items.length || ""} week${items.length === 1 ? "" : "en"}`}</button></div>
  </section>;
}

export default HitlistBulkImportPanel;
