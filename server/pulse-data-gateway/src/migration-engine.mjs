import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { loadCatalog, loadRuntimeCatalog, loadStorageObjects, loadAuthIdentities, tableCount, tablePage, downloadStorageObject, sourceStorageBase } from "./source-supabase.mjs";
import { applyLocalMigrations } from "./target-migrations.mjs";
import {
  withClient,
  prepareTargetSchema,
  prepareAuthIdentityMirror,
  targetTableCounts,
  clearTargetTables,
  insertJsonRows,
  applyConstraintsAndIndexes,
  preparePostgrestRuntime,
  applyRuntimeCatalog,
  rewriteSupabaseStorageUrls,
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

async function copyStorageObjects(jwt, storageObjects, fileRoot, state) {
  const objects = Array.isArray(storageObjects) ? storageObjects.filter((x) => x?.bucket && x?.name) : [];
  if (!objects.length) {
    state.files = { copied: 0, failed: 0, total: 0 };
    persist(state);
    return { copied: 0, failed: 0, total: 0 };
  }
  if (!fileRoot) throw new Error("Supabase Storage bevat PULSE-bestanden, maar PULSE_FILE_ROOT is niet ingesteld op de Gateway");

  let copied = 0;
  let failed = 0;
  for (let i = 0; i < objects.length; i++) {
    const item = objects[i];
    const bucket = String(item.bucket);
    const storagePath = String(item.name);
    state.stage = "files";
    state.file = `${bucket}/${storagePath}`;
    state.files = { copied, failed, total: objects.length, current: i + 1 };
    persist(state);
    try {
      const bytes = await downloadStorageObject(jwt, bucket, storagePath, item.public === true);
      const parts = storagePath.split("/").filter((part) => part && part !== "." && part !== "..");
      const target = path.resolve(fileRoot, bucket, ...parts);
      const allowedRoot = path.resolve(fileRoot, bucket) + path.sep;
      if (!(target + path.sep).startsWith(allowedRoot) && !target.startsWith(allowedRoot)) {
        throw new Error("Ongeldig opslagpad");
      }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, bytes);
      copied++;
    } catch (error) {
      failed++;
      state.warnings ||= [];
      state.warnings.push(`Storage ${bucket}/${storagePath}: ${error.message}`);
    }
  }
  state.files = { copied, failed, total: objects.length };
  persist(state);
  return { copied, failed, total: objects.length };
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
    const runtimeCatalog = await loadRuntimeCatalog(jwt);
    const storageObjects = await loadStorageObjects(jwt);
    state.authIdentityCount = authIdentities.length;
    state.storageObjectCount = storageObjects.length;
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
        await preparePostgrestRuntime(client);
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

        state.stage = "runtime-security";
        persist(state);
        await applyRuntimeCatalog(client, runtimeCatalog, (p) => { state.stage = p.stage; state.current = p; persist(state); });

        await writeTargetBackendMeta(client, {
          active_backend: "staged",
          source: "supabase",
          details: { catalogChecksum: state.catalogChecksum, verifiedAt: new Date().toISOString() },
        });

        const fileResult = await copyStorageObjects(jwt, storageObjects, fileRoot, state);
        const strictFiles = process.env.PULSE_FILE_MIGRATION_STRICT !== "0";
        if (strictFiles && fileResult.failed > 0) {
          throw new Error(`${fileResult.failed} PULSE Storage-bestand(en) konden niet worden gekopieerd. Omschakeling is geblokkeerd zodat geen bijlagen/assets verloren gaan.`);
        }

        const gatewayBase = String(process.env.PULSE_GATEWAY_PUBLIC_URL || "").replace(/\/$/, "");
        if (gatewayBase) {
          state.stage = "rewrite-storage-urls";
          persist(state);
          state.storageUrlRewrite = await rewriteSupabaseStorageUrls(
            client,
            sourceStorageBase(),
            gatewayBase,
            (p) => { state.stage = p.stage; state.current = p; persist(state); },
          );
        } else if (storageObjects.some((x) => x?.public === true)) {
          state.warnings.push("Publieke Storage-assets zijn gekopieerd, maar PULSE_GATEWAY_PUBLIC_URL ontbreekt; bestaande publieke Supabase-URL's konden niet automatisch worden herschreven.");
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
