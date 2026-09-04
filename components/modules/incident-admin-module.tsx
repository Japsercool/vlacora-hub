"use client";

import { useCallback,useEffect,useMemo,useState } from "react";
import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import { can,type PermissionMap } from "@/lib/permissions";

type Severity="Laag"|"Normaal"|"Hoog"|"Kritiek";
type Status="Open"|"In behandeling"|"Wachten op info"|"Opgelost"|"Gesloten";
type Incident={id:string;station_slug:string;category:string;title:string;description:string;severity:Severity;status:Status;assignee_user_id:string|null;created_by:string|null;created_at:string;updated_at:string;resolved_at:string|null};
type Profile={id:string;display_name:string|null;email:string|null;avatar_url:string|null;role:string|null;job_title:string|null;active:boolean|null};
type Collaborator={incident_id:string;user_id:string;can_edit:boolean};
type CategorySetting={id:string;station_slug:string;category:string;active:boolean;default_severity:Severity;default_assignee_user_id:string|null;sort_order:number};
type Publish=(input:{stationSlug?:string|null;title:string;body?:string;category?:string;severity?:"info"|"warning"|"critical";requiresAck?:boolean;actionPath?:string;recipientUserId?:string|null})=>Promise<void>;

const severities:Severity[]=["Laag","Normaal","Hoog","Kritiek"];
const statuses:Status[]=["Open","In behandeling","Wachten op info","Opgelost","Gesloten"];

function displayName(p:Profile|undefined){return p?.display_name?.trim()||p?.email||"Onbekende gebruiker"}
function initials(name:string){return name.split(/\s+/).filter(Boolean).map(x=>x[0]).slice(0,2).join("").toUpperCase()||"?"}

export default function IncidentAdminModule({stationSlug,publishNotification,permissions}:{stationSlug:string;publishNotification:Publish;permissions:PermissionMap}){
  const[incidents,setIncidents]=useState<Incident[]>([]);
  const[profiles,setProfiles]=useState<Profile[]>([]);
  const[memberships,setMemberships]=useState<Array<{user_id:string;station_slug:string;active:boolean}>>([]);
  const[collaborators,setCollaborators]=useState<Collaborator[]>([]);
  const[categories,setCategories]=useState<CategorySetting[]>([]);
  const[selectedId,setSelectedId]=useState("");
  const[busy,setBusy]=useState(false);
  const[notice,setNotice]=useState("");
  const[query,setQuery]=useState("");
  const[editorQuery,setEditorQuery]=useState("");
  const[newCategory,setNewCategory]=useState("");
  const[draft,setDraft]=useState<Incident|null>(null);
  const[editorIds,setEditorIds]=useState<string[]>([]);
  const configured=isSupabaseBrowserConfigured();
  const canManage=can(permissions.meldpunt_beheer,"edit");

  const flash=(text:string)=>{setNotice(text);window.setTimeout(()=>setNotice(""),3200)};
  const selected=incidents.find(x=>x.id===selectedId)||null;

  const load=useCallback(async()=>{
    if(!configured)return;
    const supabase=createClient();
    let iq=supabase.from("hub_incidents").select("id,station_slug,category,title,description,severity,status,assignee_user_id,created_by,created_at,updated_at,resolved_at").order("updated_at",{ascending:false}).limit(500);
    if(stationSlug!=="all")iq=iq.eq("station_slug",stationSlug);
    let cq=supabase.from("hub_incident_category_settings").select("id,station_slug,category,active,default_severity,default_assignee_user_id,sort_order").order("sort_order").order("category");
    if(stationSlug!=="all")cq=cq.eq("station_slug",stationSlug);
    const[ir,pr,mr,cr,catr]=await Promise.all([
      iq,
      supabase.from("profiles").select("id,display_name,email,avatar_url,role,job_title,active").eq("active",true).order("display_name"),
      supabase.from("station_memberships").select("user_id,station_slug,active").eq("active",true),
      supabase.from("hub_incident_collaborators").select("incident_id,user_id,can_edit"),
      cq
    ]);
    if(ir.error)return flash(ir.error.message);
    if(pr.error)return flash(pr.error.message);
    setIncidents((ir.data||[]) as Incident[]);
    setProfiles((pr.data||[]) as Profile[]);
    setMemberships((mr.data||[]) as Array<{user_id:string;station_slug:string;active:boolean}>);
    setCollaborators((cr.data||[]) as Collaborator[]);
    setCategories((catr.data||[]) as CategorySetting[]);
    setSelectedId(cur=>cur&&(ir.data||[]).some((x:any)=>x.id===cur)?cur:String(ir.data?.[0]?.id||""));
  },[configured,stationSlug]);

  useEffect(()=>{void load()},[load]);
  useEffect(()=>{
    if(!selected){setDraft(null);setEditorIds([]);return}
    setDraft({...selected});
    setEditorIds(collaborators.filter(c=>c.incident_id===selected.id&&c.can_edit).map(c=>c.user_id));
  },[selectedId,selected?.updated_at,collaborators]);

  useEffect(()=>{
    if(!configured)return;
    const supabase=createClient();
    const ch=supabase.channel(`vlacora-incident-admin-${stationSlug}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"hub_incidents"},()=>void load())
      .on("postgres_changes",{event:"*",schema:"public",table:"hub_incident_collaborators"},()=>void load())
      .on("postgres_changes",{event:"*",schema:"public",table:"hub_incident_category_settings"},()=>void load())
      .subscribe();
    return()=>{void supabase.removeChannel(ch)};
  },[configured,stationSlug,load]);

  const eligibleProfiles=useMemo(()=>{
    if(!draft)return profiles;
    if(draft.station_slug==="all")return profiles;
    const allowed=new Set(memberships.filter(m=>m.station_slug===draft.station_slug).map(m=>m.user_id));
    return profiles.filter(p=>allowed.has(p.id)||p.role?.toLowerCase()==="superadmin");
  },[profiles,memberships,draft]);

  const filteredIncidents=useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q)return incidents;
    return incidents.filter(i=>`${i.title} ${i.description} ${i.category} ${i.status} ${i.severity}`.toLowerCase().includes(q));
  },[incidents,query]);

  const filteredEditors=useMemo(()=>{
    const q=editorQuery.trim().toLowerCase();
    return eligibleProfiles.filter(p=>!q||`${displayName(p)} ${p.email||""} ${p.job_title||""}`.toLowerCase().includes(q));
  },[eligibleProfiles,editorQuery]);

  const unassigned=incidents.filter(i=>!i.assignee_user_id&&!["Opgelost","Gesloten"].includes(i.status)).length;
  const active=incidents.filter(i=>!["Opgelost","Gesloten"].includes(i.status)).length;
  const critical=incidents.filter(i=>i.severity==="Kritiek"&&!["Opgelost","Gesloten"].includes(i.status)).length;

  async function saveIncident(){
    if(!draft||!configured||!canManage)return;
    setBusy(true);
    const supabase=createClient();
    const before=selected;
    const payload={title:draft.title.trim(),description:draft.description,category:draft.category,severity:draft.severity,status:draft.status,assignee_user_id:draft.assignee_user_id||null,updated_at:new Date().toISOString(),resolved_at:["Opgelost","Gesloten"].includes(draft.status)?(draft.resolved_at||new Date().toISOString()):null};
    const{error}=await supabase.from("hub_incidents").update(payload).eq("id",draft.id);
    if(error){setBusy(false);return flash(error.message)}
    const existingRows=collaborators.filter(c=>c.incident_id===draft.id);
    const existingEditors=existingRows.filter(c=>c.can_edit).map(c=>c.user_id);
    const existingIds=existingRows.map(c=>c.user_id);
    const remove=existingIds.filter(id=>!editorIds.includes(id));
    const add=editorIds.filter(id=>!existingEditors.includes(id));
    if(remove.length)await supabase.from("hub_incident_collaborators").delete().eq("incident_id",draft.id).in("user_id",remove);
    const{data:user}=await supabase.auth.getUser();
    if(editorIds.length)await supabase.from("hub_incident_collaborators").upsert(editorIds.map(user_id=>({incident_id:draft.id,user_id,can_edit:true,added_by:user.user?.id||null})),{onConflict:"incident_id,user_id"});
    const changes:string[]=[];
    if(before?.assignee_user_id!==draft.assignee_user_id)changes.push(`Verantwoordelijke: ${draft.assignee_user_id?displayName(profiles.find(p=>p.id===draft.assignee_user_id)):"niet toegewezen"}`);
    if(before?.status!==draft.status)changes.push(`Status: ${draft.status}`);
    if(before?.severity!==draft.severity)changes.push(`Ernst: ${draft.severity}`);
    if(before?.category!==draft.category)changes.push(`Categorie: ${draft.category}`);
    if(add.length||remove.length)changes.push(`Extra behandelaars bijgewerkt (${editorIds.length})`);
    if(changes.length)await supabase.from("hub_incident_updates").insert({incident_id:draft.id,update_type:before?.assignee_user_id!==draft.assignee_user_id?"assignment":"update",body:changes.join(" • "),status:draft.status,created_by:user.user?.id||null});
    const newlyAssigned=before?.assignee_user_id!==draft.assignee_user_id&&draft.assignee_user_id?[draft.assignee_user_id]:[];
    const notifyIds=new Set<string>([...newlyAssigned,...add]);
    for(const recipientUserId of notifyIds){
      await publishNotification({stationSlug:draft.station_slug,recipientUserId,title:`Meldpunt: ${draft.title}`,body:`Je bent ${recipientUserId===draft.assignee_user_id?"verantwoordelijke":"behandelaar"} voor deze melding.`,category:"Meldpunt",severity:draft.severity==="Kritiek"?"critical":draft.severity==="Hoog"?"warning":"info",actionPath:`/hub/${draft.station_slug}/meldpunt`}).catch(()=>{});
    }
    setBusy(false);flash("Melding en behandelaars opgeslagen");await load();
  }

  async function saveCategory(row:CategorySetting){
    if(!configured||!canManage)return;
    const supabase=createClient();const{data:user}=await supabase.auth.getUser();
    const{error}=await supabase.from("hub_incident_category_settings").update({active:row.active,default_severity:row.default_severity,default_assignee_user_id:row.default_assignee_user_id||null,sort_order:row.sort_order,updated_by:user.user?.id||null,updated_at:new Date().toISOString()}).eq("id",row.id);
    if(error)return flash(error.message);flash(`Categorie “${row.category}” opgeslagen`);void load();
  }

  async function addCategory(){
    const name=newCategory.trim();if(!name||stationSlug==="all"||!configured||!canManage)return;
    const supabase=createClient();const{data:user}=await supabase.auth.getUser();
    const{error}=await supabase.from("hub_incident_category_settings").insert({station_slug:stationSlug,category:name,active:true,default_severity:"Normaal",sort_order:categories.length*10+10,updated_by:user.user?.id||null});
    if(error)return flash(error.message);setNewCategory("");flash("Categorie toegevoegd");void load();
  }

  function patchCategory(id:string,patch:Partial<CategorySetting>){setCategories(rows=>rows.map(r=>r.id===id?{...r,...patch}:r))}
  function toggleEditor(id:string){setEditorIds(ids=>ids.includes(id)?ids.filter(x=>x!==id):[...ids,id])}

  if(!configured)return <div className="card empty-live-state"><strong>Supabase-login nodig</strong><span>Meldpuntbeheer gebruikt de centrale accounts en dossierrechten.</span></div>;

  return <div className="incident-admin-page">
    {notice&&<div className="inline-notice standalone">{notice}</div>}
    <div className="page-intro"><div><span className="eyebrow">BEHEER / MELDPUNT</span><h2>Meldpuntbeheer</h2><p>Wijs dossiers toe, geef extra behandelaars bewerkrechten en beheer categorieën en standaardverantwoordelijken.</p>{!canManage&&<small className="muted">Je hebt kijkrechten. Een superadmin kan “Meldpuntbeheer” op Bewerken of hoger zetten om wijzigingen toe te staan.</small>}</div><button className="ghost" onClick={()=>void load()}>↻ Vernieuwen</button></div>
    <div className="metric-grid incident-admin-metrics"><div className="card"><span>Open dossiers</span><strong className="metric">{active}</strong><small>nog niet afgerond</small></div><div className="card"><span>Nog toe te wijzen</span><strong className="metric">{unassigned}</strong><small>geen verantwoordelijke</small></div><div className="card"><span>Kritiek</span><strong className="metric">{critical}</strong><small>direct aandacht</small></div><div className="card"><span>Behandelaars</span><strong className="metric">{eligibleProfiles.length}</strong><small>actieve accounts</small></div></div>

    <div className="incident-admin-grid">
      <section className="card incident-admin-list"><div className="section-head"><div><h3>Dossiers</h3><p>Kies een melding om de behandeling te organiseren.</p></div><span className="badge badge-blue">{filteredIncidents.length}</span></div><input className="input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Zoek melding, categorie of status…"/><div className="incident-admin-list-scroll">{filteredIncidents.map(i=>{const assignee=profiles.find(p=>p.id===i.assignee_user_id);return <button key={i.id} className={`incident-admin-row ${selectedId===i.id?"selected":""}`} onClick={()=>setSelectedId(i.id)}><span className={`incident-severity-dot severity-${i.severity.toLowerCase()}`}/><div><strong>{i.title}</strong><small>{i.station_slug} • {i.category} • {i.status}</small><small>{assignee?`Verantwoordelijke: ${displayName(assignee)}`:"Nog niet toegewezen"}</small></div></button>})}{!filteredIncidents.length&&<div className="empty-live-state compact"><strong>Geen dossiers</strong><span>Geen meldingen voldoen aan je filter.</span></div>}</div></section>

      <section className="card incident-admin-editor">{draft?<><div className="section-head"><div><span className="eyebrow">DOSSIER BEHEREN</span><h3>{draft.title}</h3><p>{draft.station_slug} • aangemaakt {new Date(draft.created_at).toLocaleDateString("nl-BE")}</p></div><button className="primary" disabled={busy||!canManage} onClick={()=>void saveIncident()}>{busy?"Opslaan…":canManage?"Alles opslaan":"Alleen lezen"}</button></div>
        <div className="two-form-cols"><label className="field">Titel<input className="input" disabled={!canManage} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label><label className="field">Categorie<select className="select" disabled={!canManage} value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})}>{categories.filter(c=>c.station_slug===draft.station_slug).map(c=><option key={c.id}>{c.category}</option>)}{!categories.some(c=>c.station_slug===draft.station_slug&&c.category===draft.category)&&<option>{draft.category}</option>}</select></label><label className="field">Ernst<select className="select" disabled={!canManage} value={draft.severity} onChange={e=>setDraft({...draft,severity:e.target.value as Severity})}>{severities.map(x=><option key={x}>{x}</option>)}</select></label><label className="field">Status<select className="select" disabled={!canManage} value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value as Status})}>{statuses.map(x=><option key={x}>{x}</option>)}</select></label></div>
        <label className="field">Beschrijving<textarea className="input textarea" disabled={!canManage} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
        <div className="incident-assignment-box"><div><strong>Verantwoordelijke</strong><small>Eén primaire eigenaar van het dossier. Die persoon kan het dossier behandelen.</small></div><select className="select" disabled={!canManage} value={draft.assignee_user_id||""} onChange={e=>setDraft({...draft,assignee_user_id:e.target.value||null})}><option value="">Nog niet toegewezen</option>{eligibleProfiles.map(p=><option key={p.id} value={p.id}>{displayName(p)}{p.job_title?` • ${p.job_title}`:""}</option>)}</select></div>
        <div className="incident-editor-picker"><div className="section-head"><div><h4>Extra behandelaars</h4><p>Deze accounts mogen dit specifieke dossier bewerken, ook als ze normaal alleen Meldpunt kunnen bekijken.</p></div><span className="badge badge-blue">{editorIds.length}</span></div><input className="input" value={editorQuery} onChange={e=>setEditorQuery(e.target.value)} placeholder="Zoek collega…"/><div className="incident-editor-list">{filteredEditors.map(p=>{const name=displayName(p);const checked=editorIds.includes(p.id);return <button type="button" key={p.id} className={checked?"selected":""} disabled={!canManage} onClick={()=>toggleEditor(p.id)}><span className="avatar mini">{p.avatar_url?<img src={p.avatar_url} alt=""/>:initials(name)}</span><span><strong>{name}</strong><small>{p.job_title||p.role||p.email}</small></span><b>{checked?"✓":"＋"}</b></button>})}</div></div>
      </>:<div className="empty-live-state"><strong>Kies een dossier</strong><span>Daarna kun je verantwoordelijke, extra behandelaars, categorie, ernst en status beheren.</span></div>}</section>
    </div>

    <section className="card incident-category-admin"><div className="section-head"><div><span className="eyebrow">WERKSTROOM</span><h3>Categorieën & standaardbehandeling</h3><p>Een standaardverantwoordelijke wordt automatisch voorgesteld/toegewezen bij nieuwe meldingen in deze categorie.</p></div></div>{stationSlug==="all"?<div className="team-security-note"><strong>Kies één station</strong><span>Categorie-instellingen zijn per zender, zodat verantwoordelijkheden niet door elkaar lopen.</span></div>:<><div className="incident-category-add"><input className="input" disabled={!canManage} value={newCategory} onChange={e=>setNewCategory(e.target.value)} placeholder="Nieuwe categorie…"/><button className="primary" disabled={!canManage||!newCategory.trim()} onClick={()=>void addCategory()}>+ Toevoegen</button></div><div className="incident-category-table"><div className="incident-category-head"><span>Categorie</span><span>Actief</span><span>Standaard ernst</span><span>Standaard verantwoordelijke</span><span/></div>{categories.filter(c=>c.station_slug===stationSlug).map(c=><div className="incident-category-row" key={c.id}><strong>{c.category}</strong><label className="switch-line compact"><input type="checkbox" disabled={!canManage} checked={c.active} onChange={e=>patchCategory(c.id,{active:e.target.checked})}/><span>{c.active?"Ja":"Nee"}</span></label><select className="select" disabled={!canManage} value={c.default_severity} onChange={e=>patchCategory(c.id,{default_severity:e.target.value as Severity})}>{severities.map(x=><option key={x}>{x}</option>)}</select><select className="select" disabled={!canManage} value={c.default_assignee_user_id||""} onChange={e=>patchCategory(c.id,{default_assignee_user_id:e.target.value||null})}><option value="">Niemand</option>{eligibleProfiles.map(p=><option key={p.id} value={p.id}>{displayName(p)}</option>)}</select><button className="ghost" disabled={!canManage} onClick={()=>void saveCategory(c)}>Opslaan</button></div>)}</div></>}</section>
  </div>;
}
