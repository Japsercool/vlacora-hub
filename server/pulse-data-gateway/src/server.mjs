import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { encryptJson, decryptJson } from "./crypto.mjs";
import { testDb, withClient, writeTargetBackendMeta } from "./postgres-tools.mjs";
import { assertSourceSuperadmin, validateSupabaseSession } from "./source-supabase.mjs";
import { migrateSnapshot, readProgress } from "./migration-engine.mjs";
import { applyLocalMigrations } from "./target-migrations.mjs";

const app = express();
const PORT = Number(process.env.PORT || 8787);
function secretValue(envName, fileEnvName) {
  const direct = (process.env[envName] || "").trim();
  if (direct) return direct;
  const file = (process.env[fileEnvName] || "").trim();
  if (!file) return "";
  try { return fs.readFileSync(file, "utf8").trim(); } catch { return ""; }
}

const AUTH_URL = (process.env.SUPABASE_AUTH_URL || "").replace(/\/$/, "");
if (!AUTH_URL) throw new Error("SUPABASE_AUTH_URL ontbreekt");
const ISSUER = process.env.SUPABASE_AUTH_ISSUER || `${AUTH_URL}/auth/v1`;
const JWKS = createRemoteJWKSet(new URL(`${AUTH_URL}/auth/v1/.well-known/jwks.json`));
const dataDir = path.resolve("data");
const configFile = path.join(dataDir, "postgres.enc");
const backendStateFile = path.join(dataDir, "backend-state.json");
const pairingStateFile = path.join(dataDir, "pairing-state.json");
const domainStateFile = path.join(dataDir, "domains.json");
fs.mkdirSync(dataDir, { recursive: true });

function normalizeOrigin(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try { return new URL(raw).origin; } catch { return ""; }
}

function envOrigins() {
  return [process.env.PULSE_PUBLIC_URL || "", ...(process.env.PULSE_ALLOWED_ORIGIN || "").split(",")]
    .map(normalizeOrigin)
    .filter(Boolean);
}

function readDomainState() {
  const fallback = {
    siteUrl: String(process.env.PULSE_PUBLIC_URL || "").trim().replace(/\/$/, ""),
    gatewayPublicUrl: String(process.env.PULSE_GATEWAY_PUBLIC_URL || "").trim().replace(/\/$/, ""),
    allowedOrigins: envOrigins(),
    updatedAt: null,
  };
  if (!fs.existsSync(domainStateFile)) return fallback;
  try {
    const saved = JSON.parse(fs.readFileSync(domainStateFile, "utf8"));
    const allowed = Array.from(new Set([...(saved.allowedOrigins || []), ...envOrigins()].map(normalizeOrigin).filter(Boolean)));
    return { ...fallback, ...saved, allowedOrigins: allowed };
  } catch { return fallback; }
}

function writeDomainState(state) {
  const next = {
    siteUrl: String(state.siteUrl || "").trim().replace(/\/$/, ""),
    gatewayPublicUrl: String(state.gatewayPublicUrl || "").trim().replace(/\/$/, ""),
    allowedOrigins: Array.from(new Set((state.allowedOrigins || []).map(normalizeOrigin).filter(Boolean))),
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(domainStateFile, JSON.stringify(next, null, 2), { mode: 0o600 });
  return next;
}

function effectiveOrigins() {
  return Array.from(new Set([...readDomainState().allowedOrigins, ...envOrigins()].map(normalizeOrigin).filter(Boolean)));
}

app.use(express.json({ limit: "2mb" }));
app.use(cors({
  credentials: false,
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const normalized = normalizeOrigin(origin);
    if (normalized && effectiveOrigins().includes(normalized)) return callback(null, true);
    return callback(Object.assign(new Error(`Origin niet toegestaan door PULSE Gateway: ${origin}`), { status: 403 }));
  },
}));

let migrationJob = null;

function readPairingState() {
  if (!fs.existsSync(pairingStateFile)) return { paired: false };
  try { return JSON.parse(fs.readFileSync(pairingStateFile, "utf8")); }
  catch { return { paired: false }; }
}

function writePairingState(state) {
  fs.writeFileSync(pairingStateFile, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
}

function setup(req, { requireCode = false } = {}) {
  const paired = readPairingState();
  if (paired.paired && !requireCode) return;
  const expected = secretValue("PULSE_GATEWAY_SETUP_TOKEN", "PULSE_GATEWAY_SETUP_TOKEN_FILE");
  if (!expected || req.get("x-pulse-setup-token") !== expected) {
    throw Object.assign(new Error(paired.paired ? "Ongeldige PULSE setup-code" : "PULSE-server is nog niet gekoppeld. Vul de eenmalige setup-code in."), { status: 403 });
  }
}

async function session(req) {
  const raw = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!raw) throw Object.assign(new Error("Geen Supabase sessie"), { status: 401 });

  let payload = null;
  try {
    ({ payload } = await jwtVerify(raw, JWKS, { issuer: ISSUER, audience: "authenticated" }));
  } catch (jwksError) {
    // Legacy HS256-projecten publiceren geen bruikbare symmetrische sleutel via JWKS.
    // In dat geval valideert de Gateway de sessie rechtstreeks bij Supabase Auth.
    const user = await validateSupabaseSession(raw);
    payload = { sub: user?.id, email: user?.email, aud: "authenticated", legacyValidation: true };
  }

  if (!payload?.sub) throw Object.assign(new Error("Supabase sessie bevat geen geldige gebruiker"), { status: 401 });
  await assertSourceSuperadmin(raw);
  return { jwt: raw, payload };
}

function dbConfigFrom(body) {
  const c = body?.connection || body;
  if (!c?.host || !c?.database || !c?.user || !c?.password) {
    throw new Error("Host, database, gebruiker en wachtwoord zijn verplicht");
  }
  return {
    host: String(c.host).trim(),
    port: Number(c.port || 5432),
    database: String(c.database).trim(),
    user: String(c.user).trim(),
    password: String(c.password),
    ssl: c.ssl ? { rejectUnauthorized: process.env.PULSE_POSTGRES_ALLOW_SELF_SIGNED !== "1" } : false,
  };
}

function fingerprint(c) {
  return crypto.createHash("sha256").update(`${c.host}:${c.port}/${c.database}:${c.user}`).digest("hex").slice(0, 16);
}

function managedPostgresConfig() {
  if (process.env.PULSE_POSTGRES_AUTOCONFIG !== "1") return null;
  const password = secretValue("PULSE_POSTGRES_PASSWORD", "PULSE_POSTGRES_PASSWORD_FILE");
  const host = (process.env.PULSE_POSTGRES_HOST || "postgres").trim();
  const database = (process.env.PULSE_POSTGRES_DB || "pulse").trim();
  const user = (process.env.PULSE_POSTGRES_USER || "pulse_app").trim();
  if (!password || !host || !database || !user) return null;
  return {
    host,
    port: Number(process.env.PULSE_POSTGRES_PORT || 5432),
    database,
    user,
    password,
    ssl: process.env.PULSE_POSTGRES_SSL === "1"
      ? { rejectUnauthorized: process.env.PULSE_POSTGRES_ALLOW_SELF_SIGNED !== "1" }
      : false,
  };
}

function stored() {
  if (fs.existsSync(configFile)) {
    return decryptJson(fs.readFileSync(configFile, "utf8"), secretValue("PULSE_GATEWAY_MASTER_KEY", "PULSE_GATEWAY_MASTER_KEY_FILE"));
  }
  const managed = managedPostgresConfig();
  if (managed) return managed;
  throw new Error("Nog geen PostgreSQL-configuratie opgeslagen op de Gateway");
}

function readBackendState() {
  if (!fs.existsSync(backendStateFile)) {
    return { activeBackend: "supabase", previousBackend: "supabase", activatedAt: null, fingerprint: "" };
  }
  try { return JSON.parse(fs.readFileSync(backendStateFile, "utf8")); }
  catch { return { activeBackend: "supabase", previousBackend: "supabase", activatedAt: null, fingerprint: "" }; }
}

function writeBackendState(state) {
  fs.writeFileSync(backendStateFile, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2));
}

async function bootstrapActiveTarget() {
  const state = readBackendState();
  if (state.activeBackend !== "external_postgres" || !fs.existsSync(configFile)) return;
  try {
    const c = stored();
    await withClient(c, async (client) => { await applyLocalMigrations(client); });
    console.log("PULSE target migrations checked");
  } catch (error) {
    console.error("PULSE target migration bootstrap failed", error);
  }
}

async function startMigration({ jwt, replaceExisting, activateAfter = false }) {
  if (migrationJob) throw Object.assign(new Error("Er loopt al een PULSE-datamigratie"), { status: 409 });
  const targetConfig = stored();
  const fileRoot = (process.env.PULSE_FILE_ROOT || "").trim();
  migrationJob = (async () => {
    try {
      const result = await migrateSnapshot({ jwt, targetConfig, replaceExisting, fileRoot });
      if (activateAfter) {
        const now = new Date().toISOString();
        await withClient(targetConfig, (client) => writeTargetBackendMeta(client, {
          active_backend: "external_postgres",
          source: "supabase",
          activated_at: now,
          details: { migrationCompletedAt: result.completedAt, catalogChecksum: result.catalogChecksum },
        }));
        const current = readBackendState();
        writeBackendState({
          activeBackend: "external_postgres",
          previousBackend: current.activeBackend || "supabase",
          activatedAt: now,
          fingerprint: fingerprint(targetConfig),
        });
      }
    } catch (error) {
      console.error("PULSE migration failed", error);
    } finally {
      migrationJob = null;
    }
  })();
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "PULSE Data Gateway", version: "0.30.1", managedDocker: process.env.PULSE_POSTGRES_AUTOCONFIG === "1", paired: Boolean(readPairingState().paired), backend: readBackendState(), migration: readProgress(), domains: readDomainState() });
});

app.get("/runtime", (_req, res) => {
  res.json({ ok: true, ...readBackendState(), domains: readDomainState() });
});

app.post("/admin/domains/status", async (req, res, next) => {
  try {
    setup(req);
    await session(req);
    const state = readDomainState();
    res.json({
      ok: true,
      ...state,
      allowedOrigins: effectiveOrigins(),
      supabaseRedirectUrl: state.siteUrl ? `${state.siteUrl}/auth/callback` : "",
    });
  } catch (error) { next(error); }
});

app.post("/admin/domains/update", async (req, res, next) => {
  try {
    setup(req);
    await session(req);
    const siteUrl = String(req.body?.siteUrl || "").trim().replace(/\/$/, "");
    const gatewayPublicUrl = String(req.body?.gatewayPublicUrl || "").trim().replace(/\/$/, "");
    if (!siteUrl) throw new Error("PULSE website-URL ontbreekt");
    if (!normalizeOrigin(siteUrl)) throw new Error("PULSE website-URL is ongeldig");
    if (gatewayPublicUrl && !normalizeOrigin(gatewayPublicUrl)) throw new Error("Gateway URL is ongeldig");
    const requested = Array.isArray(req.body?.allowedOrigins) ? req.body.allowedOrigins : [];
    const currentRequestOrigin = normalizeOrigin(req.get("origin") || "");
    const allowedOrigins = Array.from(new Set([siteUrl, ...requested, currentRequestOrigin].map(normalizeOrigin).filter(Boolean)));
    const state = writeDomainState({ siteUrl, gatewayPublicUrl, allowedOrigins });
    res.json({
      ok: true,
      ...state,
      allowedOrigins: effectiveOrigins(),
      supabaseRedirectUrl: `${siteUrl}/auth/callback`,
      message: "PULSE URL-configuratie bijgewerkt zonder database- of accountmigratie.",
    });
  } catch (error) { next(error); }
});


app.post("/admin/pair", async (req, res, next) => {
  try {
    setup(req, { requireCode: true });
    const { payload } = await session(req);
    const state = {
      paired: true,
      pairedAt: new Date().toISOString(),
      pairedBy: String(payload.sub || ""),
      issuer: ISSUER,
    };
    writePairingState(state);
    res.json({ ok: true, ...state, managedDocker: process.env.PULSE_POSTGRES_AUTOCONFIG === "1" });
  } catch (error) { next(error); }
});

app.post("/admin/unpair", async (req, res, next) => {
  try {
    setup(req, { requireCode: true });
    await session(req);
    writePairingState({ paired: false, unpairedAt: new Date().toISOString() });
    res.json({ ok: true, paired: false });
  } catch (error) { next(error); }
});

app.post("/admin/postgres/managed-test", async (req, res, next) => {
  try {
    setup(req);
    await session(req);
    const c = managedPostgresConfig();
    if (!c) throw new Error("Deze Gateway is niet als beheerde PULSE Docker-server geconfigureerd");
    const result = await testDb(c);
    res.json({
      ok: true,
      managed: true,
      fingerprint: fingerprint(c),
      database: result.db,
      user: result.usr,
      version: result.version,
      host: c.host,
      port: c.port,
    });
  } catch (error) { next(error); }
});

app.post("/admin/postgres/test", async (req, res, next) => {
  try {
    setup(req);
    await session(req);
    const c = dbConfigFrom(req.body);
    const result = await testDb(c);
    res.json({ ok: true, fingerprint: fingerprint(c), database: result.db, user: result.usr, version: result.version });
  } catch (error) { next(error); }
});

app.post("/admin/postgres/configure", async (req, res, next) => {
  try {
    setup(req);
    await session(req);
    const c = dbConfigFrom(req.body);
    const result = await testDb(c);
    fs.writeFileSync(configFile, encryptJson(c, secretValue("PULSE_GATEWAY_MASTER_KEY", "PULSE_GATEWAY_MASTER_KEY_FILE")), { mode: 0o600 });
    res.json({ ok: true, fingerprint: fingerprint(c), database: result.db, user: result.usr, version: result.version });
  } catch (error) { next(error); }
});

app.post("/admin/migrate", async (req, res, next) => {
  try {
    setup(req);
    const { jwt } = await session(req);
    const c = stored();
    await testDb(c);
    await startMigration({ jwt, replaceExisting: Boolean(req.body?.replaceExisting), activateAfter: false });
    res.status(202).json({ ok: true, status: "migrating", message: "Migratie gestart. PULSE maakt het schema aan, kopieert alle tabellen en controleert de aantallen." });
  } catch (error) { next(error); }
});

app.post("/admin/switch", async (req, res, next) => {
  try {
    setup(req);
    const { jwt } = await session(req);
    const c = stored();
    await testDb(c);
    await startMigration({ jwt, replaceExisting: true, activateAfter: true });
    res.status(202).json({ ok: true, status: "final_sync", message: "Finale synchronisatie gestart. Na een volledige controle schakelt de Gateway automatisch naar eigen PostgreSQL." });
  } catch (error) { next(error); }
});

app.post("/admin/status", async (req, res, next) => {
  try {
    setup(req);
    await session(req);
    res.json({ ok: true, migration: readProgress(), backend: readBackendState(), running: Boolean(migrationJob) });
  } catch (error) { next(error); }
});

app.post("/admin/activate", async (req, res, next) => {
  try {
    setup(req);
    await session(req);
    if (migrationJob) throw Object.assign(new Error("Wacht tot de migratie klaar is"), { status: 409 });
    const progress = readProgress();
    if (progress.status !== "ready") throw new Error("De database is nog niet volledig gemigreerd en gecontroleerd");
    const c = stored();
    await testDb(c);
    const now = new Date().toISOString();
    await withClient(c, (client) => writeTargetBackendMeta(client, {
      active_backend: "external_postgres",
      source: "supabase",
      activated_at: now,
      details: { migrationCompletedAt: progress.completedAt, catalogChecksum: progress.catalogChecksum },
    }));
    const current = readBackendState();
    writeBackendState({ activeBackend: "external_postgres", previousBackend: current.activeBackend || "supabase", activatedAt: now, fingerprint: fingerprint(c) });
    res.json({ ok: true, status: "active", activatedAt: now });
  } catch (error) { next(error); }
});

app.post("/admin/rollback", async (req, res, next) => {
  try {
    setup(req);
    await session(req);
    if (migrationJob) throw Object.assign(new Error("Rollback kan niet terwijl een migratie loopt"), { status: 409 });
    const current = readBackendState();
    if (fs.existsSync(configFile)) {
      const c = stored();
      await withClient(c, (client) => writeTargetBackendMeta(client, {
        active_backend: "supabase",
        source: "supabase",
        activated_at: null,
        details: { rolledBackAt: new Date().toISOString() },
      }));
    }
    writeBackendState({ activeBackend: "supabase", previousBackend: current.activeBackend || "external_postgres", activatedAt: null, fingerprint: current.fingerprint || "" });
    res.json({ ok: true, status: "rollback", message: "De Gateway staat terug op Supabase. De eigen PostgreSQL-data is niet verwijderd." });
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || "Gateway fout" });
});

void bootstrapActiveTarget();
app.listen(PORT, "0.0.0.0", () => console.log(`PULSE Data Gateway 0.30.1 listening on ${PORT}`));
