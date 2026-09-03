"use client";

import { useCallback,useEffect,useState } from "react";
import { useRouter } from "next/navigation";
import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import { loadOperationalWarnings,resolveOperationalWarning,runOperationalChecks,type OperationalWarning } from "@/lib/supabase/operations";

export default function OperationalWarningsPanel({stationSlug}:{stationSlug:string}){
  const router=useRouter();
  const[items,setItems]=useState<OperationalWarning[]>([]);
  const[busy,setBusy]=useState(false);
  const[notice,setNotice]=useState("");
  const configured=isSupabaseBrowserConfigured();
  const load=useCallback(async()=>{if(!configured)return;try{setItems(await loadOperationalWarnings(stationSlug,true))}catch{}},[configured,stationSlug]);
  useEffect(()=>{void load()},[load]);
  useEffect(()=>{
    if(!configured)return;
    const supabase=createClient();const ch=supabase.channel(`vlacora-warnings-${stationSlug}`).on("postgres_changes",{event:"*",schema:"public",table:"hub_operational_warnings"},()=>void load()).subscribe();
    return()=>{void supabase.removeChannel(ch)};
  },[configured,load,stationSlug]);
  async function check(){setBusy(true);setNotice("");try{setItems(await runOperationalChecks(stationSlug,{force:true}));setNotice("Operationele controle uitgevoerd")}catch(e){setNotice(e instanceof Error?e.message:"Controle mislukt")}finally{setBusy(false)}}
  async function resolve(item:OperationalWarning){await resolveOperationalWarning(item.stationSlug,item.code,item.warningKey.split(":").slice(2).join(":")||"main");await load()}
  if(!configured||stationSlug==="all")return null;
  return <section className="card warnings-panel">
    <div className="section-head"><div><span className="eyebrow">AUTOMATISCHE CONTROLES</span><h3>Operationele waarschuwingen</h3><p>Event/revision-gericht en bij openen van de HUB; geen constante achtergrondpolling.</p></div><button className="ghost" disabled={busy} onClick={()=>void check()}>↻ {busy?"Controleren…":"Controleer nu"}</button></div>
    {notice&&<div className="inline-notice">{notice}</div>}
    {items.length===0?<div className="empty-live-state compact"><strong>Geen open waarschuwingen</strong><span>Verplichte talks, belangrijke taken en redactionele aandachtspunten zijn gecontroleerd wanneer data beschikbaar is.</span></div>:<div className="warnings-list">{items.map(w=><div className={`warning-row ${w.severity}`} key={w.warningKey}><span className="warning-symbol">{w.severity==="critical"?"!":"•"}</span><div><strong>{w.title}</strong><small>{w.body}</small><em>{w.source} • laatst gezien {new Date(w.lastSeenAt).toLocaleString("nl-BE")}</em></div><div className="warning-actions"><button className="ghost" onClick={()=>router.push(w.actionPath||`/hub/${stationSlug}/dashboard`)}>Open</button><button className="ghost" onClick={()=>void resolve(w)}>Markeer opgelost</button></div></div>)}</div>}
  </section>;
}
