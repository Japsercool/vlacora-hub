"use client";

import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";

export type HubAnnouncement={
  id:string;stationSlug:string;title:string;body:string;category:string;importance:"normal"|"important";
  requiresAcknowledgement:boolean;createdBy:string;createdByName:string;createdAt:string;updatedAt:string;
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
    rows.forEach(x=>{x.createdByName=names.get(x.createdBy)||"VLACORA"});
  }
  return rows;
}

export async function createAnnouncement(input:{stationSlug:string;title:string;body:string;category:string;importance:"normal"|"important";requiresAcknowledgement:boolean}){
  const supabase=createClient();const{data:u}=await supabase.auth.getUser();if(!u.user)throw new Error("Log opnieuw in.");
  const{data,error}=await supabase.from("hub_announcements").insert({station_slug:input.stationSlug,title:input.title.trim(),body:input.body.trim(),category:input.category.trim()||"Algemeen",importance:input.importance,requires_acknowledgement:input.requiresAcknowledgement,created_by:u.user.id}).select("*").single();
  if(error)throw error;return mapRow(data);
}
export async function removeAnnouncement(id:string){const{error}=await createClient().from("hub_announcements").delete().eq("id",id);if(error)throw error}
