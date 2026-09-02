"use client";

import { useCallback,useEffect,useMemo,useState } from "react";
import { useRouter } from "next/navigation";
import { useCollaboration } from "@/components/collaboration/collaboration-provider";
import { loadPersonalInbox } from "@/lib/supabase/operations";
import { emitActivity } from "@/lib/collaboration/activity";

export default function PersonalInboxModule({stationSlug}:{stationSlug:string}){
  const collaboration=useCollaboration(),router=useRouter();
  const[data,setData]=useState<any>({tasks:[],requests:[],meetings:[],replacements:[],warnings:[]});
  const[busy,setBusy]=useState(true);
  const load=useCallback(async()=>{
    const userId=collaboration.currentUser?.id;if(!userId||userId==="local-user"){setBusy(false);return}
    setBusy(true);try{setData(await loadPersonalInbox(stationSlug,userId));emitActivity({detail:"Voor mij",entityType:"personal-inbox",entityId:userId})}finally{setBusy(false)}
  },[stationSlug,collaboration.currentUser?.id]);
  useEffect(()=>{void load()},[load]);

  const mentions=useMemo(()=>collaboration.notifications.filter(n=>!n.seenAt||n.recipientUserId===collaboration.currentUser?.id).slice(0,10),[collaboration.notifications,collaboration.currentUser?.id]);
  const activeTalks=useMemo(()=>collaboration.presence.filter(p=>p.isMe&&p.entityType==="talk-editor"),[collaboration.presence]);
  if(busy)return <div className="page-intro"><div><h2>Voor mij</h2><p>Je persoonlijke werkbak wordt samengesteld…</p></div></div>;

  return <div className="personal-inbox-page">
    <div className="page-intro"><div><span className="eyebrow">PERSOONLIJKE WERKBAK</span><h2>Voor mij</h2><p>Alles wat jouw aandacht vraagt, over modules heen: taken, berichten, aanvragen, uitzendingen en vervangingen.</p></div><button className="ghost" onClick={()=>void load()}>↻ Vernieuw</button></div>
    <div className="personal-inbox-metrics">
      <button onClick={()=>router.push(`/hub/${stationSlug}/taken`)}><strong>{data.tasks.length}</strong><span>open taken</span></button>
      <button onClick={()=>collaboration.openNotifications()}><strong>{mentions.length}</strong><span>meldingen / vermeldingen</span></button>
      <button onClick={()=>router.push(`/hub/${stationSlug}/aanvragen`)}><strong>{data.requests.filter((x:any)=>x.status!=="new"||x.admin_note).length}</strong><span>aanvragen bijgewerkt</span></button>
      <button onClick={()=>router.push(`/hub/${stationSlug}/afwezigheden`)}><strong>{data.replacements.length}</strong><span>vervangingen gevraagd</span></button>
      <button onClick={()=>router.push(`/hub/${stationSlug}/redactie`)}><strong>{activeTalks.length}</strong><span>talks waar je nu aan werkt</span></button>
    </div>
    <div className="personal-inbox-grid">
      <section className="card"><div className="section-head"><div><h3>Mijn taken</h3><p>Open en aan jou toegewezen.</p></div><button className="ghost" onClick={()=>router.push(`/hub/${stationSlug}/taken`)}>Open taken</button></div>{data.tasks.length===0?<div className="empty-live-state compact"><strong>Geen open taken</strong></div>:data.tasks.slice(0,8).map((x:any)=><button className="personal-inbox-row" key={x.id} onClick={()=>router.push(`/hub/${x.station_slug}/taken`)}><span className={`priority-dot priority-${x.priority}`}/><div><strong>{x.title}</strong><small>{x.due_at?new Date(x.due_at).toLocaleString("nl-BE",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"Geen deadline"}</small></div><b>›</b></button>)}</section>
      <section className="card"><div className="section-head"><div><h3>Berichten voor mij</h3><p>Ongelezen, verplicht of rechtstreeks aan jou.</p></div><button className="ghost" onClick={collaboration.openNotifications}>Meldingen</button></div>{mentions.length===0?<div className="empty-live-state compact"><strong>Alles gelezen</strong></div>:mentions.map(n=><button className="personal-inbox-row" key={n.id} onClick={()=>router.push(n.actionPath||`/hub/${stationSlug}/meldingen`)}><span>{n.requiresAck?"!":"●"}</span><div><strong>{n.title}</strong><small>{n.category} • {n.body}</small></div><b>›</b></button>)}</section>
      <section className="card"><div className="section-head"><div><h3>Komende afspraken</h3><p>Muziekmeetings en vervangingen.</p></div></div>{data.meetings.map((m:any)=><button className="personal-inbox-row" key={m.id} onClick={()=>router.push(`/hub/${m.station_slug}/meetings`)}><span>◎</span><div><strong>{m.title}</strong><small>{new Date(m.scheduled_at).toLocaleString("nl-BE")}</small></div><b>›</b></button>)}{data.replacements.map((r:any)=><button className="personal-inbox-row" key={r.id} onClick={()=>router.push(`/hub/${stationSlug}/afwezigheden`)}><span>↔</span><div><strong>Vervanging • {r.programName}</strong><small>{r.air_date} • {r.status}</small></div><b>›</b></button>)}{data.meetings.length+data.replacements.length===0&&<div className="empty-live-state compact"><strong>Niets gepland</strong></div>}</section>
      <section className="card"><div className="section-head"><div><h3>Mijn aanvragen</h3><p>Reacties en statuswijzigingen vanuit beheer.</p></div><button className="ghost" onClick={()=>router.push(`/hub/${stationSlug}/aanvragen`)}>Aanvragen</button></div>{data.requests.length===0?<div className="empty-live-state compact"><strong>Nog geen aanvragen</strong></div>:data.requests.slice(0,8).map((r:any)=><button className="personal-inbox-row" key={r.id} onClick={()=>router.push(`/hub/${stationSlug}/aanvragen`)}><span>＋</span><div><strong>{r.title}</strong><small>{r.status}{r.admin_note?` • ${r.admin_note}`:""}</small></div><b>›</b></button>)}</section>
      <section className="card"><div className="section-head"><div><h3>Talks waar ik nu aan werk</h3><p>Live Presence uit de redactie-editor.</p></div><button className="ghost" onClick={()=>router.push(`/hub/${stationSlug}/redactie`)}>Redactie</button></div>{activeTalks.length===0?<div className="empty-live-state compact"><strong>Geen talk open</strong><span>Zodra je een talk bewerkt, verschijnt die hier live.</span></div>:activeTalks.map(p=><button className="personal-inbox-row" key={p.entityId} onClick={()=>router.push(`/hub/${stationSlug}/redactie`)}><span>✎</span><div><strong>{p.detail}</strong><small>Live aan het bewerken</small></div><b>›</b></button>)}</section>
      <section className="card"><div className="section-head"><div><h3>Operationele aandacht</h3><p>Waarschuwingen voor jouw station.</p></div><button className="ghost" onClick={()=>router.push(`/hub/${stationSlug}/meldingen`)}>Meldingen</button></div>{data.warnings.length===0?<div className="empty-live-state compact"><strong>Geen waarschuwingen</strong></div>:data.warnings.map((w:any)=><button className={`personal-inbox-row warning-${w.severity}`} key={w.warningKey} onClick={()=>router.push(w.actionPath||`/hub/${stationSlug}/meldingen`)}><span>!</span><div><strong>{w.title}</strong><small>{w.body}</small></div><b>›</b></button>)}</section>
    </div>
  </div>;
}
