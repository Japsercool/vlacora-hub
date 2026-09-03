"use client";

import { useEffect,useState } from "react";
import { downloadAttachment,formatBytes,loadAttachments,removeAttachment,uploadAttachments,type HubAttachment } from "@/lib/supabase/attachments";

export default function AttachmentPanel({stationSlug,entityType,entityId,title="Bestanden",compact=false}:{stationSlug:string;entityType:string;entityId:string;title?:string;compact?:boolean}){
  const[items,setItems]=useState<HubAttachment[]>([]);const[busy,setBusy]=useState(false);const[notice,setNotice]=useState("");
  async function load(){if(!entityId)return setItems([]);try{setItems(await loadAttachments(entityType,entityId))}catch{}}
  useEffect(()=>{void load()},[entityType,entityId]);
  async function choose(files:FileList|null){if(!files?.length)return;setBusy(true);setNotice("");try{await uploadAttachments(stationSlug,entityType,entityId,Array.from(files));await load()}catch(e){setNotice(e instanceof Error?e.message:"Upload mislukt")}finally{setBusy(false)}}
  return <div className={compact?"attachment-panel compact":"attachment-panel"}><div className="attachment-head"><div><strong>📎 {title}</strong>{!compact&&<small>Foto&apos;s, audio, PDF, Office-bestanden, ZIP&apos;s… max. 25 MB per bestand.</small>}</div><label className="ghost file-button">{busy?"Uploaden…":"+ Bestand"}<input type="file" multiple hidden disabled={busy} onChange={e=>void choose(e.target.files)}/></label></div>{notice&&<div className="inline-notice">{notice}</div>}<div className="attachment-list">{items.map(a=><div className="attachment-row" key={a.id}><button className="attachment-download" onClick={()=>void downloadAttachment(a)}><span>📄</span><div><strong>{a.fileName}</strong><small>{formatBytes(a.sizeBytes)}</small></div></button><button className="mini-btn danger" title="Bijlage verwijderen" onClick={async()=>{if(!confirm(`“${a.fileName}” verwijderen?`))return;try{await removeAttachment(a);await load()}catch(e){setNotice(e instanceof Error?e.message:"Verwijderen mislukt")}}}>×</button></div>)}{!items.length&&<small className="muted">Nog geen bestanden gekoppeld.</small>}</div></div>
}
