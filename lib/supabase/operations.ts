"use client";

import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";

export type TeamPerson={
  id:string;name:string;email:string;role:string;jobTitle:string;phone:string;initials:string;avatarUrl:string;stations:string[];
};
export type StationProgram={
  id:string;stationSlug:string;day:number;start:string;end:string;name:string;host:string;format:string;notes:string;active:boolean;
};
export type ProgramProfile={
  programId:string;stationSlug:string;summary:string;studioInfo:string;jingleNotes:string;
  fixedItems:string[];documentLinks:Array<{label:string;url:string}>;
  editorialTemplateIds:string[];socialTemplateIds:string[];coverUrl:string;
};
export type ProgramTeamMember={programId:string;userId:string;role:string;isPrimary:boolean;name?:string;initials?:string;avatarUrl?:string};
export type Absence={
  id:string;stationSlug:string;userId:string;userName:string;userAvatarUrl:string;startsOn:string;endsOn:string;reason:string;notes:string;status:"requested"|"approved"|"cancelled";
  createdBy:string|null;createdAt:string;updatedAt:string;
  coverages:AbsenceCoverage[];
  openTasks:number;
};
export type AbsenceCoverage={
  id:string;absenceId:string;programId:string;programName:string;airDate:string;replacementUserId:string|null;replacementName:string;
  status:"unassigned"|"asked"|"confirmed"|"declined";coverageMode:"required"|"optional";notes:string;
};
export type ExternalContact={
  id:string;stationSlug:string;category:string;name:string;company:string;roleTitle:string;email:string;phone:string;emergency:boolean;visibility:"team"|"management";notes:string;
};
export type ContentItem={
  id:string;stationSlug:string;contentType:string;title:string;description:string;status:"new"|"reviewing"|"planned"|"used"|"rejected";
  targetProgramId:string|null;targetProgramName:string;submittedBy:string;submittedByName:string;assignedTo:string|null;assignedToName:string;
  scheduledFor:string|null;teamNote:string;createdAt:string;updatedAt:string;
};
export type OperationalWarning={
  warningKey:string;stationSlug:string;code:string;severity:"info"|"warning"|"critical";title:string;body:string;
  status:"open"|"resolved"|"ignored";actionPath:string;source:string;firstSeenAt:string;lastSeenAt:string;resolvedAt:string|null;
};
export type PresenterDashboardData={
  program:StationProgram|null;nextProgram:StationProgram|null;profile:ProgramProfile|null;team:ProgramTeamMember[];
  requiredTalks:number;sponsorTalks:number;promos:number;trafficMoments:Array<{time:string;title:string;ready:boolean}>;
  importantMessages:number;messages:Array<{id:string;title:string;body:string;category:string;actionPath:string}>;
  studioInfo:string;editorialReady:boolean;editorialItems:number;
  tasks:Array<{id:string;title:string;dueAt:string|null;priority:string}>;
  warnings:OperationalWarning[];
};
export type SearchResult={
  id:string;kind:string;title:string;subtitle:string;path:string;stationSlug:string;score:number;
};

const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
const initials=(name:string)=>(name||"T").split(/\s+/).filter(Boolean).map(x=>x[0]).slice(0,2).join("").toUpperCase()||"T";
const localDate=(d=new Date())=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Brussels",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
const weekdayIndex=(date:Date)=>{const d=Number(new Intl.DateTimeFormat("en-US",{timeZone:"Europe/Brussels",weekday:"short"}).formatToParts(date).find(x=>x.type==="weekday")?.value?date.getDay():date.getDay());return(d+6)%7};
function dateRange(start:string,end:string){
  const out:string[]=[];const d=new Date(`${start}T12:00:00`),last=new Date(`${end}T12:00:00`);
  for(let guard=0;d<=last&&guard<370;guard++,d.setDate(d.getDate()+1))out.push(localDate(d));
  return out;
}
function timeToMinutes(v:string){const [h,m]=String(v||"00:00").split(":").map(Number);return(h||0)*60+(m||0)}
function todayMinutes(){
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Brussels",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date()).split(":").map(Number);
  return(parts[0]||0)*60+(parts[1]||0);
}
async function currentUserId(){
  if(!isSupabaseBrowserConfigured())return null;
  const{data}=await createClient().auth.getUser();return data.user?.id||null;
}
function stationFilter<T extends {eq:(col:string,val:any)=>T}>(q:T,stationSlug:string){
  return stationSlug==="all"?q:q.eq("station_slug",stationSlug);
}

export async function loadTeamPeople(stationSlug:string):Promise<TeamPerson[]>{
  if(!isSupabaseBrowserConfigured())return[];
  const supabase=createClient();
  const[{data:profiles,error:pErr},{data:memberships,error:mErr}]=await Promise.all([
    supabase.from("profiles").select("id,display_name,email,role,job_title,phone,avatar_url,active").eq("active",true).order("display_name"),
    supabase.from("station_memberships").select("user_id,station_slug,active").eq("active",true)
  ]);
  if(pErr)throw pErr;if(mErr)throw mErr;
  const byUser=new Map<string,string[]>();
  for(const row of memberships||[]){
    const id=String((row as any).user_id),list=byUser.get(id)||[];list.push(String((row as any).station_slug));byUser.set(id,list);
  }
  const scoped=new Set((memberships||[]).filter((r:any)=>String(r.station_slug)===stationSlug&&r.active).map((r:any)=>String(r.user_id)));
  const hasScoped=stationSlug!=="all"&&scoped.size>0;
  return(profiles||[]).filter((p:any)=>stationSlug==="all"||String(p.role).toLowerCase()==="superadmin"||!hasScoped||scoped.has(String(p.id))).map((p:any)=>{
    const name=String(p.display_name||p.email||"Teamlid");
    return{id:String(p.id),name,email:String(p.email||""),role:String(p.role||""),jobTitle:String(p.job_title||""),phone:String(p.phone||""),initials:initials(name),avatarUrl:String(p.avatar_url||""),stations:byUser.get(String(p.id))||[]};
  });
}

export async function loadPrograms(stationSlug:string):Promise<StationProgram[]>{
  if(!isSupabaseBrowserConfigured())return[];
  let q=createClient().from("station_programs").select("id,station_slug,day,start_time,end_time,name,host,format,notes,active").order("day").order("start_time");
  if(stationSlug!=="all")q=q.eq("station_slug",stationSlug);
  const{data,error}=await q;if(error)throw error;
  return(data||[]).map((r:any)=>({id:String(r.id),stationSlug:String(r.station_slug),day:Number(r.day),start:String(r.start_time||"").slice(0,5),end:String(r.end_time||"").slice(0,5),name:String(r.name||""),host:String(r.host||""),format:String(r.format||""),notes:String(r.notes||""),active:Boolean(r.active)}));
}
function mapProgramProfile(r:any,program?:StationProgram):ProgramProfile{
  return{programId:String(r?.program_id||program?.id||""),stationSlug:String(r?.station_slug||program?.stationSlug||""),
    summary:String(r?.summary||""),studioInfo:String(r?.studio_info||""),jingleNotes:String(r?.jingle_notes||""),
    fixedItems:Array.isArray(r?.fixed_items)?r.fixed_items.map(String):[],
    documentLinks:Array.isArray(r?.document_links)?r.document_links.map((x:any)=>({label:String(x?.label||"Document"),url:String(x?.url||"")})):[],
    editorialTemplateIds:Array.isArray(r?.editorial_template_ids)?r.editorial_template_ids.map(String):[],
    socialTemplateIds:Array.isArray(r?.social_template_ids)?r.social_template_ids.map(String):[],
    coverUrl:String(r?.cover_url||"")};
}
export async function loadProgramProfile(program:StationProgram):Promise<ProgramProfile>{
  if(!isSupabaseBrowserConfigured())return mapProgramProfile(null,program);
  const{data,error}=await createClient().from("hub_program_profiles").select("*").eq("program_id",program.id).maybeSingle();
  if(error)throw error;return mapProgramProfile(data,program);
}
export async function saveProgramProfile(program:StationProgram,profile:ProgramProfile){
  const userId=await currentUserId();if(!userId)throw new Error("Log opnieuw in.");
  const payload={program_id:program.id,station_slug:program.stationSlug,summary:profile.summary,studio_info:profile.studioInfo,jingle_notes:profile.jingleNotes,
    fixed_items:profile.fixedItems,document_links:profile.documentLinks,editorial_template_ids:profile.editorialTemplateIds,social_template_ids:profile.socialTemplateIds,cover_url:profile.coverUrl||"",
    updated_by:userId,updated_at:new Date().toISOString()};
  const{data,error}=await createClient().from("hub_program_profiles").upsert({...payload,created_by:userId},{onConflict:"program_id"}).select("*").single();
  if(error)throw error;return mapProgramProfile(data,program);
}
export async function loadProgramTeam(programId:string):Promise<ProgramTeamMember[]>{
  if(!programId||!isSupabaseBrowserConfigured())return[];
  const supabase=createClient();
  const{data:rows,error}=await supabase.from("hub_program_team").select("program_id,user_id,role,is_primary").eq("program_id",programId);
  if(error)throw error;
  const ids=(rows||[]).map((r:any)=>String(r.user_id));
  const names=new Map<string,{name:string;initials:string;avatarUrl:string}>();
  if(ids.length){
    const{data:profiles}=await supabase.from("profiles").select("id,display_name,email,avatar_url").in("id",ids);
    for(const p of profiles||[]){const name=String((p as any).display_name||(p as any).email||"Teamlid");names.set(String((p as any).id),{name,initials:initials(name),avatarUrl:String((p as any).avatar_url||"")})}
  }
  return(rows||[]).map((r:any)=>({programId:String(r.program_id),userId:String(r.user_id),role:String(r.role||"presentator"),isPrimary:Boolean(r.is_primary),name:names.get(String(r.user_id))?.name||"Teamlid",initials:names.get(String(r.user_id))?.initials||"T",avatarUrl:names.get(String(r.user_id))?.avatarUrl||""}));
}
export async function loadProgramTeamAssignments(programIds:string[]):Promise<Record<string,ProgramTeamMember[]>>{
  const ids=[...new Set(programIds.filter(Boolean))];
  if(!ids.length||!isSupabaseBrowserConfigured())return{};
  const supabase=createClient();
  const{data:rows,error}=await supabase.from("hub_program_team").select("program_id,user_id,role,is_primary").in("program_id",ids);
  if(error)throw error;
  const userIds=[...new Set((rows||[]).map((r:any)=>String(r.user_id)))];
  const names=new Map<string,{name:string;initials:string;avatarUrl:string}>();
  if(userIds.length){
    const{data:profiles}=await supabase.from("profiles").select("id,display_name,email,avatar_url").in("id",userIds);
    for(const profile of profiles||[]){
      const name=String((profile as any).display_name||(profile as any).email||"Teamlid");
      names.set(String((profile as any).id),{name,initials:initials(name),avatarUrl:String((profile as any).avatar_url||"")});
    }
  }
  const result:Record<string,ProgramTeamMember[]>={};
  for(const row of rows||[]){
    const programId=String((row as any).program_id),userId=String((row as any).user_id),person=names.get(userId);
    (result[programId] ||= []).push({programId,userId,role:String((row as any).role||"presentator"),isPrimary:Boolean((row as any).is_primary),name:person?.name||"Teamlid",initials:person?.initials||"T",avatarUrl:person?.avatarUrl||""});
  }
  for(const programId of Object.keys(result))result[programId].sort((a,b)=>Number(b.isPrimary)-Number(a.isPrimary)||(a.name||"").localeCompare(b.name||""));
  return result;
}
export async function saveProgramTeam(programId:string,members:Array<{userId:string;role:string;isPrimary:boolean}>){
  const supabase=createClient();
  const{error:del}=await supabase.from("hub_program_team").delete().eq("program_id",programId);if(del)throw del;
  if(members.length){
    const{error}=await supabase.from("hub_program_team").insert(members.map(m=>({program_id:programId,user_id:m.userId,role:m.role,is_primary:m.isPrimary})));
    if(error)throw error;
  }
  return loadProgramTeam(programId);
}

export async function createAbsence(input:{stationSlug:string;userId:string;startsOn:string;endsOn:string;reason:string;notes:string}){
  const actor=await currentUserId();if(!actor)throw new Error("Log opnieuw in.");
  const supabase=createClient();
  const{data,error}=await supabase.from("hub_absences").insert({station_slug:input.stationSlug,user_id:input.userId,starts_on:input.startsOn,ends_on:input.endsOn,reason:input.reason,notes:input.notes,status:"approved",created_by:actor}).select("*").single();
  if(error)throw error;
  await rebuildAbsenceCoverage(String(data.id));
  return String(data.id);
}
export async function rebuildAbsenceCoverage(absenceId:string){
  const supabase=createClient();
  const{data:absence,error}=await supabase.from("hub_absences").select("*").eq("id",absenceId).single();if(error)throw error;
  const stationSlug=String(absence.station_slug),userId=String(absence.user_id);
  const[programs,team,{data:profile}]=await Promise.all([
    loadPrograms(stationSlug),
    supabase.from("hub_program_team").select("program_id,user_id").eq("user_id",userId).then((x:any)=>x.data||[]),
    supabase.from("profiles").select("display_name,email").eq("id",userId).maybeSingle()
  ]);
  const programIds=new Set((team||[]).map((x:any)=>String(x.program_id)));
  const {data:allTeam}=programIds.size?await supabase.from("hub_program_team").select("program_id,user_id").in("program_id",[...programIds]):{data:[] as any[]};
  const teamCount=new Map<string,number>();
  for(const member of allTeam||[]){const pid=String((member as any).program_id);teamCount.set(pid,(teamCount.get(pid)||0)+1)}
  const name=String((profile as any)?.display_name||(profile as any)?.email||"").toLowerCase();
  const rows:any[]=[];
  for(const date of dateRange(String(absence.starts_on),String(absence.ends_on))){
    const js=new Date(`${date}T12:00:00`),day=(js.getDay()+6)%7;
    for(const program of programs.filter(p=>p.active&&p.day===day)){
      const hostMatch=name&&program.host.toLowerCase().includes(name.split(" ")[0]);
      if(programIds.has(program.id)||hostMatch){
        const coverageMode=programIds.has(program.id)&&(teamCount.get(program.id)||1)>1?"optional":"required";
        rows.push({absence_id:absenceId,program_id:program.id,air_date:date,status:"unassigned",coverage_mode:coverageMode});
      }
    }
  }
  await supabase.from("hub_absence_coverages").delete().eq("absence_id",absenceId);
  if(rows.length){const{error:e}=await supabase.from("hub_absence_coverages").insert(rows);if(e)throw e}
}
export async function updateAbsenceCoverage(id:string,patch:{replacementUserId?:string|null;status?:AbsenceCoverage["status"];notes?:string}){
  const actor=await currentUserId();
  const payload:any={updated_by:actor,updated_at:new Date().toISOString()};
  if(patch.replacementUserId!==undefined)payload.replacement_user_id=patch.replacementUserId;
  if(patch.status!==undefined)payload.status=patch.status;
  if(patch.notes!==undefined)payload.notes=patch.notes;
  const{error}=await createClient().from("hub_absence_coverages").update(payload).eq("id",id);if(error)throw error;
}
export async function deleteAbsence(id:string){const{error}=await createClient().from("hub_absences").delete().eq("id",id);if(error)throw error}

export async function loadAbsences(stationSlug:string):Promise<Absence[]>{
  if(!isSupabaseBrowserConfigured())return[];
  const supabase=createClient();
  let q=supabase.from("hub_absences").select("*").order("starts_on",{ascending:true}).order("created_at",{ascending:false});
  if(stationSlug!=="all")q=q.eq("station_slug",stationSlug);
  const{data:rows,error}=await q;if(error)throw error;
  if(!(rows||[]).length)return[];
  const absIds=(rows||[]).map((x:any)=>String(x.id)),userIds=[...new Set((rows||[]).map((x:any)=>String(x.user_id)))];
  const[{data:profiles},{data:coverages},{data:programs},{data:taskAssignees},{data:tasks}]=await Promise.all([
    supabase.from("profiles").select("id,display_name,email,avatar_url").in("id",userIds),
    supabase.from("hub_absence_coverages").select("*").in("absence_id",absIds).order("air_date"),
    supabase.from("station_programs").select("id,name"),
    supabase.from("hub_task_assignees").select("task_id,user_id").in("user_id",userIds),
    supabase.from("hub_tasks").select("id,status,due_at")
  ]);
  const names=new Map<string,string>((profiles||[]).map((x:any)=>[String(x.id),String(x.display_name||x.email||"Teamlid")]));
  const avatars=new Map<string,string>((profiles||[]).map((x:any)=>[String(x.id),String(x.avatar_url||"")]));
  const programNames=new Map<string,string>((programs||[]).map((x:any)=>[String(x.id),String(x.name||"Programma")]));
  const replacementIds=[...new Set((coverages||[]).map((x:any)=>x.replacement_user_id).filter(Boolean).map(String))];
  if(replacementIds.length){
    const{data:rprofiles}=await supabase.from("profiles").select("id,display_name,email").in("id",replacementIds);
    for(const x of rprofiles||[])names.set(String((x as any).id),String((x as any).display_name||(x as any).email||"Teamlid"));
  }
  const taskById=new Map<string,any>((tasks||[]).map((x:any)=>[String(x.id),x]));
  const openTaskCount=new Map<string,number>();
  for(const a of taskAssignees||[]){
    const task=taskById.get(String((a as any).task_id));
    if(task&&!["done","cancelled"].includes(String(task.status))){const id=String((a as any).user_id);openTaskCount.set(id,(openTaskCount.get(id)||0)+1)}
  }
  const covByAbs=new Map<string,AbsenceCoverage[]>();
  for(const c of coverages||[]){
    const id=String((c as any).absence_id),list=covByAbs.get(id)||[];
    list.push({id:String((c as any).id),absenceId:id,programId:String((c as any).program_id),programName:programNames.get(String((c as any).program_id))||"Programma",airDate:String((c as any).air_date),replacementUserId:(c as any).replacement_user_id?String((c as any).replacement_user_id):null,replacementName:(c as any).replacement_user_id?names.get(String((c as any).replacement_user_id))||"Teamlid":"",status:String((c as any).status) as AbsenceCoverage["status"],coverageMode:String((c as any).coverage_mode||"required") as AbsenceCoverage["coverageMode"],notes:String((c as any).notes||"")});
    covByAbs.set(id,list);
  }
  return(rows||[]).map((r:any)=>({id:String(r.id),stationSlug:String(r.station_slug),userId:String(r.user_id),userName:names.get(String(r.user_id))||"Teamlid",userAvatarUrl:avatars.get(String(r.user_id))||"",startsOn:String(r.starts_on),endsOn:String(r.ends_on),reason:String(r.reason||""),notes:String(r.notes||""),status:String(r.status) as Absence["status"],createdBy:r.created_by?String(r.created_by):null,createdAt:String(r.created_at),updatedAt:String(r.updated_at),coverages:covByAbs.get(String(r.id))||[],openTasks:openTaskCount.get(String(r.user_id))||0}));
}

export type ProgramOverride={id:string;stationSlug:string;programId:string;programName:string;airDate:string;status:"needs_replacement"|"can_run"|"covered"|"cancelled";originalUserId:string|null;originalName:string;replacementUserId:string|null;replacementName:string;notes:string};
export async function loadProgramOverrides(stationSlug:string,fromDate:string,toDate:string):Promise<ProgramOverride[]>{
  if(!isSupabaseBrowserConfigured()||stationSlug==="all")return[];
  const supabase=createClient();
  const {data:rows,error}=await supabase.from("hub_program_overrides").select("*").eq("station_slug",stationSlug).gte("air_date",fromDate).lte("air_date",toDate).order("air_date");if(error)throw error;
  const pids=[...new Set((rows||[]).map((x:any)=>String(x.program_id)))],uids=[...new Set((rows||[]).flatMap((x:any)=>[x.original_user_id,x.replacement_user_id]).filter(Boolean).map(String))];
  const[{data:programs},{data:profiles}]=await Promise.all([pids.length?supabase.from("station_programs").select("id,name").in("id",pids):Promise.resolve({data:[]} as any),uids.length?supabase.from("profiles").select("id,display_name,email").in("id",uids):Promise.resolve({data:[]} as any)]);
  const pn=new Map<string,string>((programs||[]).map((x:any)=>[String(x.id),String(x.name||"Programma")]));const un=new Map<string,string>((profiles||[]).map((x:any)=>[String(x.id),String(x.display_name||x.email||"Teamlid")]));
  return(rows||[]).map((r:any)=>({id:String(r.id),stationSlug:String(r.station_slug),programId:String(r.program_id),programName:pn.get(String(r.program_id))||"Programma",airDate:String(r.air_date),status:String(r.status) as ProgramOverride["status"],originalUserId:r.original_user_id?String(r.original_user_id):null,originalName:r.original_user_id?un.get(String(r.original_user_id))||"Teamlid":"",replacementUserId:r.replacement_user_id?String(r.replacement_user_id):null,replacementName:r.replacement_user_id?un.get(String(r.replacement_user_id))||"Teamlid":"",notes:String(r.notes||"")}));
}
export async function uploadProfileAvatar(targetUserId:string,file:File):Promise<string>{
  if(!isSupabaseBrowserConfigured())throw new Error("Supabase is niet actief.");
  if(!file.type.startsWith("image/"))throw new Error("Kies een afbeelding.");
  if(file.size>5*1024*1024)throw new Error("Foto is groter dan 5 MB.");
  const supabase=createClient();const ext=(file.name.split(".").pop()||"jpg").replace(/[^a-z0-9]/gi,"").toLowerCase()||"jpg";const path=`${targetUserId}/avatar-${Date.now()}.${ext}`;
  const {error}=await supabase.storage.from("vlacora-profile-photos").upload(path,file,{upsert:true,contentType:file.type});if(error)throw error;
  const {data}=supabase.storage.from("vlacora-profile-photos").getPublicUrl(path);const url=data.publicUrl;
  const {error:rpcError}=await supabase.rpc("vlacora_set_profile_avatar",{target_user_id:targetUserId,p_avatar_url:url});if(rpcError)throw rpcError;return url;
}

export async function uploadProgramCover(program:StationProgram,file:File):Promise<string>{
  if(!isSupabaseBrowserConfigured())throw new Error("Supabase is niet actief.");
  if(!file.type.startsWith("image/"))throw new Error("Kies een afbeelding.");
  if(file.size>8*1024*1024)throw new Error("Programmafoto is groter dan 8 MB.");
  const supabase=createClient();const{data:u}=await supabase.auth.getUser();const userId=u.user?.id;if(!userId)throw new Error("Log opnieuw in.");
  const ext=(file.name.split(".").pop()||"jpg").replace(/[^a-z0-9]/gi,"").toLowerCase()||"jpg";
  const safeProgram=program.id.replace(/[^a-zA-Z0-9_-]+/g,"-").slice(0,80);
  const path=`${program.stationSlug}/${userId}/${safeProgram}-${Date.now()}.${ext}`;
  const{error}=await supabase.storage.from("vlacora-program-assets").upload(path,file,{upsert:false,contentType:file.type});if(error)throw error;
  const{data}=supabase.storage.from("vlacora-program-assets").getPublicUrl(path);return data.publicUrl;
}

export async function loadExternalContacts(stationSlug:string):Promise<ExternalContact[]>{
  if(!isSupabaseBrowserConfigured())return[];
  let q=createClient().from("hub_contacts").select("*").order("emergency",{ascending:false}).order("name");
  if(stationSlug!=="all")q=q.or(`station_slug.eq.all,station_slug.eq.${stationSlug}`);
  const{data,error}=await q;if(error)throw error;
  return(data||[]).map((r:any)=>({id:String(r.id),stationSlug:String(r.station_slug),category:String(r.category),name:String(r.name),company:String(r.company||""),roleTitle:String(r.role_title||""),email:String(r.email||""),phone:String(r.phone||""),emergency:Boolean(r.emergency),visibility:String(r.visibility) as ExternalContact["visibility"],notes:String(r.notes||"")}));
}
export async function saveExternalContact(contact:ExternalContact){
  const actor=await currentUserId();if(!actor)throw new Error("Log opnieuw in.");
  const payload={station_slug:contact.stationSlug,category:contact.category,name:contact.name.trim(),company:contact.company,role_title:contact.roleTitle,email:contact.email,phone:contact.phone,emergency:contact.emergency,visibility:contact.visibility,notes:contact.notes,updated_by:actor,updated_at:new Date().toISOString()};
  const supabase=createClient();
  if(contact.id.startsWith("new-")){
    const{data,error}=await supabase.from("hub_contacts").insert({...payload,created_by:actor}).select("*").single();if(error)throw error;return data;
  }
  const{data,error}=await supabase.from("hub_contacts").update(payload).eq("id",contact.id).select("*").single();if(error)throw error;return data;
}
export async function deleteExternalContact(id:string){const{error}=await createClient().from("hub_contacts").delete().eq("id",id);if(error)throw error}

export async function loadContentInbox(stationSlug:string):Promise<ContentItem[]>{
  if(!isSupabaseBrowserConfigured())return[];
  const supabase=createClient();
  let q=supabase.from("hub_content_inbox").select("*").order("status").order("created_at",{ascending:false});
  if(stationSlug!=="all")q=q.eq("station_slug",stationSlug);
  const{data:rows,error}=await q;if(error)throw error;
  const userIds=[...new Set((rows||[]).flatMap((x:any)=>[x.submitted_by,x.assigned_to]).filter(Boolean).map(String))];
  const programIds=[...new Set((rows||[]).map((x:any)=>x.target_program_id).filter(Boolean).map(String))];
  const names=new Map<string,string>(),programNames=new Map<string,string>();
  if(userIds.length){const{data}=await supabase.from("profiles").select("id,display_name,email").in("id",userIds);for(const x of data||[])names.set(String((x as any).id),String((x as any).display_name||(x as any).email||"Teamlid"))}
  if(programIds.length){const{data}=await supabase.from("station_programs").select("id,name").in("id",programIds);for(const x of data||[])programNames.set(String((x as any).id),String((x as any).name||"Programma"))}
  return(rows||[]).map((r:any)=>({id:String(r.id),stationSlug:String(r.station_slug),contentType:String(r.content_type),title:String(r.title),description:String(r.description||""),status:String(r.status) as ContentItem["status"],targetProgramId:r.target_program_id?String(r.target_program_id):null,targetProgramName:r.target_program_id?programNames.get(String(r.target_program_id))||"Programma":"",submittedBy:String(r.submitted_by),submittedByName:names.get(String(r.submitted_by))||"Teamlid",assignedTo:r.assigned_to?String(r.assigned_to):null,assignedToName:r.assigned_to?names.get(String(r.assigned_to))||"Teamlid":"",scheduledFor:r.scheduled_for?String(r.scheduled_for):null,teamNote:String(r.team_note||""),createdAt:String(r.created_at),updatedAt:String(r.updated_at)}));
}
export async function createContentItem(input:{stationSlug:string;contentType:string;title:string;description:string;targetProgramId?:string|null}){
  const actor=await currentUserId();if(!actor)throw new Error("Log opnieuw in.");
  const{data,error}=await createClient().from("hub_content_inbox").insert({station_slug:input.stationSlug,content_type:input.contentType,title:input.title.trim(),description:input.description.trim(),target_program_id:input.targetProgramId||null,submitted_by:actor}).select("*").single();if(error)throw error;return data;
}
export async function updateContentItem(id:string,patch:{status?:ContentItem["status"];assignedTo?:string|null;scheduledFor?:string|null;teamNote?:string;targetProgramId?:string|null}){
  const payload:any={updated_at:new Date().toISOString()};
  if(patch.status!==undefined)payload.status=patch.status;
  if(patch.assignedTo!==undefined)payload.assigned_to=patch.assignedTo;
  if(patch.scheduledFor!==undefined)payload.scheduled_for=patch.scheduledFor;
  if(patch.teamNote!==undefined)payload.team_note=patch.teamNote;
  if(patch.targetProgramId!==undefined)payload.target_program_id=patch.targetProgramId;
  const{error}=await createClient().from("hub_content_inbox").update(payload).eq("id",id);if(error)throw error;
}

function mapWarning(r:any):OperationalWarning{return{warningKey:String(r.warning_key),stationSlug:String(r.station_slug),code:String(r.code),severity:String(r.severity) as OperationalWarning["severity"],title:String(r.title),body:String(r.body||""),status:String(r.status) as OperationalWarning["status"],actionPath:String(r.action_path||""),source:String((r.source==="VLACORA"?"PULSE":r.source)||"PULSE"),firstSeenAt:String(r.first_seen_at),lastSeenAt:String(r.last_seen_at),resolvedAt:r.resolved_at?String(r.resolved_at):null}}
export async function loadOperationalWarnings(stationSlug:string,openOnly=true):Promise<OperationalWarning[]>{
  if(!isSupabaseBrowserConfigured())return[];
  let q=createClient().from("hub_operational_warnings").select("*").order("severity",{ascending:true}).order("last_seen_at",{ascending:false});
  if(stationSlug!=="all")q=q.eq("station_slug",stationSlug);
  if(openOnly)q=q.eq("status","open");
  const{data,error}=await q;if(error)throw error;return(data||[]).map(mapWarning);
}
export async function upsertOperationalWarning(input:{stationSlug:string;code:string;identity?:string;severity:OperationalWarning["severity"];title:string;body:string;actionPath:string;source?:string}){
  if(!isSupabaseBrowserConfigured())return;
  const actor=await currentUserId();
  const warningKey=`${input.stationSlug}:${input.code}:${input.identity||"main"}`;
  const now=new Date().toISOString();
  const supabase=createClient();
  const{data:existing}=await supabase.from("hub_operational_warnings").select("warning_key,status,first_seen_at").eq("warning_key",warningKey).maybeSingle();
  const payload={warning_key:warningKey,station_slug:input.stationSlug,code:input.code,severity:input.severity,title:input.title,body:input.body,status:"open",action_path:input.actionPath,source:input.source||"PULSE",first_seen_at:existing?.first_seen_at||now,last_seen_at:now,resolved_at:null,updated_by:actor};
  const{error}=await supabase.from("hub_operational_warnings").upsert(payload,{onConflict:"warning_key"});if(error)throw error;
}
export async function resolveOperationalWarning(stationSlug:string,code:string,identity="main"){
  if(!isSupabaseBrowserConfigured())return;
  const actor=await currentUserId(),key=`${stationSlug}:${code}:${identity}`;
  await createClient().from("hub_operational_warnings").update({status:"resolved",resolved_at:new Date().toISOString(),updated_by:actor}).eq("warning_key",key);
}

function containsRequiredEmpty(items:any[]){
  return items.filter(i=>String(i?.notes||"").toLowerCase().includes("verplicht")&&!String(i?.presenterText||"").trim()).length;
}
function deepValue(value:any,keys:string[]):any{
  if(!value||typeof value!=="object")return undefined;
  const wanted=new Set(keys.map(k=>k.toLowerCase()));
  const queue:any[]=[value];
  while(queue.length){
    const current=queue.shift();
    if(!current||typeof current!=="object")continue;
    for(const [key,v] of Object.entries(current)){
      if(wanted.has(key.toLowerCase()))return v;
      if(v&&typeof v==="object")queue.push(v);
    }
  }
  return undefined;
}
function boolish(value:any):boolean|null{
  if(typeof value==="boolean")return value;
  if(typeof value==="number")return value!==0;
  const s=String(value??"").toLowerCase().trim();
  if(["true","1","online","active","running","up","connected"].includes(s))return true;
  if(["false","0","offline","inactive","stopped","down","disconnected"].includes(s))return false;
  return null;
}
export async function runOperationalChecks(stationSlug:string,{force=false}:{force?:boolean}={}){
  if(!isSupabaseBrowserConfigured()||stationSlug==="all")return[];
  const throttleKey=`vlacora:${stationSlug}:ops-check:last`;
  if(!force&&typeof localStorage!=="undefined"){
    const last=Number(localStorage.getItem(throttleKey)||0);
    if(Date.now()-last<5*60_000)return loadOperationalWarnings(stationSlug,true);
    localStorage.setItem(throttleKey,String(Date.now()));
  }
  const supabase=createClient();
  const today=localDate(),tomorrow=localDate(new Date(Date.now()+24*60*60*1000));
  try{
    const{data:workspaces}=await supabase.from("hub_editorial_workspaces").select("air_date,air_hour,items").eq("station_slug",stationSlug).gte("air_date",today).lte("air_date",tomorrow).limit(60);
    const required=(workspaces||[]).reduce((n:number,w:any)=>n+containsRequiredEmpty(Array.isArray(w.items)?w.items:[]),0);
    if(required)await upsertOperationalWarning({stationSlug,code:"required-talk-empty",severity:"warning",title:`${required} verplicht(e) redactieslot(s) nog leeg`,body:"Vul de verplichte talks in voor ze on air moeten.",actionPath:`/hub/${stationSlug}/redactie`});
    else await resolveOperationalWarning(stationSlug,"required-talk-empty");
    const sponsorEmpty=(workspaces||[]).flatMap((w:any)=>Array.isArray(w.items)?w.items:[]).filter((i:any)=>/sponsor|verkochte actie|wedstrijd/i.test(`${i?.title||""} ${i?.notes||""}`)&&!String(i?.presenterText||"").trim()).length;
    if(sponsorEmpty)await upsertOperationalWarning({stationSlug,code:"sponsor-talk-empty",severity:"warning",title:`${sponsorEmpty} sponsor-/actie-talk(s) nog niet voorbereid`,body:"Er staat commerciële content klaar zonder presentatietekst.",actionPath:`/hub/${stationSlug}/redactie`});
    else await resolveOperationalWarning(stationSlug,"sponsor-talk-empty");

    const{data:templates}=await supabase.from("hub_editorial_templates").select("sequence,assignments,active").eq("station_slug",stationSlug).eq("active",true);
    const now=new Date(),nowHour=Number(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Brussels",hour:"2-digit",hour12:false}).format(now));
    const todayWeekday=(now.getDay()+6)%7;
    let missingCommercial=0;
    for(const template of templates||[]){
      const hasCommercial=(Array.isArray((template as any).sequence)?(template as any).sequence:[]).some((s:any)=>String(s.type||"").toLowerCase()==="commercial"||/reclame|commercial/i.test(String(s.label||"")));
      if(!hasCommercial)continue;
      for(const assignment of Array.isArray((template as any).assignments)?(template as any).assignments:[]){
        const wd=Number(assignment.weekday),h=Number(assignment.hour);
        if(wd!==todayWeekday||h<nowHour||h>nowHour+6)continue;
        const ws=(workspaces||[]).find((w:any)=>String(w.air_date)===today&&Number(w.air_hour)===h);
        const items=Array.isArray(ws?.items)?ws.items:[];
        if(ws&&!items.some((i:any)=>String(i?.type||"").toLowerCase()==="commercial"))missingCommercial++;
      }
    }
    if(missingCommercial)await upsertOperationalWarning({stationSlug,code:"commercial-missing",severity:"warning",title:`${missingCommercial} reclameblok(ken) ontbreken`,body:"Een toegewezen uurtemplate verwacht reclame, maar het opgeslagen redactie-uur bevat geen commercial.",actionPath:`/hub/${stationSlug}/redactie`});
    else await resolveOperationalWarning(stationSlug,"commercial-missing");
  }catch{}

  try{
    const{data:tasks}=await supabase.from("hub_tasks").select("id,title,priority,status").eq("station_slug",stationSlug).in("priority",["high","critical"]).not("status","in","(done,cancelled)");
    const ids=(tasks||[]).map((x:any)=>String(x.id));
    let assigned=new Set<string>();
    if(ids.length){const{data}=await supabase.from("hub_task_assignees").select("task_id").in("task_id",ids);assigned=new Set((data||[]).map((x:any)=>String(x.task_id)))}
    const unassigned=(tasks||[]).filter((x:any)=>!assigned.has(String(x.id)));
    if(unassigned.length)await upsertOperationalWarning({stationSlug,code:"important-task-unassigned",severity:"warning",title:`${unassigned.length} belangrijke taak/taken zonder eigenaar`,body:unassigned.slice(0,3).map((x:any)=>x.title).join(" • "),actionPath:`/hub/${stationSlug}/taken`});
    else await resolveOperationalWarning(stationSlug,"important-task-unassigned");
  }catch{}



  return loadOperationalWarnings(stationSlug,true);
}

export async function loadPresenterDashboard(stationSlug:string,userId:string):Promise<PresenterDashboardData>{
  const supabase=createClient(),programs=await loadPrograms(stationSlug),todayDay=(new Date().getDay()+6)%7,nowMin=todayMinutes();
  const todayPrograms=programs.filter(p=>p.active&&p.day===todayDay).sort((a,b)=>a.start.localeCompare(b.start));
  const{data:teamRows}=await supabase.from("hub_program_team").select("program_id,user_id,role,is_primary").eq("user_id",userId);
  const assigned=new Set((teamRows||[]).map((x:any)=>String(x.program_id)));
  const mine=todayPrograms.filter(p=>assigned.has(p.id));
  const program=mine.find(p=>timeToMinutes(p.start)<=nowMin&&timeToMinutes(p.end)>nowMin)||mine.find(p=>timeToMinutes(p.start)>nowMin)||mine[0]||null;
  const nextProgram=program?todayPrograms.find(p=>timeToMinutes(p.start)>=timeToMinutes(program.end))||null:null;
  const profile=program?await loadProgramProfile(program):null,team=program?await loadProgramTeam(program.id):[];
  let requiredTalks=0,sponsorTalks=0,promos=0,missingRequiredTalks=0;const trafficMoments:Array<{time:string;title:string;ready:boolean}>=[];let editorialItems=0;
  if(program){
    const startHour=Math.floor(timeToMinutes(program.start)/60),endHour=Math.max(startHour+1,Math.ceil(timeToMinutes(program.end)/60));
    const{data:ws}=await supabase.from("hub_editorial_workspaces").select("air_hour,items").eq("station_slug",stationSlug).eq("air_date",localDate()).gte("air_hour",startHour).lt("air_hour",endHour);
    for(const w of ws||[])for(const i of Array.isArray((w as any).items)?(w as any).items:[]){
      editorialItems++;
      const type=String(i?.type||"").toLowerCase(),notes=String(i?.notes||""),title=String(i?.title||"");
      if(notes.toLowerCase().includes("verplicht")){requiredTalks++;if(!String(i?.presenterText||"").trim())missingRequiredTalks++;}
      if(/sponsor|verkochte actie|wedstrijd/i.test(`${title} ${notes}`))sponsorTalks++;
      if(["promo","imaging","link"].includes(type))promos++;
      if(type==="traffic")trafficMoments.push({time:String(i?.time||`${String((w as any).air_hour).padStart(2,"0")}:00`),title,ready:Boolean(String(i?.presenterText||"").trim())});
    }
  }
  const warnings=await loadOperationalWarnings(stationSlug,true);
  const{data:messageRows}=await supabase.from("hub_notifications").select("id,station_slug,recipient_user_id,title,body,category,severity,requires_acknowledgement,action_path,created_at").order("created_at",{ascending:false}).limit(80);
  const messages=(messageRows||[]).filter((n:any)=>
    (!n.station_slug||n.station_slug==="all"||String(n.station_slug)===stationSlug)
    &&(!n.recipient_user_id||String(n.recipient_user_id)===userId)
    &&(n.requires_acknowledgement||["warning","critical"].includes(String(n.severity)))
  ).slice(0,6).map((n:any)=>({id:String(n.id),title:String(n.title),body:String(n.body||""),category:String(n.category||""),actionPath:String(n.action_path||"")}));
  const importantMessages=messages.length;
  let taskQ=supabase.from("hub_tasks").select("id,title,due_at,priority,status").eq("station_slug",stationSlug).not("status","in","(done,cancelled)");
  const{data:taskRows}=await taskQ;
  const taskIds=(taskRows||[]).map((x:any)=>String(x.id));let myTaskIds=new Set<string>();
  if(taskIds.length){const{data}=await supabase.from("hub_task_assignees").select("task_id").eq("user_id",userId).in("task_id",taskIds);myTaskIds=new Set((data||[]).map((x:any)=>String(x.task_id)))}
  const tasks=(taskRows||[]).filter((x:any)=>myTaskIds.has(String(x.id))).slice(0,6).map((x:any)=>({id:String(x.id),title:String(x.title),dueAt:x.due_at?String(x.due_at):null,priority:String(x.priority)}));
  const editorialReady=editorialItems>0&&missingRequiredTalks===0;
  return{program,nextProgram,profile,team,requiredTalks,sponsorTalks,promos,trafficMoments,importantMessages,messages,studioInfo:profile?.studioInfo||program?.notes||"",editorialReady,editorialItems,tasks,warnings};
}

export async function loadPersonalInbox(stationSlug:string,userId:string){
  if(!isSupabaseBrowserConfigured())return{tasks:[],requests:[],meetings:[],calendar:[],replacements:[],warnings:[]};
  const supabase=createClient();
  const[{data:taskAssignees},{data:requests},{data:meetings},{data:calendar},{data:replacements}]=await Promise.all([
    supabase.from("hub_task_assignees").select("task_id").eq("user_id",userId),
    supabase.from("hub_admin_requests").select("id,title,status,admin_note,updated_at,station_slug").eq("created_by",userId).order("updated_at",{ascending:false}).limit(12),
    supabase.from("hub_music_meetings").select("id,title,scheduled_at,status,station_slug").gte("scheduled_at",new Date().toISOString()).order("scheduled_at").limit(10),
    supabase.from("hub_calendar_events").select("id,title,starts_at,ends_at,scope,station_slug,owner_user_id,location").gte("starts_at",new Date().toISOString()).order("starts_at").limit(12),
    supabase.from("hub_absence_coverages").select("id,air_date,status,program_id,absence_id").eq("replacement_user_id",userId).gte("air_date",localDate()).order("air_date")
  ]);
  const ids=(taskAssignees||[]).map((x:any)=>String(x.task_id));let tasks:any[]=[];
  if(ids.length){const{data}=await supabase.from("hub_tasks").select("id,title,status,priority,due_at,station_slug").in("id",ids).not("status","in","(done,cancelled)").order("due_at",{ascending:true,nullsFirst:false});tasks=data||[]}
  const programIds=[...new Set((replacements||[]).map((x:any)=>String(x.program_id)))];const programNames=new Map<string,string>();
  if(programIds.length){const{data}=await supabase.from("station_programs").select("id,name").in("id",programIds);for(const x of data||[])programNames.set(String((x as any).id),String((x as any).name))}
  return{
    tasks:tasks.filter((x:any)=>stationSlug==="all"||String(x.station_slug)===stationSlug),
    requests:(requests||[]).filter((x:any)=>stationSlug==="all"||String(x.station_slug)===stationSlug||String(x.station_slug)==="all"),
    meetings:(meetings||[]).filter((x:any)=>stationSlug==="all"||String(x.station_slug)===stationSlug),
    calendar:(calendar||[]).filter((x:any)=>stationSlug==="all"||String(x.scope)!=="station"||String(x.station_slug)===stationSlug),
    replacements:(replacements||[]).map((x:any)=>({...x,programName:programNames.get(String(x.program_id))||"Programma"})),
    warnings:await loadOperationalWarnings(stationSlug,true)
  };
}

function matchText(value:any,q:string){return String(value||"").toLowerCase().includes(q)}
export async function universalSearch(stationSlug:string,query:string):Promise<SearchResult[]>{
  const q=query.trim().toLowerCase();if(q.length<2||!isSupabaseBrowserConfigured())return[];
  const supabase=createClient(),results:SearchResult[]=[];
  const add=(r:SearchResult)=>results.push(r);
  const safe=async<T>(fn:()=>PromiseLike<any>)=>{try{return(await fn()).data||[]}catch{return[]}};
  const [
    programs,tasks,contacts,content,meetings,tracks,social,calendar,notifications,workspaces,hitlists
  ]=await Promise.all([
    safe(()=>supabase.from("station_programs").select("id,station_slug,name,host,format,notes").limit(100)),
    safe(()=>supabase.from("hub_tasks").select("id,station_slug,title,description,status").limit(100)),
    safe(()=>supabase.from("hub_contacts").select("id,station_slug,name,company,role_title,notes").limit(100)),
    safe(()=>supabase.from("hub_content_inbox").select("id,station_slug,title,description,content_type,status").limit(100)),
    safe(()=>supabase.from("hub_music_meetings").select("id,station_slug,title,notes,status").limit(80)),
    safe(()=>supabase.from("hub_music_meeting_tracks").select("id,meeting_id,artist,title,category").limit(180)),
    safe(()=>supabase.from("hub_social_posts").select("id,station_slug,title,caption,status,campaign,content_pillar,objective").limit(100)),
    safe(()=>supabase.from("hub_calendar_events").select("id,station_slug,scope,title,description,event_type,starts_at,location").order("starts_at",{ascending:false}).limit(120)),
    safe(()=>supabase.from("hub_notifications").select("id,station_slug,title,body,category").limit(100)),
    safe(()=>supabase.from("hub_editorial_workspaces").select("station_slug,air_date,air_hour,items").order("air_date",{ascending:false}).limit(120)),
    safe(()=>supabase.from("hitlists").select("id,station_slug,name,edition_label,entries").order("publish_date",{ascending:false}).limit(60))
  ]);
  const accept=(s:string)=>stationSlug==="all"||s===stationSlug||s==="all"||!s;
  for(const x of programs)if(accept(String(x.station_slug))&&[x.name,x.host,x.format,x.notes].some(v=>matchText(v,q)))add({id:`program:${x.id}`,kind:"Programma",title:String(x.name),subtitle:`${x.host||"Geen host"} • ${x.format||""}`,path:`/hub/${x.station_slug}/programmas?program=${x.id}`,stationSlug:String(x.station_slug),score:10});
  for(const x of tasks)if(accept(String(x.station_slug))&&[x.title,x.description].some(v=>matchText(v,q)))add({id:`task:${x.id}`,kind:"Taak",title:String(x.title),subtitle:String(x.status),path:`/hub/${x.station_slug}/taken`,stationSlug:String(x.station_slug),score:8});
  for(const x of contacts)if(accept(String(x.station_slug))&&[x.name,x.company,x.role_title,x.notes].some(v=>matchText(v,q)))add({id:`contact:${x.id}`,kind:"Contact",title:String(x.name),subtitle:`${x.company||""} ${x.role_title||""}`.trim(),path:`/hub/${x.station_slug==="all"?stationSlug:x.station_slug}/contacten`,stationSlug:String(x.station_slug),score:7});
  for(const x of content)if(accept(String(x.station_slug))&&[x.title,x.description,x.content_type].some(v=>matchText(v,q)))add({id:`content:${x.id}`,kind:"Content inbox",title:String(x.title),subtitle:`${x.content_type} • ${x.status}`,path:`/hub/${x.station_slug}/content-inbox`,stationSlug:String(x.station_slug),score:7});
  for(const x of meetings)if(accept(String(x.station_slug))&&[x.title,x.notes].some(v=>matchText(v,q)))add({id:`meeting:${x.id}`,kind:"Muziekmeeting",title:String(x.title),subtitle:String(x.status),path:`/hub/${x.station_slug}/meetings`,stationSlug:String(x.station_slug),score:8});
  const meetingStation=new Map<string,string>(meetings.map((x:any)=>[String(x.id),String(x.station_slug)]));
  for(const x of tracks){const st=meetingStation.get(String(x.meeting_id))||stationSlug;if(accept(st)&&[x.artist,x.title,x.category].some(v=>matchText(v,q)))add({id:`track:${x.id}`,kind:"Muziekmeeting song",title:`${x.artist} – ${x.title}`,subtitle:String(x.category||""),path:`/hub/${st}/meetings`,stationSlug:st,score:11})}
  for(const x of social)if(accept(String(x.station_slug))&&[x.title,x.caption,x.campaign,x.content_pillar,x.objective].some(v=>matchText(v,q)))add({id:`social:${x.id}`,kind:"Social",title:String(x.title),subtitle:`${x.status}${x.campaign?` • ${x.campaign}`:""}`,path:`/hub/${x.station_slug}/social`,stationSlug:String(x.station_slug),score:6});
  for(const x of calendar){const s=String(x.station_slug||"all");if((String(x.scope)!=="station"||accept(s))&&[x.title,x.description,x.event_type,x.location].some(v=>matchText(v,q)))add({id:`calendar:${x.id}`,kind:"Agenda",title:String(x.title),subtitle:`${new Date(x.starts_at).toLocaleString("nl-BE")} • ${x.location||x.event_type||""}`,path:`/hub/${s==="all"?stationSlug:s}/kalender`,stationSlug:s,score:8});}
  for(const x of notifications)if(accept(String(x.station_slug||""))&&[x.title,x.body,x.category].some(v=>matchText(v,q)))add({id:`notification:${x.id}`,kind:"Communicatie",title:String(x.title),subtitle:String(x.category||""),path:`/hub/${x.station_slug||stationSlug}/meldingen`,stationSlug:String(x.station_slug||stationSlug),score:5});
  for(const w of workspaces){
    const s=String(w.station_slug);if(!accept(s))continue;
    for(const item of Array.isArray(w.items)?w.items:[])if([item.artist,item.title,item.presenterText,item.notes].some(v=>matchText(v,q)))add({id:`editorial:${s}:${w.air_date}:${w.air_hour}:${item.id}`,kind:"Redactie-item",title:`${item.artist?`${item.artist} – `:""}${item.title||"Item"}`,subtitle:`${w.air_date} • ${String(w.air_hour).padStart(2,"0")}:00`,path:`/hub/${s}/redactie`,stationSlug:s,score:9});
  }
  for(const h of hitlists){
    const s=String(h.station_slug);if(!accept(s))continue;
    if(matchText(h.name,q)||matchText(h.edition_label,q))add({id:`hitlist:${h.id}`,kind:"Hitlijst",title:String(h.name),subtitle:String(h.edition_label||""),path:`/hub/${s}/hitlijsten`,stationSlug:s,score:6});
    for(const e of Array.isArray(h.entries)?h.entries:[])if([e.artist,e.title].some(v=>matchText(v,q)))add({id:`hitentry:${h.id}:${e.id||e.position}`,kind:"Hitlijst song",title:`${e.artist} – ${e.title}`,subtitle:`${h.name} • ${h.edition_label||""}`,path:`/hub/${s}/hitlijsten`,stationSlug:s,score:10});
  }
  return results.sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title,"nl")).slice(0,60);
}
