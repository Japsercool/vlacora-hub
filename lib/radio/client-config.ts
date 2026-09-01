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

export const CONFIG_KEY = "vlacora:integrations:public:v8";
export const MAPPING_KEY = "vlacora:radio:mappings:v9";
export const stationCacheKey=(kind:IntegrationKind)=>`vlacora:integration:stations:${kind}:v9`;
export const sessionKey=(kind:IntegrationKind)=>`vlacora:integration:key:${kind}`;

export function readIntegrationStore():Partial<IntegrationStore>{
  if(typeof window==="undefined")return {};
  try{return JSON.parse(localStorage.getItem(CONFIG_KEY)||"{}")||{}}catch{return {}}
}
export function readIntegration(kind:IntegrationKind){return readIntegrationStore()[kind]||null}
export function readSecret(kind:IntegrationKind){
  if(typeof window==="undefined")return {apiKey:"",apiKeyHeader:"Authorization",apiKeyPrefix:"Bearer"};
  return {
    apiKey:sessionStorage.getItem(sessionKey(kind))||"",
    apiKeyHeader:sessionStorage.getItem(`${sessionKey(kind)}:header`)||"Authorization",
    apiKeyPrefix:sessionStorage.getItem(`${sessionKey(kind)}:prefix`)||"Bearer"
  };
}
export function readMappings():RadioMappingStore{
  if(typeof window==="undefined")return {};
  try{return JSON.parse(localStorage.getItem(MAPPING_KEY)||"{}")||{}}catch{return {}}
}
export function saveMappings(value:RadioMappingStore){if(typeof window!=="undefined")localStorage.setItem(MAPPING_KEY,JSON.stringify(value))}
export function readStationCache(kind:IntegrationKind):RadioStation[]{
  if(typeof window==="undefined")return [];
  try{const x=JSON.parse(localStorage.getItem(stationCacheKey(kind))||"[]");return Array.isArray(x)?x:[]}catch{return []}
}
export function saveStationCache(kind:IntegrationKind,value:RadioStation[]){if(typeof window!=="undefined"){localStorage.setItem(stationCacheKey(kind),JSON.stringify(value));window.dispatchEvent(new CustomEvent("vlacora:hub-stations-changed",{detail:{kind}}))}}

export async function radioRead(kind:IntegrationKind,path:string,action:"raw"|"stations"|"playlist"|"now"|"folders"|"songs"|"charts"|"chartEditions"|"chartEdition"|"revision"="raw"){
  const config=readIntegration(kind);
  if(!config?.host)throw new Error(`${kind==="rotation"?"Rotation One":"Playout One"} is nog niet ingesteld in Beheer → Integraties.`);
  const secret=readSecret(kind);
  const res=await fetch("/api/radio/manual/read",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({kind,path,action,config,...secret})
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
  return template
    .replaceAll("{stationId}",encodeURIComponent(stationId))
    .replaceAll("{chartId}",encodeURIComponent(chartId))
    .replaceAll("{editionId}",encodeURIComponent(editionId));
}

export async function radioWrite(
  kind:IntegrationKind,
  path:string,
  method:"POST"|"PUT"|"PATCH",
  payload:unknown
){
  const config=readIntegration(kind);
  if(!config?.host)throw new Error(`${kind==="rotation"?"Rotation One":"Playout One"} is nog niet ingesteld in Beheer → Integraties.`);
  const secret=readSecret(kind);
  const res=await fetch("/api/radio/manual/write",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({kind,path,method,payload,config,...secret})
  });
  const data=await res.json();
  if(!res.ok)throw new Error(data?.error||data?.message||`HTTP ${res.status}`);
  return data;
}
