"use client";
import { useEffect,useMemo,useState } from "react";
import jsPDF from "jspdf";
import type { MusicSong } from "@/components/modules/music-library-module";
import { useHubStation } from "@/lib/hub-stations";

const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
function useStored<T>(key:string,initial:T){const[v,setV]=useState<T>(initial);const[r,setR]=useState(false);useEffect(()=>{try{const x=localStorage.getItem(key);if(x)setV(JSON.parse(x))}catch{}setR(true)},[key]);useEffect(()=>{if(r)try{localStorage.setItem(key,JSON.stringify(v))}catch{}},[key,r,v]);return[v,setV] as const}

export default function MusicFoldersModule({stationSlug}:{stationSlug:string}){
  const station=useHubStation(stationSlug);
  const[localSongs,setLocalSongs]=useStored<MusicSong[]>(`vlacora:${stationSlug}:music:catalog`,[]);
  const[selectedLocalMap,setSelectedLocalMap]=useState("");
  const[docs,setDocs]=useStored<{id:string;name:string;created:string}[]>(`vlacora:${stationSlug}:musicfolders:docs`,[]);
  const[notice,setNotice]=useState("");
  const localMaps=useMemo(()=>Array.from(new Set(localSongs.map(s=>s.musicFolder).filter(Boolean))).sort(),[localSongs]);
  const localMapSongs=localSongs.filter(s=>!selectedLocalMap||s.musicFolder===selectedLocalMap);
  function flash(x:string){setNotice(x);setTimeout(()=>setNotice(""),3200)}
  function refreshLocal(){try{const raw=localStorage.getItem(`vlacora:${stationSlug}:music:catalog`);setLocalSongs(raw?JSON.parse(raw):[])}catch{setLocalSongs([])}}
  function generatePdf(){
    const rows=localMapSongs.map(s=>({artist:s.artist,title:s.title,map:s.musicFolder||"VLACORA"}));
    if(!rows.length)return flash("Geen songs om in de PDF te zetten.");
    const doc=new jsPDF({unit:"mm",format:"a4"});const W=210,margin=16;let page=1,y=42;
    const bg=()=>{doc.setFillColor(31,31,117);doc.rect(0,0,210,297,"F");doc.setFillColor(77,55,210);doc.circle(184,28,48,"F");doc.setTextColor(255,255,255);doc.setFont("helvetica","bold");doc.setFontSize(22);doc.text("VLACORA",margin,19);doc.setFontSize(8);doc.setFont("helvetica","normal");doc.text("INTERNAL MUSIC COMMUNICATION",margin,25);doc.text(`Pagina ${page}`,W-margin,287,{align:"right"})};
    bg();doc.setFont("helvetica","bold");doc.setFontSize(22);doc.text("MUZIEKMAP",margin,y);y+=8;doc.setFontSize(11);doc.text(selectedLocalMap||"Alle songs",margin,y);y+=7;doc.setFont("helvetica","normal");doc.setFontSize(8);doc.setTextColor(210,215,255);doc.text(`${station.name} • ${rows.length} songs • ${new Date().toLocaleString("nl-BE")}`,margin,y);y+=11;
    rows.forEach((r,i)=>{if(y>270){doc.addPage();page++;bg();y=40}if(i%2===0){doc.setFillColor(47,47,137);doc.roundedRect(margin,y-4,W-margin*2,8,1,1,"F")}doc.setTextColor(255,255,255);doc.setFontSize(9);doc.setFont("helvetica","bold");doc.text(String(i+1).padStart(2,"0"),margin+2,y);doc.text(r.artist||"—",margin+14,y);doc.setFont("helvetica","normal");doc.text(r.title||"—",88,y);doc.setTextColor(190,195,255);doc.text(r.map,W-margin-3,y,{align:"right"});y+=9});
    const filename=`vlacora-${station.name}-${selectedLocalMap||"muziek"}-${new Date().toISOString().slice(0,10)}.pdf`.toLowerCase().replace(/[^a-z0-9.-]+/g,"-");doc.save(filename);setDocs([{id:uid(),name:filename,created:new Date().toLocaleString("nl-BE")},...docs]);flash("PDF gemaakt");
  }
  if(stationSlug==="all")return <div className="card"><div className="empty-live-state"><strong>Kies één station</strong><span>Muziekmappen zijn station-specifiek.</span></div></div>;
  return <div>
    <div className="page-intro"><div><h2>Muziekmappen</h2><p>Maak interne muzieklijsten rechtstreeks uit de VLACORA-muziekbibliotheek.</p></div><button className="primary" onClick={generatePdf}>PDF maken</button></div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}
    <div className="two-col"><div className="card"><div className="module-title-row"><div><h3>VLACORA bibliotheek</h3><small>{localSongs.length} songs</small></div><button className="ghost" onClick={refreshLocal}>↻ Refresh</button></div><label className="field">Muziekmap<select className="select" value={selectedLocalMap} onChange={e=>setSelectedLocalMap(e.target.value)}><option value="">Alle mappen</option>{localMaps.map(m=><option key={m}>{m}</option>)}</select></label><p className="muted">Mappen worden bepaald door het veld “muziekmap” in VLACORA Muziek.</p></div><div className="card"><h3>PDF selectie</h3><p><strong>{localMapSongs.length}</strong> songs worden opgenomen.</p>{localMapSongs.slice(0,14).map((s,i)=><div className="document-row" key={s.id}><span>{i+1}</span><div><strong>{s.artist}</strong><small>{s.title} • {s.musicFolder||"Geen map"}</small></div></div>)}</div></div>
    <div className="card"><h3>Gemaakte documenten</h3>{docs.length===0?<p className="muted">Nog geen PDF gemaakt.</p>:docs.slice(0,8).map(d=><div className="document-row" key={d.id}><div><strong>{d.name}</strong><small>{d.created}</small></div><button className="mini-btn danger" onClick={()=>setDocs(docs.filter(x=>x.id!==d.id))}>×</button></div>)}</div>
  </div>;
}
