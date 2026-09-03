"use client";

import { useEffect,useState } from "react";
import { useHubStation } from "@/lib/hub-stations";
import { emitActivity } from "@/lib/collaboration/activity";
import { loadEditorialWorkspace,saveEditorialWorkspace } from "@/lib/supabase/editorial";
import EditorialPlaylistWorkspace from "@/components/modules/editorial-playlist-workspace";
import EditorialTemplateStudio from "@/components/modules/editorial-template-studio";

export type EditorialType = "music" | "talk" | "imaging" | "promo" | "weather" | "traffic" | "news" | "commercial" | "tease" | "link" | "browse";
export type EditorialItem = {
  id:string;time:string;type:EditorialType;artist?:string;title:string;duration:string;presenterText:string;presenterHtml?:string;notes:string;source:"VLACORA";locked?:boolean;musicId?:string;
  category?:string;categoryName?:string;folder?:string;folderName?:string;musicCategory?:string;playlistCategory?:string;subtype?:string;rawType?:string;externalKind?:string;airTimeUtc?:string;sourceHourStartUtc?:string;isSweeper?:boolean;
};

const localKey=(station:string,date:string,hour:string)=>`vlacora:${station}:editorial:draaiboek:${date}:${hour}`;

export default function EditorialModule({stationSlug}:{stationSlug:string}){
  const station=useHubStation(stationSlug);
  const[tab,setTab]=useState<"draaiboek"|"templates">("draaiboek");
  const[date,setDate]=useState(()=>new Date().toISOString().slice(0,10));
  const[hour,setHour]=useState(()=>`${String(new Date().getHours()).padStart(2,"0")}:00`);
  const[playlist,setPlaylist]=useState<EditorialItem[]>([]);
  const[workspaceReady,setWorkspaceReady]=useState(false);
  const[saveState,setSaveState]=useState("—");
  const[revision,setRevision]=useState("1");
  const[notice,setNotice]=useState("");

  function flash(text:string){setNotice(text);window.setTimeout(()=>setNotice(""),2800)}
  async function loadWorkspace(showNotice=false){
    if(station.slug==="all")return;
    setWorkspaceReady(false);setSaveState("laden…");
    try{
      const cloud=await loadEditorialWorkspace(station.slug,date,Number(hour.slice(0,2)));
      if(cloud){setPlaylist((cloud.items||[]) as EditorialItem[]);setRevision(String(cloud.revision||"1"));setSaveState("✓ Teamcloud geladen")}
      else{
        let local:EditorialItem[]=[];try{local=JSON.parse(localStorage.getItem(localKey(station.slug,date,hour))||"[]")}catch{}
        setPlaylist(local);setRevision("1");setSaveState(local.length?"✓ lokaal geladen":"Nieuw draaiboek");
      }
      if(showNotice)flash("Draaiboek opnieuw geladen");
    }catch{
      let local:EditorialItem[]=[];try{local=JSON.parse(localStorage.getItem(localKey(station.slug,date,hour))||"[]")}catch{}
      setPlaylist(local);setSaveState("Lokaal actief");
    }finally{setWorkspaceReady(true)}
  }
  async function persistWorkspace(showNotice=false){
    if(station.slug==="all")return;
    try{localStorage.setItem(localKey(station.slug,date,hour),JSON.stringify(playlist))}catch{}
    setSaveState("opslaan…");
    try{
      const saved=await saveEditorialWorkspace(station.slug,date,Number(hour.slice(0,2)),playlist,revision);
      setRevision(String(saved.revision||revision));setSaveState("✓ opgeslagen");if(showNotice)flash("Draaiboek opgeslagen");
    }catch{setSaveState("✓ lokaal opgeslagen");if(showNotice)flash("Lokaal opgeslagen; Teamcloud niet bereikbaar")}
  }

  useEffect(()=>{void loadWorkspace(false)},[station.slug,date,hour]);
  useEffect(()=>{
    if(!workspaceReady||station.slug==="all")return;
    const timer=window.setTimeout(()=>void persistWorkspace(false),800);
    return()=>window.clearTimeout(timer);
  },[playlist,workspaceReady,station.slug,date,hour]);
  useEffect(()=>{emitActivity({detail:`Redactie • ${date} ${hour}`,entityType:"editorial-workspace",entityId:`${date}-${hour}`})},[date,hour]);

  if(stationSlug==="all")return <div className="card"><div className="empty-live-state"><strong>Kies één station</strong><span>Redactie wordt per station en uur bewaard.</span></div></div>;
  return <div>
    <div className="page-intro"><div><h2>Redactie & draaiboek</h2><p>Bereid talks, nieuws, weer, verkeer, acties en presentatieteksten volledig binnen VLACORA voor.</p></div><div className="button-row"><button className="ghost" onClick={()=>void loadWorkspace(true)}>↻ Herladen</button><button className="primary" onClick={()=>void persistWorkspace(true)}>Opslaan</button></div></div>
    <div className="editorial-tabs"><button className={tab==="draaiboek"?"active":""} onClick={()=>setTab("draaiboek")}>Draaiboek</button><button className={tab==="templates"?"active":""} onClick={()=>setTab("templates")}>Redactietemplates</button></div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}
    {tab==="draaiboek"&&<EditorialPlaylistWorkspace stationName={station.name} stationSlug={station.slug} date={date} setDate={setDate} hour={hour} setHour={setHour} playlist={playlist} setPlaylist={setPlaylist} onPull={()=>loadWorkspace(true)} playlistVersion={revision} syncLabel="VLACORA draaiboek" saveLabel={saveState} onSave={()=>persistWorkspace(false)}/>} 
    {tab==="templates"&&<EditorialTemplateStudio stationSlug={station.slug} playlist={playlist}/>} 
  </div>;
}
