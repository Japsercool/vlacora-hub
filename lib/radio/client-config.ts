export type IntegrationKind = "rotation" | "playout" | "shoutcast";
export type Protocol = "http" | "https";

export type ClientIntegrationConfig = {
  enabled:boolean;
  protocol:Protocol;
  host:string;
  port:string;
  basePath:string;
  stationPath:string;
  statusPath:string;
  playlistPath?:string;
  coveragePath?:string;
  revisionPath?:string;
  nowPath?:string;
  shoutcastSid?:string;
  musicFoldersPath?:string;
  musicFolderItemsPath?:string;
  chartListPath?:string;
  chartEditionsPath?:string;
  chartEditionPath?:string;
  chartRevisionPath?:string;
  chartWritePath?:string;
  chartWriteEnabled?:boolean;
  readOnly:boolean;
  lastOk?:string;
  lastError?:string;
};

export type IntegrationStore = Record<IntegrationKind,ClientIntegrationConfig>;
export type RadioStation = {id:string;name:string;slug?:string;raw?:unknown};
export type RadioMapping = {rotationId:string;rotationName:string;playoutId:string;playoutName:string};
export type RadioMappingStore = Record<string,RadioMapping>;

// Stable keys: never version these again. Old keys are read once and migrated automatically.
export const CONFIG_KEY = "vlacora:integrations:public";
export const MAPPING_KEY = "vlacora:radio:mappings";
const LEGACY_CONFIG_KEYS=["vlacora:integrations:public:v8","vlacora:integrations:public:v7"];
const LEGACY_MAPPING_KEYS=["vlacora:radio:mappings:v9","vlacora:radio:mappings:v8"];
export const stationCacheKey=(kind:IntegrationKind)=>`vlacora:integration:stations:${kind}`;
const legacyStationCacheKey=(kind:IntegrationKind)=>`vlacora:integration:stations:${kind}:v9`;
export const sessionKey=(kind:IntegrationKind)=>`vlacora:integration:key:${kind}`;

function readMigrating<T>(stable:string,legacy:string[],fallback:T):T{
  if(typeof window==="undefined")return fallback;
  try{
    const direct=localStorage.getItem(stable);
    if(direct)return JSON.parse(direct)||fallback;
    for(const key of legacy){
      const raw=localStorage.getItem(key);
      if(!raw)continue;
      const value=JSON.parse(raw)||fallback;
      localStorage.setItem(stable,JSON.stringify(value));
      return value;
    }
  }catch{}
  return fallback;
}

export function readIntegrationStore():Partial<IntegrationStore>{return readMigrating(CONFIG_KEY,LEGACY_CONFIG_KEYS,{})}
export function writeIntegrationStore(value:Partial<IntegrationStore>){if(typeof window!=="undefined")localStorage.setItem(CONFIG_KEY,JSON.stringify(value))}
export function readIntegration(kind:IntegrationKind){return readIntegrationStore()[kind]||null}
export function readSecret(kind:IntegrationKind){
  if(typeof window==="undefined")return {apiKey:"",apiKeyHeader:"Authorization",apiKeyPrefix:"Bearer"};
  return {
    apiKey:sessionStorage.getItem(sessionKey(kind))||"",
    apiKeyHeader:sessionStorage.getItem(`${sessionKey(kind)}:header`)||"Authorization",
    apiKeyPrefix:sessionStorage.getItem(`${sessionKey(kind)}:prefix`)||"Bearer"
  };
}
export function readMappings():RadioMappingStore{return readMigrating(MAPPING_KEY,LEGACY_MAPPING_KEYS,{})}
export function saveMappings(value:RadioMappingStore){if(typeof window!=="undefined")localStorage.setItem(MAPPING_KEY,JSON.stringify(value))}
export function readStationCache(kind:IntegrationKind):RadioStation[]{
  if(typeof window==="undefined")return [];
  try{
    const stable=localStorage.getItem(stationCacheKey(kind));
    if(stable){const x=JSON.parse(stable);return Array.isArray(x)?x:[]}
    const legacy=localStorage.getItem(legacyStationCacheKey(kind));
    if(legacy){const x=JSON.parse(legacy);if(Array.isArray(x)){localStorage.setItem(stationCacheKey(kind),legacy);return x}}
    return [];
  }catch{return []}
}
export function saveStationCache(kind:IntegrationKind,value:RadioStation[]){if(typeof window!=="undefined"){localStorage.setItem(stationCacheKey(kind),JSON.stringify(value));window.dispatchEvent(new CustomEvent("vlacora:hub-stations-changed",{detail:{kind}}))}}

export async function radioRead(kind:IntegrationKind,path:string,action:"raw"|"stations"|"playlist"|"now"|"folders"|"songs"|"charts"|"chartEditions"|"chartEdition"|"revision"|"shoutcast"="raw"){
  const config=readIntegration(kind);
  if(!config?.host)throw new Error(`${kind==="rotation"?"Rotation One":kind==="playout"?"Playout One":"SHOUTcast"} is nog niet ingesteld in Beheer → Integraties.`);
  let secret=readSecret(kind);
  if(!secret.apiKey){
    try{const mod=await import("@/lib/supabase/secrets");await mod.hydrateIntegrationSecret(kind);secret=readSecret(kind)}catch{}
  }
  const requestId=`${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const res=await fetch("/api/radio/manual/read",{
    method:"POST",
    cache:"no-store",
    headers:{"Content-Type":"application/json","Cache-Control":"no-cache","X-Vlacora-Refresh":requestId},
    body:JSON.stringify({kind,path,action,config,...secret,requestId})
  });
  const data=await res.json();
  if(!res.ok)throw new Error(data?.error||data?.message||`HTTP ${res.status}`);
  return data;
}

export function pathFor(template:string|undefined,stationId:string){
  if(!template)return "";
  return template.replaceAll("{stationId}",encodeURIComponent(stationId));
}
export function pathForFolder(template:string|undefined,stationId:string,folderId:string){
  if(!template)return "";
  return template.replaceAll("{stationId}",encodeURIComponent(stationId)).replaceAll("{folderId}",encodeURIComponent(folderId));
}
export function pathForChart(template:string|undefined,stationId:string,chartId:string,editionId=""){
  if(!template)return "";
  return template.replaceAll("{stationId}",encodeURIComponent(stationId)).replaceAll("{chartId}",encodeURIComponent(chartId)).replaceAll("{editionId}",encodeURIComponent(editionId));
}

export async function radioWrite(kind:IntegrationKind,path:string,method:"POST"|"PUT"|"PATCH",payload:unknown){
  const config=readIntegration(kind);
  if(!config?.host)throw new Error(`${kind==="rotation"?"Rotation One":"Playout One"} is nog niet ingesteld in Beheer → Integraties.`);
  let secret=readSecret(kind);
  if(!secret.apiKey){
    try{const mod=await import("@/lib/supabase/secrets");await mod.hydrateIntegrationSecret(kind);secret=readSecret(kind)}catch{}
  }
  const res=await fetch("/api/radio/manual/write",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({kind,path,method,payload,config,...secret})
  });
  const data=await res.json();
  if(!res.ok)throw new Error(data?.error||data?.message||`HTTP ${res.status}`);
  return data;
}

export type StationDiscoveryResult={stations:RadioStation[];sourcePath:string;usedCache:boolean;attempts:Array<{path:string;ok:boolean;count:number;error?:string}>};
function uniqueStations(items:RadioStation[]){const m=new Map<string,RadioStation>();for(const x of items){const id=String(x?.id||"").trim();if(!id)continue;const old=m.get(id);m.set(id,{...old,...x,id,name:String(x.name||old?.name||id)})}return[...m.values()].sort((a,b)=>a.name.localeCompare(b.name,"nl"))}
export function mergeStationCache(kind:IntegrationKind,incoming:RadioStation[]){const merged=uniqueStations([...readStationCache(kind),...incoming]);if(merged.length)saveStationCache(kind,merged);return merged}
export function playoutRotationStation(station:RadioStation){const r=station.raw as any;return String(r?.rotation?.station??r?.Rotation?.Station??r?.rotationStation??r?.RotationStation??"").trim()}
export async function discoverPlayoutStations():Promise<StationDiscoveryResult>{
 const cfg=readIntegration("playout");if(!cfg?.host)throw new Error("Playout One is nog niet ingesteld.");
 const paths=[cfg.stationPath,"/api/v1/integration/stations","/api/v1/integration/revisions"].filter((v,i,a)=>Boolean(v)&&a.indexOf(v)===i) as string[];
 const attempts:Array<{path:string;ok:boolean;count:number;error?:string}>=[];
 for(const path of paths){try{const r=await radioRead("playout",path,"stations");const s=uniqueStations(r.stations||[]);attempts.push({path,ok:true,count:s.length});if(s.length)return{stations:mergeStationCache("playout",s),sourcePath:path,usedCache:false,attempts}}catch(e){attempts.push({path,ok:false,count:0,error:e instanceof Error?e.message:String(e)})}}
 const cached=uniqueStations(readStationCache("playout"));return{stations:cached,sourcePath:"cache",usedCache:cached.length>0,attempts};
}
