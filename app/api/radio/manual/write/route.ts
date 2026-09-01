export const runtime="nodejs";
export const dynamic="force-dynamic";
export const revalidate=0;

import {NextRequest,NextResponse} from "next/server";
import {createClient,isSupabaseServerConfigured} from "@/lib/supabase/server";
import {nativeError,nativeHttpJson} from "@/lib/radio/native-http";

function isPublicIpv4(host:string){
  const p=host.split(".").map(Number);if(p.length!==4||p.some(n=>!Number.isInteger(n)||n<0||n>255))return false;
  const[a,b]=p;if(a===10||a===127||a===0||a>=224)return false;if(a===169&&b===254)return false;if(a===172&&b>=16&&b<=31)return false;if(a===192&&b===168)return false;if(a===100&&b>=64&&b<=127)return false;return true;
}
function safePath(path:string){
  if(!path.startsWith("/")||path.includes("\\")||path.includes("..")||path.includes("://"))throw new Error("Ongeldig endpoint.");
  if(!/\/charts(?:\/|$)/i.test(path))throw new Error("Deze write-proxy accepteert uitsluitend Rotation One hitlijst-routes.");
  return path;
}
export async function POST(request:NextRequest){
  if(!isSupabaseServerConfigured())return NextResponse.json({error:"Echte VLACORA-login moet eerst actief zijn voordat remote schrijven wordt toegestaan."},{status:403});
  const supabase=createClient();
  const {data}=await supabase.auth.getClaims();
  if(!data?.claims)return NextResponse.json({error:"Je moet ingelogd zijn om naar Rotation One te schrijven."},{status:401});

  let body:any;try{body=await request.json()}catch{return NextResponse.json({error:"Ongeldige aanvraag"},{status:400})}
  if(body.kind!=="rotation")return NextResponse.json({error:"Alleen Rotation One hitlijsten kunnen via deze route geschreven worden."},{status:400});
  if(!["POST","PUT","PATCH"].includes(body.method))return NextResponse.json({error:"Ongeldige schrijfmethode"},{status:400});
  const cfg=body.config||{};
  if(cfg.chartWriteEnabled!==true)return NextResponse.json({error:"Remote hitlijstschrijven staat uit in Beheer → Integraties → Rotation One."},{status:403});
  if(!["http","https"].includes(cfg.protocol)||!isPublicIpv4(String(cfg.host||"")))return NextResponse.json({error:"Ongeldige Rotation One verbinding."},{status:400});
  const port=Number(cfg.port||0);if(!Number.isInteger(port)||port<1||port>65535)return NextResponse.json({error:"Ongeldige poort"},{status:400});
  let path:string;try{path=safePath(String(body.path||""))}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Ongeldig endpoint"},{status:400})}
  const basePath=String(cfg.basePath||"").trim();
  if(basePath&&(!basePath.startsWith("/")||basePath.includes("..")||basePath.includes("://")))return NextResponse.json({error:"Ongeldig basis-pad"},{status:400});

  const apiKey=String(body.apiKey||"");const apiKeyHeader=String(body.apiKeyHeader||"Authorization").trim();const apiKeyPrefix=String(body.apiKeyPrefix||"Bearer").trim();
  const headers:Record<string,string>={Accept:"application/json"};
  if(apiKey){if(!/^[A-Za-z0-9-]{1,64}$/.test(apiKeyHeader))return NextResponse.json({error:"Ongeldige API-key headernaam"},{status:400});headers[apiKeyHeader]=apiKeyPrefix?`${apiKeyPrefix} ${apiKey}`:apiKey}
  const target=`${cfg.protocol}://${cfg.host}:${port}${basePath}${path}`;
  try{
    const result=await nativeHttpJson(body.method,target,headers,body.payload,25000);
    let raw:any=result.text;try{raw=JSON.parse(result.text)}catch{}
    if(result.status<200||result.status>=300)return NextResponse.json({ok:false,error:raw?.error||raw?.message||`HTTP ${result.status}`,status:result.status,raw},{status:result.status||502});
    return NextResponse.json({ok:true,status:result.status,raw,durationMs:result.durationMs});
  }catch(e){
    const detail=nativeError(e);
    return NextResponse.json({ok:false,error:detail.code||detail.message,detail},{status:502});
  }
}
