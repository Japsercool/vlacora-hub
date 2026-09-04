"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient, isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import styles from "./database-backend-v2.module.css";

type Config = {
  scope:string;active_backend:"supabase"|"external_postgres";target_kind:"postgres"|"self_hosted_supabase";target_name:string;gateway_url:string;database_name:string;ssl_required:boolean;status:string;gateway_fingerprint:string;last_test_at:string|null;activated_at:string|null;previous_backend:string;
};
const initial:Config={scope:"global",active_backend:"supabase",target_kind:"postgres",target_name:"",gateway_url:"",database_name:"",ssl_required:true,status:"not_configured",gateway_fingerprint:"",last_test_at:null,activated_at:null,previous_backend:"supabase"};

export function DatabaseBackendV2(){
 const client=useMemo(()=>isSupabaseBrowserConfigured()?createClient():null,[]);
 const [cfg,setCfg]=useState<Config>(initial);const [host,setHost]=useState("");const [port,setPort]=useState("5432");const [dbUser,setDbUser]=useState("");const [dbPassword,setDbPassword]=useState("");const [setupToken,setSetupToken]=useState("");const [busy,setBusy]=useState("");const [msg,setMsg]=useState("");const [error,setError]=useState("");
 useEffect(()=>{if(!client)return;void client.from("hub_data_backend_configs").select("*").eq("scope","global").maybeSingle().then(({data,error})=>{if(error)setError(error.message);if(data)setCfg(data as Config);});},[client]);
 async function actor(){const {data}=await client!.auth.getUser();return data.user?.id||null}
 async function saveConfig(patch:Partial<Config>){if(!client)return;const row={...cfg,...patch,updated_by:await actor(),updated_at:new Date().toISOString()};const {data,error:e}=await client.from("hub_data_backend_configs").upsert(row,{onConflict:"scope"}).select("*").single();if(e)throw e;setCfg(data as Config)}
 async function gateway(path:string,body:any){const base=cfg.gateway_url.trim().replace(/\/$/,"");if(!base)throw new Error("Vul eerst de Gateway URL in.");const {data:s}=await client!.auth.getSession();const jwt=s.session?.access_token||"";const res=await fetch(base+path,{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${jwt}`,"x-pulse-setup-token":setupToken},body:JSON.stringify(body)});const json=await res.json().catch(()=>({}));if(!res.ok)throw new Error(json.error||`Gateway antwoordde ${res.status}`);return json}
 async function run(kind:string,fn:()=>Promise<void>){setBusy(kind);setError("");setMsg("");try{await fn()}catch(e:any){setError(e?.message||String(e))}finally{setBusy("")}}
 const connection={host,port:Number(port||5432),database:cfg.database_name,user:dbUser,password:dbPassword,ssl:cfg.ssl_required};
 return <section className={styles.shell}>
  <div className={styles.head}><div><h2>Database-backend</h2><p>Supabase Auth blijft vast. Alleen de PULSE-data kan naar je eigen server verhuizen.</p></div><span>{cfg.active_backend==="supabase"?"SUPABASE / POSTGRESQL":"EIGEN POSTGRESQL"}</span></div>
  <div className={styles.cards}><Card k="LOGIN / ACCOUNTS" t="Supabase Auth blijft vast" p="Login, sessies en user UUID's blijven bij de huidige Supabase Auth."/><Card k="ACTIEVE DATA-BACKEND" t={cfg.active_backend==="supabase"?"Supabase PostgreSQL":"Eigen PostgreSQL"} p="Alle PULSE-data loopt via één centrale datalaag."/><Card k="OMSCHAKELING" t={cfg.status.replaceAll("_"," ")} p="Activeren kan pas na een geslaagde test en migratiecontrole."/></div>
  <div className={styles.grid}>
   <label>Doeltype<select value={cfg.target_kind} onChange={e=>setCfg(v=>({...v,target_kind:e.target.value as Config["target_kind"]}))}><option value="postgres">Eigen PostgreSQL</option><option value="self_hosted_supabase">Self-hosted Supabase/PostgreSQL</option></select></label>
   <label>Naam doelomgeving<input value={cfg.target_name} onChange={e=>setCfg(v=>({...v,target_name:e.target.value}))} placeholder="bv. PULSE DB Server"/></label>
   <label className={styles.span2}>PULSE Data Gateway URL<input value={cfg.gateway_url} onChange={e=>setCfg(v=>({...v,gateway_url:e.target.value}))} placeholder="https://pulse-data.jouwdomein.be"/></label>
   <label>PostgreSQL host<input value={host} onChange={e=>setHost(e.target.value)} placeholder="127.0.0.1"/></label><label>Poort<input value={port} onChange={e=>setPort(e.target.value)} inputMode="numeric"/></label>
   <label>Database<input value={cfg.database_name} onChange={e=>setCfg(v=>({...v,database_name:e.target.value}))} placeholder="pulse"/></label><label>Gebruiker<input value={dbUser} onChange={e=>setDbUser(e.target.value)} autoComplete="off"/></label>
   <label className={styles.span2}>Databasewachtwoord<input type="password" value={dbPassword} onChange={e=>setDbPassword(e.target.value)} autoComplete="new-password"/><small>Wordt nooit in Supabase of browseropslag bewaard. Alleen via HTTPS naar je eigen Gateway gestuurd.</small></label>
   <label className={styles.span2}>Gateway setup-token<input type="password" value={setupToken} onChange={e=>setSetupToken(e.target.value)} autoComplete="off"/><small>Eenmalig beheertoken van je eigen PULSE Data Gateway.</small></label>
   <label className={styles.check}><input type="checkbox" checked={cfg.ssl_required} onChange={e=>setCfg(v=>({...v,ssl_required:e.target.checked}))}/> SSL verplicht</label>
  </div>
  <div className={styles.notice}><b>Veilige omschakeling</b><span>De browser verbindt nooit rechtstreeks met PostgreSQL. De Gateway draait naast je database. De Supabase JWT wordt gecontroleerd en de bestaande user UUID blijft identiek.</span></div>
  {error&&<div className={styles.error}>{error}</div>}{msg&&<div className={styles.ok}>{msg}</div>}
  <div className={styles.actions}>
   <button onClick={()=>void run("save",async()=>{await saveConfig({status:"configured"});setMsg("Databaseplan opgeslagen.")})} disabled={!!busy}>{busy==="save"?"Opslaan…":"Databaseplan opslaan"}</button>
   <button onClick={()=>void run("test",async()=>{const r=await gateway("/admin/postgres/test",{connection});await saveConfig({status:"tested",gateway_fingerprint:r.fingerprint||"",last_test_at:new Date().toISOString()});setMsg("Gateway en PostgreSQL zijn bereikbaar.")})} disabled={!!busy}>{busy==="test"?"Testen…":"1. Verbinding testen"}</button>
   <button onClick={()=>void run("configure",async()=>{await gateway("/admin/postgres/configure",{connection});await saveConfig({status:"tested"});setDbPassword("");setMsg("DB-instellingen zijn lokaal versleuteld op de Gateway opgeslagen.")})} disabled={!!busy}>{busy==="configure"?"Opslaan…":"2. Veilig opslaan op Gateway"}</button>
   <button className={styles.primary} onClick={()=>void run("migrate",async()=>{const r=await gateway("/admin/migrate",{targetName:cfg.target_name});await saveConfig({status:r.status==="ready"?"ready":"migrating"});setMsg(r.message||"Migratie gestart.")})} disabled={!!busy}>{busy==="migrate"?"Migreren…":"3. Migreren & controleren"}</button>
   <button className={styles.primary} onClick={()=>void run("activate",async()=>{if(cfg.status!=="ready"&&cfg.status!=="tested")throw new Error("Eerst migreren en controleren.");await gateway("/admin/activate",{});await saveConfig({previous_backend:cfg.active_backend,active_backend:"external_postgres",status:"active",activated_at:new Date().toISOString()});setMsg("Eigen PostgreSQL is nu de actieve PULSE-data-backend.")})} disabled={!!busy||cfg.active_backend==="external_postgres"}>{busy==="activate"?"Activeren…":"4. Activeer eigen PostgreSQL"}</button>
   <button className={styles.rollback} onClick={()=>void run("rollback",async()=>{await gateway("/admin/rollback",{});await saveConfig({active_backend:"supabase",status:"rollback"});setMsg("Teruggeschakeld naar Supabase-data.")})} disabled={!!busy||cfg.active_backend!=="external_postgres"}>Rollback naar Supabase</button>
  </div>
 </section>
}
function Card({k,t,p}:{k:string;t:string;p:string}){return <div className={styles.card}><small>{k}</small><strong>{t}</strong><p>{p}</p></div>}
export default DatabaseBackendV2;
