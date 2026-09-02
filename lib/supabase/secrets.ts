"use client";

import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import type { IntegrationKind } from "@/lib/radio/client-config";

export type PersistedIntegrationSecret={
  apiKey:string;
  apiKeyHeader:string;
  apiKeyPrefix:string;
};

const secretKey=(kind:IntegrationKind)=>`vlacora:integration:key:${kind}`;

export function normalizeIntegrationSecret(secret:PersistedIntegrationSecret):PersistedIntegrationSecret{
  let apiKey=String(secret.apiKey||"").trim();
  apiKey=apiKey
    .replace(/^Authorization\s*:\s*Bearer\s+/i,"")
    .replace(/^X-Playout-Api-Key\s*:\s*/i,"")
    .replace(/^Bearer\s+/i,"")
    .trim();
  let apiKeyHeader=String(secret.apiKeyHeader||"Authorization").trim()||"Authorization";
  let apiKeyPrefix=String(secret.apiKeyPrefix??"Bearer").trim();
  if(apiKeyHeader.toLowerCase()==="x-playout-api-key")apiKeyPrefix="";
  if(apiKeyHeader.toLowerCase()==="authorization"&&!apiKeyPrefix)apiKeyPrefix="Bearer";
  return{apiKey,apiKeyHeader,apiKeyPrefix};
}

function cacheSecret(kind:IntegrationKind,secret:PersistedIntegrationSecret){
  if(typeof window==="undefined")return;
  const normalized=normalizeIntegrationSecret(secret);
  if(normalized.apiKey)sessionStorage.setItem(secretKey(kind),normalized.apiKey);
  else sessionStorage.removeItem(secretKey(kind));
  sessionStorage.setItem(`${secretKey(kind)}:header`,normalized.apiKeyHeader||"Authorization");
  sessionStorage.setItem(`${secretKey(kind)}:prefix`,normalized.apiKeyPrefix??"Bearer");
  window.dispatchEvent(new CustomEvent("vlacora:integration-secret-changed",{detail:{kind,stored:Boolean(normalized.apiKey)}}));
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
  const secret=normalizeIntegrationSecret({
    apiKey:String(row.api_key||""),
    apiKeyHeader:String(row.api_key_header||"Authorization"),
    apiKeyPrefix:String(row.api_key_prefix??"Bearer")
  });
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
  const normalized=normalizeIntegrationSecret(secret);
  if(!normalized.apiKey)throw new Error("API-sleutel is leeg.");
  if(!isSupabaseBrowserConfigured()){
    cacheSecret(kind,normalized);
    return{central:false};
  }
  const supabase=createClient();
  const{data:user,error:userError}=await supabase.auth.getUser();
  if(userError||!user.user)throw new Error("Log eerst in om API-sleutels veilig te bewaren.");
  const{error}=await supabase.rpc("vlacora_set_integration_secret",{
    p_kind:kind,
    p_api_key:normalized.apiKey,
    p_api_key_header:normalized.apiKeyHeader||"Authorization",
    p_api_key_prefix:normalized.apiKeyPrefix??"Bearer"
  });
  if(error)throw error;
  cacheSecret(kind,normalized);
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
