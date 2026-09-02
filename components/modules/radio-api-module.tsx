"use client";
import { useEffect,useMemo,useState } from "react";
import { pathFor,radioRead,readIntegration,readMappings,readSecret,readStationCache,saveMappings,saveStationCache,type RadioMappingStore,type RadioStation } from "@/lib/radio/client-config";
import { readHubStations,rotationHubSlug,type HubStation,useHubStation,HUB_STATIONS_EVENT } from "@/lib/radio/hub-stations";
import { loadSharedPlayoutStations,syncSharedPlayoutStations,syncSharedRotationStations } from "@/lib/supabase/hub-data";
import { hydrateSharedIntegrationSettings,loadSharedRadioMapping,saveSharedRadioMapping } from "@/lib/supabase/settings";
import { hydrateIntegrationSecret } from "@/lib/supabase/secrets";

const norm=(x:string)=>x.toLowerCase().replace(/[^a-z0-9]/g,"");
function shoutSummary(raw:any){
  const x=raw?.streams?.[0]||raw?.stream||raw?.stats||raw||{};
  const listeners=Number(x.currentlisteners??x.currentListeners??x.listeners??x.listener_count??0);
  const online=String(x.streamstatus??x.streamStatus??x.online??x.status??"").toLowerCase();
  return {listeners:Number.isFinite(listeners)?listeners:0,online:["1","true","online","up"].includes(online)||x.streamstatus===1,title:String(x.songtitle??x.songTitle??x.currentSong??x.song??"")};
}
export default function RadioApiModule({stationSlug}:{stationSlug:string}){
  const[rotationStations,setRotationStations]=useState<RadioStation[]>([]);const[playoutStations,setPlayoutStations]=useState<RadioStation[]>([]);
  const[hubStations,setHubStations]=useState<HubStation[]>([]);const[mappings,setMappings]=useState<RadioMappingStore>({});const[status,setStatus]=useState<any>(null);const[now,setNow]=useState<any>(null);const[shout,setShout]=useState<any>(null);const[notice,setNotice]=useState("");const[busy,setBusy]=useState(false);const[loaded,setLoaded]=useState(false);const[lastRefresh,setLastRefresh]=useState("");
  const active=useHubStation(stationSlug);const mapping=mappings[active.slug]||{rotationId:active.rotationId||"",rotationName:active.source==="rotation"?active.name:"",playoutId:"",playoutName:""};

  useEffect(()=>{
    let alive=true;
    const load=async()=>{
      await hydrateSharedIntegrationSettings(active.slug).catch(()=>false);
      const shared=await loadSharedRadioMapping(active.slug).catch(()=>null);
      if(!alive)return;
      const local=readMappings();
      const next=shared?{...local,[active.slug]:{...local[active.slug],...shared}}:local;
      setMappings(next);if(shared)saveMappings(next);
      const refreshCache=()=>{setRotationStations(readStationCache("rotation"));setPlayoutStations(readStationCache("playout"));setHubStations(readHubStations())};
      if(readStationCache("playout").length===0){const sharedPlayout=await loadSharedPlayoutStations().catch(()=>[]);if(sharedPlayout.length)saveStationCache("playout",sharedPlayout)}
      refreshCache();setLoaded(true);
      const pc=readIntegration("playout");let secret=readSecret("playout");if(!secret.apiKey){await hydrateIntegrationSecret("playout").catch(()=>null);secret=readSecret("playout")}
      if(pc?.host&&readStationCache("playout").length===0&&secret.apiKey){void fetchPlayoutStations(true)}
    };
    void load();
    const cacheChanged=()=>{setRotationStations(readStationCache("rotation"));setPlayoutStations(readStationCache("playout"));setHubStations(readHubStations())};
    window.addEventListener(HUB_STATIONS_EVENT,cacheChanged as EventListener);
    return()=>{alive=false;window.removeEventListener(HUB_STATIONS_EVENT,cacheChanged as EventListener)};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[active.slug]);

  function flash(x:string){setNotice(x);setTimeout(()=>setNotice(""),3400)}
  function setMapping(patch:any){const value={...mapping,...patch};const next={...mappings,[active.slug]:value};setMappings(next);saveMappings(next);void saveSharedRadioMapping(active.slug,value).then(()=>flash("Stationmapping centraal opgeslagen")).catch(()=>{})}
  function buildMappings(rs:RadioStation[],ps:RadioStation[]){const next={...readMappings()};for(const rr of rs){const slug=rotationHubSlug(rr);const pp=ps.find(x=>x.id===rr.id)||ps.find(x=>norm(x.name)===norm(rr.name)||norm(x.name).includes(norm(rr.name))||norm(rr.name).includes(norm(x.name)));next[slug]={rotationId:rr.id,rotationName:rr.name,playoutId:next[slug]?.playoutId||pp?.id||"",playoutName:next[slug]?.playoutName||pp?.name||""}}setMappings(next);saveMappings(next)}

  async function fetchPlayoutStations(silent=false){
    await hydrateSharedIntegrationSettings(active.slug).catch(()=>false);
    const pc=readIntegration("playout");
    if(!pc?.host){const message="Playout One is nog niet ingesteld in Beheer → Integraties.";if(!silent)flash(message);throw new Error(message)}
    let secret=readSecret("playout");if(!secret.apiKey){await hydrateIntegrationSecret("playout").catch(()=>null);secret=readSecret("playout")}
    if(!secret.apiKey){const message="Playout One Bearer API-key is nog niet centraal opgeslagen. Open Beheer → Integraties → Playout One, vul de key één keer in en klik Opslaan.";if(!silent)flash(message);throw new Error(message)}
    try{
      const p=await radioRead("playout",pc.stationPath,"stations");
      const ps=p.stations||[];
      setPlayoutStations(ps);saveStationCache("playout",ps);
      await syncSharedPlayoutStations(ps).catch(()=>{});
      const rs=readStationCache("rotation");
      buildMappings(rs,ps);
      const auto=active.slug!=="all"?readMappings()[active.slug]:null;
      if(auto)await saveSharedRadioMapping(active.slug,auto).catch(()=>{});
      setHubStations(readHubStations());
      setLastRefresh(new Date().toLocaleTimeString("nl-BE"));
      if(!silent)flash(`${ps.length} Playout One station(s) vers opgehaald`);
      return ps;
    }catch(e){
      const base=e instanceof Error?e.message:"Playout One stations ophalen mislukt";
      const message=base.includes("401")?"Playout One antwoordt HTTP 401: de Bearer API-key is ongeldig of ontbreekt. Vul de key opnieuw in bij Beheer → Integraties → Playout One.":base;
      if(!silent)flash(message);
      throw new Error(message);
    }
  }
  async function refreshStations(){
    if(busy)return;
    setBusy(true);
    const messages:string[]=[];
    let rs=rotationStations,ps=playoutStations;
    try{
      await hydrateSharedIntegrationSettings(active.slug).catch(()=>false);
      const rc=readIntegration("rotation"),pc=readIntegration("playout");
      if(rc?.host){
        try{
          const r=await radioRead("rotation",rc.stationPath,"stations");
          rs=r.stations||[];setRotationStations(rs);saveStationCache("rotation",rs);
          await syncSharedRotationStations(rs).catch(()=>{});
          messages.push(`Rotation ${rs.length}`);
        }catch(e){messages.push(`Rotation fout: ${e instanceof Error?e.message:"onbekend"}`)}
      }
      if(pc?.host){
        try{ps=await fetchPlayoutStations(true);messages.push(`Playout ${ps.length}`)}
        catch(e){messages.push(`Playout fout: ${e instanceof Error?e.message:"onbekend"}`)}
      }
      buildMappings(rs,ps);setHubStations(readHubStations());
      const auto=active.slug!=="all"?readMappings()[active.slug]:null;
      if(auto)await saveSharedRadioMapping(active.slug,auto).catch(()=>{});
      setLastRefresh(new Date().toLocaleTimeString("nl-BE"));
      flash(messages.length?messages.join(" • "):"Geen radio-integraties ingesteld");
    }finally{setBusy(false)}
  }
  async function test(){setBusy(true);setNow(null);setShout(null);try{await hydrateSharedIntegrationSettings(active.slug).catch(()=>false);const rc=readIntegration("rotation"),pc=readIntegration("playout"),sc=readIntegration("shoutcast");const next:any={checkedAt:new Date().toISOString()};if(rc?.host){try{const r=await radioRead("rotation",rc.statusPath,"raw");next.rotation={online:true,status:r.status,raw:r.raw}}catch(e){next.rotation={online:false,error:e instanceof Error?e.message:String(e)}}}if(pc?.host){try{const p=await radioRead("playout",pc.statusPath,"raw");next.playout={online:true,status:p.status,raw:p.raw}}catch(e){next.playout={online:false,error:e instanceof Error?e.message:String(e)}}}if(pc?.host&&mapping.playoutId&&pc.nowPath){try{const n=await radioRead("playout",pathFor(pc.nowPath,mapping.playoutId),"now");setNow(n)}catch(e){next.playoutNowError=e instanceof Error?e.message:String(e)}}if(sc?.host&&active.slug!=="all"){try{const s=await radioRead("shoutcast",sc.statusPath||"/stats?sid=1&json=1","raw");setShout(shoutSummary(s.raw));next.shoutcast={online:true,status:s.status}}catch(e){next.shoutcast={online:false,error:e instanceof Error?e.message:String(e)}}}setStatus(next);flash("Rotation + Playout + SHOUTcast status vernieuwd")}finally{setBusy(false)}}
  const rc=typeof window!=="undefined"?readIntegration("rotation"):null;const pc=typeof window!=="undefined"?readIntegration("playout"):null;const sc=typeof window!=="undefined"?readIntegration("shoutcast"):null;
  const playoutHint=useMemo(()=>{if(!loaded)return"Stationlijst laden…";if(!pc?.host)return"Playout One nog niet ingesteld in Beheer → Integraties.";if(playoutStations.length===0){return readSecret("playout").apiKey?"API-key aanwezig, maar nog geen Playout stations geladen. Klik ‘Playout stations ophalen’.":"Geen Playout stations geladen. Sla eerst de Bearer API-key centraal op via Beheer → Integraties en klik Stations ophalen."}return `${playoutStations.length} Playout One station(s) beschikbaar.`},[loaded,pc?.host,playoutStations.length]);
  const shoutAddress=sc?.host?`${sc.protocol}://${sc.host}:${sc.port}${sc.basePath||""}${sc.statusPath||""}`:"";
  return <div>
    <div className="page-intro"><div><h2>Radio API Control</h2><p>Eén overzicht voor Rotation One, Playout One én SHOUTcast per VLACORA-station.</p></div><div className="button-row"><button className="ghost" onClick={refreshStations} disabled={busy}>↻ Alle echte stations ophalen</button><button className="primary" onClick={test} disabled={busy}>Test alle live koppelingen</button></div></div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}
    <div className="security-banner"><strong>LIVE API</strong><span>Rotation One bepaalt de stations. Playout One wordt aan dat station gekoppeld. SHOUTcast is een station-specifieke streamkoppeling, dus heeft geen aparte station-dropdown nodig.</span></div>
    <div className="radio-api-grid">
      <div className="card"><h3>Integraties</h3><div className="security-checks"><div><span>Rotation One</span><b className={rc?.host?"ok":"off"}>{rc?.host?"INGESTELD":"NIET INGESTELD"}</b></div><div><span>Playout One</span><b className={pc?.host?"ok":"off"}>{pc?.host?"INGESTELD":"NIET INGESTELD"}</b></div><div><span>SHOUTcast • {active.name}</span><b className={sc?.host?"ok":"off"}>{sc?.host?"INGESTELD":"NIET INGESTELD"}</b></div><div><span>Playout stations</span><b>{playoutStations.length}</b></div></div></div>
      <div className="card radio-mapping-card"><div className="module-title-row"><div><h3>Station mapping</h3><small>{active.name}{lastRefresh?` • vernieuwd ${lastRefresh}`:""}</small></div><button className="mini-btn" disabled={busy} onClick={()=>void refreshStations()}>{busy?"Bezig…":"↻ Vernieuwen"}</button></div>
        {active.slug==="all"?<p className="muted">Kies bovenaan eerst één echt station om de koppelingen te beheren.</p>:<>
          <div className="mapping-service-block"><div className="mapping-service-head"><strong>Rotation One</strong><span className={`mapping-pill ${mapping.rotationId?"ok":"off"}`}>{mapping.rotationId?"GEKOPPELD":"NIET GEKOPPELD"}</span></div><select className="select" value={mapping.rotationId} onChange={e=>{const x=rotationStations.find(s=>s.id===e.target.value);setMapping({rotationId:e.target.value,rotationName:x?.name||""})}}><option value="">Niet gekoppeld</option>{rotationStations.map(s=><option key={s.id} value={s.id}>{s.name} • {s.id}</option>)}</select></div>
          <div className="mapping-service-block"><div className="mapping-service-head"><strong>Playout One</strong><span className={`mapping-pill ${mapping.playoutId?"ok":"off"}`}>{mapping.playoutId?"GEKOPPELD":"NIET GEKOPPELD"}</span></div><select className="select" value={mapping.playoutId} onChange={e=>{const x=playoutStations.find(s=>s.id===e.target.value);setMapping({playoutId:e.target.value,playoutName:x?.name||""})}}><option value="">Niet gekoppeld</option>{playoutStations.map(s=><option key={s.id} value={s.id}>{s.name} • {s.id}</option>)}</select><div className="mapping-help-row"><small>{playoutHint}</small><button className="mini-btn" disabled={busy} onClick={async()=>{if(busy)return;setBusy(true);try{await fetchPlayoutStations(false)}catch{}finally{setBusy(false)}}}>↻ Playout stations ophalen</button></div></div>
          <div className="mapping-service-block"><div className="mapping-service-head"><strong>SHOUTcast</strong><span className={`mapping-pill ${sc?.host?"ok":"off"}`}>{sc?.host?"STREAM INGESTELD":"NIET INGESTELD"}</span></div>{sc?.host?<><code className="mapping-endpoint">{shoutAddress}</code><small>SHOUTcast hoort automatisch bij {active.name}; de SID/URL stel je per station in via Beheer → Integraties.</small></>:<small>Open Beheer → Integraties → SHOUTcast en stel voor dit station host, poort en SID in.</small>}</div>
          <div className="mapping-summary"><span>VLACORA</span><strong>{active.name}</strong><span>Rotation</span><strong>{mapping.rotationName||"—"}</strong><span>Playout</span><strong>{mapping.playoutName||"—"}</strong><span>SHOUTcast</span><strong>{sc?.host?"stream gekoppeld":"—"}</strong></div>
        </>}
      </div>
      <div className="card"><h3>Live status</h3><div className="live-api-cards triple"><div><span>Rotation One</span><strong>{status?.rotation?.online?"ONLINE":status?.rotation?"OFFLINE":"—"}</strong><small>{status?.rotation?.status||status?.rotation?.error||""}</small></div><div><span>Playout One</span><strong>{status?.playout?.online?"ONLINE":status?.playout?"OFFLINE":"—"}</strong><small>{status?.playout?.status||status?.playout?.error||""}</small></div><div><span>SHOUTcast</span><strong>{status?.shoutcast?.online?(shout?.online?"STREAM ONLINE":"API ONLINE"):status?.shoutcast?"OFFLINE":"—"}</strong><small>{status?.shoutcast?.error||((shout&&`${shout.listeners} luisteraar(s)`)||"")}</small></div></div>{now?.now?.title&&<div className="now-api"><span>NOW PLAYING • PLAYOUT ONE</span><strong>{now.now.artist?`${now.now.artist} — `:""}{now.now.title}</strong>{now.next?.title&&<small>Next: {now.next.artist?`${now.next.artist} — `:""}{now.next.title}</small>}</div>}{status?.playoutNowError&&<p className="config-error compact">Playout NOW/NEXT: {status.playoutNowError}</p>}{shout?.title&&<div className="now-api"><span>SHOUTCAST SONG</span><strong>{shout.title}</strong><small>{shout.listeners} listener(s)</small></div>}</div>
      <div className="card"><h3>Hoe de koppeling werkt</h3><div className="capability-list"><span>✓ Rotation One station-ID → VLACORA station</span><span>✓ Playout One station-ID → hetzelfde VLACORA station</span><span>✓ automatische match op gelijk station-ID, bv. hits → hits</span><span>✓ SHOUTcast URL/SID per VLACORA station</span><span>✓ mapping centraal in Supabase bewaard</span><span>✓ live NOW/NEXT pas ophalen wanneer je deze pagina opent</span></div></div>
    </div>
  </div>
}
