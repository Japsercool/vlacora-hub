import pg from "pg";
const { Client } = pg;

export function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function safeDefault(expr) {
  if (!expr) return "";
  const s = String(expr).trim();
  const blocked = /\b(auth|storage|vault|extensions)\s*\./i;
  if (blocked.test(s)) return "";
  if (/nextval\s*\(/i.test(s)) return "";
  return s;
}

export function createClient(config) {
  return new Client({ ...config, connectionTimeoutMillis: 8000, statement_timeout: 120000 });
}

export async function withClient(config, fn) {
  const client = createClient(config);
  await client.connect();
  try { return await fn(client); } finally { await client.end(); }
}

export async function testDb(config) {
  return withClient(config, async (client) => {
    const r = await client.query("select current_database() db, current_user usr, current_setting('server_version') version");
    return r.rows[0];
  });
}

async function constraintExists(client, table, name) {
  const r = await client.query(
    "select 1 from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and t.relname=$1 and c.conname=$2 limit 1",
    [table, name],
  );
  return r.rowCount > 0;
}

async function indexExists(client, name) {
  const r = await client.query("select 1 from pg_indexes where schemaname='public' and indexname=$1 limit 1", [name]);
  return r.rowCount > 0;
}

export async function prepareTargetSchema(client, catalog, progress) {
  await client.query("create extension if not exists pgcrypto");
  await client.query("create schema if not exists pulse_meta");

  const tables = Array.isArray(catalog?.tables) ? catalog.tables : [];
  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    progress?.({ stage: "schema", table: table.name, index: i + 1, total: tables.length });
    const defs = (table.columns || []).map((col) => {
      const pieces = [quoteIdent(col.name), String(col.type_sql || "text")];
      const def = safeDefault(col.default_sql);
      if (def) pieces.push(`default ${def}`);
      if (col.not_null) pieces.push("not null");
      return pieces.join(" ");
    });
    await client.query(`create table if not exists public.${quoteIdent(table.name)} (${defs.join(", ")})`);

    for (const col of table.columns || []) {
      const def = safeDefault(col.default_sql);
      const pieces = [quoteIdent(col.name), String(col.type_sql || "text")];
      if (def) pieces.push(`default ${def}`);
      await client.query(`alter table public.${quoteIdent(table.name)} add column if not exists ${pieces.join(" ")}`);
    }
  }
}

export async function prepareAuthIdentityMirror(client, identities = []) {
  await client.query("create schema if not exists auth");
  await client.query(`create table if not exists auth.users(
    id uuid primary key,
    synced_at timestamptz not null default now()
  )`);
  const safe = Array.isArray(identities) ? identities.filter((x) => x?.id) : [];
  if (!safe.length) throw new Error("Supabase leverde geen Auth-identiteiten op; migratie wordt uit veiligheid niet voortgezet");
  await client.query(
    `insert into auth.users(id)
     select x.id
     from jsonb_to_recordset($1::jsonb) as x(id uuid)
     on conflict(id) do update set synced_at=now()`,
    [JSON.stringify(safe)],
  );
  await client.query(
    `delete from auth.users where not (id = any($1::uuid[]))`,
    [safe.map((x) => String(x.id))],
  );
  return safe.length;
}

export async function targetTableCounts(client, tables) {
  const out = {};
  for (const table of tables) {
    const r = await client.query(`select count(*)::bigint as n from public.${quoteIdent(table)}`);
    out[table] = Number(r.rows[0]?.n || 0);
  }
  return out;
}

export async function clearTargetTables(client, tables) {
  if (!tables.length) return;
  const list = tables.map((t) => `public.${quoteIdent(t)}`).join(", ");
  await client.query(`truncate table ${list} restart identity cascade`);
}

export async function insertJsonRows(client, table, rows) {
  if (!rows?.length) return 0;
  await client.query(
    `insert into public.${quoteIdent(table)} select * from jsonb_populate_recordset(null::public.${quoteIdent(table)}, $1::jsonb)`,
    [JSON.stringify(rows)],
  );
  return rows.length;
}

export async function applyConstraintsAndIndexes(client, catalog, progress) {
  const tables = Array.isArray(catalog?.tables) ? catalog.tables : [];
  const constraintPriority = { p: 1, u: 2, c: 3, f: 4 };

  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    progress?.({ stage: "constraints", table: table.name, index: i + 1, total: tables.length });
    const constraints = [...(table.constraints || [])].sort((a, b) => (constraintPriority[a.type] || 9) - (constraintPriority[b.type] || 9));
    for (const con of constraints) {
      if (await constraintExists(client, table.name, con.name)) continue;
      try {
        await client.query(`alter table public.${quoteIdent(table.name)} add constraint ${quoteIdent(con.name)} ${con.definition}`);
      } catch (error) {
        throw new Error(`Constraint ${con.name} op ${table.name} kon niet worden aangemaakt: ${error.message}`);
      }
    }
    for (const idx of table.indexes || []) {
      if (await indexExists(client, idx.name)) continue;
      let sql = String(idx.definition || "");
      if (!sql) continue;
      sql = sql.replace(/^CREATE INDEX /i, "CREATE INDEX IF NOT EXISTS ");
      sql = sql.replace(/^CREATE UNIQUE INDEX /i, "CREATE UNIQUE INDEX IF NOT EXISTS ");
      await client.query(sql);
    }
  }
}

export async function writeTargetBackendMeta(client, values) {
  await client.query(`create table if not exists pulse_meta.backend_state(
    singleton boolean primary key default true check (singleton),
    active_backend text not null,
    source text not null,
    activated_at timestamptz,
    updated_at timestamptz not null default now(),
    details jsonb not null default '{}'::jsonb
  )`);
  await client.query(
    `insert into pulse_meta.backend_state(singleton,active_backend,source,activated_at,details)
     values(true,$1,$2,$3,$4::jsonb)
     on conflict(singleton) do update set active_backend=excluded.active_backend, source=excluded.source, activated_at=excluded.activated_at, details=excluded.details, updated_at=now()`,
    [values.active_backend, values.source || "supabase", values.activated_at || null, JSON.stringify(values.details || {})],
  );

  if (["supabase", "external_postgres"].includes(values.active_backend)) {
    const hasConfig = await client.query(
      "select to_regclass('public.hub_data_backend_configs') is not null as present",
    );
    if (hasConfig.rows[0]?.present) {
      await client.query(
        `update public.hub_data_backend_configs
         set previous_backend = active_backend,
             active_backend = $1,
             status = $2,
             activated_at = $3,
             updated_at = now()
         where scope = 'global'`,
        [values.active_backend, values.active_backend === "external_postgres" ? "active" : "rollback", values.activated_at || null],
      );
    }
  }
}
