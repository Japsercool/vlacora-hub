"use client";

import { useEffect,useMemo,useState } from "react";
import { useCollaboration } from "@/components/collaboration/collaboration-provider";
import { deleteExternalContact,loadExternalContacts,loadTeamPeople,saveExternalContact,type ExternalContact,type TeamPerson } from "@/lib/supabase/operations";
import { emitActivity } from "@/lib/collaboration/activity";

const categories=[["all","Alles"],["presentator","Presentatoren"],["producer","Producers"],["techniek","Techniek"],["sales","Sales"],["nieuws","Nieuws"],["partner","Partners"],["hosting","Hosting"],["nood","Nood"],["other","Andere"]];
const blank=(stationSlug:string):ExternalContact=>({id:`new-${Date.now()}`,stationSlug,category:"partner",name:"",company:"",roleTitle:"",email:"",phone:"",emergency:false,visibility:"team",notes:""});
const adminRole=(r:string)=>["superadmin","stationmanager","admin","beheer"].includes(r.toLowerCase());

export default function ContactsModule({stationSlug}:{stationSlug:string}){
  const collaboration=useCollaboration();
  const[team,setTeam]=useState<TeamPerson[]>([]);
  const[external,setExternal]=useState<ExternalContact[]>([]);
  const[query,setQuery]=useState("");
  const[category,setCategory]=useState("all");
  const[draft,setDraft]=useState<ExternalContact|null>(null);
  const[notice,setNotice]=useState("");
  const admin=adminRole(collaboration.currentUser?.role||"");

  function flash(x:string){setNotice(x);setTimeout(()=>setNotice(""),2600)}
  async function load(){try{const[p,c]=await Promise.all([loadTeamPeople(stationSlug),loadExternalContacts(stationSlug)]);setTeam(p);setExternal(c)}catch(e){flash(e instanceof Error?e.message:"Contacten laden mislukt")}}
  useEffect(()=>{void load();emitActivity({detail:"Contactenboek",entityType:"contacts",entityId:stationSlug})},[stationSlug]);

  const rows=useMemo(()=>{
    const q=query.toLowerCase().trim();
    const internal=team.map(p=>({key:`internal-${p.id}`,internal:true,category:(p.jobTitle||p.role).toLowerCase().includes("techn")?"techniek":(p.jobTitle||p.role).toLowerCase().includes("sales")?"sales":"presentator",name:p.name,company:"VLACORA team",roleTitle:p.jobTitle||p.role,email:p.email,phone:p.phone,emergency:false,notes:p.role,source:p}));
    const ext=external.map(x=>({key:x.id,internal:false,...x,source:x}));
    return[...internal,...ext].filter((x:any)=>(category==="all"||x.category===category)&&(!q||`${x.name} ${x.company} ${x.roleTitle} ${x.email} ${x.phone} ${x.notes}`.toLowerCase().includes(q))).sort((a:any,b:any)=>Number(b.emergency)-Number(a.emergency)||a.name.localeCompare(b.name,"nl"));
  },[team,external,query,category]);

  async function save(){
    if(!draft?.name.trim())return flash("Geef de contactpersoon een naam.");
    try{await saveExternalContact(draft);setDraft(null);await load();flash("Contact opgeslagen")}catch(e){flash(e instanceof Error?e.message:"Opslaan mislukt")}
  }

  return <div className="contacts-page">
    <div className="page-intro"><div><span className="eyebrow">CENTRAAL CONTACTENBOEK</span><h2>Contacten</h2><p>Interne teamleden komen uit Supabase Auth. Externe partners, techniek, hosting en noodnummers worden centraal per station beheerd.</p></div>{admin&&<button className="primary" onClick={()=>setDraft(blank(stationSlug==="all"?"all":stationSlug))}>+ Extern contact</button>}</div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}
    <div className="contacts-toolbar"><label className="contacts-search">⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Zoek naam, bedrijf, rol, telefoon…"/></label><div className="contacts-categories">{categories.map(([v,l])=><button key={v} className={category===v?"active":""} onClick={()=>setCategory(v)}>{l}</button>)}</div></div>
    <div className="contacts-grid">
      {rows.map((x:any)=><article className={`card contact-card ${x.emergency?"emergency":""}`} key={x.key}>
        <div className="contact-card-head"><div className="contact-avatar">{x.name.split(/\s+/).map((a:string)=>a[0]).slice(0,2).join("").toUpperCase()}</div><div><span className="eyebrow">{x.internal?"TEAM":x.category.toUpperCase()}</span><h3>{x.name}</h3><p>{x.roleTitle||x.company||"Contact"}</p></div>{x.emergency&&<span className="emergency-badge">NOOD</span>}</div>
        {x.company&&<div className="contact-company">{x.company}</div>}
        <div className="contact-details">{x.phone?<a href={`tel:${x.phone}`}>☎ {x.phone}</a>:<span>Geen telefoon</span>}{x.email?<a href={`mailto:${x.email}`}>✉ {x.email}</a>:<span>Geen e-mail</span>}</div>
        {x.notes&&<p className="contact-notes">{x.notes}</p>}
        {!x.internal&&admin&&<div className="button-row"><button className="ghost" onClick={()=>setDraft(x.source)}>Bewerk</button><button className="ghost danger-text" onClick={()=>{if(confirm("Contact verwijderen?"))void deleteExternalContact(x.source.id).then(load)}}>Verwijder</button></div>}
      </article>)}
    </div>

    {draft&&<div className="modal-backdrop" onMouseDown={()=>setDraft(null)}><div className="modal-card contact-editor" onMouseDown={e=>e.stopPropagation()}>
      <div className="modal-head"><div><span className="eyebrow">EXTERN CONTACT</span><h2>{draft.id.startsWith("new-")?"Nieuw contact":draft.name}</h2></div><button className="mini-btn" onClick={()=>setDraft(null)}>×</button></div>
      <div className="two-form-cols"><label className="field">Naam<input className="input" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label className="field">Categorie<select className="select" value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})}>{categories.filter(x=>x[0]!=="all").map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></div>
      <div className="two-form-cols"><label className="field">Bedrijf<input className="input" value={draft.company} onChange={e=>setDraft({...draft,company:e.target.value})}/></label><label className="field">Functie / rol<input className="input" value={draft.roleTitle} onChange={e=>setDraft({...draft,roleTitle:e.target.value})}/></label></div>
      <div className="two-form-cols"><label className="field">Telefoon<input className="input" value={draft.phone} onChange={e=>setDraft({...draft,phone:e.target.value})}/></label><label className="field">E-mail<input className="input" value={draft.email} onChange={e=>setDraft({...draft,email:e.target.value})}/></label></div>
      <div className="two-form-cols"><label className="field">Zichtbaarheid<select className="select" value={draft.visibility} onChange={e=>setDraft({...draft,visibility:e.target.value as any})}><option value="team">Heel team</option><option value="management">Alleen management</option></select></label><label className="required-notification-toggle"><input type="checkbox" checked={draft.emergency} onChange={e=>setDraft({...draft,emergency:e.target.checked})}/><div><strong>Noodcontact</strong><span>Zet dit contact bovenaan en opvallend.</span></div></label></div>
      <label className="field">Notities<textarea className="input textarea" value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label>
      <button className="primary" onClick={()=>void save()}>Opslaan</button>
    </div></div>}
  </div>;
}
