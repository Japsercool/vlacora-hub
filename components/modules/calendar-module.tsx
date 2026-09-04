"use client";

import { useCallback,useEffect,useMemo,useState } from "react";
import { useRouter } from "next/navigation";
import { useCollaboration } from "@/components/collaboration/collaboration-provider";
import {
  deleteCalendarEvent,loadCalendarEvents,loadCalendarPeople,loadCalendarSourceItems,saveCalendarEvent,
  type CalendarEvent,type CalendarPerson,type CalendarScope,type CalendarSourceItem
} from "@/lib/supabase/calendar";

const TYPES=[
  ["meeting","Meeting"],["deadline","Deadline"],["shift","Programma / shift"],["content","Content"],["music","Muziek"],["social","Social"],["technical","Technisch"],["other","Andere"]
] as const;
const pad=(n:number)=>String(n).padStart(2,"0");
const localKey=(d:Date)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const monthStart=(d:Date)=>new Date(d.getFullYear(),d.getMonth(),1,12);
const addMonths=(d:Date,n:number)=>new Date(d.getFullYear(),d.getMonth()+n,1,12);
function monthCells(date:Date){const first=monthStart(date);const idx=(first.getDay()+6)%7;const start=new Date(first);start.setDate(first.getDate()-idx);return Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d})}
function toLocalInput(iso:string|null){if(!iso)return"";const d=new Date(iso);return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`}
function fromLocalInput(v:string){return v?new Date(v).toISOString():new Date().toISOString()}
function endOfMonthRange(month:Date){const start=monthCells(month)[0];const end=new Date(monthCells(month).at(-1)!);end.setDate(end.getDate()+1);return{from:start.toISOString(),to:end.toISOString()}}

export default function CalendarModule({stationSlug}:{stationSlug:string}){
  const collaboration=useCollaboration(),router=useRouter();
  const[month,setMonth]=useState(monthStart(new Date()));
  const[events,setEvents]=useState<CalendarEvent[]>([]);
  const[sources,setSources]=useState<CalendarSourceItem[]>([]);
  const[people,setPeople]=useState<CalendarPerson[]>([]);
  const[scope,setScope]=useState<"mine"|"station"|"organization">("mine");
  const[selectedId,setSelectedId]=useState<string>("");
  const[editor,setEditor]=useState<Partial<CalendarEvent>|null>(null);
  const[attendees,setAttendees]=useState<string[]>([]);
  const[inviteSearch,setInviteSearch]=useState("");
  const[inviteOpen,setInviteOpen]=useState(false);
  const[busy,setBusy]=useState(false);const[notice,setNotice]=useState("");
  const range=useMemo(()=>endOfMonthRange(month),[month]);
  const cells=useMemo(()=>monthCells(month),[month]);
  const flash=(x:string)=>{setNotice(x);window.setTimeout(()=>setNotice(""),2500)};

  const load=useCallback(async()=>{
    setBusy(true);try{
      const[e,s,p]=await Promise.all([loadCalendarEvents(stationSlug,range.from,range.to),loadCalendarSourceItems(stationSlug,range.from,range.to),loadCalendarPeople()]);
      setEvents(e);setSources(s);setPeople(p);
    }catch(e){flash(e instanceof Error?e.message:"Agenda laden mislukt")}finally{setBusy(false)}
  },[stationSlug,range.from,range.to,collaboration.currentUser?.id]);
  useEffect(()=>{void load()},[load]);

  const visibleEvents=useMemo(()=>events.filter(e=>{
    if(scope==="mine")return e.scope==="organization"||(e.scope==="station"&&(stationSlug==="all"||e.stationSlug===stationSlug))||e.ownerUserId===collaboration.currentUser?.id||e.attendeeIds.includes(collaboration.currentUser?.id||"");
    if(scope==="station")return e.scope==="station"&&(stationSlug==="all"||e.stationSlug===stationSlug);
    if(scope==="organization")return e.scope==="organization";
    return false;
  }),[events,scope,stationSlug,collaboration.currentUser?.id]);
  const showSources=scope==="station"||scope==="organization";
  const selected=events.find(e=>e.id===selectedId)||null;
  const invitePeople=useMemo(()=>{
    const q=inviteSearch.trim().toLowerCase();
    const me=collaboration.currentUser?.id||"";
    return people.filter(p=>p.id!==me&&(!q||`${p.name} ${p.email} ${p.jobTitle}`.toLowerCase().includes(q)));
  },[people,inviteSearch,collaboration.currentUser?.id]);
  const invitedPeople=useMemo(()=>attendees.map(id=>people.find(p=>p.id===id)).filter(Boolean) as CalendarPerson[],[attendees,people]);
  const upcoming=useMemo(()=>{
    const now=Date.now();
    return [...visibleEvents.map(e=>({id:e.id,title:e.title,startsAt:e.startsAt,subtitle:`${e.scope==="personal"?(e.ownerName||"Persoonlijk"):e.scope==="station"?e.stationSlug:"PULSE"} • ${e.eventType}`,path:"",source:false})),...(showSources?sources.map(s=>({...s,source:true})):[])].filter(x=>new Date(x.startsAt).getTime()>=now-86400000).sort((a,b)=>a.startsAt.localeCompare(b.startsAt)).slice(0,12);
  },[visibleEvents,sources,showSources]);

  function newEvent(targetScope:CalendarScope){
    const start=new Date();start.setMinutes(Math.ceil(start.getMinutes()/15)*15,0,0);const end=new Date(start.getTime()+60*60_000);
    setSelectedId("");setAttendees([]);setInviteSearch("");setInviteOpen(false);setEditor({id:`new-${Date.now()}`,scope:targetScope,stationSlug:stationSlug==="all"?"all":stationSlug,ownerUserId:targetScope==="personal"?(collaboration.currentUser?.id||null):null,title:"",description:"",eventType:"meeting",startsAt:start.toISOString(),endsAt:end.toISOString(),allDay:false,location:""});
  }
  function editEvent(e:CalendarEvent){setSelectedId(e.id);setEditor({...e});setAttendees(e.attendeeIds);setInviteSearch("");setInviteOpen(false)}
  function toggleAttendee(id:string){setAttendees(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id])}
  async function persist(){
    if(!editor?.title?.trim()||!editor.startsAt||!editor.scope)return flash("Vul minstens titel en startmoment in.");
    const previousIds=new Set(selected?.attendeeIds||[]);
    const newInvitees=editor.scope==="personal"?[]:attendees.filter(id=>!previousIds.has(id));
    setBusy(true);try{
      const id=await saveCalendarEvent({...(editor as any),stationSlug:editor.stationSlug||stationSlug},attendees);
      for(const userId of newInvitees){
        try{await collaboration.publishNotification({stationSlug:editor.scope==="station"?(editor.stationSlug||stationSlug):null,title:`Uitnodiging: ${editor.title.trim()}`,body:`Je bent uitgenodigd voor ${new Date(editor.startsAt).toLocaleString("nl-BE",{weekday:"short",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}${editor.location?` • ${editor.location}`:""}.`,category:"Agenda",severity:"info",actionPath:`/hub/${stationSlug}/kalender`,recipientUserId:userId})}catch{}
      }
      flash(newInvitees.length?`Agenda-item opgeslagen • ${newInvitees.length} uitnodiging(en) verstuurd`:"Agenda-item opgeslagen");setEditor(null);setSelectedId(id);setInviteSearch("");setInviteOpen(false);await load()
    }catch(e){flash(e instanceof Error?e.message:"Opslaan mislukt")}finally{setBusy(false)}
  }
  async function remove(){if(!selected||!confirm(`“${selected.title}” verwijderen?`))return;setBusy(true);try{await deleteCalendarEvent(selected.id);setEditor(null);setSelectedId("");flash("Agenda-item verwijderd");await load()}catch(e){flash(e instanceof Error?e.message:"Verwijderen mislukt")}finally{setBusy(false)}
  }

  return <div className="calendar-v22-page">
    <div className="page-intro"><div><span className="eyebrow">CENTRALE AGENDA</span><h2>Agenda</h2><p>Persoonlijke afspraken, zenderplanning en PULSE-brede momenten in één overzicht.</p></div><div className="button-row"><button className="ghost" disabled={busy} onClick={()=>void load()}>↻ Vernieuw</button><button className="primary" onClick={()=>newEvent(scope==="organization"?"organization":scope==="station"?"station":"personal")}>+ Afspraak</button></div></div>
    {notice&&<div className="inline-notice">{notice}</div>}
    <div className="calendar-scope-tabs">
      <button className={scope==="mine"?"active":""} onClick={()=>setScope("mine")}>◎ Mijn agenda</button>
      <button className={scope==="station"?"active":""} onClick={()=>setScope("station")}>◉ {stationSlug==="all"?"Alle zenders":"Zenderagenda"}</button>
      <button className={scope==="organization"?"active":""} onClick={()=>setScope("organization")}>▣ PULSE breed</button>
    </div>

    <div className="calendar-v22-layout">
      <section className="card calendar-v22-month">
        <div className="calendar-v22-nav"><div className="button-row"><button className="ghost" onClick={()=>setMonth(addMonths(month,-1))}>‹</button><button className="ghost" onClick={()=>setMonth(monthStart(new Date()))}>Vandaag</button><button className="ghost" onClick={()=>setMonth(addMonths(month,1))}>›</button></div><strong>{new Intl.DateTimeFormat("nl-BE",{month:"long",year:"numeric"}).format(month)}</strong><span>{visibleEvents.length} agenda-items</span></div>
        <div className="calendar-v22-weekdays">{["ma","di","wo","do","vr","za","zo"].map(x=><span key={x}>{x}</span>)}</div>
        <div className="calendar-v22-grid">{cells.map(day=>{
          const key=localKey(day),outside=day.getMonth()!==month.getMonth(),today=key===localKey(new Date());
          const dayEvents=visibleEvents.filter(e=>localKey(new Date(e.startsAt))===key);
          const daySources=showSources?sources.filter(e=>localKey(new Date(e.startsAt))===key):[];
          return <div className={`calendar-v22-day ${outside?"outside":""} ${today?"today":""}`} key={key}><div className="calendar-v22-dayhead"><b>{day.getDate()}</b>{today&&<span>vandaag</span>}<button onClick={()=>{const start=new Date(day);start.setHours(10,0,0,0);const end=new Date(start.getTime()+3600000);setAttendees([]);setInviteSearch("");setInviteOpen(false);setEditor({id:`new-${Date.now()}`,scope:scope==="organization"?"organization":scope==="station"?"station":"personal",stationSlug,ownerUserId:collaboration.currentUser?.id||null,title:"",eventType:"meeting",startsAt:start.toISOString(),endsAt:end.toISOString(),description:"",location:""})}}>＋</button></div><div className="calendar-v22-items">
            {dayEvents.slice(0,4).map(e=><button className={`calendar-event-chip type-${e.eventType}`} key={e.id} onClick={()=>editEvent(e)}><span>{e.allDay?"hele dag":new Date(e.startsAt).toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit"})}</span><strong>{e.title}</strong></button>)}
            {daySources.slice(0,3).map(s=><button className={`calendar-event-chip source-${s.kind}`} key={s.id} onClick={()=>router.push(s.path)}><span>{new Date(s.startsAt).toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit"})}</span><strong>{s.title}</strong></button>)}
            {dayEvents.length+daySources.length>7&&<small>+{dayEvents.length+daySources.length-7} meer</small>}
          </div></div>
        })}</div>
      </section>

      <aside className="calendar-v22-side">
        <section className="card"><div className="section-head"><div><h3>Komend</h3><p>De eerstvolgende afspraken in deze weergave.</p></div></div>{upcoming.length===0?<div className="empty-live-state compact"><strong>Niets gepland</strong></div>:upcoming.map((x:any)=><button className="calendar-upcoming-row" key={x.id} onClick={()=>x.source?router.push(x.path):editEvent(events.find(e=>e.id===x.id)!)}><span className="calendar-date-badge"><b>{new Date(x.startsAt).getDate()}</b><small>{new Date(x.startsAt).toLocaleDateString("nl-BE",{month:"short"})}</small></span><div><strong>{x.title}</strong><small>{new Date(x.startsAt).toLocaleString("nl-BE",{weekday:"short",hour:"2-digit",minute:"2-digit"})} • {x.subtitle}</small></div><b>›</b></button>)}</section>
        <section className="card calendar-legend"><h3>Wat komt samen?</h3><p><span>◎</span> Persoonlijke afspraken</p><p><span>◉</span> Zenderafspraken</p><p><span>▣</span> PULSE-brede momenten</p><p><span>✦</span> Geplande social posts</p><p><span>♫</span> Muziekmeetings</p><small>Social en meetings worden gelezen uit hun eigen tabellen; er wordt niets dubbel opgeslagen.</small></section>
      </aside>
    </div>

    {editor&&<div className="modal-backdrop" onMouseDown={()=>setEditor(null)}><div className="modal-card calendar-event-modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">AGENDA-ITEM</span><h2>{editor.id?.startsWith("new-")?"Nieuwe afspraak":"Afspraak bewerken"}</h2></div><button className="mini-btn" onClick={()=>setEditor(null)}>×</button></div><div className="modal-form">
      <label className="field">Titel<input className="input" value={editor.title||""} onChange={e=>setEditor({...editor,title:e.target.value})}/></label>
      <div className="calendar-editor-grid"><label className="field">Niveau<select className="select" value={editor.scope||"personal"} onChange={e=>setEditor({...editor,scope:e.target.value as CalendarScope})}><option value="personal">Persoonlijk</option><option value="station">Zender</option><option value="organization">PULSE breed</option></select></label><label className="field">Type<select className="select" value={editor.eventType||"meeting"} onChange={e=>setEditor({...editor,eventType:e.target.value})}>{TYPES.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label></div>
      {editor.scope==="personal"&&<div className="privacy-note"><strong>🔒 Alleen voor jou</strong><span>Persoonlijke afspraken zijn door niemand anders leesbaar, ook niet door admins of beheerders.</span></div>}
      <div className="calendar-editor-grid"><label className="field">Start<input className="input" type="datetime-local" value={toLocalInput(editor.startsAt||null)} onChange={e=>setEditor({...editor,startsAt:fromLocalInput(e.target.value)})}/></label><label className="field">Einde<input className="input" type="datetime-local" value={toLocalInput(editor.endsAt||null)} onChange={e=>setEditor({...editor,endsAt:e.target.value?fromLocalInput(e.target.value):null})}/></label></div>
      <label className="required-notification-toggle"><input type="checkbox" checked={Boolean(editor.allDay)} onChange={e=>setEditor({...editor,allDay:e.target.checked})}/><div><strong>Hele dag</strong><span>Toon zonder specifiek uur.</span></div></label>
      <label className="field">Locatie<input className="input" value={editor.location||""} onChange={e=>setEditor({...editor,location:e.target.value})} placeholder="Studio, vergaderzaal, online…"/></label>
      <label className="field">Beschrijving<textarea className="input textarea" value={editor.description||""} onChange={e=>setEditor({...editor,description:e.target.value})}/></label>
      {editor.scope!=="personal"&&<div className="field calendar-invite-field"><span>Mensen uitnodigen</span><div className="calendar-invite-box">
        {invitedPeople.length>0&&<div className="calendar-invite-chips">{invitedPeople.map(person=><button type="button" key={person.id} className="calendar-invite-chip" onClick={()=>toggleAttendee(person.id)}>{person.avatarUrl?<img src={person.avatarUrl} alt=""/>:<b>{person.name.split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase()}</b>}<span>{person.name}</span><i>×</i></button>)}</div>}
        <button type="button" className="calendar-invite-trigger" onClick={()=>setInviteOpen(v=>!v)}><span>＋ {attendees.length?"Nog iemand uitnodigen":"Teamleden kiezen"}</span><b>{attendees.length} geselecteerd ▾</b></button>
        {inviteOpen&&<div className="calendar-invite-popover"><input autoFocus className="input" value={inviteSearch} onChange={e=>setInviteSearch(e.target.value)} placeholder="Zoek op naam, e-mail of functie…"/><div className="calendar-invite-list">{invitePeople.length===0?<div className="calendar-invite-empty">Geen teamleden gevonden.</div>:invitePeople.map(person=>{const checked=attendees.includes(person.id);return <button type="button" key={person.id} className={checked?"selected":""} onClick={()=>toggleAttendee(person.id)}>{person.avatarUrl?<img src={person.avatarUrl} alt=""/>:<b>{person.name.split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase()}</b>}<span><strong>{person.name}</strong><small>{person.jobTitle||person.email}</small></span><i>{checked?"✓":"＋"}</i></button>})}</div><div className="calendar-invite-popover-foot"><span>{attendees.length} persoon/personen uitgenodigd</span><button type="button" className="ghost" onClick={()=>setInviteOpen(false)}>Klaar</button></div></div>}
      </div><small>Uitgenodigde accounts krijgen na opslaan een PULSE-melding. Persoonlijke afspraken kunnen niemand uitnodigen.</small></div>}
      <div className="button-row"><button className="primary" disabled={busy} onClick={()=>void persist()}>Opslaan</button>{selected&&<button className="ghost danger-text" disabled={busy} onClick={()=>void remove()}>Verwijderen</button>}</div>
    </div></div></div>}
  </div>;
}
