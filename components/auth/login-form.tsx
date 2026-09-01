"use client";
import { FormEvent,useState } from "react";
import { useRouter,useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm(){
  const[email,setEmail]=useState("");
  const[password,setPassword]=useState("");
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState("");
  const router=useRouter();
  const search=useSearchParams();
  async function submit(e:FormEvent){
    e.preventDefault();setBusy(true);setError("");
    const{error}=await createClient().auth.signInWithPassword({email,password});
    setBusy(false);if(error)return setError(error.message);
    router.replace(search.get("next")||"/hub/all/dashboard");router.refresh();
  }
  return <form className="login-card" onSubmit={submit}>
    <div className="login-brand"><div className="brand-mark">V</div><div><strong>VLACORA</strong><span>HUB</span></div></div>
    <div><span className="eyebrow">TEAM LOGIN</span><h1>Welkom terug</h1><p>Log in met je VLACORA-teamaccount.</p></div>
    {error&&<div className="login-error">{error}</div>}
    <label className="field">E-mail<input type="email" required className="input" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>
    <label className="field">Wachtwoord<input type="password" required className="input" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label>
    <button className="primary wide" disabled={busy}>{busy?"Inloggen…":"Inloggen"}</button>
    <small className="login-foot">Accounts worden centraal beheerd in Supabase Auth. Er is bewust geen open registratieknop.</small>
  </form>
}
