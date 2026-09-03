"use client";

import { useEffect,useState } from "react";
import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";

export type HubStation = {
  slug:string;
  name:string;
  short:string;
  accent:string;
  timezone:string;
  active:boolean;
  sortOrder:number;
  source:"all"|"vlacora";
};

const ALL:HubStation={slug:"all",name:"Alle zenders",short:"ALL",accent:"#26269f",timezone:"Europe/Brussels",active:true,sortOrder:-1,source:"all"};
const DEFAULTS:HubStation[]=[
  {slug:"versuz",name:"Versuz Radio",short:"VZ",accent:"#5438ff",timezone:"Europe/Brussels",active:true,sortOrder:10,source:"vlacora"},
  {slug:"club-fm",name:"Club FM",short:"CF",accent:"#e94157",timezone:"Europe/Brussels",active:true,sortOrder:20,source:"vlacora"},
  {slug:"vlacora-one",name:"Vlacora One",short:"V1",accent:"#127a65",timezone:"Europe/Brussels",active:true,sortOrder:30,source:"vlacora"}
];
const CACHE_KEY="vlacora:hub-stations-cache:v2";
export const HUB_STATIONS_EVENT="vlacora:hub-stations-changed";
let memoryStations:HubStation[]|null=null;

function normalizeSlug(value:string){return value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,48)}
export function makeStationSlug(name:string){return normalizeSlug(name)||`station-${Date.now().toString(36)}`}

function parseCached():HubStation[]|null{
  if(typeof window==="undefined")return null;
  try{const raw=JSON.parse(localStorage.getItem(CACHE_KEY)||"null");return Array.isArray(raw)?raw:null}catch{return null}
}
function setCache(rows:HubStation[]){
  memoryStations=rows;
  if(typeof window!=="undefined"){
    try{localStorage.setItem(CACHE_KEY,JSON.stringify(rows))}catch{}
    window.dispatchEvent(new CustomEvent(HUB_STATIONS_EVENT));
  }
}
export function readHubStations():HubStation[]{
  const rows=memoryStations||parseCached()||DEFAULTS;
  return [ALL,...rows.filter(x=>x.active!==false).sort((a,b)=>a.sortOrder-b.sortOrder||a.name.localeCompare(b.name))];
}
export function readAllHubStations():HubStation[]{
  const rows=memoryStations||parseCached()||DEFAULTS;
  return [ALL,...rows.sort((a,b)=>a.sortOrder-b.sortOrder||a.name.localeCompare(b.name))];
}
export async function hydrateHubStations(){
  if(!isSupabaseBrowserConfigured()){setCache(DEFAULTS);return readHubStations()}
  try{
    const supabase=createClient();
    const {data:user}=await supabase.auth.getUser();
    if(!user.user)return readHubStations();
    const {data,error}=await supabase.from("hub_stations").select("slug,name,short,accent,timezone,active,sort_order").order("sort_order").order("name");
    if(error)throw error;
    const rows=(data||[]).map((x:any)=>({slug:String(x.slug),name:String(x.name),short:String(x.short||"ST").toUpperCase().slice(0,4),accent:String(x.accent||"#26269f"),timezone:String(x.timezone||"Europe/Brussels"),active:x.active!==false,sortOrder:Number(x.sort_order||0),source:"vlacora" as const}));
    setCache(rows.length?rows:DEFAULTS);
    return readHubStations();
  }catch{return readHubStations()}
}
export async function saveHubStation(station:Omit<HubStation,"source">){
  if(!isSupabaseBrowserConfigured())throw new Error("Supabase is niet actief.");
  const supabase=createClient();
  const {error}=await supabase.from("hub_stations").upsert({slug:station.slug,name:station.name,short:station.short.toUpperCase().slice(0,4),accent:station.accent,timezone:station.timezone,active:station.active,sort_order:station.sortOrder,updated_at:new Date().toISOString()},{onConflict:"slug"});
  if(error)throw error;
  await hydrateHubStations();
}
export async function createHubStation(input:{name:string;slug?:string;short?:string;accent?:string;timezone?:string}){
  const slug=makeStationSlug(input.slug||input.name);
  if(!slug)throw new Error("Geef een geldige zendernaam.");
  const existing=readAllHubStations().filter(x=>x.slug!=="all");
  await saveHubStation({slug,name:input.name.trim(),short:(input.short||input.name.slice(0,2)).trim().toUpperCase().slice(0,4)||"ST",accent:input.accent||"#5438ff",timezone:input.timezone||"Europe/Brussels",active:true,sortOrder:(Math.max(0,...existing.map(x=>x.sortOrder))+10)});
  return slug;
}
export async function deleteHubStation(slug:string){
  if(!slug||slug==="all")return;
  const {error}=await createClient().from("hub_stations").delete().eq("slug",slug);
  if(error)throw error;
  await hydrateHubStations();
}
export function resolveHubStation(slug:string){return readHubStations().find(s=>s.slug===slug)||ALL}
export function allHubStation(){return ALL}
export function useHubStation(slug:string){
  const[value,setValue]=useState<HubStation>(()=>resolveHubStation(slug));
  useEffect(()=>{const refresh=()=>setValue(resolveHubStation(slug));void hydrateHubStations().then(refresh);window.addEventListener(HUB_STATIONS_EVENT,refresh as EventListener);return()=>window.removeEventListener(HUB_STATIONS_EVENT,refresh as EventListener)},[slug]);
  return value;
}
