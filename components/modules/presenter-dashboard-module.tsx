"use client";

import { useCallback,useEffect,useState } from "react";
import { useRouter } from "next/navigation";
import { useCollaboration } from "@/components/collaboration/collaboration-provider";
import { loadPresenterDashboard,runOperationalChecks,type PresenterDashboardData } from "@/lib/supabase/operations";
import { emitActivity } from "@/lib/collaboration/activity";

function fmtDue(value:string|null){if(!value)return"Geen deadline";const d=new Date(value);return Number.isNaN(d.getTime())?"":d.toLocaleString("nl-BE",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}

export default function PresenterDashboardModule({stationSlug}:{stationSlug:string}){
  const collaboration=useCollaboration(),router=useRouter();
  const[data,setData]=useState<PresenterDashboardData|null>(null);
  const[busy,setBusy]=useState(true);
  const[error,setError]=useState("");
  const load=useCallback(async(force=false)=>{
    const userId=collaboration.currentUser?.id;
    if(!userId||userId==="local-user"){setBusy(false);return}
    setBusy(true);setError("");
    try{
      if(force)await runOperationalChecks(stationSlug,{force:true});else await runOperationalChecks(stationSlug).catch(()=>[]);
      const next=await loadPresenterDashboard(stationSlug,userId);
      setData(next);
      emitActivity({detail:next.program?`Mijn uitzending • ${next.program.name}`:"Mijn uitzending",entityType:"presenter-dashboard",entityId:next.program?.id});
    }catch(e){setError(e instanceof Error?e.message:"Dashboard kon niet laden")}
    finally{setBusy(false)}
  },[stationSlug,collaboration.currentUser?.id]);

  useEffect(()=>{void load(false)},[load]);

  if(stationSlug==="all")return <div className="page-intro"><div><h2>Mijn uitzending</h2><p>Kies één station om jouw huidige of volgende uitzending te tonen.</p></div></div>;
  if(busy&&!data)return <div className="page-intro"><div><h2>Mijn uitzending</h2><p>Programma, redactie en teaminfo worden geladen…</p></div></div>;
  if(error)return <div className="config-error standalone"><strong>Mijn uitzending</strong><span>{error}</span><button className="ghost" onClick={()=>void load(true)}>Opnieuw</button></div>;
  if(!data?.program)return <div><div className="page-intro"><div><span className="eyebrow">PRESENTATOR</span><h2>Geen uitzending aan jou gekoppeld</h2><p>Je Supabase-account is nog niet aan een programma gekoppeld. Laat beheer je bij Programmering of op de Programma-pagina als presentator/teamlid selecteren.</p></div><button className="primary" onClick={()=>router.push(`/hub/${stationSlug}/programmas`)}>Open programma&apos;s</button></div></div>;

  const p=data.program;
  return <div className="presenter-dashboard">
    <section className="presenter-hero">
      <div><span className="eyebrow">MIJN UITZENDING</span><h2>{p.name}</h2><p>{p.start}–{p.end} • {p.format}{p.host?` • ${p.host}`:""}</p></div>
      <div className={`presenter-ready ${data.editorialReady?"ready":"warning"}`}><span>{data.editorialReady?"✓":"!"}</span><div><strong>{data.editorialReady?"Redactie voorbereid":"Redactie controleren"}</strong><small>{data.editorialItems} redactie-item(s)</small></div></div>
    </section>

    <div className="presenter-metrics">
      <button onClick={()=>router.push(`/hub/${stationSlug}/redactie`)}><span>Talks</span><strong>{data.requiredTalks}</strong><small>verplichte talks</small></button>
      <button onClick={()=>router.push(`/hub/${stationSlug}/redactie`)}><span>Commercieel</span><strong>{data.sponsorTalks}</strong><small>sponsor-/actietalks</small></button>
      <button onClick={()=>router.push(`/hub/${stationSlug}/redactie`)}><span>Promo</span><strong>{data.promos}</strong><small>promo / imaging</small></button>
      <button onClick={()=>router.push(`/hub/${stationSlug}/meldingen`)}><span>Team</span><strong>{data.importantMessages}</strong><small>belangrijke berichten</small></button>
    </div>

    <div className="presenter-grid">
      <section className="card presenter-card">
        <div className="section-head"><div><h3>Verkeer & vaste momenten</h3><p>Live verkeersdata wordt pas opgehaald in de talk zelf.</p></div><button className="ghost" onClick={()=>router.push(`/hub/${stationSlug}/redactie`)}>Open redactie</button></div>
        {data.trafficMoments.length===0?<div className="empty-live-state compact"><strong>Geen verkeersslot</strong><span>Er staat in deze uitzending nog geen Verkeer-talk.</span></div>:data.trafficMoments.map((x,i)=><div className="presenter-line" key={`${x.time}-${i}`}><span>{x.time}</span><div><strong>{x.title||"Verkeer"}</strong><small>{x.ready?"Tekst klaar":"Live info nog ophalen"}</small></div><b className={x.ready?"ok":"warn"}>{x.ready?"✓":"!"}</b></div>)}
      </section>

      <section className="card presenter-card">
        <div className="section-head"><div><h3>Studio-info</h3><p>Vaste info van de programma-pagina.</p></div><button className="ghost" onClick={()=>router.push(`/hub/${stationSlug}/programmas?program=${encodeURIComponent(p.id)}`)}>Programmapagina</button></div>
        <div className="presenter-studio-info">{data.studioInfo||"Nog geen studio-info ingesteld voor dit programma."}</div>
        {data.profile?.fixedItems?.length?<div className="presenter-fixed-items">{data.profile.fixedItems.map((x,i)=><span key={`${x}-${i}`}>✓ {x}</span>)}</div>:null}
        <div className="presenter-next"><span>Volgende programma</span><strong>{data.nextProgram?`${data.nextProgram.start} • ${data.nextProgram.name}`:"Geen volgend programma gevonden"}</strong></div>
      </section>

      <section className="card presenter-card">
        <div className="section-head"><div><h3>Mijn taken</h3><p>Openstaande taken die aan jou zijn toegewezen.</p></div><button className="ghost" onClick={()=>router.push(`/hub/${stationSlug}/taken`)}>Alle taken</button></div>
        {data.tasks.length===0?<div className="empty-live-state compact"><strong>Geen open taken</strong><span>Je kunt focussen op de uitzending.</span></div>:data.tasks.map(t=><div className="presenter-line" key={t.id}><span className={`priority-dot priority-${t.priority}`}/><div><strong>{t.title}</strong><small>{fmtDue(t.dueAt)}</small></div></div>)}
      </section>

      <section className="card presenter-card">
        <div className="section-head"><div><h3>Belangrijke teamberichten</h3><p>Station- of persoonsgerichte meldingen die je voor je uitzending moet kennen.</p></div><button className="ghost" onClick={()=>router.push(`/hub/${stationSlug}/meldingen`)}>Alle meldingen</button></div>
        {data.messages.length===0?<div className="empty-live-state compact"><strong>Geen belangrijke berichten</strong><span>Er staat niets dringends voor je klaar.</span></div>:data.messages.map(m=><button className="presenter-warning" key={m.id} onClick={()=>router.push(m.actionPath||`/hub/${stationSlug}/meldingen`)}><span>●</span><div><strong>{m.title}</strong><small>{m.category} • {m.body}</small></div><b>›</b></button>)}
      </section>

      <section className="card presenter-card">
        <div className="section-head"><div><h3>Operationele waarschuwingen</h3><p>Geen constante polling; controle bij openen en handmatige refresh.</p></div><button className="ghost" onClick={()=>void load(true)}>↻ Controleer nu</button></div>
        {data.warnings.length===0?<div className="empty-live-state compact"><strong>Geen waarschuwingen</strong><span>De gecontroleerde onderdelen zien er goed uit.</span></div>:data.warnings.slice(0,6).map(w=><button className={`presenter-warning ${w.severity}`} key={w.warningKey} onClick={()=>router.push(w.actionPath||`/hub/${stationSlug}/meldingen`)}><span>{w.severity==="critical"?"!":"•"}</span><div><strong>{w.title}</strong><small>{w.body}</small></div><b>›</b></button>)}
      </section>
    </div>
  </div>;
}
