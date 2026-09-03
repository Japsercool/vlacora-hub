"use client";

import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";

export type SettingScope="global"|`station:${string}`|`user:${string}`;

export async function loadSharedSetting<T>(scope:SettingScope,key:string):Promise<T|null>{
  if(!isSupabaseBrowserConfigured())return null;
  try{
    const supabase=createClient();
    const {data:user}=await supabase.auth.getUser();
    if(!user.user)return null;
    const {data,error}=await supabase.from("hub_settings").select("value").eq("scope",scope).eq("setting_key",key).maybeSingle();
    if(error)throw error;
    return data?.value==null?null:data.value as T;
  }catch{return null}
}

export async function saveSharedSetting(scope:SettingScope,key:string,value:unknown){
  if(!isSupabaseBrowserConfigured())throw new Error("Supabase is niet actief.");
  const supabase=createClient();
  const {data:user,error:userError}=await supabase.auth.getUser();
  if(userError||!user.user)throw new Error("Log eerst in om instellingen centraal op te slaan.");
  const {error}=await supabase.from("hub_settings").upsert({scope,setting_key:key,value,updated_by:user.user.id,updated_at:new Date().toISOString()},{onConflict:"scope,setting_key"});
  if(error)throw error;
}
