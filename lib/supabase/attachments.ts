"use client";

import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";

export type HubAttachment={
  id:string;stationSlug:string;entityType:string;entityId:string;fileName:string;storagePath:string;mimeType:string;sizeBytes:number;uploadedBy:string;createdAt:string;
};

const BUCKET="vlacora-hub-files";

function mapRow(x:any):HubAttachment{return{
  id:String(x.id),stationSlug:String(x.station_slug||"all"),entityType:String(x.entity_type||""),entityId:String(x.entity_id||""),
  fileName:String(x.file_name||"bestand"),storagePath:String(x.storage_path||""),mimeType:String(x.mime_type||"application/octet-stream"),
  sizeBytes:Number(x.size_bytes||0),uploadedBy:String(x.uploaded_by||""),createdAt:String(x.created_at||"")
}}
function safeName(name:string){return name.replace(/[^a-zA-Z0-9._-]+/g,"_").slice(-120)||"bestand"}

export async function loadAttachments(entityType:string,entityId:string):Promise<HubAttachment[]>{
  if(!isSupabaseBrowserConfigured()||!entityId)return[];
  const{data,error}=await createClient().from("hub_attachments").select("*").eq("entity_type",entityType).eq("entity_id",entityId).order("created_at");
  if(error)throw error;return(data||[]).map(mapRow);
}
export async function loadAttachmentsForEntities(entityType:string,entityIds:string[]):Promise<Record<string,HubAttachment[]>>{
  if(!isSupabaseBrowserConfigured()||!entityIds.length)return{};
  const{data,error}=await createClient().from("hub_attachments").select("*").eq("entity_type",entityType).in("entity_id",entityIds).order("created_at");
  if(error)throw error;
  const out:Record<string,HubAttachment[]>={};for(const row of data||[]){const a=mapRow(row);(out[a.entityId] ||= []).push(a)}return out;
}
export async function uploadAttachments(stationSlug:string,entityType:string,entityId:string,files:File[]):Promise<HubAttachment[]>{
  if(!isSupabaseBrowserConfigured())throw new Error("Supabase is niet actief.");
  if(!entityId)throw new Error("Sla het item eerst op voordat je bestanden toevoegt.");
  const supabase=createClient();const{data:u}=await supabase.auth.getUser();const uid=u.user?.id;if(!uid)throw new Error("Log opnieuw in.");
  const made:HubAttachment[]=[];
  for(const file of files){
    if(file.size>25*1024*1024)throw new Error(`${file.name} is groter dan 25 MB.`);
    const path=`${uid}/${entityType}/${entityId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}-${safeName(file.name)}`;
    const{error:uploadError}=await supabase.storage.from(BUCKET).upload(path,file,{contentType:file.type||undefined,upsert:false});if(uploadError)throw uploadError;
    const{data,error}=await supabase.from("hub_attachments").insert({station_slug:stationSlug||"all",entity_type:entityType,entity_id:entityId,file_name:file.name,storage_path:path,mime_type:file.type||"application/octet-stream",size_bytes:file.size,uploaded_by:uid}).select("*").single();
    if(error){await supabase.storage.from(BUCKET).remove([path]);throw error}made.push(mapRow(data));
  }
  return made;
}
export async function downloadAttachment(a:HubAttachment){
  const{data,error}=await createClient().storage.from(BUCKET).download(a.storagePath);if(error)throw error;
  const url=URL.createObjectURL(data);const link=document.createElement("a");link.href=url;link.download=a.fileName;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function removeAttachment(a:HubAttachment){
  const supabase=createClient();const{error}=await supabase.from("hub_attachments").delete().eq("id",a.id);if(error)throw error;
  await supabase.storage.from(BUCKET).remove([a.storagePath]);
}
export function formatBytes(n:number){if(n<1024)return`${n} B`;if(n<1024*1024)return`${(n/1024).toFixed(1)} KB`;return`${(n/1024/1024).toFixed(1)} MB`}
