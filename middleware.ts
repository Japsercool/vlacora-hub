import { createServerClient } from "@supabase/ssr";
import { NextResponse,type NextRequest } from "next/server";
import { VLACORA_SUPABASE_PUBLISHABLE_KEY,VLACORA_SUPABASE_URL } from "@/lib/supabase/public-config";

export async function middleware(request:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||VLACORA_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||VLACORA_SUPABASE_PUBLISHABLE_KEY;
  // Explicit setup mode: before a project is configured the prototype remains reachable.
  // As soon as one global Supabase project is configured, every /hub route is protected.
  if(!url||!key)return NextResponse.next({request});

  let response=NextResponse.next({request});
  const supabase=createServerClient(url,key,{
    cookies:{
      getAll(){return request.cookies.getAll()},
      setAll(cookiesToSet){
        cookiesToSet.forEach(({name,value})=>request.cookies.set(name,value));
        response=NextResponse.next({request});
        cookiesToSet.forEach(({name,value,options})=>response.cookies.set(name,value,options));
      }
    }
  });
  const {data}=await supabase.auth.getClaims();
  const loggedIn=Boolean(data?.claims);
  const path=request.nextUrl.pathname;
  if(path.startsWith("/hub")&&!loggedIn){const target=request.nextUrl.clone();target.pathname="/login";target.searchParams.set("next",path);return NextResponse.redirect(target)}
  if(path==="/login"&&loggedIn){const target=request.nextUrl.clone();target.pathname="/hub/all/dashboard";target.search="";return NextResponse.redirect(target)}
  return response;
}

export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]};
