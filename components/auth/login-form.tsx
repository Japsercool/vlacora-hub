"use client";

import { FormEvent,useEffect,useState } from "react";
import { useRouter,useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const RESET_COOLDOWN_SECONDS=60;

export default function LoginForm(){
  const[email,setEmail]=useState("");
  const[password,setPassword]=useState("");
  const[busy,setBusy]=useState(false);
  const[resetBusy,setResetBusy]=useState(false);
  const[error,setError]=useState("");
  const[message,setMessage]=useState("");
  const[forgotOpen,setForgotOpen]=useState(false);
  const[cooldown,setCooldown]=useState(0);
  const router=useRouter();
  const search=useSearchParams();

  useEffect(()=>{
    if(cooldown<=0)return;
    const timer=window.setInterval(()=>setCooldown(v=>Math.max(0,v-1)),1000);
    return()=>window.clearInterval(timer);
  },[cooldown]);

  async function submit(e:FormEvent){
    e.preventDefault();setBusy(true);setError("");setMessage("");
    const{error}=await createClient().auth.signInWithPassword({email,password});
    setBusy(false);
    if(error)return setError("E-mailadres of wachtwoord is niet correct.");
    router.replace(search.get("next")||"/hub/all/dashboard");router.refresh();
  }

  async function sendReset(e:FormEvent){
    e.preventDefault();
    const clean=email.trim();
    if(!clean)return setError("Vul eerst je e-mailadres in.");
    if(cooldown>0)return;
    setResetBusy(true);setError("");setMessage("");
    try{
      const redirectTo=`${window.location.origin}/auth/callback?next=/reset-password`;
      await createClient().auth.resetPasswordForEmail(clean,{redirectTo});
      // Deliberately generic: don't reveal whether an account exists.
      setMessage("Als dit e-mailadres bij VLACORA hoort, ontvang je zo meteen een link om een nieuw wachtwoord te kiezen.");
      setCooldown(RESET_COOLDOWN_SECONDS);
    }catch{
      // Same generic message avoids account enumeration and needless retries.
      setMessage("Als dit e-mailadres bij VLACORA hoort, ontvang je zo meteen een link om een nieuw wachtwoord te kiezen.");
      setCooldown(RESET_COOLDOWN_SECONDS);
    }finally{
      setResetBusy(false);
    }
  }

  return <div className="login-card">
    <div className="login-brand"><div className="brand-mark">V</div><div><strong>VLACORA</strong><span>HUB</span></div></div>
    <div><span className="eyebrow">TEAM LOGIN</span><h1>{forgotOpen?"Wachtwoord vergeten":"Welkom terug"}</h1><p>{forgotOpen?"We sturen een beveiligde resetlink naar je e-mailadres.":"Log in met je VLACORA-teamaccount."}</p></div>

    {error&&<div className="login-error">{error}</div>}
    {message&&<div className="login-success">{message}</div>}

    {!forgotOpen?<form onSubmit={submit} className="login-inner-form">
      <label className="field">E-mail<input type="email" required className="input" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>
      <label className="field">Wachtwoord<input type="password" required className="input" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label>
      <div className="login-password-actions"><button type="button" className="login-link-button" onClick={()=>{setForgotOpen(true);setError("");setMessage("")}}>Wachtwoord vergeten?</button></div>
      <button className="primary wide" disabled={busy}>{busy?"Inloggen…":"Inloggen"}</button>
    </form>:<form onSubmit={sendReset} className="login-inner-form">
      <label className="field">E-mail<input type="email" required className="input" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>
      <button className="primary wide" disabled={resetBusy||cooldown>0}>{resetBusy?"Resetlink versturen…":cooldown>0?`Opnieuw versturen over ${cooldown}s`:"Stuur resetlink"}</button>
      <button type="button" className="ghost wide" onClick={()=>{setForgotOpen(false);setError("");setMessage("")}}>← Terug naar inloggen</button>
    </form>}

    <small className="login-foot">Accounts worden centraal beheerd in Supabase Auth. Er is bewust geen open registratieknop.</small>
  </div>
}
