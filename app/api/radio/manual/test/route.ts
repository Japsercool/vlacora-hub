export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { runtimeInfo, tcpProbe } from "@/lib/radio/diagnostics";
import { nativeError, nativeHttpGet } from "@/lib/radio/native-http";

type BodyConfig = {
  protocol:"http"|"https";
  host:string;
  port:string;
  basePath?:string;
  statusPath?:string;
  stationPath?:string;
};

function isPublicIpv4(host:string) {
  const parts=host.split(".");
  if(parts.length!==4)return false;
  const n=parts.map(x=>Number(x));
  if(n.some(x=>!Number.isInteger(x)||x<0||x>255))return false;
  const [a,b]=n;
  if(a===10||a===127||a===0)return false;
  if(a===169&&b===254)return false;
  if(a===172&&b>=16&&b<=31)return false;
  if(a===192&&b===168)return false;
  if(a===100&&b>=64&&b<=127)return false;
  if(a>=224)return false;
  return true;
}

function safePath(path:string) {
  if(!path.startsWith("/"))throw new Error("Endpoint moet met / beginnen.");
  if(path.includes("://")||path.includes("\\")||path.includes(".."))throw new Error("Ongeldig endpoint.");
  return path;
}

function normalizeApiKey(value:string){
  return String(value||"").trim()
    .replace(/^Authorization\s*:\s*Bearer\s+/i,"")
    .replace(/^X-Playout-Api-Key\s*:\s*/i,"")
    .replace(/^Bearer\s+/i,"")
    .trim();
}
function makeHeaders(kind:string,apiKey:string,apiKeyHeader:string,apiKeyPrefix:string,mode:"configured"|"bearer"|"x-key"){
  const headers:Record<string,string>={Accept:kind==="shoutcast"?"application/xml,text/xml,application/json;q=0.9,*/*;q=0.8":"application/json"};
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

export async function POST(request:NextRequest) {
  const started=Date.now();
  let body:any;
  try{body=await request.json()}catch{return NextResponse.json({error:"Ongeldige aanvraag"},{status:400})}

  const cfg:BodyConfig=body.config||{};
  const kind=String(body.kind||"");
  const action=String(body.action||"status");

  if(!["rotation","playout","shoutcast"].includes(kind))return NextResponse.json({error:"Onbekende integratie"},{status:400});
  if(!["status","stations"].includes(action))return NextResponse.json({error:"Alleen read-only tests zijn toegestaan"},{status:405});
  if(!["http","https"].includes(cfg.protocol))return NextResponse.json({error:"Protocol moet http of https zijn"},{status:400});
  if(!isPublicIpv4(String(cfg.host||"")))return NextResponse.json({error:"Gebruik alleen een geldig openbaar IPv4-adres."},{status:400});

  const port=Number(cfg.port||0);
  if(!Number.isInteger(port)||port<1||port>65535)return NextResponse.json({error:"Ongeldige poort"},{status:400});

  let path:string;
  try{
    path=safePath(action==="stations"?String(cfg.stationPath||"/api/v1/stations"):String(cfg.statusPath||"/api/v1/status"));
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:"Ongeldig endpoint"},{status:400});
  }

  const basePath=String(cfg.basePath||"").trim();
  if(basePath && (!basePath.startsWith("/")||basePath.includes("..")||basePath.includes("://")))return NextResponse.json({error:"Ongeldig basis-pad"},{status:400});

  const target=`${cfg.protocol}://${cfg.host}:${port}${basePath}${path}`;
  const apiKey=normalizeApiKey(String(body.apiKey||""));
  const apiKeyHeader=String(body.apiKeyHeader||"Authorization").trim();
  const apiKeyPrefix=String(body.apiKeyPrefix||"Bearer").trim();

  try{
    let authMode:"configured"|"bearer"|"x-key"=kind==="playout"?"bearer":"configured";
    let result=await nativeHttpGet(target,makeHeaders(kind,apiKey,apiKeyHeader,apiKeyPrefix,authMode),20000);
    const authAttempts:string[]=[authMode];
    if(kind==="playout"&&apiKey&&result.status===401){
      authMode="x-key";
      result=await nativeHttpGet(target,makeHeaders(kind,apiKey,apiKeyHeader,apiKeyPrefix,authMode),20000);
      authAttempts.push(authMode);
    }
    let preview:any=result.text.slice(0,3000);
    try{preview=JSON.parse(result.text)}catch{}
    const requiredScope=preview&&typeof preview==="object"?String(preview.requiredScope||""):"";
    const rejected=kind==="playout"&&result.status===401&&Boolean(apiKey);

    return NextResponse.json({
      ok:result.status>=200&&result.status<300,
      phase:"http",
      status:result.status,
      statusText:result.statusText,
      target,
      transport:result.transport,
      httpDurationMs:result.durationMs,
      totalDurationMs:Date.now()-started,
      runtime:runtimeInfo(),
      preview,
      requiredScope,
      auth:{keyPresent:Boolean(apiKey),playoutKeyFormat:kind==="playout"?apiKey.startsWith("po1_"):undefined,attempts:authAttempts,mode:authMode},
      message:rejected?`De opgeslagen Playout One sleutel wordt door Hub :5099 geweigerd${requiredScope?` voor scope ${requiredScope}`:""}.`:undefined
    },{status:result.status>=200&&result.status<300?200:result.status||502});
  }catch(e){
    const detail=nativeError(e);
    const tcp=await tcpProbe(String(cfg.host),port,5000);
    return NextResponse.json({
      ok:false,
      phase: detail.code==="ETIMEDOUT" ? "http-timeout" : "http-native",
      target,
      message: detail.code==="ETIMEDOUT"
        ? "De radio-integratie is bereikbaar, maar gaf niet tijdig een volledige HTTP-response terug."
        : "De native Node HTTP-aanvraag naar de radio-API mislukte.",
      transport:cfg.protocol==="https"?"node:https":"node:http",
      httpError:detail,
      tcp,
      runtime:runtimeInfo(),
      durationMs:Date.now()-started
    },{status:502});
  }
}
