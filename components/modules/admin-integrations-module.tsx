"use client";

import { useEffect,useMemo,useState } from "react";
import { useRouter } from "next/navigation";
import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import { loadSharedSetting,saveSharedSetting } from "@/lib/supabase/settings";
import { cloneHubStationConfiguration,createHubStation,deleteHubStation,hydrateHubStations,readAllHubStations,saveHubStation,type HubStation } from "@/lib/hub-stations";
import { defaultDatabaseBackendConfig,loadDatabaseBackendConfig,saveDatabaseBackendConfig,type DatabaseBackendConfig } from "@/lib/data-backend";

type StationSettings={timezone:string;active:boolean;newsCheck:boolean;socialReminders:boolean;editorialReminders:boolean};
const stationSeed:StationSettings={timezone:"Europe/Brussels",active:true,newsCheck:true,socialReminders:true,editorialReminders:true};

export default function AdminIntegrationsModule({stationName,stationSlug}:{stationName:string;stationSlug:string}){
  const router=useRouter();
  const[settings,setSettings]=useState<StationSettings>(stationSeed);
  const[stations,setStations]=useState<HubStation[]>([]);
  const[dbConfig,setDbConfig]=useState<DatabaseBackendConfig>(defaultDatabaseBackendConfig);
  const[currentRole,setCurrentRole]=useState("");
  const[newName,setNewName]=useState("");const[newShort,setNewShort]=useState("");
  const[copyFrom,setCopyFrom]=useState("");
  const[copySections,setCopySections]=useState<string[]>(["settings","programming","team","templates","social","contacts"]);
  const[notice,setNotice]=useState("");const[busy,setBusy]=useState(false);const[loaded,setLoaded]=useState(false);
  const supabaseConfigured=useMemo(()=>isSupabaseBrowserConfigured(),[]);
  const canSuperAdmin=currentRole==="superadmin";
  const currentStation=stations.find(x=>x.slug===stationSlug)||null;

  useEffect(()=>{let alive=true;(async()=>{
    if(supabaseConfigured){
      const supabase=createClient();
      const {data:auth}=await supabase.auth.getUser();
      if(auth.user){const {data:p}=await supabase.from("profiles").select("role").eq("id",auth.user.id).maybeSingle();if(alive)setCurrentRole(String(p?.role||"").toLowerCase())}
      await hydrateHubStations();if(alive)setStations(readAllHubStations().filter(x=>x.slug!=="all"));
      if(stationSlug!=="all"){const remote=await loadSharedSetting<StationSettings>(`station:${stationSlug}`,"station-settings");if(alive&&remote)setSettings({...stationSeed,...remote})}
      if(alive)setDbConfig(await loadDatabaseBackendConfig());
    }
    if(alive)setLoaded(true);
  })();return()=>{alive=false}},[stationSlug,supabaseConfigured]);

  function flash(text:string){setNotice(text);window.setTimeout(()=>setNotice(""),3600)}
  async function refreshStations(){await hydrateHubStations();setStations(readAllHubStations().filter(x=>x.slug!=="all"))}
  async function saveStationSettings(){
    if(stationSlug==="all")return;setBusy(true);
    try{if(supabaseConfigured)await saveSharedSetting(`station:${stationSlug}`,"station-settings",settings);flash("Stationinstellingen centraal opgeslagen in PostgreSQL")}catch(e){flash(e instanceof Error?e.message:"Opslaan mislukt")}finally{setBusy(false)}
  }
  async function addStation(){
    if(!canSuperAdmin)return flash("Alleen een superadmin kan zenders toevoegen.");if(!newName.trim())return flash("Geef een zendernaam.");setBusy(true);
    try{const slug=await createHubStation({name:newName,short:newShort});
      if(copyFrom)await cloneHubStationConfiguration(copyFrom,slug,copySections);
      setNewName("");setNewShort("");setCopyFrom("");await refreshStations();flash(copyFrom?"Zender aangemaakt en gekozen configuratie gekopieerd":"Zender aangemaakt in Supabase/PostgreSQL");router.push(`/hub/${slug}/beheer`)}catch(e){flash(e instanceof Error?e.message:"Zender aanmaken mislukt")}finally{setBusy(false)}
  }
  async function patchStation(station:HubStation,patch:Partial<HubStation>){
    if(!canSuperAdmin)return flash("Alleen een superadmin kan zenders wijzigen.");setBusy(true);
    try{const next={...station,...patch};await saveHubStation({slug:next.slug,name:next.name,short:next.short,accent:next.accent,timezone:next.timezone,active:next.active,sortOrder:next.sortOrder});await refreshStations();flash("Zender bijgewerkt")}catch(e){flash(e instanceof Error?e.message:"Wijzigen mislukt")}finally{setBusy(false)}
  }
  async function removeStation(station:HubStation){
    if(!canSuperAdmin)return flash("Alleen een superadmin kan zenders verwijderen.");if(!confirm(`Zender “${station.name}” verwijderen? Bestaande inhoud met deze station-slug wordt niet automatisch gewist.`))return;setBusy(true);
    try{await deleteHubStation(station.slug);await refreshStations();flash("Zender verwijderd")}catch(e){flash(e instanceof Error?e.message:"Verwijderen mislukt")}finally{setBusy(false)}
  }
  async function saveDatabasePlan(){if(!canSuperAdmin)return flash("Alleen een superadmin kan de databaseconfiguratie beheren.");setBusy(true);try{await saveDatabaseBackendConfig(dbConfig);flash("Toekomstige database-doelconfiguratie veilig centraal opgeslagen") }catch(e){flash(e instanceof Error?e.message:"Database-instelling opslaan mislukt")}finally{setBusy(false)}}
  async function copyIntoCurrent(){
    if(!canSuperAdmin)return flash("Alleen een superadmin kan zenderconfiguratie kopiëren.");
    if(stationSlug==="all"||!copyFrom||copyFrom===stationSlug)return flash("Kies een andere bronzender.");
    if(!copySections.length)return flash("Kies minstens één onderdeel om te kopiëren.");
    if(!confirm(`Gekozen onderdelen van ${stations.find(s=>s.slug===copyFrom)?.name||copyFrom} naar ${stationName} kopiëren? Bestaande gegevens kunnen worden aangevuld of overschreven.`))return;
    setBusy(true);try{await cloneHubStationConfiguration(copyFrom,stationSlug,copySections);flash("Zenderconfiguratie gekopieerd. Herlaad de betrokken modules om de nieuwe gegevens te zien.")}catch(e){flash(e instanceof Error?e.message:"Kopiëren mislukt")}finally{setBusy(false)}
  }

  return <div>
    <div className="page-intro"><div><h2>Beheer</h2><p>VLACORA HUB werkt zelfstandig. Teamdata en zenders staan voorlopig centraal in Supabase/PostgreSQL.</p></div>{stationSlug!=="all"&&<button className="primary" disabled={busy||!loaded} onClick={()=>void saveStationSettings()}>Opslaan</button>}</div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}

    {stationSlug==="all"&&<>
      <section className="card"><div className="section-head"><div><h3>Zenders beheren</h3><p>De zenderlijst komt rechtstreeks uit de centrale PostgreSQL-registratie. Browseropslag is alleen nog een tijdelijke cache.</p></div><span className="badge badge-green">CENTRAAL</span></div>
        {!canSuperAdmin&&<div className="usage-note"><strong>Alleen superadmin</strong><span>Je kunt de zenderlijst bekijken, maar alleen een superadmin kan zenders toevoegen, wijzigen of verwijderen.</span></div>}
        {canSuperAdmin&&<div className="station-create-box"><div className="station-create-row"><input className="input" value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Nieuwe zendernaam"/><input className="input" value={newShort} maxLength={4} onChange={e=>setNewShort(e.target.value.toUpperCase())} placeholder="Afk."/><button className="primary" disabled={busy} onClick={()=>void addStation()}>+ Zender toevoegen</button></div>
          <div className="station-copy-row"><label className="field">Start vanaf<select className="select" value={copyFrom} onChange={e=>setCopyFrom(e.target.value)}><option value="">Lege zender</option>{stations.map(s=><option key={s.slug} value={s.slug}>Kopie van {s.name}</option>)}</select></label>{copyFrom&&<div className="station-copy-sections">{[["settings","Instellingen"],["programming","Programmering + programmapagina's"],["team","Team & rechten"],["templates","Redactietemplates"],["social","Social / brand kit"],["contacts","Contacten"]].map(([key,label])=><label key={key}><input type="checkbox" checked={copySections.includes(key)} onChange={e=>setCopySections(v=>e.target.checked?[...new Set([...v,key])]:v.filter(x=>x!==key))}/>{label}</label>)}<button className="ghost" type="button" onClick={()=>setCopySections(["settings","programming","team","templates","social","contacts"])}>Alles kiezen</button></div>}</div>
        </div>}
        <div className="station-admin-list">{stations.map(s=><div className="station-admin-row" key={s.slug}><span className="station-logo" style={{background:s.accent}}>{s.short}</span><div><strong>{s.name}</strong><small>{s.slug} • {s.timezone} • {s.active?"actief":"verborgen"}</small></div><div className="button-row"><button className="ghost" onClick={()=>router.push(`/hub/${s.slug}/beheer`)}>Instellingen</button>{canSuperAdmin&&<button className="ghost" disabled={busy} onClick={()=>void patchStation(s,{active:!s.active})}>{s.active?"Deactiveren":"Activeren"}</button>}{canSuperAdmin&&<button className="mini-btn danger" disabled={busy} onClick={()=>void removeStation(s)}>×</button>}</div></div>)}</div>
      </section>
      <section className="card"><div className="section-head"><div><h3>Database-backend</h3><p>Supabase is nu actief. De HUB bewaart alvast de migratiedoelconfiguratie zodat een toekomstige overstap gecontroleerd kan gebeuren.</p></div><span className="badge badge-blue">SUPABASE / POSTGRESQL</span></div>
        <div className="database-current"><div><span>Login / accounts</span><strong>Supabase Auth blijft vast</strong><small>Ook bij een latere PostgreSQL-datamigratie blijven login, sessies en gebruikers via Supabase Auth lopen.</small></div><div><span>Actieve data-backend</span><strong>Supabase PostgreSQL</strong><small>PostgreSQL + RLS; alleen de data-opslag kan later wisselen.</small></div><div><span>Omschakeling</span><strong>Voorbereid</strong><small>Databasewachtwoorden worden nooit in de browser opgeslagen.</small></div></div>
        <div className="two-form-cols"><label className="field">Toekomstig doel<select className="select" disabled={!canSuperAdmin} value={dbConfig.futureTarget} onChange={e=>setDbConfig({...dbConfig,futureTarget:e.target.value as DatabaseBackendConfig["futureTarget"]})}><option value="none">Nog niet gekozen</option><option value="postgresql">Eigen PostgreSQL</option><option value="self-hosted-supabase">Self-hosted Supabase/PostgreSQL</option></select></label><label className="field">Naam doelomgeving<input className="input" disabled={!canSuperAdmin} value={dbConfig.targetLabel} onChange={e=>setDbConfig({...dbConfig,targetLabel:e.target.value})} placeholder="bv. VLACORA DB Server"/></label><label className="field">Host (zonder wachtwoord)<input className="input" disabled={!canSuperAdmin} value={dbConfig.hostHint} onChange={e=>setDbConfig({...dbConfig,hostHint:e.target.value})} placeholder="db.example.local"/></label><label className="field">Database<input className="input" disabled={!canSuperAdmin} value={dbConfig.databaseHint} onChange={e=>setDbConfig({...dbConfig,databaseHint:e.target.value})} placeholder="vlacora_hub"/></label></div>
        <label className="toggle-row"><input type="checkbox" disabled={!canSuperAdmin} checked={dbConfig.sslRequired} onChange={e=>setDbConfig({...dbConfig,sslRequired:e.target.checked})}/><span><strong>SSL verplicht</strong><small>Aanbevolen zodra de database niet uitsluitend lokaal bereikbaar is.</small></span></label>
        <div className="usage-note"><strong>Veilige omschakeling</strong><span>Een pure PostgreSQL-URL bevat een wachtwoord en hoort server-side in een secret/environment variable. Zodra die toekomstige serververbinding is geplaatst, kan de superadmin via deze beheerlaag migreren, testen en pas daarna activeren. Supabase Auth blijft daarbij bewust de vaste loginlaag; alleen de data-backend kan wisselen.</span></div>
        {canSuperAdmin&&<button className="primary" disabled={busy} onClick={()=>void saveDatabasePlan()}>Databaseplan opslaan</button>}
      </section>
    </>}

    {stationSlug!=="all"&&<>
      <div className="two-col"><section className="card"><div className="section-head"><div><h3>Station</h3><p>Identiteit van de zender in de centrale PostgreSQL-registratie.</p></div>{canSuperAdmin&&currentStation&&<button className="ghost" disabled={busy} onClick={()=>void patchStation(currentStation,{name:currentStation.name,short:currentStation.short,accent:currentStation.accent,timezone:currentStation.timezone})}>Zender opslaan</button>}</div>{currentStation?<><label className="field">Naam<input className="input" disabled={!canSuperAdmin} value={currentStation.name} onChange={e=>setStations(rows=>rows.map(x=>x.slug===stationSlug?{...x,name:e.target.value}:x))}/></label><label className="field">Afkorting<input className="input" maxLength={4} disabled={!canSuperAdmin} value={currentStation.short} onChange={e=>setStations(rows=>rows.map(x=>x.slug===stationSlug?{...x,short:e.target.value.toUpperCase()}:x))}/></label><label className="field">Accentkleur<input className="input" type="color" disabled={!canSuperAdmin} value={currentStation.accent} onChange={e=>setStations(rows=>rows.map(x=>x.slug===stationSlug?{...x,accent:e.target.value}:x))}/></label><label className="field">Tijdzone<input className="input" disabled={!canSuperAdmin} value={currentStation.timezone} onChange={e=>setStations(rows=>rows.map(x=>x.slug===stationSlug?{...x,timezone:e.target.value}:x))}/></label><small className="field-note">De slug <strong>{currentStation.slug}</strong> blijft bewust stabiel, zodat bestaande taken, kalenderitems en communicatie gekoppeld blijven.</small></>:<p className="muted">Station laden…</p>}</section>
      <section className="card"><h3>Werkmeldingen</h3><label className="toggle-row"><input type="checkbox" checked={settings.newsCheck} onChange={e=>setSettings({...settings,newsCheck:e.target.checked})}/><span><strong>Nieuwscontrole</strong><small>Waarschuw voor redactionele nieuwsitems die nog voorbereiding vragen.</small></span></label><label className="toggle-row"><input type="checkbox" checked={settings.editorialReminders} onChange={e=>setSettings({...settings,editorialReminders:e.target.checked})}/><span><strong>Redactiereminders</strong><small>Controleer verplichte talks, acties en open redactiepunten.</small></span></label><label className="toggle-row"><input type="checkbox" checked={settings.socialReminders} onChange={e=>setSettings({...settings,socialReminders:e.target.checked})}/><span><strong>Social reminders</strong><small>Herinner aan geplande socialtaken.</small></span></label></section></div>
      {canSuperAdmin&&<section className="card station-copy-existing"><div className="section-head"><div><h3>Configuratie van een andere zender overnemen</h3><p>Kopieer in enkele klikken alleen wat je nodig hebt, of kies alles. Supabase Auth-accounts zelf worden nooit gedupliceerd.</p></div><span className="badge badge-blue">SUPERADMIN</span></div><div className="station-copy-row"><label className="field">Bronzender<select className="select" value={copyFrom} onChange={e=>setCopyFrom(e.target.value)}><option value="">Kies bron…</option>{stations.filter(s=>s.slug!==stationSlug).map(s=><option value={s.slug} key={s.slug}>{s.name}</option>)}</select></label><div className="station-copy-sections">{[["settings","Instellingen"],["programming","Programmering + programmapagina&apos;s"],["team","Team & rechten"],["templates","Redactietemplates"],["social","Social / brand kit"],["contacts","Contacten"]].map(([key,label])=><label key={key}><input type="checkbox" checked={copySections.includes(key)} onChange={e=>setCopySections(v=>e.target.checked?[...new Set([...v,key])]:v.filter(x=>x!==key))}/><span dangerouslySetInnerHTML={{__html:label}}/></label>)}<button className="ghost" type="button" onClick={()=>setCopySections(["settings","programming","team","templates","social","contacts"])}>Alles kiezen</button><button className="primary" disabled={busy||!copyFrom} onClick={()=>void copyIntoCurrent()}>Kopiëren naar {stationName}</button></div></div></section>}
      <section className="card"><div className="section-head"><div><h3>Zelfstandige HUB</h3><p>Volledig zelfstandig voor redactie, teamwerking en zenderbeheer.</p></div><span className="badge badge-green">STANDALONE</span></div><div className="capability-list">{["Redactie en presentatieteksten","Taken en verantwoordelijkheden","Meldpunt en verplichte meldingen","Interne communicatie en Messenger","Kalender en programmering","Muziekbibliotheek en muziekmeetings","Hitlijsten","Social Studio","Programmapagina’s, afwezigheden en contacten","Verkeersinformatie op aanvraag"].map(x=><span key={x}>✓ {x}</span>)}</div></section>
    </>}
  </div>;
}
