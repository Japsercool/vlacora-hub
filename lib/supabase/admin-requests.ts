
"use client";

import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";

export type AdminRequestCategory="feature"|"traffic"|"content"|"station"|"other";
export type AdminRequestStatus="new"|"reviewing"|"planned"|"done"|"rejected";

export type AdminRequest={
  id:string;
  stationSlug:string;
  category:AdminRequestCategory;
  title:string;
  description:string;
  status:AdminRequestStatus;
  adminNote:string;
  createdBy:string;
  createdByName:string;
  handledBy:string|null;
  handledByName:string;
  createdAt:string;
  updatedAt:string;
};

function mapRow(row:any):AdminRequest{
  return{
    id:String(row.id),
    stationSlug:String(row.station_slug||"all"),
    category:String(row.category||"feature") as AdminRequestCategory,
    title:String(row.title||"Aanvraag"),
    description:String(row.description||""),
    status:String(row.status||"new") as AdminRequestStatus,
    adminNote:String(row.admin_note||""),
    createdBy:String(row.created_by||""),
    createdByName:String(row.created_by_name||""),
    handledBy:row.handled_by?String(row.handled_by):null,
    handledByName:String(row.handled_by_name||""),
    createdAt:String(row.created_at||""),
    updatedAt:String(row.updated_at||"")
  };
}

export async function loadAdminRequests(){
  if(!isSupabaseBrowserConfigured())return[];
  const supabase=createClient();
  const{data,error}=await supabase.from("hub_admin_requests")
    .select("*").order("created_at",{ascending:false}).limit(250);
  if(error)throw error;
  const rows=data||[];
  const ids=Array.from(new Set(rows.flatMap((row:any)=>[row.created_by,row.handled_by]).filter(Boolean).map(String)));
  const names=new Map<string,string>();
  if(ids.length){
    const{data:profiles}=await supabase.from("profiles").select("id,display_name,email").in("id",ids);
    for(const p of profiles||[])names.set(String(p.id),String(p.display_name||p.email||"Gebruiker"));
  }
  return rows.map((row:any)=>mapRow({
    ...row,
    created_by_name:names.get(String(row.created_by||""))||"Gebruiker",
    handled_by_name:names.get(String(row.handled_by||""))||""
  }));
}

export async function createAdminRequest(input:{
  stationSlug:string;
  category:AdminRequestCategory;
  title:string;
  description:string;
}){
  if(!isSupabaseBrowserConfigured())throw new Error("Supabase is niet actief.");
  const supabase=createClient();
  const{data:user,error:userError}=await supabase.auth.getUser();
  if(userError||!user.user)throw new Error("Log opnieuw in.");
  const{data,error}=await supabase.from("hub_admin_requests").insert({
    station_slug:input.stationSlug||"all",
    category:input.category,
    title:input.title.trim(),
    description:input.description.trim(),
    created_by:user.user.id
  }).select("*").single();
  if(error)throw error;
  return mapRow(data);
}

export async function updateAdminRequest(id:string,patch:{
  status?:AdminRequestStatus;
  adminNote?:string;
}){
  if(!isSupabaseBrowserConfigured())throw new Error("Supabase is niet actief.");
  const supabase=createClient();
  const{data:user}=await supabase.auth.getUser();
  const payload:any={updated_at:new Date().toISOString()};
  if(patch.status!==undefined)payload.status=patch.status;
  if(patch.adminNote!==undefined)payload.admin_note=patch.adminNote;
  if(user.user)payload.handled_by=user.user.id;
  const{data,error}=await supabase.from("hub_admin_requests")
    .update(payload).eq("id",id).select("*").single();
  if(error)throw error;
  return mapRow(data);
}

export async function deleteAdminRequest(id:string){
  if(!isSupabaseBrowserConfigured())throw new Error("Supabase is niet actief.");
  const{error}=await createClient().from("hub_admin_requests").delete().eq("id",id);
  if(error)throw error;
}
