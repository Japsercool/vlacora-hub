"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import { loadSharedProgramming,syncSharedProgramming } from "@/lib/supabase/hub-data";
import { emitActivity } from "@/lib/collaboration/activity";

type ProgramBlock={
  id:string; day:number; start:string; end:string; name:string; host:string; format:string; notes:string; active:boolean;
};
const DAYS=["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag","Zondag"];
const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
function useStored<T>(key:string,initial:T){
  const[v,setV]=useState<T>(initial);const[ready,setReady]=useState(false);
  useEffect(()=>{try{const raw=localStorage.getItem(key);if(raw)setV(JSON.parse(raw))}catch{}setReady(true)},[key]);
  useEffect(()=>{if(ready)try{localStorage.setItem(key,JSON.stringify(v));window.dispatchEvent(new CustomEvent("vlacora:programming-changed",{detail:{key}}))}catch{}},[key,ready,v]);
  return[v,setV] as const;
}
export default function ProgrammingModule({stationSlug,stationName}:{stationSlug:string;stationName:string}){
  const[blocks,setBlocks]=useStored<ProgramBlock[]>(`vlacora:${stationSlug}:programming:v10`,[]);
  const[day,setDay]=useState(new Date().getDay()===0?6:new Date().getDay()-1);
  const[selectedId,setSelectedId]=useState("");
  const[notice,setNotice]=useState("");
  const[cloudReady,setCloudReady]=useState(false);
  const[cloudActive,setCloudActive]=useState(false);
  const[syncing,setSyncing]=useState(false);
  const current=useMemo(()=>blocks.filter(x=>x.day===day).sort((a,b)=>a.start.localeCompare(b.start)),[blocks,day]);
  const selected=blocks.find(x=>x.id===selectedId)||null;
  useEffect(()=>{emitActivity({detail:selected?`Programmering • ${selected.name} (${selected.start}–${selected.end})`:`Programmering • ${DAYS[day]}`,entityType:"program",entityId:selected?.id})},[selected?.id,selected?.name,selected?.start,selected?.end,day]);

  useEffect(()=>{
    let alive=true;setCloudReady(false);
    if(!isSupabaseBrowserConfigured()){setCloudActive(false);setCloudReady(true);return()=>{alive=false}}
    setCloudActive(true);
    loadSharedProgramming(stationSlug).then(rows=>{if(!alive)return;if(rows.length)setBlocks(rows);setCloudReady(true)}).catch(()=>{if(alive){setCloudActive(false);setCloudReady(true);flash("Teamcloud niet bereikbaar; programmering blijft lokaal beschikbaar.")}});
    return()=>{alive=false};
  },[stationSlug]);
  useEffect(()=>{
    if(!cloudReady||!cloudActive)return;
    const timer=setTimeout(()=>{setSyncing(true);syncSharedProgramming(stationSlug,blocks).catch(()=>flash("Synchronisatie van programmering naar Teamcloud mislukt.")).finally(()=>setSyncing(false))},850);
    return()=>clearTimeout(timer);
  },[blocks,cloudReady,cloudActive,stationSlug]);
  function flash(x:string){setNotice(x);setTimeout(()=>setNotice(""),2200)}
  function add(){const n:ProgramBlock={id:uid(),day,start:"10:00",end:"12:00",name:"Nieuw programma",host:"",format:"Muziekprogramma",notes:"",active:true};setBlocks([...blocks,n]);setSelectedId(n.id)}
  function patch(p:Partial<ProgramBlock>){if(!selected)return;setBlocks(blocks.map(x=>x.id===selected.id?{...x,...p}:x))}
  function duplicate(){if(!selected)return;const n={...selected,id:uid(),name:`${selected.name} kopie`};setBlocks([...blocks,n]);setSelectedId(n.id);flash("Programma gekopieerd")}
  function copyDay(target:number){const src=blocks.filter(x=>x.day===day);const kept=blocks.filter(x=>x.day!==target);setBlocks([...kept,...src.map(x=>({...x,id:uid(),day:target}))]);flash(`Schema gekopieerd naar ${DAYS[target]}`)}
  return <div>
    <div className="page-intro"><div><h2>Programmering</h2><p>Echte, bewerkbare programmering voor {stationName}. Geen vast demo-schema.</p><span className={`cloud-state ${cloudActive?"online":"local"}`}>{cloudActive?(syncing?"Teamcloud synchroniseert…":"Teamcloud actief"):"Lokaal op dit toestel"}</span></div><button className="primary" onClick={add}>+ Programma</button></div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}
    <div className="day-tabs programming-days">{DAYS.map((d,i)=><button key={d} className={day===i?"active":""} onClick={()=>{setDay(i);setSelectedId("")}}>{d.slice(0,2)}</button>)}</div>
    <div className="programming-v10-layout">
      <div className="card programming-list-v10">
        <div className="module-title-row"><div><h3>{DAYS[day]}</h3><small>{current.length} programma&apos;s</small></div><select className="select compact-select" defaultValue="" onChange={e=>{if(e.target.value!==""){copyDay(Number(e.target.value));e.currentTarget.value=""}}}><option value="">Kopieer dag naar…</option>{DAYS.map((d,i)=>i!==day&&<option value={i} key={d}>{d}</option>)}</select></div>
        {current.length===0&&<div className="empty-live-state"><strong>Nog geen programmering</strong><span>Voeg het eerste programma toe. Alles wat je hier opslaat blijft station-specifiek bewaard.</span></div>}
        {current.map(x=><button className={`programming-row-v10 ${selectedId===x.id?"selected":""}`} key={x.id} onClick={()=>setSelectedId(x.id)}><div className="programming-time-v10"><strong>{x.start}</strong><span>{x.end}</span></div><div><strong>{x.name}</strong><span>{x.host||"Geen presentator"} • {x.format}</span></div><span className={x.active?"status-dot-text ok":"status-dot-text off"}>{x.active?"Actief":"Uit"}</span></button>)}
      </div>
      <div className="card programming-editor-v10">
        {!selected&&<div className="empty-live-state"><strong>Kies een programma</strong><span>Hier kun je naam, uren, presentator, format en notities wijzigen.</span></div>}
        {selected&&<>
          <div className="module-title-row"><div><span className="eyebrow">PROGRAMMA BEWERKEN</span><h3>{selected.name}</h3></div><label className="mini-toggle">Actief <input type="checkbox" checked={selected.active} onChange={e=>patch({active:e.target.checked})}/></label></div>
          <div className="two-form-cols"><label className="field">Start<input type="time" className="input" value={selected.start} onChange={e=>patch({start:e.target.value})}/></label><label className="field">Einde<input type="time" className="input" value={selected.end} onChange={e=>patch({end:e.target.value})}/></label></div>
          <label className="field">Naam<input className="input" value={selected.name} onChange={e=>patch({name:e.target.value})}/></label>
          <label className="field">Presentator / team<input className="input" value={selected.host} onChange={e=>patch({host:e.target.value})} placeholder="bv. Jasper & Tibo"/></label>
          <label className="field">Format<select className="select" value={selected.format} onChange={e=>patch({format:e.target.value})}>{["Muziekprogramma","Drive","Ochtendshow","Hitlijst","Special","Opgenomen programma","DJ-set","Nieuws / info","Ander"].map(x=><option key={x}>{x}</option>)}</select></label>
          <label className="field">Notities<textarea className="input textarea" value={selected.notes} onChange={e=>patch({notes:e.target.value})} placeholder="Vaste rubrieken, DJ-wissel, redactie-afspraken…"/></label>
          <div className="button-row"><button className="ghost" onClick={duplicate}>Dupliceren</button><button className="ghost danger-text" onClick={()=>{setBlocks(blocks.filter(x=>x.id!==selected.id));setSelectedId("")}}>Verwijderen</button></div>
        </>}
      </div>
    </div>
  </div>
}
