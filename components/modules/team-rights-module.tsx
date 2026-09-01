"use client";

import { useCallback,useEffect,useMemo,useState } from "react";
import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import { HUB_STATIONS_EVENT,readHubStations,type HubStation } from "@/lib/radio/hub-stations";
import {
  PermissionKey,PermissionLevel,PermissionMap,permissionLabels,permissionLevels,rolePresets
} from "@/lib/permissions";

type TeamUser={
  id:string;name:string;email:string;initials:string;role:string;stations:string[];active:boolean;
  phone:string;jobTitle:string;permissions:PermissionMap;lastSeen:string;isCurrent:boolean;
};

type ProfileRow={id:string;display_name:string|null;email:string|null;role:string;job_title:string|null;phone:string|null;active:boolean;permissions:any;last_seen_at:string|null};
const initials=(name:string)=>name.split(/\s+/).filter(Boolean).map(x=>x[0]).slice(0,2).join("").toUpperCase()||"V";
const prettyRole=(role:string)=>{
  const x=(role||"kijker").toLowerCase();
  if(x==="superadmin")return "Superadmin";if(x==="stationmanager")return "Stationmanager";if(x==="muziekredactie")return "Muziekredactie";if(x==="redactie")return "Redactie";if(x==="presentator")return "Presentator";if(x==="social & marketing"||x==="social")return "Social & Marketing";if(x==="techniek")return "Techniek";return "Kijker";
};
const dbRole=(role:string)=>role==="Social & Marketing"?"social & marketing":role.toLowerCase();
function permissionsFor(role:string,value:any):PermissionMap{return{...(rolePresets[prettyRole(role)]||rolePresets.Kijker),...(value&&typeof value==="object"?value:{})} as PermissionMap}
function lastSeen(value:string|null,current:boolean){if(current)return "Nu";if(!value)return "Nog nooit";const ms=Date.now()-new Date(value).getTime();if(ms<60000)return "zojuist";if(ms<3600000)return `${Math.floor(ms/60000)} min geleden`;if(ms<86400000)return `${Math.floor(ms/3600000)} u geleden`;return new Date(value).toLocaleDateString("nl-BE")}

export default function TeamRightsModule({stationSlug}:{stationSlug:string}){
  const[users,setUsers]=useState<TeamUser[]>([]);
  const[currentUserId,setCurrentUserId]=useState("");
  const[currentRole,setCurrentRole]=useState("");
  const[stations,setStations]=useState<HubStation[]>([]);
  const[selectedId,setSelectedId]=useState("");
  const[draft,setDraft]=useState<TeamUser|null>(null);
  const[query,setQuery]=useState("");
  const[roleFilter,setRoleFilter]=useState("Alle");
  const[stationFilter,setStationFilter]=useState(stationSlug==="all"?"Alle":stationSlug);
  const[showAdd,setShowAdd]=useState(false);
  const[notice,setNotice]=useState("");
  const[loading,setLoading]=useState(true);
  const configured=isSupabaseBrowserConfigured();
  const roles=Object.keys(rolePresets);
  const canAdmin=currentRole==="superadmin";

  const flash=(x:string)=>{setNotice(x);setTimeout(()=>setNotice(""),3200)};
  const refreshStations=useCallback(()=>setStations(readHubStations().filter(s=>s.slug!=="all")),[]);
  useEffect(()=>{refreshStations();window.addEventListener(HUB_STATIONS_EVENT,refreshStations as EventListener);return()=>window.removeEventListener(HUB_STATIONS_EVENT,refreshStations as EventListener)},[refreshStations]);

  const load=useCallback(async()=>{
    if(!configured){setLoading(false);return}
    const supabase=createClient();
    const{data:auth}=await supabase.auth.getUser();const me=auth.user?.id||"";setCurrentUserId(me);
    const[{data:profiles,error:pError},{data:memberships,error:mError}]=await Promise.all([
      supabase.from("profiles").select("id,display_name,email,role,job_title,phone,active,permissions,last_seen_at").order("display_name"),
      supabase.from("station_memberships").select("user_id,station_slug,active")
    ]);
    if(pError||mError){flash(pError?.message||mError?.message||"Team laden mislukt");setLoading(false);return}
    const membershipsByUser=new Map<string,string[]>();
    (memberships||[]).filter((x:any)=>x.active).forEach((x:any)=>{const a=membershipsByUser.get(String(x.user_id))||[];a.push(String(x.station_slug));membershipsByUser.set(String(x.user_id),a)});
    const rows=(profiles||[]).map((p:ProfileRow)=>({
      id:p.id,name:p.display_name||p.email?.split("@")[0]||"VLACORA gebruiker",email:p.email||"",initials:initials(p.display_name||p.email||"V"),role:prettyRole(p.role),stations:membershipsByUser.get(p.id)||[],active:p.active!==false,
      phone:p.phone||"",jobTitle:p.job_title||prettyRole(p.role),permissions:permissionsFor(p.role,p.permissions),lastSeen:lastSeen(p.last_seen_at,p.id===me),isCurrent:p.id===me
    })) as TeamUser[];
    const my=rows.find(x=>x.id===me);setCurrentRole(dbRole(my?.role||""));setUsers(rows);setSelectedId(current=>current&&rows.some(x=>x.id===current)?current:(rows[0]?.id||""));setLoading(false);
    if(me)void supabase.rpc("vlacora_touch_last_seen");
  },[configured]);
  useEffect(()=>{void load()},[load]);
  useEffect(()=>{const u=users.find(x=>x.id===selectedId);if(u)setDraft(JSON.parse(JSON.stringify(u)))},[selectedId,users]);

  const filtered=useMemo(()=>users.filter(u=>{const q=query.toLowerCase();return(!q||`${u.name} ${u.email} ${u.role}`.toLowerCase().includes(q))&&(roleFilter==="Alle"||u.role===roleFilter)&&(stationFilter==="Alle"||u.stations.includes(stationFilter))}),[users,query,roleFilter,stationFilter]);
  function patch(p:Partial<TeamUser>){if(draft)setDraft({...draft,...p,...(p.name?{initials:initials(p.name)}:{})})}
  function setRole(role:string){if(!draft)return;patch({role,jobTitle:draft.jobTitle||role,permissions:{...(rolePresets[role]||draft.permissions)}})}
  function setPermission(key:PermissionKey,level:PermissionLevel){if(draft)patch({permissions:{...draft.permissions,[key]:level}})}
  function toggleStation(slug:string){if(draft)patch({stations:draft.stations.includes(slug)?draft.stations.filter(s=>s!==slug):[...draft.stations,slug]})}

  async function save(){
    if(!draft||!configured)return;if(!canAdmin)return flash("Alleen een superadmin kan teamrechten wijzigen.");
    const supabase=createClient();
    const{error}=await supabase.rpc("vlacora_update_team_member",{target_user_id:draft.id,p_display_name:draft.name,p_role:dbRole(draft.role),p_job_title:draft.jobTitle,p_active:draft.active,p_permissions:draft.permissions});
    if(error)return flash(error.message);
    const memberships=draft.stations.map(slug=>({stationSlug:slug,role:dbRole(draft.role),permissions:draft.permissions,active:true}));
    const{error:mError}=await supabase.rpc("vlacora_replace_station_memberships",{target_user_id:draft.id,p_memberships:memberships});if(mError)return flash(mError.message);
    flash("Gebruiker en stationrechten centraal opgeslagen");await load();
  }

  async function invite(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();if(!canAdmin)return flash("Alleen een superadmin kan gebruikers uitnodigen.");
    const f=new FormData(e.currentTarget);const role=String(f.get("role")||"Kijker");const station=String(f.get("station")||"");
    const{data,error}=await createClient().functions.invoke("vlacora-admin-users",{body:{action:"invite",email:String(f.get("email")||""),displayName:String(f.get("name")||""),role:dbRole(role),jobTitle:String(f.get("jobTitle")||role),stationSlugs:station?[station]:[],redirectTo:`${location.origin}/auth/callback?next=/reset-password`}});
    if(error||data?.error)return flash(data?.error||error?.message||"Uitnodigen mislukt");setShowAdd(false);flash("Uitnodiging verstuurd en VLACORA-profiel aangemaakt");setTimeout(()=>void load(),800);
  }
  async function sendRecovery(){if(!draft||!canAdmin)return;const{data,error}=await createClient().functions.invoke("vlacora-admin-users",{body:{action:"send_recovery",email:draft.email,redirectTo:`${location.origin}/auth/callback?next=/reset-password`}});if(error||data?.error)return flash(data?.error||error?.message||"Resetmail mislukt");flash("Wachtwoordlink verstuurd")}
  async function remove(){if(!draft||draft.isCurrent||!canAdmin)return;if(!confirm(`Account van ${draft.name} definitief verwijderen?`))return;const{data,error}=await createClient().functions.invoke("vlacora-admin-users",{body:{action:"delete",userId:draft.id}});if(error||data?.error)return flash(data?.error||error?.message||"Verwijderen mislukt");flash("Account verwijderd");setSelectedId("");await load()}

  return <div>
    <div className="page-intro"><div><h2>Team & rechten</h2><p>Dit zijn nu de echte Supabase Auth-gebruikers. Rollen en stationrechten worden server-side bewaard.</p></div><div className="button-row">{canAdmin&&<button className="ghost" onClick={()=>setShowAdd(!showAdd)}>+ Gebruiker uitnodigen</button>}<button className="primary" disabled={!draft||!canAdmin} onClick={()=>void save()}>Opslaan</button></div></div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}
    <div className={`team-security-note ${configured?"secure":""}`}><strong>{configured?"✓ Echte beveiliging actief":"Security"}</strong><span>{configured?"Accounts komen uit Supabase Auth. Rollen, stationlidmaatschappen en rechten staan centraal in Postgres/RLS; de oude lokale demo-gebruikers worden niet meer gebruikt.":"Supabase is niet actief."}</span></div>

    {showAdd&&<div className="card team-add-panel"><div className="module-title-row"><div><h3>Nieuwe gebruiker uitnodigen</h3><small>Supabase verstuurt de e-mail; de gebruiker kiest zelf een wachtwoord.</small></div><button className="mini-btn" onClick={()=>setShowAdd(false)}>×</button></div><form className="team-add-grid" onSubmit={invite}><label className="field">Naam<input className="input" name="name" required/></label><label className="field">E-mail<input className="input" name="email" type="email" required/></label><label className="field">Rol<select className="select" name="role">{roles.map(r=><option key={r}>{r}</option>)}</select></label><label className="field">Functie<input className="input" name="jobTitle" placeholder="bv. Presentator"/></label><label className="field">Primair station<select className="select" name="station"><option value="">Geen specifiek station</option>{stations.map(s=><option key={s.slug} value={s.slug}>{s.name}</option>)}</select></label><button className="primary">Uitnodiging versturen</button></form></div>}

    <div className="team-rights-layout">
      <div className="card team-directory"><div className="team-filters"><input className="input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Zoek naam, e-mail of rol..."/><select className="select" value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}><option>Alle</option>{roles.map(r=><option key={r}>{r}</option>)}</select><select className="select" value={stationFilter} onChange={e=>setStationFilter(e.target.value)}><option value="Alle">Alle stations</option>{stations.map(s=><option key={s.slug} value={s.slug}>{s.name}</option>)}</select></div><div className="team-directory-head"><span>Gebruiker</span><span>Rol</span><span>Stations</span><span>Status</span></div>{loading?<p className="muted">Echte teamaccounts laden…</p>:filtered.length===0?<div className="empty-live-state compact"><strong>Geen gebruikers gevonden</strong><span>Gebruik “Gebruiker uitnodigen” om een echt account toe te voegen.</span></div>:filtered.map(u=><button className={`team-directory-row ${draft?.id===u.id?"selected":""}`} key={u.id} onClick={()=>setSelectedId(u.id)}><div className="team-user-cell"><div className="avatar">{u.initials}</div><div><strong>{u.name}{u.isCurrent?" • jij":""}</strong><small>{u.email}</small></div></div><span className="role-chip">{u.role}</span><span>{u.stations.map(slug=>stations.find(s=>s.slug===slug)?.short||slug).join(" • ")||"Alleen algemeen"}</span><span className={u.active?"positive":"muted"}>{u.active?"● Actief":"○ Uitgeschakeld"}</span></button>)}</div>

      {draft&&<div className="team-editor-column"><div className="card team-profile-editor"><div className="team-profile-top"><div className="avatar huge">{draft.initials}</div><div><span className="eyebrow">SUPABASE ACCOUNT</span><h2>{draft.name}</h2><p>{draft.email}</p></div><label className="switch-line"><input type="checkbox" disabled={!canAdmin} checked={draft.active} onChange={e=>patch({active:e.target.checked})}/><span>{draft.active?"Actief":"Uitgeschakeld"}</span></label></div><div className="two-form-cols"><label className="field">Naam<input className="input" disabled={!canAdmin} value={draft.name} onChange={e=>patch({name:e.target.value})}/></label><label className="field">E-mail<input className="input" value={draft.email} disabled/><small className="field-note">E-mail is de Supabase Auth-identiteit en wijzig je niet via een lokaal veld.</small></label><label className="field">Rol<select className="select" disabled={!canAdmin} value={draft.role} onChange={e=>setRole(e.target.value)}>{roles.map(r=><option key={r}>{r}</option>)}</select></label><label className="field">Functie<input className="input" disabled={!canAdmin} value={draft.jobTitle} onChange={e=>patch({jobTitle:e.target.value})}/></label></div><div className="settings-section"><h4>Stations</h4><div className="station-access-chips">{stations.map(s=><button type="button" disabled={!canAdmin} key={s.slug} onClick={()=>toggleStation(s.slug)} className={draft.stations.includes(s.slug)?"selected":""}><span className="station-dot" style={{background:s.accent}}/><strong>{s.name}</strong></button>)}</div></div><div className="profile-meta-row"><span>Laatste activiteit</span><strong>{draft.lastSeen}</strong></div><div className="button-row">{canAdmin&&<button className="primary" onClick={()=>void save()}>Wijzigingen opslaan</button>}{canAdmin&&<button className="ghost" onClick={()=>void sendRecovery()}>Stuur wachtwoordlink</button>}{canAdmin&&!draft.isCurrent&&<button className="ghost danger-text" onClick={()=>void remove()}>Account verwijderen</button>}</div></div>

        <div className="card permission-matrix-card"><div className="module-title-row"><div><h3>Rechtenmatrix</h3><small>Geen • Kijken • Bewerken • Publiceren • Beheer</small></div>{canAdmin&&<button className="ghost" onClick={()=>patch({permissions:{...(rolePresets[draft.role]||draft.permissions)}})}>Reset naar rol</button>}</div><div className="permission-matrix">{(Object.keys(permissionLabels) as PermissionKey[]).map(key=><div className="permission-row" key={key}><strong>{permissionLabels[key]}</strong><select className={`select permission-${draft.permissions[key]}`} disabled={!canAdmin} value={draft.permissions[key]} onChange={e=>setPermission(key,e.target.value as PermissionLevel)}>{permissionLevels.map(level=><option value={level} key={level}>{level==="none"?"Geen":level==="view"?"Kijken":level==="edit"?"Bewerken":level==="publish"?"Publiceren":"Beheer"}</option>)}</select></div>)}</div></div>
      </div>}
    </div>
  </div>
}
