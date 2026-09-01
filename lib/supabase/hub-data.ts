"use client";

import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import type { RadioStation } from "@/lib/radio/client-config";

export type SharedProgramBlock={
  id:string;day:number;start:string;end:string;name:string;host:string;format:string;notes:string;active:boolean;
};

async function loggedIn(){
  if(!isSupabaseBrowserConfigured())return false;
  try{const {data}=await createClient().auth.getUser();return Boolean(data.user)}catch{return false}
}

export async function loadSharedRotationStations():Promise<RadioStation[]>{
  if(!(await loggedIn()))return [];
  const supabase=createClient();
  const {data,error}=await supabase.from("radio_stations").select("external_id,name,raw").eq("source","rotation").order("name");
  if(error)throw error;
  return (data||[]).map((x:any)=>({id:String(x.external_id),name:String(x.name||x.external_id),raw:x.raw}));
}

export async function syncSharedRotationStations(stations:RadioStation[]){
  if(!(await loggedIn()))return;
  const supabase=createClient();
  if(stations.length){
    const rows=stations.map(s=>({source:"rotation",external_id:s.id,name:s.name,raw:s.raw||null,updated_at:new Date().toISOString()}));
    const {error}=await supabase.from("radio_stations").upsert(rows,{onConflict:"source,external_id"});
    if(error)throw error;
  }
  const {data:existing,error:readError}=await supabase.from("radio_stations").select("external_id").eq("source","rotation");
  if(readError)throw readError;
  const keep=new Set(stations.map(s=>s.id));
  const stale=(existing||[]).map((x:any)=>String(x.external_id)).filter((id:string)=>!keep.has(id));
  if(stale.length){const {error}=await supabase.from("radio_stations").delete().eq("source","rotation").in("external_id",stale);if(error)throw error}
}

export async function loadSharedProgramming(stationSlug:string):Promise<SharedProgramBlock[]>{
  if(!(await loggedIn()))return [];
  const supabase=createClient();
  const {data,error}=await supabase.from("station_programs")
    .select("id,day,start_time,end_time,name,host,format,notes,active")
    .eq("station_slug",stationSlug).order("day").order("start_time");
  if(error)throw error;
  return (data||[]).map((x:any)=>({
    id:String(x.id),day:Number(x.day),start:String(x.start_time||"").slice(0,5),end:String(x.end_time||"").slice(0,5),
    name:String(x.name||""),host:String(x.host||""),format:String(x.format||""),notes:String(x.notes||""),active:Boolean(x.active)
  }));
}

export async function syncSharedProgramming(stationSlug:string,blocks:SharedProgramBlock[]){
  if(!(await loggedIn()))return;
  const supabase=createClient();
  const {data:userData}=await supabase.auth.getUser();
  const userId=userData.user?.id||null;
  if(blocks.length){
    const rows=blocks.map(x=>({
      id:x.id,station_slug:stationSlug,day:x.day,start_time:x.start,end_time:x.end,name:x.name,host:x.host,format:x.format,notes:x.notes,active:x.active,updated_by:userId,updated_at:new Date().toISOString()
    }));
    const {error}=await supabase.from("station_programs").upsert(rows,{onConflict:"id"});
    if(error)throw error;
  }
  const {data:existing,error:readError}=await supabase.from("station_programs").select("id").eq("station_slug",stationSlug);
  if(readError)throw readError;
  const keep=new Set(blocks.map(x=>x.id));
  const stale=(existing||[]).map((x:any)=>String(x.id)).filter((id:string)=>!keep.has(id));
  if(stale.length){const {error}=await supabase.from("station_programs").delete().eq("station_slug",stationSlug).in("id",stale);if(error)throw error}
}

export type SharedHitlist={
  id:string;
  stationSlug:string;
  name:string;
  editionLabel:string;
  publishDate:string;
  validFrom:string;
  validTo:string;
  size:number;
  status:"draft"|"published"|"archived";
  previousEditionId:string;
  programName:string;
  notes:string;
  entries:Array<{
    id:string; songId?:string; artist:string; title:string; previousPosition:number|null; weeks:number; peak:number; notes:string;
  }>;
  createdAt:string;
  updatedAt:string;
};

export async function loadSharedHitlists(stationSlug:string):Promise<SharedHitlist[]>{
  if(!(await loggedIn()))return [];
  const supabase=createClient();
  const {data,error}=await supabase.from("hitlists")
    .select("id,station_slug,name,edition_label,publish_date,valid_from,valid_to,size,status,previous_edition_id,program_name,notes,entries,created_at,updated_at")
    .eq("station_slug",stationSlug)
    .order("publish_date",{ascending:false});
  if(error)throw error;
  return (data||[]).map((x:any)=>({
    id:String(x.id),stationSlug:String(x.station_slug),name:String(x.name||""),editionLabel:String(x.edition_label||""),
    publishDate:String(x.publish_date||""),validFrom:String(x.valid_from||""),validTo:String(x.valid_to||""),
    size:Number(x.size||50),status:(x.status||"draft") as SharedHitlist["status"],previousEditionId:String(x.previous_edition_id||""),
    programName:String(x.program_name||""),notes:String(x.notes||""),entries:Array.isArray(x.entries)?x.entries:[],
    createdAt:String(x.created_at||new Date().toISOString()),updatedAt:String(x.updated_at||new Date().toISOString())
  }));
}

export async function syncSharedHitlists(stationSlug:string,hitlists:SharedHitlist[]){
  if(!(await loggedIn()))return;
  const supabase=createClient();
  const {data:userData}=await supabase.auth.getUser();
  const userId=userData.user?.id||null;
  if(hitlists.length){
    const rows=hitlists.map(x=>({
      id:x.id,station_slug:stationSlug,name:x.name,edition_label:x.editionLabel,publish_date:x.publishDate||null,valid_from:x.validFrom||null,valid_to:x.validTo||null,
      size:x.size,status:x.status,previous_edition_id:x.previousEditionId||null,program_name:x.programName||"",notes:x.notes||"",entries:x.entries||[],updated_by:userId,
      created_at:x.createdAt||new Date().toISOString(),updated_at:new Date().toISOString()
    }));
    const {error}=await supabase.from("hitlists").upsert(rows,{onConflict:"id"});
    if(error)throw error;
  }
  const {data:existing,error:readError}=await supabase.from("hitlists").select("id").eq("station_slug",stationSlug);
  if(readError)throw readError;
  const keep=new Set(hitlists.map(x=>x.id));
  const stale=(existing||[]).map((x:any)=>String(x.id)).filter((id:string)=>!keep.has(id));
  if(stale.length){const {error}=await supabase.from("hitlists").delete().eq("station_slug",stationSlug).in("id",stale);if(error)throw error}
}
