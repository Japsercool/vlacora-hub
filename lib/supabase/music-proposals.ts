"use client";
import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";

export type MusicProposal={
 id:string;stationSlug:string;proposalType:"new_song"|"format_change"|"playlist_suggestion";title:string;artist:string;songTitle:string;targetFolder:string;targetProgramId:string|null;spotifyUrl:string;youtubeUrl:string;currentValue:string;proposedValue:string;explanation:string;status:"submitted"|"reviewing"|"approved"|"rejected"|"implemented";submittedBy:string;handledBy:string|null;adminNote:string;createdAt:string;updatedAt:string;submitterName?:string;
};
function map(x:any):MusicProposal{return{id:String(x.id),stationSlug:String(x.station_slug),proposalType:x.proposal_type,title:String(x.title||""),artist:String(x.artist||""),songTitle:String(x.song_title||""),targetFolder:String(x.target_folder||""),targetProgramId:x.target_program_id?String(x.target_program_id):null,spotifyUrl:String(x.spotify_url||""),youtubeUrl:String(x.youtube_url||""),currentValue:String(x.current_value||""),proposedValue:String(x.proposed_value||""),explanation:String(x.explanation||""),status:x.status,submittedBy:String(x.submitted_by),handledBy:x.handled_by?String(x.handled_by):null,adminNote:String(x.admin_note||""),createdAt:String(x.created_at||""),updatedAt:String(x.updated_at||"")}}
export async function loadMusicProposals(stationSlug:string):Promise<MusicProposal[]>{
 const supabase=createClient();
 if(!isSupabaseBrowserConfigured())return[];
 let q=supabase.from("hub_music_proposals").select("*").order("created_at",{ascending:false});
 if(stationSlug!=="all")q=q.eq("station_slug",stationSlug);
 const{data,error}=await q;if(error)throw error;
 const rows:MusicProposal[]=(data||[]).map((x:any)=>map(x));
 const ids:string[]=[...new Set<string>(rows.map((r:MusicProposal)=>r.submittedBy))];
 if(ids.length){
   const{data:profiles}=await supabase.from("profiles").select("id,display_name,email").in("id",ids);
   const names=new Map<string,string>((profiles||[]).map((x:any)=>[String(x.id),String(x.display_name||x.email||"Gebruiker")] as [string,string]));
   rows.forEach((r:MusicProposal)=>{r.submitterName=names.get(r.submittedBy)||"Gebruiker"});
 }
 return rows;
}
export async function submitMusicProposal(input:Omit<MusicProposal,"id"|"status"|"submittedBy"|"handledBy"|"adminNote"|"createdAt"|"updatedAt"|"submitterName">){
 const supabase=createClient();const{data:u}=await supabase.auth.getUser();if(!u.user)throw new Error("Log opnieuw in.");const{data,error}=await supabase.from("hub_music_proposals").insert({station_slug:input.stationSlug,proposal_type:input.proposalType,title:input.title,artist:input.artist,song_title:input.songTitle,target_folder:input.targetFolder,target_program_id:input.targetProgramId||null,spotify_url:input.spotifyUrl,youtube_url:input.youtubeUrl,current_value:input.currentValue,proposed_value:input.proposedValue,explanation:input.explanation,submitted_by:u.user.id}).select("*").single();if(error)throw error;return map(data);
}
export async function updateMusicProposal(id:string,patch:Partial<Pick<MusicProposal,"status"|"adminNote"|"title"|"artist"|"songTitle"|"targetFolder"|"targetProgramId"|"spotifyUrl"|"youtubeUrl"|"currentValue"|"proposedValue"|"explanation">>){
 const supabase=createClient();const{data:u}=await supabase.auth.getUser();const row:any={updated_at:new Date().toISOString()};const pairs:any={status:"status",adminNote:"admin_note",title:"title",artist:"artist",songTitle:"song_title",targetFolder:"target_folder",targetProgramId:"target_program_id",spotifyUrl:"spotify_url",youtubeUrl:"youtube_url",currentValue:"current_value",proposedValue:"proposed_value",explanation:"explanation"};for(const[k,v]of Object.entries(patch))row[pairs[k]]=v;if(patch.status&&patch.status!=="submitted")row.handled_by=u.user?.id||null;const{error}=await supabase.from("hub_music_proposals").update(row).eq("id",id);if(error)throw error;
}
