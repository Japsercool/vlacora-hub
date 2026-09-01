"use client";
import { syncSharedRotationStations } from "@/lib/supabase/hub-data";
import { isSupabaseBrowserConfigured } from "@/lib/supabase/client";

import { useEffect, useState } from "react";
import { saveStationCache } from "@/lib/radio/client-config";

type Protocol = "http" | "https";
type IntegrationKind = "rotation" | "playout" | "shoutcast";

type PublicConfig = {
  enabled: boolean;
  protocol: Protocol;
  host: string;
  port: string;
  basePath: string;
  stationPath: string;
  statusPath: string;
  playlistPath?: string;
  coveragePath?: string;
  revisionPath?: string;
  nowPath?: string;
  musicFoldersPath?: string;
  musicFolderItemsPath?: string;
  chartListPath?: string;
  chartEditionsPath?: string;
  chartEditionPath?: string;
  chartRevisionPath?: string;
  chartWritePath?: string;
  chartWriteEnabled?: boolean;
  readOnly: boolean;
  lastOk?: string;
  lastError?: string;
};

type Store = Record<IntegrationKind,PublicConfig>;

const seed:Store = {
  rotation:{
    enabled:false, protocol:"http", host:"", port:"5090", basePath:"",
    stationPath:"/api/v1/stations", statusPath:"/api/v1/health",
    playlistPath:"/api/v1/stations/{stationId}/schedule", coveragePath:"/api/v1/stations/{stationId}/schedule/coverage", revisionPath:"/api/v1/stations/{stationId}/schedule/revision", musicFoldersPath:"", musicFolderItemsPath:"",
    chartListPath:"/api/v1/stations/{stationId}/charts", chartEditionsPath:"/api/v1/stations/{stationId}/charts/{chartId}/editions", chartEditionPath:"/api/v1/stations/{stationId}/charts/{chartId}/editions/{editionId}", chartRevisionPath:"/api/v1/stations/{stationId}/charts/revision", chartWritePath:"/api/v1/stations/{stationId}/charts/{chartId}/editions/{editionId}", chartWriteEnabled:false, readOnly:true
  },
  playout:{
    enabled:false, protocol:"http", host:"", port:"5099", basePath:"",
    stationPath:"/api/v1/integration/stations", statusPath:"/api/v1/integration/health",
    nowPath:"/api/v1/integration/stations/{stationId}/status", readOnly:true
  },
  shoutcast:{
    enabled:false, protocol:"http", host:"", port:"8000", basePath:"",
    stationPath:"/stats?sid=1&json=1", statusPath:"/stats?sid=1&json=1", readOnly:true
  }
};

function useStored<T>(key:string,initial:T){
  const[v,s]=useState<T>(initial); const[r,setR]=useState(false);
  useEffect(()=>{try{const x=localStorage.getItem(key);if(x)s(JSON.parse(x))}catch{}setR(true)},[key]);
  useEffect(()=>{if(r)try{localStorage.setItem(key,JSON.stringify(v))}catch{}},[key,r,v]);
  return[v,s] as const;
}

function sessionKey(kind:IntegrationKind){ return `vlacora:integration:key:${kind}`; }

export default function AdminIntegrationsModule({stationName}:{stationName:string}) {
  const[configs,setConfigs]=useStored<Store>("vlacora:integrations:public:v8",seed);
  const[selected,setSelected]=useState<IntegrationKind|null>(null);
  const[keyInput,setKeyInput]=useState("");
  const[keyHeader,setKeyHeader]=useState("Authorization");
  const[keyPrefix,setKeyPrefix]=useState("Bearer");
  const[notice,setNotice]=useState("");
  const[busy,setBusy]=useState(false);
  const[diagnostic,setDiagnostic]=useState<any>(null);

  const cfg = selected ? configs[selected] : null;
  const[supabaseConfigured,setSupabaseConfigured]=useState(false);
  useEffect(()=>setSupabaseConfigured(isSupabaseBrowserConfigured()),[]);

  useEffect(()=>{
    if(selected){
      setKeyInput(sessionStorage.getItem(sessionKey(selected)) || "");
      setKeyHeader(sessionStorage.getItem(`${sessionKey(selected)}:header`) || "Authorization");
      setKeyPrefix(sessionStorage.getItem(`${sessionKey(selected)}:prefix`) || "Bearer");
    }
  },[selected]);

  function flash(x:string){setNotice(x);setTimeout(()=>setNotice(""),2600)}
  function update(kind:IntegrationKind,patch:Partial<PublicConfig>){
    setConfigs({...configs,[kind]:{...configs[kind],...patch}});
  }
  function saveSessionSecret(){
    if(!selected)return;
    if(keyInput)sessionStorage.setItem(sessionKey(selected),keyInput);else sessionStorage.removeItem(sessionKey(selected));
    sessionStorage.setItem(`${sessionKey(selected)}:header`,keyHeader);
    sessionStorage.setItem(`${sessionKey(selected)}:prefix`,keyPrefix);
  }
  function save(){
    if(!selected||!cfg)return;
    saveSessionSecret();
    flash("Configuratie opgeslagen op dit toestel. Geheime sleutel blijft alleen in deze browsersessie.");
  }
  function clearSecret(){
    if(!selected)return;
    sessionStorage.removeItem(sessionKey(selected));
    setKeyInput("");
    flash("Tijdelijke API-sleutel verwijderd");
  }

  async function test(kind:IntegrationKind, action:"status"|"stations"){
    const c=configs[kind];
    if(!c.host.trim()) return flash("Vul eerst het vaste IP-adres in.");
    setBusy(true);
    setDiagnostic(null);
    try{
      const secret = kind===selected ? keyInput : (sessionStorage.getItem(sessionKey(kind))||"");
      const header = kind===selected ? keyHeader : (sessionStorage.getItem(`${sessionKey(kind)}:header`)||"Authorization");
      const prefix = kind===selected ? keyPrefix : (sessionStorage.getItem(`${sessionKey(kind)}:prefix`)||"Bearer");
      const response=await fetch("/api/radio/manual/test",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({kind,action,config:c,apiKey:secret,apiKeyHeader:header,apiKeyPrefix:prefix})
      });
      const data=await response.json();
      setDiagnostic(data);

      if(!response.ok){
        const code=data?.httpError?.code||data?.tcp?.error?.code||data?.fetchError?.code||data?.fetchError?.cause?.code||"";
        const phase=data?.phase||"verbinding";
        throw new Error(`${phase}${code?` • ${code}`:""}: ${data?.message||data?.error||"verbinding mislukt"}`);
      }

      if(action==="stations"){
        const read=await fetch("/api/radio/manual/read",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind,action:"stations",path:c.stationPath,config:c,apiKey:secret,apiKeyHeader:header,apiKeyPrefix:prefix})});
        const list=await read.json();
        if(!read.ok)throw new Error(list.error||"Stations ophalen mislukt");
        saveStationCache(kind,list.stations||[]);
        if(kind==="rotation")await syncSharedRotationStations(list.stations||[]).catch(()=>{});
        flash(`${(list.stations||[]).length} echte station(s) opgehaald`);
      }

      update(kind,{lastOk:new Date().toLocaleString("nl-BE"),lastError:"",enabled:true});
      flash(`${kind==="rotation"?"Rotation One":kind==="playout"?"Playout One":"SHOUTcast"}: verbinding geslaagd`);
    }catch(e){
      const message=e instanceof Error?e.message:"Verbinding mislukt";
      update(kind,{lastError:message});
      flash(message);
    }finally{
      setBusy(false);
    }
  }

  const cards:[IntegrationKind,string,string][]=[
    ["rotation","Rotation One","Playlists, stations en muziekplanning"],
    ["playout","Playout One","Now/next, playoutstatus en actieve playlist"],
    ["shoutcast","SHOUTcast","Streamstatus en luistercijfers"]
  ];

  return <div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}

    <div className="settings-grid admin-v8-grid">
      <div className="card">
        <h3>Stationinstellingen</h3>
        <label className="field">Naam<input className="input" value={stationName} disabled/></label>
        <label className="field">Tijdzone<select className="select" defaultValue="Europe/Brussels"><option>Europe/Brussels</option><option>Europe/Amsterdam</option></select></label>
        <div className="toggle-row"><div><strong>Actief station</strong><small>Toon in VLACORA</small></div><input type="checkbox" defaultChecked/></div>
      </div>

      <div className="card integration-admin-card">
        <div className="module-title-row"><div><h3>Integraties</h3><small>Instellen kan nu volledig hier.</small></div></div>
        {cards.map(([kind,name,desc])=>{
          const c=configs[kind];
          return <div className="integration-v8" key={kind}>
            <div className={`integration-status-dot ${c.lastOk&&!c.lastError?"online":c.host?"configured":""}`}/>
            <div className="integration-v8-info">
              <strong>{name}</strong>
              <span>{c.lastOk&&!c.lastError?"Verbonden":c.host?"Ingesteld • nog testen":"Nog niet gekoppeld"}</span>
              <small>{desc}</small>
            </div>
            <div className="integration-v8-actions">
              {c.host&&<button className="ghost" disabled={busy} onClick={()=>test(kind,"status")}>Test</button>}
              <button className="primary soft" onClick={()=>setSelected(kind)}>Instellen</button>
            </div>
          </div>
        })}
        <div className="integration-v8">
          <div className={`integration-status-dot ${supabaseConfigured?"online":""}`}/>
          <div className="integration-v8-info"><strong>Supabase Auth</strong><span>{supabaseConfigured?"Echte login actief":"Nog niet geconfigureerd"}</span><small>Cookie-based login voor VLACORA teamaccounts</small></div>
          <button className="ghost" onClick={()=>{window.location.href="/login"}}>{supabaseConfigured?"Login":"Instellen"}</button>
        </div>
      </div>

      <div className="card">
        <h3>Automatisering</h3>
        {["Playlistwaarschuwingen","Nieuwscontrole","Social reminders"].map(x=><label className="toggle-row" key={x}><div><strong>{x}</strong><small>Actief voor dit station</small></div><input type="checkbox" defaultChecked/></label>)}
      </div>
    </div>

    {selected&&cfg&&<div className="integration-drawer-backdrop" onMouseDown={()=>setSelected(null)}>
      <div className="integration-drawer" onMouseDown={e=>e.stopPropagation()}>
        <div className="integration-drawer-head">
          <div><span className="eyebrow">INTEGRATIE INSTELLEN</span><h2>{selected==="rotation"?"Rotation One":selected==="playout"?"Playout One":"SHOUTcast"}</h2><p>Vul hier gewoon het vaste publieke IP en de poort in.</p></div>
          <button className="mini-btn" onClick={()=>setSelected(null)}>×</button>
        </div>

        <div className="easy-config-box">
          <div className="two-form-cols">
            <label className="field">Protocol<select className="select" value={cfg.protocol} onChange={e=>update(selected,{protocol:e.target.value as Protocol})}><option value="http">HTTP</option><option value="https">HTTPS</option></select></label>
            <label className="field">Vast IP-adres<input className="input" value={cfg.host} onChange={e=>update(selected,{host:e.target.value.trim()})} placeholder="bv. 81.82.83.84"/></label>
            <label className="field">Poort<input className="input" value={cfg.port} onChange={e=>update(selected,{port:e.target.value.replace(/\D/g,"")})} placeholder="5090"/></label>
            <label className="field">Basis-pad<input className="input" value={cfg.basePath} onChange={e=>update(selected,{basePath:e.target.value})} placeholder="leeg laten indien niet nodig"/></label>
          </div>
          <div className="endpoint-preview"><span>Adres</span><strong>{cfg.protocol}://{cfg.host||"JOUW-IP"}{cfg.port?`:${cfg.port}`:""}{cfg.basePath||""}</strong></div>
        </div>

        <div className="settings-section">
          <h4>API beveiliging</h4>
          <label className="field">API-key / shared secret<input className="input" type="password" value={keyInput} onChange={e=>setKeyInput(e.target.value)} placeholder="optioneel — alleen als jouw API dit gebruikt"/></label>
          <div className="two-form-cols">
            <label className="field">Header<input className="input" value={keyHeader} onChange={e=>setKeyHeader(e.target.value)} placeholder="Authorization"/></label>
            <label className="field">Prefix<input className="input" value={keyPrefix} onChange={e=>setKeyPrefix(e.target.value)} placeholder="Bearer"/></label>
          </div>
          <div className="secret-explainer">
            <strong>🔒 Niet permanent opgeslagen</strong>
            <span>In deze testversie bewaren we de geheime sleutel alleen in de browsersessie. Sluit je de browser volledig, dan vul je hem opnieuw in. Zo hoeven we hem niet onveilig in localStorage of GitHub te zetten.</span>
          </div>
          {keyInput&&<button className="ghost danger-text" onClick={clearSecret}>Verwijder tijdelijke sleutel</button>}
        </div>

        <div className="settings-section">
          <h4>Endpoints</h4>{selected==="playout"&&<div className="http-warning"><strong>Playout One Hub</strong><span>Gebruik bij voorkeur de centrale Hub/API. De standaardpaden kunnen per Playout One-build verschillen; test Status en Stations eerst voordat je Now Playing invult.</span></div>}
          <label className="field">Status endpoint<input className="input" value={cfg.statusPath} onChange={e=>update(selected,{statusPath:e.target.value})}/></label>
          <label className="field">Stations endpoint<input className="input" value={cfg.stationPath} onChange={e=>update(selected,{stationPath:e.target.value})}/></label>
          {selected==="rotation"&&<>
            <label className="field">Schedule endpoint<input className="input" value={cfg.playlistPath||""} onChange={e=>update(selected,{playlistPath:e.target.value})}/></label>
            <label className="field">Coverage endpoint<input className="input" value={cfg.coveragePath||""} onChange={e=>update(selected,{coveragePath:e.target.value})}/></label>
            <label className="field">Revision endpoint<input className="input" value={cfg.revisionPath||""} onChange={e=>update(selected,{revisionPath:e.target.value})}/></label>
            <div className="api-subsection-title"><strong>Muziekdatabase → PDF</strong><span>Deze twee paden zijn optioneel. We vullen ze niet met gok-endpoints.</span></div>
            <label className="field">Muziekmappen endpoint<input className="input" value={cfg.musicFoldersPath||""} onChange={e=>update(selected,{musicFoldersPath:e.target.value})} placeholder="bv. een bevestigd endpoint met {stationId}"/></label>
            <label className="field">Songs-in-map endpoint<input className="input" value={cfg.musicFolderItemsPath||""} onChange={e=>update(selected,{musicFolderItemsPath:e.target.value})} placeholder="bevestigd endpoint met {stationId} en {folderId}"/></label>
            <div className="api-subsection-title"><strong>Hitlijsten uit Rotation One</strong><span>VLACORA haalt de index pas op wanneer je synchroniseert. Geen zware continue polling.</span></div>
            <label className="field">Hitlijsten endpoint<input className="input" value={cfg.chartListPath||""} onChange={e=>update(selected,{chartListPath:e.target.value})}/></label>
            <label className="field">Edities endpoint<input className="input" value={cfg.chartEditionsPath||""} onChange={e=>update(selected,{chartEditionsPath:e.target.value})}/></label>
            <label className="field">Editie-detail endpoint<input className="input" value={cfg.chartEditionPath||""} onChange={e=>update(selected,{chartEditionPath:e.target.value})}/></label>
            <label className="field">Hitlijst revision endpoint<input className="input" value={cfg.chartRevisionPath||""} onChange={e=>update(selected,{chartRevisionPath:e.target.value})}/></label>
            <label className="field">Write endpoint<input className="input" value={cfg.chartWritePath||""} onChange={e=>update(selected,{chartWritePath:e.target.value})}/></label>
            <label className="toggle-row chart-write-toggle"><div><strong>Hitlijsten terugschrijven</strong><small>{supabaseConfigured?"Alleen ingelogde VLACORA-gebruikers kunnen remote schrijven.":"Eerst echte Supabase-login activeren."}</small></div><input type="checkbox" checked={Boolean(cfg.chartWriteEnabled)} disabled={!supabaseConfigured} onChange={e=>update(selected,{chartWriteEnabled:e.target.checked})}/></label>
          </>}
          {selected==="playout"&&<label className="field">Now-playing/snapshot endpoint<input className="input" value={cfg.nowPath||""} onChange={e=>update(selected,{nowPath:e.target.value})} placeholder="/api/v1/integration/stations/{stationId}/status"/></label>}
          {selected==="playout"&&<div className="secret-explainer"><strong>Playout One 0.11.19</strong><span>Gebruik Hub-poort 5099. Health, stations en live status komen uit de zuinige VLACORA Integration API; status/NOW/NEXT lezen de bestaande heartbeat in geheugen en veroorzaken geen extra stationpolling.</span></div>}
        </div>

        <div className="settings-section">
          <h4>Veiligheidsmodus</h4>
          <div className="read-only-lock">
            <div><strong>Alleen lezen</strong><span>De algemene radio-koppeling blijft read-only. Alleen hitlijsten kunnen afzonderlijk worden teruggeschreven wanneer echte login actief is én je de write-schakelaar bewust aanzet.</span></div>
            <input type="checkbox" checked readOnly/>
          </div>
          {cfg.protocol==="http"&&<div className="http-warning"><strong>HTTP actief</strong><span>Dat werkt met jouw vaste IP, maar verkeer tussen Vercel en de radioserver is niet versleuteld. Gebruik daarom een lange API-key en open alleen de strikt nodige poort(en).</span></div>}
        </div>

        {cfg.lastError&&<div className="config-error"><strong>Laatste fout</strong><span>{cfg.lastError}</span></div>}
        {cfg.lastOk&&<div className="config-ok"><strong>Laatste verbinding</strong><span>{cfg.lastOk}</span></div>}

        {diagnostic&&<div className="connection-diagnostic">
          <div className="module-title-row"><div><h3>Technische diagnose</h3><small>Hier zie je exact waar de verbinding stopt.</small></div></div>
          <div className="diagnostic-grid">
            <span>Fase</span><strong>{diagnostic.phase||"—"}</strong>
            <span>Doel</span><strong>{diagnostic.target||"—"}</strong>
            <span>Transport</span><strong>{diagnostic.transport||"—"}</strong>
            <span>TCP</span><strong>{diagnostic.tcp?.ok?"Verbonden":diagnostic.tcp?.error?.code||(!diagnostic.tcp?"Niet apart getest":"Mislukt")}</strong>
            <span>TCP tijd</span><strong>{diagnostic.tcp?.durationMs!=null?`${diagnostic.tcp.durationMs} ms`:"—"}</strong>
            <span>HTTP</span><strong>{diagnostic.status||diagnostic.httpError?.code||diagnostic.fetchError?.code||diagnostic.fetchError?.cause?.code||"—"}</strong>
            <span>HTTP tijd</span><strong>{diagnostic.httpDurationMs!=null?`${diagnostic.httpDurationMs} ms`:"—"}</strong>
            <span>Vercel regio</span><strong>{diagnostic.runtime?.vercelRegion||"onbekend"}</strong>
            <span>Node</span><strong>{diagnostic.runtime?.node||"—"}</strong>
          </div>
          {(diagnostic.message||diagnostic.httpError?.message||diagnostic.fetchError?.message||diagnostic.tcp?.error?.message)&&<code className="diagnostic-error-text">{diagnostic.message||diagnostic.httpError?.message||diagnostic.fetchError?.message||diagnostic.tcp?.error?.message}</code>}
        </div>}

        <div className="drawer-actions">
          <button className="ghost" disabled={busy} onClick={()=>test(selected,"stations")}>Stations ophalen</button>
          <button className="ghost" disabled={busy} onClick={()=>test(selected,"status")}>Test verbinding</button>
          <button className="primary" onClick={()=>{save();setSelected(null)}}>Opslaan</button>
        </div>
      </div>
    </div>}
  </div>
}
