"use client";

import { useEffect,useState } from "react";
import { readStationCache, type RadioStation } from "@/lib/radio/client-config";

export type HubStation = {
  slug: string;
  name: string;
  short: string;
  accent: string;
  rotationId?: string;
  source: "all" | "rotation";
};

const ALL: HubStation = { slug:"all", name:"Alle zenders", short:"ALL", accent:"#26269f", source:"all" };
const ACCENTS = ["#5438ff","#e94157","#127a65","#3e7ad8","#b25b2f","#7e42b8","#217a8b","#8d5d2f"];

function hash(input:string){
  let h=2166136261;
  for(let i=0;i<input.length;i++){h^=input.charCodeAt(i);h=Math.imul(h,16777619)}
  return (h>>>0).toString(36);
}
function slugPart(value:string){
  const x=value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
  return x||"station";
}
export function rotationHubSlug(station:Pick<RadioStation,"id"|"name">){return `ro-${slugPart(station.name||station.id)}-${hash(station.id).slice(0,5)}`}
export function rotationStationToHub(station:RadioStation,index=0):HubStation{
  const words=station.name.trim().split(/\s+/).filter(Boolean);
  const short=(words.length>1?words.slice(0,2).map(x=>x[0]).join(""):station.name.slice(0,2)).toUpperCase().slice(0,3)||"RO";
  return {slug:rotationHubSlug(station),name:station.name,short,accent:ACCENTS[index%ACCENTS.length],rotationId:station.id,source:"rotation"};
}
export function readHubStations():HubStation[]{
  const rotation=readStationCache("rotation");
  return [ALL,...rotation.map(rotationStationToHub)];
}
export function resolveHubStation(slug:string):HubStation{
  return readHubStations().find(s=>s.slug===slug)||ALL;
}
export function allHubStation(){return ALL}
export const HUB_STATIONS_EVENT="vlacora:hub-stations-changed";

export function useHubStation(slug:string){
  const initial:HubStation=slug==="all"?ALL:{slug,name:"Station laden…",short:"…",accent:"#26269f",source:"rotation"};
  const[value,setValue]=useState<HubStation>(initial);
  useEffect(()=>{const refresh=()=>setValue(resolveHubStation(slug));refresh();window.addEventListener(HUB_STATIONS_EVENT,refresh as EventListener);return()=>window.removeEventListener(HUB_STATIONS_EVENT,refresh as EventListener)},[slug]);
  return value;
}
