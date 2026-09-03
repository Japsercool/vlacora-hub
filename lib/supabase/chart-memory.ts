"use client";

import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";

export type ChartSongMemory={
  id:string;
  stationSlug:string;
  songKey:string;
  artist:string;
  title:string;
  songId:string;
  spotifyUrl:string;
  youtubeUrl:string;
  useCount:number;
  lastUsedAt:string;
};

function normalize(value:string){return value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g," ").trim()}
export function chartSongKey(artist:string,title:string){return `${normalize(artist)}|||${normalize(title)}`}

async function loggedIn(){
  if(!isSupabaseBrowserConfigured())return false;
  try{const{data}=await createClient().auth.getUser();return Boolean(data.user)}catch{return false}
}

export async function loadChartSongMemory(stationSlug:string):Promise<ChartSongMemory[]>{
  if(!(await loggedIn()))return [];
  const{data,error}=await createClient().from("hub_chart_song_memory")
    .select("id,station_slug,song_key,artist,title,song_id,spotify_url,youtube_url,use_count,last_used_at")
    .eq("station_slug",stationSlug).order("last_used_at",{ascending:false}).limit(1200);
  if(error)throw error;
  return(data||[]).map((x:any)=>({
    id:String(x.id),stationSlug:String(x.station_slug),songKey:String(x.song_key),artist:String(x.artist||""),title:String(x.title||""),
    songId:String(x.song_id||""),spotifyUrl:String(x.spotify_url||""),youtubeUrl:String(x.youtube_url||""),useCount:Number(x.use_count||0),lastUsedAt:String(x.last_used_at||"")
  }));
}

export async function rememberChartSongs(stationSlug:string,songs:Array<{artist:string;title:string;songId?:string;spotifyUrl?:string;youtubeUrl?:string}>){
  if(!(await loggedIn()))return;
  const unique=new Map<string,{artist:string;title:string;songId?:string;spotifyUrl?:string;youtubeUrl?:string}>();
  for(const song of songs){if(!song.artist.trim()||!song.title.trim())continue;unique.set(chartSongKey(song.artist,song.title),song)}
  if(!unique.size)return;
  const supabase=createClient();
  const keys=[...unique.keys()];
  const{data:existing,error:readError}=await supabase.from("hub_chart_song_memory").select("song_key,use_count").eq("station_slug",stationSlug).in("song_key",keys);
  if(readError)throw readError;
  const counts=new Map<string,number>((existing||[]).map((x:any)=>[String(x.song_key),Number(x.use_count||0)] as [string,number]));
  const now=new Date().toISOString();
  const rows=[...unique].map(([key,song])=>({
    station_slug:stationSlug,song_key:key,artist:song.artist.trim(),title:song.title.trim(),song_id:song.songId||"",spotify_url:song.spotifyUrl||"",youtube_url:song.youtubeUrl||"",
    use_count:(counts.get(key)||0)+1,last_used_at:now,updated_at:now
  }));
  const{error}=await supabase.from("hub_chart_song_memory").upsert(rows,{onConflict:"station_slug,song_key"});
  if(error)throw error;
}
