"use client";

import { useCallback,useEffect,useMemo,useRef,useState } from "react";
import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import { hydrateSharedIntegrationSettings } from "@/lib/supabase/settings";
import { radioRead,readIntegration } from "@/lib/radio/client-config";

type LiveStats={listeners:number;peak:number;unique:number;averageTimeSeconds:number;streamOnline:boolean;songTitle:string;bitrate:string;serverTitle:string;fetchedAt:string};
type Sample={bucket_at:string;listeners:number;peak_listeners:number;unique_listeners:number;average_time_seconds:number;stream_online:boolean;song_title:string};

function numberValue(...values:any[]){for(const value of values){const n=Number(value);if(Number.isFinite(n))return Math.max(0,n)}return 0}
function boolValue(value:any){if(typeof value==="boolean")return value;const x=String(value??"").toLowerCase();return x==="1"||x==="true"||x==="online"||x==="up"}
function candidate(raw:any){
  if(!raw||typeof raw!=="object")return raw||{};
  if(raw.currentlisteners!=null||raw.currentListeners!=null)return raw;
  if(Array.isArray(raw.streams)&&raw.streams.length)return candidate(raw.streams[0]);
  if(raw.stream&&typeof raw.stream==="object")return candidate(raw.stream);
  if(raw.stats&&typeof raw.stats==="object")return candidate(raw.stats);
  return raw;
}
function normalize(raw:any):LiveStats{
  const x=candidate(raw);
  return {
    listeners:numberValue(x.currentlisteners,x.currentListeners,x.listeners,x.listener_count),
    peak:numberValue(x.peaklisteners,x.peakListeners,x.peak),
    unique:numberValue(x.uniquelisteners,x.uniqueListeners,x.unique),
    averageTimeSeconds:numberValue(x.averagetime,x.averageTime,x.average_time),
    streamOnline:boolValue(x.streamstatus??x.streamStatus??x.online??x.status),
    songTitle:String(x.songtitle??x.songTitle??x.currentSong??x.song??""),
    bitrate:String(x.bitrate??x.streambitrate??""),
    serverTitle:String(x.servertitle??x.serverTitle??x.name??""),
    fetchedAt:new Date().toISOString()
  };
}
function fmtTime(seconds:number){if(!seconds)return "—";const m=Math.floor(seconds/60),s=Math.floor(seconds%60);return m>=60?`${Math.floor(m/60)}u ${m%60}m`:`${m}m ${s}s`}
function tenMinuteBucket(date=new Date()){
  const d=new Date(date);d.setSeconds(0,0);d.setMinutes(Math.floor(d.getMinutes()/10)*10);return d.toISOString();
}

function useShoutcast(stationSlug:string,intervalMs:number){
  const[live,setLive]=useState<LiveStats|null>(null);
  const[history,setHistory]=useState<Sample[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState("");
  const lastPersist=useRef("");

  const loadHistory=useCallback(async()=>{
    if(!isSupabaseBrowserConfigured()||stationSlug==="all")return;
    const supabase=createClient();
    const start=new Date();start.setHours(0,0,0,0);
    const {data,error}=await supabase.from("shoutcast_listener_samples")
      .select("bucket_at,listeners,peak_listeners,unique_listeners,average_time_seconds,stream_online,song_title")
      .eq("station_slug",stationSlug).gte("bucket_at",start.toISOString()).order("bucket_at");
    if(!error)setHistory((data||[]) as Sample[]);
  },[stationSlug]);

  const persist=useCallback(async(stats:LiveStats)=>{
    if(!isSupabaseBrowserConfigured()||stationSlug==="all")return;
    const bucket=tenMinuteBucket();if(lastPersist.current===bucket)return;lastPersist.current=bucket;
    try{
      const supabase=createClient();
      const {data:user}=await supabase.auth.getUser();if(!user.user)return;
      await supabase.from("shoutcast_listener_samples").upsert({
        station_slug:stationSlug,bucket_at:bucket,listeners:stats.listeners,peak_listeners:stats.peak,
        unique_listeners:stats.unique,average_time_seconds:stats.averageTimeSeconds,stream_online:stats.streamOnline,
        song_title:stats.songTitle,updated_at:new Date().toISOString()
      },{onConflict:"station_slug,bucket_at"});
      await loadHistory();
    }catch{}
  },[stationSlug,loadHistory]);

  const refresh=useCallback(async()=>{
    if(stationSlug==="all"){setLoading(false);setError("Kies één station om de SHOUTcast-stream te tonen.");return}
    try{
      await hydrateSharedIntegrationSettings(stationSlug);
      const config=readIntegration("shoutcast");
      if(!config?.host){setError("SHOUTcast is voor dit station nog niet ingesteld in Beheer → Integraties.");setLive(null);return}
      const data=await radioRead("shoutcast",config.statusPath||"/stats?sid=1&json=1","raw");
      const parsed=normalize(data.raw);
      setLive(parsed);setError("");void persist(parsed);
    }catch(e){setError(e instanceof Error?e.message:"SHOUTcast ophalen mislukt")}
    finally{setLoading(false)}
  },[stationSlug,persist]);

  useEffect(()=>{setLoading(true);void loadHistory();void refresh();const timer=window.setInterval(refresh,intervalMs);return()=>window.clearInterval(timer)},[loadHistory,refresh,intervalMs]);
  return{live,history,loading,error,refresh};
}

function hourly(history:Sample[]){
  const buckets=new Map<number,number[]>();
  history.forEach(s=>{const h=new Date(s.bucket_at).getHours();const arr=buckets.get(h)||[];arr.push(Number(s.listeners||0));buckets.set(h,arr)});
  return Array.from({length:24},(_,h)=>{const values=buckets.get(h)||[];return{hour:h,value:values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):null as number|null}});
}

export function ListenerNowCard({stationSlug}:{stationSlug:string}){
  const{live,loading,error}=useShoutcast(stationSlug,60000);
  return <div className="card"><span className="metric-label">Luisteraars nu</span><strong className="metric">{loading?"…":live?live.listeners:"—"}</strong><span className={live?.streamOnline?"positive":"muted"}>{error?"SHOUTcast instellen":live?.streamOnline?"● live via SHOUTcast":"stream offline"}</span></div>;
}

export default function ShoutcastStatsModule({stationSlug}:{stationSlug:string}){
  const{live,history,loading,error,refresh}=useShoutcast(stationSlug,30000);
  const hours=useMemo(()=>hourly(history),[history]);
  const values=history.map(x=>Number(x.listeners||0));
  const peak=Math.max(live?.listeners||0,...values,0);
  const avg=values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):(live?.listeners||0);
  const max=Math.max(1,...hours.map(x=>x.value||0));
  return <div>
    <div className="page-intro"><div><h2>Luistercijfers</h2><p>Echte SHOUTcast-statistieken • live refresh om de 30 seconden • historie maximaal 1 sample per 10 minuten.</p></div><button className="ghost" disabled={loading} onClick={()=>void refresh()}>↻ Nu vernieuwen</button></div>
    {error&&<div className="config-error shoutcast-live-error"><strong>SHOUTcast</strong><span>{error}</span><a className="ghost" href={`/hub/${stationSlug}/beheer`}>Open instellingen</a></div>}
    <div className="metric-grid">
      <div className="card"><span className="metric-label">Nu</span><strong className="metric">{loading?"…":live?live.listeners:"—"}</strong><span className={live?.streamOnline?"positive":"muted"}>{live?.streamOnline?"● stream online":"stream offline"}</span></div>
      <div className="card"><span className="metric-label">Piek vandaag</span><strong className="metric">{live?Math.max(peak,live.peak):peak||"—"}</strong><span className="muted">SHOUTcast + VLACORA-samples</span></div>
      <div className="card"><span className="metric-label">Gemiddeld</span><strong className="metric">{history.length?avg:live?live.listeners:"—"}</strong><span className="muted">vandaag</span></div>
      <div className="card"><span className="metric-label">Gem. luistertijd</span><strong className="metric metric-small">{live?fmtTime(live.averageTimeSeconds):"—"}</strong><span className="muted">SHOUTcast</span></div>
    </div>
    <div className="two-col">
      <div className="card"><div className="section-head"><div><h3>Listeners vandaag</h3><p>Gemiddelde per uur uit 10-minuten samples</p></div><span className="badge badge-blue">{history.length} samples</span></div><div className="bar-chart listener-bar-chart">{hours.map(x=><div className="bar-wrap" key={x.hour} title={x.value==null?`${x.hour}:00 • nog geen data`:`${x.hour}:00 • ${x.value} listeners`}><div className={`bar ${x.value==null?"empty":""}`} style={{height:`${x.value==null?2:Math.max(4,Math.round((x.value/max)*100))}%`}}/><span>{String(x.hour).padStart(2,"0")}</span></div>)}</div></div>
      <div className="card"><div className="section-head"><div><h3>Stream nu</h3><p>Rechtstreeks uit SHOUTcast</p></div><span className={`badge ${live?.streamOnline?"badge-green":"badge-gray"}`}>{live?.streamOnline?"ONLINE":"OFFLINE"}</span></div><div className="listener-details"><span>Server</span><strong>{live?.serverTitle||"—"}</strong><span>Bitrate</span><strong>{live?.bitrate?`${live.bitrate} kbps`:"—"}</strong><span>Unieke listeners</span><strong>{live?.unique??"—"}</strong><span>Song</span><strong>{live?.songTitle||"—"}</strong><span>Laatste update</span><strong>{live?new Date(live.fetchedAt).toLocaleTimeString("nl-BE"):"—"}</strong></div></div>
    </div>
    <div className="usage-note"><strong>Zuinig bijgewerkt</strong><span>VLACORA vraagt live cijfers alleen terwijl TODAY/Luistercijfers geopend is. De database bewaart maximaal één sample per 10 minuten per station, niet elke 30 seconden.</span></div>
  </div>
}
