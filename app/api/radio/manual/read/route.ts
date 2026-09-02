export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest,NextResponse } from "next/server";
import { normalizeChartEdition,normalizeChartEditions,normalizeCharts,normalizeMusicFolders,normalizeMusicSongs,normalizeNow,normalizePlaylist,normalizeRevision,normalizeShoutcastStats,normalizeStations } from "@/lib/radio/normalize";
import { runtimeInfo,tcpProbe } from "@/lib/radio/diagnostics";
import { nativeError,nativeHttpGet } from "@/lib/radio/native-http";

function isPublicIpv4(host:string){
  const p=host.split(".").map(Number);if(p.length!==4||p.some(n=>!Number.isInteger(n)||n<0||n>255))return false;
  const[a,b]=p;if(a===10||a===127||a===0||a>=224)return false;if(a===169&&b===254)return false;if(a===172&&b>=16&&b<=31)return false;if(a===192&&b===168)return false;if(a===100&&b>=64&&b<=127)return false;return true;
}
function safePath(path:string){
  if(!path.startsWith("/"))throw new Error("Endpoint moet met / beginnen.");
  if(path.includes("\\")||path.includes("..")||path.includes("://"))throw new Error("Ongeldig endpoint.");
  return path;
}

function normalizeApiKey(value:string){
  return String(value||"").trim()
    .replace(/^Authorization\s*:\s*Bearer\s+/i,"")
    .replace(/^X-Playout-Api-Key\s*:\s*/i,"")
    .replace(/^Bearer\s+/i,"")
    .trim();
}
function baseHeaders(kind:string){return{Accept:kind==="shoutcast"?"application/xml,text/xml,application/json;q=0.9,*/*;q=0.8":"application/json"} as Record<string,string>}
function authHeaders(kind:string,apiKey:string,apiKeyHeader:string,apiKeyPrefix:string,mode:"configured"|"bearer"|"x-key"){
  const headers=baseHeaders(kind);
  if(!apiKey)return headers;
  if(kind==="playout"){
    if(mode==="x-key")headers["X-Playout-Api-Key"]=apiKey;
    else headers["Authorization"]=`Bearer ${apiKey}`;
    return headers;
  }
  if(!/^[A-Za-z0-9-]{1,64}$/.test(apiKeyHeader))throw new Error("Ongeldige API-key headernaam");
  headers[apiKeyHeader]=apiKeyPrefix?`${apiKeyPrefix} ${apiKey}`:apiKey;
  return headers;
}

export async function POST(request:NextRequest){
  const started=Date.now();let body:any;try{body=await request.json()}catch{return NextResponse.json({error:"Ongeldige aanvraag"},{status:400})}
  const cfg=body.config||{};const kind=String(body.kind||"");const action=String(body.action||"raw");
  if(!["rotation","playout","shoutcast"].includes(kind))return NextResponse.json({error:"Onbekende integratie"},{status:400});
  if(!["raw","stations","playlist","now","folders","songs","charts","chartEditions","chartEdition","revision","shoutcast"].includes(action))return NextResponse.json({error:"Ongeldige leesactie"},{status:400});
  if(!["http","https"].includes(cfg.protocol))return NextResponse.json({error:"Protocol moet http of https zijn"},{status:400});
  if(!isPublicIpv4(String(cfg.host||"")))return NextResponse.json({error:"Alleen een geldig openbaar IPv4-adres is toegestaan."},{status:400});
  const port=Number(cfg.port||0);if(!Number.isInteger(port)||port<1||port>65535)return NextResponse.json({error:"Ongeldige poort"},{status:400});
  let path:string;try{path=safePath(String(body.path||"/"))}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Ongeldig endpoint"},{status:400})}
  const basePath=String(cfg.basePath||"").trim();if(basePath&&(!basePath.startsWith("/")||basePath.includes("..")||basePath.includes("://")))return NextResponse.json({error:"Ongeldig basis-pad"},{status:400});
  const target=`${cfg.protocol}://${cfg.host}:${port}${basePath}${path}`;
  const apiKey=normalizeApiKey(String(body.apiKey||""));const apiKeyHeader=String(body.apiKeyHeader||"Authorization").trim();const apiKeyPrefix=String(body.apiKeyPrefix||"Bearer").trim();

  try{
    let authMode:"configured"|"bearer"|"x-key"=kind==="playout"?"bearer":"configured";
    let result=await nativeHttpGet(target,authHeaders(kind,apiKey,apiKeyHeader,apiKeyPrefix,authMode),25000);
    const authAttempts:string[]=[authMode];
    if(kind==="playout"&&apiKey&&result.status===401){
      authMode="x-key";
      result=await nativeHttpGet(target,authHeaders(kind,apiKey,apiKeyHeader,apiKeyPrefix,authMode),25000);
      authAttempts.push(authMode);
    }
    let raw:any=result.text;try{raw=JSON.parse(result.text)}catch{}
    if(result.status<200||result.status>=300){
      const requiredScope=typeof raw==="object"?String(raw?.requiredScope||""):"";
      const baseError=typeof raw==="object"?(raw?.error||raw?.message||`HTTP ${result.status}`):`HTTP ${result.status}`;
      const error=kind==="playout"&&result.status===401&&apiKey
        ?`De Playout One API-sleutel is in VLACORA geladen, maar Hub :5099 weigert hem${requiredScope?` voor scope ${requiredScope}`:""}. Controleer of dit de actuele po1_-sleutel van deze Hub is, niet ingetrokken/verlopen is en de vereiste read-scopes heeft.`
        :baseError;
      return NextResponse.json({ok:false,error,status:result.status,target,raw,requiredScope,authKeyPresent:Boolean(apiKey),authKeyLooksLikePlayout:apiKey.startsWith("po1_"),authAttempts,transport:result.transport},{status:result.status||502});
    }
    const normalized=action==="stations"?{stations:normalizeStations(raw)}:action==="playlist"?normalizePlaylist(raw):action==="now"?normalizeNow(raw):action==="folders"?{folders:normalizeMusicFolders(raw)}:action==="songs"?{songs:normalizeMusicSongs(raw)}:action==="charts"?{charts:normalizeCharts(raw)}:action==="chartEditions"?{editions:normalizeChartEditions(raw)}:action==="chartEdition"?{edition:normalizeChartEdition(raw)}:action==="revision"?{revision:normalizeRevision(raw)}:action==="shoutcast"?{shoutcast:normalizeShoutcastStats(raw)}:{};
    return NextResponse.json({ok:true,status:result.status,target,raw,...normalized,durationMs:Date.now()-started,httpDurationMs:result.durationMs,transport:result.transport,runtime:runtimeInfo(),auth:{keyPresent:Boolean(apiKey),playoutKeyFormat:kind==="playout"?apiKey.startsWith("po1_"):undefined,mode:authMode}});
  }catch(e){
    const detail=nativeError(e);const tcp=await tcpProbe(String(cfg.host),port,5000);
    return NextResponse.json({ok:false,error:detail.code==="ETIMEDOUT"?"HTTP timeout":detail.code||detail.message,target,detail,tcp,phase:detail.code==="ETIMEDOUT"?"http-timeout":"http-native",runtime:runtimeInfo()},{status:502});
  }
}
