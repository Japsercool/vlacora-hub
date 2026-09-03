import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { VLACORA_SUPABASE_PUBLISHABLE_KEY,VLACORA_SUPABASE_URL } from "@/lib/supabase/public-config";

export async function GET(request: globalThis.Request){
  const requestUrl=new URL(request.url);
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||VLACORA_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||VLACORA_SUPABASE_PUBLISHABLE_KEY;
  const code=requestUrl.searchParams.get("code");
  const next=requestUrl.searchParams.get("next")||"/hub/all/dashboard";
  const safeNext=next.startsWith("/")&&!next.startsWith("//")?next:"/hub/all/dashboard";

  if(!url||!key){
    const target=new URL("/login",request.url);
    target.searchParams.set("error","auth-not-configured");
    return NextResponse.redirect(target);
  }

  let response=NextResponse.redirect(new URL(safeNext,request.url));
  const cookieStore=cookies();
  const supabase=createServerClient(url,key,{
    cookies:{
      getAll(){return cookieStore.getAll().map(({name,value})=>({name,value}))},
      setAll(cookiesToSet){
        cookiesToSet.forEach(({name,value,options})=>response.cookies.set(name,value,options));
      }
    }
  });

  if(code){
    const{error}=await supabase.auth.exchangeCodeForSession(code);
    if(!error)return response;
  }

  const target=new URL("/login",request.url);
  target.searchParams.set("error","reset-link-invalid");
  return NextResponse.redirect(target);
}
