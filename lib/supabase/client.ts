import { createBrowserClient } from "@supabase/ssr";
import { VLACORA_SUPABASE_PUBLISHABLE_KEY,VLACORA_SUPABASE_URL } from "@/lib/supabase/public-config";

export function browserSupabaseConfig(){
  return {
    url:process.env.NEXT_PUBLIC_SUPABASE_URL||VLACORA_SUPABASE_URL,
    key:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||VLACORA_SUPABASE_PUBLISHABLE_KEY
  };
}
export function isSupabaseBrowserConfigured(){const c=browserSupabaseConfig();return Boolean(c.url&&c.key)}
export function createClient(){
  const {url,key}=browserSupabaseConfig();
  if(!url||!key)throw new Error("Supabase Auth is nog niet geconfigureerd.");
  return createBrowserClient(url,key);
}
