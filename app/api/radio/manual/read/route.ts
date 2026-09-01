export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest,NextResponse } from "next/server";
import { normalizeNow,normalizePlaylist,normalizeStations } from "@/lib/radio/normalize";
import { describeError,runtimeInfo,tcpProbe } from "@/lib/radio/diagnostics";

function isPublicIpv4(host:string){
  const p=host.split(".").map(Number);if(p.length!==4||p.some(n=>!Number.isInteger(n)||n<0||n>255))return false;
  const[a,b]=p;if(a===10||a===127||a===0||a>=224)return false;if(a===169&&b===254)return false;if(a===172&&b>=16&&b<=31)return false;if(a===192&&b===168)return false;if(a===100&&b>=64&&b<=127)return false;return true;
}
function safePath(path:string){
  if(!path.startsWith("/"))throw new Error("Endpoint moet met / beginnen.");
  if(path.includes("\\")||path.includes("..")||path.includes("://"))throw new Error("Ongeldig endpoint.");
  return path;
}
export async function POST(request:NextRequest){
  const started=Date.now();let body:any;try{body=await request.json()}catch{return NextResponse.json({error:"Ongeldige aanvraag"},{status:400})}
  const cfg=body.config||{};const kind=String(body.kind||"");const action=String(body.action||"raw");
  if(!["rotation","playout","shoutcast"].includes(kind))return NextResponse.json({error:"Onbekende integratie"},{status:400});
  if(!["raw","stations","playlist","now"].includes(action))return NextResponse.json({error:"Ongeldige leesactie"},{status:400});
  if(!["http","https"].includes(cfg.protocol))return NextResponse.json({error:"Protocol moet http of https zijn"},{status:400});
  if(!isPublicIpv4(String(cfg.host||"")))return NextResponse.json({error:"Alleen een geldig openbaar IPv4-adres is toegestaan."},{status:400});
  const port=Number(cfg.port||0);if(!Number.isInteger(port)||port<1||port>65535)return NextResponse.json({error:"Ongeldige poort"},{status:400});
  let path:string;try{path=safePath(String(body.path||"/"))}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Ongeldig endpoint"},{status:400})}
  const basePath=String(cfg.basePath||"").trim();if(basePath&&(!basePath.startsWith("/")||basePath.includes("..")||basePath.includes("://")))return NextResponse.json({error:"Ongeldig basis-pad"},{status:400});
  const target=`${cfg.protocol}://${cfg.host}:${port}${basePath}${path}`;
  const headers=new Headers({Accept:"application/json"});
  const apiKey=String(body.apiKey||"");const apiKeyHeader=String(body.apiKeyHeader||"Authorization").trim();const apiKeyPrefix=String(body.apiKeyPrefix||"Bearer").trim();
  if(apiKey){if(!/^[A-Za-z0-9-]{1,64}$/.test(apiKeyHeader))return NextResponse.json({error:"Ongeldige API-key headernaam"},{status:400});headers.set(apiKeyHeader,apiKeyPrefix?`${apiKeyPrefix} ${apiKey}`:apiKey)}
  const tcp=await tcpProbe(String(cfg.host),port,7000);if(!tcp.ok)return NextResponse.json({ok:false,error:`TCP ${tcp?.error?.code||"mislukt"}`,phase:"tcp",target,tcp,runtime:runtimeInfo()},{status:502});
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const res=await fetch(target,{method:"GET",headers,cache:"no-store",redirect:"error",signal:controller.signal});
    const text=await res.text();let raw:any=text;try{raw=JSON.parse(text)}catch{}
    if(!res.ok)return NextResponse.json({ok:false,error:typeof raw==="object"?(raw?.error||raw?.message||`HTTP ${res.status}`):`HTTP ${res.status}`,status:res.status,target,raw},{status:res.status});
    const normalized=action==="stations"?{stations:normalizeStations(raw)}:action==="playlist"?normalizePlaylist(raw):action==="now"?normalizeNow(raw):{};
    return NextResponse.json({ok:true,status:res.status,target,raw,...normalized,durationMs:Date.now()-started,runtime:runtimeInfo()});
  }catch(e){return NextResponse.json({ok:false,error:describeError(e)?.code||describeError(e)?.message||"fetch failed",target,detail:describeError(e),runtime:runtimeInfo()},{status:502})}
  finally{clearTimeout(timer)}
}
