import { NextRequest, NextResponse } from "next/server";

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

export async function POST(request:NextRequest) {
  let body:any;
  try{body=await request.json()}catch{return NextResponse.json({error:"Ongeldige aanvraag"},{status:400})}
  const cfg:BodyConfig=body.config||{};
  const kind=String(body.kind||"");
  const action=String(body.action||"status");

  if(!["rotation","playout","shoutcast"].includes(kind))return NextResponse.json({error:"Onbekende integratie"},{status:400});
  if(!["status","stations"].includes(action))return NextResponse.json({error:"Alleen read-only tests zijn toegestaan"},{status:405});
  if(!["http","https"].includes(cfg.protocol))return NextResponse.json({error:"Protocol moet http of https zijn"},{status:400});
  if(!isPublicIpv4(String(cfg.host||"")))return NextResponse.json({error:"Gebruik hier alleen een geldig openbaar IPv4-adres. Lokale/private adressen worden door de Vercel proxy geblokkeerd."},{status:400});

  const port=Number(cfg.port||0);
  if(!Number.isInteger(port)||port<1||port>65535)return NextResponse.json({error:"Ongeldige poort"},{status:400});

  let path:string;
  try{path=safePath(action==="stations"?String(cfg.stationPath||"/api/v1/stations"):String(cfg.statusPath||"/api/v1/status"))}
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Ongeldig endpoint"},{status:400})}

  const basePath=String(cfg.basePath||"").trim();
  if(basePath && (!basePath.startsWith("/")||basePath.includes("..")||basePath.includes("://")))return NextResponse.json({error:"Ongeldig basis-pad"},{status:400});

  const url=`${cfg.protocol}://${cfg.host}:${port}${basePath}${path}`;
  const headers=new Headers({"Accept":"application/json"});
  const apiKey=String(body.apiKey||"");
  const apiKeyHeader=String(body.apiKeyHeader||"Authorization").trim();
  const apiKeyPrefix=String(body.apiKeyPrefix||"Bearer").trim();

  if(apiKey){
    if(!/^[A-Za-z0-9-]{1,64}$/.test(apiKeyHeader))return NextResponse.json({error:"Ongeldige API-key headernaam"},{status:400});
    headers.set(apiKeyHeader,apiKeyPrefix?`${apiKeyPrefix} ${apiKey}`:apiKey);
  }

  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),8000);
  try{
    const res=await fetch(url,{method:"GET",headers,cache:"no-store",redirect:"error",signal:controller.signal});
    const text=await res.text();
    let preview:any=text.slice(0,3000);
    try{preview=JSON.parse(text)}catch{}
    return NextResponse.json({ok:res.ok,status:res.status,url:`${cfg.protocol}://${cfg.host}:${port}${basePath}${path}`,preview});
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:"Radio API niet bereikbaar"},{status:502});
  }finally{clearTimeout(timer)}
}
