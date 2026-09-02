"use client";

import { useCallback,useEffect,useMemo,useRef,useState } from "react";
import { pathFor,radioRead,readIntegration,readMappings,readSecret } from "@/lib/radio/client-config";
import { hydrateSharedIntegrationSettings } from "@/lib/supabase/settings";
import { hydrateIntegrationSecret } from "@/lib/supabase/secrets";
import { loadSharedRadioMapping } from "@/lib/supabase/hub-data";
import { useHubStation } from "@/lib/radio/hub-stations";
import { emitActivity } from "@/lib/collaboration/activity";

type Status={
  stationId:string;name:string;online:boolean;revision:string;lastHeartbeatUtc:string;mode:string;playback:string;
  engine:{online:boolean;machine:string;audioEngine:string;operatorPlaybackArmed:boolean};
  current:{eventId:string;kind:string;artist:string;title:string;positionSeconds:number;durationSeconds:number};
  next:{eventId:string;kind:string;artist:string;title:string};
  queueCount:number;
  stream:{configured:boolean;connected:boolean;state:string;encoder:string;bitrateKbps:number};
  dsp:{state:string;stereoToolEnabled:boolean;licenseConfigured:boolean};
  rotation:{station:string;scheduleStatus:string;lastCheckedUtc:string;nextCheckUtc:string};
  lastError:string;
};
type QueueItem={eventId:string;index:number;kind:string;status:string;artist:string;title:string;durationText:string;warning:string;chainType:string};
type Queue={stationId:string;stationName:string;currentPlaylistIndex:number;count:number;items:QueueItem[];updatedAtUtc:string};

function obj(value:any){return value&&typeof value==="object"?value:{}}
function parseStatus(raw:any):Status{
  const r=obj(raw),engine=obj(r.engine),current=obj(r.current),next=obj(r.next),stream=obj(r.stream),dsp=obj(r.dsp),rotation=obj(r.rotation);
  return{
    stationId:String(r.stationId||""),name:String(r.name||r.stationName||""),online:Boolean(r.online),revision:String(r.revision||""),
    lastHeartbeatUtc:String(r.lastHeartbeatUtc||r.heartbeatUtc||r.updatedAtUtc||""),mode:String(r.mode||""),playback:String(r.playback||""),
    engine:{online:Boolean(engine.online??r.engineOnline),machine:String(engine.machine||r.machine||""),audioEngine:String(engine.audioEngine||r.audioEngine||""),operatorPlaybackArmed:Boolean(engine.operatorPlaybackArmed??r.operatorPlaybackArmed)},
    current:{eventId:String(current.eventId||""),kind:String(current.kind||""),artist:String(current.artist||""),title:String(current.title||""),positionSeconds:Number(current.positionSeconds||0),durationSeconds:Number(current.durationSeconds||0)},
    next:{eventId:String(next.eventId||""),kind:String(next.kind||""),artist:String(next.artist||""),title:String(next.title||"")},
    queueCount:Number(r.queueCount||0),
    stream:{configured:Boolean(stream.configured??r.streamConfigured),connected:Boolean(stream.connected??r.streamConnected),state:String(stream.state||r.streamState||""),encoder:String(stream.encoder||r.encoderState||""),bitrateKbps:Number(stream.bitrateKbps||r.streamBitrateKbps||0)},
    dsp:{state:String(dsp.state||r.dspState||""),stereoToolEnabled:Boolean(dsp.stereoToolEnabled??r.stereoToolEnabled),licenseConfigured:Boolean(dsp.licenseConfigured??r.stereoToolLicenseConfigured)},
    rotation:{station:String(rotation.station||r.rotationStation||""),scheduleStatus:String(rotation.scheduleStatus||r.rotationScheduleStatus||""),lastCheckedUtc:String(rotation.lastCheckedUtc||r.rotationScheduleLastChecked||""),nextCheckUtc:String(rotation.nextCheckUtc||r.rotationScheduleNextCheck||"")},
    lastError:String(r.lastError||"")
  };
}
function parseQueue(raw:any):Queue{
  const r=obj(raw),items=Array.isArray(r.items)?r.items:[];
  return{
    stationId:String(r.stationId||""),stationName:String(r.stationName||""),currentPlaylistIndex:Number(r.currentPlaylistIndex??-1),
    count:Number(r.count??items.length),updatedAtUtc:String(r.updatedAtUtc||""),
    items:items.map((x:any,i:number)=>({eventId:String(x.eventId||x.id||`q-${i}`),index:Number(x.index??i),kind:String(x.kind||x.type||""),status:String(x.status||""),artist:String(x.artist||""),title:String(x.title||""),durationText:String(x.durationText||x.duration||""),warning:String(x.warning||""),chainType:String(x.chainType||"")}))
  };
}
function fmtSec(value:number){const sec=Math.max(0,Math.round(Number(value)||0));return`${Math.floor(sec/60)}:${String(sec%60).padStart(2,"0")}`}
function fmtDate(value:string){if(!value)return"—";const d=new Date(value);return Number.isNaN(d.getTime())?"—":d.toLocaleString("nl-BE")}
function progress(status:Status|null){if(!status?.current.durationSeconds)return 0;return Math.min(100,Math.max(0,status.current.positionSeconds/status.current.durationSeconds*100))}
function itemName(item:{artist:string;title:string}){return[item.artist,item.title].filter(Boolean).join(" — ")||"Geen titel"}

export default function PlayoutOneModule({stationSlug}:{stationSlug:string}){
  const station=useHubStation(stationSlug);
  const[status,setStatus]=useState<Status|null>(null);
  const[queue,setQueue]=useState<Queue|null>(null);
  const[playoutId,setPlayoutId]=useState("");
  const[notice,setNotice]=useState("");
  const[error,setError]=useState("");
  const[busy,setBusy]=useState(false);
  const[queueBusy,setQueueBusy]=useState(false);
  const revisionRef=useRef("");

  function flash(message:string){setNotice(message);window.setTimeout(()=>setNotice(""),3000)}

  const resolveMapping=useCallback(async()=>{
    let map=readMappings()[stationSlug]||null;
    const shared=await loadSharedRadioMapping(stationSlug).catch(()=>null);
    if(shared)map={...map,...shared};
    const id=map?.playoutId||"";
    setPlayoutId(id);
    return id;
  },[stationSlug]);

  const loadStatus=useCallback(async(silent=false)=>{
    if(stationSlug==="all")return;
    setBusy(true);
    try{
      await hydrateSharedIntegrationSettings(stationSlug).catch(()=>false);
      if(!readSecret("playout").apiKey)await hydrateIntegrationSecret("playout").catch(()=>null);
      const id=await resolveMapping();
      if(!id)throw new Error("Dit VLACORA-station is nog niet aan een Playout One station gekoppeld.");
      const cfg=readIntegration("playout");
      if(!cfg?.host)throw new Error("Playout One is nog niet ingesteld.");
      if(!readSecret("playout").apiKey)throw new Error("De Playout One Bearer API-key ontbreekt.");
      const path=pathFor(cfg.nowPath||"/api/v1/integration/stations/{stationId}/status",id);
      const result=await radioRead("playout",path,"raw");
      const parsed=parseStatus(result.raw);
      setStatus(parsed);revisionRef.current=parsed.revision;setError("");
      emitActivity({detail:`Playout One • ${parsed.current.title||parsed.playback||parsed.stationId}`,entityType:"playout-station",entityId:parsed.stationId});
      if(!silent)flash("Live Playout One-status vernieuwd");
    }catch(e){setError(e instanceof Error?e.message:"Playout One kon niet worden gelezen")}
    finally{setBusy(false)}
  },[stationSlug,resolveMapping]);

  const checkRevision=useCallback(async()=>{
    if(document.hidden||stationSlug==="all"||!playoutId)return;
    try{
      const cfg=readIntegration("playout");
      const result=await radioRead("playout",cfg?.playoutRevisionsPath||"/api/v1/integration/revisions","raw");
      const stations=Array.isArray(result.raw?.stations)?result.raw.stations:[];
      const row=stations.find((x:any)=>String(x.stationId)===playoutId);
      const revision=String(row?.revision||"");
      if(revision&&revision!==revisionRef.current)await loadStatus(true);
    }catch{}
  },[stationSlug,playoutId,loadStatus]);

  useEffect(()=>{void loadStatus(true)},[loadStatus]);
  useEffect(()=>{const timer=window.setInterval(()=>void checkRevision(),15000);return()=>window.clearInterval(timer)},[checkRevision]);

  async function loadQueue(){
    if(!playoutId)return flash("Koppel eerst een Playout One station.");
    setQueueBusy(true);
    try{
      const cfg=readIntegration("playout");
      const path=pathFor(cfg?.playoutQueuePath||"/api/v1/integration/stations/{stationId}/queue?limit=20",playoutId);
      const result=await radioRead("playout",path,"raw");
      setQueue(parseQueue(result.raw));flash("Wachtrij op aanvraag geladen");
    }catch(e){flash(e instanceof Error?e.message:"Wachtrij laden mislukt")}
    finally{setQueueBusy(false)}
  }

  if(stationSlug==="all")return <div><div className="page-intro"><div><h2>Playout One</h2><p>Kies één station voor de live engine- en on-airstatus.</p></div></div><div className="card empty-live-state"><strong>Station nodig</strong><span>Kies bovenaan een VLACORA-station.</span></div></div>;

  const now=status?.current;
  const hasNow=Boolean(now?.artist||now?.title);
  const heartbeatAge=status?.lastHeartbeatUtc?Math.max(0,Math.round((Date.now()-new Date(status.lastHeartbeatUtc).getTime())/1000)):null;

  return <div className="playout-page-v182">
    <div className="page-intro playout-page-intro">
      <div><span className="eyebrow">PLAYOUT ONE HUB :5099</span><h2>Playout One</h2><p>Live heartbeat, NOW/NEXT, engine, encoder, DSP, Rotation-status en wachtrij van {station.name}.</p></div>
      <div className="button-row"><button className="ghost" onClick={()=>location.href=`/hub/${stationSlug}/radio-api`}>Station mapping</button><button className="primary" disabled={busy} onClick={()=>void loadStatus(false)}>↻ Vernieuw</button></div>
    </div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}
    {error&&<div className="config-error standalone"><strong>Playout One</strong><span>{error}</span><button className="ghost" onClick={()=>location.href=`/hub/${stationSlug}/radio-api`}>Open mapping →</button></div>}
    {!status&&!error&&<div className="card empty-live-state"><strong>Playout One-status laden…</strong></div>}

    {status&&<>
      <div className="playout-top-status">
        <div className={`playout-online-card ${status.online?"online":"offline"}`}><span className="playout-live-dot"/><div><strong>{status.online?"ONLINE":"OFFLINE"}</strong><small>{status.name||status.stationId} • heartbeat {heartbeatAge==null?"—":`${heartbeatAge}s geleden`}</small></div><b>{status.mode||"—"}</b></div>
        <div className="playout-small-stat"><span>Playback</span><strong>{status.playback||"—"}</strong></div>
        <div className="playout-small-stat"><span>Queue</span><strong>{status.queueCount}</strong></div>
        <div className="playout-small-stat"><span>Revision</span><strong>{status.revision||"—"}</strong></div>
      </div>

      <div className="playout-now-grid">
        <section className="card playout-now-card">
          <div className="section-head"><div><span className="eyebrow">NOW</span><h3>{hasNow?itemName(now!):"Geen NOW-data in heartbeat"}</h3></div><span className="badge badge-blue">{now?.kind||"—"}</span></div>
          {hasNow?<><div className="playout-progress"><span style={{width:`${progress(status)}%`}}/></div><div className="playout-time-row"><strong>{fmtSec(now?.positionSeconds||0)}</strong><span>{fmtSec(now?.durationSeconds||0)}</span></div></>:<div className="empty-live-state compact"><strong>Station is gekoppeld, maar NOW is leeg</strong><span>Controleer of de stationengine daadwerkelijk 0.11.19 draait en zijn verrijkte heartbeat naar de Hub stuurt.</span></div>}
        </section>
        <section className="card playout-next-card"><span className="eyebrow">NEXT</span><h3>{status.next.artist||status.next.title?itemName(status.next):"Nog geen NEXT-data"}</h3><p>{status.next.kind||"—"}</p></section>
      </div>

      <div className="playout-detail-grid">
        <section className="card"><div className="section-head"><div><h3>Engine</h3><p>Stationprocess</p></div><span className={`badge ${status.engine.online?"badge-green":"badge-gray"}`}>{status.engine.online?"ONLINE":"OFFLINE"}</span></div><div className="integration-status"><span>Machine</span><strong>{status.engine.machine||"—"}</strong></div><div className="integration-status"><span>Audio engine</span><strong>{status.engine.audioEngine||"—"}</strong></div><div className="integration-status"><span>Operator armed</span><strong>{status.engine.operatorPlaybackArmed?"Ja":"Nee"}</strong></div></section>
        <section className="card"><div className="section-head"><div><h3>Stream / encoder</h3><p>Playout One output</p></div><span className={`badge ${status.stream.connected?"badge-green":"badge-gray"}`}>{status.stream.connected?"CONNECTED":"DISCONNECTED"}</span></div><div className="integration-status"><span>State</span><strong>{status.stream.state||"—"}</strong></div><div className="integration-status"><span>Encoder</span><strong>{status.stream.encoder||"—"}</strong></div><div className="integration-status"><span>Bitrate</span><strong>{status.stream.bitrateKbps?`${status.stream.bitrateKbps} kbps`:"—"}</strong></div></section>
        <section className="card"><div className="section-head"><div><h3>DSP</h3><p>Stereo Tool</p></div><span className={`badge ${status.dsp.stereoToolEnabled?"badge-green":"badge-gray"}`}>{status.dsp.stereoToolEnabled?"ACTIEF":"UIT"}</span></div><div className="integration-status"><span>DSP state</span><strong>{status.dsp.state||"—"}</strong></div><div className="integration-status"><span>Licentie</span><strong>{status.dsp.licenseConfigured?"Ingesteld":"Niet ingesteld"}</strong></div></section>
        <section className="card"><div className="section-head"><div><h3>Rotation One</h3><p>Schedule sync vanuit Playout</p></div></div><div className="integration-status"><span>Station</span><strong>{status.rotation.station||"—"}</strong></div><div className="integration-status"><span>Schedule</span><strong>{status.rotation.scheduleStatus||"—"}</strong></div><div className="integration-status"><span>Laatste check</span><strong>{fmtDate(status.rotation.lastCheckedUtc)}</strong></div><div className="integration-status"><span>Volgende check</span><strong>{fmtDate(status.rotation.nextCheckUtc)}</strong></div></section>
      </div>

      {status.lastError&&<div className="config-error standalone"><strong>Laatste Playout fout</strong><span>{status.lastError}</span></div>}

      <section className="card playout-queue-section">
        <div className="section-head"><div><h3>Wachtrij</h3><p>Wordt bewust alleen geladen wanneer je hierom vraagt.</p></div><button className="ghost" disabled={queueBusy} onClick={()=>void loadQueue()}>{queueBusy?"Laden…":"⌁ Laad wachtrij"}</button></div>
        {!queue&&<div className="empty-live-state compact"><strong>{status.queueCount} items gemeld in heartbeat</strong><span>Klik op “Laad wachtrij” om de volgende items daadwerkelijk bij de stationengine op te vragen.</span></div>}
        {queue&&<div className="playout-queue-list">{queue.items.map((item,i)=><div className="playout-queue-row" key={item.eventId}><span>{i+1}</span><div><strong>{itemName(item)}</strong><small>{item.kind||"item"}{item.chainType?` • ${item.chainType}`:""}{item.warning?` • ⚠ ${item.warning}`:""}</small></div><b>{item.durationText||"—"}</b></div>)}{!queue.items.length&&<div className="empty-live-state compact"><strong>Wachtrij is leeg</strong></div>}</div>}
      </section>
    </>}
  </div>;
}
