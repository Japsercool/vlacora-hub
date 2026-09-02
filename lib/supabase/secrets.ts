"use client";

import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import type { IntegrationKind } from "@/lib/radio/client-config";

export type PersistedIntegrationSecret={
  apiKey:string;
  apiKeyHeader:string;
  apiKeyPrefix:string;
};

const secretKey=(kind:IntegrationKind)=>`vlacora:integration:key:${kind}`;

function cacheSecret(kind:IntegrationKind,secret:PersistedIntegrationSecret){
  if(typeof window==="undefined")return;
  if(secret.apiKey)sessionStorage.setItem(secretKey(kind),secret.apiKey);
  else sessionStorage.removeItem(secretKey(kind));
  sessionStorage.setItem(`${secretKey(kind)}:header`,secret.apiKeyHeader||"Authorization");
  sessionStorage.setItem(`${secretKey(kind)}:prefix`,secret.apiKeyPrefix??"Bearer");
  window.dispatchEvent(new CustomEvent("vlacora:integration-secret-changed",{detail:{kind,stored:Boolean(secret.apiKey)}}));
}

export async function loadPersistedIntegrationSecret(kind:IntegrationKind):Promise<PersistedIntegrationSecret|null>{
  if(!isSupabaseBrowserConfigured())return null;
  const supabase=createClient();
  const{data:user,error:userError}=await supabase.auth.getUser();
  if(userError||!user.user)return null;
  const{data,error}=await supabase.rpc("vlacora_get_integration_secret",{p_kind:kind});
  if(error)throw error;
  const row=Array.isArray(data)?data[0]:data;
  if(!row?.api_key)return null;
  const secret:PersistedIntegrationSecret={
    apiKey:String(row.api_key||""),
    apiKeyHeader:String(row.api_key_header||"Authorization"),
    apiKeyPrefix:String(row.api_key_prefix??"Bearer")
  };
  cacheSecret(kind,secret);
  return secret;
}

export async function hydrateIntegrationSecret(kind:IntegrationKind):Promise<PersistedIntegrationSecret|null>{
  if(typeof window!=="undefined"){
    const apiKey=sessionStorage.getItem(secretKey(kind))||"";
    if(apiKey){
      return{
        apiKey,
        apiKeyHeader:sessionStorage.getItem(`${secretKey(kind)}:header`)||"Authorization",
        apiKeyPrefix:sessionStorage.getItem(`${secretKey(kind)}:prefix`)??"Bearer"
      };
    }
  }
  try{return await loadPersistedIntegrationSecret(kind)}catch{return null}
}

export async function savePersistedIntegrationSecret(kind:IntegrationKind,secret:PersistedIntegrationSecret){
  if(!secret.apiKey.trim())throw new Error("API-sleutel is leeg.");
  if(!isSupabaseBrowserConfigured()){
    cacheSecret(kind,secret);
    return{central:false};
  }
  const supabase=createClient();
  const{data:user,error:userError}=await supabase.auth.getUser();
  if(userError||!user.user)throw new Error("Log eerst in om API-sleutels veilig te bewaren.");
  const{error}=await supabase.rpc("vlacora_set_integration_secret",{
    p_kind:kind,
    p_api_key:secret.apiKey,
    p_api_key_header:secret.apiKeyHeader||"Authorization",
    p_api_key_prefix:secret.apiKeyPrefix??"Bearer"
  });
  if(error)throw error;
  cacheSecret(kind,secret);
  return{central:true};
}

export async function deletePersistedIntegrationSecret(kind:IntegrationKind){
  if(isSupabaseBrowserConfigured()){
    const supabase=createClient();
    const{data:user}=await supabase.auth.getUser();
    if(user.user){
      const{error}=await supabase.rpc("vlacora_delete_integration_secret",{p_kind:kind});
      if(error)throw error;
    }
  }
  cacheSecret(kind,{apiKey:"",apiKeyHeader:"Authorization",apiKeyPrefix:"Bearer"});
}

export async function migrateSessionSecretToVault(kind:IntegrationKind){
  if(typeof window==="undefined"||!isSupabaseBrowserConfigured())return false;
  const apiKey=sessionStorage.getItem(secretKey(kind))||"";
  if(!apiKey)return false;
  try{
    const current=await loadPersistedIntegrationSecret(kind);
    if(current?.apiKey)return true;
    await savePersistedIntegrationSecret(kind,{
      apiKey,
      apiKeyHeader:sessionStorage.getItem(`${secretKey(kind)}:header`)||"Authorization",
      apiKeyPrefix:sessionStorage.getItem(`${secretKey(kind)}:prefix`)??"Bearer"
    });
    return true;
  }catch{return false}
}
