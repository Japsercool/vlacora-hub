"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import { loadSharedProgramming,syncSharedProgramming } from "@/lib/supabase/hub-data";
import { emitActivity } from "@/lib/collaboration/activity";
import { loadProgramOverrides,loadProgramTeamAssignments,loadTeamPeople,saveProgramTeam,type ProgramOverride,type ProgramTeamMember,type TeamPerson } from "@/lib/supabase/operations";
import { useCollaboration } from "@/components/collaboration/collaboration-provider";

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
  const collaboration=useCollaboration();
  const canManageTeam=["superadmin","stationmanager","admin","beheer"].includes(String(collaboration.currentUser?.role||"").toLowerCase());
  const currentUserId=String(collaboration.currentUser?.id||"");
  const[blocks,setBlocks]=useStored<ProgramBlock[]>(`vlacora:${stationSlug}:programming:v10`,[]);
  const[day,setDay]=useState(new Date().getDay()===0?6:new Date().getDay()-1);
  const[selectedId,setSelectedId]=useState("");
  const[notice,setNotice]=useState("");
  const[cloudReady,setCloudReady]=useState(false);
  const[cloudActive,setCloudActive]=useState(false);
  const[syncing,setSyncing]=useState(false);
  const[overrides,setOverrides]=useState<ProgramOverride[]>([]);
  const[teamPeople,setTeamPeople]=useState<TeamPerson[]>([]);
  const[programTeams,setProgramTeams]=useState<Record<string,ProgramTeamMember[]>>({});
  const[teamBusy,setTeamBusy]=useState(false);
  const current=useMemo(()=>blocks.filter(x=>x.day===day).sort((a,b)=>a.start.localeCompare(b.start)),[blocks,day]);
  const selected=blocks.find(x=>x.id===selectedId)||null;
  useEffect(()=>{emitActivity({detail:selected?`Programmering • ${selected.name} (${selected.start}–${selected.end})`:`Programmering • ${DAYS[day]}`,entityType:"program",entityId:selected?.id})},[selected?.id,selected?.name,selected?.start,selected?.end,day]);

  useEffect(()=>{
    let alive=true;setCloudReady(false);
    if(!isSupabaseBrowserConfigured()){setCloudActive(false);setCloudReady(true);return()=>{alive=false}}
    setCloudActive(true);
    Promise.all([loadSharedProgramming(stationSlug),loadTeamPeople(stationSlug)]).then(async([rows,people])=>{
      if(!alive)return;
      if(rows.length)setBlocks(rows);
      setTeamPeople(people);
      try{setProgramTeams(await loadProgramTeamAssignments(rows.map(x=>x.id)))}catch{setProgramTeams({})}
      setCloudReady(true);
    }).catch(()=>{if(alive){setCloudActive(false);setCloudReady(true);flash("Teamcloud niet bereikbaar; programmering blijft lokaal beschikbaar.")}});
    return()=>{alive=false};
  },[stationSlug]);
  useEffect(()=>{
    if(!cloudReady||!cloudActive)return;
    const timer=setTimeout(()=>{setSyncing(true);syncSharedProgramming(stationSlug,blocks).catch(()=>flash("Synchronisatie van programmering naar Teamcloud mislukt.")).finally(()=>setSyncing(false))},850);
    return()=>clearTimeout(timer);
  },[blocks,cloudReady,cloudActive,stationSlug]);
  useEffect(()=>{
    if(!cloudReady||stationSlug==="all")return;
    const from=new Date(),to=new Date(Date.now()+21*86400000);
    const key=(d:Date)=>d.toISOString().slice(0,10);
    loadProgramOverrides(stationSlug,key(from),key(to)).then(setOverrides).catch(()=>setOverrides([]));
  },[stationSlug,cloudReady,blocks]);
  const overridesByProgram=useMemo(()=>{const m=new Map<string,ProgramOverride[]>();for(const o of overrides){const a=m.get(o.programId)||[];a.push(o);m.set(o.programId,a)}return m},[overrides]);
  function flash(x:string){setNotice(x);setTimeout(()=>setNotice(""),2200)}
  function add(){const n:ProgramBlock={id:uid(),day,start:"10:00",end:"12:00",name:"Nieuw programma",host:"",format:"Muziekprogramma",notes:"",active:true};setBlocks([...blocks,n]);setSelectedId(n.id)}
  function patch(p:Partial<ProgramBlock>){if(!selected)return;setBlocks(blocks.map(x=>x.id===selected.id?{...x,...p}:x))}
  function displayHost(members:ProgramTeamMember[]){return members.slice().sort((a,b)=>Number(b.isPrimary)-Number(a.isPrimary)).map(m=>m.name||teamPeople.find(p=>p.id===m.userId)?.name||"Teamlid").join(" & ")}
  async function persistTeam(program:ProgramBlock,next:ProgramTeamMember[]){
    if(!canManageTeam)return;
    const normalized=next.map((member,index)=>({...member,programId:program.id,isPrimary:member.isPrimary||(!next.some(x=>x.isPrimary)&&index===0)}));
    const host=displayHost(normalized);
    const nextBlocks=blocks.map(x=>x.id===program.id?{...x,host}:x);
    setProgramTeams(old=>({...old,[program.id]:normalized}));setBlocks(nextBlocks);setTeamBusy(true);
    try{
      await syncSharedProgramming(stationSlug,nextBlocks);
      const saved=await saveProgramTeam(program.id,normalized.map(x=>({userId:x.userId,role:x.role,isPrimary:x.isPrimary})));
      setProgramTeams(old=>({...old,[program.id]:saved}));flash("Programma aan accounts gekoppeld");
    }catch(e){flash(e instanceof Error?e.message:"Accountkoppeling opslaan mislukt")}finally{setTeamBusy(false)}
  }
  function setPrimaryPresenter(userId:string){
    if(!selected)return;
    const existing=programTeams[selected.id]||[];
    if(!userId){void persistTeam(selected,existing.map(x=>({...x,isPrimary:false})));return}
    const person=teamPeople.find(x=>x.id===userId);if(!person)return;
    const found=existing.find(x=>x.userId===userId);
    const next=[...(found?existing:existing.concat({programId:selected.id,userId,role:"presentator",isPrimary:true,name:person.name,initials:person.initials,avatarUrl:person.avatarUrl}))].map(x=>({...x,isPrimary:x.userId===userId,role:x.userId===userId&&x.role==="team"?"presentator":x.role}));
    void persistTeam(selected,next);
  }
  function toggleExtraPerson(person:TeamPerson){
    if(!selected)return;
    const existing=programTeams[selected.id]||[];const found=existing.find(x=>x.userId===person.id);
    if(found){if(found.isPrimary)return flash("Kies eerst een andere hoofdpresentator.");void persistTeam(selected,existing.filter(x=>x.userId!==person.id));return}
    void persistTeam(selected,[...existing,{programId:selected.id,userId:person.id,role:"co-presentator",isPrimary:false,name:person.name,initials:person.initials,avatarUrl:person.avatarUrl}]);
  }
  function duplicate(){if(!selected)return;const n={...selected,id:uid(),name:`${selected.name} kopie`};setBlocks([...blocks,n]);setSelectedId(n.id);flash("Programma gekopieerd")}
  function copyDay(target:number){const src=blocks.filter(x=>x.day===day);const kept=blocks.filter(x=>x.day!==target);setBlocks([...kept,...src.map(x=>({...x,id:uid(),day:target}))]);flash(`Schema gekopieerd naar ${DAYS[target]}`)}
  return <div>
    <div className="page-intro"><div><h2>Programmering</h2><p>Echte, bewerkbare programmering voor {stationName}. Geen vast demo-schema.</p><span className={`cloud-state ${cloudActive?"online":"local"}`}>{cloudActive?(syncing?"Teamcloud synchroniseert…":"Teamcloud actief"):"Lokaal op dit toestel"}</span></div><button className="primary" onClick={add}>+ Programma</button></div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}
    {overrides.length>0&&<section className="card programming-overrides"><div className="section-head"><div><h3>Afwezigheden in de komende 3 weken</h3><p>Dit is automatisch gekoppeld aan Afwezigheden. Zodra beheer een vervanger bevestigt, verandert de programmastatus hier mee.</p></div><span className="metric-badge">{overrides.length} uitzendingen</span></div><div className="program-override-list">{overrides.slice(0,12).map(o=><div className={`program-override-row ${o.status}`} key={o.id}><div><strong>{new Date(`${o.airDate}T12:00:00`).toLocaleDateString("nl-BE",{weekday:"short",day:"2-digit",month:"2-digit"})} • {o.programName}</strong><span>{o.originalName}{o.replacementName?` → vervanging: ${o.replacementName}`:""}</span></div><b>{o.status==="covered"?"✓ Vervanger bevestigd":o.status==="can_run"?"Kan doorgaan met bestaand team":o.status==="cancelled"?"Geannuleerd":"Vervanger nodig"}</b></div>)}</div></section>}
    <div className="day-tabs programming-days">{DAYS.map((d,i)=><button key={d} className={day===i?"active":""} onClick={()=>{setDay(i);setSelectedId("")}}>{d.slice(0,2)}</button>)}</div>
    <div className="programming-v10-layout">
      <div className="card programming-list-v10">
        <div className="module-title-row"><div><h3>{DAYS[day]}</h3><small>{current.length} programma&apos;s</small></div><select className="select compact-select" defaultValue="" onChange={e=>{if(e.target.value!==""){copyDay(Number(e.target.value));e.currentTarget.value=""}}}><option value="">Kopieer dag naar…</option>{DAYS.map((d,i)=>i!==day&&<option value={i} key={d}>{d}</option>)}</select></div>
        {current.length===0&&<div className="empty-live-state"><strong>Nog geen programmering</strong><span>Voeg het eerste programma toe. Alles wat je hier opslaat blijft station-specifiek bewaard.</span></div>}
        {current.map(x=>{const linked=programTeams[x.id]||[];const mine=currentUserId&&linked.some(m=>m.userId===currentUserId);return <button className={`programming-row-v10 ${selectedId===x.id?"selected":""}`} key={x.id} onClick={()=>setSelectedId(x.id)}><div className="programming-time-v10"><strong>{x.start}</strong><span>{x.end}</span></div><div><strong>{x.name}{mine&&<small className="my-program-chip">Mijn programma</small>}</strong><span>{linked.length?displayHost(linked):x.host||"Geen account gekoppeld"} • {x.format}</span></div><div className="programming-row-status"><span className={x.active?"status-dot-text ok":"status-dot-text off"}>{x.active?"Actief":"Uit"}</span>{!linked.length&&<small className="warning-chip">Account koppelen</small>}{(overridesByProgram.get(x.id)||[]).some(o=>o.status==="needs_replacement")&&<small className="warning-chip">Vervanger nodig</small>}{(overridesByProgram.get(x.id)||[]).some(o=>o.status==="covered")&&<small className="ok-chip">Vervanging rond</small>}</div></button>})}
      </div>
      <div className="card programming-editor-v10">
        {!selected&&<div className="empty-live-state"><strong>Kies een programma</strong><span>Hier kun je naam, uren, presentator, format en notities wijzigen.</span></div>}
        {selected&&<>
          <div className="module-title-row"><div><span className="eyebrow">PROGRAMMA BEWERKEN</span><h3>{selected.name}</h3></div><label className="mini-toggle">Actief <input type="checkbox" checked={selected.active} onChange={e=>patch({active:e.target.checked})}/></label></div>
          <div className="two-form-cols"><label className="field">Start<input type="time" className="input" value={selected.start} onChange={e=>patch({start:e.target.value})}/></label><label className="field">Einde<input type="time" className="input" value={selected.end} onChange={e=>patch({end:e.target.value})}/></label></div>
          <label className="field">Naam<input className="input" value={selected.name} onChange={e=>patch({name:e.target.value})}/></label>
          <div className="program-account-linker"><label className="field">Hoofdpresentator (Supabase-account)<select className="select" disabled={!canManageTeam||teamBusy} value={(programTeams[selected.id]||[]).find(x=>x.isPrimary)?.userId||""} onChange={e=>setPrimaryPresenter(e.target.value)}><option value="">— Nog niet gekoppeld —</option>{teamPeople.map(person=><option key={person.id} value={person.id}>{person.name} • {person.jobTitle||person.role}</option>)}</select><small className="field-note">Deze accountkoppeling bepaalt automatisch of dit bij “Mijn uitzending” hoort.</small></label><div className="field"><span>Extra presentatoren / team</span><div className="program-account-chips">{teamPeople.map(person=>{const member=(programTeams[selected.id]||[]).find(x=>x.userId===person.id);return <button type="button" disabled={!canManageTeam||teamBusy||Boolean(member?.isPrimary)} key={person.id} className={member?"selected":""} onClick={()=>toggleExtraPerson(person)}><span className="mini-avatar">{person.avatarUrl?<img src={person.avatarUrl} alt=""/>:person.initials}</span><strong>{person.name}</strong>{member&&<b>{member.isPrimary?"Hoofd":"✓"}</b>}</button>})}</div>{!canManageTeam&&<small className="field-note">Alleen beheer kan accountkoppelingen wijzigen.</small>}</div></div>
          <label className="field">Format<select className="select" value={selected.format} onChange={e=>patch({format:e.target.value})}>{["Muziekprogramma","Drive","Ochtendshow","Hitlijst","Special","Opgenomen programma","DJ-set","Nieuws / info","Ander"].map(x=><option key={x}>{x}</option>)}</select></label>
          <label className="field">Notities<textarea className="input textarea" value={selected.notes} onChange={e=>patch({notes:e.target.value})} placeholder="Vaste rubrieken, DJ-wissel, redactie-afspraken…"/></label>
          <div className="button-row"><Link className="primary soft" href={`/hub/${stationSlug}/programmas?program=${encodeURIComponent(selected.id)}`}>Open programmapagina →</Link><button className="ghost" onClick={duplicate}>Dupliceren</button><button className="ghost danger-text" onClick={()=>{setBlocks(blocks.filter(x=>x.id!==selected.id));setSelectedId("")}}>Verwijderen</button></div>
        </>}
      </div>
    </div>
  </div>
}
