"use client";

import { useMemo,useState } from "react";
import { useRouter } from "next/navigation";
import { useCollaboration,type HubNotification } from "@/components/collaboration/collaboration-provider";

function timeLabel(value:string){
  try{return new Date(value).toLocaleString("nl-BE",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}catch{return value}
}
function Severity({item}:{item:HubNotification}){
  return <span className={`notification-severity ${item.severity}`}>{item.severity==="critical"?"KRITIEK":item.severity==="warning"?"BELANGRIJK":"INFO"}</span>;
}
function NotificationCard({item,compact=false}:{item:HubNotification;compact?:boolean}){
  const router=useRouter();
  const c=useCollaboration();
  const unread=!item.seenAt;
  const pendingAck=item.requiresAck&&!item.acknowledgedAt;
  return <div className={`notification-card ${unread?"unread":""} ${pendingAck?"requires-ack":""} ${compact?"compact":""}`}>
    <div className="notification-card-head"><div><Severity item={item}/>{item.requiresAck&&<span className="ack-chip">BEVESTIGING VERPLICHT</span>}</div><span>{timeLabel(item.createdAt)}</span></div>
    <strong>{item.title}</strong>
    {item.body&&<p>{item.body}</p>}
    <div className="notification-meta"><span>{item.category}</span>{item.stationSlug&&<span>• {item.stationSlug}</span>}</div>
    <div className="notification-actions">
      {item.actionPath&&<button className="ghost" onClick={async()=>{await c.markSeen(item.id);router.push(item.actionPath)}}>Open onderdeel</button>}
      {!item.seenAt&&!item.requiresAck&&<button className="ghost" onClick={()=>c.markSeen(item.id)}>Markeer gezien</button>}
      {pendingAck&&<button className="primary" onClick={()=>c.acknowledge(item.id)}>Gezien & bevestigd</button>}
      {item.acknowledgedAt&&<span className="ack-done">✓ bevestigd</span>}
    </div>
  </div>;
}

export function NotificationBell(){
  const c=useCollaboration();
  return <button className={`icon-button notification-bell ${c.requiredCount?"critical":""}`} onClick={c.openNotifications} title="Meldingen">
    🔔
    {c.unreadCount>0&&<span className="ping">{Math.min(c.unreadCount,99)}</span>}
  </button>;
}

export function PresenceButton(){
  const c=useCollaboration();
  const others=c.presence.filter(p=>!p.isMe);
  return <button className="presence-top-button" onClick={c.openPresence} title="Bekijk wie waarmee bezig is">
    <span className="presence-dot-live"/>
    <div className="presence-mini-avatars">
      {c.presence.slice(0,3).map(p=><span key={p.key} className="presence-mini-avatar">{p.initials}</span>)}
    </div>
    <strong>{others.length?`${others.length} collega${others.length===1?"":"’s"} bezig`:"Alleen jij"}</strong>
  </button>;
}

export function NotificationDrawer(){
  const c=useCollaboration();
  const [filter,setFilter]=useState<"all"|"unread"|"required">("unread");
  if(!c.notificationsOpen)return null;
  const list=c.notifications.filter(n=>filter==="unread"?!n.seenAt:filter==="required"?n.requiresAck&&!n.acknowledgedAt:true);
  return <div className="collab-backdrop" onMouseDown={c.closeNotifications}>
    <aside className="collab-drawer" onMouseDown={e=>e.stopPropagation()}>
      <div className="collab-drawer-head"><div><span className="eyebrow">NOTIFICATIECENTRUM</span><h2>Meldingen</h2><p>{c.requiredCount?`${c.requiredCount} melding(en) moeten nog bevestigd worden.`:"Geen verplichte bevestigingen open."}</p></div><button className="mini-btn" onClick={c.closeNotifications}>×</button></div>
      <div className="notification-filter-row">
        <button className={filter==="unread"?"active":""} onClick={()=>setFilter("unread")}>Ongelezen {c.unreadCount}</button>
        <button className={filter==="required"?"active":""} onClick={()=>setFilter("required")}>Moet ik zien {c.requiredCount}</button>
        <button className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>Alles</button>
      </div>
      {c.unreadCount>0&&<button className="ghost wide" onClick={c.markAllSeen}>Alle niet-verplichte meldingen als gezien markeren</button>}
      <div className="notification-list">{list.map(n=><NotificationCard item={n} key={n.id}/>)}{!list.length&&<div className="empty-live-state"><strong>Geen meldingen in deze weergave</strong><span>Nieuwe team- en systeemmeldingen verschijnen hier zonder handmatig refreshen wanneer Supabase actief is.</span></div>}</div>
    </aside>
  </div>;
}

export function PresencePanel(){
  const c=useCollaboration();
  if(!c.presenceOpen)return null;
  return <div className="collab-backdrop" onMouseDown={c.closePresence}>
    <aside className="collab-drawer presence-drawer" onMouseDown={e=>e.stopPropagation()}>
      <div className="collab-drawer-head"><div><span className="eyebrow">LIVE TEAM</span><h2>Wie is waarmee bezig?</h2><p>Presence is tijdelijk: geen database-write bij elke klik.</p></div><button className="mini-btn" onClick={c.closePresence}>×</button></div>
      <div className="presence-list">
        {c.presence.map(p=><div className="presence-row" key={p.key}>
          <div className="avatar presence-avatar">{p.initials}<span/></div>
          <div><strong>{p.name}{p.isMe?" • jij":""}</strong><span>{p.detail}</span><small>{p.stationSlug} • {p.role||"team"}</small></div>
        </div>)}
        {!c.presence.length&&<div className="empty-live-state"><strong>Nog niemand zichtbaar</strong><span>Met Supabase-login actief zie je hier live alle geopende HUB-sessies.</span></div>}
      </div>
    </aside>
  </div>;
}

export function MandatoryNotificationModal(){
  const c=useCollaboration();
  const item=c.mandatoryNotification;
  if(!item)return null;
  return <div className="mandatory-backdrop">
    <div className="mandatory-card">
      <div className="mandatory-icon">!</div>
      <span className="eyebrow">MOET JE ZIEN</span>
      <h2>{item.title}</h2>
      <p>{item.body||"Deze melding moet bevestigd worden voordat ze uit je verplichte meldingen verdwijnt."}</p>
      <div className="mandatory-meta"><Severity item={item}/><span>{item.category}</span><span>{timeLabel(item.createdAt)}</span></div>
      <button className="primary wide mandatory-confirm" onClick={()=>c.acknowledge(item.id)}>Ik heb dit gezien & bevestigd</button>
      <small>Deze melding kan niet worden weggeklikt zonder bevestiging.</small>
    </div>
  </div>;
}

export function NotificationsPage({stationSlug}:{stationSlug:string}){
  const c=useCollaboration();
  const [filter,setFilter]=useState<"all"|"unread"|"required">("all");
  const list=useMemo(()=>c.notifications.filter(n=>filter==="unread"?!n.seenAt:filter==="required"?n.requiresAck&&!n.acknowledgedAt:true),[c.notifications,filter]);
  return <div>
    <div className="page-intro"><div><h2>Meldingen</h2><p>Eén centrale inbox voor officiële communicatie, kritieke incidenten, mentions en belangrijke teamwaarschuwingen.</p><span className={`cloud-state ${c.configured?"online":"local"}`}>{c.configured?"Realtime Teamcloud":"Lokale setupmodus"}</span></div><button className="ghost" onClick={c.markAllSeen}>Alles gezien</button></div>
    <div className="metric-grid notification-metrics">
      <div className="card"><span className="metric-label">Ongelezen</span><strong className="metric">{c.unreadCount}</strong><span className="muted">persoonlijk</span></div>
      <div className="card"><span className="metric-label">Moet ik zien</span><strong className="metric">{c.requiredCount}</strong><span className="muted">bevestiging verplicht</span></div>
      <div className="card"><span className="metric-label">Team actief</span><strong className="metric">{c.presence.length}</strong><span className="muted">live HUB-sessies</span></div>
      <div className="card"><span className="metric-label">Station</span><strong className="metric notification-station-metric">{stationSlug==="all"?"ALL":stationSlug}</strong><span className="muted">huidige filter</span></div>
    </div>
    <div className="notification-filter-row page-filters"><button className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>Alles</button><button className={filter==="unread"?"active":""} onClick={()=>setFilter("unread")}>Ongelezen</button><button className={filter==="required"?"active":""} onClick={()=>setFilter("required")}>Moet ik zien</button></div>
    <div className="card notification-page-card">{list.map(n=><NotificationCard item={n} key={n.id}/>)}{!list.length&&<div className="empty-live-state"><strong>Geen meldingen</strong><span>Officiële berichten, kritieke incidenten en toekomstige live API-alerts komen hier terecht.</span></div>}</div>
  </div>;
}

export function TodayCollaboration({stationName,onOpenNotifications,onOpenPresence}:{stationName:string;onOpenNotifications:()=>void;onOpenPresence:()=>void}){
  const c=useCollaboration();
  const important=c.notifications.filter(n=>!n.seenAt||n.requiresAck&&!n.acknowledgedAt).slice(0,4);
  return <div className="two-col collaboration-today">
    <div className="card">
      <div className="section-head"><div><h3>Moet je zien</h3><p>{stationName} • persoonlijke meldingen</p></div><span className={`badge ${c.requiredCount?"badge-red":"badge-green"}`}>{c.requiredCount} verplicht</span></div>
      <div className="today-notification-list">{important.map(n=><button key={n.id} onClick={onOpenNotifications} className={`today-notification ${n.severity}`}><span>{n.requiresAck&&!n.acknowledgedAt?"!":"•"}</span><div><strong>{n.title}</strong><small>{n.category}</small></div></button>)}
      {!important.length&&<div className="empty-live-state compact"><strong>Niets dat je nu moet zien</strong><span>Nieuwe belangrijke meldingen verschijnen hier automatisch.</span></div>}</div>
      <button className="ghost wide" onClick={onOpenNotifications}>Open alle meldingen →</button>
    </div>
    <div className="card">
      <div className="section-head"><div><h3>Team bezig</h3><p>Live aanwezigheid in PULSE</p></div><button className="ghost" onClick={onOpenPresence}>Alles bekijken</button></div>
      <div className="today-presence-list">{c.presence.slice(0,6).map(p=><div className="today-presence" key={p.key}><div className="avatar presence-avatar">{p.initials}<span/></div><div><strong>{p.name}{p.isMe?" • jij":""}</strong><span>{p.detail}</span><small>{p.stationSlug}</small></div></div>)}
      {!c.presence.length&&<div className="empty-live-state compact"><strong>Nog niemand zichtbaar</strong><span>Presence wordt actief zodra de HUB met login gebruikt wordt.</span></div>}</div>
    </div>
  </div>;
}
