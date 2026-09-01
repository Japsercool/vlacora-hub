"use client";

import { useEffect, useMemo, useState } from "react";
import { stations } from "@/lib/mock-data";
import {
  PermissionKey, PermissionLevel, PermissionMap, permissionLabels,
  permissionLevels, rolePresets
} from "@/lib/permissions";

type TeamUser = {
  id:string;
  name:string;
  email:string;
  initials:string;
  role:string;
  stations:string[];
  active:boolean;
  phone?:string;
  jobTitle?:string;
  permissions:PermissionMap;
  lastSeen:string;
};

const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);

const seedUsers:TeamUser[]=[
  {id:"u1",name:"Jasper Cool",email:"jasper@vlacora.local",initials:"JC",role:"Superadmin",stations:["versuz","club-fm","vlacora-one"],active:true,jobTitle:"Beheer",permissions:rolePresets["Superadmin"],lastSeen:"Nu"},
  {id:"u2",name:"Tibo Vanhee",email:"tibo@vlacora.local",initials:"TV",role:"Muziekredactie",stations:["versuz"],active:true,jobTitle:"Muziekredactie",permissions:rolePresets["Muziekredactie"],lastSeen:"12 min geleden"},
  {id:"u3",name:"Bram",email:"bram@vlacora.local",initials:"BR",role:"Presentator",stations:["versuz"],active:true,jobTitle:"Presentator",permissions:rolePresets["Presentator"],lastSeen:"Gisteren"},
  {id:"u4",name:"Wouter",email:"wouter@vlacora.local",initials:"WD",role:"Presentator",stations:["versuz"],active:true,jobTitle:"Presentator",permissions:rolePresets["Presentator"],lastSeen:"2 dagen geleden"},
  {id:"u5",name:"Sarah",email:"sarah@vlacora.local",initials:"SA",role:"Social & Marketing",stations:["versuz","club-fm"],active:true,jobTitle:"Social & Marketing",permissions:rolePresets["Social & Marketing"],lastSeen:"38 min geleden"}
];

function useStored<T>(key:string,initial:T){
  const[v,s]=useState<T>(initial);const[r,setR]=useState(false);
  useEffect(()=>{try{const x=localStorage.getItem(key);if(x)s(JSON.parse(x))}catch{}setR(true)},[key]);
  useEffect(()=>{if(r)try{localStorage.setItem(key,JSON.stringify(v))}catch{}},[key,r,v]);
  return[v,s]as const;
}
const initials=(name:string)=>name.split(/\s+/).filter(Boolean).map(x=>x[0]).slice(0,2).join("").toUpperCase();

export default function TeamRightsModule({stationSlug}:{stationSlug:string}){
  const[users,setUsers]=useStored<TeamUser[]>("vlacora:team:users:v7",seedUsers);
  const[currentUserId,setCurrentUserId]=useStored<string>("vlacora:demo:current-user:v7","u1");
  const[selectedId,setSelectedId]=useState(seedUsers[0].id);
  const[query,setQuery]=useState("");
  const[roleFilter,setRoleFilter]=useState("Alle");
  const[stationFilter,setStationFilter]=useState(stationSlug==="all"?"Alle":stationSlug);
  const[showAdd,setShowAdd]=useState(false);
  const[notice,setNotice]=useState("");

  const selected=users.find(u=>u.id===selectedId)||users[0];
  const current=users.find(u=>u.id===currentUserId)||users[0];
  const roles=Object.keys(rolePresets);

  useEffect(()=>{if(!users.some(u=>u.id===selectedId)&&users[0])setSelectedId(users[0].id)},[users,selectedId]);

  const filtered=useMemo(()=>users.filter(u=>{
    const q=query.toLowerCase();
    return (!q||`${u.name} ${u.email} ${u.role}`.toLowerCase().includes(q))
      &&(roleFilter==="Alle"||u.role===roleFilter)
      &&(stationFilter==="Alle"||u.stations.includes(stationFilter));
  }),[users,query,roleFilter,stationFilter]);

  function flash(x:string){setNotice(x);setTimeout(()=>setNotice(""),2400)}
  function update(p:Partial<TeamUser>){if(!selected)return;setUsers(users.map(u=>u.id===selected.id?{...u,...p}:u))}
  function setRole(role:string){update({role,permissions:{...(rolePresets[role]||selected.permissions)},jobTitle:role});flash("Rolpreset toegepast")}
  function setPermission(key:PermissionKey,level:PermissionLevel){update({permissions:{...selected.permissions,[key]:level}})}
  function toggleStation(slug:string){update({stations:selected.stations.includes(slug)?selected.stations.filter(s=>s!==slug):[...selected.stations,slug]})}
  function add(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget);const name=String(f.get("name")||"");const role=String(f.get("role")||"Kijker");
    const u:TeamUser={id:uid(),name,email:String(f.get("email")||""),initials:initials(name),role,stations:[String(f.get("station")||"versuz")],active:true,jobTitle:role,permissions:{...(rolePresets[role]||rolePresets["Kijker"])},lastSeen:"Nog nooit"};
    setUsers([...users,u]);setSelectedId(u.id);setShowAdd(false);flash("Gebruiker toegevoegd");
  }

  return <div>
    <div className="page-intro">
      <div><h2>Team & rechten</h2><p>Rollen, stations en rechten per module. Gebruik “Test als gebruiker” om de toegangsstructuur te controleren.</p></div>
      <div className="button-row"><button className="ghost" onClick={()=>setShowAdd(!showAdd)}>+ Gebruiker</button><button className="primary" onClick={()=>flash("Teaminstellingen lokaal opgeslagen")}>Opslaan</button></div>
    </div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}

    <div className="team-security-note">
      <strong>Security</strong>
      <span>Deze demo bewaart rechten nog lokaal voor het testen van de workflow. Voor echte beveiliging worden dezelfde rollen later server-side afgedwongen via Supabase Auth/RBAC. Lokale browserrechten alleen zijn géén security boundary.</span>
    </div>

    {showAdd&&<div className="card team-add-panel">
      <div className="module-title-row"><div><h3>Nieuwe gebruiker</h3><small>Maak meteen een station- en rolprofiel.</small></div><button className="mini-btn" onClick={()=>setShowAdd(false)}>×</button></div>
      <form className="team-add-grid" onSubmit={add}>
        <label className="field">Naam<input className="input" name="name" required/></label>
        <label className="field">E-mail<input className="input" name="email" type="email" required/></label>
        <label className="field">Rol<select className="select" name="role">{roles.map(r=><option key={r}>{r}</option>)}</select></label>
        <label className="field">Primair station<select className="select" name="station">{stations.filter(s=>s.slug!=="all").map(s=><option key={s.slug} value={s.slug}>{s.name}</option>)}</select></label>
        <button className="primary">Gebruiker toevoegen</button>
      </form>
    </div>}

    <div className="team-rights-layout">
      <div className="card team-directory">
        <div className="team-filters">
          <input className="input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Zoek naam, e-mail of rol..."/>
          <select className="select" value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}><option>Alle</option>{roles.map(r=><option key={r}>{r}</option>)}</select>
          <select className="select" value={stationFilter} onChange={e=>setStationFilter(e.target.value)}><option value="Alle">Alle stations</option>{stations.filter(s=>s.slug!=="all").map(s=><option key={s.slug} value={s.slug}>{s.name}</option>)}</select>
        </div>
        <div className="team-directory-head"><span>Gebruiker</span><span>Rol</span><span>Stations</span><span>Status</span></div>
        {filtered.map(u=><button className={`team-directory-row ${selected?.id===u.id?"selected":""}`} key={u.id} onClick={()=>setSelectedId(u.id)}>
          <div className="team-user-cell"><div className="avatar">{u.initials}</div><div><strong>{u.name}</strong><small>{u.email}</small></div></div>
          <span className="role-chip">{u.role}</span>
          <span>{u.stations.map(slug=>stations.find(s=>s.slug===slug)?.short||slug).join(" • ")||"—"}</span>
          <span className={u.active?"positive":"muted"}>{u.active?"● Actief":"○ Uitgeschakeld"}</span>
        </button>)}
      </div>

      {selected&&<div className="team-editor-column">
        <div className="card team-profile-editor">
          <div className="team-profile-top">
            <div className="avatar huge">{selected.initials}</div>
            <div><span className="eyebrow">GEBRUIKER</span><h2>{selected.name}</h2><p>{selected.email}</p></div>
            <label className="switch-line"><input type="checkbox" checked={selected.active} onChange={e=>update({active:e.target.checked})}/><span>{selected.active?"Actief":"Uitgeschakeld"}</span></label>
          </div>
          <div className="two-form-cols">
            <label className="field">Naam<input className="input" value={selected.name} onChange={e=>update({name:e.target.value,initials:initials(e.target.value)})}/></label>
            <label className="field">E-mail<input className="input" value={selected.email} onChange={e=>update({email:e.target.value})}/></label>
            <label className="field">Rol<select className="select" value={selected.role} onChange={e=>setRole(e.target.value)}>{roles.map(r=><option key={r}>{r}</option>)}</select></label>
            <label className="field">Functie<input className="input" value={selected.jobTitle||""} onChange={e=>update({jobTitle:e.target.value})}/></label>
          </div>

          <div className="settings-section">
            <h4>Stations</h4>
            <div className="station-access-chips">{stations.filter(s=>s.slug!=="all").map(s=><button type="button" key={s.slug} onClick={()=>toggleStation(s.slug)} className={selected.stations.includes(s.slug)?"selected":""}><span className="station-dot" style={{background:s.accent}}/><strong>{s.name}</strong></button>)}</div>
          </div>

          <div className="profile-meta-row"><span>Laatste activiteit</span><strong>{selected.lastSeen}</strong></div>
          <div className="button-row">
            <button className="primary" onClick={()=>{setCurrentUserId(selected.id);flash(`Testmodus: ${selected.name}`)}}>Test als deze gebruiker</button>
            {currentUserId===selected.id&&<span className="current-user-label">● huidige testgebruiker</span>}
            {selected.id!=="u1"&&<button className="ghost danger-text" onClick={()=>{setUsers(users.filter(u=>u.id!==selected.id));flash("Gebruiker verwijderd")}}>Verwijderen</button>}
          </div>
        </div>

        <div className="card permission-matrix-card">
          <div className="module-title-row"><div><h3>Rechtenmatrix</h3><small>Geen • Kijken • Bewerken • Publiceren • Beheer</small></div><button className="ghost" onClick={()=>update({permissions:{...(rolePresets[selected.role]||selected.permissions)}})}>Reset naar rol</button></div>
          <div className="permission-matrix">
            {(Object.keys(permissionLabels) as PermissionKey[]).map(key=><div className="permission-row" key={key}>
              <strong>{permissionLabels[key]}</strong>
              <select className={`select permission-${selected.permissions[key]}`} value={selected.permissions[key]} onChange={e=>setPermission(key,e.target.value as PermissionLevel)}>
                {permissionLevels.map(level=><option value={level} key={level}>{level==="none"?"Geen":level==="view"?"Kijken":level==="edit"?"Bewerken":level==="publish"?"Publiceren":"Beheer"}</option>)}
              </select>
            </div>)}
          </div>
        </div>
      </div>}
    </div>
  </div>
}
