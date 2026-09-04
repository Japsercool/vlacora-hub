"use client";
import { useEffect,useState } from "react";
import { useRouter } from "next/navigation";
import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";
export default function AccountWidget(){
  const router=useRouter();const[email,setEmail]=useState("");const[configured,setConfigured]=useState(false);
  useEffect(()=>{const ok=isSupabaseBrowserConfigured();setConfigured(ok);if(!ok)return;createClient().auth.getUser().then(({data}:{data:{user?:{email?:string|null}|null}})=>setEmail(data.user?.email||"PULSE gebruiker"))},[]);
  if(!configured)return <div className="sidebar-user"><div className="avatar">V</div><div><strong>Setupmodus</strong><small>Login nog niet geactiveerd</small></div></div>;
  return <div className="sidebar-user"><div className="avatar">{(email||"V").slice(0,1).toUpperCase()}</div><div className="sidebar-user-copy"><strong>{email||"Ingelogd"}</strong><small>Supabase Auth</small></div><button className="logout-mini" title="Uitloggen" onClick={async()=>{await createClient().auth.signOut();router.replace("/login");router.refresh()}}>↪</button></div>;
}
