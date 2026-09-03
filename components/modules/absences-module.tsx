"use client";

import { useCallback,useEffect,useMemo,useState } from "react";
import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import { useCollaboration } from "@/components/collaboration/collaboration-provider";
import { createAbsence,deleteAbsence,loadAbsences,loadTeamPeople,updateAbsenceCoverage,type Absence,type TeamPerson } from "@/lib/supabase/operations";
import { emitActivity } from "@/lib/collaboration/activity";

const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Brussels",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
function fmtDate(v:string){const d=new Date(`${v}T12:00:00`);return Number.isNaN(d.getTime())?v:d.toLocaleDateString("nl-BE",{weekday:"short",day:"2-digit",month:"short"})}
function roleAdmin(role:string){return["superadmin","stationmanager","admin","beheer"].includes(role.toLowerCase())}

export default function AbsencesModule({stationSlug}:{stationSlug:string}){
  const collaboration=useCollaboration();
  const[items,setItems]=useState<Absence[]>([]);
  const[team,setTeam]=useState<TeamPerson[]>([]);
  const[userId,setUserId]=useState("");
  const[start,setStart]=useState(today());
  const[end,setEnd]=useState(today());
  const[reason,setReason]=useState("");
  const[notes,setNotes]=useState("");
  const[busy,setBusy]=useState(false);
  const[notice,setNotice]=useState("");
  const admin=roleAdmin(collaboration.currentUser?.role||"");
  const configured=isSupabaseBrowserConfigured();

  function flash(x:string){setNotice(x);window.setTimeout(()=>setNotice(""),3000)}
  const load=useCallback(async()=>{
    if(!configured||stationSlug==="all")return;
    try{
      const[people,rows]=await Promise.all([loadTeamPeople(stationSlug),loadAbsences(stationSlug)]);
      setTeam(people);setItems(rows);
      if(!userId&&collaboration.currentUser?.id)setUserId(collaboration.currentUser.id);
    }catch(e){flash(e instanceof Error?e.message:"Afwezigheden laden mislukt")}
  },[configured,stationSlug,collaboration.currentUser?.id,userId]);
  useEffect(()=>{void load()},[load]);
  useEffect(()=>{
    if(!configured)return;
    const supabase=createClient();
    const channel=supabase.channel(`vlacora-absences-${stationSlug}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"hub_absences"},()=>void load())
      .on("postgres_changes",{event:"*",schema:"public",table:"hub_absence_coverages"},()=>void load())
      .subscribe();
    return()=>{void supabase.removeChannel(channel)};
  },[configured,load,stationSlug]);

  const upcoming=useMemo(()=>items.filter(x=>x.status!=="cancelled"&&x.endsOn>=today()),[items]);

  async function submit(){
    if(!userId)return flash("Kies een teamlid.");if(end<start)return flash("Einddatum kan niet vóór startdatum liggen.");
    setBusy(true);
    try{
      const id=await createAbsence({stationSlug,userId,startsOn:start,endsOn:end,reason,notes});
      emitActivity({detail:`Afwezigheid toegevoegd • ${start}–${end}`,entityType:"absence",entityId:id});
      setReason("");setNotes("");await load();flash("Afwezigheid opgeslagen en programma-impact berekend");
    }catch(e){flash(e instanceof Error?e.message:"Opslaan mislukt")}
    finally{setBusy(false)}
  }
  async function assign(coverageId:string,replacement:string){
    try{
      await updateAbsenceCoverage(coverageId,{replacementUserId:replacement||null,status:replacement?"asked":"unassigned"});
      if(replacement){
        const coverage=items.flatMap(x=>x.coverages).find(x=>x.id===coverageId);
        await collaboration.publishNotification({stationSlug,title:`Vervanging gevraagd: ${coverage?.programName||"programma"}`,body:`Kun je invallen op ${coverage?.airDate||""}?`,category:"Vervanging",severity:"warning",requiresAck:false,actionPath:`/hub/${stationSlug}/afwezigheden`,recipientUserId:replacement}).catch(()=>{});
      }
      await load();
    }catch(e){flash(e instanceof Error?e.message:"Vervanger opslaan mislukt")}
  }
  async function status(coverageId:string,value:"unassigned"|"asked"|"confirmed"|"declined"){try{await updateAbsenceCoverage(coverageId,{status:value});await load()}catch(e){flash(e instanceof Error?e.message:"Status aanpassen mislukt")}}

  if(stationSlug==="all")return <div className="page-intro"><div><h2>Afwezigheden & vervanging</h2><p>Kies één station om programma-impact en vervangers te beheren.</p></div></div>;
  if(!configured)return <div className="page-intro"><div><h2>Afwezigheden</h2><p>Supabase is nodig om afwezigheden centraal met het team te delen.</p></div></div>;

  return <div className="absence-page">
    <div className="page-intro"><div><span className="eyebrow">PLANNING & TEAM</span><h2>Afwezigheden & vervanging</h2><p>VLACORA berekent welke programma&apos;s geraakt worden, toont open taken en laat per uitzending een vervanger kiezen.</p></div><span className="metric-badge">{upcoming.length} actief / gepland</span></div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}
    <div className="absence-layout">
      <section className="card absence-form">
        <h3>Afwezigheid toevoegen</h3>
        <label>Teamlid<select value={userId} disabled={!admin} onChange={e=>setUserId(e.target.value)}>{team.map(p=><option key={p.id} value={p.id}>{p.name} • {p.role}</option>)}</select></label>
        <div className="two-form-cols"><label>Van<input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label>Tot<input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label></div>
        <label>Reden<input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Vakantie, ziekte, opleiding…"/></label>
        <label>Notitie<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Extra informatie voor planning / vervanger…"/></label>
        <button className="primary" disabled={busy||!userId} onClick={()=>void submit()}>{busy?"Opslaan…":"Afwezigheid opslaan"}</button>
      </section>

      <section className="absence-list">
        {upcoming.length===0&&<div className="card empty-live-state"><strong>Geen geplande afwezigheden</strong><span>Nieuwe afwezigheden verschijnen hier met de programma&apos;s die geraakt worden.</span></div>}
        {upcoming.map(item=><article className="card absence-card" key={item.id}>
          <div className="absence-card-head"><div className="absence-avatar">{item.userAvatarUrl?<img src={item.userAvatarUrl} alt=""/>:item.userName.split(/\s+/).map(x=>x[0]).slice(0,2).join("").toUpperCase()}</div><div><h3>{item.userName} afwezig</h3><p>{fmtDate(item.startsOn)} → {fmtDate(item.endsOn)}{item.reason?` • ${item.reason}`:""}</p></div><div className="absence-head-actions"><span>{item.coverages.filter(x=>x.status==="confirmed").length}/{item.coverages.length} vervanging rond</span>{(admin||item.userId===collaboration.currentUser?.id)&&<button className="ghost danger-text" onClick={()=>{if(confirm("Afwezigheid verwijderen?"))void deleteAbsence(item.id).then(load)}}>Verwijder</button>}</div></div>
          {item.notes&&<div className="absence-note">{item.notes}</div>}
          <div className="absence-impact-summary"><div><span>Geraakte uitzendingen</span><strong>{item.coverages.length}</strong></div><div><span>Open taken op naam</span><strong>{item.openTasks}</strong></div><div><span>Vervanger verplicht</span><strong>{item.coverages.filter(x=>x.coverageMode==="required"&&x.status!=="confirmed").length}</strong></div></div>
          <div className="absence-coverages">
            {item.coverages.length===0&&<div className="empty-live-state compact"><strong>Geen programma-impact gevonden</strong><span>Koppel dit teamlid op de Programma-pagina aan programma&apos;s of controleer de presentatornaam in Programmering.</span></div>}
            {item.coverages.map(c=><div className={`coverage-row coverage-${c.coverageMode}`} key={c.id}><div className="coverage-date"><strong>{fmtDate(c.airDate)}</strong><span>{c.programName}</span><b className={`coverage-impact ${c.coverageMode}`}>{c.status==="confirmed"?"✓ VERVANGING ROND":c.coverageMode==="optional"?"KAN DOORGAAN MET BESTAAND TEAM":"KAN NIET DOORGAAN ZONDER VERVANGER"}</b></div><label>Vervanger<select disabled={!admin} value={c.replacementUserId||""} onChange={e=>void assign(c.id,e.target.value)}><option value="">Nog niemand</option>{team.filter(p=>p.id!==item.userId).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Status<select disabled={!admin} value={c.status} onChange={e=>void status(c.id,e.target.value as any)}><option value="unassigned">Niet toegewezen</option><option value="asked">Gevraagd</option><option value="confirmed">Bevestigd</option><option value="declined">Geweigerd</option></select></label><span className={`coverage-state ${c.status}`}>{c.status==="confirmed"?"✓ Rond":c.status==="asked"?"Wacht op antwoord":c.status==="declined"?"Geweigerd":c.coverageMode==="optional"?"Kan doorgaan":"Vervanger nodig"}</span></div>)}
          </div>
        </article>)}
      </section>
    </div>
  </div>;
}
