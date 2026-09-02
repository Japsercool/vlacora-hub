"use client";

import { useEffect,useMemo,useState } from "react";
import { isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import { syncSharedPlayoutStations,syncSharedRotationStations } from "@/lib/supabase/hub-data";
import {
  CONFIG_KEY,mergeStationCache,readIntegrationStore,readSecret,saveStationCache,sessionKey,writeIntegrationStore,
  type ClientIntegrationConfig,type IntegrationKind,type IntegrationStore,type Protocol
} from "@/lib/radio/client-config";
import {
  loadSharedIntegrationStore,loadSharedSetting,saveSharedIntegrationStore,saveSharedSetting
} from "@/lib/supabase/settings";
import { deletePersistedIntegrationSecret,hydrateIntegrationSecret,migrateSessionSecretToVault,normalizeIntegrationSecret,savePersistedIntegrationSecret } from "@/lib/supabase/secrets";
import { readStationAliases,saveStationAlias } from "@/lib/radio/hub-stations";

type StationSettings={timezone:string;active:boolean;playlistWarnings:boolean;newsCheck:boolean;socialReminders:boolean};

const seed:IntegrationStore={
  rotation:{
    enabled:false,protocol:"http",host:"",port:"5500",basePath:"",stationPath:"/api/v1/stations",statusPath:"/api/v1/health",
    playlistPath:"/api/v1/stations/{stationId}/schedule",coveragePath:"/api/v1/stations/{stationId}/schedule/coverage",revisionPath:"/api/v1/stations/{stationId}/schedule/revision",
    musicFoldersPath:"/api/v1/stations/{stationId}/music/folders",musicFolderItemsPath:"/api/v1/stations/{stationId}/music/folders/{folderId}/songs",
    chartListPath:"/api/v1/stations/{stationId}/charts",chartEditionsPath:"/api/v1/stations/{stationId}/charts/{chartId}/editions",chartEditionPath:"/api/v1/stations/{stationId}/charts/{chartId}/editions/{editionId}",chartRevisionPath:"/api/v1/stations/{stationId}/charts/revision",chartWritePath:"/api/v1/stations/{stationId}/charts/{chartId}/editions/{editionId}",chartWriteEnabled:false,readOnly:true
  },
  playout:{
    enabled:false,protocol:"http",host:"",port:"5099",basePath:"",
    stationPath:"/api/v1/integration/stations",statusPath:"/api/v1/integration/health",
    nowPath:"/api/v1/integration/stations/{stationId}/status",
    playoutNowPath:"/api/v1/integration/stations/{stationId}/now",
    playoutNextPath:"/api/v1/integration/stations/{stationId}/next",
    playoutEnginePath:"/api/v1/integration/stations/{stationId}/engine",
    playoutStreamPath:"/api/v1/integration/stations/{stationId}/stream",
    playoutQueuePath:"/api/v1/integration/stations/{stationId}/queue?limit=20",
    playoutRevisionsPath:"/api/v1/integration/revisions",
    readOnly:true
  },
  shoutcast:{enabled:false,protocol:"http",host:"",port:"8000",basePath:"",stationPath:"/stats?sid=1",statusPath:"/stats?sid=1",shoutcastSid:"1",readOnly:true}
};
const stationSeed:StationSettings={timezone:"Europe/Brussels",active:true,playlistWarnings:true,newsCheck:true,socialReminders:true};

function normalizeShoutcastPublicConfig(config:ClientIntegrationConfig){
  const rawPath=String(config.statusPath||config.stationPath||"").trim();
  const sid=String(config.shoutcastSid||rawPath.match(/[?&]sid=(\d+)/i)?.[1]||"1");
  let statusPath=rawPath||`/stats?sid=${sid}`;
  statusPath=statusPath.replace(/([?&])json=1(?:&|$)/i,(_,sep)=>sep==="?"?"?":"").replace(/[?&]$/,"");
  if(!statusPath.startsWith("/"))statusPath=`/${statusPath}`;
  return{...config,shoutcastSid:sid,statusPath,stationPath:statusPath};
}

export default function AdminIntegrationsModule({stationName,stationSlug}:{stationName:string;stationSlug:string}){
  const[configs,setConfigs]=useState<IntegrationStore>(seed);
  const[stationSettings,setStationSettings]=useState<StationSettings>(stationSeed);
  const[selected,setSelected]=useState<IntegrationKind|null>(null);
  const[keyInput,setKeyInput]=useState("");
  const[keyHeader,setKeyHeader]=useState("Authorization");
  const[keyPrefix,setKeyPrefix]=useState("Bearer");
  const[notice,setNotice]=useState("");
  const[busy,setBusy]=useState(false);
  const[diagnostic,setDiagnostic]=useState<any>(null);
  const[loaded,setLoaded]=useState(false);
  const[secretState,setSecretState]=useState<"idle"|"loading"|"stored"|"session"|"none">("idle");
  const[localStationName,setLocalStationName]=useState(stationName);
  const[localStationShort,setLocalStationShort]=useState("");
  const supabaseConfigured=useMemo(()=>isSupabaseBrowserConfigured(),[]);
  const cfg=selected?configs[selected]:null;

  useEffect(()=>{
    let alive=true;
    (async()=>{
      const local=readIntegrationStore();
      let merged:IntegrationStore={...seed,rotation:{...seed.rotation,...local.rotation},playout:{...seed.playout,...local.playout},shoutcast:{...seed.shoutcast,...local.shoutcast}};
      merged.shoutcast=normalizeShoutcastPublicConfig(merged.shoutcast);
      if(supabaseConfigured){
        const remote=await loadSharedIntegrationStore(stationSlug);
        const hasRemote=Boolean(remote.rotation||remote.playout||remote.shoutcast);
        merged={...merged,rotation:{...merged.rotation,...remote.rotation},playout:{...merged.playout,...remote.playout},shoutcast:{...merged.shoutcast,...remote.shoutcast}};
        merged.shoutcast=normalizeShoutcastPublicConfig(merged.shoutcast);
        // One-time migration: an existing browser configuration is copied into Supabase instead of being lost after this update.
        if(!hasRemote&&(local.rotation?.host||local.playout?.host||local.shoutcast?.host))void saveSharedIntegrationStore(merged,stationSlug).catch(()=>{});
        const remoteStation=await loadSharedSetting<StationSettings>(`station:${stationSlug}`,"station-settings");
        if(alive&&remoteStation)setStationSettings({...stationSeed,...remoteStation});
        else if(alive){
          try{const raw=localStorage.getItem(`vlacora:${stationSlug}:settings`);if(raw){const legacy={...stationSeed,...JSON.parse(raw)};setStationSettings(legacy);void saveSharedSetting(`station:${stationSlug}`,"station-settings",legacy).catch(()=>{})}}catch{}
        }
      }
      if(!alive)return;
      setConfigs(merged);writeIntegrationStore(merged);const alias=readStationAliases()[stationSlug];setLocalStationName(alias?.name||stationName);setLocalStationShort(alias?.short||"");setLoaded(true);
      if(supabaseConfigured){
        void Promise.all((["rotation","playout","shoutcast"] as IntegrationKind[]).map(kind=>migrateSessionSecretToVault(kind))).catch(()=>{});
      }
    })().catch(()=>setLoaded(true));
    return()=>{alive=false};
  },[stationSlug,supabaseConfigured]);

  useEffect(()=>{
    if(!selected)return;
    let alive=true;
    setSecretState("loading");
    const local=readSecret(selected);
    setKeyInput(local.apiKey);
    setKeyHeader(local.apiKeyHeader);
    setKeyPrefix(local.apiKeyPrefix);
    (async()=>{
      if(supabaseConfigured){
        const central=await hydrateIntegrationSecret(selected);
        if(!alive)return;
        if(central?.apiKey){
          setKeyInput(central.apiKey);setKeyHeader(central.apiKeyHeader);setKeyPrefix(central.apiKeyPrefix);setSecretState("stored");return;
        }
      }
      if(!alive)return;
      setSecretState(local.apiKey?"session":"none");
    })().catch(()=>{if(alive)setSecretState(local.apiKey?"session":"none")});
    return()=>{alive=false};
  },[selected,supabaseConfigured]);

  function flash(text:string){setNotice(text);window.setTimeout(()=>setNotice(""),3200)}
  function update(kind:IntegrationKind,patch:Partial<ClientIntegrationConfig>){
    setConfigs(current=>({...current,[kind]:{...current[kind],...patch}}));
  }
  function updateShoutcastSid(value:string){
    const sid=value.replace(/\D/g,"")||"1";
    const current=configs.shoutcast.statusPath||"";
    const next=/[?&]sid=\d+/i.test(current)?current.replace(/([?&]sid=)\d+/i,`$1${sid}`):`/stats?sid=${sid}`;
    update("shoutcast",{shoutcastSid:sid,statusPath:next,stationPath:next});
  }
  function updateShoutcastEndpoint(value:string){
    const path=value.trimStart();
    const sid=path.match(/[?&]sid=(\d+)/i)?.[1]||configs.shoutcast.shoutcastSid||"1";
    update("shoutcast",{statusPath:path,stationPath:path,shoutcastSid:String(sid)});
  }
  function useStandardShoutcastEndpoint(){
    const sid=configs.shoutcast.shoutcastSid||"1";
    update("shoutcast",{statusPath:`/stats?sid=${sid}`,stationPath:`/stats?sid=${sid}`});
  }
  function saveSessionSecret(kind:IntegrationKind){
    const normalized=normalizeIntegrationSecret({apiKey:keyInput,apiKeyHeader:keyHeader,apiKeyPrefix:keyPrefix});
    if(normalized.apiKey)sessionStorage.setItem(sessionKey(kind),normalized.apiKey);else sessionStorage.removeItem(sessionKey(kind));
    sessionStorage.setItem(`${sessionKey(kind)}:header`,normalized.apiKeyHeader);
    sessionStorage.setItem(`${sessionKey(kind)}:prefix`,normalized.apiKeyPrefix);
    setKeyInput(normalized.apiKey);setKeyHeader(normalized.apiKeyHeader);setKeyPrefix(normalized.apiKeyPrefix);
  }
  async function saveIntegration(){
    if(!selected)return;
    setBusy(true);
    if(selected!=="shoutcast")saveSessionSecret(selected);
    writeIntegrationStore(configs);
    try{
      if(supabaseConfigured){
        await saveSharedIntegrationStore(configs,stationSlug);
        if(selected!=="shoutcast"&&keyInput.trim()){
          const normalized=normalizeIntegrationSecret({apiKey:keyInput,apiKeyHeader:keyHeader,apiKeyPrefix:keyPrefix});
          await savePersistedIntegrationSecret(selected,normalized);
          setSecretState("stored");
          flash("Instellingen én API-sleutel veilig centraal opgeslagen. Ze blijven behouden na updates en browserherstarts.");
        }else if(selected==="shoutcast"){
          flash("SHOUTcast host, poort, SID en DNAS endpoint centraal opgeslagen.");
        }else{
          flash("Publieke instellingen centraal opgeslagen. Een bestaande centrale API-sleutel is behouden.");
        }
      }else{
        flash("Lokaal opgeslagen. De API-sleutel blijft alleen actief in deze browsersessie zolang Supabase niet actief is.");
      }
      setSelected(null);
    }catch(e){flash(e instanceof Error?e.message:"Opslaan mislukt")}
    finally{setBusy(false)}
  }
  async function saveStationSettings(){
    try{saveStationAlias(stationSlug,{name:localStationName,short:localStationShort});if(supabaseConfigured){await Promise.all([saveSharedSetting(`station:${stationSlug}`,"station-settings",stationSettings),saveSharedSetting(`station:${stationSlug}`,"station-alias",{name:localStationName.trim(),short:localStationShort.trim().toUpperCase().slice(0,4)})]);flash("Stationinstellingen en VLACORA-naam opgeslagen")}else{localStorage.setItem(`vlacora:station-settings:${stationSlug}`,JSON.stringify(stationSettings));flash("Stationinstellingen en lokale naam opgeslagen")}}catch(e){flash(e instanceof Error?e.message:"Opslaan mislukt")}
  }
  async function clearSecret(){
    if(!selected)return;
    if(!window.confirm("Deze API-sleutel echt centraal verwijderen? Rotation/Playout kan daarna niet meer verbinden tot je een nieuwe sleutel opslaat."))return;
    setBusy(true);
    try{
      await deletePersistedIntegrationSecret(selected);
      sessionStorage.removeItem(sessionKey(selected));
      sessionStorage.removeItem(`${sessionKey(selected)}:header`);
      sessionStorage.removeItem(`${sessionKey(selected)}:prefix`);
      setKeyInput("");setKeyHeader("Authorization");setKeyPrefix("Bearer");setSecretState("none");
      flash("API-sleutel centraal verwijderd");
    }catch(e){flash(e instanceof Error?e.message:"API-sleutel verwijderen mislukt")}
    finally{setBusy(false)}
  }

  async function test(kind:IntegrationKind,action:"status"|"stations"){
    const c=configs[kind];if(!c.host.trim())return flash("Vul eerst het publieke IP-adres in.");
    if(kind==="shoutcast"&&action==="stations")return;
    setBusy(true);setDiagnostic(null);
    try{
      let cached=readSecret(kind);
      if(!cached.apiKey&&supabaseConfigured){await hydrateIntegrationSecret(kind).catch(()=>null);cached=readSecret(kind)}
      const secret=kind===selected?(keyInput||cached.apiKey):cached.apiKey;
      const header=kind===selected?keyHeader:cached.apiKeyHeader;
      const prefix=kind===selected?keyPrefix:cached.apiKeyPrefix;
      const response=await fetch("/api/radio/manual/test",{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json","Cache-Control":"no-cache"},body:JSON.stringify({kind,action,config:c,apiKey:secret,apiKeyHeader:header,apiKeyPrefix:prefix})});
      const data=await response.json();setDiagnostic(data);
      if(!response.ok){const code=data?.httpError?.code||data?.tcp?.error?.code||"";throw new Error(`${data?.phase||"verbinding"}${code?` • ${code}`:""}: ${data?.message||data?.error||`HTTP ${response.status}`}`)}
      if(action==="stations"){
        const read=await fetch("/api/radio/manual/read",{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json","Cache-Control":"no-cache"},body:JSON.stringify({kind,action:"stations",path:c.stationPath,config:c,apiKey:secret,apiKeyHeader:header,apiKeyPrefix:prefix,requestId:`admin-${Date.now()}`})});
        const list=await read.json();if(!read.ok)throw new Error(list.error||"Stations ophalen mislukt");
        const incoming=list.stations||[];if(kind==="rotation"){saveStationCache(kind,incoming);await syncSharedRotationStations(incoming).catch(()=>{})}if(kind==="playout"&&incoming.length){const merged=mergeStationCache("playout",incoming);await syncSharedPlayoutStations(merged).catch(()=>{})}
      }
      const changed={...configs,[kind]:{...configs[kind],enabled:true,lastOk:new Date().toLocaleString("nl-BE"),lastError:""}};
      setConfigs(changed);writeIntegrationStore(changed);
      flash(`${kind==="rotation"?"Rotation One":kind==="playout"?"Playout One":"SHOUTcast"}: verbinding geslaagd`);
    }catch(e){const message=e instanceof Error?e.message:"Verbinding mislukt";update(kind,{lastError:message});flash(message)}finally{setBusy(false)}
  }

  const cards:[IntegrationKind,string,string][]=[
    ["rotation","Rotation One","Stations, muziek, playlists en hitlijsten"],
    ["playout","Playout One","Live engine, NOW/NEXT, encoder en stream"],
    ["shoutcast","SHOUTcast","Echte live luistercijfers voor dit station"]
  ];

  return <div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}
    <div className="settings-persistence-banner"><strong>✓ Centrale instellingen</strong><span>{supabaseConfigured?"Publieke configuratie en stationinstellingen worden in Supabase bewaard en verdwijnen niet bij een nieuwe VLACORA-deploy.":"Supabase is niet actief; instellingen vallen terug op dit toestel."}</span></div>

    <div className="settings-grid admin-v8-grid">
      <div className="card">
        <h3>Stationinstellingen</h3>
        <label className="field">VLACORA naam<input className="input" value={localStationName} onChange={e=>setLocalStationName(e.target.value)} placeholder={stationName}/><small>Alleen de naam in VLACORA. Rotation One blijft ongewijzigd.</small></label><label className="field">Korte naam / badge<input className="input" maxLength={4} value={localStationShort} onChange={e=>setLocalStationShort(e.target.value.toUpperCase())} placeholder="bv. VH"/></label>
        <label className="field">Tijdzone<select className="select" value={stationSettings.timezone} onChange={e=>setStationSettings({...stationSettings,timezone:e.target.value})}><option>Europe/Brussels</option><option>Europe/Amsterdam</option></select></label>
        <label className="toggle-row"><div><strong>Actief station</strong><small>Toon in VLACORA</small></div><input type="checkbox" checked={stationSettings.active} onChange={e=>setStationSettings({...stationSettings,active:e.target.checked})}/></label>
        <button className="primary wide" onClick={saveStationSettings}>Stationinstellingen opslaan</button>
      </div>

      <div className="card integration-admin-card">
        <div className="module-title-row"><div><h3>Integraties</h3><small>{loaded?"Centraal gesynchroniseerd":"Instellingen laden…"}</small></div></div>
        {cards.map(([kind,name,desc])=>{const c=configs[kind];return <div className="integration-v8" key={kind}>
          <div className={`integration-status-dot ${c.lastOk&&!c.lastError?"online":c.host?"configured":""}`}/>
          <div className="integration-v8-info"><strong>{name}</strong><span>{c.lastOk&&!c.lastError?"Verbonden":c.host?"Ingesteld":"Nog niet gekoppeld"}</span><small>{desc}</small></div>
          <div className="integration-v8-actions">{c.host&&<button className="ghost" disabled={busy} onClick={()=>test(kind,"status")}>Test</button>}<button className="primary soft" onClick={()=>setSelected(kind)}>Instellen</button></div>
        </div>})}
        <div className="integration-v8"><div className={`integration-status-dot ${supabaseConfigured?"online":""}`}/><div className="integration-v8-info"><strong>Supabase Auth</strong><span>{supabaseConfigured?"Echte login actief":"Nog niet geconfigureerd"}</span><small>Gebruikers, rechten, meldingen en instellingen</small></div><button className="ghost" onClick={()=>location.href="/login"}>Account</button></div>
      </div>

      <div className="card">
        <h3>Automatisering</h3>
        <label className="toggle-row"><div><strong>Playlistwaarschuwingen</strong><small>Actief voor dit station</small></div><input type="checkbox" checked={stationSettings.playlistWarnings} onChange={e=>setStationSettings({...stationSettings,playlistWarnings:e.target.checked})}/></label>
        <label className="toggle-row"><div><strong>Nieuwscontrole</strong><small>Actief voor dit station</small></div><input type="checkbox" checked={stationSettings.newsCheck} onChange={e=>setStationSettings({...stationSettings,newsCheck:e.target.checked})}/></label>
        <label className="toggle-row"><div><strong>Social reminders</strong><small>Actief voor dit station</small></div><input type="checkbox" checked={stationSettings.socialReminders} onChange={e=>setStationSettings({...stationSettings,socialReminders:e.target.checked})}/></label>
        <button className="ghost wide" onClick={saveStationSettings}>Automatisering opslaan</button>
      </div>
    </div>

    {selected&&cfg&&<div className="integration-drawer-backdrop" onMouseDown={()=>setSelected(null)}><div className="integration-drawer" onMouseDown={e=>e.stopPropagation()}>
      <div className="integration-drawer-head"><div><span className="eyebrow">INTEGRATIE INSTELLEN</span><h2>{selected==="rotation"?"Rotation One":selected==="playout"?"Playout One":"SHOUTcast"}</h2><p>{selected==="shoutcast"?`Luistercijfers voor ${stationName}. Elke zender kan een eigen SHOUTcast endpoint hebben.`:"Centrale radio-API koppeling."}</p></div><button className="mini-btn" onClick={()=>setSelected(null)}>×</button></div>

      <div className="easy-config-box"><div className="two-form-cols">
        <label className="field">Protocol<select className="select" value={cfg.protocol} onChange={e=>update(selected,{protocol:e.target.value as Protocol})}><option value="http">HTTP</option><option value="https">HTTPS</option></select></label>
        <label className="field">Publiek IP-adres<input className="input" value={cfg.host} onChange={e=>update(selected,{host:e.target.value.trim()})} placeholder="bv. 85.215.152.155"/></label>
        <label className="field">Poort<input className="input" value={cfg.port} onChange={e=>update(selected,{port:e.target.value.replace(/\D/g,"")})} placeholder={selected==="rotation"?"5500":selected==="playout"?"5099":"8000"}/></label>
        {selected==="shoutcast"&&<label className="field">Stream SID<input className="input" value={cfg.shoutcastSid||cfg.statusPath.match(/[?&]sid=(\d+)/i)?.[1]||"1"} onChange={e=>updateShoutcastSid(e.target.value)} placeholder="bv. 4"/><small>Voor de stream uit je screenshot vul je hier 4 in.</small></label>}
        <label className="field">Basis-pad<input className="input" value={cfg.basePath} onChange={e=>update(selected,{basePath:e.target.value})} placeholder="meestal leeg"/></label>
      </div><div className="endpoint-preview"><span>Adres</span><strong>{cfg.protocol}://{cfg.host||"JOUW-IP"}{cfg.port?`:${cfg.port}`:""}{cfg.basePath||""}</strong></div></div>

      {selected==="shoutcast"
        ?<div className="settings-section"><h4>API beveiliging</h4><div className="public-api-note"><strong>✓ Geen API-sleutel nodig</strong><span>De DNAS <code>/stats?sid=X</code>-pagina is publieke read-only statistiek. Daarom toont VLACORA voor SHOUTcast geen onnodige Vault/API-key melding.</span></div></div>
        :<div className="settings-section"><h4>API beveiliging</h4><label className="field">API-key / shared secret<input className="input" type="password" value={keyInput} onChange={e=>setKeyInput(e.target.value)} placeholder={secretState==="stored"?"Centraal opgeslagen in Supabase Vault":"leeg laten als deze koppeling geen key gebruikt"}/></label><div className="two-form-cols"><label className="field">Header<input className="input" value={keyHeader} onChange={e=>setKeyHeader(e.target.value)}/></label><label className="field">Prefix<input className="input" value={keyPrefix} onChange={e=>setKeyPrefix(e.target.value)}/></label></div><div className="secret-explainer"><strong>🔐 {secretState==="stored"?"Veilig centraal opgeslagen":secretState==="loading"?"Sleutel laden…":secretState==="session"?"Nog alleen in deze sessie":"Nog geen centrale sleutel"}</strong><span>{supabaseConfigured?"API-sleutels worden versleuteld opgeslagen met Supabase Vault en automatisch teruggeladen na een deploy, browserherstart of op een ander toestel. Ze staan niet in GitHub, localStorage of een leesbare VLACORA-tabel.":"Supabase is niet actief; de sleutel kan alleen tijdelijk in deze browsersessie blijven."}</span></div>{(keyInput||secretState==="stored")&&<button className="ghost danger-text" disabled={busy} onClick={()=>void clearSecret()}>Verwijder opgeslagen sleutel</button>}</div>}

      <div className="settings-section"><h4>Endpoints</h4>
        {selected==="shoutcast"
          ?<div className="shoutcast-endpoint-editor"><div className="two-form-cols"><label className="field">SID<input className="input" value={cfg.shoutcastSid||"1"} onChange={e=>updateShoutcastSid(e.target.value)}/></label><label className="field">DNAS stats endpoint<input className="input" value={cfg.statusPath} onChange={e=>updateShoutcastEndpoint(e.target.value)} placeholder="/stats?sid=4"/></label></div><div className="mapping-help-row"><small>Je kunt dit endpoint nu zelf aanpassen. Een SID in de URL wordt automatisch overgenomen.</small><button className="mini-btn" type="button" onClick={useStandardShoutcastEndpoint}>Gebruik /stats?sid={cfg.shoutcastSid||"1"}</button></div></div>
          :<label className="field">Status endpoint<input className="input" value={cfg.statusPath} onChange={e=>update(selected,{statusPath:e.target.value})}/></label>}
        {selected!=="shoutcast"&&<label className="field">Stations endpoint<input className="input" value={cfg.stationPath} onChange={e=>update(selected,{stationPath:e.target.value})}/></label>}
        {selected==="shoutcast"&&<div className="shoutcast-config-note"><strong>SHOUTcast DNAS XML • aanbevolen</strong><code>/stats?sid={cfg.shoutcastSid||"1"}</code><span>VLACORA leest CURRENTLISTENERS, PEAKLISTENERS, MAXLISTENERS, UNIQUELISTENERS, AVERAGETIME, SONGTITLE, STREAMSTATUS, STREAMHITS, STREAMPATH, STREAMUPTIME, BITRATE, SAMPLERATE, CONTENT en SERVERTITLE. JSON blijft ondersteund als fallback.</span></div>}
        {selected==="rotation"&&<>
          <label className="field">Schedule endpoint<input className="input" value={cfg.playlistPath||""} onChange={e=>update(selected,{playlistPath:e.target.value})}/></label>
          <label className="field">Coverage endpoint<input className="input" value={cfg.coveragePath||""} onChange={e=>update(selected,{coveragePath:e.target.value})}/></label>
          <label className="field">Revision endpoint<input className="input" value={cfg.revisionPath||""} onChange={e=>update(selected,{revisionPath:e.target.value})}/></label>
          <div className="api-subsection-title"><strong>Muziekdatabase → PDF</strong><span>Echte Rotation One-paden.</span></div>
          <label className="field">Muziekmappen endpoint<input className="input" value={cfg.musicFoldersPath||""} onChange={e=>update(selected,{musicFoldersPath:e.target.value})}/></label>
          <label className="field">Songs-in-map endpoint<input className="input" value={cfg.musicFolderItemsPath||""} onChange={e=>update(selected,{musicFolderItemsPath:e.target.value})}/></label>
          <div className="api-subsection-title"><strong>Hitlijsten uit Rotation One</strong><span>Index/edities worden alleen opgehaald wanneer nodig.</span></div>
          <label className="field">Hitlijsten endpoint<input className="input" value={cfg.chartListPath||""} onChange={e=>update(selected,{chartListPath:e.target.value})}/></label>
          <label className="field">Edities endpoint<input className="input" value={cfg.chartEditionsPath||""} onChange={e=>update(selected,{chartEditionsPath:e.target.value})}/></label>
          <label className="field">Editie-detail endpoint<input className="input" value={cfg.chartEditionPath||""} onChange={e=>update(selected,{chartEditionPath:e.target.value})}/></label>
          <label className="field">Hitlijst revision endpoint<input className="input" value={cfg.chartRevisionPath||""} onChange={e=>update(selected,{chartRevisionPath:e.target.value})}/></label>
          <label className="field">Write endpoint<input className="input" value={cfg.chartWritePath||""} onChange={e=>update(selected,{chartWritePath:e.target.value})}/></label>
          <label className="toggle-row chart-write-toggle"><div><strong>Hitlijsten terugschrijven</strong><small>Alleen voor ingelogde teamleden wanneer je dit bewust activeert.</small></div><input type="checkbox" checked={Boolean(cfg.chartWriteEnabled)} onChange={e=>update(selected,{chartWriteEnabled:e.target.checked})}/></label>
        </>}
        {selected==="playout"&&<>
          <div className="api-subsection-title"><strong>Playout One Live API</strong><span>De Hub-heartbeat bevat veel meer dan alleen de stationsnaam.</span></div>
          <label className="field">Status/snapshot endpoint<input className="input" value={cfg.nowPath||""} onChange={e=>update(selected,{nowPath:e.target.value})}/></label>
          <div className="two-form-cols"><label className="field">NOW endpoint<input className="input" value={cfg.playoutNowPath||"/api/v1/integration/stations/{stationId}/now"} onChange={e=>update(selected,{playoutNowPath:e.target.value})}/></label><label className="field">NEXT endpoint<input className="input" value={cfg.playoutNextPath||"/api/v1/integration/stations/{stationId}/next"} onChange={e=>update(selected,{playoutNextPath:e.target.value})}/></label></div>
          <div className="two-form-cols"><label className="field">Engine endpoint<input className="input" value={cfg.playoutEnginePath||"/api/v1/integration/stations/{stationId}/engine"} onChange={e=>update(selected,{playoutEnginePath:e.target.value})}/></label><label className="field">Stream endpoint<input className="input" value={cfg.playoutStreamPath||"/api/v1/integration/stations/{stationId}/stream"} onChange={e=>update(selected,{playoutStreamPath:e.target.value})}/></label></div>
          <label className="field">Queue endpoint<input className="input" value={cfg.playoutQueuePath||"/api/v1/integration/stations/{stationId}/queue?limit=20"} onChange={e=>update(selected,{playoutQueuePath:e.target.value})}/></label>
          <label className="field">Revisions endpoint<input className="input" value={cfg.playoutRevisionsPath||"/api/v1/integration/revisions"} onChange={e=>update(selected,{playoutRevisionsPath:e.target.value})}/></label>
          <div className="playout-capability-box"><strong>Nieuwe aparte pagina in het menu: Playout One</strong><div><span>● heartbeat/online</span><span>♫ NOW + voortgang</span><span>→ NEXT</span><span>⚙ engine/machine</span><span>◉ AUTO/LIVE</span><span>⌁ queue</span><span>◌ encoder/bitrate</span><span>◈ DSP/Stereo Tool</span><span>↻ Rotation schedule</span><span>! fouten</span></div><button className="primary soft" type="button" onClick={()=>location.href=`/hub/${stationSlug}/playout`}>Open Playout One →</button></div>
          <div className="secret-explainer"><strong>Zuinig</strong><span>Status komt uit de heartbeat die Playout One toch al naar Hub :5099 stuurt. De wachtrij wordt alleen geladen wanneer jij ze opent.</span></div><div className="public-api-note playout-auth-note"><strong>Playout authenticatie</strong><span>VLACORA normaliseert automatisch <code>po1_…</code>, <code>Bearer po1_…</code> en <code>Authorization: Bearer po1_…</code>. Naar Playout One probeert het altijd eerst de officiële <code>Authorization: Bearer</code>-vorm en bij een 401 éénmalig <code>X-Playout-Api-Key</code>.</span></div>
        </>}
      </div>

      {cfg.protocol==="http"&&<div className="http-warning"><strong>HTTP actief</strong><span>Functioneel, maar niet versleuteld. Gebruik voor APIs met Bearer-key later bij voorkeur HTTPS.</span></div>}
      {cfg.lastError&&<div className="config-error"><strong>Laatste fout</strong><span>{cfg.lastError}</span></div>}
      {cfg.lastOk&&<div className="config-ok"><strong>Laatste verbinding</strong><span>{cfg.lastOk}</span></div>}
      {diagnostic&&<div className="connection-diagnostic"><div className="diagnostic-grid"><span>Fase</span><strong>{diagnostic.phase||"—"}</strong><span>Doel</span><strong>{diagnostic.target||"—"}</strong><span>HTTP</span><strong>{diagnostic.status||diagnostic.httpError?.code||"—"}</strong><span>Vercel regio</span><strong>{diagnostic.runtime?.vercelRegion||"onbekend"}</strong></div></div>}
      <div className="drawer-actions">{selected!=="shoutcast"&&<button className="ghost" disabled={busy} onClick={()=>test(selected,"stations")}>Stations ophalen</button>}<button className="ghost" disabled={busy} onClick={()=>test(selected,"status")}>Test verbinding</button><button className="primary" disabled={busy||secretState==="loading"} onClick={saveIntegration}>{busy?"Opslaan…":"Opslaan"}</button></div>
    </div></div>}
  </div>
}
