"use client";

import { useCallback,useEffect,useMemo,useState } from "react";
import { emitActivity } from "@/lib/collaboration/activity";
import { DEFAULT_TRAFFIC_SETTINGS,fetchTrafficSnapshot,loadTrafficSettings,saveTrafficSettings,type TrafficSettings,type TrafficSnapshot } from "@/lib/traffic/client";

const DEFAULT_ROADS=["E17","E40","R4","R1","R0","A12","E19","E313","E314"];
function fmtTime(value:string){if(!value)return"—";const d=new Date(value);return Number.isNaN(d.getTime())?"—":d.toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
function fmtDateTime(value:string){if(!value)return"—";const d=new Date(value);return Number.isNaN(d.getTime())?"—":d.toLocaleString("nl-BE")}

export default function TrafficModule({stationSlug}:{stationSlug:string}){
  const[settings,setSettings]=useState<TrafficSettings>(DEFAULT_TRAFFIC_SETTINGS);
  const[snapshot,setSnapshot]=useState<TrafficSnapshot|null>(null);
  const[roadDraft,setRoadDraft]=useState("");
  const[radioText,setRadioText]=useState("");
  const[busy,setBusy]=useState(false);
  const[saving,setSaving]=useState(false);
  const[notice,setNotice]=useState("");
  const[error,setError]=useState("");

  function flash(message:string){setNotice(message);window.setTimeout(()=>setNotice(""),2600)}

  const refresh=useCallback(async(silent=false)=>{
    if(stationSlug==="all")return;
    setBusy(true);
    try{
      const data=await fetchTrafficSnapshot(settings);
      setSnapshot(data);setRadioText(data.radioText);setError("");
      emitActivity({detail:`Verkeer • ${data.count} melding(en)`,entityType:"traffic",entityId:stationSlug});
      if(!silent)flash(`Verkeer vernieuwd • ${data.count} relevante melding(en)`);
    }catch(e){setError(e instanceof Error?e.message:"Verkeer kon niet geladen worden")}
    finally{setBusy(false)}
  },[settings,stationSlug]);

  useEffect(()=>{
    let alive=true;
    void loadTrafficSettings(stationSlug).then(s=>{if(!alive)return;setSettings(s)});
    return()=>{alive=false};
  },[stationSlug]);

  const roadSet=useMemo(()=>new Set(settings.roads),[settings.roads]);
  function toggleRoad(road:string){setSettings(s=>({...s,allFlanders:false,roads:roadSet.has(road)?s.roads.filter(x=>x!==road):[...s.roads,road]}))}
  function addRoad(){const road=roadDraft.trim().toUpperCase().replace(/[\s-]+/g,"");if(!road)return;if(!settings.roads.includes(road))setSettings(s=>({...s,allFlanders:false,roads:[...s.roads,road]}));setRoadDraft("")}
  async function save(){setSaving(true);try{const next=await saveTrafficSettings(stationSlug,settings);setSettings(next);flash("Verkeersinstellingen centraal opgeslagen")}catch(e){flash(e instanceof Error?e.message:"Opslaan mislukt")}finally{setSaving(false)}}
  async function copyText(){try{await navigator.clipboard.writeText(radioText);flash("Radiotekst gekopieerd")}catch{flash("Kopiëren lukte niet")}}

  if(stationSlug==="all")return <div><div className="page-intro"><div><h2>Verkeer</h2><p>Kies één station om wegen en live verkeersinfo in te stellen.</p></div></div></div>;

  return <div className="traffic-page">
    <div className="page-intro traffic-intro">
      <div><span className="eyebrow">VLAAMS VERKEERSCENTRUM • DATEX II V3</span><h2>Live verkeer</h2><p>Actuele files, incidenten en wegenwerken. VLACORA haalt de feed alleen op wanneer iemand expliciet live verkeersinfo vraagt.</p></div>
      <div className="button-row"><button className="ghost" disabled={saving} onClick={()=>void save()}>{saving?"Opslaan…":"Instellingen opslaan"}</button><button className="primary" disabled={busy} onClick={()=>void refresh(false)}>↻ {busy?"Laden…":"Vernieuw live"}</button></div>
    </div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}
    {error&&<div className="config-error standalone"><strong>Verkeer</strong><span>{error}</span></div>}

    <div className="traffic-grid">
      <section className="card traffic-settings-card">
        <div className="section-head"><div><h3>Wegen voor dit station</h3><p>Prioriteiten voor de automatisch gemaakte radiotekst.</p></div><label className="traffic-all-toggle"><input type="checkbox" checked={settings.allFlanders} onChange={e=>setSettings(s=>({...s,allFlanders:e.target.checked}))}/><span>Heel Vlaanderen</span></label></div>
        <div className="traffic-road-chips">{DEFAULT_ROADS.map(r=><button key={r} className={roadSet.has(r)&&!settings.allFlanders?"active":""} onClick={()=>toggleRoad(r)}>{r}</button>)}</div>
        <div className="traffic-road-add"><input className="input" value={roadDraft} onChange={e=>setRoadDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addRoad()}}} placeholder="Andere weg, bv. N47"/><button className="ghost" onClick={addRoad}>＋ Voeg toe</button></div>
        <div className="traffic-selected-roads">{settings.roads.map(r=><span key={r}>{r}<button onClick={()=>setSettings(s=>({...s,roads:s.roads.filter(x=>x!==r)}))}>×</button></span>)}</div>
        <div className="traffic-options">
          <label><input type="checkbox" checked={settings.includeIncidents} onChange={e=>setSettings(s=>({...s,includeIncidents:e.target.checked}))}/> Ongevallen & incidenten</label>
          <label><input type="checkbox" checked={settings.includeCongestion} onChange={e=>setSettings(s=>({...s,includeCongestion:e.target.checked}))}/> Files / vertraagd verkeer</label>
          <label><input type="checkbox" checked={settings.includeRoadworks} onChange={e=>setSettings(s=>({...s,includeRoadworks:e.target.checked}))}/> Wegenwerken</label>
          <div className="traffic-on-demand-note"><strong>Op aanvraag</strong><span>Geen achtergrondrefresh. Verkeer wordt alleen opgehaald via “Vernieuw live” of vanuit een verkeers-talk.</span></div>
        </div>
      </section>

      <section className="card traffic-radio-card">
        <div className="section-head"><div><span className="eyebrow">RADIO READY</span><h3>Verkeerstekst</h3><p>Automatisch samengesteld uit de actuele relevante meldingen.</p></div><span className={`traffic-live-badge ${snapshot?.ok?"online":""}`}>● LIVE</span></div>
        <textarea className="traffic-radio-text" value={radioText} onChange={e=>setRadioText(e.target.value)} placeholder="Klik bovenaan op ‘Vernieuw live’ om nu verkeersinfo op te halen…"/>
        <div className="traffic-radio-footer"><div><strong>Feed update</strong><span>{fmtTime(snapshot?.publicationTime||"")}</span></div><div><strong>VLACORA opgehaald</strong><span>{fmtTime(snapshot?.fetchedAt||"")}</span></div><button className="primary soft" onClick={()=>void copyText()}>Kopieer tekst</button></div>
      </section>
    </div>

    <section className="card traffic-list-card">
      <div className="section-head"><div><h3>Actuele meldingen</h3><p>{snapshot?`${snapshot.count} relevant • ${snapshot.totalParsed} records in de feed`:"Feed laden…"}</p></div><span className="traffic-source">Bron: Vlaams Verkeerscentrum</span></div>
      <div className="traffic-list">{snapshot?.items.map(item=><article key={item.id} className={`traffic-item severity-${item.severity}`}><span className="traffic-severity-dot"/><div className="traffic-item-main"><div className="traffic-item-meta"><b>{item.road||"Vlaanderen"}</b><span>{item.typeLabel}</span>{item.direction&&<span>richting {item.direction}</span>}</div><strong>{item.summary}</strong><small>Bijgewerkt {fmtDateTime(item.updatedAt)}{item.validUntil?` • geldig tot ${fmtDateTime(item.validUntil)}`:""}</small></div></article>)}{snapshot&&!snapshot.items.length&&<div className="empty-live-state compact"><strong>Geen relevante meldingen</strong><span>Voor de gekozen wegen zijn momenteel geen grote meldingen gevonden.</span></div>}</div>
    </section>
  </div>;
}
