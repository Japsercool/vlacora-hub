import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { VLACORA_SUPABASE_PUBLISHABLE_KEY,VLACORA_SUPABASE_URL } from "@/lib/supabase/public-config";

export function serverSupabaseConfig(){
  return {
    url:process.env.NEXT_PUBLIC_SUPABASE_URL||VLACORA_SUPABASE_URL,
    key:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||VLACORA_SUPABASE_PUBLISHABLE_KEY
  };
}
export function isSupabaseServerConfigured(){const c=serverSupabaseConfig();return Boolean(c.url&&c.key)}
export function createClient(){
  const cookieStore=cookies();
  const {url,key}=serverSupabaseConfig();
  if(!url||!key)throw new Error("Supabase Auth is nog niet geconfigureerd.");
  return createServerClient(url,key,{
    cookies:{
      getAll(){return cookieStore.getAll()},
      setAll(cookiesToSet){try{cookiesToSet.forEach(({name,value,options})=>cookieStore.set(name,value,options))}catch{} }
    }
  });
}
