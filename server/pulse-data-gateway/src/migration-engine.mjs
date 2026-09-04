import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { loadCatalog, loadAuthIdentities, tableCount, tablePage, downloadStorageObject } from "./source-supabase.mjs";
import { applyLocalMigrations } from "./target-migrations.mjs";
import {
  withClient,
  prepareTargetSchema,
  prepareAuthIdentityMirror,
  targetTableCounts,
  clearTargetTables,
  insertJsonRows,
  applyConstraintsAndIndexes,
  writeTargetBackendMeta,
} from "./postgres-tools.mjs";

const dataDir = path.resolve("data");
const progressFile = path.join(dataDir, "migration-progress.json");
fs.mkdirSync(dataDir, { recursive: true });

function persist(state) {
  fs.writeFileSync(progressFile, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2));
}

export function readProgress() {
  if (!fs.existsSync(progressFile)) return { status: "idle", stage: "idle", tables: {}, updatedAt: null };
  try { return JSON.parse(fs.readFileSync(progressFile, "utf8")); } catch { return { status: "unknown", stage: "unknown", tables: {} }; }
}

function checksumCatalog(catalog) {
  return crypto.createHash("sha256").update(JSON.stringify(catalog)).digest("hex");
}

async function copyAttachments(jwt, attachmentRows, fileRoot, state) {
  if (!fileRoot || !Array.isArray(attachmentRows) || !attachmentRows.length) return { copied: 0, failed: 0 };
  const bucket = process.env.PULSE_SOURCE_STORAGE_BUCKET || "vlacora-hub-files";
  let copied = 0, failed = 0;
  for (let i = 0; i < attachmentRows.length; i++) {
    const row = attachmentRows[i];
    if (!row?.storage_path) continue;
    state.stage = "files";
    state.file = row.storage_path;
    state.files = { copied, failed, total: attachmentRows.length };
    persist(state);
    try {
      const bytes = await downloadStorageObject(jwt, bucket, row.storage_path);
      const target = path.join(fileRoot, ...String(row.storage_path).split("/").filter(Boolean));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, bytes);
      copied++;
    } catch (error) {
      failed++;
      state.warnings ||= [];
      state.warnings.push(`Bestand ${row.storage_path}: ${error.message}`);
    }
  }
  state.files = { copied, failed, total: attachmentRows.length };
  persist(state);
  return { copied, failed };
}

export async function migrateSnapshot({ jwt, targetConfig, replaceExisting = false, fileRoot = "" }) {
  const state = {
    status: "running",
    stage: "catalog",
    startedAt: new Date().toISOString(),
    tables: {},
    warnings: [],
    files: { copied: 0, failed: 0, total: 0 },
  };
  persist(state);

  try {
    const catalog = await loadCatalog(jwt);
    const authIdentities = await loadAuthIdentities(jwt);
    state.authIdentityCount = authIdentities.length;
    const tables = (catalog?.tables || []).map((t) => t.name);
    state.catalogChecksum = checksumCatalog(catalog);
    state.tableTotal = tables.length;
    persist(state);

    const sourceCounts = {};
    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      state.stage = "source-counts";
      state.current = { table, index: i + 1, total: tables.length };
      persist(state);
      sourceCounts[table] = await tableCount(jwt, table);
      state.tables[table] = { source: sourceCounts[table], copied: 0, target: 0, ok: false };
    }

    await withClient(targetConfig, async (client) => {
        await prepareTargetSchema(client, catalog, (p) => { state.stage = p.stage; state.current = p; persist(state); });
        await applyLocalMigrations(client, (p) => { state.stage = p.stage; state.current = p; persist(state); });
        const existing = await targetTableCounts(client, tables);
        const nonEmpty = Object.entries(existing).filter(([, n]) => Number(n) > 0);
        if (nonEmpty.length && !replaceExisting) {
          const preview = nonEmpty.slice(0, 8).map(([t, n]) => `${t} (${n})`).join(", ");
          throw new Error(`Doeldatabase bevat al PULSE-data: ${preview}. Vink 'bestaande doeldata vervangen' aan om deze migratiedoeldata bewust te overschrijven.`);
        }
        if (replaceExisting) {
          state.stage = "clear-target";
          persist(state);
          await clearTargetTables(client, tables);
        }

        state.stage = "identity-mirror";
        state.current = { table: "auth.users", index: 0, total: tables.length };
        persist(state);
        await prepareAuthIdentityMirror(client, authIdentities);

        let attachmentRows = [];
        for (let i = 0; i < tables.length; i++) {
          const table = tables[i];
          const total = sourceCounts[table] || 0;
          let offset = 0;
          state.stage = "copying";
          state.current = { table, index: i + 1, total: tables.length, rows: total };
          persist(state);
          while (offset < total) {
            const page = await tablePage(jwt, table, offset, 500);
            const rows = Array.isArray(page?.rows) ? page.rows : [];
            if (!rows.length) break;
            await insertJsonRows(client, table, rows);
            if (table === "hub_attachments") attachmentRows = attachmentRows.concat(rows);
            offset += rows.length;
            state.tables[table].copied = offset;
            persist(state);
          }
        }

        state.stage = "constraints";
        persist(state);
        await applyConstraintsAndIndexes(client, catalog, (p) => { state.stage = p.stage; state.current = p; persist(state); });

        state.stage = "verifying";
        const targetCounts = await targetTableCounts(client, tables);
        let mismatch = false;
        for (const table of tables) {
          const source = sourceCounts[table] || 0;
          const target = targetCounts[table] || 0;
          state.tables[table] = { source, copied: state.tables[table]?.copied || 0, target, ok: source === target };
          if (source !== target) mismatch = true;
        }
        persist(state);
        if (mismatch) throw new Error("Controle mislukt: minstens één tabel heeft op het doel een ander aantal rijen dan in Supabase.");

        await writeTargetBackendMeta(client, {
          active_backend: "staged",
          source: "supabase",
          details: { catalogChecksum: state.catalogChecksum, verifiedAt: new Date().toISOString() },
        });

        if (attachmentRows.length) {
          if (!fileRoot) throw new Error("Er zijn PULSE-bijlagen, maar PULSE_FILE_ROOT is niet ingesteld op de Gateway");
          const fileResult = await copyAttachments(jwt, attachmentRows, fileRoot, state);
          const strictFiles = process.env.PULSE_FILE_MIGRATION_STRICT !== "0";
          if (strictFiles && fileResult.failed > 0) {
            throw new Error(`${fileResult.failed} PULSE-bestand(en) konden niet worden gekopieerd. Omschakeling is geblokkeerd zodat geen bijlagen verloren gaan.`);
          }
        }
    });

    state.status = "ready";
    state.stage = "ready";
    state.completedAt = new Date().toISOString();
    state.current = null;
    persist(state);
    return state;
  } catch (error) {
    state.status = "failed";
    state.stage = "failed";
    state.error = error.message || String(error);
    state.completedAt = new Date().toISOString();
    persist(state);
    throw error;
  }
}
