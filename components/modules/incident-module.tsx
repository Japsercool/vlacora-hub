"use client";

import { useCallback,useEffect,useMemo,useState } from "react";
import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import AttachmentPanel from "@/components/attachment-panel";
import { uploadAttachments } from "@/lib/supabase/attachments";
import { can,type PermissionMap } from "@/lib/permissions";

type Severity="Laag"|"Normaal"|"Hoog"|"Kritiek";
type Status="Open"|"In behandeling"|"Wachten op info"|"Opgelost"|"Gesloten";
type Incident={id:string;station_slug:string;category:string;title:string;description:string;severity:Severity;status:Status;assignee_user_id:string|null;created_by:string|null;created_at:string;updated_at:string;resolved_at:string|null};
type IncidentUpdate={id:string;incident_id:string;update_type:string;body:string;status:string|null;created_by:string|null;created_at:string};
type Publish=(input:{stationSlug?:string|null;title:string;body?:string;category?:string;severity?:"info"|"warning"|"critical";requiresAck?:boolean;actionPath?:string;recipientUserId?:string|null})=>Promise<void>;

const categories=["Programmering","Muziek","Technisch","Vormgeving","Facilities","Afwezigheid","Website / socials","Nieuws","Reclame","Tip redactie","Ander"];
const statusOrder:Status[]=["Open","In behandeling","Wachten op info","Opgelost","Gesloten"];

function ago(iso:string){const sec=Math.max(0,Math.floor((Date.now()-new Date(iso).getTime())/1000));if(sec<60)return "zojuist";if(sec<3600)return `${Math.floor(sec/60)} min geleden`;if(sec<86400)return `${Math.floor(sec/3600)} u geleden`;return new Date(iso).toLocaleDateString("nl-BE")}
function tone(sev:Severity){return sev==="Kritiek"||sev==="Hoog"?"red":sev==="Normaal"?"orange":"gray"}

export default function IncidentModule({stationSlug,publishNotification,permissions}:{stationSlug:string;publishNotification:Publish;permissions:PermissionMap}){
  const[incidents,setIncidents]=useState<Incident[]>([]);
  const[selectedId,setSelectedId]=useState<string>("");
  const[updates,setUpdates]=useState<IncidentUpdate[]>([]);
  const[loading,setLoading]=useState(true);
  const[showCreate,setShowCreate]=useState(false);
  const[category,setCategory]=useState("Technisch");
  const[updateText,setUpdateText]=useState("");
  const[newFiles,setNewFiles]=useState<File[]>([]);
  const[notice,setNotice]=useState("");
  const[canEditSelected,setCanEditSelected]=useState(false);
  const[assigneeName,setAssigneeName]=useState("");
  const[categorySettings,setCategorySettings]=useState<Array<{category:string;active:boolean;default_severity:Severity;default_assignee_user_id:string|null}>>([]);
  const configured=isSupabaseBrowserConfigured();
  const canCreate=can(permissions.meldpunt,"edit");
  const selected=incidents.find(i=>i.id===selectedId)||null;
  const selectedCategorySetting=categorySettings.find(x=>x.category===category);

  const flash=(x:string)=>{setNotice(x);setTimeout(()=>setNotice(""),2800)};
  const load=useCallback(async()=>{
    if(!configured){setLoading(false);return}
    const supabase=createClient();
    let q=supabase.from("hub_incidents").select("id,station_slug,category,title,description,severity,status,assignee_user_id,created_by,created_at,updated_at,resolved_at").order("updated_at",{ascending:false}).limit(200);
    if(stationSlug!=="all")q=q.eq("station_slug",stationSlug);
    const{data,error}=await q;if(error){flash(error.message);setLoading(false);return}
    const rows=(data||[]) as Incident[];setIncidents(rows);setSelectedId(current=>current&&rows.some(x=>x.id===current)?current:(rows[0]?.id||""));
    let cq=supabase.from("hub_incident_category_settings").select("category,active,default_severity,default_assignee_user_id").eq("active",true).order("sort_order");if(stationSlug!=="all")cq=cq.eq("station_slug",stationSlug);const cr=await cq;if(!cr.error)setCategorySettings((cr.data||[]) as any);setLoading(false);
  },[configured,stationSlug]);

  const loadUpdates=useCallback(async(id:string)=>{
    if(!configured||!id){setUpdates([]);return}
    const{data,error}=await createClient().from("hub_incident_updates").select("id,incident_id,update_type,body,status,created_by,created_at").eq("incident_id",id).order("created_at");
    if(!error)setUpdates((data||[]) as IncidentUpdate[]);
  },[configured]);

  useEffect(()=>{void load()},[load]);
  useEffect(()=>{void loadUpdates(selectedId)},[selectedId,loadUpdates]);
  useEffect(()=>{
    let alive=true;
    if(!configured||!selectedId){setCanEditSelected(false);setAssigneeName("");return}
    const supabase=createClient();
    void supabase.rpc("vlacora_can_edit_incident",{target_incident:selectedId}).then(({data}:{data:any})=>{if(alive)setCanEditSelected(Boolean(data))});
    const incident=incidents.find(x=>x.id===selectedId);
    if(incident?.assignee_user_id)void supabase.from("profiles").select("display_name,email").eq("id",incident.assignee_user_id).maybeSingle().then(({data}:{data:any})=>{if(alive)setAssigneeName(String(data?.display_name||data?.email||""))});else setAssigneeName("");
    return()=>{alive=false};
  },[configured,selectedId,incidents]);
  useEffect(()=>{
    if(!configured)return;
    const supabase=createClient();
    const channel=supabase.channel(`vlacora-incidents-${stationSlug}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"hub_incidents"},()=>void load())
      .on("postgres_changes",{event:"*",schema:"public",table:"hub_incident_updates"},()=>{if(selectedId)void loadUpdates(selectedId)})
      .subscribe();
    return()=>{void supabase.removeChannel(channel)};
  },[configured,stationSlug,selectedId,load,loadUpdates]);

  async function createIncident(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();if(!configured)return flash("Supabase-login is nodig om meldingen met het team te delen.");if(!canCreate)return flash("Je hebt alleen kijkrechten voor het Meldpunt.");
    const f=new FormData(e.currentTarget);const title=String(f.get("title")||"").trim();const description=String(f.get("description")||"").trim();const setting=categorySettings.find(x=>x.category===category);const severity=String(f.get("severity")||setting?.default_severity||"Normaal") as Severity;
    const supabase=createClient();const{data:user}=await supabase.auth.getUser();if(!user.user)return flash("Log opnieuw in.");
    const{data,error}=await supabase.from("hub_incidents").insert({station_slug:stationSlug,category,title,description,severity,status:"Open",assignee_user_id:setting?.default_assignee_user_id||null,created_by:user.user.id}).select().single();
    if(error)return flash(error.message);
    await supabase.from("hub_incident_updates").insert({incident_id:data.id,update_type:"created",body:description||"Melding geregistreerd.",status:"Open",created_by:user.user.id});
    if(newFiles.length)await uploadAttachments(stationSlug,"incident",String(data.id),newFiles);
    if(setting?.default_assignee_user_id)await publishNotification({stationSlug,recipientUserId:setting.default_assignee_user_id,title:`Nieuwe melding toegewezen: ${title}`,body:description||`Categorie: ${category}`,category:"Meldpunt",severity:severity==="Kritiek"?"critical":severity==="Hoog"?"warning":"info",actionPath:`/hub/${stationSlug}/meldpunt`}).catch(()=>{});
    if(severity==="Hoog"||severity==="Kritiek")await publishNotification({stationSlug,title:`${severity}e melding: ${title}`,body:description,category,severity:"critical",requiresAck:severity==="Kritiek",actionPath:`/hub/${stationSlug}/meldpunt`}).catch(()=>{});
    setShowCreate(false);setNewFiles([]);setSelectedId(data.id);flash("Melding geregistreerd en gedeeld");void load();
  }

  async function addUpdate(nextStatus?:Status,presetBody?:string){
    if(!selected||!configured)return;
    const body=(presetBody??updateText).trim();if(!body&&!nextStatus)return;
    const supabase=createClient();const{data:user}=await supabase.auth.getUser();if(!user.user)return flash("Log opnieuw in.");
    const status=nextStatus||selected.status;const resolved=status==="Opgelost"||status==="Gesloten";
    const{error}=await supabase.from("hub_incidents").update({status,updated_at:new Date().toISOString(),resolved_at:resolved?new Date().toISOString():null}).eq("id",selected.id);if(error)return flash(error.message);
    const text=body||`Status gewijzigd naar ${status}.`;
    await supabase.from("hub_incident_updates").insert({incident_id:selected.id,update_type:nextStatus?"status":"update",body:text,status,created_by:user.user.id});
    await publishNotification({stationSlug:selected.station_slug,title:`Update melding: ${selected.title}`,body:`${status} • ${text}`,category:selected.category,severity:status==="Opgelost"?"info":selected.severity==="Kritiek"?"critical":"warning",requiresAck:false,actionPath:`/hub/${selected.station_slug}/meldpunt`}).catch(()=>{});
    setUpdateText("");flash(`Melding staat nu op “${status}”`);await load();await loadUpdates(selected.id);
  }

  const counts=useMemo(()=>Object.fromEntries(statusOrder.map(s=>[s,incidents.filter(i=>i.status===s).length])),[incidents]);

  return <div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}
    <div className="page-intro"><div><h2>Meldpunt</h2><p>Een melding is nu een dossier: status, voortgang en onbeperkt updates blijven centraal bewaard.</p></div>{canCreate&&<button className="primary" onClick={()=>setShowCreate(true)}>+ Nieuwe melding</button>}</div>
    <div className="incident-status-strip">{statusOrder.map(s=><button key={s} className="incident-status-card"><strong>{counts[s]||0}</strong><span>{s}</span></button>)}</div>
    {!configured&&<div className="team-security-note"><strong>Supabase nodig</strong><span>Log in met de centrale PULSE-login om meldingen tussen toestellen te delen.</span></div>}
    {loading?<div className="card">Meldingen laden…</div>:incidents.length===0?<div className="card empty-live-state"><strong>Nog geen meldingen</strong><span>Nieuwe meldingen verschijnen hier met een volledige voortgangstijdlijn.</span></div>:<div className="incident-workspace">
      <div className="card incident-list-panel"><div className="module-title-row"><div><h3>Meldingen</h3><small>{incidents.length} dossier(s)</small></div></div>{incidents.map(i=><button className={`incident-list-row ${selectedId===i.id?"selected":""}`} key={i.id} onClick={()=>setSelectedId(i.id)}><span className={`incident-severity-dot severity-${i.severity.toLowerCase()}`}/><div><strong>{i.title}</strong><small>{i.category} • {ago(i.updated_at)}</small></div><span className={`badge badge-${tone(i.severity)}`}>{i.status}</span></button>)}</div>
      {selected&&<div className="incident-detail-column">
        <div className="card incident-detail"><div className="section-head"><div><span className="eyebrow">{selected.category}</span><h2>{selected.title}</h2><p>{selected.description||"Geen extra beschrijving."}</p></div><span className={`badge badge-${tone(selected.severity)}`}>{selected.severity}</span></div>
          <div className="incident-assignee-summary"><span>Verantwoordelijke</span><strong>{assigneeName||"Nog niet toegewezen"}</strong>{canEditSelected?<small>Je mag dit dossier behandelen.</small>:<small>Alleen lezen • een beheerder kan jou als behandelaar toevoegen.</small>}</div><div className="incident-progress">{statusOrder.map((s,index)=>{const current=statusOrder.indexOf(selected.status);return <div key={s} className={`incident-step ${index<=current?"done":""} ${s===selected.status?"current":""}`}><span>{index+1}</span><strong>{s}</strong></div>})}</div>
          {canEditSelected&&<div className="incident-quick-actions"><button className="primary soft" onClick={()=>void addUpdate("In behandeling","We zijn ermee bezig.")}>▶ We zijn ermee bezig</button><button className="ghost" onClick={()=>void addUpdate("Wachten op info","We wachten op extra informatie.")}>⏸ Wachten op info</button><button className="ghost positive-action" onClick={()=>void addUpdate("Opgelost","De melding is opgelost.")}>✓ Opgelost</button></div>}
        </div>
        <div className="card"><AttachmentPanel stationSlug={selected.station_slug} entityType="incident" entityId={selected.id} title="Bestanden bij deze melding"/></div>
        <div className="card"><div className="section-head"><div><h3>Updates</h3><p>Iedere update blijft chronologisch bij de melding.</p></div><span className="badge badge-blue">{updates.length}</span></div><div className="incident-timeline">{updates.map((u,index)=><div className="incident-timeline-item" key={u.id}><div className="timeline-marker">{index+1}</div><div><strong>{u.status||"Update"}</strong><p>{u.body}</p><small>{new Date(u.created_at).toLocaleString("nl-BE")}</small></div></div>)}</div>{canEditSelected?<div className="incident-update-compose"><textarea className="input textarea" value={updateText} onChange={e=>setUpdateText(e.target.value)} placeholder="Update over de melding… bv. leverancier gecontacteerd, technicus onderweg, fix getest…"/><div className="button-row"><button className="primary" disabled={!updateText.trim()} onClick={()=>void addUpdate()}>Update toevoegen</button><select className="select" value={selected.status} onChange={e=>void addUpdate(e.target.value as Status,`Status gewijzigd naar ${e.target.value}.`)}>{statusOrder.map(s=><option key={s}>{s}</option>)}</select></div></div>:<div className="team-security-note"><strong>Alleen lezen</strong><span>Een beheerder kan jou in Meldpuntbeheer als verantwoordelijke of extra behandelaar toevoegen.</span></div>}</div>
      </div>}
    </div>}

    {showCreate&&<div className="modal-backdrop" onMouseDown={()=>setShowCreate(false)}><div className="modal-card" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><h2>Nieuwe melding</h2><button className="mini-btn" onClick={()=>setShowCreate(false)}>×</button></div><form className="modal-form" onSubmit={createIncident}><label className="field">Categorie<select className="select" value={category} onChange={e=>setCategory(e.target.value)} name="category">{(categorySettings.length?categorySettings.map(x=>x.category):categories).map(x=><option key={x}>{x}</option>)}</select></label><label className="field">Titel<input className="input" name="title" required placeholder="Wat is er aan de hand?"/></label><label className="field">Ernst<select key={category} className="select" name="severity" defaultValue={selectedCategorySetting?.default_severity||"Normaal"}><option>Laag</option><option>Normaal</option><option>Hoog</option><option>Kritiek</option></select></label><label className="field">Beschrijving<textarea className="input textarea" name="description" placeholder="Wat heb je vastgesteld? Wat is de impact?"/></label><label className="field">Bestanden<input className="input file-input" type="file" multiple onChange={e=>setNewFiles(Array.from(e.target.files||[]))}/><small>Foto, video, audio, PDF, Office of andere documenten • max. 25 MB per bestand.</small></label>{newFiles.length>0&&<div className="file-chip-row">{newFiles.map((f,i)=><span key={`${f.name}-${i}`}>{f.name}</span>)}</div>}<button className="primary">Melding indienen</button></form></div></div>}
  </div>
}

export function IncidentSummaryCard({stationSlug}:{stationSlug:string}){
  const[count,setCount]=useState<number|null>(null);const[critical,setCritical]=useState(0);
  useEffect(()=>{if(!isSupabaseBrowserConfigured()||stationSlug==="all"){setCount(null);return}const supabase=createClient();supabase.from("hub_incidents").select("severity,status").eq("station_slug",stationSlug).not("status","in","(Opgelost,Gesloten)").then(({data}:{data:any})=>{const rows=data||[];setCount(rows.length);setCritical(rows.filter((x:any)=>x.severity==="Kritiek"||x.severity==="Hoog").length)});},[stationSlug]);
  return <div className="card"><div className="section-head"><div><h3>Meldpunt vandaag</h3><p>Centraal bijgehouden</p></div>{critical>0&&<span className="badge badge-red">{critical} belangrijk</span>}</div><div className="attention-list"><div className={count?"attention orange":"attention blue"}><span>!</span><div><strong>{count==null?"Kies één station":count===0?"Geen open meldingen":`${count} open melding${count===1?"":"en"}`}</strong><small>Statusupdates en voortgang staan in Meldpunt.</small></div></div></div></div>;
}
