import { createServerClient } from "@supabase/ssr";
import { NextResponse,type NextRequest } from "next/server";
import { VLACORA_SUPABASE_PUBLISHABLE_KEY,VLACORA_SUPABASE_URL } from "@/lib/supabase/public-config";

export async function middleware(request:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||VLACORA_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||VLACORA_SUPABASE_PUBLISHABLE_KEY;
  const path=request.nextUrl.pathname;
  // PULSE never exposes /hub without Supabase Auth. If configuration is missing,
  // keep the application behind the login/setup page instead of opening a prototype mode.
  if(!url||!key){
    if(path.startsWith("/hub")){const target=request.nextUrl.clone();target.pathname="/login";target.search="";target.searchParams.set("error","auth-not-configured");return NextResponse.redirect(target)}
    return NextResponse.next({request});
  }

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
  if(path.startsWith("/hub")&&!loggedIn){const target=request.nextUrl.clone();target.pathname="/login";target.searchParams.set("next",path);return NextResponse.redirect(target)}
  if(path.startsWith("/hub")&&loggedIn){
    // One small profile read on navigation enforces the central account Active switch.
    const {data:profile}=await supabase.from("profiles").select("active").eq("id",String(data?.claims?.sub||"")).maybeSingle();
    if(profile?.active===false){const target=request.nextUrl.clone();target.pathname="/login";target.search="";target.searchParams.set("error","account-disabled");return NextResponse.redirect(target)}
  }
  // A recovery link creates a temporary authenticated session; /reset-password must remain reachable.
  if(path==="/login"&&loggedIn){const target=request.nextUrl.clone();target.pathname="/hub/all/dashboard";target.search="";return NextResponse.redirect(target)}
  return response;
}

export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]};
