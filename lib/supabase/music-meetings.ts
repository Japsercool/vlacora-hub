"use client";

import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";

export type MusicMeetingStatus="planned"|"active"|"paused"|"closed";
export type MusicMeeting={
  id:string;stationSlug:string;title:string;scheduledAt:string|null;endsAt:string|null;status:MusicMeetingStatus;notes:string;
  createdBy:string|null;createdAt:string;updatedAt:string;
};
export type MusicMeetingTrack={
  id:string;meetingId:string;source:"manual"|"rotation";sourceSongId:string|null;artist:string;title:string;category:string;
  rotationFolder:string;audioUrl:string;position:number;decision:string;note:string;addedBy:string|null;createdAt:string;updatedAt:string;
};
export type MusicMeetingReview={
  id:string;meetingTrackId:string;userId:string|null;score:number|null;decision:string;note:string;createdAt:string;updatedAt:string;
};
export type MeetingTrackInput={
  source:"manual"|"rotation";sourceSongId?:string|null;artist:string;title:string;category?:string;rotationFolder?:string;audioUrl?:string;
};

async function userId(){
  if(!isSupabaseBrowserConfigured())return null;
  const{data}=await createClient().auth.getUser();return data.user?.id||null;
}
function mapMeeting(r:any):MusicMeeting{return{id:String(r.id),stationSlug:String(r.station_slug),title:String(r.title),scheduledAt:r.scheduled_at?String(r.scheduled_at):null,endsAt:r.ends_at?String(r.ends_at):null,status:String(r.status) as MusicMeetingStatus,notes:String(r.notes||""),createdBy:r.created_by?String(r.created_by):null,createdAt:String(r.created_at),updatedAt:String(r.updated_at)}}
function mapTrack(r:any):MusicMeetingTrack{return{id:String(r.id),meetingId:String(r.meeting_id),source:String(r.source) as "manual"|"rotation",sourceSongId:r.source_song_id?String(r.source_song_id):null,artist:String(r.artist||""),title:String(r.title||""),category:String(r.category||""),rotationFolder:String(r.rotation_folder||""),audioUrl:String(r.audio_url||""),position:Number(r.position||0),decision:String(r.decision||""),note:String(r.note||""),addedBy:r.added_by?String(r.added_by):null,createdAt:String(r.created_at),updatedAt:String(r.updated_at)}}
function mapReview(r:any):MusicMeetingReview{return{id:String(r.id),meetingTrackId:String(r.meeting_track_id),userId:r.user_id?String(r.user_id):null,score:r.score==null?null:Number(r.score),decision:String(r.decision||""),note:String(r.note||""),createdAt:String(r.created_at),updatedAt:String(r.updated_at)}}

export async function loadMusicMeetings(stationSlug:string):Promise<MusicMeeting[]>{
  if(!isSupabaseBrowserConfigured())return[];
  let q=createClient().from("hub_music_meetings").select("*").order("scheduled_at",{ascending:false,nullsFirst:false}).order("created_at",{ascending:false});
  if(stationSlug!=="all")q=q.eq("station_slug",stationSlug);
  const{data,error}=await q;if(error)throw error;return(data||[]).map(mapMeeting);
}
export async function createMusicMeeting(input:{stationSlug:string;title:string;scheduledAt:string|null;endsAt:string|null;notes?:string}){
  const uid=await userId();if(!uid)throw new Error("Log opnieuw in.");
  const{data,error}=await createClient().from("hub_music_meetings").insert({station_slug:input.stationSlug,title:input.title.trim(),scheduled_at:input.scheduledAt,ends_at:input.endsAt,notes:input.notes||"",created_by:uid}).select("*").single();
  if(error)throw error;return mapMeeting(data);
}
export async function updateMusicMeeting(meeting:MusicMeeting,patch:Partial<Pick<MusicMeeting,"title"|"scheduledAt"|"endsAt"|"status"|"notes">>){
  const payload:any={updated_at:new Date().toISOString()};
  if(patch.title!==undefined)payload.title=patch.title;
  if(patch.scheduledAt!==undefined)payload.scheduled_at=patch.scheduledAt;
  if(patch.endsAt!==undefined)payload.ends_at=patch.endsAt;
  if(patch.status!==undefined)payload.status=patch.status;
  if(patch.notes!==undefined)payload.notes=patch.notes;
  const{data,error}=await createClient().from("hub_music_meetings").update(payload).eq("id",meeting.id).select("*").single();
  if(error)throw error;return mapMeeting(data);
}
export async function deleteMusicMeeting(id:string){
  const{error}=await createClient().from("hub_music_meetings").delete().eq("id",id);if(error)throw error;
}
export async function loadMusicMeetingTracks(meetingId:string):Promise<MusicMeetingTrack[]>{
  if(!meetingId)return[];
  const{data,error}=await createClient().from("hub_music_meeting_tracks").select("*").eq("meeting_id",meetingId).order("position").order("created_at");
  if(error)throw error;return(data||[]).map(mapTrack);
}
export async function addMusicMeetingTracks(meetingId:string,tracks:MeetingTrackInput[]){
  if(!tracks.length)return[];
  const uid=await userId();if(!uid)throw new Error("Log opnieuw in.");
  const{data:existing}=await createClient().from("hub_music_meeting_tracks").select("position").eq("meeting_id",meetingId).order("position",{ascending:false}).limit(1);
  let pos=Number(existing?.[0]?.position||0)+1;
  const rows=tracks.map(track=>({meeting_id:meetingId,source:track.source,source_song_id:track.sourceSongId||null,artist:track.artist.trim(),title:track.title.trim(),category:track.category||"",rotation_folder:track.rotationFolder||"",audio_url:track.audioUrl||"",position:pos++,added_by:uid}));
  const{data,error}=await createClient().from("hub_music_meeting_tracks").insert(rows).select("*");if(error)throw error;return(data||[]).map(mapTrack);
}
export async function updateMusicMeetingTrack(track:MusicMeetingTrack,patch:Partial<Pick<MusicMeetingTrack,"decision"|"note"|"position"|"artist"|"title"|"category"|"rotationFolder">>){
  const payload:any={updated_at:new Date().toISOString()};
  if(patch.decision!==undefined)payload.decision=patch.decision;
  if(patch.note!==undefined)payload.note=patch.note;
  if(patch.position!==undefined)payload.position=patch.position;
  if(patch.artist!==undefined)payload.artist=patch.artist;
  if(patch.title!==undefined)payload.title=patch.title;
  if(patch.category!==undefined)payload.category=patch.category;
  if(patch.rotationFolder!==undefined)payload.rotation_folder=patch.rotationFolder;
  const{data,error}=await createClient().from("hub_music_meeting_tracks").update(payload).eq("id",track.id).select("*").single();
  if(error)throw error;return mapTrack(data);
}
export async function removeMusicMeetingTrack(id:string){
  const{error}=await createClient().from("hub_music_meeting_tracks").delete().eq("id",id);if(error)throw error;
}
export async function saveMyMusicMeetingReview(trackId:string,score:number|null,decision:string,note:string){
  const uid=await userId();if(!uid)throw new Error("Log opnieuw in.");
  const{data,error}=await createClient().from("hub_music_meeting_reviews").upsert({meeting_track_id:trackId,user_id:uid,score,decision,note,updated_at:new Date().toISOString()},{onConflict:"meeting_track_id,user_id"}).select("*").single();
  if(error)throw error;return mapReview(data);
}
export async function loadMusicMeetingReviews(trackId:string):Promise<MusicMeetingReview[]>{
  if(!trackId)return[];
  const{data,error}=await createClient().from("hub_music_meeting_reviews").select("*").eq("meeting_track_id",trackId);
  if(error)throw error;return(data||[]).map(mapReview);
}
