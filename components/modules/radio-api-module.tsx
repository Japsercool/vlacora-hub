"use client";

import { useEffect, useState } from "react";
import { stations } from "@/lib/mock-data";

type Station={id:string;name:string;slug?:string};
type Mapping={rotationId:string;rotationName:string;playoutId:string;playoutName:string};
type MappingStore=Record<string,Mapping>;

const demoRotation:Station[]=[
  {id:"rotation-versuz",name:"Versuz Radio"},
  {id:"rotation-clubfm",name:"Club FM"},
  {id:"rotation-vlacora",name:"Vlacora One"}
];
const demoPlayout:Station[]=[
  {id:"playout-versuz",name:"Versuz Radio"},
  {id:"playout-clubfm",name:"Club FM"},
  {id:"playout-vlacora",name:"Vlacora One"}
];

function useStored<T>(key:string,initial:T){
  const[v,s]=useState<T>(initial);const[r,setR]=useState(false);
  useEffect(()=>{try{const x=localStorage.getItem(key);if(x)s(JSON.parse(x))}catch{}setR(true)},[key]);
  useEffect(()=>{if(r)try{localStorage.setItem(key,JSON.stringify(v))}catch{}},[key,r,v]);
  return[v,s]as const;
}
const norm=(x:string)=>x.toLowerCase().replace(/[^a-z0-9]/g,"");

export default function RadioApiModule({stationSlug}:{stationSlug:string}){
  const[mode,setMode]=useStored<"demo"|"api">("vlacora:radio:mode:v6","demo");
  const[mappings,setMappings]=useStored<MappingStore>("vlacora:radio:mappings:v6",{});
  const[rotationStations,setRotationStations]=useState<Station[]>(demoRotation);
  const[playoutStations,setPlayoutStations]=useState<Station[]>(demoPlayout);
  const[config,setConfig]=useState<any>(null);
  const[status,setStatus]=useState<any>(null);
  const[now,setNow]=useState<any>(null);
  const[notice,setNotice]=useState("");
  const[busy,setBusy]=useState(false);

  const activeSlug=stationSlug==="all"?"versuz":stationSlug;
  const active=stations.find(s=>s.slug===activeSlug) || stations[1];
  const mapping=mappings[activeSlug]||{rotationId:"",rotationName:"",playoutId:"",playoutName:""};

  useEffect(()=>{loadConfig()},[]);
  useEffect(()=>{if(mode==="demo"){setRotationStations(demoRotation);setPlayoutStations(demoPlayout);autoMap(demoRotation,demoPlayout)}},[mode]);

  function flash(x:string){setNotice(x);setTimeout(()=>setNotice(""),2800)}
  function setMapping(patch:Partial<Mapping>){setMappings({...mappings,[activeSlug]:{...mapping,...patch}})}
  function autoMap(rs:Station[],ps:Station[]){
    const next={...mappings};
    for(const vl of stations.filter(s=>s.slug!=="all")){
      const rr=rs.find(x=>norm(x.name)===norm(vl.name)||norm(x.name).includes(norm(vl.name))||norm(vl.name).includes(norm(x.name)));
      const pp=ps.find(x=>norm(x.name)===norm(vl.name)||norm(x.name).includes(norm(vl.name))||norm(vl.name).includes(norm(x.name)));
      next[vl.slug]={
        rotationId:next[vl.slug]?.rotationId||rr?.id||"",
        rotationName:next[vl.slug]?.rotationName||rr?.name||"",
        playoutId:next[vl.slug]?.playoutId||pp?.id||"",
        playoutName:next[vl.slug]?.playoutName||pp?.name||""
      };
    }
    setMappings(next);
  }
  async function loadConfig(){try{const r=await fetch("/api/radio/config");setConfig(await r.json())}catch{}}
  async function refreshStations(){
    if(mode==="demo"){setRotationStations(demoRotation);setPlayoutStations(demoPlayout);autoMap(demoRotation,demoPlayout);flash("Demo stationlijsten vernieuwd");return}
    setBusy(true);
    try{
      const [rr,pr]=await Promise.all([fetch("/api/radio/rotation/stations"),fetch("/api/radio/playout/stations")]);
      const rj=await rr.json();const pj=await pr.json();
      if(!rr.ok)throw new Error(rj.error||"Rotation One stationlijst mislukt");
      if(!pr.ok)throw new Error(pj.error||"Playout One stationlijst mislukt");
      const rs=rj.stations||[];const ps=pj.stations||[];
      setRotationStations(rs);setPlayoutStations(ps);autoMap(rs,ps);flash("Stationlijsten uit beide API's vernieuwd");
    }catch(e){flash(e instanceof Error?e.message:"Station refresh mislukt")}finally{setBusy(false)}
  }
  async function test(){
    if(mode==="demo"){setStatus({rotation:{online:true,status:200},playout:{online:true,status:200},checkedAt:new Date().toISOString()});setNow({now:{artist:"HUGEL",title:"Movin' To The Sun",duration:"02:57"},next:{artist:"Bebe Rexha",title:"New Religion"}});flash("Demo verbinding OK");return}
    if(!mapping.rotationId||!mapping.playoutId)return flash("Koppel eerst Rotation One én Playout One station-ID.");
    setBusy(true);
    try{
      const [sr,nr]=await Promise.all([
        fetch(`/api/radio/status?rotationStationId=${encodeURIComponent(mapping.rotationId)}&playoutStationId=${encodeURIComponent(mapping.playoutId)}`),
        fetch(`/api/radio/playout/now?stationId=${encodeURIComponent(mapping.playoutId)}`)
      ]);
      const sj=await sr.json();const nj=await nr.json();
      if(!sr.ok)throw new Error(sj.error||"Statuscontrole mislukt");
      setStatus(sj);setNow(nr.ok?nj:null);flash("Live status vernieuwd");
    }catch(e){flash(e instanceof Error?e.message:"Test mislukt")}finally{setBusy(false)}
  }

  return <div>
    <div className="page-intro">
      <div><h2>Radio API Control</h2><p>Stationherkenning, veilige API-koppeling en live status tussen VLACORA, Rotation One en Playout One.</p></div>
      <div className="button-row"><button className="ghost" onClick={refreshStations} disabled={busy}>↻ Refresh stations</button><button className="primary" onClick={test} disabled={busy}>Test koppeling</button></div>
    </div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}

    <div className="security-banner">
      <strong>🔐 Veilige standaard</strong>
      <span>API-keys blijven alleen op Vercel. Voor jouw vaste publieke radio-IP ondersteunt deze build ook echte HTTP-URL's. Remote schrijven blijft apart beveiligd.</span>
    </div>

    <div className="radio-api-grid">
      <div className="card">
        <div className="module-title-row"><div><h3>Beveiligingsstatus</h3><small>Server-side configuratie; secrets worden niet getoond.</small></div></div>
        <div className="security-checks">
          <div><span>Radio API</span><b className={config?.radioApiEnabled?"ok":"off"}>{config?.radioApiEnabled?"INGESCHAKELD":"UIT"}</b></div>
          <div><span>Remote schrijven</span><b className={config?.radioWriteEnabled?"warn":"ok"}>{config?.radioWriteEnabled?"AAN":"UIT"}</b></div>
          <div><span>Basic Auth</span><b className={config?.basicAuthConfigured?"ok":"off"}>{config?.basicAuthConfigured?"INGESTELD":"NIET INGESTELD"}</b></div>
          <div><span>Rotation One URL</span><b className={config?.rotationConfigured?"ok":"off"}>{config?.rotationConfigured?"INGESTELD":"ONTBREEKT"}</b></div>
          <div><span>Playout One URL</span><b className={config?.playoutConfigured?"ok":"off"}>{config?.playoutConfigured?"INGESTELD":"ONTBREEKT"}</b></div>
          <div><span>Onveilig HTTP</span><b className={config?.insecureHttpAllowed?"warn":"ok"}>{config?.insecureHttpAllowed?"TOEGESTAAN":"GEBLOKKEERD"}</b></div>
        </div>
        <p className="muted api-security-note">HTTP via je vaste publieke IP wordt ondersteund wanneer RADIO_API_ALLOW_INSECURE_HTTP=true. Let op: HTTP versleutelt verkeer niet; API-key en data kunnen onderweg leesbaar zijn. Daarom blijven keys uitsluitend server-side en moet de radioserver zelf zo beperkt mogelijk bereikbaar zijn.</p>
      </div>

      <div className="card">
        <div className="module-title-row"><div><h3>Werkmodus</h3><small>Demo blijft bruikbaar zonder echte radioverbinding.</small></div></div>
        <label className="field">Modus<select className="select" value={mode} onChange={e=>setMode(e.target.value as "demo"|"api")}><option value="demo">Demo / lokaal</option><option value="api">Echte API via Vercel</option></select></label>
        <div className="architecture-flow"><span>VLACORA</span><b>→</b><span>Vercel server</span><b>→</b><span>HTTP(S) / vast IP</span><b>→</b><span>Radio API</span></div>
      </div>

      <div className="card radio-mapping-card">
        <div className="module-title-row"><div><h3>Station mapping</h3><small>{active.name}</small></div><button className="ghost" onClick={refreshStations}>↻ Refresh dropdowns</button></div>
        <label className="field">Rotation One station<select className="select" value={mapping.rotationId} onChange={e=>{const s=rotationStations.find(x=>x.id===e.target.value);setMapping({rotationId:e.target.value,rotationName:s?.name||""})}}><option value="">Kies station…</option>{rotationStations.map(s=><option key={s.id} value={s.id}>{s.name} • {s.id}</option>)}</select></label>
        <label className="field">Playout One station<select className="select" value={mapping.playoutId} onChange={e=>{const s=playoutStations.find(x=>x.id===e.target.value);setMapping({playoutId:e.target.value,playoutName:s?.name||""})}}><option value="">Kies station…</option>{playoutStations.map(s=><option key={s.id} value={s.id}>{s.name} • {s.id}</option>)}</select></label>
        <div className="mapping-summary"><span>VLACORA</span><strong>{active.name}</strong><span>Rotation</span><strong>{mapping.rotationName||"—"}</strong><span>Playout</span><strong>{mapping.playoutName||"—"}</strong></div>
      </div>

      <div className="card">
        <div className="module-title-row"><div><h3>Live status</h3><small>Uit Rotation One / Playout One</small></div></div>
        <div className="live-api-cards">
          <div><span>Rotation One</span><strong>{status?.rotation?.online?"ONLINE":"—"}</strong><small>{status?.rotation?.status||""}</small></div>
          <div><span>Playout One</span><strong>{status?.playout?.online?"ONLINE":"—"}</strong><small>{status?.playout?.status||""}</small></div>
        </div>
        {now?.now&&<div className="now-api"><span>NOW PLAYING</span><strong>{now.now.artist} — {now.now.title}</strong>{now.next&&<small>Next: {now.next.artist} — {now.next.title}</small>}</div>}
      </div>
    </div>

    <div className="card">
      <h3>Wat deze koppeling straks automatisch vult</h3>
      <div className="capability-list">
        {["Stations en station-ID's","Playlist per dag/uur","Playlist item-ID's","Artiest/titel/type/duur","Rotation map/categorie","Playlistversie","Now playing + next","Playout engine status","Nieuws/externe items","Cue/mixmetadata indien API die aanbiedt","Laatste sync en fouten","Redactie-teksten terug naar playlist waar API dit ondersteunt"].map(x=><span key={x}>✓ {x}</span>)}
      </div>
    </div>
  </div>
}
