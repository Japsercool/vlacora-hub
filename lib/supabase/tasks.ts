"use client";

import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";

export type TaskStatus="todo"|"in_progress"|"review"|"done";
export type TaskPriority="low"|"normal"|"high"|"urgent";
export type TaskRecurrence="none"|"daily"|"weekly"|"monthly";

export type TaskTeamMember={
  id:string;
  name:string;
  email:string;
  role:string;
  jobTitle:string;
  initials:string;
  stationMember:boolean;
};

export type HubTask={
  id:string;
  stationSlug:string;
  title:string;
  description:string;
  status:TaskStatus;
  priority:TaskPriority;
  dueAt:string|null;
  recurrenceKind:TaskRecurrence;
  recurrenceInterval:number;
  recurrenceConfig:{weekdays?:number[];dayOfMonth?:number;until?:string|null};
  seriesId:string|null;
  recurrenceIndex:number;
  createdBy:string|null;
  completedBy:string|null;
  createdAt:string;
  updatedAt:string;
  completedAt:string|null;
  assigneeIds:string[];
};

export type TaskEvent={
  id:string;
  taskId:string;
  eventType:"created"|"updated"|"status"|"assignment"|"comment"|"recurrence";
  body:string;
  fromStatus:string|null;
  toStatus:string|null;
  createdBy:string|null;
  authorName:string;
  createdAt:string;
};

export type TaskDraft={
  id:string;
  stationSlug:string;
  title:string;
  description:string;
  status:TaskStatus;
  priority:TaskPriority;
  dueAt:string|null;
  recurrenceKind:TaskRecurrence;
  recurrenceInterval:number;
  recurrenceConfig:{weekdays?:number[];dayOfMonth?:number;until?:string|null};
  seriesId:string|null;
  recurrenceIndex:number;
  assigneeIds:string[];
};

const uid=()=>typeof crypto!=="undefined"&&"randomUUID" in crypto?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
const initials=(name:string)=>(name||"V").split(/\s+/).filter(Boolean).map(x=>x[0]).slice(0,2).join("").toUpperCase()||"V";

function mapTask(row:any,assigneeIds:string[]=[]):HubTask{
  return{
    id:String(row.id),
    stationSlug:String(row.station_slug||"all"),
    title:String(row.title||"Taak"),
    description:String(row.description||""),
    status:(["todo","in_progress","review","done"].includes(String(row.status))?row.status:"todo") as TaskStatus,
    priority:(["low","normal","high","urgent"].includes(String(row.priority))?row.priority:"normal") as TaskPriority,
    dueAt:row.due_at?String(row.due_at):null,
    recurrenceKind:(["none","daily","weekly","monthly"].includes(String(row.recurrence_kind))?row.recurrence_kind:"none") as TaskRecurrence,
    recurrenceInterval:Math.max(1,Number(row.recurrence_interval||1)),
    recurrenceConfig:row.recurrence_config&&typeof row.recurrence_config==="object"?row.recurrence_config:{},
    seriesId:row.series_id?String(row.series_id):null,
    recurrenceIndex:Number(row.recurrence_index||0),
    createdBy:row.created_by?String(row.created_by):null,
    completedBy:row.completed_by?String(row.completed_by):null,
    createdAt:String(row.created_at||new Date().toISOString()),
    updatedAt:String(row.updated_at||new Date().toISOString()),
    completedAt:row.completed_at?String(row.completed_at):null,
    assigneeIds
  };
}

async function currentUserId(){
  if(!isSupabaseBrowserConfigured())return null;
  const{data}=await createClient().auth.getUser();
  return data.user?.id||null;
}

export async function loadTaskTeam(stationSlug:string):Promise<TaskTeamMember[]>{
  if(!isSupabaseBrowserConfigured())return[];
  const supabase=createClient();
  const[{data:profiles,error:profileError},{data:memberships,error:membershipError}]=await Promise.all([
    supabase.from("profiles").select("id,display_name,email,role,job_title,active").eq("active",true).order("display_name"),
    supabase.from("station_memberships").select("user_id,station_slug,active").eq("active",true)
  ]);
  if(profileError)throw profileError;
  if(membershipError)throw membershipError;

  const stationMemberships=(memberships||[]).filter((m:any)=>String(m.station_slug)===stationSlug);
  const hasScopedMembers=stationSlug!=="all"&&stationMemberships.length>0;
  const stationIds=new Set(stationMemberships.map((m:any)=>String(m.user_id)));

  return(profiles||[])
    .filter((p:any)=>{
      const role=String(p.role||"").toLowerCase();
      return stationSlug==="all"||role==="superadmin"||!hasScopedMembers||stationIds.has(String(p.id));
    })
    .map((p:any)=>({
      id:String(p.id),
      name:String(p.display_name||p.email||"Teamlid"),
      email:String(p.email||""),
      role:String(p.role||"team"),
      jobTitle:String(p.job_title||""),
      initials:initials(String(p.display_name||p.email||"T")),
      stationMember:stationSlug==="all"||stationIds.has(String(p.id))||String(p.role||"").toLowerCase()==="superadmin"
    }));
}

export async function loadTasks(stationSlug:string):Promise<HubTask[]>{
  if(!isSupabaseBrowserConfigured())return[];
  const supabase=createClient();
  let query=supabase.from("hub_tasks").select("*").order("status").order("due_at",{ascending:true,nullsFirst:false}).order("created_at",{ascending:false});
  if(stationSlug!=="all")query=query.eq("station_slug",stationSlug);
  const{data:rows,error}=await query;
  if(error)throw error;
  const ids=(rows||[]).map((x:any)=>String(x.id));
  if(!ids.length)return[];
  const{data:assignees,error:assigneeError}=await supabase.from("hub_task_assignees").select("task_id,user_id").in("task_id",ids);
  if(assigneeError)throw assigneeError;
  const byTask=new Map<string,string[]>();
  for(const a of assignees||[]){
    const id=String((a as any).task_id),list=byTask.get(id)||[];
    list.push(String((a as any).user_id));byTask.set(id,list);
  }
  return(rows||[]).map((row:any)=>mapTask(row,byTask.get(String(row.id))||[]));
}

export async function loadTaskEvents(taskId:string):Promise<TaskEvent[]>{
  if(!isSupabaseBrowserConfigured()||!taskId||taskId.startsWith("new-"))return[];
  const supabase=createClient();
  const{data:rows,error}=await supabase.from("hub_task_events").select("*").eq("task_id",taskId).order("created_at",{ascending:true});
  if(error)throw error;
  const userIds=[...new Set((rows||[]).map((x:any)=>x.created_by).filter(Boolean).map(String))];
  let names=new Map<string,string>();
  if(userIds.length){
    const{data:profiles}=await supabase.from("profiles").select("id,display_name").in("id",userIds);
    names=new Map((profiles||[]).map((p:any)=>[String(p.id),String(p.display_name||"Teamlid")]));
  }
  return(rows||[]).map((row:any)=>({
    id:String(row.id),taskId:String(row.task_id),eventType:String(row.event_type) as TaskEvent["eventType"],
    body:String(row.body||""),fromStatus:row.from_status?String(row.from_status):null,toStatus:row.to_status?String(row.to_status):null,
    createdBy:row.created_by?String(row.created_by):null,authorName:row.created_by?names.get(String(row.created_by))||"Teamlid":"Systeem",
    createdAt:String(row.created_at)
  }));
}

async function replaceAssignees(taskId:string,assigneeIds:string[],actorId:string|null){
  const supabase=createClient();
  const{error:deleteError}=await supabase.from("hub_task_assignees").delete().eq("task_id",taskId);
  if(deleteError)throw deleteError;
  if(!assigneeIds.length)return;
  const rows=[...new Set(assigneeIds)].map(userId=>({task_id:taskId,user_id:userId,assigned_by:actorId}));
  const{error}=await supabase.from("hub_task_assignees").insert(rows);
  if(error)throw error;
}

export async function addTaskEvent(taskId:string,eventType:TaskEvent["eventType"],body="",fromStatus:string|null=null,toStatus:string|null=null){
  if(!isSupabaseBrowserConfigured()||taskId.startsWith("new-"))return;
  const actor=await currentUserId();
  if(!actor)return;
  const{error}=await createClient().from("hub_task_events").insert({
    task_id:taskId,event_type:eventType,body:body.trim(),from_status:fromStatus,to_status:toStatus,created_by:actor
  });
  if(error)throw error;
}

export async function saveTask(draft:TaskDraft):Promise<HubTask>{
  if(!isSupabaseBrowserConfigured())throw new Error("Supabase is niet actief.");
  const supabase=createClient();
  const actor=await currentUserId();if(!actor)throw new Error("Log opnieuw in.");
  const isNew=draft.id.startsWith("new-");
  const recurring=draft.recurrenceKind!=="none";
  const seriesId=recurring?(draft.seriesId||uid()):null;
  const payload={
    station_slug:draft.stationSlug,
    title:draft.title.trim(),
    description:draft.description.trim(),
    status:draft.status,
    priority:draft.priority,
    due_at:draft.dueAt||null,
    recurrence_kind:draft.recurrenceKind,
    recurrence_interval:Math.max(1,draft.recurrenceInterval||1),
    recurrence_config:draft.recurrenceConfig||{},
    series_id:seriesId,
    recurrence_index:draft.recurrenceIndex||0,
    updated_at:new Date().toISOString()
  };
  if(!payload.title)throw new Error("Geef de taak een titel.");
  if(recurring&&!payload.due_at)throw new Error("Een terugkerende taak heeft een eerste deadline nodig.");

  let row:any;
  if(isNew){
    const{data,error}=await supabase.from("hub_tasks").insert({...payload,created_by:actor}).select("*").single();
    if(error)throw error;row=data;
    await replaceAssignees(String(row.id),draft.assigneeIds,actor);
    await addTaskEvent(String(row.id),"created","Taak aangemaakt");
  }else{
    const{data,error}=await supabase.from("hub_tasks").update(payload).eq("id",draft.id).select("*").single();
    if(error)throw error;row=data;
    await replaceAssignees(draft.id,draft.assigneeIds,actor);
    await addTaskEvent(draft.id,"updated","Taak bijgewerkt");
  }
  return mapTask(row,[...new Set(draft.assigneeIds)]);
}

function addDays(date:Date,days:number){const d=new Date(date);d.setDate(d.getDate()+days);return d}
function startOfWeekMonday(date:Date){const d=new Date(date);const day=(d.getDay()+6)%7;d.setHours(0,0,0,0);d.setDate(d.getDate()-day);return d}
function daysBetween(a:Date,b:Date){return Math.floor((b.getTime()-a.getTime())/86400000)}
function nextMonthly(base:Date,interval:number,day:number){
  const candidate=new Date(base);
  candidate.setDate(1);candidate.setMonth(candidate.getMonth()+interval);
  const end=new Date(candidate.getFullYear(),candidate.getMonth()+1,0).getDate();
  candidate.setDate(Math.min(Math.max(1,day),end));
  return candidate;
}
function nextDue(task:HubTask){
  if(task.recurrenceKind==="none"||!task.dueAt)return null;
  const base=new Date(task.dueAt);if(Number.isNaN(base.getTime()))return null;
  const interval=Math.max(1,task.recurrenceInterval||1);
  let next:Date;
  if(task.recurrenceKind==="daily")next=addDays(base,interval);
  else if(task.recurrenceKind==="monthly"){
    const day=Number(task.recurrenceConfig.dayOfMonth||base.getDate());
    next=nextMonthly(base,interval,day);
  }else{
    const weekdays=(task.recurrenceConfig.weekdays||[base.getDay()]).map(Number);
    const baseWeek=startOfWeekMonday(base);
    let found:Date|null=null;
    for(let delta=1;delta<=370;delta++){
      const candidate=addDays(base,delta);
      const weekDiff=Math.floor(daysBetween(baseWeek,startOfWeekMonday(candidate))/7);
      if(weekDiff%interval===0&&weekdays.includes(candidate.getDay())){found=candidate;break}
    }
    next=found||addDays(base,7*interval);
  }
  const until=task.recurrenceConfig.until;
  if(until){
    const end=new Date(`${until}T23:59:59`);
    if(next>end)return null;
  }
  return next.toISOString();
}

async function createNextOccurrence(task:HubTask,actorId:string){
  const due=nextDue(task);if(!due||!task.seriesId)return null;
  const supabase=createClient();
  const nextIndex=task.recurrenceIndex+1;
  const{data:existing}=await supabase.from("hub_tasks").select("id").eq("series_id",task.seriesId).eq("recurrence_index",nextIndex).maybeSingle();
  if(existing?.id)return String(existing.id);
  const{data,error}=await supabase.from("hub_tasks").insert({
    station_slug:task.stationSlug,title:task.title,description:task.description,status:"todo",priority:task.priority,due_at:due,
    recurrence_kind:task.recurrenceKind,recurrence_interval:task.recurrenceInterval,recurrence_config:task.recurrenceConfig,
    series_id:task.seriesId,recurrence_index:nextIndex,created_by:actorId,updated_at:new Date().toISOString()
  }).select("id").single();
  if(error){
    if((error as any).code==="23505")return null;
    throw error;
  }
  const id=String(data.id);
  await replaceAssignees(id,task.assigneeIds,actorId);
  await addTaskEvent(id,"recurrence",`Automatisch aangemaakt uit terugkerende taak #${task.recurrenceIndex+1}`);
  return id;
}

export async function setTaskStatus(task:HubTask,status:TaskStatus){
  if(!isSupabaseBrowserConfigured())throw new Error("Supabase is niet actief.");
  const actor=await currentUserId();if(!actor)throw new Error("Log opnieuw in.");
  const completing=status==="done";
  const payload={
    status,
    completed_at:completing?new Date().toISOString():null,
    completed_by:completing?actor:null,
    updated_at:new Date().toISOString()
  };
  const{data,error}=await createClient().from("hub_tasks").update(payload).eq("id",task.id).select("*").single();
  if(error)throw error;
  await addTaskEvent(task.id,"status","",task.status,status);
  let nextId:string|null=null;
  if(completing&&task.status!=="done"&&task.recurrenceKind!=="none")nextId=await createNextOccurrence(task,actor);
  return{task:mapTask(data,task.assigneeIds),nextId};
}

export async function addTaskComment(taskId:string,body:string){
  if(!body.trim())return;
  await addTaskEvent(taskId,"comment",body);
}

export async function deleteTask(task:HubTask,wholeSeries=false){
  if(!isSupabaseBrowserConfigured())throw new Error("Supabase is niet actief.");
  const supabase=createClient();
  let query=supabase.from("hub_tasks").delete();
  query=wholeSeries&&task.seriesId?query.eq("series_id",task.seriesId):query.eq("id",task.id);
  const{error}=await query;if(error)throw error;
}

export function newTaskDraft(stationSlug:string,currentUserId?:string|null):TaskDraft{
  return{
    id:`new-${Date.now()}`,stationSlug,title:"",description:"",status:"todo",priority:"normal",dueAt:null,
    recurrenceKind:"none",recurrenceInterval:1,recurrenceConfig:{weekdays:[]},seriesId:null,recurrenceIndex:0,
    assigneeIds:currentUserId?[currentUserId]:[]
  };
}
