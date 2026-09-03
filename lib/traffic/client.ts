"use client";

import { loadSharedSetting,saveSharedSetting } from "@/lib/supabase/settings";

export type TrafficSettings={roads:string[];allFlanders:boolean;includeIncidents:boolean;includeCongestion:boolean;includeRoadworks:boolean;maxItems:number;autoRefreshMinutes:number};
export type TrafficIncident={id:string;type:string;typeLabel:string;severity:"high"|"medium"|"low";road:string;roadKeys?:string[];direction:string;location:string;summary:string;validUntil:string;updatedAt:string};
export type TrafficSnapshot={ok:boolean;source:string;feed:string;feedUrl:string;publicationTime:string;fetchedAt:string;roads:string[];allFlanders:boolean;totalParsed:number;count:number;items:TrafficIncident[];radioText:string;error?:string};

export const DEFAULT_TRAFFIC_SETTINGS:TrafficSettings={roads:["E17","E40","R4","R1","R0"],allFlanders:false,includeIncidents:true,includeCongestion:true,includeRoadworks:true,maxItems:20,autoRefreshMinutes:2};
const localKey=(stationSlug:string)=>`vlacora:traffic:${stationSlug}:v1`;
const normalizeRoad=(value:string)=>value.trim().toUpperCase().replace(/[\s-]+/g,"");
export function normalizeTrafficSettings(value:Partial<TrafficSettings>|null|undefined):TrafficSettings{
  return{...DEFAULT_TRAFFIC_SETTINGS,...(value||{}),roads:[...new Set((value?.roads||DEFAULT_TRAFFIC_SETTINGS.roads).map(normalizeRoad).filter(Boolean))].slice(0,20),maxItems:Math.min(50,Math.max(5,Number(value?.maxItems||DEFAULT_TRAFFIC_SETTINGS.maxItems))),autoRefreshMinutes:Math.min(15,Math.max(1,Number(value?.autoRefreshMinutes||DEFAULT_TRAFFIC_SETTINGS.autoRefreshMinutes)))};
}
export async function loadTrafficSettings(stationSlug:string){
  let local:Partial<TrafficSettings>|null=null;
  try{local=JSON.parse(localStorage.getItem(localKey(stationSlug))||"null")}catch{}
  const remote=stationSlug&&stationSlug!=="all"?await loadSharedSetting<Partial<TrafficSettings>>(`station:${stationSlug}`,"traffic-settings").catch(()=>null):null;
  const settings=normalizeTrafficSettings(remote||local);
  try{localStorage.setItem(localKey(stationSlug),JSON.stringify(settings))}catch{}
  return settings;
}
export async function saveTrafficSettings(stationSlug:string,settings:TrafficSettings){
  const normalized=normalizeTrafficSettings(settings);
  try{localStorage.setItem(localKey(stationSlug),JSON.stringify(normalized))}catch{}
  if(stationSlug&&stationSlug!=="all")await saveSharedSetting(`station:${stationSlug}`,"traffic-settings",normalized);
  return normalized;
}
export async function fetchTrafficSnapshot(settings:TrafficSettings){
  const q=new URLSearchParams({roads:settings.roads.join(","),all:settings.allFlanders?"1":"0",incidents:settings.includeIncidents?"1":"0",congestion:settings.includeCongestion?"1":"0",roadworks:settings.includeRoadworks?"1":"0",limit:String(settings.maxItems)});
  const response=await fetch(`/api/traffic/live?${q.toString()}`,{cache:"no-store"});
  const data=await response.json().catch(()=>({ok:false,error:`HTTP ${response.status}`}));
  if(!response.ok||!data?.ok)throw new Error(data?.error||`Verkeer HTTP ${response.status}`);
  return data as TrafficSnapshot;
}
