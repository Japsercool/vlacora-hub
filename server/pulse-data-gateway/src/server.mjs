import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { encryptJson, decryptJson } from "./crypto.mjs";
import { testDb, withClient, writeTargetBackendMeta, preparePostgrestRuntime } from "./postgres-tools.mjs";
import { assertSourceSuperadmin, validateSupabaseSession } from "./source-supabase.mjs";
import { migrateSnapshot, readProgress } from "./migration-engine.mjs";
import { applyLocalMigrations } from "./target-migrations.mjs";

const app = express();
app.disable("x-powered-by");
const VERSION = "0.32.0";
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

async function authenticatedSession(req) {
  const raw = (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!raw) throw Object.assign(new Error("Geen Supabase sessie"), { status: 401 });
  let payload = null;
  try {
    ({ payload } = await jwtVerify(raw, JWKS, { issuer: ISSUER, audience: "authenticated" }));
  } catch {
    const user = await validateSupabaseSession(raw);
    payload = { sub: user?.id, email: user?.email, aud: "authenticated", legacyValidation: true };
  }
  if (!payload?.sub) throw Object.assign(new Error("Supabase sessie bevat geen geldige gebruiker"), { status: 401 });
  return { jwt: raw, payload };
}

async function localDataJwt(payload) {
  const secret = secretValue("PULSE_POSTGREST_JWT_SECRET", "PULSE_POSTGREST_JWT_SECRET_FILE");
  if (!secret) throw new Error("PULSE PostgREST JWT secret ontbreekt op de Gateway");
  return new SignJWT({ role: "authenticated", email: payload?.email || null })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(payload.sub))
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(Buffer.from(secret, "utf8"));
}

async function session(req) {
  const verified = await authenticatedSession(req);
  // Voor de eerste migratie controleren we de rol nog tegen de Supabase-bron.
  // Zodra de eigen backend actief is, komt autorisatie volledig uit de eigen
  // PostgreSQL en is Supabase alleen nog de identiteit-/JWT-provider.
  if (readBackendState().activeBackend === "external_postgres") {
    const c = stored();
    const allowed = await withClient(c, async (client) => {
      const q = await client.query(
        "select 1 from public.profiles where id=$1::uuid and active and lower(role)='superadmin' limit 1",
        [String(verified.payload.sub)],
      );
      return q.rowCount > 0;
    });
    if (!allowed) throw Object.assign(new Error("Alleen een PULSE-superadmin mag deze beheeractie uitvoeren"), { status: 403 });
  } else {
    await assertSourceSuperadmin(verified.jwt);
  }
  return verified;
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
  if (state.activeBackend !== "external_postgres") return;
  try {
    const c = stored();
    await withClient(c, async (client) => { await preparePostgrestRuntime(client); await applyLocalMigrations(client); });
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

app.get("/health/live", (_req, res) => {
  res.json({ ok: true, service: "PULSE Data Gateway", version: VERSION });
});

app.get("/health/ready", async (_req, res) => {
  try {
    const c = managedPostgresConfig() || (fs.existsSync(configFile) ? stored() : null);
    if (!c) return res.status(503).json({ ok: false, ready: false, reason: "postgres_not_configured", version: VERSION });
    const db = await testDb(c);
    res.json({ ok: true, ready: true, version: VERSION, database: db.db, postgresVersion: db.version, paired: Boolean(readPairingState().paired) });
  } catch (error) {
    res.status(503).json({ ok: false, ready: false, version: VERSION, reason: error.message });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "PULSE Data Gateway", version: VERSION, managedDocker: process.env.PULSE_POSTGRES_AUTOCONFIG === "1", paired: Boolean(readPairingState().paired), backend: readBackendState(), migration: readProgress(), domains: readDomainState() });
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

app.post("/admin/preflight", async (req, res, next) => {
  try {
    setup(req);
    await session(req);
    const c = stored();
    const db = await testDb(c);
    const fileRoot = (process.env.PULSE_FILE_ROOT || "").trim();
    let fileStorage = { configured: Boolean(fileRoot), writable: false, root: fileRoot || null, freeBytes: null };
    if (fileRoot) {
      fs.mkdirSync(fileRoot, { recursive: true });
      const probe = path.join(fileRoot, `.pulse-write-test-${process.pid}-${Date.now()}`);
      fs.writeFileSync(probe, "ok");
      fs.unlinkSync(probe);
      fileStorage.writable = true;
      try { fileStorage.freeBytes = Number(fs.statfsSync(fileRoot).bavail) * Number(fs.statfsSync(fileRoot).bsize); } catch {}
    }
    res.json({
      ok: true,
      version: VERSION,
      managedDocker: process.env.PULSE_POSTGRES_AUTOCONFIG === "1",
      postgres: { database: db.db, user: db.usr, version: db.version, host: c.host, port: c.port },
      fileStorage,
      paired: Boolean(readPairingState().paired),
      backend: readBackendState(),
      domains: readDomainState(),
      migration: readProgress(),
    });
  } catch (error) { next(error); }
});

app.post("/admin/upgrade", async (req, res, next) => {
  try {
    setup(req);
    await session(req);
    if (migrationJob) throw Object.assign(new Error("Upgrade kan niet terwijl een migratie loopt"), { status: 409 });
    const c = stored();
    const applied = await withClient(c, async (client) => { await preparePostgrestRuntime(client); return applyLocalMigrations(client); });
    res.json({ ok: true, version: VERSION, applied, message: applied.length ? `${applied.length} doelmigratie(s) toegepast.` : "Doeldatabase was al volledig bijgewerkt." });
  } catch (error) { next(error); }
});

app.post("/admin/diagnostics", async (req, res, next) => {
  try {
    setup(req);
    await session(req);
    let postgres = null;
    try { const c = stored(); const db = await testDb(c); postgres = { ok: true, database: db.db, user: db.usr, version: db.version, host: c.host, port: c.port }; }
    catch (error) { postgres = { ok: false, error: error.message }; }
    res.json({ ok: true, version: VERSION, postgres, backend: readBackendState(), migration: readProgress(), domains: readDomainState(), paired: readPairingState(), origins: effectiveOrigins() });
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
    try {
      const c = stored();
      await withClient(c, (client) => writeTargetBackendMeta(client, {
        active_backend: "supabase",
        source: "supabase",
        activated_at: null,
        details: { rolledBackAt: new Date().toISOString() },
      }));
    } catch (targetError) {
      console.warn("PULSE rollback metadata kon niet naar het doel worden geschreven:", targetError.message);
    }
    writeBackendState({ activeBackend: "supabase", previousBackend: current.activeBackend || "external_postgres", activatedAt: null, fingerprint: current.fingerprint || "" });
    res.json({ ok: true, status: "rollback", message: "De Gateway staat terug op Supabase. De eigen PostgreSQL-data is niet verwijderd." });
  } catch (error) { next(error); }
});



function dataFileRoot() {
  const root = String(process.env.PULSE_FILE_ROOT || "").trim();
  if (!root) throw new Error("PULSE_FILE_ROOT ontbreekt op de Gateway");
  return path.resolve(root);
}
function publicFileBuckets() {
  return new Set(String(process.env.PULSE_PUBLIC_FILE_BUCKETS || "vlacora-profile-photos,vlacora-program-assets,vlacora-social-assets").split(",").map(x=>x.trim()).filter(Boolean));
}
function safeDataFile(bucket, objectPath) {
  const root=dataFileRoot();
  const cleanBucket=String(bucket||"").replace(/[^a-zA-Z0-9._-]/g,"");
  const decoded=String(objectPath||"").split("/").map(x=>decodeURIComponent(x)).filter(Boolean);
  if (!cleanBucket || decoded.some(x=>x===".." || x.includes("\\"))) throw Object.assign(new Error("Ongeldig bestandspad"),{status:400});
  const target=path.resolve(root,cleanBucket,...decoded);
  if (!target.startsWith(path.resolve(root)+path.sep)) throw Object.assign(new Error("Ongeldig bestandspad"),{status:400});
  return {target,cleanBucket,storagePath:decoded.join("/")};
}
async function postgrestUserFetch(payload, suffix, init={}) {
  const base=String(process.env.PULSE_POSTGREST_URL||"http://postgrest:3000").replace(/\/$/,"");
  const jwt=await localDataJwt(payload);
  return fetch(base+suffix,{...init,headers:{...(init.headers||{}),authorization:`Bearer ${jwt}`,accept:"application/json"}});
}
async function assertPrivateFileReadable(payload,bucket,storagePath) {
  if (publicFileBuckets().has(bucket)) return;
  if (bucket !== "vlacora-hub-files") throw Object.assign(new Error("Privé bucket niet toegestaan"),{status:403});
  const q=`/hub_attachments?storage_path=eq.${encodeURIComponent(storagePath)}&select=id&limit=1`;
  const r=await postgrestUserFetch(payload,q);
  if (!r.ok) throw Object.assign(new Error("Bestandsrechten konden niet worden gecontroleerd"),{status:r.status});
  const rows=await r.json();
  if (!Array.isArray(rows)||!rows.length) throw Object.assign(new Error("Geen toegang tot dit bestand"),{status:403});
}

app.put(/^\/data\/files\/([^/]+)\/(.+)$/, express.raw({type:"*/*",limit:"100mb"}), async(req,res,next)=>{
  try{
    if(readBackendState().activeBackend!=="external_postgres")return res.status(409).json({error:"Eigen PostgreSQL is niet actief"});
    await authenticatedSession(req);
    const {target,cleanBucket,storagePath}=safeDataFile(req.params[0],req.params[1]);
    if(fs.existsSync(target)&&req.get("x-pulse-upsert")!=="1")return res.status(409).json({error:"Bestand bestaat al"});
    fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,Buffer.isBuffer(req.body)?req.body:Buffer.from(req.body||""));
    res.json({path:storagePath,fullPath:`${cleanBucket}/${storagePath}`});
  }catch(e){next(e)}
});
app.get(/^\/data\/files\/public\/([^/]+)\/(.+)$/,async(req,res,next)=>{
  try{const {target,cleanBucket}=safeDataFile(req.params[0],req.params[1]);if(!publicFileBuckets().has(cleanBucket))return res.status(403).json({error:"Bucket is niet publiek"});if(!fs.existsSync(target))return res.status(404).end();res.sendFile(target)}catch(e){next(e)}
});
app.get(/^\/data\/files\/authenticated\/([^/]+)\/(.+)$/,async(req,res,next)=>{
  try{const verified=await authenticatedSession(req);const {target,cleanBucket,storagePath}=safeDataFile(req.params[0],req.params[1]);await assertPrivateFileReadable(verified.payload,cleanBucket,storagePath);if(!fs.existsSync(target))return res.status(404).end();res.sendFile(target)}catch(e){next(e)}
});
app.delete(/^\/data\/files\/([^/]+)$/,async(req,res,next)=>{
  try{const verified=await authenticatedSession(req);const bucket=req.params[0];const paths=Array.isArray(req.body?.paths)?req.body.paths:[];const removed=[];for(const objectPath of paths){const f=safeDataFile(bucket,objectPath);await assertPrivateFileReadable(verified.payload,f.cleanBucket,f.storagePath);if(fs.existsSync(f.target))fs.rmSync(f.target,{force:true});removed.push({name:f.storagePath})}res.json({data:removed})}catch(e){next(e)}
});

app.all(/^\/data\/rest\/v1(?:\/.*)?$/, async (req, res, next) => {
  try {
    const backend = readBackendState();
    if (backend.activeBackend !== "external_postgres") {
      return res.status(409).json({ error: "Eigen PostgreSQL is nog niet de actieve PULSE-data-backend" });
    }
    const verified = await authenticatedSession(req);
    const localJwt = await localDataJwt(verified.payload);
    const base = String(process.env.PULSE_POSTGREST_URL || "http://postgrest:3000").replace(/\/$/, "");
    const suffix = req.originalUrl.replace(/^\/data\/rest\/v1/, "");
    const headers = {
      authorization: `Bearer ${localJwt}`,
      accept: req.get("accept") || "application/json",
      "content-type": req.get("content-type") || "application/json",
    };
    for (const h of ["prefer","range","range-unit","content-profile","accept-profile","if-match","if-none-match"]) {
      const v=req.get(h); if (v) headers[h]=v;
    }
    const init = { method: req.method, headers };
    if (!["GET","HEAD"].includes(req.method)) init.body = JSON.stringify(req.body ?? {});
    const upstream = await fetch(base + suffix, init);
    const body = Buffer.from(await upstream.arrayBuffer());
    for (const h of ["content-type","content-range","range-unit","preference-applied","location","etag"]) {
      const v=upstream.headers.get(h); if (v) res.setHeader(h,v);
    }
    res.status(upstream.status).send(body);
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || "Gateway fout" });
});

void bootstrapActiveTarget();
app.listen(PORT, "0.0.0.0", () => console.log(`PULSE Data Gateway ${VERSION} listening on ${PORT}`));
