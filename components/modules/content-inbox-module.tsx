"use client";

import { useCallback,useEffect,useMemo,useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCollaboration } from "@/components/collaboration/collaboration-provider";
import { createContentItem,loadContentInbox,loadPrograms,loadTeamPeople,updateContentItem,type ContentItem,type StationProgram,type TeamPerson } from "@/lib/supabase/operations";
import { emitActivity } from "@/lib/collaboration/activity";

const types=[["idea","Idee uitzending"],["news","Nieuwsonderwerp"],["guest","Gastvoorstel"],["social","Social idee"],["music","Nieuwe muziek"],["contest","Wedstrijdidee"],["other","Andere"]];
const statuses=[["new","Nieuw"],["reviewing","Bekijken"],["planned","Gepland"],["used","Gebruikt"],["rejected","Niet gebruiken"]];
const canManage=(r:string)=>["superadmin","stationmanager","redactie","muziekredactie","social","admin","beheer"].includes(r.toLowerCase());

export default function ContentInboxModule({stationSlug}:{stationSlug:string}){
  const collaboration=useCollaboration();
  const[items,setItems]=useState<ContentItem[]>([]);
  const[team,setTeam]=useState<TeamPerson[]>([]);
  const[programs,setPrograms]=useState<StationProgram[]>([]);
  const[type,setType]=useState("idea");
  const[title,setTitle]=useState("");
  const[description,setDescription]=useState("");
  const[target,setTarget]=useState("");
  const[filter,setFilter]=useState("open");
  const[notice,setNotice]=useState("");
  const manager=canManage(collaboration.currentUser?.role||"");

  function flash(x:string){setNotice(x);setTimeout(()=>setNotice(""),2800)}
  const load=useCallback(async()=>{
    if(stationSlug==="all")return;
    try{const[i,t,p]=await Promise.all([loadContentInbox(stationSlug),loadTeamPeople(stationSlug),loadPrograms(stationSlug)]);setItems(i);setTeam(t);setPrograms(p)}catch(e){flash(e instanceof Error?e.message:"Content inbox laden mislukt")}
  },[stationSlug]);
  useEffect(()=>{void load();emitActivity({detail:"Content inbox",entityType:"content-inbox",entityId:stationSlug})},[load]);
  useEffect(()=>{
    const supabase=createClient();const ch=supabase.channel(`vlacora-content-${stationSlug}`).on("postgres_changes",{event:"*",schema:"public",table:"hub_content_inbox"},()=>void load()).subscribe();
    return()=>{void supabase.removeChannel(ch)};
  },[load,stationSlug]);

  const visible=useMemo(()=>filter==="open"?items.filter(x=>!["used","rejected"].includes(x.status)):items,[items,filter]);
  async function submit(){
    if(!title.trim())return flash("Geef je idee een titel.");
    try{await createContentItem({stationSlug,contentType:type,title,description,targetProgramId:target||null});setTitle("");setDescription("");setTarget("");await load();flash("Ingestuurd naar de content-inbox")}catch(e){flash(e instanceof Error?e.message:"Insturen mislukt")}
  }
  async function patch(item:ContentItem,changes:any){
    try{
      await updateContentItem(item.id,changes);await load();
      if(changes.assignedTo&&changes.assignedTo!==collaboration.currentUser?.id)await collaboration.publishNotification({stationSlug,title:`Content toegewezen: ${item.title}`,body:item.description||"Nieuw item in de content-inbox.",category:"Content inbox",severity:"info",requiresAck:false,actionPath:`/hub/${stationSlug}/content-inbox`,recipientUserId:changes.assignedTo}).catch(()=>{});
      if(changes.status&&item.submittedBy!==collaboration.currentUser?.id)await collaboration.publishNotification({stationSlug,title:`Content ${String(changes.status).toLowerCase()}: ${item.title}`,body:`De redactie heeft de status aangepast naar ${statuses.find(x=>x[0]===changes.status)?.[1]||changes.status}.`,category:"Content inbox",severity:"info",requiresAck:false,actionPath:`/hub/${stationSlug}/content-inbox`,recipientUserId:item.submittedBy}).catch(()=>{});
    }catch(e){flash(e instanceof Error?e.message:"Bijwerken mislukt")}
  }

  if(stationSlug==="all")return <div className="page-intro"><div><h2>Content-inbox</h2><p>Kies één station om ideeën en content te verzamelen.</p></div></div>;
  return <div className="content-inbox-page">
    <div className="page-intro"><div><span className="eyebrow">INBOX VOOR REDACTIE</span><h2>Content-inbox</h2><p>Iedereen kan ideeën, nieuws, gasten, social, muziek of wedstrijden insturen. Redactie kan ze vervolgens plannen en toewijzen.</p></div><div className="request-filter-switch"><button className={filter==="open"?"active":""} onClick={()=>setFilter("open")}>Open</button><button className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>Alles</button></div></div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}
    <div className="content-inbox-layout">
      <section className="card content-submit-card"><h3>Nieuw idee insturen</h3><label>Type<select value={type} onChange={e=>setType(e.target.value)}>{types.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Titel<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Wat wil je voorstellen?"/></label><label>Uitleg<textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Context, bron, gastgegevens, call-to-action…"/></label><label>Voor programma (optioneel)<select value={target} onChange={e=>setTarget(e.target.value)}><option value="">Nog niet gekoppeld</option>{programs.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button className="primary" onClick={()=>void submit()}>Insturen</button></section>
      <section className="content-inbox-list">{visible.length===0&&<div className="card empty-live-state"><strong>Nog niets in de inbox</strong><span>Nieuwe ideeën verschijnen hier meteen voor de redactie.</span></div>}{visible.map(item=><article className={`card content-inbox-card status-${item.status}`} key={item.id}><div className="content-inbox-head"><div><div className="request-tags"><span>{types.find(x=>x[0]===item.contentType)?.[1]||item.contentType}</span><span>{statuses.find(x=>x[0]===item.status)?.[1]||item.status}</span></div><h3>{item.title}</h3><small>Door {item.submittedByName}{item.targetProgramName?` • voor ${item.targetProgramName}`:""}</small></div>{item.scheduledFor&&<span className="scheduled-chip">{new Date(item.scheduledFor).toLocaleString("nl-BE",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span>}</div>{item.description&&<p>{item.description}</p>}{manager?<div className="content-inbox-admin"><label>Status<select value={item.status} onChange={e=>void patch(item,{status:e.target.value})}>{statuses.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Toewijzen<select value={item.assignedTo||""} onChange={e=>void patch(item,{assignedTo:e.target.value||null})}><option value="">Niemand</option>{team.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Programma<select value={item.targetProgramId||""} onChange={e=>void patch(item,{targetProgramId:e.target.value||null})}><option value="">Nog niet gekoppeld</option>{programs.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Planmoment<input type="datetime-local" value={item.scheduledFor?item.scheduledFor.slice(0,16):""} onChange={e=>void patch(item,{scheduledFor:e.target.value?new Date(e.target.value).toISOString():null})}/></label><label className="wide">Redactienotitie<textarea defaultValue={item.teamNote} onBlur={e=>void patch(item,{teamNote:e.currentTarget.value})}/></label></div>:item.teamNote?<div className="request-admin-note"><strong>Redactie</strong><span>{item.teamNote}</span></div>:null}</article>)}</section>
    </div>
  </div>;
}
