"use client";

import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";

export type EditorialTemplateSlot={
  id:string;
  type:"number"|"link"|"commercial"|"browse"|"talk"|"required_talk"|"tease"|"weather"|"traffic"|"news"|"category";
  label:string;
  durationSec:number;
  content:string;
  required:boolean;
  permanentMessage:string;

  // Only used by type=category. In 0.15.2 this stores a general playlist
  // type such as general::music, general::jingle or general::commercial.
  categoryKey?:string;
  categoryLabel?:string;
};

export type EditorialTemplateAssignment={
  id:string;
  program:string;
  weekday:number;
  hour:number;
};

export type EditorialTemplateRecord={
  id:string;
  station_slug:string;
  name:string;
  program_name:string;
  sequence:EditorialTemplateSlot[];
  assignments:EditorialTemplateAssignment[];
  notes:string;
  active:boolean;
  created_at?:string;
  updated_at?:string;
};

export async function loadEditorialTemplates(stationSlug:string):Promise<EditorialTemplateRecord[]>{
  if(!isSupabaseBrowserConfigured())return[];
  const{data,error}=await createClient()
    .from("hub_editorial_templates")
    .select("*")
    .eq("station_slug",stationSlug)
    .order("name");
  if(error)throw error;
  return(data||[]).map((row:any)=>({
    ...row,
    sequence:Array.isArray(row.sequence)?row.sequence:[],
    assignments:Array.isArray(row.assignments)?row.assignments:[]
  })) as EditorialTemplateRecord[];
}

export async function saveEditorialTemplate(template:EditorialTemplateRecord){
  if(!isSupabaseBrowserConfigured())throw new Error("Supabase is niet actief.");
  const supabase=createClient();
  const{data:user,error:userError}=await supabase.auth.getUser();
  if(userError||!user.user)throw new Error("Log opnieuw in.");
  const payload={
    station_slug:template.station_slug,
    name:template.name.trim()||"Nieuw redactietemplate",
    program_name:template.program_name.trim(),
    sequence:template.sequence,
    assignments:template.assignments,
    notes:template.notes,
    active:template.active,
    updated_by:user.user.id,
    updated_at:new Date().toISOString()
  };
  if(template.id.startsWith("new-")){
    const{data,error}=await supabase.from("hub_editorial_templates")
      .insert({...payload,created_by:user.user.id})
      .select("*").single();
    if(error)throw error;
    return data as EditorialTemplateRecord;
  }
  const{data,error}=await supabase.from("hub_editorial_templates")
    .update(payload).eq("id",template.id).select("*").single();
  if(error)throw error;
  return data as EditorialTemplateRecord;
}

export async function deleteEditorialTemplate(id:string){
  if(!isSupabaseBrowserConfigured())throw new Error("Supabase is niet actief.");
  const{error}=await createClient().from("hub_editorial_templates").delete().eq("id",id);
  if(error)throw error;
}

export type EditorialWorkspaceRecord={
  items:unknown[];
  revision:string;
  updatedAt:string|null;
};

export async function loadEditorialWorkspace(stationSlug:string,date:string,hour:number):Promise<EditorialWorkspaceRecord|null>{
  if(!isSupabaseBrowserConfigured())return null;
  const{data,error}=await createClient().from("hub_editorial_workspaces")
    .select("items,source_revision,updated_at")
    .eq("station_slug",stationSlug).eq("air_date",date).eq("air_hour",hour).maybeSingle();
  if(error)throw error;
  if(!data)return null;
  return{
    items:Array.isArray(data.items)?data.items:[],
    revision:String(data.source_revision||"1"),
    updatedAt:data.updated_at?String(data.updated_at):null
  };
}

export async function saveEditorialWorkspace(stationSlug:string,date:string,hour:number,items:unknown[],sourceRevision:string):Promise<EditorialWorkspaceRecord>{
  if(!isSupabaseBrowserConfigured())throw new Error("Supabase is niet actief.");
  const supabase=createClient();
  const{data:user,error:userError}=await supabase.auth.getUser();
  if(userError||!user.user)throw new Error("Log opnieuw in.");
  const nextRevision=String(sourceRevision||"1");
  const{data,error}=await supabase.from("hub_editorial_workspaces").upsert({
    station_slug:stationSlug,
    air_date:date,
    air_hour:hour,
    items,
    source_revision:nextRevision,
    updated_by:user.user.id,
    updated_at:new Date().toISOString()
  },{onConflict:"station_slug,air_date,air_hour"}).select("items,source_revision,updated_at").single();
  if(error)throw error;
  return{
    items:Array.isArray(data?.items)?data.items:items,
    revision:String(data?.source_revision||nextRevision),
    updatedAt:data?.updated_at?String(data.updated_at):null
  };
}


export type EditorialWorkspaceVersion={id:string;revision:number;items:unknown[];createdBy:string|null;createdByName:string;createdAt:string};
export async function loadEditorialWorkspaceVersions(stationSlug:string,date:string,hour:number):Promise<EditorialWorkspaceVersion[]>{
  if(!isSupabaseBrowserConfigured())return[];
  const supabase=createClient();
  const{data:rows,error}=await supabase.from("hub_editorial_workspace_versions").select("id,revision,items,created_by,created_at").eq("station_slug",stationSlug).eq("air_date",date).eq("air_hour",hour).order("revision",{ascending:false}).limit(50);
  if(error)throw error;
  const ids=[...new Set((rows||[]).map((x:any)=>x.created_by).filter(Boolean).map(String))];const names=new Map<string,string>();
  if(ids.length){const{data:profiles}=await supabase.from("profiles").select("id,display_name,email").in("id",ids);for(const p of profiles||[])names.set(String((p as any).id),String((p as any).display_name||(p as any).email||"Teamlid"))}
  return(rows||[]).map((x:any)=>({id:String(x.id),revision:Number(x.revision||1),items:Array.isArray(x.items)?x.items:[],createdBy:x.created_by?String(x.created_by):null,createdByName:x.created_by?names.get(String(x.created_by))||"Teamlid":"Systeem",createdAt:String(x.created_at)}));
}
