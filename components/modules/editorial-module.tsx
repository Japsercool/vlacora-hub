"use client";

import { useEffect, useMemo, useState } from "react";
import type { MusicSong } from "@/components/modules/music-library-module";
import { shows, stations } from "@/lib/mock-data";

type EditorialType = "music" | "talk" | "imaging" | "promo" | "weather" | "traffic" | "news" | "commercial";
type EditorialItem = {
  id: string;
  time: string;
  type: EditorialType;
  artist?: string;
  title: string;
  duration: string;
  presenterText: string;
  notes: string;
  source: "Rotation One" | "Playout One" | "VLACORA";
  locked?: boolean;
  musicId?: string;
};
type TemplateBlock = {
  id: string;
  type: EditorialType;
  name: string;
  text: string;
  required: boolean;
};
type ProgramTemplate = {
  id: string;
  name: string;
  program: string;
  station: string;
  opening: string;
  closing: string;
  blocks: TemplateBlock[];
};
type TemplateLink = {
  program: string;
  templateId: string;
};
type IntegrationState = {
  mode: "demo" | "api";
  rotationStationId: string;
  playoutStationId: string;
  rotationStationName: string;
  playoutStationName: string;
  lastPull: string;
  lastPush: string;
  lastStatus: string;
  playlistVersion: number;
};

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const seedPlaylist: EditorialItem[] = [
  {id:"e1",time:"16:00:00",type:"imaging",title:"TOTH - Versuz Radio",duration:"00:08",presenterText:"",notes:"Station imaging",source:"Rotation One",locked:true},
  {id:"e2",time:"16:00:08",type:"music",artist:"HUGEL",title:"Movin' To The Sun",duration:"02:57",presenterText:"Nieuwe muziek van HUGEL. Dit is Movin' To The Sun.",notes:"A-rotatie",source:"Rotation One",musicId:"ms3"},
  {id:"e3",time:"16:03:05",type:"talk",title:"Presenter break",duration:"00:35",presenterText:"Straks hoor je de nieuwe Bebe Rexha. Eerst even dit...",notes:"Vrije break",source:"VLACORA"},
  {id:"e4",time:"16:03:40",type:"music",artist:"Bebe Rexha",title:"New Religion",duration:"03:01",presenterText:"Bebe Rexha met New Religion. Een van de nieuwe platen deze week.",notes:"B-rotatie",source:"Rotation One",musicId:"ms5"},
  {id:"e5",time:"16:06:41",type:"promo",title:"Weekend promo",duration:"00:20",presenterText:"Dit weekend hoor je onze nieuwe weekendprogrammering.",notes:"Promo",source:"VLACORA"},
  {id:"e6",time:"16:07:01",type:"commercial",title:"Commercial block",duration:"02:30",presenterText:"",notes:"Traffic block",source:"Rotation One",locked:true},
  {id:"e7",time:"16:09:31",type:"music",artist:"Topic & Becky G",title:"Sorry Papi",duration:"02:49",presenterText:"Topic en Becky G samen op Sorry Papi.",notes:"B-rotatie",source:"Rotation One",musicId:"ms4"},
  {id:"e8",time:"16:12:20",type:"weather",title:"Weer",duration:"00:25",presenterText:"Vandaag zacht en wisselend bewolkt. Later meer opklaringen.",notes:"Update voor uitzending",source:"VLACORA"},
  {id:"e9",time:"16:12:45",type:"music",artist:"Joel Corry",title:"Whisper",duration:"03:05",presenterText:"Joel Corry is deze week onze Tune of the Week. Dit is Whisper.",notes:"Tune of the Week",source:"Rotation One",musicId:"ms1"},
  {id:"e10",time:"16:15:50",type:"news",title:"Nieuws 16:00",duration:"02:00",presenterText:"",notes:"Extern nieuwsitem",source:"Playout One",locked:true}
];

const seedTemplates: ProgramTemplate[] = [
  {
    id:"tpl-drive",name:"Drive standaard",program:"Drive",station:"versuz",
    opening:"Welkom bij Drive op {station}. {presenter} is er tot {end}.",
    closing:"Dit was Drive. Straks hoor je {next_program}.",
    blocks:[
      {id:"b1",type:"talk",name:"Openingsbreak",text:"Welkom bij Drive. Dit is {presenter} en we zijn er tot {end}.",required:true},
      {id:"b2",type:"traffic",name:"Verkeer",text:"Een korte verkeersupdate voor wie onderweg is:",required:true},
      {id:"b3",type:"weather",name:"Weer",text:"Nog even het weer voor vanavond:",required:false},
      {id:"b4",type:"promo",name:"Volgend programma",text:"Straks op {station}: {next_program}.",required:false},
      {id:"b5",type:"talk",name:"Nieuwe muziek",text:"Nieuwe muziek op {station}: {song.artist} met {song.title}.",required:false},
      {id:"b6",type:"talk",name:"Closing",text:"Tot zover Drive. Bedankt voor het luisteren!",required:true}
    ]
  },
  {
    id:"tpl-morning",name:"Morning Club",program:"Morning Club",station:"versuz",
    opening:"Goedemorgen! Dit is Morning Club op {station}.",
    closing:"Morning Club zit erop. Straks is {next_program} er voor je.",
    blocks:[
      {id:"m1",type:"talk",name:"Open",text:"Goedemorgen! {presenter} hier op {station}.",required:true},
      {id:"m2",type:"weather",name:"Weer",text:"Dit mag je vandaag van het weer verwachten:",required:true},
      {id:"m3",type:"traffic",name:"Verkeer",text:"Dit moet je weten voor onderweg:",required:true},
      {id:"m4",type:"promo",name:"Vandaag op de zender",text:"Later vandaag hoor je {next_program}.",required:false}
    ]
  },
  {
    id:"tpl-workday",name:"Algemene muziekshow",program:"Workday",station:"all",
    opening:"Je luistert naar {program} op {station}.",
    closing:"Bedankt voor het luisteren naar {program}.",
    blocks:[
      {id:"w1",type:"talk",name:"Open",text:"Je luistert naar {program} met {presenter}.",required:true},
      {id:"w2",type:"talk",name:"Songintro",text:"Dit is {song.artist} met {song.title}.",required:false},
      {id:"w3",type:"promo",name:"Promo",text:"Blijf luisteren naar {station}.",required:false}
    ]
  }
];

const seedLinks: TemplateLink[] = [
  {program:"Drive",templateId:"tpl-drive"},
  {program:"Morning Club",templateId:"tpl-morning"},
  {program:"Workday",templateId:"tpl-workday"}
];

const musicSeed: MusicSong[] = [
  {id:"ms1",artist:"Joel Corry",title:"Whisper",category:"Current",rotationMap:"A-ROTATIE",year:"2026",notes:"Tune of the Week",presentationText:"Joel Corry is deze week onze Tune of the Week. Dit is Whisper."},
  {id:"ms2",artist:"ANOTR & 54 Ultra",title:"Talk To You",category:"Current",rotationMap:"A-ROTATIE",year:"2026",notes:"",presentationText:"ANOTR en 54 Ultra met Talk To You."},
  {id:"ms3",artist:"HUGEL",title:"Movin' To The Sun",category:"Current",rotationMap:"A-ROTATIE",year:"2026",notes:"",presentationText:"Nieuwe muziek van HUGEL. Dit is Movin' To The Sun."},
  {id:"ms4",artist:"Topic & Becky G",title:"Sorry Papi",category:"Current",rotationMap:"B-ROTATIE",year:"2026",notes:"",presentationText:"Topic en Becky G samen op Sorry Papi."},
  {id:"ms5",artist:"Bebe Rexha",title:"New Religion",category:"Current",rotationMap:"B-ROTATIE",year:"2026",notes:"",presentationText:"Bebe Rexha met New Religion."}
];

function useStored<T>(key:string, initial:T) {
  const [value,setValue] = useState<T>(initial);
  const [ready,setReady] = useState(false);
  useEffect(()=>{try{const raw=localStorage.getItem(key);if(raw)setValue(JSON.parse(raw))}catch{}setReady(true)},[key]);
  useEffect(()=>{if(ready)try{localStorage.setItem(key,JSON.stringify(value))}catch{}},[key,ready,value]);
  return [value,setValue] as const;
}

function substitute(text:string, values:Record<string,string>) {
  let result = text;
  for (const [key,value] of Object.entries(values)) result = result.replaceAll(`{${key}}`, value);
  return result;
}

export default function EditorialModule({stationSlug}:{stationSlug:string}) {
  const station = stations.find(s=>s.slug===stationSlug) || stations[1];
  const [tab,setTab] = useState<"playlist"|"templates"|"koppeling">("playlist");
  const [date,setDate] = useState("2026-09-01");
  const [hour,setHour] = useState("16:00");
  const [program,setProgram] = useState("Drive");
  const [playlist,setPlaylist] = useStored<EditorialItem[]>(`vlacora:${station.slug}:editorial:playlist:${date}:${hour}`,seedPlaylist);
  const [templates,setTemplates] = useStored<ProgramTemplate[]>(`vlacora:${station.slug}:editorial:templates`,seedTemplates);
  const [links,setLinks] = useStored<TemplateLink[]>(`vlacora:${station.slug}:editorial:links`,seedLinks);
  const [music,setMusic] = useStored<MusicSong[]>(`vlacora:${station.slug}:music:catalog`,musicSeed);
  const [selectedId,setSelectedId] = useState(seedPlaylist[1].id);
  const [notice,setNotice] = useState("");
  const [integration,setIntegration] = useStored<IntegrationState>(`vlacora:${station.slug}:editorial:integration`,{
    mode:"demo",rotationStationId:"rotation-versuz",playoutStationId:"playout-versuz",
    rotationStationName:"Versuz Radio",playoutStationName:"Versuz Radio",
    lastPull:"nog niet",lastPush:"nog niet",lastStatus:"Nog niet getest",playlistVersion:24
  });

  const selected = playlist.find(i=>i.id===selectedId) || playlist[0];
  const linkedTemplate = templates.find(t=>t.id===links.find(l=>l.program===program)?.templateId);
  const programs = Array.from(new Set([...shows.map(s=>s.name),...templates.map(t=>t.program)]));

  function flash(text:string){setNotice(text);setTimeout(()=>setNotice(""),2600)}
  function updateSelected(patch:Partial<EditorialItem>){if(!selected)return;setPlaylist(playlist.map(i=>i.id===selected.id?{...i,...patch}:i))}
  function move(index:number,dir:-1|1){
    const target=index+dir;if(target<0||target>=playlist.length)return;
    if(playlist[index].locked||playlist[target].locked)return flash("Dit systeemitem is vergrendeld.");
    const next=[...playlist];[next[index],next[target]]=[next[target],next[index]];setPlaylist(next);flash("Volgorde aangepast");
  }
  function addMusic(songId:string){
    const song=music.find(s=>s.id===songId);if(!song)return;
    const item:EditorialItem={id:uid(),time:hour,type:"music",artist:song.artist,title:song.title,duration:"03:00",presenterText:song.presentationText||"",notes:song.rotationMap,source:"VLACORA",musicId:song.id};
    setPlaylist([...playlist,item]);setSelectedId(item.id);flash("Song toegevoegd");
  }
  function addBlock(type:EditorialType,name:string,text:string){
    const item:EditorialItem={id:uid(),time:hour,type,title:name,duration:"00:30",presenterText:text,notes:"Uit programmasjabloon",source:"VLACORA"};
    setPlaylist([...playlist,item]);setSelectedId(item.id);flash("Redactie-item toegevoegd");
  }
  function applyTemplate(){
    if(!linkedTemplate)return flash("Geen sjabloon gekoppeld aan dit programma.");
    const values={station:station.name,presenter:"Jasper",program,end:"18:00",next_program:"The Partyroom","song.artist":selected?.artist||"","song.title":selected?.title||""};
    const items=linkedTemplate.blocks.map((b,index)=>({
      id:uid(),time:hour,type:b.type,title:b.name,duration:"00:30",
      presenterText:substitute(b.text,values),notes:`Sjabloon: ${linkedTemplate.name}`,source:"VLACORA" as const
    }));
    setPlaylist([...playlist,...items]);flash(`${items.length} sjabloonitems toegevoegd`);
  }
  async function pullRotation(){
    if(integration.mode==="demo"){setIntegration({...integration,lastPull:new Date().toLocaleTimeString("nl-BE"),playlistVersion:integration.playlistVersion+1,lastStatus:"Demo pull geslaagd"});flash("Demo: Rotation One playlist vernieuwd");return}
    try{
      const q=new URLSearchParams({stationId:integration.rotationStationId,date,hour});
      const res=await fetch(`/api/radio/rotation/playlist?${q.toString()}`);
      if(!res.ok)throw new Error(await res.text());
      const data=await res.json();
      if(Array.isArray(data.items)) setPlaylist(data.items);
      setIntegration({...integration,lastPull:new Date().toLocaleTimeString("nl-BE"),playlistVersion:Number(data.version||integration.playlistVersion),lastStatus:"Rotation One verbonden"});
      flash("Playlist uit Rotation One geladen");
    }catch(e){setIntegration({...integration,lastStatus:"Rotation One fout"});flash("Rotation One kon niet worden bereikt");}
  }
  async function pushRotation(){
    if(integration.mode==="demo"){setIntegration({...integration,lastPush:new Date().toLocaleTimeString("nl-BE"),playlistVersion:integration.playlistVersion+1,lastStatus:"Demo push geslaagd"});flash("Demo: wijzigingen naar Rotation One verzonden");return}
    try{
      const res=await fetch("/api/radio/rotation/playlist",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({stationId:integration.rotationStationId,date,hour,items:playlist})});
      if(!res.ok)throw new Error(await res.text());
      const data=await res.json();
      setIntegration({...integration,lastPush:new Date().toLocaleTimeString("nl-BE"),playlistVersion:Number(data.version||integration.playlistVersion+1),lastStatus:"Wijzigingen verzonden"});
      flash("Rotation One bijgewerkt");
    }catch(e){setIntegration({...integration,lastStatus:"Push mislukt"});flash("Wijzigingen konden niet naar Rotation One");}
  }
  async function testConnections(){
    if(integration.mode==="demo"){setIntegration({...integration,lastStatus:"Demo: Rotation One + Playout One online"});flash("Demo verbindingen zijn online");return}
    try{
      const res=await fetch(`/api/radio/status?rotationStationId=${encodeURIComponent(integration.rotationStationId)}&playoutStationId=${encodeURIComponent(integration.playoutStationId)}`);
      const data=await res.json();
      setIntegration({...integration,lastStatus:`Rotation ${data.rotation?.online?"online":"offline"} • Playout ${data.playout?.online?"online":"offline"}`});
      flash("Verbindingsstatus vernieuwd");
    }catch{setIntegration({...integration,lastStatus:"Statuscontrole mislukt"});flash("Statuscontrole mislukt");}
  }

  return <div>
    <div className="page-intro">
      <div><h2>Redactie & uitzending</h2><p>Bewerk de Rotation One-playlist, schrijf teksten bij ieder item en koppel redactiesjablonen aan programma&apos;s.</p></div>
      <div className="button-row"><button className="ghost" onClick={pullRotation}>↻ Playlist ophalen</button><button className="primary" onClick={pushRotation}>Wijzigingen publiceren</button></div>
    </div>

    <div className="editorial-tabs">
      <button className={tab==="playlist"?"active":""} onClick={()=>setTab("playlist")}>Playlist & teksten</button>
      <button className={tab==="templates"?"active":""} onClick={()=>setTab("templates")}>Programmasjablonen</button>
      <button className={tab==="koppeling"?"active":""} onClick={()=>setTab("koppeling")}>Rotation / Playout koppeling</button>
    </div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}

    {tab==="playlist"&&<>
      <div className="card editorial-toolbar">
        <label className="field">Datum<input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
        <label className="field">Uur<select className="select" value={hour} onChange={e=>setHour(e.target.value)}>{["06:00","07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"].map(x=><option key={x}>{x}</option>)}</select></label>
        <label className="field">Programma<select className="select" value={program} onChange={e=>setProgram(e.target.value)}>{programs.map(p=><option key={p}>{p}</option>)}</select></label>
        <div className="linked-template-box"><span>Gekoppeld sjabloon</span><strong>{linkedTemplate?.name||"Geen"}</strong></div>
        <button className="primary" onClick={applyTemplate}>+ Sjabloonitems</button>
      </div>

      <div className="editorial-layout">
        <div className="card editorial-playlist">
          <div className="playlist-editor-head"><div><span className="eyebrow">PLAYLIST</span><h3>{station.name} • {date} • {hour}</h3></div><span className="version-badge">v{integration.playlistVersion}</span></div>
          <div className="editorial-columns"><span></span><span>Tijd</span><span>Item</span><span>Bron</span><span></span></div>
          {playlist.map((item,index)=><button key={item.id} className={`editorial-row ${selected?.id===item.id?"selected":""} type-${item.type}`} onClick={()=>setSelectedId(item.id)}>
            <span className="drag-mark">{item.locked?"🔒":"⋮⋮"}</span><span>{item.time}</span>
            <div><strong>{item.artist?`${item.artist} — ${item.title}`:item.title}</strong><small>{item.type} • {item.duration}{item.presenterText?" • tekst aanwezig":""}</small></div>
            <span className="source-pill">{item.source}</span>
            <span className="editorial-actions"><button disabled={item.locked} onClick={e=>{e.stopPropagation();move(index,-1)}}>↑</button><button disabled={item.locked} onClick={e=>{e.stopPropagation();move(index,1)}}>↓</button></span>
          </button>)}
        </div>

        <div className="editorial-side">
          {selected&&<div className="card editorial-inspector">
            <div className="module-title-row"><div><span className="eyebrow">REDACTIE ITEM</span><h3>{selected.artist?`${selected.artist} — ${selected.title}`:selected.title}</h3></div><span className={`type-badge ${selected.type}`}>{selected.type}</span></div>
            <div className="two-form-cols">
              <label className="field">Tijd<input className="input" value={selected.time} disabled={selected.locked} onChange={e=>updateSelected({time:e.target.value})}/></label>
              <label className="field">Duur<input className="input" value={selected.duration} onChange={e=>updateSelected({duration:e.target.value})}/></label>
            </div>
            {selected.type==="music"&&<><label className="field">Artiest<input className="input" value={selected.artist||""} onChange={e=>updateSelected({artist:e.target.value})}/></label><label className="field">Titel<input className="input" value={selected.title} onChange={e=>updateSelected({title:e.target.value})}/></label></>}
            <label className="field">Presentatietekst<textarea className="input editorial-textarea" value={selected.presenterText} onChange={e=>updateSelected({presenterText:e.target.value})} placeholder="Wat moet of kan de presentator hierbij zeggen?"/></label>
            <div className="text-tools">
              <button className="ghost" onClick={()=>updateSelected({presenterText:selected.type==="music"?`Dit is ${selected.artist} met ${selected.title}.`:`Je luistert naar ${station.name}.`})}>✨ Tekstvoorstel</button>
              {selected.musicId&&<button className="ghost" onClick={()=>{const song=music.find(s=>s.id===selected.musicId);if(song)updateSelected({presenterText:song.presentationText||""})}}>Songtekst laden</button>}
            </div>
            <label className="field">Redactienotities<textarea className="input textarea" value={selected.notes} onChange={e=>updateSelected({notes:e.target.value})}/></label>
            {!selected.locked&&<button className="ghost danger-text" onClick={()=>setPlaylist(playlist.filter(i=>i.id!==selected.id))}>Verwijder uit redactieplaylist</button>}
          </div>}

          <div className="card editorial-add">
            <h3>Item toevoegen</h3>
            <label className="field">Song uit muziekbibliotheek<select className="select" defaultValue="" onChange={e=>{if(e.target.value)addMusic(e.target.value);e.target.value=""}}><option value="">Kies een song…</option>{music.map(s=><option value={s.id} key={s.id}>{s.artist} — {s.title} • {s.rotationMap}</option>)}</select></label>
            <div className="quick-add-grid">
              {linkedTemplate?.blocks.map(b=><button key={b.id} onClick={()=>addBlock(b.type,b.name,substitute(b.text,{station:station.name,presenter:"Jasper",program,end:"18:00",next_program:"The Partyroom","song.artist":selected?.artist||"","song.title":selected?.title||""}))}><strong>{b.name}</strong><span>{b.type}</span></button>)}
            </div>
          </div>
        </div>
      </div>
    </>}

    {tab==="templates"&&<div className="template-management-layout">
      <div className="card template-program-links">
        <div className="module-title-row"><div><h3>Programma → sjabloon</h3><small>Per programma automatisch het juiste redactiesjabloon.</small></div></div>
        {programs.map(p=>{
          const link=links.find(l=>l.program===p);
          return <div className="program-link-row" key={p}><div><strong>{p}</strong><small>{shows.find(s=>s.name===p)?.host||"Programma"}</small></div><select className="select" value={link?.templateId||""} onChange={e=>setLinks([...links.filter(l=>l.program!==p),{program:p,templateId:e.target.value}])}><option value="">Geen sjabloon</option>{templates.filter(t=>t.station==="all"||t.station===station.slug).map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></div>
        })}
      </div>
      <div className="card template-editor">
        <div className="module-title-row"><div><h3>Sjablonen</h3><small>Opening, closing en vaste redactie-items.</small></div><button className="primary tiny-btn" onClick={()=>{const n:ProgramTemplate={id:uid(),name:"Nieuw sjabloon",program:"Nieuw programma",station:station.slug,opening:"",closing:"",blocks:[]};setTemplates([...templates,n])}}>＋</button></div>
        {templates.map(t=><details key={t.id} className="template-detail" open={t.id===linkedTemplate?.id}><summary><strong>{t.name}</strong><span>{t.program} • {t.blocks.length} items</span></summary><div className="template-edit-body">
          <div className="two-form-cols"><label className="field">Naam<input className="input" value={t.name} onChange={e=>setTemplates(templates.map(x=>x.id===t.id?{...x,name:e.target.value}:x))}/></label><label className="field">Programma<input className="input" value={t.program} onChange={e=>setTemplates(templates.map(x=>x.id===t.id?{...x,program:e.target.value}:x))}/></label></div>
          <label className="field">Opening<textarea className="input textarea" value={t.opening} onChange={e=>setTemplates(templates.map(x=>x.id===t.id?{...x,opening:e.target.value}:x))}/></label>
          <label className="field">Closing<textarea className="input textarea" value={t.closing} onChange={e=>setTemplates(templates.map(x=>x.id===t.id?{...x,closing:e.target.value}:x))}/></label>
          <div className="template-block-list">{t.blocks.map((b,index)=><div className="template-block" key={b.id}><div><strong>{b.name}</strong><span>{b.type}{b.required?" • verplicht":""}</span></div><input className="input" value={b.text} onChange={e=>setTemplates(templates.map(x=>x.id===t.id?{...x,blocks:x.blocks.map(y=>y.id===b.id?{...y,text:e.target.value}:y)}:x))}/><button className="mini-btn danger" onClick={()=>setTemplates(templates.map(x=>x.id===t.id?{...x,blocks:x.blocks.filter(y=>y.id!==b.id)}:x))}>×</button></div>)}</div>
          <button className="ghost" onClick={()=>setTemplates(templates.map(x=>x.id===t.id?{...x,blocks:[...x.blocks,{id:uid(),type:"talk",name:"Nieuw item",text:"Nieuwe redactietekst",required:false}]}:x))}>+ Item</button>
        </div></details>)}
      </div>
    </div>}

    {tab==="koppeling"&&<div className="integration-grid">
      <div className="card">
        <h3>Architectuur</h3>
        <div className="architecture-flow"><span>VLACORA browser</span><b>→</b><span>Vercel API proxy</span><b>→</b><span>Vast openbaar IP</span><b>→</b><span>Rotation One / Playout One</span></div>
        <p className="muted">Ook met een openbaar vast IP laat VLACORA de browser niet rechtstreeks met je radio-API praten. De Vercel server-route bewaart secrets aan de serverkant en voorkomt CORS- en beveiligingsproblemen.</p>
      </div>
      <div className="card">
        <div className="module-title-row"><div><h3>Station mapping</h3><small>VLACORA herkent welk station bij welke API-station-ID hoort.</small></div></div>
        <label className="field">Modus<select className="select" value={integration.mode} onChange={e=>setIntegration({...integration,mode:e.target.value as "demo"|"api"})}><option value="demo">Demo</option><option value="api">Echte API via Vercel proxy</option></select></label>
        <label className="field">VLACORA station<input className="input" value={station.name} disabled/></label>
        <div className="two-form-cols">
          <label className="field">Rotation One Station ID<input className="input" value={integration.rotationStationId} onChange={e=>setIntegration({...integration,rotationStationId:e.target.value})}/></label>
          <label className="field">Rotation One naam<input className="input" value={integration.rotationStationName} onChange={e=>setIntegration({...integration,rotationStationName:e.target.value})}/></label>
          <label className="field">Playout One Station ID<input className="input" value={integration.playoutStationId} onChange={e=>setIntegration({...integration,playoutStationId:e.target.value})}/></label>
          <label className="field">Playout One naam<input className="input" value={integration.playoutStationName} onChange={e=>setIntegration({...integration,playoutStationName:e.target.value})}/></label>
        </div>
        <button className="primary" onClick={testConnections}>Test verbindingen</button>
      </div>
      <div className="card">
        <h3>Wat VLACORA kan ophalen</h3>
        <div className="capability-list">
          {["Stations + station-ID's","Playlist per datum/uur","Playlist item-ID's","Artiest, titel, type en duur","Rotation map/categorie","Cue/mix metadata indien API beschikbaar","Playlistversie / gewijzigd op","Now playing / next","Playout status","Nieuws / externe items","Stream/encoder status","Laatste sync / errors"].map(x=><span key={x}>✓ {x}</span>)}
        </div>
      </div>
      <div className="card">
        <h3>Status</h3>
        <div className="integration-status"><span>Laatste status</span><strong>{integration.lastStatus}</strong></div>
        <div className="integration-status"><span>Rotation pull</span><strong>{integration.lastPull}</strong></div>
        <div className="integration-status"><span>Rotation push</span><strong>{integration.lastPush}</strong></div>
        <div className="integration-status"><span>Playlistversie</span><strong>{integration.playlistVersion}</strong></div>
      </div>
    </div>}
  </div>
}
