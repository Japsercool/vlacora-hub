"use client";

import { useEffect, useMemo, useState } from "react";
import type { MusicSong } from "@/components/modules/music-library-module";
import { useHubStation } from "@/lib/radio/hub-stations";
import { discoverPlayoutStations,mergeStationCache,pathFor,radioRead,readIntegration,readMappings,readSecret,readStationCache,saveMappings,saveStationCache,type RadioMappingStore,type RadioStation } from "@/lib/radio/client-config";
import { emitActivity } from "@/lib/collaboration/activity";
import { hydrateSharedIntegrationSettings,loadSharedRadioMapping,saveSharedRadioMapping } from "@/lib/supabase/settings";
import { hydrateIntegrationSecret } from "@/lib/supabase/secrets";
import { loadSharedPlayoutStations,syncSharedPlayoutStations } from "@/lib/supabase/hub-data";
import { loadEditorialWorkspace,saveEditorialWorkspace } from "@/lib/supabase/editorial";
import EditorialPlaylistWorkspace from "@/components/modules/editorial-playlist-workspace";
import EditorialTemplateStudio from "@/components/modules/editorial-template-studio";

export type EditorialType = "music" | "talk" | "imaging" | "promo" | "weather" | "traffic" | "news" | "commercial" | "tease" | "link" | "browse";
export type EditorialItem = {
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

  // Rotation One may expose one or more of these fields.
  // They are intentionally preserved so template buttons can be built
  // from categories that really occur in the fetched playlist.
  category?: string;
  categoryName?: string;
  rotationMap?: string;
  folder?: string;
  folderName?: string;
  musicCategory?: string;
  playlistCategory?: string;
  subtype?: string;
  rawType?: string;
  externalKind?: string;
  airTimeUtc?: string;
  sourceHourStartUtc?: string;
  isSweeper?: boolean;
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
  useEffect(()=>{
    setReady(false);
    try{const raw=localStorage.getItem(key);setValue(raw?JSON.parse(raw):initial)}catch{setValue(initial)}
    setReady(true);
    // initial is intentionally a per-key fallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[key]);
  useEffect(()=>{if(ready)try{localStorage.setItem(key,JSON.stringify(value))}catch{}},[key,ready,value]);
  return [value,setValue] as const;
}

function substitute(text:string, values:Record<string,string>) {
  let result = text;
  for (const [key,value] of Object.entries(values)) result = result.replaceAll(`{${key}}`, value);
  return result;
}
function brusselsHourKey(value:string|undefined){
  if(!value)return"";
  const d=new Date(value);if(Number.isNaN(d.getTime()))return"";
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Brussels",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hour12:false}).formatToParts(d);
  const get=(type:string)=>parts.find(x=>x.type===type)?.value||"";
  return`${get("year")}-${get("month")}-${get("day")}T${get("hour")}`;
}

export default function EditorialModule({stationSlug}:{stationSlug:string}) {
  const station = useHubStation(stationSlug);
  const [tab,setTab] = useState<"playlist"|"templates"|"koppeling">("playlist");
  const [date,setDate] = useState(()=>new Date().toISOString().slice(0,10));
  const [hour,setHour] = useState(()=>`${String(new Date().getHours()).padStart(2,"0")}:00`);
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
  const [busy,setBusy] = useState(false);
  const [workspaceReady,setWorkspaceReady] = useState(false);
  const [manualPlayoutId,setManualPlayoutId] = useState("");
  const [manualPlayoutName,setManualPlayoutName] = useState("");
  const [autoPulling,setAutoPulling] = useState(false);
  useEffect(()=>{
    let alive=true;
    const refreshCaches=()=>{setRotationStations(readStationCache("rotation"));setPlayoutStations(readStationCache("playout"))};
    (async()=>{
      await hydrateSharedIntegrationSettings(station.slug).catch(()=>false);
      const shared=await loadSharedRadioMapping(station.slug).catch(()=>null);if(!alive)return;
      const local=readMappings();const next=shared?{...local,[station.slug]:{...local[station.slug],...shared}}:local;setMappingsState(next);if(shared)saveMappings(next);
      if(readStationCache("playout").length===0){const sharedPlayout=await loadSharedPlayoutStations().catch(()=>[]);if(sharedPlayout.length)saveStationCache("playout",sharedPlayout)}
      refreshCaches();
      const pc=readIntegration("playout");if(!readSecret("playout").apiKey)await hydrateIntegrationSecret("playout").catch(()=>null);if(pc?.host&&readStationCache("playout").length===0&&readSecret("playout").apiKey){try{const result=await discoverPlayoutStations();if(result.stations.length){saveStationCache("playout",result.stations);await syncSharedPlayoutStations(result.stations).catch(()=>{});refreshCaches()}}catch{}}
    })();
    const loadPrograms=()=>{try{const raw=localStorage.getItem(`vlacora:${station.slug}:programming:v10`);const items=raw?JSON.parse(raw):[];setProgrammingPrograms(Array.isArray(items)?items.filter((x:any)=>x?.active!==false).map((x:any)=>({name:String(x.name||"Programma"),host:String(x.host||"")})):[])}catch{setProgrammingPrograms([])}};
    loadPrograms();window.addEventListener("vlacora:programming-changed",loadPrograms as EventListener);window.addEventListener("vlacora:hub-stations-changed",refreshCaches as EventListener);return()=>{alive=false;window.removeEventListener("vlacora:programming-changed",loadPrograms as EventListener);window.removeEventListener("vlacora:hub-stations-changed",refreshCaches as EventListener)};
  },[station.slug]);

  useEffect(()=>{
    let alive=true;setWorkspaceReady(false);
    (async()=>{
      try{
        const saved=await loadEditorialWorkspace(station.slug,date,Number(hour.slice(0,2)));
        if(alive&&saved&&Array.isArray(saved.items)&&saved.items.length)setPlaylist(saved.items as EditorialItem[]);
        if(alive&&saved?.source_revision)setPlaylistVersion(String(saved.source_revision));
      }catch{}
      finally{if(alive)setWorkspaceReady(true)}
    })();
    return()=>{alive=false};
  },[station.slug,date,hour]);

  useEffect(()=>{
    if(!workspaceReady)return;
    const timer=window.setTimeout(()=>{
      void saveEditorialWorkspace(station.slug,date,Number(hour.slice(0,2)),playlist,playlistVersion).catch(()=>{});
    },1200);
    return()=>window.clearTimeout(timer);
  },[workspaceReady,station.slug,date,hour,playlist,playlistVersion]);

  const mapping=mappings[station.slug]||{rotationId:station.rotationId||"",rotationName:station.rotationId?station.name:"",playoutId:"",playoutName:""};
  useEffect(()=>{
    if(!workspaceReady||station.slug==="all"||!mapping.rotationId||!readIntegration("rotation")?.host)return;
    const timer=window.setTimeout(()=>void pullRotation(true),350);
    return()=>window.clearTimeout(timer);
  },[workspaceReady,station.slug,date,hour,mapping.rotationId]);
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

async function pullRotation(silent=false){
  const cfg=readIntegration("rotation");if(!cfg?.host){if(!silent)flash("Stel Rotation One eerst in via Beheer → Integraties.");return}
  if(!mapping.rotationId){if(!silent)flash("Koppel eerst dit VLACORA-station aan een echt Rotation One-station.");return}
  setAutoPulling(true);
  try{
    const target=new Date(`${date}T${hour}:00`);
    const requestFrom=new Date(target.getTime()-2*60*60*1000);
    const requestTo=new Date(target.getTime()+3*60*60*1000);
    let path=pathFor(cfg.playlistPath||"/api/v1/stations/{stationId}/schedule",mapping.rotationId);
    const q=new URLSearchParams({from:requestFrom.toISOString(),to:requestTo.toISOString()});
    path+=`${path.includes("?")?"&":"?"}${q.toString()}`;
    const data=await radioRead("rotation",path,"playlist");
    const all:EditorialItem[]=(data.items||[]) as EditorialItem[];
    const targetKey=`${date}T${hour.slice(0,2)}`;
    const logical=all.filter((i:any)=>brusselsHourKey(i.sourceHourStartUtc)===targetKey);
    const airtime=all.filter((i:any)=>brusselsHourKey(i.airTimeUtc)===targetKey);
    const source=logical.length?logical:airtime;
    const previous=new Map<string,EditorialItem>(playlist.map(i=>[i.id,i]));
    const incoming:EditorialItem[]=source.map((i:any)=>({...i,presenterText:previous.get(i.id)?.presenterText||i.presenterText||"",notes:previous.get(i.id)?.notes||i.notes||""}));
    setPlaylist(incoming);setSelectedId(incoming[0]?.id||"");setLastPull(new Date().toLocaleTimeString("nl-BE"));setPlaylistVersion(String(data.version||"—"));
    const mode=logical.length?"logisch Rotation-uur":"airtime fallback";
    setLastStatus(`Rotation One: ${incoming.length} items • ${mode} • ${all.length} items rond dit uur`);
    if(!silent)flash(incoming.length?`${incoming.length} echte Rotation One-items geladen`:`Geen items gevonden voor ${date} ${hour}. De API gaf ${all.length} items in de bredere window.`);
  }catch(e){setLastStatus(e instanceof Error?e.message:"Rotation One fout");if(!silent)flash(e instanceof Error?e.message:"Rotation One kon niet worden bereikt")}
  finally{setAutoPulling(false)}
}
async function pushRotation(){flash("Schrijven naar Rotation One staat bewust nog uit. Eerst lezen en mapping volledig valideren.")}
async function fetchPlayoutStations(){
  if(busy)return;setBusy(true);
  try{
    await hydrateSharedIntegrationSettings(station.slug).catch(()=>false);
    const pc=readIntegration("playout");if(!pc?.host)throw new Error("Playout One is nog niet ingesteld.");
    if(!readSecret("playout").apiKey)await hydrateIntegrationSecret("playout").catch(()=>null);
    if(!readSecret("playout").apiKey)throw new Error("Playout One Bearer API-key is nog niet centraal opgeslagen.");
    const result=await discoverPlayoutStations(),list=result.stations;
    if(list.length){setPlayoutStations(list);saveStationCache("playout",list);await syncSharedPlayoutStations(list).catch(()=>{})}
    flash(result.usedCache?`Hub gaf nu geen stations. ${list.length} laatst bekende station(s) behouden.`:`${list.length} Playout One station(s) opgehaald`);
  }catch(e){const m=e instanceof Error?e.message:"Playout stations ophalen mislukt";flash(m.includes("401")?"HTTP 401: API-key moet minstens stations.read (of legacy monitor) hebben.":m)}
  finally{setBusy(false)}
}
async function connectManualPlayout(){
 const id=manualPlayoutId.trim();if(!id)return flash("Vul eerst een Playout station-ID in, bv. hits.");
 const s:RadioStation={id,name:manualPlayoutName.trim()||id},list=mergeStationCache("playout",[s]);setPlayoutStations(list);await syncSharedPlayoutStations([s]).catch(()=>{});setMapping({playoutId:id,playoutName:s.name});flash(`Playout ${s.name} gekoppeld`);
}
async function testConnections(){
  try{await hydrateSharedIntegrationSettings(station.slug).catch(()=>false);const rc=readIntegration("rotation"),pc=readIntegration("playout"),sc=readIntegration("shoutcast");const parts:string[]=[];if(rc?.host){await radioRead("rotation",rc.statusPath,"raw");parts.push("Rotation online")}else parts.push("Rotation niet ingesteld");if(pc?.host){await radioRead("playout",pc.statusPath,"raw");parts.push("Playout online")}else parts.push("Playout niet ingesteld");if(sc?.host){const s=await radioRead("shoutcast",sc.statusPath||`/stats?sid=${sc.shoutcastSid||"1"}`,"shoutcast");const listeners=Number(s.shoutcast?.listeners??0);parts.push(`SHOUTcast online${Number.isFinite(listeners)?` • ${listeners} luisteraar(s)`:""}`)}else parts.push("SHOUTcast niet ingesteld");setLastStatus(parts.join(" • "));flash(parts.join(" • "))}catch(e){setLastStatus(e instanceof Error?e.message:"Statuscontrole mislukt");flash(e instanceof Error?e.message:"Statuscontrole mislukt")}
}

  return <div>
    <div className="page-intro">
      <div><h2>Redactie & uitzending</h2><p>Bewerk de Rotation One-playlist, schrijf teksten bij ieder item en koppel redactiesjablonen aan programma&apos;s.</p></div>
      <div className="button-row"><button className="primary" onClick={()=>void pullRotation(false)}>↻ Echte playlist ophalen</button><button className="ghost" onClick={pushRotation}>Publiceren (nog uit)</button></div>
    </div>

    <div className="editorial-tabs">
      <button className={tab==="playlist"?"active":""} onClick={()=>setTab("playlist")}>Playlist</button>
      <button className={tab==="templates"?"active":""} onClick={()=>setTab("templates")}>Redactietemplates</button>
      <button className={tab==="koppeling"?"active":""} onClick={()=>setTab("koppeling")}>Rotation / Playout koppeling</button>
    </div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}

    {tab==="playlist"&&<EditorialPlaylistWorkspace
      stationName={station.name}
      stationSlug={station.slug}
      date={date}
      setDate={setDate}
      hour={hour}
      setHour={setHour}
      playlist={playlist}
      setPlaylist={setPlaylist}
      onPull={()=>pullRotation(false)}
      playlistVersion={playlistVersion}
      syncLabel={autoPulling?"Rotation One laden…":lastStatus}
    />}

    {tab==="templates"&&<EditorialTemplateStudio stationSlug={station.slug} playlist={playlist}/>}

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
        <label className="field">Playout One station<select className="select" value={mapping.playoutId} onChange={e=>{const x=playoutStations.find(s=>s.id===e.target.value);setMapping({playoutId:e.target.value,playoutName:x?.name||""})}}><option value="">Niet gekoppeld</option>{playoutStations.map(s=><option key={s.id} value={s.id}>{s.name} • {s.id}</option>)}</select></label><div className="manual-playout-link"><div><input className="input" value={manualPlayoutId} onChange={e=>setManualPlayoutId(e.target.value)} placeholder="Station-ID, bv. hits"/><input className="input" value={manualPlayoutName} onChange={e=>setManualPlayoutName(e.target.value)} placeholder="Naam (optioneel)"/></div><button className="ghost" onClick={()=>void connectManualPlayout()}>Koppel station-ID</button><small>Fallback wanneer de Hub tijdelijk geen stationlijst toont.</small></div>
        {rotationStations.length===0&&<p className="muted">Geen Rotation One-stations in cache. Ga naar Beheer → Integraties → Rotation One → Stations ophalen.</p>}
        {playoutStations.length===0&&<div className="mapping-warning"><strong>Geen Playout One-stations zichtbaar</strong><span>{readIntegration("playout")?.host?(readSecret("playout").apiKey?"De API-key is aanwezig, maar de stationslijst is nog niet opgehaald.":"Playout One is ingesteld, maar de Bearer API-key is nog niet centraal opgeslagen."):"Playout One is nog niet ingesteld."}</span><button className="ghost" onClick={fetchPlayoutStations}>↻ Playout stations ophalen</button></div>}
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
