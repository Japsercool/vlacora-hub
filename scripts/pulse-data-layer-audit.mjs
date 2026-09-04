import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const roots=["app","components","lib"].map(x=>path.join(root,x)).filter(fs.existsSync);
const findings=[];
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const f=path.join(dir,e.name);if(e.isDirectory()&&!['node_modules','.next','.git'].includes(e.name))return walk(f);return /\.(ts|tsx|js|jsx|mjs)$/.test(e.name)?[f]:[]})}
for(const base of roots){for(const file of walk(base)){
  const rel=path.normalize(path.relative(root,file));
  const text=fs.readFileSync(file,'utf8');
  if(rel!==path.normalize('lib/supabase/client.ts')&&rel!==path.normalize('lib/supabase/server.ts')&&rel!==path.normalize('app/auth/callback/route.ts')){
    if(/createBrowserClient\s*\(|createServerClient\s*\(/.test(text))findings.push(`${rel}: maakt zelf een Supabase-client en omzeilt mogelijk de centrale PULSE-router.`);
  }
  if(/https?:\/\/[^\s"'`]+\.supabase\.co\/rest\/v1\//i.test(text))findings.push(`${rel}: bevat een hardcoded Supabase Data API URL.`);
  if(/https?:\/\/[^\s"'`]+\.supabase\.co\/storage\/v1\//i.test(text))findings.push(`${rel}: bevat een hardcoded Supabase Storage URL.`);
}}
const central=fs.readFileSync(path.join(root,'lib/supabase/client.ts'),'utf8');
for(const required of ['createPulseFetch','pulse_backend_pointer','/data/rest/v1/','/data/files/'])if(!central.includes(required))findings.push(`lib/supabase/client.ts: centrale cutover-router mist ${required}.`);
if(findings.length){console.error('PULSE data-layer audit FAILED:\n- '+findings.join('\n- '));process.exit(2)}
console.log('PULSE data-layer audit OK: alle browserdata loopt via de gedeelde PULSE/Supabase-client; REST en Storage kunnen centraal naar de eigen Gateway worden omgeschakeld.');
