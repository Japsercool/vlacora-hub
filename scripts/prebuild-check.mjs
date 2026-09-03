import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const problems = [];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
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

const forbidden = ["external-stubs.d.ts"];
for (const name of forbidden) {
  const found = walk(root).find((file) => path.basename(file) === name);
  if (found) problems.push(`${path.relative(root, found)} mag niet in een release zitten.`);
}

if (problems.length) {
  console.error("VLACORA prebuild-check FAILED:\n- " + problems.join("\n- "));
  process.exit(1);
}

console.log(`VLACORA prebuild-check OK: ${routes.length} route.ts-bestanden gecontroleerd.`);
