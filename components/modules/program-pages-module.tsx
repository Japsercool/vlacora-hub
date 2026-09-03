"use client";

import { useEffect,useMemo,useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadProgramProfile,loadPrograms,loadProgramTeam,loadTeamPeople,saveProgramProfile,saveProgramTeam,type ProgramProfile,type ProgramTeamMember,type StationProgram,type TeamPerson } from "@/lib/supabase/operations";
import { emitActivity } from "@/lib/collaboration/activity";
import { useCollaboration } from "@/components/collaboration/collaboration-provider";

export default function ProgramPagesModule({stationSlug}:{stationSlug:string}){
  const collaboration=useCollaboration();
  const canManageTeam=["superadmin","stationmanager","admin","beheer"].includes(String(collaboration.currentUser?.role||"").toLowerCase());
  const[programs,setPrograms]=useState<StationProgram[]>([]);
  const[team,setTeam]=useState<TeamPerson[]>([]);
  const[selectedId,setSelectedId]=useState("");
  const[profile,setProfile]=useState<ProgramProfile|null>(null);
  const[members,setMembers]=useState<ProgramTeamMember[]>([]);
  const[editorialTemplates,setEditorialTemplates]=useState<any[]>([]);
  const[socialTemplates,setSocialTemplates]=useState<any[]>([]);
  const[history,setHistory]=useState<any[]>([]);
  const[programTasks,setProgramTasks]=useState<any[]>([]);
  const[notice,setNotice]=useState("");
  const selected=programs.find(x=>x.id===selectedId)||null;
  function flash(x:string){setNotice(x);setTimeout(()=>setNotice(""),2600)}
  async function loadBase(){
    if(stationSlug==="all")return;
    try{
      const[p,t]=await Promise.all([loadPrograms(stationSlug),loadTeamPeople(stationSlug)]);
      setPrograms(p);setTeam(t);
      const wanted=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("program"):null;setSelectedId(old=>wanted&&p.some(x=>x.id===wanted)?wanted:old&&p.some(x=>x.id===old)?old:p[0]?.id||"");
    }catch(e){flash(e instanceof Error?e.message:"Programma's laden mislukt")}
  }
  useEffect(()=>{void loadBase()},[stationSlug]);
  useEffect(()=>{
    if(!selected)return;
    let alive=true;
    (async()=>{
      try{
        const supabase=createClient();
        const[pr,tm,{data:et},{data:st},{data:ws},{data:tasks}]=await Promise.all([
          loadProgramProfile(selected),loadProgramTeam(selected.id),
          supabase.from("hub_editorial_templates").select("id,name,program_name,active").eq("station_slug",stationSlug).eq("active",true).order("name"),
          supabase.from("hub_social_templates").select("id,name,content_type,active").eq("station_slug",stationSlug).eq("active",true).order("name"),
          supabase.from("hub_editorial_workspaces").select("air_date,air_hour,items,updated_at").eq("station_slug",stationSlug).lt("air_date",new Date().toISOString().slice(0,10)).order("air_date",{ascending:false}).limit(80),
          supabase.from("hub_tasks").select("id,title,status,priority,due_at,recurrence_kind,description").eq("station_slug",stationSlug).order("due_at",{ascending:true,nullsFirst:false}).limit(120)
        ]);
        if(!alive)return;
        const needle=selected.name.toLowerCase();
        setProfile(pr);setMembers(tm);setEditorialTemplates(et||[]);setSocialTemplates(st||[]);setProgramTasks((tasks||[]).filter((task:any)=>`${task.title||""} ${task.description||""}`.toLowerCase().includes(needle)).slice(0,20));
        setHistory((ws||[]).filter((x:any)=>Number(x.air_hour)>=Number(selected.start.slice(0,2))&&Number(x.air_hour)<Math.max(Number(selected.end.slice(0,2)),Number(selected.start.slice(0,2))+1)).slice(0,12));
        emitActivity({detail:`Programmapagina • ${selected.name}`,entityType:"program",entityId:selected.id});
      }catch(e){flash(e instanceof Error?e.message:"Programmapagina laden mislukt")}
    })();
    return()=>{alive=false};
  },[selectedId,stationSlug]);

  const memberIds=useMemo(()=>new Set(members.map(x=>x.userId)),[members]);
  function toggleMember(person:TeamPerson){
    setMembers(old=>memberIds.has(person.id)?old.filter(x=>x.userId!==person.id):[...old,{programId:selectedId,userId:person.id,role:"presentator",isPrimary:old.length===0,name:person.name,initials:person.initials}]);
  }
  async function save(){
    if(!selected||!profile)return;
    try{
      await Promise.all([
        saveProgramProfile(selected,profile),
        canManageTeam?saveProgramTeam(selected.id,members.map(x=>({userId:x.userId,role:x.role,isPrimary:x.isPrimary}))):Promise.resolve(members)
      ]);
      flash("Programmapagina opgeslagen");
    }catch(e){flash(e instanceof Error?e.message:"Opslaan mislukt")}
  }
  if(stationSlug==="all")return <div className="page-intro"><div><h2>Programma&apos;s</h2><p>Kies één station om programma-pagina&apos;s te beheren.</p></div></div>;
  return <div className="program-pages">
    <div className="page-intro"><div><span className="eyebrow">PROGRAMMAHUB</span><h2>Programma-pagina&apos;s</h2><p>Team, format, vaste items, templates, jingles, studio-info, documenten en eerdere uitzendingen op één plek.</p></div>{selected&&<button className="primary" onClick={()=>void save()}>Opslaan</button>}</div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}
    <div className="program-pages-layout">
      <aside className="card program-pages-list">{programs.map(p=><button key={p.id} className={selectedId===p.id?"active":""} onClick={()=>setSelectedId(p.id)}><strong>{p.name}</strong><span>{p.start}–{p.end} • {p.host||"geen host"}</span></button>)}</aside>
      <main className="program-page-detail">
        {!selected||!profile?<div className="card empty-live-state"><strong>Kies een programma</strong><span>Daarna verschijnt de volledige programmapagina.</span></div>:<>
          <section className="card program-page-hero"><div><span className="eyebrow">{selected.start}–{selected.end}</span><h2>{selected.name}</h2><p>{selected.format} • {selected.host||"Nog geen presentator"}</p></div><div className="program-team-avatars">{members.map(m=><span key={m.userId} title={`${m.name} • ${m.role}`}>{m.initials}</span>)}</div></section>
          <div className="two-col">
            <section className="card"><h3>Format & studio</h3><label className="field">Korte omschrijving<textarea className="input textarea" value={profile.summary} onChange={e=>setProfile({...profile,summary:e.target.value})}/></label><label className="field">Studio-info<textarea className="input textarea" value={profile.studioInfo} onChange={e=>setProfile({...profile,studioInfo:e.target.value})} placeholder="Microfoons, remote login, bijzonderheden…"/></label><label className="field">Jingles / imaging<textarea className="input textarea" value={profile.jingleNotes} onChange={e=>setProfile({...profile,jingleNotes:e.target.value})}/></label></section>
            <section className="card"><h3>Vaste items</h3><p className="muted">Eén item per regel. Deze lijst verschijnt als geheugensteun op het presentator-dashboard.</p><textarea className="input textarea tall" value={profile.fixedItems.join("\n")} onChange={e=>setProfile({...profile,fixedItems:e.target.value.split("\n").filter(Boolean)})} placeholder={"Openingsbreak\nVerkeer 16:40\nSponsoractie\nClosing"}/><h3>Documenten / links</h3><textarea className="input textarea" value={profile.documentLinks.map(x=>`${x.label}|${x.url}`).join("\n")} onChange={e=>setProfile({...profile,documentLinks:e.target.value.split("\n").filter(Boolean).map(line=>{const[label,...url]=line.split("|");return{label:label||"Document",url:url.join("|")}})})} placeholder="Draaiboek|https://…"/></section>
          </div>
          <section className="card"><div className="section-head"><div><h3>Team</h3><p>Koppel echte Supabase-gebruikers aan dit programma. Dit stuurt ook Mijn uitzending en afwezigheidsimpact.{!canManageTeam?" Alleen stationbeheer kan teamkoppelingen wijzigen.":""}</p></div></div><div className="program-team-picker">{team.map(person=>{const member=members.find(x=>x.userId===person.id);return <div className={`program-team-person ${member?"selected":""}`} key={person.id}><button disabled={!canManageTeam} onClick={()=>canManageTeam&&toggleMember(person)}><span>{person.initials}</span><div><strong>{person.name}</strong><small>{person.jobTitle||person.role}</small></div><b>{member?"✓":canManageTeam?"+":"—"}</b></button>{member&&<div className="program-team-meta"><input disabled={!canManageTeam} value={member.role} onChange={e=>setMembers(old=>old.map(x=>x.userId===person.id?{...x,role:e.target.value}:x))}/><label><input disabled={!canManageTeam} type="checkbox" checked={member.isPrimary} onChange={e=>setMembers(old=>old.map(x=>({...x,isPrimary:x.userId===person.id?e.target.checked:e.target.checked?false:x.isPrimary})))}/> Primair</label></div>}</div>})}</div></section>
          <div className="two-col">
            <section className="card"><h3>Redactietemplates</h3><div className="template-link-list">{editorialTemplates.map(t=><label key={t.id}><input type="checkbox" checked={profile.editorialTemplateIds.includes(String(t.id))} onChange={e=>setProfile({...profile,editorialTemplateIds:e.target.checked?[...profile.editorialTemplateIds,String(t.id)]:profile.editorialTemplateIds.filter(id=>id!==String(t.id))})}/><span><strong>{t.name}</strong><small>{t.program_name||"Algemeen"}</small></span></label>)}</div></section>
            <section className="card"><h3>Social templates</h3><div className="template-link-list">{socialTemplates.map(t=><label key={t.id}><input type="checkbox" checked={profile.socialTemplateIds.includes(String(t.id))} onChange={e=>setProfile({...profile,socialTemplateIds:e.target.checked?[...profile.socialTemplateIds,String(t.id)]:profile.socialTemplateIds.filter(id=>id!==String(t.id))})}/><span><strong>{t.name}</strong><small>{t.content_type||"Social"}</small></span></label>)}</div></section>
          </div>
          <section className="card"><div className="section-head"><div><h3>Voorbereidingen & terugkerende taken</h3><p>Taken waarin de programmanaam voorkomt. Terugkerende taken blijven in het centrale taakbeheer.</p></div><a className="ghost" href={`/hub/${stationSlug}/taken`}>Open taken</a></div>{programTasks.length===0?<div className="empty-live-state compact"><strong>Nog geen programmataken</strong><span>Maak een taak met de programmanaam in titel of omschrijving om ze hier te koppelen.</span></div>:<div className="program-history">{programTasks.map((task:any)=><div key={task.id}><strong>{task.title}</strong><span>{task.recurrence_kind!=="none"?`↻ ${task.recurrence_kind}`:"Eenmalig"} • {task.status}{task.due_at?` • ${new Date(task.due_at).toLocaleString("nl-BE",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}`:""}</span></div>)}</div>}</section>
          <section className="card"><h3>Eerdere uitzendingen / redactie</h3>{history.length===0?<div className="empty-live-state compact"><strong>Nog geen historie</strong><span>Opgeslagen redactiewerkruimtes voor deze uren verschijnen hier.</span></div>:<div className="program-history">{history.map((h:any)=><div key={`${h.air_date}-${h.air_hour}`}><strong>{h.air_date} • {String(h.air_hour).padStart(2,"0")}:00</strong><span>{Array.isArray(h.items)?h.items.length:0} redactie-items</span></div>)}</div>}</section>
        </>}
      </main>
    </div>
  </div>;
}
