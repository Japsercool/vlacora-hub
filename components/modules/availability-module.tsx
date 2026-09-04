"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import { emitActivity } from "@/lib/collaboration/activity";

type ResponseValue="available"|"maybe"|"unavailable";
type Weekly={id:string;station_slug:string;user_id:string;weekday:number;start_time:string;end_time:string;active:boolean;note:string;response:ResponseValue};
type Exception={id:string;station_slug:string;user_id:string;starts_at:string;ends_at:string;response:ResponseValue;note:string};
type Poll={id:string;station_slug:string;title:string;description:string;poll_type:"program"|"meeting"|"event"|"other";starts_on:string;ends_on:string;day_start:string;day_end:string;slot_minutes:number;status:string;linked_hitlist_id:string|null;event_key:string;confirmation_required:boolean;use_weekly_suggestions:boolean;response_deadline:string|null;created_by:string};
type Option={id:string;poll_id:string;starts_at:string;ends_at:string;label:string;sort_order:number};
type Answer={option_id:string;user_id:string;response:ResponseValue;note:string};
type Role={id:string;poll_id:string;role_key:string;label:string;required_count:number;sort_order:number};
type Assignment={id:string;poll_id:string;option_id:string;user_id:string;role_key:string;status:string;note:string;confirmed_at:string|null};
type Profile={id:string;display_name:string|null;email:string|null;role:string|null};
type Hitlist={id:string;name:string;edition_label:string;size:number;status:string};

const DAYS=["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag","Zondag"];
const statusLabel:Record<ResponseValue,string>={available:"Beschikbaar",maybe:"Misschien",unavailable:"Niet beschikbaar"};
const statusIcon:Record<ResponseValue,string>={available:"🟢",maybe:"🟠",unavailable:"🔴"};
const dtLocal=(v:string)=>v?new Date(v).toISOString().slice(0,16):"";
const fromLocal=(v:string)=>v?new Date(v).toISOString():"";
const slugify=(v:string)=>v.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

export default function AvailabilityModule({stationSlug}:{stationSlug:string}){
  const supabase=useMemo(()=>isSupabaseBrowserConfigured()?createClient():null,[]);
  const[userId,setUserId]=useState("");
  const[role,setRole]=useState("");
  const[tab,setTab]=useState<"mine"|"polls"|"events"|"team">("mine");
  const[weekly,setWeekly]=useState<Weekly[]>([]);
  const[exceptions,setExceptions]=useState<Exception[]>([]);
  const[polls,setPolls]=useState<Poll[]>([]);
  const[options,setOptions]=useState<Option[]>([]);
  const[answers,setAnswers]=useState<Answer[]>([]);
  const[roles,setRoles]=useState<Role[]>([]);
  const[assignments,setAssignments]=useState<Assignment[]>([]);
  const[profiles,setProfiles]=useState<Profile[]>([]);
  const[hitlists,setHitlists]=useState<Hitlist[]>([]);
  const[busy,setBusy]=useState(false);const[notice,setNotice]=useState("");
  const[weekDraft,setWeekDraft]=useState({weekday:0,start:"18:00",end:"22:00",response:"available" as ResponseValue,note:""});
  const[exDraft,setExDraft]=useState({start:"",end:"",response:"unavailable" as ResponseValue,note:""});
  const[eventDraft,setEventDraft]=useState({title:"",description:"",startsOn:"",endsOn:"",dayStart:"09:00",dayEnd:"22:00",slotMinutes:180,linkedHitlistId:"",deadline:"",confirmationRequired:true,useWeeklySuggestions:true});
  const[roleDraft,setRoleDraft]=useState("presenter:Presentator:1,producer:Producer:1,techniek:Techniek:1,socials:Socials:1,redactie:Redactie:1");

  const canManage=["superadmin","stationmanager","admin","beheer"].includes(role.toLowerCase());
  const activeStation=stationSlug==="all"?"all":stationSlug;

  function flash(x:string){setNotice(x);window.setTimeout(()=>setNotice(""),3600)}

  async function load(){
    if(!supabase)return;
    const {data:auth}=await supabase.auth.getUser();const uid=auth.user?.id||"";setUserId(uid);if(!uid)return;
    const {data:p}=await supabase.from("profiles").select("id,display_name,email,role").order("display_name");
    const me=(p||[]).find((x:any)=>x.id===uid);setRole(String(me?.role||""));setProfiles((p||[]) as Profile[]);
    const stationFilter=(q:any)=>activeStation==="all"?q:q.in("station_slug",["all",activeStation]);
    const [w,e,po,op,re,ro,as,hi]=await Promise.all([
      stationFilter(supabase.from("hub_weekly_availability").select("*")).eq("user_id",uid).order("weekday").order("start_time"),
      stationFilter(supabase.from("hub_availability_exceptions").select("*")).eq("user_id",uid).order("starts_at"),
      stationFilter(supabase.from("hub_availability_polls").select("*")).order("starts_on",{ascending:false}),
      supabase.from("hub_availability_poll_options").select("*").order("starts_at"),
      supabase.from("hub_availability_responses").select("*"),
      supabase.from("hub_availability_poll_roles").select("*").order("sort_order"),
      supabase.from("hub_availability_assignments").select("*"),
      activeStation==="all"?Promise.resolve({data:[]} as any):supabase.from("hitlists").select("id,name,edition_label,size,status").eq("station_slug",activeStation).order("created_at",{ascending:false})
    ]);
    setWeekly((w.data||[]) as Weekly[]);setExceptions((e.data||[]) as Exception[]);setPolls((po.data||[]) as Poll[]);setOptions((op.data||[]) as Option[]);setAnswers((re.data||[]) as Answer[]);setRoles((ro.data||[]) as Role[]);setAssignments((as.data||[]) as Assignment[]);setHitlists((hi.data||[]) as Hitlist[]);
    if(typeof window!=="undefined"){const linked=new URLSearchParams(window.location.search).get("hitlist");if(linked){setEventDraft(v=>({...v,linkedHitlistId:linked}));setTab("events")}}
  }

  useEffect(()=>{void load();emitActivity({detail:"Beschikbaarheid",entityType:"availability"})},[stationSlug]);

  async function addWeekly(){if(!supabase||!userId)return;setBusy(true);try{const {error}=await supabase.from("hub_weekly_availability").insert({station_slug:activeStation,user_id:userId,weekday:weekDraft.weekday,start_time:weekDraft.start,end_time:weekDraft.end,response:weekDraft.response,note:weekDraft.note,active:true});if(error)throw error;await load();flash("Beschikbaarheid toegevoegd.")}catch(e:any){flash(e.message||"Opslaan mislukt")}finally{setBusy(false)}}
  async function removeWeekly(id:string){if(!supabase)return;await supabase.from("hub_weekly_availability").delete().eq("id",id);await load()}
  async function addException(){if(!supabase||!userId||!exDraft.start||!exDraft.end)return flash("Kies begin en einde.");setBusy(true);try{const {error}=await supabase.from("hub_availability_exceptions").insert({station_slug:activeStation,user_id:userId,starts_at:fromLocal(exDraft.start),ends_at:fromLocal(exDraft.end),response:exDraft.response,note:exDraft.note});if(error)throw error;setExDraft({start:"",end:"",response:"unavailable",note:""});await load();flash("Uitzondering opgeslagen.")}catch(e:any){flash(e.message||"Opslaan mislukt")}finally{setBusy(false)}}
  async function respond(optionId:string,response:ResponseValue){if(!supabase||!userId)return;const {error}=await supabase.from("hub_availability_responses").upsert({option_id:optionId,user_id:userId,response,note:"",updated_at:new Date().toISOString()},{onConflict:"option_id,user_id"});if(error)flash(error.message);else{await load();flash("Antwoord opgeslagen.")}}
  async function confirmAssignment(id:string,status:"confirmed"|"declined"){if(!supabase)return;const {error}=await supabase.from("hub_availability_assignments").update({status,confirmed_at:status==="confirmed"?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq("id",id);if(error)flash(error.message);else await load()}

  async function createEvent(){
    if(!supabase||!userId||!canManage)return;if(!eventDraft.title.trim()||!eventDraft.startsOn||!eventDraft.endsOn)return flash("Geef titel en periode.");setBusy(true);
    try{
      const {data:poll,error}=await supabase.from("hub_availability_polls").insert({station_slug:activeStation,title:eventDraft.title.trim(),description:eventDraft.description,poll_type:"event",starts_on:eventDraft.startsOn,ends_on:eventDraft.endsOn,day_start:eventDraft.dayStart,day_end:eventDraft.dayEnd,slot_minutes:eventDraft.slotMinutes,status:"open",linked_hitlist_id:eventDraft.linkedHitlistId||null,event_key:slugify(eventDraft.title),confirmation_required:eventDraft.confirmationRequired,use_weekly_suggestions:eventDraft.useWeeklySuggestions,response_deadline:eventDraft.deadline?fromLocal(eventDraft.deadline):null,created_by:userId}).select("*").single();
      if(error)throw error;
      const start=new Date(`${eventDraft.startsOn}T00:00:00`);const end=new Date(`${eventDraft.endsOn}T00:00:00`);const optionRows:any[]=[];let sort=0;
      for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
        const date=d.toISOString().slice(0,10);const ds=new Date(`${date}T${eventDraft.dayStart}:00`);const de=new Date(`${date}T${eventDraft.dayEnd}:00`);
        for(let cursor=new Date(ds);cursor<de;cursor=new Date(cursor.getTime()+eventDraft.slotMinutes*60000)){
          const slotEnd=new Date(Math.min(cursor.getTime()+eventDraft.slotMinutes*60000,de.getTime()));
          optionRows.push({poll_id:poll.id,starts_at:cursor.toISOString(),ends_at:slotEnd.toISOString(),label:`${date} • ${cursor.toTimeString().slice(0,5)}–${slotEnd.toTimeString().slice(0,5)}`,sort_order:sort++});
        }
      }
      if(optionRows.length){const r=await supabase.from("hub_availability_poll_options").insert(optionRows);if(r.error)throw r.error}
      const parsedRoles=roleDraft.split(",").map(x=>x.trim()).filter(Boolean).map((x,i)=>{const[k,label,count]=x.split(":");return{poll_id:poll.id,role_key:(k||`role${i}`).trim(),label:(label||k||`Rol ${i+1}`).trim(),required_count:Math.max(0,Number(count||1)),sort_order:(i+1)*10}});
      if(parsedRoles.length){const r=await supabase.from("hub_availability_poll_roles").insert(parsedRoles);if(r.error)throw r.error}
      const eligible=profiles.map(p=>({poll_id:poll.id,user_id:p.id,required:true,invited_by:userId}));if(eligible.length)await supabase.from("hub_availability_poll_members").insert(eligible);
      await load();setEventDraft(v=>({...v,title:"",description:"",linkedHitlistId:""}));setTab("events");flash("Eventbeschikbaarheid aangemaakt.");
    }catch(e:any){flash(e.message||"Event aanmaken mislukt")}finally{setBusy(false)}
  }

  async function assign(pollId:string,optionId:string,user:string,roleKey:string){if(!supabase||!canManage)return;const {error}=await supabase.from("hub_availability_assignments").upsert({poll_id:pollId,option_id:optionId,user_id:user,role_key:roleKey,status:"offered",assigned_by:userId,updated_at:new Date().toISOString()},{onConflict:"option_id,user_id,role_key"});if(error)flash(error.message);else{await load();flash("Shift aangeboden.")}}

  const eventPolls=polls.filter(p=>p.poll_type==="event");const normalPolls=polls.filter(p=>p.poll_type!=="event");
  const myAssignments=assignments.filter(a=>a.user_id===userId);

  return <div>
    <div className="page-intro"><div><h2>Beschikbaarheid</h2><p>Vaste week, uitzonderingen, prikmomenten en events zoals Top 1000, Top 500 of speciale uitzendingen.</p></div></div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}
    <div className="button-row availability-tabs">
      <button className={tab==="mine"?"primary":"ghost"} onClick={()=>setTab("mine")}>Mijn beschikbaarheid</button>
      <button className={tab==="polls"?"primary":"ghost"} onClick={()=>setTab("polls")}>Prikmomenten</button>
      <button className={tab==="events"?"primary":"ghost"} onClick={()=>setTab("events")}>Events & specials</button>
      {canManage&&<button className={tab==="team"?"primary":"ghost"} onClick={()=>setTab("team")}>Teamplanning</button>}
    </div>

    {tab==="mine"&&<>
      <section className="card"><div className="section-head"><div><h3>Mijn standaardweek</h3><p>Deze planning is een suggestie. Voor Top 1000 en andere specials moet je eventbeschikbaarheid apart bevestigen.</p></div><span className="badge badge-green">PERSOONLIJK</span></div>
        <div className="two-form-cols"><label className="field">Dag<select className="select" value={weekDraft.weekday} onChange={e=>setWeekDraft(v=>({...v,weekday:Number(e.target.value)}))}>{DAYS.map((d,i)=><option key={d} value={i}>{d}</option>)}</select></label><label className="field">Status<select className="select" value={weekDraft.response} onChange={e=>setWeekDraft(v=>({...v,response:e.target.value as ResponseValue}))}><option value="available">🟢 Beschikbaar</option><option value="maybe">🟠 Misschien</option><option value="unavailable">🔴 Niet beschikbaar</option></select></label><label className="field">Van<input className="input" type="time" value={weekDraft.start} onChange={e=>setWeekDraft(v=>({...v,start:e.target.value}))}/></label><label className="field">Tot<input className="input" type="time" value={weekDraft.end} onChange={e=>setWeekDraft(v=>({...v,end:e.target.value}))}/></label><label className="field">Notitie<input className="input" value={weekDraft.note} onChange={e=>setWeekDraft(v=>({...v,note:e.target.value}))} placeholder="optioneel"/></label></div><button className="primary" disabled={busy} onClick={()=>void addWeekly()}>+ Tijdvak toevoegen</button>
        <div className="availability-week-list">{DAYS.map((day,di)=><div className="availability-day" key={day}><strong>{day}</strong><div>{weekly.filter(w=>w.weekday===di).map(w=><span className={`availability-slot availability-${w.response}`} key={w.id}>{statusIcon[w.response]} {w.start_time.slice(0,5)}–{w.end_time.slice(0,5)} {w.note&&<small>• {w.note}</small>}<button className="mini-btn" onClick={()=>void removeWeekly(w.id)}>×</button></span>)}{weekly.filter(w=>w.weekday===di).length===0&&<small className="muted">Nog niets ingesteld</small>}</div></div>)}</div>
      </section>
      <section className="card"><div className="section-head"><div><h3>Uitzonderingen op datum</h3><p>Vakantie, eenmalig beschikbaar, of net niet beschikbaar.</p></div></div><div className="two-form-cols"><label className="field">Van<input className="input" type="datetime-local" value={exDraft.start} onChange={e=>setExDraft(v=>({...v,start:e.target.value}))}/></label><label className="field">Tot<input className="input" type="datetime-local" value={exDraft.end} onChange={e=>setExDraft(v=>({...v,end:e.target.value}))}/></label><label className="field">Status<select className="select" value={exDraft.response} onChange={e=>setExDraft(v=>({...v,response:e.target.value as ResponseValue}))}><option value="available">🟢 Beschikbaar</option><option value="maybe">🟠 Misschien</option><option value="unavailable">🔴 Niet beschikbaar</option></select></label><label className="field">Notitie<input className="input" value={exDraft.note} onChange={e=>setExDraft(v=>({...v,note:e.target.value}))}/></label></div><button className="primary" onClick={()=>void addException()}>Uitzondering toevoegen</button><div className="stack-list">{exceptions.map(x=><div className="station-admin-row" key={x.id}><span>{statusIcon[x.response]}</span><div><strong>{statusLabel[x.response]}</strong><small>{new Date(x.starts_at).toLocaleString("nl-BE")} → {new Date(x.ends_at).toLocaleString("nl-BE")} {x.note&&`• ${x.note}`}</small></div></div>)}</div></section>
      {myAssignments.length>0&&<section className="card"><div className="section-head"><div><h3>Mijn aangeboden shifts</h3><p>Bevestig of weiger een concrete eventshift.</p></div></div>{myAssignments.map(a=>{const o=options.find(x=>x.id===a.option_id);const p=polls.find(x=>x.id===a.poll_id);return <div className="station-admin-row" key={a.id}><div><strong>{p?.title||"Event"} • {a.role_key}</strong><small>{o?`${new Date(o.starts_at).toLocaleString("nl-BE")}–${new Date(o.ends_at).toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit"})}`:"Tijdvak"} • {a.status}</small></div><div className="button-row"><button className="primary" onClick={()=>void confirmAssignment(a.id,"confirmed")}>Bevestigen</button><button className="ghost" onClick={()=>void confirmAssignment(a.id,"declined")}>Weigeren</button></div></div>})}</section>}
    </>}

    {tab==="polls"&&<section className="card"><div className="section-head"><div><h3>Prikmomenten</h3><p>Cally/Doodle-achtige vragen voor meetings, opnames en programma-afspraken.</p></div></div>{normalPolls.length===0?<div className="empty-live-state"><strong>Geen open prikmomenten</strong><span>Nieuwe uitnodigingen verschijnen hier automatisch.</span></div>:normalPolls.map(p=><PollCard key={p.id} poll={p} options={options} answers={answers} userId={userId} onRespond={respond}/>)}</section>}

    {tab==="events"&&<>
      {canManage&&<section className="card"><div className="section-head"><div><h3>Nieuw event / special</h3><p>Maak beschikbaarheid voor Top 1000, Top 500, Ibiza 100, live-event of speciale uitzending.</p></div><span className="badge badge-blue">PLANNING</span></div><div className="two-form-cols"><label className="field">Titel<input className="input" value={eventDraft.title} onChange={e=>setEventDraft(v=>({...v,title:e.target.value}))} placeholder="Top 1000 • 2026"/></label><label className="field">Hitlijst koppelen<select className="select" value={eventDraft.linkedHitlistId} onChange={e=>setEventDraft(v=>({...v,linkedHitlistId:e.target.value}))}><option value="">Geen hitlijst</option>{hitlists.map(h=><option key={h.id} value={h.id}>{h.name} • {h.edition_label}</option>)}</select></label><label className="field">Van<input className="input" type="date" value={eventDraft.startsOn} onChange={e=>setEventDraft(v=>({...v,startsOn:e.target.value}))}/></label><label className="field">Tot<input className="input" type="date" value={eventDraft.endsOn} onChange={e=>setEventDraft(v=>({...v,endsOn:e.target.value}))}/></label><label className="field">Dag start<input className="input" type="time" value={eventDraft.dayStart} onChange={e=>setEventDraft(v=>({...v,dayStart:e.target.value}))}/></label><label className="field">Dag einde<input className="input" type="time" value={eventDraft.dayEnd} onChange={e=>setEventDraft(v=>({...v,dayEnd:e.target.value}))}/></label><label className="field">Shiftlengte<select className="select" value={eventDraft.slotMinutes} onChange={e=>setEventDraft(v=>({...v,slotMinutes:Number(e.target.value)}))}>{[60,90,120,180,240].map(n=><option key={n} value={n}>{n<60?`${n} min`:`${n/60} uur`}</option>)}</select></label><label className="field">Deadline<input className="input" type="datetime-local" value={eventDraft.deadline} onChange={e=>setEventDraft(v=>({...v,deadline:e.target.value}))}/></label><label className="field span2">Beschrijving<textarea className="input textarea" value={eventDraft.description} onChange={e=>setEventDraft(v=>({...v,description:e.target.value}))}/></label><label className="field span2">Rollen (key:naam:aantal)<input className="input" value={roleDraft} onChange={e=>setRoleDraft(e.target.value)}/><small className="field-note">Bijv. presenter:Presentator:2,producer:Producer:1,socials:Socials:1</small></label></div><label className="toggle-row"><input type="checkbox" checked={eventDraft.useWeeklySuggestions} onChange={e=>setEventDraft(v=>({...v,useWeeklySuggestions:e.target.checked}))}/><span><strong>Standaardweek als suggestie gebruiken</strong><small>De eventreactie blijft expliciet; niemand wordt automatisch ingepland.</small></span></label><label className="toggle-row"><input type="checkbox" checked={eventDraft.confirmationRequired} onChange={e=>setEventDraft(v=>({...v,confirmationRequired:e.target.checked}))}/><span><strong>Shift moet expliciet bevestigd worden</strong><small>Aanbevolen voor Top 1000/Top 500 en live specials.</small></span></label><button className="primary" disabled={busy} onClick={()=>void createEvent()}>Eventbeschikbaarheid aanmaken</button></section>}
      <section className="card"><div className="section-head"><div><h3>Events & specials</h3><p>Geef per tijdvak aan of je kunt. Jouw vaste week is alleen een suggestie.</p></div></div>{eventPolls.length===0?<div className="empty-live-state"><strong>Nog geen events</strong><span>Een beheerder kan hier Top 1000, Top 500 of andere specials aanmaken.</span></div>:eventPolls.map(p=><PollCard key={p.id} poll={p} options={options} answers={answers} userId={userId} onRespond={respond} hitlist={hitlists.find(h=>h.id===p.linked_hitlist_id)}/>)}</section>
    </>}

    {tab==="team"&&canManage&&<section className="card"><div className="section-head"><div><h3>Teamplanning</h3><p>Bekijk reacties en bied concrete shifts aan per rol.</p></div></div>{eventPolls.map(p=><div className="availability-team-event" key={p.id}><h4>{p.title}</h4>{options.filter(o=>o.poll_id===p.id).map(o=>{const pr=roles.filter(r=>r.poll_id===p.id);return <div className="availability-team-slot" key={o.id}><div><strong>{new Date(o.starts_at).toLocaleString("nl-BE")}–{new Date(o.ends_at).toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit"})}</strong><small>{answers.filter(a=>a.option_id===o.id&&a.response==="available").length} beschikbaar • {answers.filter(a=>a.option_id===o.id&&a.response==="maybe").length} misschien</small></div><div className="availability-role-grid">{pr.map(r=><div key={r.id}><b>{r.label} ({r.required_count})</b><select className="select" defaultValue="" onChange={e=>{if(e.target.value)void assign(p.id,o.id,e.target.value,r.role_key);e.currentTarget.value=""}}><option value="">+ Shift aanbieden…</option>{profiles.filter(profile=>answers.some(a=>a.option_id===o.id&&a.user_id===profile.id&&a.response!=="unavailable")).map(profile=><option key={profile.id} value={profile.id}>{profile.display_name||profile.email||profile.id}</option>)}</select><div>{assignments.filter(a=>a.option_id===o.id&&a.role_key===r.role_key).map(a=><small key={a.id}>{profiles.find(x=>x.id===a.user_id)?.display_name||"Teamlid"} • {a.status}</small>)}</div></div>)}</div></div>})}</div>)}</section>}
  </div>
}

function PollCard({poll,options,answers,userId,onRespond,hitlist}:{poll:Poll;options:Option[];answers:Answer[];userId:string;onRespond:(id:string,r:ResponseValue)=>Promise<void>;hitlist?:Hitlist}){
  return <div className="availability-poll-card"><div className="section-head"><div><h4>{poll.title}</h4><p>{poll.description||`${poll.starts_on} t/m ${poll.ends_on}`}{hitlist&&<> • gekoppeld aan <strong>{hitlist.name} {hitlist.edition_label}</strong></>}</p></div><span className="badge badge-blue">{poll.poll_type==="event"?"EVENT":"PRIKMOMENT"}</span></div><div className="availability-option-list">{options.filter(o=>o.poll_id===poll.id).map(o=>{const mine=answers.find(a=>a.option_id===o.id&&a.user_id===userId);return <div className="availability-option" key={o.id}><div><strong>{new Date(o.starts_at).toLocaleString("nl-BE")} – {new Date(o.ends_at).toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit"})}</strong><small>{mine?`${statusIcon[mine.response]} ${statusLabel[mine.response]}`:"Nog niet ingevuld"}</small></div><div className="button-row"><button className={mine?.response==="available"?"primary":"ghost"} onClick={()=>void onRespond(o.id,"available")}>🟢 Kan</button><button className={mine?.response==="maybe"?"primary":"ghost"} onClick={()=>void onRespond(o.id,"maybe")}>🟠 Misschien</button><button className={mine?.response==="unavailable"?"primary":"ghost"} onClick={()=>void onRespond(o.id,"unavailable")}>🔴 Kan niet</button></div></div>})}</div></div>
}
