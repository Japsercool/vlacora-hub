import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const migrationsDir = path.resolve("migrations");

function checksum(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export async function applyLocalMigrations(client, progress) {
  await client.query("create schema if not exists pulse_meta");
  await client.query(`create table if not exists pulse_meta.schema_migrations(
    version text primary key,
    applied_at timestamptz not null default now(),
    checksum text not null,
    details jsonb not null default '{}'::jsonb
  )`);

  if (!fs.existsSync(migrationsDir)) return [];
  const files = fs.readdirSync(migrationsDir).filter((x) => x.endsWith(".sql")).sort();
  const applied = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const version = file.replace(/\.sql$/i, "");
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    const hash = checksum(sql);
    progress?.({ stage: "target-migrations", file, index: i + 1, total: files.length });
    const existing = await client.query("select checksum from pulse_meta.schema_migrations where version=$1", [version]);
    if (existing.rowCount) {
      if (existing.rows[0].checksum !== hash) throw new Error(`Doelmigratie ${version} is gewijzigd nadat ze al werd toegepast`);
      continue;
    }
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query(
        "insert into pulse_meta.schema_migrations(version,checksum,details) values($1,$2,$3::jsonb)",
        [version, hash, JSON.stringify({ file })],
      );
      await client.query("commit");
      applied.push(version);
    } catch (error) {
      await client.query("rollback");
      throw new Error(`Doelmigratie ${version} mislukt: ${error.message}`);
    }
  }
  return applied;
}
