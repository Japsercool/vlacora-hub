"use client";

import { useCallback,useEffect,useMemo,useState } from "react";
import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import {
  addTaskComment,deleteTask,loadTaskEvents,loadTasks,loadTaskTeam,newTaskDraft,saveTask,setTaskStatus,
  type HubTask,type TaskDraft,type TaskEvent,type TaskPriority,type TaskRecurrence,type TaskStatus,type TaskTeamMember
} from "@/lib/supabase/tasks";
import { useCollaboration } from "@/components/collaboration/collaboration-provider";
import { emitActivity } from "@/lib/collaboration/activity";

type View="list"|"board";
type Filter="mine"|"all"|"recurring";
const weekdays=[{v:1,l:"ma"},{v:2,l:"di"},{v:3,l:"wo"},{v:4,l:"do"},{v:5,l:"vr"},{v:6,l:"za"},{v:0,l:"zo"}];

function dueInput(iso:string|null){
  if(!iso)return"";
  const d=new Date(iso);if(Number.isNaN(d.getTime()))return"";
  const p=(n:number)=>String(n).padStart(2,"0");
  return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fromDueInput(value:string){return value?new Date(value).toISOString():null}
function localDay(iso:string|null){if(!iso)return"";const d=new Date(iso);return Number.isNaN(d.getTime())?"":d.toLocaleDateString("nl-BE",{weekday:"short",day:"numeric",month:"short"})}
function localTime(iso:string|null){if(!iso)return"";const d=new Date(iso);return Number.isNaN(d.getTime())?"":d.toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit"})}
function initials(name:string){return(name||"T").split(/\s+/).filter(Boolean).map(x=>x[0]).slice(0,2).join("").toUpperCase()}
function statusLabel(status:TaskStatus){return status==="todo"?"Te doen":status==="in_progress"?"Bezig":status==="review"?"Controle":"Klaar"}
function priorityLabel(priority:TaskPriority){return priority==="low"?"Laag":priority==="normal"?"Normaal":priority==="high"?"Hoog":"Dringend"}
function recurrenceLabel(task:Pick<HubTask,"recurrenceKind"|"recurrenceInterval"|"recurrenceConfig">|TaskDraft){
  if(task.recurrenceKind==="none")return"Eenmalig";
  const interval=Math.max(1,task.recurrenceInterval||1);
  if(task.recurrenceKind==="daily")return interval===1?"Dagelijks":`Elke ${interval} dagen`;
  if(task.recurrenceKind==="monthly")return interval===1?"Maandelijks":`Elke ${interval} maanden`;
  const days=(task.recurrenceConfig.weekdays||[]).map(day=>weekdays.find(x=>x.v===Number(day))?.l).filter(Boolean).join(", ");
  return`${interval===1?"Wekelijks":`Elke ${interval} weken`}${days?` • ${days}`:""}`;
}
function dueTone(task:HubTask){
  if(!task.dueAt||task.status==="done")return"none";
  const due=new Date(task.dueAt).getTime(),now=Date.now();
  if(due<now)return"overdue";
  if(due-now<86400000)return"today";
  return"future";
}
function draftFromTask(task:HubTask):TaskDraft{
  return{
    id:task.id,stationSlug:task.stationSlug,title:task.title,description:task.description,status:task.status,priority:task.priority,
    dueAt:task.dueAt,recurrenceKind:task.recurrenceKind,recurrenceInterval:task.recurrenceInterval,
    recurrenceConfig:{...task.recurrenceConfig,weekdays:[...(task.recurrenceConfig.weekdays||[])]},
    seriesId:task.seriesId,recurrenceIndex:task.recurrenceIndex,assigneeIds:[...task.assigneeIds]
  };
}

export default function TasksModule({stationSlug}:{stationSlug:string}){
  const collab=useCollaboration();
  const configured=isSupabaseBrowserConfigured();
  const[tasks,setTasks]=useState<HubTask[]>([]);
  const[team,setTeam]=useState<TaskTeamMember[]>([]);
  const[events,setEvents]=useState<TaskEvent[]>([]);
  const[draft,setDraft]=useState<TaskDraft|null>(null);
  const[selectedId,setSelectedId]=useState("");
  const[filter,setFilter]=useState<Filter>("mine");
  const[view,setView]=useState<View>("list");
  const[query,setQuery]=useState("");
  const[notice,setNotice]=useState("");
  const[busy,setBusy]=useState(false);
  const[quickTitle,setQuickTitle]=useState("");
  const[comment,setComment]=useState("");
  const[showCompleted,setShowCompleted]=useState(false);

  function flash(message:string){setNotice(message);window.setTimeout(()=>setNotice(""),3000)}
  const load=useCallback(async()=>{
    if(!configured){setTasks([]);setTeam([]);return}
    try{
      const[rows,members]=await Promise.all([loadTasks(stationSlug),loadTaskTeam(stationSlug)]);
      setTasks(rows);setTeam(members);
    }catch(e){flash(e instanceof Error?e.message:"Taken laden mislukt")}
  },[configured,stationSlug]);

  useEffect(()=>{void load()},[load]);
  useEffect(()=>{
    if(!configured)return;
    const supabase=createClient();
    const channel=supabase.channel(`vlacora-tasks-${stationSlug}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"hub_tasks"},()=>void load())
      .on("postgres_changes",{event:"*",schema:"public",table:"hub_task_assignees"},()=>void load())
      .subscribe();
    return()=>{void supabase.removeChannel(channel)};
  },[configured,stationSlug,load]);

  useEffect(()=>{
    let alive=true;setEvents([]);setComment("");
    if(!selectedId||selectedId.startsWith("new-"))return()=>{alive=false};
    void loadTaskEvents(selectedId).then(rows=>{if(alive)setEvents(rows)}).catch(()=>{});
    return()=>{alive=false};
  },[selectedId]);

  const me=collab.currentUser?.id||"";
  const presenceByUser=useMemo(()=>new Map(collab.presence.map(p=>[p.userId,p])),[collab.presence]);
  const activePeople=useMemo(()=>collab.presence
    .filter(p=>(stationSlug==="all"||p.stationSlug===stationSlug||p.stationSlug==="all"))
    .sort((a,b)=>Number(b.moduleSlug==="taken")-Number(a.moduleSlug==="taken")||a.name.localeCompare(b.name)),[collab.presence,stationSlug]);

  const filtered=useMemo(()=>tasks.filter(task=>{
    if(!showCompleted&&task.status==="done")return false;
    if(filter==="mine"&&!task.assigneeIds.includes(me))return false;
    if(filter==="recurring"&&task.recurrenceKind==="none")return false;
    const q=query.trim().toLowerCase();
    if(q&&!`${task.title} ${task.description}`.toLowerCase().includes(q))return false;
    return true;
  }),[tasks,filter,query,me,showCompleted]);

  const todayCount=tasks.filter(t=>t.status!=="done"&&t.dueAt&&new Date(t.dueAt).toDateString()===new Date().toDateString()).length;
  const overdueCount=tasks.filter(t=>dueTone(t)==="overdue").length;
  const recurringCount=tasks.filter(t=>t.status!=="done"&&t.recurrenceKind!=="none").length;
  const myOpenCount=tasks.filter(t=>t.status!=="done"&&t.assigneeIds.includes(me)).length;

  function member(id:string){return team.find(x=>x.id===id)}
  function patch(p:Partial<TaskDraft>){if(draft)setDraft({...draft,...p})}
  function toggleAssignee(id:string){
    if(!draft)return;
    patch({assigneeIds:draft.assigneeIds.includes(id)?draft.assigneeIds.filter(x=>x!==id):[...draft.assigneeIds,id]});
  }
  function toggleWeekday(day:number){
    if(!draft)return;
    const current=draft.recurrenceConfig.weekdays||[];
    patch({recurrenceConfig:{...draft.recurrenceConfig,weekdays:current.includes(day)?current.filter(x=>x!==day):[...current,day]}});
  }
  function openTask(task:HubTask){
    setSelectedId(task.id);setDraft(draftFromTask(task));
    emitActivity({detail:`Werkt aan taak: ${task.title}`,entityType:"task",entityId:task.id});
  }
  function newTask(title=""){
    const d=newTaskDraft(stationSlug,me||null);d.title=title;setDraft(d);setSelectedId(d.id);
    emitActivity({detail:"Nieuwe taak voorbereiden",entityType:"task"});
  }
  function closeEditor(){
    setDraft(null);setSelectedId("");setEvents([]);emitActivity({detail:"Taken bekijken"});
  }

  async function persist(){
    if(!draft)return;
    const previous=draft.id.startsWith("new-")?null:tasks.find(x=>x.id===draft.id)||null;
    setBusy(true);
    try{
      const saved=await saveTask(draft);
      const oldAssignees=new Set(previous?.assigneeIds||[]);
      for(const userId of saved.assigneeIds.filter(id=>!oldAssignees.has(id)&&id!==me)){
        await collab.publishNotification({
          stationSlug:saved.stationSlug,recipientUserId:userId,title:`Nieuwe taak: ${saved.title}`,
          body:saved.dueAt?`Deadline ${localDay(saved.dueAt)} om ${localTime(saved.dueAt)}.`:"Je bent aan deze taak toegewezen.",
          category:"Taken",severity:saved.priority==="urgent"?"warning":"info",actionPath:`/hub/${saved.stationSlug}/taken`
        }).catch(()=>{});
      }
      setDraft(draftFromTask(saved));setSelectedId(saved.id);flash("Taak centraal opgeslagen");await load();
    }catch(e){flash(e instanceof Error?e.message:"Taak opslaan mislukt")}
    finally{setBusy(false)}
  }

  async function quickAdd(){
    if(!quickTitle.trim())return;
    const d=newTaskDraft(stationSlug,me||null);d.title=quickTitle.trim();
    setBusy(true);try{await saveTask(d);setQuickTitle("");flash("Taak toegevoegd");await load()}catch(e){flash(e instanceof Error?e.message:"Toevoegen mislukt")}finally{setBusy(false)}
  }

  async function changeStatus(task:HubTask,status:TaskStatus){
    setBusy(true);
    try{
      const result=await setTaskStatus(task,status);
      if(result.nextId)flash(`Klaar ✓ • volgende ${recurrenceLabel(task).toLowerCase()} taak is automatisch aangemaakt`);
      else flash(`Status: ${statusLabel(status)}`);
      if(selectedId===task.id){setDraft(draftFromTask(result.task));setSelectedId(result.task.id)}
      await load();
    }catch(e){flash(e instanceof Error?e.message:"Status wijzigen mislukt")}
    finally{setBusy(false)}
  }

  async function addComment(){
    if(!draft||draft.id.startsWith("new-")||!comment.trim())return;
    try{await addTaskComment(draft.id,comment);setComment("");setEvents(await loadTaskEvents(draft.id));flash("Opmerking toegevoegd")}catch(e){flash(e instanceof Error?e.message:"Opmerking mislukt")}
  }

  async function remove(wholeSeries=false){
    if(!draft||draft.id.startsWith("new-"))return;
    const task=tasks.find(x=>x.id===draft.id);if(!task)return;
    const message=wholeSeries?`Volledige reeks “${task.title}” verwijderen?`:`Taak “${task.title}” verwijderen?`;
    if(!confirm(message))return;
    try{await deleteTask(task,wholeSeries);closeEditor();await load();flash(wholeSeries?"Taakreeks verwijderd":"Taak verwijderd")}catch(e){flash(e instanceof Error?e.message:"Verwijderen mislukt")}
  }

  const columns:TaskStatus[]=["todo","in_progress","review","done"];

  if(!configured)return <div><div className="page-intro"><div><h2>Taken & routines</h2><p>Activeer Supabase-login om taken centraal aan echte teamleden toe te wijzen.</p></div></div><div className="card empty-live-state"><strong>Teamcloud nodig</strong><span>Het oude lokale takenbord is vervangen door centrale teamtaken.</span></div></div>;

  return <div className="tasks-v18">
    <div className="page-intro tasks-intro">
      <div><span className="eyebrow">WERKORGANISATIE</span><h2>Taken & routines</h2><p>Eenmalige en terugkerende taken, echte personen en live teampresence.</p></div>
      <div className="button-row"><button className="ghost" onClick={collab.openPresence}>● {activePeople.length} actief</button><button className="primary" onClick={()=>newTask()}>＋ Nieuwe taak</button></div>
    </div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}

    <div className="task-metrics">
      <div className="card"><span>Mijn open taken</span><strong>{myOpenCount}</strong><small>aan jou toegewezen</small></div>
      <div className="card"><span>Vandaag</span><strong>{todayCount}</strong><small>deadline vandaag</small></div>
      <div className={`card ${overdueCount?"danger-card":""}`}><span>Te laat</span><strong>{overdueCount}</strong><small>actie nodig</small></div>
      <div className="card"><span>Terugkerend</span><strong>{recurringCount}</strong><small>actieve routines</small></div>
    </div>

    <div className="task-presence-strip">
      <div><strong>Nu actief</strong><span>Je ziet meteen wie in VLACORA zit en waar die mee bezig is.</span></div>
      <div className="task-presence-people">
        {activePeople.slice(0,8).map(p=><button key={p.key} onClick={collab.openPresence} className={p.moduleSlug==="taken"?"working-on-tasks":""}><span className="task-presence-avatar">{p.initials}<i/></span><span><b>{p.name}{p.isMe?" • jij":""}</b><small>{p.detail}</small></span></button>)}
        {!activePeople.length&&<span className="muted-copy-hint">Nog niemand online zichtbaar.</span>}
      </div>
    </div>

    <div className="task-toolbar-v18">
      <div className="task-filter-tabs">
        <button className={filter==="mine"?"active":""} onClick={()=>setFilter("mine")}>Mijn taken</button>
        <button className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>Iedereen</button>
        <button className={filter==="recurring"?"active":""} onClick={()=>setFilter("recurring")}>↻ Terugkerend</button>
      </div>
      <label className="task-search">⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Zoek taak…"/></label>
      <label className="show-done"><input type="checkbox" checked={showCompleted} onChange={e=>setShowCompleted(e.target.checked)}/> Klaar tonen</label>
      <div className="view-switch"><button className={view==="list"?"active":""} onClick={()=>setView("list")}>☷</button><button className={view==="board"?"active":""} onClick={()=>setView("board")}>▦</button></div>
    </div>

    <div className="task-quick-add"><span>＋</span><input value={quickTitle} disabled={busy} onChange={e=>setQuickTitle(e.target.value)} onKeyDown={e=>e.key==="Enter"&&void quickAdd()} placeholder="Snel een taak voor jezelf toevoegen…"/><button disabled={!quickTitle.trim()||busy} onClick={()=>void quickAdd()}>Toevoegen</button></div>

    {view==="list"?<div className="task-list-v18">
      {filtered.map(task=>{
        const tone=dueTone(task);const assignees=task.assigneeIds.map(member).filter(Boolean) as TaskTeamMember[];
        return <article className={`task-row-v18 ${task.status==="done"?"done":""}`} key={task.id} onClick={()=>openTask(task)}>
          <button className={`task-check ${task.status==="done"?"checked":""}`} disabled={busy} onClick={e=>{e.stopPropagation();void changeStatus(task,task.status==="done"?"todo":"done")}}>{task.status==="done"?"✓":""}</button>
          <span className={`task-priority-dot ${task.priority}`}/>
          <div className="task-main-v18"><strong>{task.title}</strong><span>{task.description||"Geen extra beschrijving"}</span><div>{task.recurrenceKind!=="none"&&<em>↻ {recurrenceLabel(task)}</em>}<em>{statusLabel(task.status)}</em></div></div>
          <div className="task-assignee-stack">{assignees.slice(0,4).map(a=><span title={a.name} key={a.id} className={presenceByUser.has(a.id)?"online":""}>{a.initials}<i/></span>)}{assignees.length>4&&<b>+{assignees.length-4}</b>}{!assignees.length&&<small>Niemand</small>}</div>
          <div className={`task-due-v18 ${tone}`}><strong>{task.dueAt?localDay(task.dueAt):"Geen deadline"}</strong><span>{task.dueAt?localTime(task.dueAt):""}</span></div>
          <span className="task-open-chevron">›</span>
        </article>
      })}
      {!filtered.length&&<div className="card empty-live-state"><strong>Geen taken in deze weergave</strong><span>Maak een taak, pas het filter aan of toon afgeronde taken.</span></div>}
    </div>:<div className="task-board-v18">
      {columns.map(status=><section key={status}><div className="task-board-head"><strong>{statusLabel(status)}</strong><span>{filtered.filter(x=>x.status===status).length}</span></div>
        {filtered.filter(x=>x.status===status).map(task=><button className="task-board-card" key={task.id} onClick={()=>openTask(task)}><span className={`task-priority-line ${task.priority}`}/><strong>{task.title}</strong><small>{task.dueAt?`${localDay(task.dueAt)} • ${localTime(task.dueAt)}`:"Geen deadline"}</small><div className="task-board-foot">{task.recurrenceKind!=="none"&&<em>↻</em>}<span>{task.assigneeIds.map(member).filter(Boolean).slice(0,3).map(a=><b key={(a as TaskTeamMember).id}>{(a as TaskTeamMember).initials}</b>)}</span></div></button>)}
      </section>)}
    </div>}

    {draft&&<div className="task-editor-backdrop" onMouseDown={closeEditor}><aside className="task-editor-v18" onMouseDown={e=>e.stopPropagation()}>
      <div className="task-editor-head"><div><span className="eyebrow">{draft.id.startsWith("new-")?"NIEUWE TAAK":"TAAK"}</span><h2>{draft.title||"Nieuwe taak"}</h2></div><button className="mini-btn" onClick={closeEditor}>×</button></div>
      <div className="task-editor-scroll">
        <label className="field">Titel<input className="input task-title-field" value={draft.title} onChange={e=>patch({title:e.target.value})} placeholder="Wat moet er gebeuren?"/></label>
        <label className="field">Beschrijving<textarea className="input textarea" value={draft.description} onChange={e=>patch({description:e.target.value})} placeholder="Extra info, stappen, links of context…"/></label>

        <div className="task-editor-grid">
          <label className="field">Status<select className="select" value={draft.status} onChange={e=>patch({status:e.target.value as TaskStatus})}><option value="todo">Te doen</option><option value="in_progress">Bezig</option><option value="review">Controle</option><option value="done">Klaar</option></select></label>
          <label className="field">Prioriteit<select className="select" value={draft.priority} onChange={e=>patch({priority:e.target.value as TaskPriority})}><option value="low">Laag</option><option value="normal">Normaal</option><option value="high">Hoog</option><option value="urgent">Dringend</option></select></label>
          <label className="field">Deadline<input className="input" type="datetime-local" value={dueInput(draft.dueAt)} onChange={e=>patch({dueAt:fromDueInput(e.target.value)})}/></label>
        </div>

        <section className="task-editor-section">
          <div className="section-head"><div><h3>Toewijzen aan</h3><p>Meerdere personen kan. Groen bolletje = nu online.</p></div><span className="badge badge-blue">{draft.assigneeIds.length}</span></div>
          <div className="task-person-picker">{team.map(person=>{
            const selected=draft.assigneeIds.includes(person.id),presence=presenceByUser.get(person.id);
            return <button type="button" className={selected?"selected":""} key={person.id} onClick={()=>toggleAssignee(person.id)}><span className="task-person-avatar">{person.initials}{presence&&<i/>}</span><span><strong>{person.name}</strong><small>{presence?presence.detail:person.jobTitle||person.role}</small></span><b>{selected?"✓":"＋"}</b></button>
          })}</div>
        </section>

        <section className="task-editor-section recurrence-editor">
          <div className="section-head"><div><h3>Terugkerende taak</h3><p>Wanneer je deze taak afrondt, maakt VLACORA automatisch de volgende aan.</p></div></div>
          <div className="task-editor-grid">
            <label className="field">Herhalen<select className="select" value={draft.recurrenceKind} onChange={e=>{const recurrenceKind=e.target.value as TaskRecurrence;patch({recurrenceKind,recurrenceConfig:{...draft.recurrenceConfig,weekdays:recurrenceKind==="weekly"&&!(draft.recurrenceConfig.weekdays||[]).length?[new Date(draft.dueAt||Date.now()).getDay()]:draft.recurrenceConfig.weekdays}})}}><option value="none">Niet herhalen</option><option value="daily">Dagelijks</option><option value="weekly">Wekelijks</option><option value="monthly">Maandelijks</option></select></label>
            {draft.recurrenceKind!=="none"&&<label className="field">Elke<input className="input" type="number" min="1" max="52" value={draft.recurrenceInterval} onChange={e=>patch({recurrenceInterval:Math.max(1,Number(e.target.value)||1)})}/><small>{draft.recurrenceKind==="daily"?"dag(en)":draft.recurrenceKind==="weekly"?"week/weken":"maand(en)"}</small></label>}
            {draft.recurrenceKind!=="none"&&<label className="field">Stop na datum<input className="input" type="date" value={draft.recurrenceConfig.until||""} onChange={e=>patch({recurrenceConfig:{...draft.recurrenceConfig,until:e.target.value||null}})}/><small>Leeg = blijft terugkomen</small></label>}
          </div>
          {draft.recurrenceKind==="weekly"&&<div className="weekday-picker">{weekdays.map(day=><button type="button" key={day.v} className={(draft.recurrenceConfig.weekdays||[]).includes(day.v)?"active":""} onClick={()=>toggleWeekday(day.v)}>{day.l}</button>)}</div>}
          {draft.recurrenceKind==="monthly"&&<label className="field monthly-day">Dag van de maand<input className="input" type="number" min="1" max="31" value={draft.recurrenceConfig.dayOfMonth||new Date(draft.dueAt||Date.now()).getDate()} onChange={e=>patch({recurrenceConfig:{...draft.recurrenceConfig,dayOfMonth:Number(e.target.value)}})}/></label>}
          {draft.recurrenceKind!=="none"&&<div className="recurrence-preview">↻ {recurrenceLabel(draft)}</div>}
        </section>

        {!draft.id.startsWith("new-")&&<section className="task-editor-section">
          <div className="section-head"><div><h3>Activiteit & opmerkingen</h3><p>Wie heeft wat aangepast aan deze taak?</p></div></div>
          <div className="task-event-list">{events.map(event=><div key={event.id} className={`task-event event-${event.eventType}`}><span/><div><strong>{event.eventType==="comment"?"Opmerking":event.eventType==="status"?`${event.fromStatus?statusLabel(event.fromStatus as TaskStatus):""} → ${event.toStatus?statusLabel(event.toStatus as TaskStatus):""}`:event.eventType==="created"?"Taak aangemaakt":event.eventType==="recurrence"?"Volgende routine":"Taak bijgewerkt"}</strong><small>{event.authorName} • {new Date(event.createdAt).toLocaleString("nl-BE")}</small>{event.body&&<p>{event.body}</p>}</div></div>)}{!events.length&&<span className="muted-copy-hint">Nog geen activiteiten.</span>}</div>
          <div className="task-comment-box"><textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="Voeg een opmerking toe…"/><button className="ghost" disabled={!comment.trim()} onClick={()=>void addComment()}>Plaats opmerking</button></div>
        </section>}
      </div>
      <div className="task-editor-footer">
        {!draft.id.startsWith("new-")&&<div className="task-delete-menu"><button className="ghost danger-text" onClick={()=>void remove(false)}>Verwijder taak</button>{draft.seriesId&&<button className="ghost danger-text" onClick={()=>void remove(true)}>Verwijder hele reeks</button>}</div>}
        <div className="button-row"><button className="ghost" onClick={closeEditor}>Annuleer</button><button className="primary" disabled={busy||!draft.title.trim()} onClick={()=>void persist()}>{busy?"Opslaan…":"Opslaan"}</button></div>
      </div>
    </aside></div>}
  </div>
}

export function TaskSummaryCard({stationSlug}:{stationSlug:string}){
  const collab=useCollaboration();
  const[count,setCount]=useState<number|null>(null);
  const[mine,setMine]=useState<number|null>(null);

  const load=useCallback(async()=>{
    if(!isSupabaseBrowserConfigured()){setCount(0);setMine(0);return}
    try{
      const rows=await loadTasks(stationSlug);
      setCount(rows.filter(x=>x.status!=="done").length);
      setMine(rows.filter(x=>x.status!=="done"&&x.assigneeIds.includes(collab.currentUser?.id||"")).length);
    }catch{setCount(0);setMine(0)}
  },[stationSlug,collab.currentUser?.id]);

  useEffect(()=>{void load()},[load]);
  useEffect(()=>{
    if(!isSupabaseBrowserConfigured())return;
    const supabase=createClient();
    const channel=supabase.channel(`vlacora-task-summary-${stationSlug}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"hub_tasks"},()=>void load())
      .on("postgres_changes",{event:"*",schema:"public",table:"hub_task_assignees"},()=>void load()).subscribe();
    return()=>{void supabase.removeChannel(channel)};
  },[stationSlug,load]);

  return <div className="card task-summary-card"><span className="metric-label">Open taken</span><strong className="metric">{count==null?"…":count}</strong><span className="muted">{mine==null?"":`${mine} voor jou`}</span></div>;
}
