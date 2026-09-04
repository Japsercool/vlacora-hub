import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const allowed = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const skip = new Set(["node_modules", ".next", ".git", ".vercel"]);
const hits = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (allowed.has(path.extname(entry.name))) {
      const text = fs.readFileSync(p, "utf8");
      if (text.includes("Databaseplan opslaan") && !p.endsWith("database-backend-v2.tsx") && !p.endsWith("verify-database-backend-integration.mjs")) hits.push(p);
    }
  }
}
walk(root);
if (hits.length) {
  console.error("OUDE DATABASE-BACKEND UI NOG ACTIEF/GECODEERD IN:");
  for (const h of hits) console.error(" -", path.relative(root, h));
  process.exit(2);
}
console.log("PASS: geen oude 'Databaseplan opslaan'-implementatie buiten database-backend-v2 gevonden.");
