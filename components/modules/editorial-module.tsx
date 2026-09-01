"use client";

import { useEffect, useMemo, useState } from "react";
import type { MusicSong } from "@/components/modules/music-library-module";
import { useHubStation } from "@/lib/radio/hub-stations";
import { pathFor,radioRead,readIntegration,readMappings,readSecret,readStationCache,saveMappings,saveStationCache,type RadioMappingStore,type RadioStation } from "@/lib/radio/client-config";
import { emitActivity } from "@/lib/collaboration/activity";
import { hydrateSharedIntegrationSettings,loadSharedRadioMapping,saveSharedRadioMapping } from "@/lib/supabase/settings";
import { loadSharedPlayoutStations,syncSharedPlayoutStations } from "@/lib/supabase/hub-data";

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

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const seedTemplates: ProgramTemplate[] = [
  {
    id:"tpl-drive",name:"Drive standaard",program:"Drive",station:"all",
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
    id:"tpl-morning",name:"Morning Club",program:"Morning Club",station:"all",
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
  const station = useHubStation(stationSlug);
  const [tab,setTab] = useState<"playlist"|"templates"|"koppeling">("playlist");
  const [date,setDate] = useState("2026-09-01");
  const [hour,setHour] = useState("16:00");
  const [program,setProgram] = useState("Drive");
  const [playlist,setPlaylist] = useStored<EditorialItem[]>(`vlacora:${station.slug}:editorial:playlist:${date}:${hour}`,[]);
  const [templates,setTemplates] = useStored<ProgramTemplate[]>(`vlacora:${station.slug}:editorial:templates`,seedTemplates);
  const [links,setLinks] = useStored<TemplateLink[]>(`vlacora:${station.slug}:editorial:links`,seedLinks);
  const [music,setMusic] = useStored<MusicSong[]>(`vlacora:${station.slug}:music:catalog`,musicSeed);
  const [selectedId,setSelectedId] = useState("");
  const [notice,setNotice] = useState("");
  const [mappings,setMappingsState] = useState<RadioMappingStore>({});
  const [rotationStations,setRotationStations] = useState<RadioStation[]>([]);
  const [playoutStations,setPlayoutStations] = useState<RadioStation[]>([]);
  const [lastPull,setLastPull] = useState("nog niet");
  const [lastStatus,setLastStatus] = useState("Nog niet getest");
  const [playlistVersion,setPlaylistVersion] = useState<string>("—");
  const [programmingPrograms,setProgrammingPrograms] = useState<{name:string;host:string}[]>([]);
  useEffect(()=>{
    let alive=true;
    const refreshCaches=()=>{setRotationStations(readStationCache("rotation"));setPlayoutStations(readStationCache("playout"))};
    (async()=>{
      await hydrateSharedIntegrationSettings(station.slug).catch(()=>false);
      const shared=await loadSharedRadioMapping(station.slug).catch(()=>null);if(!alive)return;
      const local=readMappings();const next=shared?{...local,[station.slug]:{...local[station.slug],...shared}}:local;setMappingsState(next);if(shared)saveMappings(next);
      if(readStationCache("playout").length===0){const sharedPlayout=await loadSharedPlayoutStations().catch(()=>[]);if(sharedPlayout.length)saveStationCache("playout",sharedPlayout)}
      refreshCaches();
      const pc=readIntegration("playout");if(pc?.host&&readStationCache("playout").length===0&&readSecret("playout").apiKey){try{const result=await radioRead("playout",pc.stationPath,"stations");saveStationCache("playout",result.stations||[]);await syncSharedPlayoutStations(result.stations||[]).catch(()=>{});refreshCaches()}catch{}}
    })();
    const loadPrograms=()=>{try{const raw=localStorage.getItem(`vlacora:${station.slug}:programming:v10`);const items=raw?JSON.parse(raw):[];setProgrammingPrograms(Array.isArray(items)?items.filter((x:any)=>x?.active!==false).map((x:any)=>({name:String(x.name||"Programma"),host:String(x.host||"")})):[])}catch{setProgrammingPrograms([])}};
    loadPrograms();window.addEventListener("vlacora:programming-changed",loadPrograms as EventListener);window.addEventListener("vlacora:hub-stations-changed",refreshCaches as EventListener);return()=>{alive=false;window.removeEventListener("vlacora:programming-changed",loadPrograms as EventListener);window.removeEventListener("vlacora:hub-stations-changed",refreshCaches as EventListener)};
  },[station.slug]);
  const mapping=mappings[station.slug]||{rotationId:station.rotationId||"",rotationName:station.rotationId?station.name:"",playoutId:"",playoutName:""};
  function setMapping(patch:Partial<typeof mapping>){const value={...mapping,...patch};const next={...mappings,[station.slug]:value};setMappingsState(next);saveMappings(next);void saveSharedRadioMapping(station.slug,value).catch(()=>{})}

  const selected = playlist.find(i=>i.id===selectedId) || playlist[0];
  useEffect(()=>{emitActivity({detail:selected?`Redactie • ${date} ${hour} • ${selected.artist?`${selected.artist} – `:""}${selected.title}`:`Redactie • ${date} ${hour}`,entityType:"playlist-item",entityId:selected?.id})},[selected?.id,selected?.artist,selected?.title,date,hour]);

  const linkedTemplate = templates.find(t=>t.id===links.find(l=>l.program===program)?.templateId);
  const programs = Array.from(new Set([...programmingPrograms.map(s=>s.name),...templates.map(t=>t.program)]));

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
  const cfg=readIntegration("rotation");if(!cfg?.host)return flash("Stel Rotation One eerst in via Beheer → Integraties.");
  if(!mapping.rotationId)return flash("Koppel eerst dit VLACORA-station aan een echt Rotation One-station.");
  try{
    const start=new Date(`${date}T${hour}:00`);const end=new Date(start.getTime()+60*60*1000);
    let path=pathFor(cfg.playlistPath||"/api/v1/stations/{stationId}/schedule",mapping.rotationId);
    const q=new URLSearchParams({from:start.toISOString(),to:end.toISOString()});path+=`${path.includes("?")?"&":"?"}${q.toString()}`;
    const data=await radioRead("rotation",path,"playlist");
    const previous=new Map<string,EditorialItem>(playlist.map(i=>[i.id,i]));
    const incoming:EditorialItem[]=(data.items||[]).map((i:any)=>({...i,presenterText:previous.get(i.id)?.presenterText||i.presenterText||"",notes:previous.get(i.id)?.notes||i.notes||""}));
    setPlaylist(incoming);setSelectedId(incoming[0]?.id||"");setLastPull(new Date().toLocaleTimeString("nl-BE"));setPlaylistVersion(String(data.version||"—"));setLastStatus(`Rotation One: ${incoming.length} items geladen`);flash(`${incoming.length} echte Rotation One-items geladen`);
  }catch(e){setLastStatus(e instanceof Error?e.message:"Rotation One fout");flash(e instanceof Error?e.message:"Rotation One kon niet worden bereikt")}
}
async function pushRotation(){flash("Schrijven naar Rotation One staat bewust nog uit. Eerst lezen en mapping volledig valideren.")}
async function fetchPlayoutStations(){
  if(busy)return;setBusy(true);
  try{
    await hydrateSharedIntegrationSettings(station.slug).catch(()=>false);
    const pc=readIntegration("playout");if(!pc?.host)throw new Error("Playout One is nog niet ingesteld.");
    if(!readSecret("playout").apiKey)throw new Error("Playout One Bearer API-key ontbreekt in deze browsersessie. Vul hem opnieuw in bij Beheer → Integraties.");
    const result=await radioRead("playout",pc.stationPath,"stations");const list=result.stations||[];
    setPlayoutStations(list);saveStationCache("playout",list);await syncSharedPlayoutStations(list).catch(()=>{});
    flash(`${list.length} Playout One station(s) vers opgehaald`);
  }catch(e){
    const m=e instanceof Error?e.message:"Playout stations ophalen mislukt";
    flash(m.includes("401")?"HTTP 401: controleer de Playout One Bearer API-key.":m);
  }finally{setBusy(false)}
}
async function testConnections(){
  try{await hydrateSharedIntegrationSettings(station.slug).catch(()=>false);const rc=readIntegration("rotation"),pc=readIntegration("playout"),sc=readIntegration("shoutcast");const parts:string[]=[];if(rc?.host){await radioRead("rotation",rc.statusPath,"raw");parts.push("Rotation online")}else parts.push("Rotation niet ingesteld");if(pc?.host){await radioRead("playout",pc.statusPath,"raw");parts.push("Playout online")}else parts.push("Playout niet ingesteld");if(sc?.host){const s=await radioRead("shoutcast",sc.statusPath||"/stats?sid=1&json=1","raw");const raw=s.raw||{};const x=raw.streams?.[0]||raw.stream||raw.stats||raw;const listeners=Number(x.currentlisteners??x.currentListeners??x.listeners??0);parts.push(`SHOUTcast online${Number.isFinite(listeners)?` • ${listeners} luisteraar(s)`:""}`)}else parts.push("SHOUTcast niet ingesteld");setLastStatus(parts.join(" • "));flash(parts.join(" • "))}catch(e){setLastStatus(e instanceof Error?e.message:"Statuscontrole mislukt");flash(e instanceof Error?e.message:"Statuscontrole mislukt")}
}

  return <div>
    <div className="page-intro">
      <div><h2>Redactie & uitzending</h2><p>Bewerk de Rotation One-playlist, schrijf teksten bij ieder item en koppel redactiesjablonen aan programma&apos;s.</p></div>
      <div className="button-row"><button className="primary" onClick={pullRotation}>↻ Echte playlist ophalen</button><button className="ghost" onClick={pushRotation}>Publiceren (nog uit)</button></div>
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
          <div className="playlist-editor-head"><div><span className="eyebrow">PLAYLIST</span><h3>{station.name} • {date} • {hour}</h3></div><span className="version-badge">rev {playlistVersion}</span></div>
          <div className="editorial-columns"><span></span><span>Tijd</span><span>Item</span><span>Bron</span><span></span></div>
          {playlist.length===0&&<div className="empty-live-state"><strong>Nog geen playlist geladen</strong><span>Koppel een Rotation One-station en klik op “Echte playlist ophalen”. Er wordt geen demo-playlist meer getoond.</span></div>}
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
          return <div className="program-link-row" key={p}><div><strong>{p}</strong><small>{programmingPrograms.find(s=>s.name===p)?.host||"Programma"}</small></div><select className="select" value={link?.templateId||""} onChange={e=>setLinks([...links.filter(l=>l.program!==p),{program:p,templateId:e.target.value}])}><option value="">Geen sjabloon</option>{templates.filter(t=>t.station==="all"||t.station===station.slug).map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></div>
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
        <p className="muted">Ook met een openbaar vast IP laat VLACORA de browser niet rechtstreeks met je radio-API praten. De browser stuurt de tijdelijke sessiesleutel via HTTPS naar de Vercel Node-proxy. De key wordt niet permanent in localStorage of GitHub opgeslagen.</p>
      </div>
      <div className="card">
        <div className="module-title-row"><div><h3>Station mapping</h3><small>VLACORA herkent welk station bij welke API-station-ID hoort.</small></div></div>
        <label className="field">VLACORA station<input className="input" value={station.name} disabled/></label>
        <label className="field">Rotation One station<select className="select" value={mapping.rotationId} onChange={e=>{const x=rotationStations.find(s=>s.id===e.target.value);setMapping({rotationId:e.target.value,rotationName:x?.name||""})}}><option value="">Niet gekoppeld</option>{rotationStations.map(s=><option key={s.id} value={s.id}>{s.name} • {s.id}</option>)}</select></label>
        <label className="field">Playout One station<select className="select" value={mapping.playoutId} onChange={e=>{const x=playoutStations.find(s=>s.id===e.target.value);setMapping({playoutId:e.target.value,playoutName:x?.name||""})}}><option value="">Niet gekoppeld</option>{playoutStations.map(s=><option key={s.id} value={s.id}>{s.name} • {s.id}</option>)}</select></label>
        {rotationStations.length===0&&<p className="muted">Geen Rotation One-stations in cache. Ga naar Beheer → Integraties → Rotation One → Stations ophalen.</p>}
        {playoutStations.length===0&&<div className="mapping-warning"><strong>Geen Playout One-stations zichtbaar</strong><span>{readIntegration("playout")?.host?(readSecret("playout").apiKey?"De API-key is aanwezig, maar de stationslijst is nog niet opgehaald.":"Playout One is ingesteld, maar de Bearer API-key ontbreekt in deze browsersessie."):"Playout One is nog niet ingesteld."}</span><button className="ghost" onClick={fetchPlayoutStations}>↻ Playout stations ophalen</button></div>}
        <div className="mapping-service-block"><div className="mapping-service-head"><strong>SHOUTcast voor {station.name}</strong><span className={`mapping-pill ${readIntegration("shoutcast")?.host?"ok":"off"}`}>{readIntegration("shoutcast")?.host?"INGESTELD":"NIET INGESTELD"}</span></div>{readIntegration("shoutcast")?.host?<code className="mapping-endpoint">{`${readIntegration("shoutcast")?.protocol}://${readIntegration("shoutcast")?.host}:${readIntegration("shoutcast")?.port}${readIntegration("shoutcast")?.basePath||""}${readIntegration("shoutcast")?.statusPath||""}`}</code>:<small>Stel de SHOUTcast host, poort en SID per station in via Beheer → Integraties.</small>}</div>
        <button className="primary" onClick={testConnections}>Test Rotation + Playout + SHOUTcast</button>
      </div>
      <div className="card">
        <h3>Wat VLACORA kan ophalen</h3>
        <div className="capability-list">
          {["Stations + station-ID's","Playlist per datum/uur","Playlist item-ID's","Artiest, titel, type en duur","Rotation map/categorie","Cue/mix metadata indien API beschikbaar","Playlistversie / gewijzigd op","Now playing / next","Playout status","Nieuws / externe items","Stream/encoder status","Laatste sync / errors"].map(x=><span key={x}>✓ {x}</span>)}
        </div>
      </div>
      <div className="card">
        <h3>Status</h3>
        <div className="integration-status"><span>Laatste status</span><strong>{lastStatus}</strong></div>
        <div className="integration-status"><span>Rotation pull</span><strong>{lastPull}</strong></div>
        <div className="integration-status"><span>Schedule revision</span><strong>{playlistVersion}</strong></div>
      </div>
    </div>}
  </div>
}
