"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import jsPDF from "jspdf";
import type { MusicSong } from "@/components/modules/music-library-module";
import { isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import { loadSharedHitlists, syncSharedHitlists, type SharedHitlist } from "@/lib/supabase/hub-data";
import { useHubStation } from "@/lib/hub-stations";
import { emitActivity } from "@/lib/collaboration/activity";

type HitlistStatus = "draft" | "published" | "archived";
type HitlistEntry = {
  id:string;
  songId?:string;
  artist:string;
  title:string;
  previousPosition:number|null;
  weeks:number;
  peak:number;
  notes:string;
};
type Hitlist = SharedHitlist & { entries:HitlistEntry[]; status:HitlistStatus };
type ProgramBlock={id:string;name:string;day:number;start:string;end:string;active:boolean};

const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
const today=()=>new Date().toISOString().slice(0,10);
const addDays=(date:string,days:number)=>{const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)};
const normalized=(v:string)=>v.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g," ").trim();
const songKey=(artist:string,title:string)=>`${normalized(artist)}|||${normalized(title)}`;
const seriesKeyFor=(name:string)=>normalized(name).replace(/\s+/g,"-")||"hitlijst";
function isoWeek(date:string){const d=new Date(`${date}T12:00:00`);const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-day);const y=new Date(Date.UTC(t.getUTCFullYear(),0,1));return Math.ceil((((t.getTime()-y.getTime())/86400000)+1)/7)}
const SIZES=[10,20,30,40,50,100,500,1000];

function useStored<T>(key:string,initial:T){
  const[v,setV]=useState<T>(initial);const[ready,setReady]=useState(false);
  useEffect(()=>{try{const raw=localStorage.getItem(key);if(raw)setV(JSON.parse(raw))}catch{}setReady(true)},[key]);
  useEffect(()=>{if(ready)try{localStorage.setItem(key,JSON.stringify(v))}catch{}},[key,ready,v]);
  return[v,setV] as const;
}

export default function ChartsModule({stationSlug,stationName}:{stationSlug:string;stationName:string}){
  const station=useHubStation(stationSlug);
  const[charts,setCharts]=useStored<Hitlist[]>(`vlacora:${stationSlug}:hitlists:v11`,[]);
  const[selectedId,setSelectedId]=useState("");
  const[showCreate,setShowCreate]=useState(false);
  const[showSources,setShowSources]=useState(false);
  const[showBulk,setShowBulk]=useState(false);
  const[bulkText,setBulkText]=useState("");
  const[manualArtist,setManualArtist]=useState("");
  const[manualTitle,setManualTitle]=useState("");
  const[localSongs,setLocalSongs]=useState<MusicSong[]>([]);
  const[selectedLocalSong,setSelectedLocalSong]=useState("");
  const[programs,setPrograms]=useState<ProgramBlock[]>([]);
  const[busy,setBusy]=useState(false);
  const[notice,setNotice]=useState("");
  const[cloudReady,setCloudReady]=useState(false);
  const[cloudActive,setCloudActive]=useState(false);
  const[syncing,setSyncing]=useState(false);
  const[dragIndex,setDragIndex]=useState<number|null>(null);

  const selected=charts.find(x=>x.id===selectedId)||charts[0]||null;
  useEffect(()=>{emitActivity({detail:selected?`Hitlijsten • ${selected.name} • ${selected.editionLabel}`:"Hitlijsten • overzicht",entityType:"hitlist",entityId:selected?.id})},[selected?.id,selected?.name,selected?.editionLabel]);

  const orderedCharts=useMemo(()=>[...charts].sort((a,b)=>(b.publishDate||b.validFrom||"").localeCompare(a.publishDate||a.validFrom||"")),[charts]);
  const previous=selected?.previousEditionId?charts.find(x=>x.id===selected.previousEditionId)||null:null;

  useEffect(()=>{if(!selectedId&&charts[0])setSelectedId(charts[0].id);if(selectedId&&!charts.some(x=>x.id===selectedId))setSelectedId(charts[0]?.id||"")},[charts,selectedId]);
  useEffect(()=>{refreshSources()},[stationSlug]);
  useEffect(()=>{
    let alive=true;setCloudReady(false);
    if(!isSupabaseBrowserConfigured()){setCloudActive(false);setCloudReady(true);return()=>{alive=false}};
    setCloudActive(true);
    loadSharedHitlists(stationSlug).then(rows=>{if(!alive)return;if(rows.length)setCharts(rows as Hitlist[]);setCloudReady(true)}).catch(()=>{if(alive){setCloudActive(false);setCloudReady(true);flash("Teamcloud voor hitlijsten niet bereikbaar; lokaal verder werken.")}});
    return()=>{alive=false};
  },[stationSlug]);
  useEffect(()=>{
    if(!cloudReady||!cloudActive)return;
    const timer=setTimeout(()=>{setSyncing(true);syncSharedHitlists(stationSlug,charts).catch(()=>flash("Hitlijsten konden niet naar Teamcloud synchroniseren.")).finally(()=>setSyncing(false))},900);
    return()=>clearTimeout(timer);
  },[charts,cloudReady,cloudActive,stationSlug]);

  function flash(x:string){setNotice(x);setTimeout(()=>setNotice(""),2800)}
  function refreshSources(){
    try{const raw=localStorage.getItem(`vlacora:${stationSlug}:music:catalog`);setLocalSongs(raw?JSON.parse(raw):[])}catch{setLocalSongs([])}
    try{const raw=localStorage.getItem(`vlacora:${stationSlug}:programming:v10`);setPrograms(raw?JSON.parse(raw):[])}catch{setPrograms([])}
  }
  function patch(patch:Partial<Hitlist>){if(!selected)return;setCharts(charts.map(x=>x.id===selected.id?{...x,...patch,updatedAt:new Date().toISOString()}:x))}
  function seriesEditions(chart:Hitlist){
    const key=chart.seriesKey||seriesKeyFor(chart.name);
    return charts.filter(c=>c.id!==chart.id&&(c.seriesKey||seriesKeyFor(c.name))===key&&(c.publishDate||c.validFrom||"")<(chart.publishDate||chart.validFrom||"9999-12-31")).sort((a,b)=>(b.publishDate||b.validFrom||"").localeCompare(a.publishDate||a.validFrom||""));
  }
  function previousFor(chart:Hitlist){return chart.previousEditionId?charts.find(x=>x.id===chart.previousEditionId)||null:seriesEditions(chart)[0]||null}
  function historyFor(entries:HitlistEntry[],chart:Hitlist){
    const history=seriesEditions(chart);const prev=previousFor(chart);
    const prevMap=new Map<string,number>((prev?.entries||[]).map((e:HitlistEntry,i:number)=>[songKey(e.artist,e.title),i+1]));
    return entries.map((entry,index)=>{
      const key=songKey(entry.artist,entry.title);const positions:number[]=[];
      for(const edition of history){const pos=edition.entries.findIndex(e=>songKey(e.artist,e.title)===key);if(pos>=0)positions.push(pos+1)}
      return {...entry,previousPosition:prevMap.get(key)??null,weeks:positions.length+1,peak:Math.min(index+1,...positions)};
    });
  }
  function recalculateHistories(all:Hitlist[]){
    const sorted=[...all].sort((a,b)=>(a.publishDate||a.validFrom||"").localeCompare(b.publishDate||b.validFrom||""));const done:Hitlist[]=[];
    for(const chart of sorted){const key=chart.seriesKey||seriesKeyFor(chart.name);const priors=done.filter(c=>(c.seriesKey||seriesKeyFor(c.name))===key).sort((a,b)=>(b.publishDate||b.validFrom||"").localeCompare(a.publishDate||a.validFrom||""));const explicit=chart.previousEditionId?done.find(c=>c.id===chart.previousEditionId):null;const prev=explicit||priors[0]||null;const prevMap=new Map<string,number>((prev?.entries||[]).map((e,i)=>[songKey(e.artist,e.title),i+1]));const entries=chart.entries.map((entry,index)=>{const sk=songKey(entry.artist,entry.title);const positions:number[]=[];for(const prior of priors){const pos=prior.entries.findIndex(e=>songKey(e.artist,e.title)===sk);if(pos>=0)positions.push(pos+1)}return{...entry,previousPosition:prevMap.get(sk)??null,weeks:positions.length+1,peak:Math.min(index+1,...positions)}});done.push({...chart,entries})}
    const byId=new Map(done.map(c=>[c.id,c]));return all.map(c=>byId.get(c.id)||c);
  }
  function setEntries(entries:HitlistEntry[]){if(!selected)return;const next=charts.map(x=>x.id===selected.id?{...x,entries,updatedAt:new Date().toISOString()}:x);setCharts(recalculateHistories(next))}
  function create(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget);const start=String(f.get("validFrom")||today()),publish=String(f.get("publishDate")||start);
    const name=String(f.get("name")||"Nieuwe hitlijst").trim()||"Nieuwe hitlijst";const chartKind=String(f.get("chartKind")||"weekly") as Hitlist["chartKind"];
    const recurrence=(chartKind==="weekly"?"weekly":chartKind==="annual"?"annual":"none") as Hitlist["recurrence"];const year=Number(f.get("editionYear")||publish.slice(0,4)||new Date().getFullYear());const week=chartKind==="weekly"?Number(f.get("editionWeek")||isoWeek(publish)):null;
    const n:Hitlist={id:uid(),stationSlug,name,editionLabel:String(f.get("editionLabel")||(chartKind==="weekly"?`Week ${week} • ${year}`:chartKind==="annual"?`${year}`:"Special")),publishDate:publish,validFrom:start,validTo:String(f.get("validTo")||(chartKind==="weekly"?addDays(start,6):start)),size:Number(f.get("size")||50),status:"draft",previousEditionId:String(f.get("previousEditionId")||""),programName:String(f.get("programName")||""),notes:"",chartKind,seriesKey:String(f.get("seriesKey")||seriesKeyFor(name)),editionYear:year||null,editionWeek:week,recurrence,sourceLabel:"",entries:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    setCharts([n,...charts]);setSelectedId(n.id);setShowCreate(false);flash("Nieuwe hitlijsteditie aangemaakt");
  }
  function nextEdition(){
    if(!selected)return;const start=addDays(selected.validTo||selected.validFrom||today(),1);
    const entries=selected.entries.map(e=>({...e,id:uid()}));
    const nextPublish=start;const n:Hitlist={...selected,id:uid(),editionLabel:selected.chartKind==="weekly"?`Week ${isoWeek(nextPublish)} • ${nextPublish.slice(0,4)}`:selected.chartKind==="annual"?String(Number(selected.editionYear||nextPublish.slice(0,4))+1):`${selected.editionLabel} • volgende`,publishDate:nextPublish,validFrom:start,validTo:selected.chartKind==="weekly"?addDays(start,6):start,status:"draft",previousEditionId:selected.id,editionYear:selected.chartKind==="annual"?Number(selected.editionYear||nextPublish.slice(0,4))+1:Number(nextPublish.slice(0,4)),editionWeek:selected.chartKind==="weekly"?isoWeek(nextPublish):null,entries:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    n.entries=historyFor(entries,n);setCharts([n,...charts]);setSelectedId(n.id);flash("Volgende editie aangemaakt met de huidige lijst als basis");
  }
  function duplicate(){if(!selected)return;const n:Hitlist={...selected,id:uid(),name:`${selected.name} kopie`,editionLabel:`${selected.editionLabel} kopie`,status:"draft",entries:selected.entries.map(e=>({...e,id:uid()})),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};setCharts([n,...charts]);setSelectedId(n.id);flash("Hitlijst gekopieerd")}
  function deleteChart(){if(!selected)return;setCharts(charts.filter(x=>x.id!==selected.id));setSelectedId("");flash("Hitlijst verwijderd")}
  function addEntry(song:{id?:string;artist:string;title:string}){
    if(!selected||!song.artist.trim()||!song.title.trim())return;
    if(selected.entries.some(e=>songKey(e.artist,e.title)===songKey(song.artist,song.title)))return flash("Deze song staat al in de hitlijst.");
    if(selected.entries.length>=selected.size)return flash(`Deze hitlijst is ingesteld op Top ${selected.size}. Verhoog eerst de grootte.`);
    setEntries([...selected.entries,{id:uid(),songId:song.id,artist:song.artist.trim(),title:song.title.trim(),previousPosition:null,weeks:1,peak:selected.entries.length+1,notes:""}]);
  }
  function move(index:number,to:number){if(!selected||to<0||to>=selected.entries.length||to===index)return;const a=[...selected.entries];const[item]=a.splice(index,1);a.splice(to,0,item);setEntries(a)}
  function removeEntry(id:string){if(!selected)return;setEntries(selected.entries.filter(e=>e.id!==id))}
  function updateEntry(id:string,p:Partial<HitlistEntry>){if(!selected)return;const entries=selected.entries.map(e=>e.id===id?{...e,...p}:e);setEntries(entries)}
  function addBulk(){
    if(!selected)return;let added=0;let skipped=0;let entries=[...selected.entries];
    for(const line of bulkText.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)){
      if(entries.length>=selected.size)break;
      const cols=line.includes("\t")?line.split("\t"):line.split(/\s+-\s+/);
      const artist=(cols[0]||"").replace(/^\d+[.)\s-]*/,"").trim();const title=(cols.slice(1).join(" - ")||"").trim();
      if(!artist||!title){skipped++;continue}if(entries.some(e=>songKey(e.artist,e.title)===songKey(artist,title))){skipped++;continue}
      entries.push({id:uid(),artist,title,previousPosition:null,weeks:1,peak:entries.length+1,notes:""});added++;
    }
    setEntries(entries);setBulkText("");flash(`${added} songs toegevoegd${skipped?` • ${skipped} overgeslagen`:""}`);
  }
  async function importExcel(file:File|undefined){
    if(!selected||!file)return;setBusy(true);
    try{
      const XLSX=await import("xlsx");const wb=XLSX.read(await file.arrayBuffer(),{type:"array"});let parsed:Array<{rank:number;artist:string;title:string}>=[];let sheetName="";
      for(const name of wb.SheetNames){const matrix=XLSX.utils.sheet_to_json<any[]>(wb.Sheets[name],{header:1,defval:""});let header=-1,rankCol=-1,artistCol=-1,titleCol=-1;
        for(let r=0;r<Math.min(matrix.length,25);r++){const cells=(matrix[r]||[]).map((x:any)=>normalized(String(x)));rankCol=cells.findIndex(x=>["dw","positie","pos","rank","ranking","nummer","nr"].includes(x));artistCol=cells.findIndex(x=>["artiest","artist","uitvoerder"].includes(x));titleCol=cells.findIndex(x=>["titel","title","song","track"].includes(x));if(rankCol>=0&&artistCol>=0&&titleCol>=0){header=r;break}}
        if(header<0)continue;const rows:Array<{rank:number;artist:string;title:string}>=[];
        for(let r=header+1;r<matrix.length;r++){const row=matrix[r]||[];const rank=Number(String(row[rankCol]??"").replace(/[^0-9]/g,""));const artist=String(row[artistCol]??"").trim(),title=String(row[titleCol]??"").trim();if(rank>=1&&artist&&title)rows.push({rank,artist,title})}
        if(rows.length>parsed.length){parsed=rows;sheetName=name}
      }
      if(!parsed.length)throw new Error("Geen tabel met positie/DW, Artiest en Titel gevonden.");
      parsed.sort((a,b)=>a.rank-b.rank);const entries:HitlistEntry[]=[];let matched=0;
      for(const row of parsed.slice(0,selected.size)){const exact=localSongs.find(s=>songKey(s.artist,s.title)===songKey(row.artist,row.title));const titleMatch=!exact?localSongs.find(s=>normalized(s.title)===normalized(row.title)&&normalized(s.artist).includes(normalized(row.artist).split(" ")[0]||"___")):undefined;if(exact||titleMatch)matched++;entries.push({id:uid(),songId:(exact||titleMatch)?.id,artist:row.artist,title:row.title,previousPosition:null,weeks:1,peak:row.rank,notes:""})}
      const updated={...selected,entries,sourceLabel:`Excel • ${file.name} • ${sheetName}`,updatedAt:new Date().toISOString()};setCharts(recalculateHistories(charts.map(c=>c.id===selected.id?updated:c)));setShowSources(false);flash(`${entries.length} posities geïmporteerd • ${matched} herkend in VLACORA Muziek`);
    }catch(e){flash(e instanceof Error?e.message:"Excel import mislukt")}finally{setBusy(false)}
  }
  function exportCsv(){
    if(!selected)return;
    const rows=[
      ["Positie","Vorige","Artiest","Titel","Trend","Weken","Peak","Notitie"],
      ...selected.entries.map((e,i)=>[
        String(i+1),
        e.previousPosition==null?"NEW":String(e.previousPosition),
        e.artist,
        e.title,
        trendText(e,i),
        String(e.weeks),
        String(e.peak),
        e.notes
      ])
    ];
    const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(";")).join("\r\n");
    const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=`${selected.name}-${selected.editionLabel}.csv`.replace(/[^a-z0-9.-]+/gi,"-").toLowerCase();
    a.click();
    URL.revokeObjectURL(url);
    flash("CSV geëxporteerd");
  }

  function exportPdf(){
    if(!selected||!selected.entries.length)return flash("Deze hitlijst bevat nog geen songs.");
    const doc=new jsPDF({unit:"mm",format:"a4"});
    let page=1,y=48;
    const W=210,margin=14;
    const header=()=>{
      doc.setFillColor(31,31,117);
      doc.rect(0,0,210,297,"F");
      doc.setFillColor(83,56,229);
      doc.circle(184,25,46,"F");
      doc.setTextColor(255,255,255);
      doc.setFont("helvetica","bold");
      doc.setFontSize(20);
      doc.text("VLACORA",margin,18);
      doc.setFontSize(8);
      doc.setFont("helvetica","normal");
      doc.text(`${stationName.toUpperCase()} • HITLIJST`,margin,24);
      doc.text(`Pagina ${page}`,W-margin,287,{align:"right"});
      doc.setFont("helvetica","bold");
      doc.setFontSize(19);
      doc.text(selected.name,margin,36);
      doc.setFont("helvetica","normal");
      doc.setFontSize(9);
      doc.text(`${selected.editionLabel} • ${selected.validFrom} t/m ${selected.validTo}${selected.programName?` • ${selected.programName}`:""}`,margin,42);
    };
    header();
    selected.entries.forEach((e,i)=>{
      if(y>271){doc.addPage();page++;y=38;header()}
      if(i%2===0){doc.setFillColor(47,47,137);doc.roundedRect(margin,y-5,W-margin*2,9,1,1,"F")}
      doc.setTextColor(255,255,255);
      doc.setFontSize(10);
      doc.setFont("helvetica","bold");
      doc.text(String(i+1),margin+2,y);
      doc.text(e.artist||"—",margin+15,y);
      doc.setFont("helvetica","normal");
      doc.text(e.title||"—",84,y);
      doc.setTextColor(200,205,255);
      doc.setFontSize(8);
      doc.text(`${e.previousPosition==null?"NEW":`vorige ${e.previousPosition}`} • ${trendText(e,i)} • ${e.weeks} wk`,W-margin-2,y,{align:"right"});
      y+=10;
    });
    doc.save(`${selected.name}-${selected.editionLabel}.pdf`.replace(/[^a-z0-9.-]+/gi,"-").toLowerCase());
    flash("Hitlijst-PDF gemaakt");
  }

  function trendText(e:HitlistEntry,index:number){if(e.previousPosition==null)return "NEW";const d=e.previousPosition-(index+1);return d>0?`▲ ${d}`:d<0?`▼ ${Math.abs(d)}`:"—"}

  const metrics=useMemo(()=>{
    if(!selected)return{newCount:0,climber:"—",faller:"—",longest:"—"};
    const moves=selected.entries.filter((e:HitlistEntry)=>e.previousPosition!=null).map((e:HitlistEntry,i:number)=>{const current=selected.entries.indexOf(e)+1;const delta=(e.previousPosition||current)-current;return{delta,artist:e.artist}});
    const up=moves.filter(x=>x.delta>0).sort((a,b)=>b.delta-a.delta)[0];
    const down=moves.filter(x=>x.delta<0).sort((a,b)=>a.delta-b.delta)[0];
    const longest=[...selected.entries].sort((a,b)=>b.weeks-a.weeks)[0];
    return{newCount:selected.entries.filter(e=>e.previousPosition==null).length,climber:up?`▲ ${up.delta} • ${up.artist}`:"—",faller:down?`▼ ${Math.abs(down.delta)} • ${down.artist}`:"—",longest:longest?`${longest.weeks} wk • ${longest.artist}`:"—"};
  },[selected]);
  const duplicateCount=useMemo(()=>{if(!selected)return 0;const seen=new Set<string>();let d=0;selected.entries.forEach(e=>{const k=songKey(e.artist,e.title);if(seen.has(k))d++;seen.add(k)});return d},[selected]);
  const activePrograms=Array.from(new Set(programs.filter(p=>p.active!==false).map(p=>p.name).filter(Boolean))).sort();

  if(stationSlug==="all")return <div className="card"><div className="empty-live-state"><strong>Kies eerst één station</strong><span>Hitlijsten zijn station-specifiek.</span></div></div>;

  return <div>
    <div className="page-intro"><div><h2>Hitlijsten</h2><p>Maak, rangschik, bespreek en publiceer hitlijsten volledig binnen VLACORA.</p><div className="button-row"><span className={`cloud-state ${cloudActive?"online":"local"}`}>{cloudActive?(syncing?"Teamcloud synchroniseert…":"Teamcloud actief"):`Lokaal op dit toestel`}</span></div></div><div className="button-row"><button className="ghost" onClick={refreshSources}>↻ Muziek/programmering</button><button className="primary" onClick={()=>setShowCreate(!showCreate)}>+ Nieuwe hitlijst</button></div></div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}
    {showCreate&&<section className="card chart-create-card"><div className="module-title-row"><div><h3>Nieuwe hitlijst / historische editie</h3><small>Maak een weeklijst, jaarlijst of eenmalige special. Je kunt daarna rechtstreeks een Excel-bestand importeren.</small></div><button className="mini-btn" onClick={()=>setShowCreate(false)}>×</button></div><form className="chart-create-grid" onSubmit={create}>
      <label className="field">Naam / reeks<input className="input" name="name" required placeholder="bv. Super 50"/></label>
      <label className="field">Type<select className="select" name="chartKind" defaultValue="weekly"><option value="weekly">Wekelijkse hitlijst</option><option value="annual">Jaarlijst / jaarlijks</option><option value="special">Special / eenmalig (bv. Top 1000)</option></select></label>
      <label className="field">Editielabel<input className="input" name="editionLabel" placeholder="bv. Week 36 • 2026"/></label>
      <label className="field">Top<select className="select" name="size" defaultValue="50">{SIZES.map(n=><option value={n} key={n}>Top {n}</option>)}</select></label>
      <label className="field">Publicatiedatum<input className="input" type="date" name="publishDate" defaultValue={today()}/></label>
      <label className="field">Geldig van<input className="input" type="date" name="validFrom" defaultValue={today()}/></label>
      <label className="field">Geldig t/m<input className="input" type="date" name="validTo" defaultValue={addDays(today(),6)}/></label>
      <label className="field">Jaar<input className="input" type="number" name="editionYear" min="1900" max="2200" defaultValue={new Date().getFullYear()}/></label>
      <label className="field">Weeknummer<input className="input" type="number" name="editionWeek" min="1" max="53" defaultValue={isoWeek(today())}/></label>
      <label className="field">Vorige editie<select className="select" name="previousEditionId"><option value="">Automatisch / geen</option>{orderedCharts.map(c=><option value={c.id} key={c.id}>{c.name} • {c.editionLabel}</option>)}</select></label>
      <label className="field">Programma<select className="select" name="programName"><option value="">Niet gekoppeld</option>{activePrograms.map(n=><option key={n}>{n}</option>)}</select></label>
      <label className="field">Reeks-code<input className="input" name="seriesKey" placeholder="leeg = automatisch uit naam"/></label>
      <div className="button-row chart-create-actions"><button className="ghost" type="button" onClick={()=>setShowCreate(false)}>Annuleren</button><button className="primary" type="submit">Hitlijst aanmaken</button></div>
    </form></section>}

    <div className="chart-v11-layout">
      <div className="card chart-editions-panel">
        <div className="module-title-row"><div><h3>Edities</h3><small>{charts.length} hitlijsten</small></div></div>
        {orderedCharts.length===0&&<div className="empty-live-state"><strong>Nog geen hitlijsten</strong><span>Maak bijvoorbeeld een Top 50, Top 100, jaarlijst of themalijst aan.</span></div>}
        {orderedCharts.map(c=><button key={c.id} className={`chart-edition-row ${selected?.id===c.id?"selected":""}`} onClick={()=>setSelectedId(c.id)}><div><strong>{c.name}</strong><span>{c.editionLabel}</span><small>{c.validFrom||"—"} → {c.validTo||"—"}</small></div><b className={`chart-status ${c.status}`}>{c.status==="published"?"LIVE":c.status==="archived"?"ARCHIEF":"CONCEPT"}</b></button>)}
      </div>

      <div className="chart-v11-main">
        {!selected?<div className="card"><div className="empty-live-state"><strong>Maak je eerste hitlijst</strong><span>Daarna verschijnt hier de volledige rangschikking.</span></div></div>:<>
          <div className="card chart-header-card"><div className="chart-header-main"><div><span className="eyebrow">{selected.status.toUpperCase()}</span><h2>{selected.name}</h2><p>{selected.editionLabel} • Top {selected.size} • {selected.chartKind==="weekly"?"wekelijkse lijst":selected.chartKind==="annual"?"jaarlijst":"speciale lijst"} • geldig {selected.validFrom||"—"} t/m {selected.validTo||"—"}</p></div><div className="button-row"><button className="ghost" onClick={nextEdition}>Volgende editie</button><button className="ghost" onClick={duplicate}>Dupliceren</button><button className="primary soft" onClick={()=>patch({status:selected.status==="published"?"draft":"published"})}>{selected.status==="published"?"Terug naar concept":"Publiceren"}</button></div></div>
            <div className="metric-grid compact chart-metrics"><div><span>Nieuwe</span><strong>{metrics.newCount}</strong></div><div><span>Grootste stijger</span><strong>{metrics.climber}</strong></div><div><span>Grootste daler</span><strong>{metrics.faller}</strong></div><div><span>Langst genoteerd</span><strong>{metrics.longest}</strong></div></div>
            {(selected.entries.length!==selected.size||duplicateCount>0)&&<div className="chart-validation"><strong>Controle</strong><span>{selected.entries.length}/{selected.size} posities gevuld{duplicateCount?` • ${duplicateCount} dubbele song(s)`:""}.</span></div>}
          </div>

          <div className="card chart-settings-card"><div className="module-title-row"><div><h3>Editie-instellingen</h3><small>Programmering en geldigheidsperiode blijven aan deze editie gekoppeld.</small></div><div className="button-row"><button className="ghost" onClick={exportCsv}>CSV</button><button className="ghost" onClick={exportPdf}>PDF</button></div></div><div className="chart-settings-grid">
            <label className="field">Naam<input className="input" value={selected.name} onChange={e=>patch({name:e.target.value})}/></label><label className="field">Editie<input className="input" value={selected.editionLabel} onChange={e=>patch({editionLabel:e.target.value})}/></label>
            <label className="field">Type<select className="select" value={selected.chartKind||"weekly"} onChange={e=>{const kind=e.target.value as Hitlist["chartKind"];patch({chartKind:kind,recurrence:kind==="weekly"?"weekly":kind==="annual"?"annual":"none",editionWeek:kind==="weekly"?(selected.editionWeek||isoWeek(selected.publishDate||today())):null})}}><option value="weekly">Wekelijkse hitlijst</option><option value="annual">Jaarlijst / jaarlijks</option><option value="special">Special / eenmalig</option></select></label><label className="field">Reeks<input className="input" value={selected.seriesKey||seriesKeyFor(selected.name)} onChange={e=>patch({seriesKey:e.target.value})} placeholder="bv. super-50"/></label><label className="field">Top<select className="select" value={selected.size} onChange={e=>patch({size:Number(e.target.value)})}>{Array.from(new Set([...SIZES,selected.size])).sort((a,b)=>a-b).map(n=><option value={n} key={n}>Top {n}</option>)}</select></label>
            <label className="field">Programma<select className="select" value={selected.programName||""} onChange={e=>patch({programName:e.target.value})}><option value="">Niet gekoppeld</option>{activePrograms.map(n=><option key={n}>{n}</option>)}</select></label>
            <label className="field">Geldig van<input type="date" className="input" value={selected.validFrom||""} onChange={e=>patch({validFrom:e.target.value})}/></label><label className="field">Geldig t/m<input type="date" className="input" value={selected.validTo||""} onChange={e=>patch({validTo:e.target.value})}/></label>
            <label className="field">Publicatiedatum<input type="date" className="input" value={selected.publishDate||""} onChange={e=>patch({publishDate:e.target.value})}/></label><label className="field">Vorige editie<select className="select" value={selected.previousEditionId||""} onChange={e=>{const next={...selected,previousEditionId:e.target.value};const entries=historyFor(selected.entries,next);setCharts(recalculateHistories(charts.map(c=>c.id===selected.id?{...next,entries,updatedAt:new Date().toISOString()}:c)))}}><option value="">Geen</option>{orderedCharts.filter(c=>c.id!==selected.id).map(c=><option value={c.id} key={c.id}>{c.name} • {c.editionLabel}</option>)}</select></label>
          </div>{selected.sourceLabel&&<div className="import-source-note">Bron: {selected.sourceLabel}</div>}<label className="field">Notities<textarea className="input textarea" value={selected.notes||""} onChange={e=>patch({notes:e.target.value})} placeholder="Uitzendafspraken, sponsor, voice-over, herhaling…"/></label></div>

          <div className="card chart-source-card"><div className="module-title-row"><div><h3>Songs toevoegen</h3><small>Kies uit VLACORA Muziek, voeg handmatig toe of plak een lijst uit Excel.</small></div><button className="ghost" onClick={()=>setShowSources(!showSources)}>{showSources?"Verberg bronnen":"+ Songs toevoegen"}</button></div>
            {showSources&&<div className="chart-source-grid">
              <div className="chart-source-box"><strong>VLACORA muziekbibliotheek</strong><select className="select" value={selectedLocalSong} onChange={e=>setSelectedLocalSong(e.target.value)}><option value="">Kies song…</option>{localSongs.slice().sort((a,b)=>`${a.artist}${a.title}`.localeCompare(`${b.artist}${b.title}`)).map(s=><option value={s.id} key={s.id}>{s.artist} — {s.title} • {s.musicFolder}</option>)}</select><button className="ghost" disabled={!selectedLocalSong} onClick={()=>{const s=localSongs.find(x=>x.id===selectedLocalSong);if(s)addEntry({id:s.id,artist:s.artist,title:s.title})}}>Toevoegen</button>{!localSongs.length&&<small>Open Muziek om eerst songs toe te voegen.</small>}</div>
              <div className="chart-source-box"><strong>Handmatig</strong><input className="input" value={manualArtist} onChange={e=>setManualArtist(e.target.value)} placeholder="Artiest"/><input className="input" value={manualTitle} onChange={e=>setManualTitle(e.target.value)} placeholder="Titel"/><button className="ghost" onClick={()=>{addEntry({artist:manualArtist,title:manualTitle});setManualArtist("");setManualTitle("")}}>Toevoegen</button></div>
              <div className="chart-source-box"><strong>Excel import</strong><label className="ghost file-button">Excel kiezen<input type="file" accept=".xlsx,.xls" hidden onChange={e=>void importExcel(e.target.files?.[0])}/></label><small>Herkent kolommen zoals DW/Positie, Artiest en Titel. Trend, weken en peak worden uit eerdere edities berekend.</small><button className="ghost" onClick={()=>setShowBulk(!showBulk)}>Of plak meerdere songs</button></div>
            </div>}
            {showBulk&&<div className="chart-bulk-box"><textarea className="input textarea" value={bulkText} onChange={e=>setBulkText(e.target.value)} placeholder={'ANOTR\tTalk To You\nBebe Rexha\tNew Religion\nHUGEL - Movin To The Sun'}/><div className="button-row"><button className="ghost" onClick={()=>setShowBulk(false)}>Annuleren</button><button className="primary" onClick={addBulk}>Lijst toevoegen</button></div></div>}
          </div>

          <div className="card table-card chart-table-card"><div className="module-title-row"><div><h3>Rangschikking</h3><small>Sleep regels of gebruik de pijlen. Vorige positie, trend, weken en peak worden automatisch berekend.</small></div><strong>{selected.entries.length}/{selected.size}</strong></div>
            {selected.entries.length===0?<div className="empty-live-state"><strong>Deze editie is leeg</strong><span>Voeg songs toe via de VLACORA-muziekbibliotheek, handmatig of via bulk plakken.</span></div>:<div className="chart-table-scroll"><table className="chart-editor-table"><thead><tr><th>#</th><th>Vorige</th><th>Artiest</th><th>Titel</th><th>Trend</th><th>Weken</th><th>Peak</th><th>Notitie</th><th></th></tr></thead><tbody>{selected.entries.map((e,i)=><tr key={e.id} draggable onDragStart={()=>setDragIndex(i)} onDragOver={ev=>ev.preventDefault()} onDrop={()=>{if(dragIndex!=null)move(dragIndex,i);setDragIndex(null)}} className={dragIndex===i?"dragging":""}><td className="chart-rank"><span className="drag-handle">⋮⋮</span><strong>{i+1}</strong></td><td>{e.previousPosition==null?<span className="new-chip">NEW</span>:e.previousPosition}</td><td><input className="chart-cell-input" value={e.artist} onChange={ev=>updateEntry(e.id,{artist:ev.target.value})}/></td><td><input className="chart-cell-input" value={e.title} onChange={ev=>updateEntry(e.id,{title:ev.target.value})}/></td><td className={trendText(e,i).startsWith("▲")?"positive":trendText(e,i).startsWith("▼")?"negative":""}>{trendText(e,i)}</td><td>{e.weeks}</td><td>{e.peak}</td><td><input className="chart-cell-input note" value={e.notes} onChange={ev=>updateEntry(e.id,{notes:ev.target.value})} placeholder="optioneel"/></td><td><div className="chart-row-actions"><button className="mini-btn" disabled={i===0} onClick={()=>move(i,i-1)}>↑</button><button className="mini-btn" disabled={i===selected.entries.length-1} onClick={()=>move(i,i+1)}>↓</button><button className="mini-btn danger" onClick={()=>removeEntry(e.id)}>×</button></div></td></tr>)}</tbody></table></div>}
          </div>

          <div className="chart-footer-actions"><button className="ghost" onClick={()=>patch({status:"archived"})}>Archiveer editie</button><button className="ghost danger-text" onClick={deleteChart}>Verwijder hitlijst</button></div>
        </>}
      </div>
    </div>
  </div>
}
