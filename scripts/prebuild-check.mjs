import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const problems = [];
const skippedDirs = new Set(["node_modules", ".next", ".git", ".vercel"]);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && skippedDirs.has(entry.name)) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}

// Older VLACORA releases accidentally shipped this ambient declaration file.
// When a new ZIP is copied over an existing Git checkout, Git keeps stale tracked files.
// Remove the legacy stub in the ephemeral/local build workspace before TypeScript/Next.js loads it.
const staleStubPaths = walk(root).filter((file) => path.basename(file) === "external-stubs.d.ts");
for (const file of staleStubPaths) {
  try {
    fs.unlinkSync(file);
    console.log(`VLACORA prebuild cleanup: removed stale ${path.relative(root, file)}.`);
  } catch (error) {
    problems.push(`Kon stale ${path.relative(root, file)} niet verwijderen: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const appDir = path.join(root, "app");
const routes = walk(appDir).filter((file) => file.endsWith(`${path.sep}route.ts`));
for (const file of routes) {
  const source = fs.readFileSync(file, "utf8");
  if (/\bNextRequest\b/.test(source)) {
    problems.push(`${path.relative(root, file)} bevat NextRequest; route handlers moeten globalThis.Request gebruiken.`);
  }
  const handler = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(([^)]*)\)/g;
  for (const match of source.matchAll(handler)) {
    const args = match[2].trim();
    if (args && !/globalThis\.Request/.test(args.split(",")[0])) {
      problems.push(`${path.relative(root, file)} ${match[1]} gebruikt geen expliciete globalThis.Request-signature: ${args}`);
    }
  }
}

const cssFile = path.join(root, "app", "globals.css");
if (fs.existsSync(cssFile)) {
  const css = fs.readFileSync(cssFile, "utf8");
  const mixed = /(?:align-items|align-content|align-self|justify-content|justify-self|place-items|place-content|place-self)\s*:\s*(?:start|end)(?=[;}])/g;
  const matches = css.match(mixed) || [];
  if (matches.length) problems.push(`globals.css bevat ${matches.length} niet-geprefixte start/end flex/grid waarde(n): ${[...new Set(matches)].join(", ")}`);
}

// Cleanup must have succeeded: none may remain in the source tree.
const remainingStubs = walk(root).filter((file) => path.basename(file) === "external-stubs.d.ts");
for (const file of remainingStubs) {
  problems.push(`${path.relative(root, file)} kon niet worden opgeschoond en mag niet aan Next.js worden aangeboden.`);
}

if (problems.length) {
  console.error("VLACORA prebuild-check FAILED:\n- " + problems.join("\n- "));
  process.exit(1);
}

console.log(`VLACORA prebuild-check OK: ${routes.length} route.ts-bestanden gecontroleerd; stale type-stubs opgeschoond.`);
