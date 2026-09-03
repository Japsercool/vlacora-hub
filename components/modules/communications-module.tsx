"use client";

import { useEffect,useMemo,useState } from "react";
import AttachmentPanel from "@/components/attachment-panel";
import { uploadAttachments } from "@/lib/supabase/attachments";
import { createAnnouncement,loadAnnouncements,removeAnnouncement,type HubAnnouncement } from "@/lib/supabase/communications";
import { useCollaboration } from "@/components/collaboration/collaboration-provider";

type Publish=(input:{stationSlug?:string;title:string;body?:string;category?:string;severity?:"info"|"warning"|"critical";requiresAck?:boolean;actionPath?:string;recipientUserId?:string|null})=>Promise<void>;

export default function CommunicationsModule({stationSlug,publishNotification}:{stationSlug:string;publishNotification:Publish}){
  const collab=useCollaboration();const role=String(collab.currentUser?.role||"").toLowerCase();
  const canPublish=["superadmin","stationmanager","admin","beheer","redactie"].includes(role);
  const canDelete=["superadmin","stationmanager","admin","beheer"].includes(role);
  const[rows,setRows]=useState<HubAnnouncement[]>([]);const[selectedId,setSelectedId]=useState("");const[showCreate,setShowCreate]=useState(false);const[files,setFiles]=useState<File[]>([]);const[notice,setNotice]=useState("");const[busy,setBusy]=useState(false);
  async function load(){try{const r=await loadAnnouncements(stationSlug);setRows(r);setSelectedId(old=>old&&r.some(x=>x.id===old)?old:r[0]?.id||"")}catch(e){setNotice(e instanceof Error?e.message:"Communicatie laden mislukt")}}
  useEffect(()=>{void load()},[stationSlug]);
  const selected=useMemo(()=>rows.find(x=>x.id===selectedId)||null,[rows,selectedId]);
  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);
    try{
      const row=await createAnnouncement({stationSlug,title:String(f.get("title")||""),body:String(f.get("body")||""),category:String(f.get("category")||"Algemeen"),importance:String(f.get("importance"))==="important"?"important":"normal",requiresAcknowledgement:f.get("requiresAck")==="on"});
      if(files.length)await uploadAttachments(stationSlug,"announcement",row.id,files);
      await publishNotification({stationSlug,title:row.title,body:row.body,category:row.category,severity:row.importance==="important"?"warning":"info",requiresAck:row.requiresAcknowledgement,actionPath:`/hub/${stationSlug}/communicatie`});
      setFiles([]);setShowCreate(false);await load();setSelectedId(row.id);setNotice(row.requiresAcknowledgement?"Verplicht bericht gepubliceerd":"Officieel bericht gepubliceerd");
    }catch(e){setNotice(e instanceof Error?e.message:"Publiceren mislukt")}finally{setBusy(false)}
  }
  async function remove(id:string){if(!confirm("Dit officiële bericht verwijderen?"))return;try{await removeAnnouncement(id);await load();setNotice("Bericht verwijderd")}catch(e){setNotice(e instanceof Error?e.message:"Verwijderen mislukt")}}
  return <div>
    <div className="page-intro"><div><span className="eyebrow">OFFICIEEL</span><h2>Communicatie</h2><p>Centrale zenderberichten, belangrijke afspraken en bestanden. Alles staat in Supabase/PostgreSQL en is op elk toestel hetzelfde.</p></div>{canPublish&&<button className="primary" onClick={()=>setShowCreate(true)}>+ Bericht publiceren</button>}</div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}
    <div className="communication-layout">
      <section className="card communication-list"><div className="module-title-row"><div><h3>Berichten</h3><small>{rows.length} gepubliceerd</small></div><button className="ghost" onClick={()=>void load()}>↻</button></div>{rows.map(a=><button key={a.id} className={`communication-row ${selectedId===a.id?"selected":""} ${a.importance}`} onClick={()=>setSelectedId(a.id)}><span className={`badge ${a.importance==="important"?"badge-red":"badge-blue"}`}>{a.importance==="important"?"BELANGRIJK":"INFO"}</span><div><strong>{a.title}</strong><small>{a.category} • {a.createdByName||"VLACORA"} • {new Date(a.createdAt).toLocaleString("nl-BE",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</small></div>{a.requiresAcknowledgement&&<b title="Verplichte bevestiging">!</b>}</button>)}{!rows.length&&<div className="empty-live-state compact"><strong>Nog geen officiële berichten</strong><span>Publiceer het eerste bericht voor het zenderteam.</span></div>}</section>
      <section className="communication-detail-column">{selected?<><article className={`card announcement ${selected.importance==="important"?"important":""}`}><div className="announcement-head"><div><span className={`badge ${selected.importance==="important"?"badge-red":"badge-blue"}`}>{selected.importance==="important"?"BELANGRIJK":"NORMAAL"}</span><span>{selected.category}</span></div><span>{selected.createdByName||"VLACORA"}</span></div><h2>{selected.title}</h2><p>{selected.body}</p><div className="readline"><strong>{selected.requiresAcknowledgement?"Iedere gebruiker moet dit bevestigen":"Informatief bericht"}</strong>{canDelete&&<button className="mini-btn danger" onClick={()=>void remove(selected.id)}>×</button>}</div></article><div className="card"><AttachmentPanel stationSlug={selected.stationSlug} entityType="announcement" entityId={selected.id} title="Bestanden bij dit bericht"/></div></>:<div className="card empty-live-state"><strong>Kies een bericht</strong><span>Inhoud en bestanden verschijnen hier.</span></div>}</section>
    </div>
    {showCreate&&<div className="modal-backdrop" onMouseDown={()=>setShowCreate(false)}><div className="modal-card" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><h2>Officieel bericht publiceren</h2><button className="mini-btn" onClick={()=>setShowCreate(false)}>×</button></div><form className="modal-form" onSubmit={submit}><label className="field">Titel<input required name="title" className="input"/></label><label className="field">Categorie<input name="category" className="input" defaultValue="Algemeen" placeholder="Muziekredactie, programmering, algemeen…"/></label><label className="field">Belang<select name="importance" className="select"><option value="normal">Normaal</option><option value="important">Belangrijk</option></select></label><label className="field">Bericht<textarea required name="body" className="input textarea"/></label><label className="field">Bestanden<input className="input" type="file" multiple onChange={e=>setFiles(Array.from(e.target.files||[]))}/><small>{files.length?`${files.length} bestand(en) geselecteerd`:`Optioneel • maximaal 25 MB per bestand`}</small></label><label className="required-notification-toggle"><input type="checkbox" name="requiresAck"/><div><strong>Moet iedereen gezien hebben</strong><span>De bestaande Supabase-melding blijft verplicht tot de gebruiker ze bevestigt.</span></div></label><button className="primary" disabled={busy}>{busy?"Publiceren…":"Publiceren"}</button></form></div></div>}
  </div>
}
