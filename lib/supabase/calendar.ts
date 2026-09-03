"use client";

import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";

export type CalendarScope="personal"|"station"|"organization";
export type CalendarEvent={
  id:string;scope:CalendarScope;stationSlug:string;ownerUserId:string|null;ownerName:string;
  title:string;description:string;eventType:string;startsAt:string;endsAt:string|null;allDay:boolean;
  location:string;sourceType:string;sourceId:string|null;createdBy:string;createdAt:string;updatedAt:string;
  attendeeIds:string[];attendeeNames:string[];
};
export type CalendarPerson={id:string;name:string;email:string;jobTitle:string;avatarUrl:string};
export type CalendarSourceItem={id:string;title:string;startsAt:string;endsAt:string|null;kind:"social"|"music-meeting";stationSlug:string;subtitle:string;path:string};

async function currentUserId(){
  if(!isSupabaseBrowserConfigured())return null;
  const{data}=await createClient().auth.getUser();return data.user?.id||null;
}

export async function loadCalendarPeople():Promise<CalendarPerson[]>{
  if(!isSupabaseBrowserConfigured())return[];
  const{data,error}=await createClient().from("profiles").select("id,display_name,email,job_title,avatar_url,active").eq("active",true).order("display_name");
  if(error)throw error;
  return(data||[]).map((x:any)=>({id:String(x.id),name:String(x.display_name||x.email||"Teamlid"),email:String(x.email||""),jobTitle:String(x.job_title||""),avatarUrl:String(x.avatar_url||"")}));
}

export async function loadCalendarEvents(stationSlug:string,fromIso:string,toIso:string):Promise<CalendarEvent[]>{
  if(!isSupabaseBrowserConfigured())return[];
  const supabase=createClient();
  const{data:rows,error}=await supabase.from("hub_calendar_events").select("*").lt("starts_at",toIso).or(`ends_at.is.null,ends_at.gte.${fromIso}`).order("starts_at");
  if(error)throw error;
  const filtered=(rows||[]).filter((r:any)=>r.scope!=="station"||stationSlug==="all"||String(r.station_slug)===stationSlug);
  const eventIds=filtered.map((r:any)=>String(r.id));
  const ownerIds=[...new Set(filtered.map((r:any)=>r.owner_user_id).filter(Boolean).map(String))];
  const[{data:attendees},{data:profiles}]=await Promise.all([
    eventIds.length?supabase.from("hub_calendar_event_attendees").select("event_id,user_id,response").in("event_id",eventIds):Promise.resolve({data:[]} as any),
    supabase.from("profiles").select("id,display_name,email")
  ]);
  const names=new Map<string,string>((profiles||[]).map((p:any)=>[String(p.id),String(p.display_name||p.email||"Teamlid")]));
  const byEvent=new Map<string,string[]>();
  for(const a of attendees||[]){const id=String((a as any).event_id);const list=byEvent.get(id)||[];list.push(String((a as any).user_id));byEvent.set(id,list)}
  void ownerIds;
  return filtered.map((r:any)=>{
    const attendeeIds=byEvent.get(String(r.id))||[];
    return{id:String(r.id),scope:String(r.scope) as CalendarScope,stationSlug:String(r.station_slug||"all"),ownerUserId:r.owner_user_id?String(r.owner_user_id):null,ownerName:r.owner_user_id?names.get(String(r.owner_user_id))||"Teamlid":"",
      title:String(r.title),description:String(r.description||""),eventType:String(r.event_type||"meeting"),startsAt:String(r.starts_at),endsAt:r.ends_at?String(r.ends_at):null,allDay:Boolean(r.all_day),location:String(r.location||""),sourceType:String(r.source_type||"manual"),sourceId:r.source_id?String(r.source_id):null,createdBy:String(r.created_by||""),createdAt:String(r.created_at),updatedAt:String(r.updated_at),attendeeIds,attendeeNames:attendeeIds.map(id=>names.get(id)||"Teamlid")};
  });
}

export async function saveCalendarEvent(event:Partial<CalendarEvent>&{id?:string;scope:CalendarScope;stationSlug:string;title:string;startsAt:string},attendeeIds:string[]=[]):Promise<string>{
  if(!isSupabaseBrowserConfigured())throw new Error("Supabase is niet actief.");
  const actor=await currentUserId();if(!actor)throw new Error("Log opnieuw in.");
  const payload={scope:event.scope,station_slug:event.scope==="station"?event.stationSlug:"all",owner_user_id:event.scope==="personal"?actor:null,title:event.title.trim(),description:event.description||"",event_type:event.eventType||"meeting",starts_at:event.startsAt,ends_at:event.endsAt||null,all_day:Boolean(event.allDay),location:event.location||"",source_type:event.sourceType||"manual",source_id:event.sourceId||null,updated_by:actor,updated_at:new Date().toISOString()};
  const supabase=createClient();let id=event.id||"";
  if(id&& !id.startsWith("new-")){
    const{error}=await supabase.from("hub_calendar_events").update(payload).eq("id",id);if(error)throw error;
  }else{
    const{data,error}=await supabase.from("hub_calendar_events").insert({...payload,created_by:actor}).select("id").single();if(error)throw error;id=String(data.id);
  }
  await supabase.from("hub_calendar_event_attendees").delete().eq("event_id",id);
  const unique=event.scope==="personal"?[]:[...new Set(attendeeIds.filter(Boolean))];
  if(unique.length){const{error}=await supabase.from("hub_calendar_event_attendees").insert(unique.map(user_id=>({event_id:id,user_id,added_by:actor})));if(error)throw error}
  return id;
}

export async function deleteCalendarEvent(id:string){
  if(!isSupabaseBrowserConfigured())throw new Error("Supabase is niet actief.");
  const{error}=await createClient().from("hub_calendar_events").delete().eq("id",id);if(error)throw error;
}

export async function loadCalendarSourceItems(stationSlug:string,fromIso:string,toIso:string):Promise<CalendarSourceItem[]>{
  if(!isSupabaseBrowserConfigured())return[];
  const supabase=createClient();const result:CalendarSourceItem[]=[];
  const[{data:social},{data:meetings}]=await Promise.all([
    supabase.from("hub_social_posts").select("id,station_slug,title,status,scheduled_at,platforms").not("scheduled_at","is",null).gte("scheduled_at",fromIso).lt("scheduled_at",toIso).order("scheduled_at"),
    supabase.from("hub_music_meetings").select("id,station_slug,title,status,scheduled_at").gte("scheduled_at",fromIso).lt("scheduled_at",toIso).order("scheduled_at")
  ]);
  for(const x of social||[]){const s=String((x as any).station_slug);if(stationSlug!=="all"&&s!==stationSlug)continue;result.push({id:`social:${x.id}`,title:String((x as any).title||"Socialpost"),startsAt:String((x as any).scheduled_at),endsAt:null,kind:"social",stationSlug:s,subtitle:`Social • ${Array.isArray((x as any).platforms)&&x.platforms.length?(x as any).platforms.join(", "):String((x as any).status)}`,path:`/hub/${s}/social`})}
  for(const x of meetings||[]){const s=String((x as any).station_slug);if(stationSlug!=="all"&&s!==stationSlug)continue;result.push({id:`meeting:${x.id}`,title:String((x as any).title||"Muziekmeeting"),startsAt:String((x as any).scheduled_at),endsAt:null,kind:"music-meeting",stationSlug:s,subtitle:`Muziekmeeting • ${String((x as any).status||"")}`,path:`/hub/${s}/meetings`})}
  return result.sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
}
