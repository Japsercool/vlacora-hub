"use client";
import { useEffect,useState } from "react";
import { stations } from "@/lib/mock-data";
import { MAPPING_KEY,pathFor,radioRead,readIntegration,readMappings,readStationCache,saveMappings,saveStationCache,type RadioMappingStore,type RadioStation } from "@/lib/radio/client-config";

const norm=(x:string)=>x.toLowerCase().replace(/[^a-z0-9]/g,"");
export default function RadioApiModule({stationSlug}:{stationSlug:string}){
  const[rotationStations,setRotationStations]=useState<RadioStation[]>([]);const[playoutStations,setPlayoutStations]=useState<RadioStation[]>([]);
  const[mappings,setMappings]=useState<RadioMappingStore>({});const[status,setStatus]=useState<any>(null);const[now,setNow]=useState<any>(null);const[notice,setNotice]=useState("");const[busy,setBusy]=useState(false);
  const activeSlug=stationSlug==="all"?"versuz":stationSlug;const active=stations.find(s=>s.slug===activeSlug)||stations[1];
  const mapping=mappings[activeSlug]||{rotationId:"",rotationName:"",playoutId:"",playoutName:""};
  useEffect(()=>{setRotationStations(readStationCache("rotation"));setPlayoutStations(readStationCache("playout"));setMappings(readMappings())},[]);
  function flash(x:string){setNotice(x);setTimeout(()=>setNotice(""),3000)}
  function setMapping(patch:any){const next={...mappings,[activeSlug]:{...mapping,...patch}};setMappings(next);saveMappings(next)}
  function autoMap(rs:RadioStation[],ps:RadioStation[]){const next={...mappings};for(const vl of stations.filter(s=>s.slug!=="all")){const rr=rs.find(x=>norm(x.name)===norm(vl.name)||norm(x.name).includes(norm(vl.name))||norm(vl.name).includes(norm(x.name)));const pp=ps.find(x=>norm(x.name)===norm(vl.name)||norm(x.name).includes(norm(vl.name))||norm(vl.name).includes(norm(x.name)));next[vl.slug]={rotationId:next[vl.slug]?.rotationId||rr?.id||"",rotationName:next[vl.slug]?.rotationName||rr?.name||"",playoutId:next[vl.slug]?.playoutId||pp?.id||"",playoutName:next[vl.slug]?.playoutName||pp?.name||""}}setMappings(next);saveMappings(next)}
  async function refreshStations(){setBusy(true);try{let rs=rotationStations,ps=playoutStations;const rc=readIntegration("rotation"),pc=readIntegration("playout");if(rc?.host){const r=await radioRead("rotation",rc.stationPath,"stations");rs=r.stations||[];setRotationStations(rs);saveStationCache("rotation",rs)}if(pc?.host){const p=await radioRead("playout",pc.stationPath,"stations");ps=p.stations||[];setPlayoutStations(ps);saveStationCache("playout",ps)}autoMap(rs,ps);flash(`${rs.length} Rotation One • ${ps.length} Playout One station(s)`)}catch(e){flash(e instanceof Error?e.message:"Stations ophalen mislukt")}finally{setBusy(false)}}
  async function test(){setBusy(true);
    setNow(null);
    try{
      const rc=readIntegration("rotation");
      const pc=readIntegration("playout");
      const next:any={checkedAt:new Date().toISOString()};
      if(rc?.host){
        try{const r=await radioRead("rotation",rc.statusPath,"raw");next.rotation={online:true,status:r.status,raw:r.raw}}
        catch(e){next.rotation={online:false,error:e instanceof Error?e.message:String(e)}}
      }
      if(pc?.host){
        try{const p=await radioRead("playout",pc.statusPath,"raw");next.playout={online:true,status:p.status,raw:p.raw}}
        catch(e){next.playout={online:false,error:e instanceof Error?e.message:String(e)}}
      }
      if(pc?.host&&mapping.playoutId&&pc.nowPath){
        try{const n=await radioRead("playout",pathFor(pc.nowPath,mapping.playoutId),"now");setNow(n)}catch{}
      }
      setStatus(next);
      flash("Live status vernieuwd");
    }finally{
      setBusy(false);
    }
  }
  const rc=typeof window!=="undefined"?readIntegration("rotation"):null;const pc=typeof window!=="undefined"?readIntegration("playout"):null;
  return <div>
    <div className="page-intro"><div><h2>Radio API Control</h2><p>Geen demo-radio-data meer: dit scherm gebruikt alleen echte Rotation One- en Playout One-antwoorden.</p></div><div className="button-row"><button className="ghost" onClick={refreshStations} disabled={busy}>↻ Echte stations ophalen</button><button className="primary" onClick={test} disabled={busy}>Live status</button></div></div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}
    <div className="security-banner"><strong>LIVE API</strong><span>Rotation One en Playout One worden via de Vercel Node-proxy gelezen. Als een koppeling niet ingesteld is, tonen we geen verzonnen fallback-data.</span></div>
    <div className="radio-api-grid">
      <div className="card"><h3>Integraties</h3><div className="security-checks"><div><span>Rotation One</span><b className={rc?.host?"ok":"off"}>{rc?.host?"INGESTELD":"NIET INGESTELD"}</b></div><div><span>Playout One</span><b className={pc?.host?"ok":"off"}>{pc?.host?"INGESTELD":"NIET INGESTELD"}</b></div><div><span>Rotation stations</span><b>{rotationStations.length}</b></div><div><span>Playout stations</span><b>{playoutStations.length}</b></div></div></div>
      <div className="card radio-mapping-card"><div className="module-title-row"><div><h3>Station mapping</h3><small>{active.name}</small></div></div>
        <label className="field">Rotation One station<select className="select" value={mapping.rotationId} onChange={e=>{const x=rotationStations.find(s=>s.id===e.target.value);setMapping({rotationId:e.target.value,rotationName:x?.name||""})}}><option value="">Niet gekoppeld</option>{rotationStations.map(s=><option key={s.id} value={s.id}>{s.name} • {s.id}</option>)}</select></label>
        <label className="field">Playout One station<select className="select" value={mapping.playoutId} onChange={e=>{const x=playoutStations.find(s=>s.id===e.target.value);setMapping({playoutId:e.target.value,playoutName:x?.name||""})}}><option value="">Niet gekoppeld</option>{playoutStations.map(s=><option key={s.id} value={s.id}>{s.name} • {s.id}</option>)}</select></label>
        <div className="mapping-summary"><span>VLACORA</span><strong>{active.name}</strong><span>Rotation</span><strong>{mapping.rotationName||"—"}</strong><span>Playout</span><strong>{mapping.playoutName||"—"}</strong></div>
      </div>
      <div className="card"><h3>Live status</h3><div className="live-api-cards"><div><span>Rotation One</span><strong>{status?.rotation?.online?"ONLINE":status?.rotation?"OFFLINE":"—"}</strong><small>{status?.rotation?.status||status?.rotation?.error||""}</small></div><div><span>Playout One</span><strong>{status?.playout?.online?"ONLINE":status?.playout?"OFFLINE":"—"}</strong><small>{status?.playout?.status||status?.playout?.error||""}</small></div></div>{now?.now?.title&&<div className="now-api"><span>NOW PLAYING</span><strong>{now.now.artist?`${now.now.artist} — `:""}{now.now.title}</strong>{now.next?.title&&<small>Next: {now.next.artist?`${now.next.artist} — `:""}{now.next.title}</small>}</div>}{pc?.host&&!pc.nowPath&&<p className="muted">Playout One is gekoppeld, maar het Now Playing/snapshot-endpoint is nog niet ingesteld.</p>}</div>
      <div className="card"><h3>Databron</h3><div className="capability-list"><span>✓ echte Rotation One stationlijst</span><span>✓ echte Rotation One schedule</span><span>✓ coverage/revision zodra gekoppeld</span><span>✓ echte Playout status zodra API bereikbaar is</span><span>✓ Now/Next zodra Playout endpoint bevestigd is</span><span>× geen demo now-playing meer</span><span>× geen demo station-ID's meer</span></div></div>
    </div>
  </div>
}
