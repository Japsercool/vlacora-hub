import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const roots = ["app", "components", "lib"].map((p) => path.join(root, p)).filter(fs.existsSync);
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const findings = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", "dist", "build"].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (extensions.has(path.extname(entry.name))) inspect(file);
  }
}

function inspect(file) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const hardcodedSite = /https?:\/\/[^\s"'`]+(?:\.vercel\.app|\/auth\/callback)/i.test(line);
    const localhostApi = /https?:\/\/(?:localhost|127\.0\.0\.1):\d+/i.test(line);
    if (hardcodedSite || localhostApi) findings.push(`${path.relative(root, file)}:${index + 1}: ${line.trim()}`);
  });
}

for (const dir of roots) walk(dir);
if (findings.length) {
  console.error("PULSE URL audit: mogelijke hardcoded publieke URL's gevonden:\n" + findings.join("\n"));
  process.exitCode = 2;
} else {
  console.log("PULSE URL audit OK: geen voor de hand liggende hardcoded site/Gateway URL's gevonden.");
}
