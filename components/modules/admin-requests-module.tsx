
"use client";

import { useCallback,useEffect,useMemo,useState } from "react";
import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import {
  createAdminRequest,deleteAdminRequest,loadAdminRequests,updateAdminRequest,
  type AdminRequest,type AdminRequestCategory,type AdminRequestStatus
} from "@/lib/supabase/admin-requests";
import { useCollaboration } from "@/components/collaboration/collaboration-provider";
import { emitActivity } from "@/lib/collaboration/activity";
import AttachmentPanel from "@/components/attachment-panel";
import { uploadAttachments } from "@/lib/supabase/attachments";

const categories:{value:AdminRequestCategory;label:string}[]=[
  {value:"feature",label:"Nieuwe functie"},
  {value:"traffic",label:"Verkeer"},
  {value:"content",label:"Redactie / content"},
  {value:"station",label:"Station / techniek"},
  {value:"other",label:"Andere"}
];
const statuses:{value:AdminRequestStatus;label:string}[]=[
  {value:"new",label:"Nieuw"},
  {value:"reviewing",label:"Bekijken"},
  {value:"planned",label:"Gepland"},
  {value:"done",label:"Uitgevoerd"},
  {value:"rejected",label:"Niet gepland"}
];

function dateLabel(value:string){
  if(!value)return"";
  const d=new Date(value);
  return Number.isNaN(d.getTime())?value:d.toLocaleString("nl-BE",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
}
function categoryLabel(value:AdminRequestCategory){return categories.find(x=>x.value===value)?.label||value}
function statusLabel(value:AdminRequestStatus){return statuses.find(x=>x.value===value)?.label||value}

export default function AdminRequestsModule({stationSlug}:{stationSlug:string}){
  const collaboration=useCollaboration();
  const[items,setItems]=useState<AdminRequest[]>([]);
  const[title,setTitle]=useState("");
  const[description,setDescription]=useState("");
  const[category,setCategory]=useState<AdminRequestCategory>("feature");
  const[notice,setNotice]=useState("");
  const[busy,setBusy]=useState(false);
  const[newFiles,setNewFiles]=useState<File[]>([]);
  const[filter,setFilter]=useState<"open"|"all">("open");
  const configured=isSupabaseBrowserConfigured();
  const role=(collaboration.currentUser?.role||"").toLowerCase();
  const isAdmin=["superadmin","admin","beheer","stationmanager"].includes(role);

  function flash(text:string){setNotice(text);window.setTimeout(()=>setNotice(""),3000)}
  const load=useCallback(async()=>{
    if(!configured)return;
    try{setItems(await loadAdminRequests())}
    catch(e){flash(e instanceof Error?e.message:"Aanvragen laden mislukt")}
  },[configured]);

  useEffect(()=>{void load()},[load]);
  useEffect(()=>{
    if(!configured)return;
    const supabase=createClient();
    const channel=supabase.channel(`vlacora-admin-requests-${stationSlug}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"hub_admin_requests"},()=>void load())
      .subscribe();
    return()=>{void supabase.removeChannel(channel)};
  },[configured,load,stationSlug]);

  const visible=useMemo(()=>{
    const base=stationSlug==="all"?items:items.filter(x=>x.stationSlug==="all"||x.stationSlug===stationSlug);
    return filter==="open"?base.filter(x=>!["done","rejected"].includes(x.status)):base;
  },[items,stationSlug,filter]);

  async function submit(){
    if(!title.trim())return flash("Geef de aanvraag eerst een titel.");
    setBusy(true);
    try{
      const created=await createAdminRequest({
        stationSlug:stationSlug||"all",category,title,description
      });
      if(newFiles.length)await uploadAttachments(created.stationSlug,"admin_request",created.id,newFiles);
      setItems(old=>[created,...old]);setTitle("");setDescription("");setNewFiles([]);
      emitActivity({detail:`Aanvraag verstuurd • ${created.title}`,entityType:"admin-request",entityId:created.id});
      flash("Aanvraag naar beheer verstuurd");

      // Best effort: notify active administrators only when a request is submitted.
      try{
        const supabase=createClient();
        const{data:admins}=await supabase.from("profiles")
          .select("id,role").eq("active",true)
          .in("role",["superadmin","admin","beheer","stationmanager"]);
        for(const admin of admins||[]){
          if(String(admin.id)===collaboration.currentUser?.id)continue;
          await collaboration.publishNotification({
            stationSlug:stationSlug||"all",
            title:`Nieuwe aanvraag: ${created.title}`,
            body:created.description||categoryLabel(created.category),
            category:"Aanvraag aan beheer",
            severity:"info",
            requiresAck:false,
            actionPath:`/hub/${stationSlug||"all"}/aanvragen`,
            recipientUserId:String(admin.id)
          });
        }
      }catch{}
    }catch(e){flash(e instanceof Error?e.message:"Aanvraag versturen mislukt")}
    finally{setBusy(false)}
  }

  async function setStatus(item:AdminRequest,status:AdminRequestStatus){
    if(!isAdmin)return;
    try{
      const updated=await updateAdminRequest(item.id,{status});
      setItems(old=>old.map(x=>x.id===updated.id?{...updated,createdByName:item.createdByName}:x));
      if(item.createdBy!==collaboration.currentUser?.id){
        await collaboration.publishNotification({
          stationSlug:item.stationSlug,
          title:`Aanvraag ${statusLabel(status).toLowerCase()}: ${item.title}`,
          body:`Beheer heeft de status aangepast naar “${statusLabel(status)}”.`,
          category:"Aanvraag aan beheer",
          severity:status==="rejected"?"warning":"info",
          requiresAck:false,
          actionPath:`/hub/${item.stationSlug||"all"}/aanvragen`,
          recipientUserId:item.createdBy
        }).catch(()=>{});
      }
    }catch(e){flash(e instanceof Error?e.message:"Status aanpassen mislukt")}
  }
  async function setAdminNote(item:AdminRequest,note:string){
    if(!isAdmin)return;
    try{
      const updated=await updateAdminRequest(item.id,{adminNote:note});
      setItems(old=>old.map(x=>x.id===updated.id?{...updated,createdByName:item.createdByName}:x));
      if(note.trim()&&item.createdBy!==collaboration.currentUser?.id){
        await collaboration.publishNotification({
          stationSlug:item.stationSlug,
          title:`Reactie van beheer: ${item.title}`,
          body:note.trim(),
          category:"Aanvraag aan beheer",
          severity:"info",
          requiresAck:false,
          actionPath:`/hub/${item.stationSlug||"all"}/aanvragen`,
          recipientUserId:item.createdBy
        }).catch(()=>{});
      }
      flash("Beheerreactie opgeslagen");
    }catch(e){flash(e instanceof Error?e.message:"Notitie opslaan mislukt")}
  }

  if(!configured)return <div className="page-intro"><div><h2>Aanvragen aan beheer</h2><p>Supabase moet actief zijn om aanvragen centraal naar de admins te sturen.</p></div></div>;

  return <div className="admin-requests-page">
    <div className="page-intro">
      <div><span className="eyebrow">TEAM → BEHEER</span><h2>{isAdmin?"Beheerinbox • aanvragen & ideeën":"Aanvragen & ideeën"}</h2><p>{isAdmin?"Bekijk voorstellen van het team, plan ze in en geef rechtstreeks antwoord.":"Stuur ideeën, gewenste functies of toevoegingen rechtstreeks naar beheer. Je ziet hier ook de reactie en status terug."}</p></div>
      <div className="request-filter-switch"><button className={filter==="open"?"active":""} onClick={()=>setFilter("open")}>Open</button><button className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>Alles</button></div>
    </div>

    {notice&&<div className="inline-notice standalone">{notice}</div>}

    <div className="admin-request-layout">
      <section className="card request-compose-card">
        <h3>Iets toevoegen of voorstellen?</h3>
        <p>Bijvoorbeeld een nieuwe functie, een extra verkeersweg, een redactietype of een technisch verzoek.</p>
        <label>Categorie<select value={category} onChange={e=>setCategory(e.target.value as AdminRequestCategory)}>{categories.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
        <label>Titel<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Kort: wat wil je toegevoegd zien?"/></label>
        <label>Uitleg<textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Wat zou je precies willen en waarom?"/></label><label>Bestanden<input type="file" multiple onChange={e=>setNewFiles(Array.from(e.target.files||[]))}/><small>Je kunt screenshots, PDF&apos;s, audio, documenten enz. meesturen.</small></label>
        <button className="primary" disabled={busy||!title.trim()} onClick={()=>void submit()}>{busy?"Versturen…":"Stuur naar beheer"}</button>
      </section>

      <section className="request-list">
        {visible.length===0&&<div className="card empty-live-state"><strong>Nog geen aanvragen</strong><span>Nieuwe voorstellen verschijnen hier meteen.</span></div>}
        {visible.map(item=><article className={`card admin-request-card status-${item.status}`} key={item.id}>
          <div className="admin-request-head">
            <div><div className="request-tags"><span>{categoryLabel(item.category)}</span><span className={`request-status status-${item.status}`}>{statusLabel(item.status)}</span></div><h3>{item.title}</h3><small>{dateLabel(item.createdAt)} • {item.stationSlug==="all"?"alle stations":item.stationSlug}{isAdmin&&item.createdByName?` • door ${item.createdByName}`:""}</small></div>
            {!isAdmin&&item.createdBy===collaboration.currentUser?.id&&item.status==="new"&&<button className="ghost danger-text" onClick={()=>void deleteAdminRequest(item.id).then(()=>setItems(old=>old.filter(x=>x.id!==item.id)))}>Verwijder</button>}
          </div>
          {item.description&&<p>{item.description}</p>}<AttachmentPanel stationSlug={item.stationSlug} entityType="admin_request" entityId={item.id} title="Bijlagen" compact/>
          {isAdmin?<div className="admin-request-admin">
            <label>Status<select value={item.status} onChange={e=>void setStatus(item,e.target.value as AdminRequestStatus)}>{statuses.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
            <label>Antwoord aan medewerker<textarea defaultValue={item.adminNote} onBlur={e=>void setAdminNote(item,e.currentTarget.value)} placeholder="Korte terugkoppeling vanuit beheer…"/></label>
          </div>:item.adminNote?<div className="request-admin-note"><strong>Beheer</strong><span>{item.adminNote}</span></div>:null}
        </article>)}
      </section>
    </div>
  </div>
}
