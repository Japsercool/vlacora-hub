"use client";

import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import type { IntegrationStore,RadioMapping } from "@/lib/radio/client-config";
import { CONFIG_KEY,readIntegrationStore } from "@/lib/radio/client-config";

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
  const {error}=await supabase.from("hub_settings").upsert({
    scope,setting_key:key,value,updated_by:user.user.id,updated_at:new Date().toISOString()
  },{onConflict:"scope,setting_key"});
  if(error)throw error;
}

export async function loadSharedIntegrationStore(stationSlug:string):Promise<Partial<IntegrationStore>>{
  const [globalStore,stationShoutcast]=await Promise.all([
    loadSharedSetting<Partial<IntegrationStore>>("global","radio-integrations"),
    stationSlug&&stationSlug!=="all"?loadSharedSetting<IntegrationStore["shoutcast"]>(`station:${stationSlug}`,"shoutcast-integration"):Promise.resolve(null)
  ]);
  const result:Partial<IntegrationStore>={...(globalStore||{})};
  if(stationShoutcast)result.shoutcast=stationShoutcast;
  return result;
}

export async function saveSharedIntegrationStore(store:IntegrationStore,stationSlug:string){
  await saveSharedSetting("global","radio-integrations",{rotation:store.rotation,playout:store.playout});
  if(stationSlug&&stationSlug!=="all")await saveSharedSetting(`station:${stationSlug}`,"shoutcast-integration",store.shoutcast);
}

export async function hydrateSharedIntegrationSettings(stationSlug:string){
  const remote=await loadSharedIntegrationStore(stationSlug);
  if(!Object.keys(remote).length)return false;
  const merged={...readIntegrationStore(),...remote};
  try{localStorage.setItem(CONFIG_KEY,JSON.stringify(merged));return true}catch{return false}
}


export async function loadSharedRadioMapping(stationSlug:string):Promise<RadioMapping|null>{
  if(!stationSlug||stationSlug==="all")return null;
  return loadSharedSetting<RadioMapping>(`station:${stationSlug}`,"radio-mapping");
}

export async function saveSharedRadioMapping(stationSlug:string,mapping:RadioMapping){
  if(!stationSlug||stationSlug==="all")return;
  await saveSharedSetting(`station:${stationSlug}`,"radio-mapping",mapping);
}
