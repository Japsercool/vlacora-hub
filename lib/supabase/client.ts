import { createBrowserClient } from "@supabase/ssr";
import { VLACORA_SUPABASE_PUBLISHABLE_KEY,VLACORA_SUPABASE_URL } from "@/lib/supabase/public-config";

type PulseDataRoute={activeBackend:"supabase"|"external_postgres";gatewayUrl:string;checkedAt:number};
const ROUTE_KEY="pulse:data-route:v1";
let memoryRoute:PulseDataRoute|null=null;
const nativeFetch=(...args:Parameters<typeof fetch>)=>globalThis.fetch(...args);

export function browserSupabaseConfig(){
  return {
    url:process.env.NEXT_PUBLIC_SUPABASE_URL||VLACORA_SUPABASE_URL,
    key:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||VLACORA_SUPABASE_PUBLISHABLE_KEY
  };
}
export function isSupabaseBrowserConfigured(){const c=browserSupabaseConfig();return Boolean(c.url&&c.key)}

function readStoredRoute():PulseDataRoute|null{
  if(typeof window==="undefined")return memoryRoute;
  try{const raw=window.localStorage.getItem(ROUTE_KEY);if(!raw)return memoryRoute;const value=JSON.parse(raw) as PulseDataRoute;if(value?.activeBackend&&typeof value.gatewayUrl==="string")return value}catch{}
  return memoryRoute;
}
export function configurePulseDataRoute(activeBackend:"supabase"|"external_postgres",gatewayUrl=""){
  const value:PulseDataRoute={activeBackend,gatewayUrl:gatewayUrl.trim().replace(/\/$/,""),checkedAt:Date.now()};memoryRoute=value;
  if(typeof window!=="undefined")try{window.localStorage.setItem(ROUTE_KEY,JSON.stringify(value))}catch{}
}

function requestHeaders(input:RequestInfo|URL,init?:RequestInit){
  const h=new Headers(input instanceof Request?input.headers:undefined);new Headers(init?.headers||undefined).forEach((v,k)=>h.set(k,v));return h;
}
function inputUrl(input:RequestInfo|URL){return typeof input==="string"?input:input instanceof URL?input.toString():input.url}

async function discoverRoute(supabaseUrl:string,key:string,headers:Headers):Promise<PulseDataRoute>{
  const cached=readStoredRoute();if(cached&&Date.now()-cached.checkedAt<15000)return cached;
  const auth=headers.get("authorization")||"";
  if(!auth){const fallback={activeBackend:"supabase" as const,gatewayUrl:"",checkedAt:Date.now()};memoryRoute=fallback;return fallback}
  try{
    const res=await nativeFetch(`${supabaseUrl}/rest/v1/pulse_backend_pointer?scope=eq.global&select=active_backend,gateway_url`,{headers:{apikey:key,authorization:auth,accept:"application/json"},cache:"no-store"});
    if(res.ok){const rows=await res.json() as Array<{active_backend?:string;gateway_url?:string}>;const row=rows?.[0];const value:PulseDataRoute={activeBackend:row?.active_backend==="external_postgres"?"external_postgres":"supabase",gatewayUrl:String(row?.gateway_url||"").replace(/\/$/,""),checkedAt:Date.now()};configurePulseDataRoute(value.activeBackend,value.gatewayUrl);return value}
  }catch{}
  const fallback={activeBackend:"supabase" as const,gatewayUrl:"",checkedAt:Date.now()};memoryRoute=fallback;return fallback;
}

function createPulseFetch(supabaseUrl:string,key:string):typeof fetch{
  return (async(input:RequestInfo|URL,init?:RequestInit)=>{
    const url=inputUrl(input);const restPrefix=`${supabaseUrl}/rest/v1/`;
    if(!url.startsWith(restPrefix))return nativeFetch(input as any,init);
    const suffix=url.slice(restPrefix.length);
    // Alleen de minieme bootstrap-pointer blijft bewust naast Supabase Auth staan.
    // Alle operationele PULSE-tabellen (ook hub_data_backend_configs) volgen de
    // actieve backend en verhuizen dus mee naar de eigen PostgreSQL.
    if(suffix.startsWith("pulse_backend_pointer"))return nativeFetch(input as any,init);
    const headers=requestHeaders(input,init);const route=await discoverRoute(supabaseUrl,key,headers);
    if(route.activeBackend!=="external_postgres"||!route.gatewayUrl)return nativeFetch(input as any,init);
    const rewritten=`${route.gatewayUrl}/data/rest/v1/${suffix}`;
    if(input instanceof Request)return nativeFetch(new Request(rewritten,input),init);
    return nativeFetch(rewritten,init);
  }) as typeof fetch;
}

function safePath(path:string){return path.split("/").filter(Boolean).map(encodeURIComponent).join("/")}

export function createClient(){
  const {url,key}=browserSupabaseConfig();
  if(!url||!key)throw new Error("Supabase Auth is nog niet geconfigureerd.");
  const client:any=createBrowserClient(url,key,{global:{fetch:createPulseFetch(url,key)}} as any);
  const originalFrom=client.storage.from.bind(client.storage);
  client.storage.from=(bucket:string)=>{
    const original=originalFrom(bucket);
    const route=()=>readStoredRoute();
    const authHeader=async()=>{const {data}=await client.auth.getSession();const token=data.session?.access_token||"";return token?{authorization:`Bearer ${token}`}:{}};
    return {
      ...original,
      upload:async(path:string,file:any,options:any={})=>{
        const r=route();if(r?.activeBackend!=="external_postgres"||!r.gatewayUrl)return original.upload(path,file,options);
        try{const headers:any={...(await authHeader()),"content-type":options.contentType||file?.type||"application/octet-stream","x-pulse-upsert":options.upsert?"1":"0"};const res=await nativeFetch(`${r.gatewayUrl}/data/files/${encodeURIComponent(bucket)}/${safePath(path)}`,{method:"PUT",headers,body:file});const json=await res.json().catch(()=>({}));return res.ok?{data:json,error:null}:{data:null,error:{message:String(json.error||`Upload mislukt (${res.status})`)}}}catch(e:any){return{data:null,error:{message:e?.message||String(e)}}}
      },
      download:async(path:string)=>{
        const r=route();if(r?.activeBackend!=="external_postgres"||!r.gatewayUrl)return original.download(path);
        try{const res=await nativeFetch(`${r.gatewayUrl}/data/files/authenticated/${encodeURIComponent(bucket)}/${safePath(path)}`,{headers:await authHeader()});if(!res.ok){const j=await res.json().catch(()=>({}));return{data:null,error:{message:String(j.error||`Download mislukt (${res.status})`)}}}return{data:await res.blob(),error:null}}catch(e:any){return{data:null,error:{message:e?.message||String(e)}}}
      },
      remove:async(paths:string[])=>{
        const r=route();if(r?.activeBackend!=="external_postgres"||!r.gatewayUrl)return original.remove(paths);
        try{const res=await nativeFetch(`${r.gatewayUrl}/data/files/${encodeURIComponent(bucket)}`,{method:"DELETE",headers:{...(await authHeader()),"content-type":"application/json"},body:JSON.stringify({paths})});const j=await res.json().catch(()=>({}));return res.ok?{data:j.data||paths.map(name=>({name})),error:null}:{data:null,error:{message:String(j.error||`Verwijderen mislukt (${res.status})`)}}}catch(e:any){return{data:null,error:{message:e?.message||String(e)}}}
      },
      getPublicUrl:(path:string)=>{
        const r=route();if(r?.activeBackend!=="external_postgres"||!r.gatewayUrl)return original.getPublicUrl(path);
        return{data:{publicUrl:`${r.gatewayUrl}/data/files/public/${encodeURIComponent(bucket)}/${safePath(path)}`}}
      }
    }
  };
  return client;
}
