import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = ["app", "components", "lib"].map((x) => path.join(root, x)).filter(fs.existsSync);
const allowed = new Set([
  path.normalize("lib/supabase/client.ts"),
  path.normalize("lib/supabase/server.ts"),
  path.normalize("components/modules/database-backend-v2.tsx"),
]);
const patterns = [
  /\.from\s*\(\s*["'`][a-zA-Z0-9_]+["'`]\s*\)/g,
  /\.storage\.from\s*\(/g,
];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const hits = [];
for (const base of scanRoots) {
  for (const file of walk(base)) {
    const rel = path.normalize(path.relative(root, file));
    if (allowed.has(rel)) continue;
    const text = fs.readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (patterns.some((p) => { p.lastIndex = 0; return p.test(lines[i]); })) {
        hits.push(`${rel}:${i + 1}: ${lines[i].trim().slice(0, 180)}`);
      }
    }
  }
}

if (!hits.length) {
  console.log("PULSE data-layer audit: OK — geen directe tabel/storage-aanroepen buiten de toegestane infrastructuur gevonden.");
  process.exit(0);
}

console.error("PULSE data-layer audit: directe Supabase data-aanroepen gevonden. Voor een volledige runtime-cutover moeten deze via de centrale PULSE-datalaag lopen:");
for (const hit of hits) console.error(`- ${hit}`);
process.exit(2);
