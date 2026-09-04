"use client";

import { FormEvent,useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordForm(){
  const[password,setPassword]=useState("");
  const[repeat,setRepeat]=useState("");
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState("");
  const router=useRouter();

  async function submit(e:FormEvent){
    e.preventDefault();setError("");
    if(password.length<10)return setError("Gebruik minstens 10 tekens.");
    if(password!==repeat)return setError("De twee wachtwoorden zijn niet hetzelfde.");
    setBusy(true);
    const{error}=await createClient().auth.updateUser({password});
    setBusy(false);
    if(error)return setError(error.message||"Wachtwoord wijzigen mislukt.");
    router.replace("/hub/all/dashboard");
    router.refresh();
  }

  return <form className="login-card" onSubmit={submit}>
    <div className="login-brand pulse-login-brand"><img src="/brand/pulse-icon.png" alt="PULSE"/><div><strong>PULSE</strong><span>YOUR STATION. ONE TEAM. ALL IN SYNC.</span></div></div>
    <div><span className="eyebrow">ACCOUNT HERSTELLEN</span><h1>Kies een nieuw wachtwoord</h1><p>Deze resetlink geeft alleen toegang tot het wijzigen van je eigen PULSE-account.</p></div>
    {error&&<div className="login-error">{error}</div>}
    <label className="field">Nieuw wachtwoord<input type="password" required minLength={10} className="input" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/></label>
    <label className="field">Herhaal wachtwoord<input type="password" required minLength={10} className="input" value={repeat} onChange={e=>setRepeat(e.target.value)} autoComplete="new-password"/></label>
    <div className="password-rules"><strong>Minstens 10 tekens</strong><span>Gebruik bij voorkeur een uniek wachtwoord dat je nergens anders gebruikt.</span></div>
    <button className="primary wide" disabled={busy}>{busy?"Opslaan…":"Nieuw wachtwoord opslaan"}</button>
  </form>
}
