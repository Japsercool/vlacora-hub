"use client";

import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";

export type HubAnnouncement={
  id:string;stationSlug:string;title:string;body:string;category:string;importance:"normal"|"important";
  requiresAcknowledgement:boolean;createdBy:string;createdByName:string;createdAt:string;updatedAt:string;
};

export type CommunicationCategory={
  id:string;stationSlug:string;name:string;active:boolean;sortOrder:number;createdAt:string;updatedAt:string;
};

function mapRow(x:any):HubAnnouncement{return{
  id:String(x.id),stationSlug:String(x.station_slug||"all"),title:String(x.title||""),body:String(x.body||""),category:String(x.category||"Algemeen"),
  importance:x.importance==="important"?"important":"normal",requiresAcknowledgement:Boolean(x.requires_acknowledgement),createdBy:String(x.created_by||""),createdByName:"",createdAt:String(x.created_at||""),updatedAt:String(x.updated_at||"")
}}

export async function loadAnnouncements(stationSlug:string):Promise<HubAnnouncement[]>{
  if(!isSupabaseBrowserConfigured())return[];
  const supabase=createClient();
  let q=supabase.from("hub_announcements").select("*").order("created_at",{ascending:false}).limit(200);
  if(stationSlug!=="all")q=q.in("station_slug",[stationSlug,"all"]);
  const{data,error}=await q;if(error)throw error;
  const rows:HubAnnouncement[]=(data||[]).map(mapRow);
  const ids=[...new Set(rows.map(x=>x.createdBy).filter(Boolean))];
  if(ids.length){
    const{data:profiles}=await supabase.from("profiles").select("id,display_name,email").in("id",ids);
    const names=new Map<string,string>((profiles||[]).map((p:any)=>[String(p.id),String(p.display_name||p.email||"Teamlid")]));
    rows.forEach(x=>{x.createdByName=names.get(x.createdBy)||"PULSE"});
  }
  return rows;
}

export async function createAnnouncement(input:{stationSlug:string;title:string;body:string;category:string;importance:"normal"|"important";requiresAcknowledgement:boolean}){
  const supabase=createClient();const{data:u}=await supabase.auth.getUser();if(!u.user)throw new Error("Log opnieuw in.");
  const{data,error}=await supabase.from("hub_announcements").insert({station_slug:input.stationSlug,title:input.title.trim(),body:input.body.trim(),category:input.category.trim()||"Algemeen",importance:input.importance,requires_acknowledgement:input.requiresAcknowledgement,created_by:u.user.id}).select("*").single();
  if(error)throw error;return mapRow(data);
}
export async function removeAnnouncement(id:string){const{error}=await createClient().from("hub_announcements").delete().eq("id",id);if(error)throw error}


function mapCategory(x:any):CommunicationCategory{return{
  id:String(x.id),stationSlug:String(x.station_slug||"all"),name:String(x.name||"Algemeen"),active:x.active!==false,
  sortOrder:Number(x.sort_order||0),createdAt:String(x.created_at||""),updatedAt:String(x.updated_at||"")
}}

export async function loadCommunicationCategories(stationSlug:string,includeInactive=false):Promise<CommunicationCategory[]>{
  if(!isSupabaseBrowserConfigured())return[];
  const supabase=createClient();
  let q=supabase.from("hub_communication_categories").select("*").order("sort_order").order("name");
  if(stationSlug==="all")q=q.eq("station_slug","all"); else q=q.in("station_slug",["all",stationSlug]);
  if(!includeInactive)q=q.eq("active",true);
  const{data,error}=await q;
  if(error){
    // Keep publishing usable against an older database until migration 040 is applied.
    if(String((error as any).code||"")==="42P01")return[{id:"fallback-algemeen",stationSlug:"all",name:"Algemeen",active:true,sortOrder:10,createdAt:"",updatedAt:""}];
    throw error;
  }
  const rows=(data||[]).map(mapCategory);
  return rows.length?rows:[{id:"fallback-algemeen",stationSlug:"all",name:"Algemeen",active:true,sortOrder:10,createdAt:"",updatedAt:""}];
}

export async function createCommunicationCategory(stationSlug:string,name:string){
  const clean=name.trim();if(!clean)throw new Error("Geef de categorie een naam.");
  const supabase=createClient();const{data:u}=await supabase.auth.getUser();if(!u.user)throw new Error("Log opnieuw in.");
  const{data,error}=await supabase.from("hub_communication_categories").insert({station_slug:stationSlug,name:clean,active:true,sort_order:100,created_by:u.user.id}).select("*").single();
  if(error)throw error;return mapCategory(data);
}

export async function updateCommunicationCategory(id:string,patch:Partial<Pick<CommunicationCategory,"name"|"active"|"sortOrder">>){
  const payload:any={updated_at:new Date().toISOString()};
  if(patch.name!==undefined)payload.name=patch.name.trim();if(patch.active!==undefined)payload.active=patch.active;if(patch.sortOrder!==undefined)payload.sort_order=patch.sortOrder;
  const{data,error}=await createClient().from("hub_communication_categories").update(payload).eq("id",id).select("*").single();if(error)throw error;return mapCategory(data);
}

export async function removeCommunicationCategory(id:string){
  const{error}=await createClient().from("hub_communication_categories").delete().eq("id",id);if(error)throw error;
}
