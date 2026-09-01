"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { chart, initialPlaylist, navItems, shows, stations } from "@/lib/mock-data";
import MessengerModule from "@/components/modules/messenger-module";
import PresentationModule from "@/components/modules/presentation-module";
import SocialStudioModule from "@/components/modules/social-studio-module";
import MusicLibraryModule from "@/components/modules/music-library-module";
import EditorialModule from "@/components/modules/editorial-module";
import RadioApiModule from "@/components/modules/radio-api-module";
import TeamRightsModule from "@/components/modules/team-rights-module";
import AdminIntegrationsModule from "@/components/modules/admin-integrations-module";
import MusicFoldersModule from "@/components/modules/music-folders-module";

type Props = { stationSlug: string; moduleSlug: string };
type Tone = "blue" | "red" | "green" | "orange" | "gray";
type Task = { id: string; title: string; owner: string; due: string; status: string; priority: string };
type Message = { id: string; who: string; text: string; time: string };
type Incident = { id: string; category: string; title: string; severity: string; status: string; created: string };
type Announcement = { id: string; title: string; body: string; category: string; importance: string; read: boolean };
type CalendarEvent = { id: string; title: string; type: string; day: number; row: number; time: string };
type TeamMember = { id: string; name: string; role: string; initials: string; scope: string };
type CustomTrack = { id: string; artist: string; title: string; genre: string; release: string };
type ModalType = "task" | "incident" | "announcement" | "event" | "playlist" | "track" | "team" | null;

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function Badge({ children, tone = "blue" }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

function useLocalState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value, loaded]);

  return [value, setValue];
}

function Modal({
  title, children, onClose
}: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>{title}</h2><button className="mini-btn" onClick={onClose}>×</button></div>
        {children}
      </div>
    </div>
  );
}

export default function HubApp({ stationSlug, moduleSlug }: Props) {
  const router = useRouter();
  const station = stations.find((s) => s.slug === stationSlug) || stations[0];
  const storagePrefix = `vlacora:${station.slug}`;

  const [tasks, setTasks] = useLocalState<Task[]>(`${storagePrefix}:tasks`, [
    { id: "t1", title: "Playlist woensdag controleren", owner: "Jasper", due: "Vandaag 17:30", status: "Bezig", priority: "Hoog" },
    { id: "t2", title: "Nieuwe muziek voorbereiden", owner: "Muziekredactie", due: "Morgen 09:30", status: "Te doen", priority: "Normaal" },
    { id: "t3", title: "Tune of the Week visual", owner: "Social", due: "Morgen 12:00", status: "Controle", priority: "Normaal" }
  ]);
  const [messages, setMessages] = useLocalState<Message[]>(`${storagePrefix}:messages`, [
    { id: "m1", who: "Tibo", text: "Nieuwe tracks voor de meeting staan klaar.", time: "16:20" },
    { id: "m2", who: "Jasper", text: "Top, ik luister ze straks nog even na.", time: "16:24" },
    { id: "m3", who: "Muziekredactie", text: "ANOTR staat voorlopig op 8,2/10.", time: "16:27" }
  ]);
  const [incidents, setIncidents] = useLocalState<Incident[]>(`${storagePrefix}:incidents`, [
    { id: "i1", category: "Technisch", title: "Back-up stream niet bevestigd", severity: "Hoog", status: "Open", created: "12 min geleden" },
    { id: "i2", category: "Muziek", title: "Song dubbel in uur 18:00", severity: "Normaal", status: "Open", created: "26 min geleden" }
  ]);
  const [announcements, setAnnouncements] = useLocalState<Announcement[]>(`${storagePrefix}:announcements`, [
    { id: "a1", title: "Nieuwe muziek vanaf maandag", body: "Vanaf maandag gaan Joel Corry – Whisper en ANOTR – Talk To You naar de A-rotatie. Bebe Rexha schuift door naar B.", category: "Muziekredactie", importance: "Belangrijk", read: false },
    { id: "a2", title: "Aangepast weekendschema", body: "Vanaf dit weekend start The Partyroom om 18:00. Het nieuwe schema staat in VLACORA Kalender.", category: "Programmering", importance: "Normaal", read: true }
  ]);
  const [events, setEvents] = useLocalState<CalendarEvent[]>(`${storagePrefix}:events`, [
    { id: "e1", title: "Muziekmeeting", type: "purple", day: 2, row: 2, time: "10:00 – 11:30" },
    { id: "e2", title: "Drive", type: "red", day: 1, row: 5, time: "16:00 – 18:00" },
    { id: "e3", title: "Top 50 deadline", type: "green", day: 5, row: 4, time: "14:00" },
    { id: "e4", title: "Studio onderhoud", type: "orange", day: 3, row: 3, time: "12:00" }
  ]);
  const [playlist, setPlaylist] = useLocalState<string[]>(`${storagePrefix}:playlist`, initialPlaylist);
  const [votes, setVotes] = useLocalState<Record<string, number>>(`${storagePrefix}:votes`, {});
  const [presenterText, setPresenterText] = useLocalState(`${storagePrefix}:presenterText`, "Joel Corry is deze week onze Tune of the Week. Dit is Whisper.");
  const [socialArtist, setSocialArtist] = useLocalState(`${storagePrefix}:socialArtist`, "Joel Corry");
  const [socialTitle, setSocialTitle] = useLocalState(`${storagePrefix}:socialTitle`, "Whisper");
  const [customTracks, setCustomTracks] = useLocalState<CustomTrack[]>(`${storagePrefix}:tracks`, []);
  const [team, setTeam] = useLocalState<TeamMember[]>(`${storagePrefix}:team`, [
    { id: "u1", name: "Jasper Cool", role: "Superadmin", initials: "JC", scope: "Versuz • Club FM • Vlacora One" },
    { id: "u2", name: "Tibo Vanhee", role: "Muziekredactie", initials: "TV", scope: "Versuz" },
    { id: "u3", name: "Bram", role: "Presentator", initials: "BR", scope: "Versuz" },
    { id: "u4", name: "Wouter", role: "Presentator", initials: "WD", scope: "Versuz" },
    { id: "u5", name: "Sarah", role: "Social & Marketing", initials: "SA", scope: "Versuz • Club FM" }
  ]);
  const [stationSettings, setStationSettings] = useLocalState(`${storagePrefix}:settings`, {
    name: station.name, timezone: "Europe/Brussels", active: true, playlistWarnings: true, newsCheck: true, socialReminders: true
  });

  const [taskDraft, setTaskDraft] = useState("");
  const [msgDraft, setMsgDraft] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("muziekredactie");
  const [modal, setModal] = useState<ModalType>(null);
  const [incidentCategory, setIncidentCategory] = useState("Technisch");
  const [toast, setToast] = useState("");
  const [historyVisible, setHistoryVisible] = useState(false);
  const [chartPublished, setChartPublished] = useLocalState(`${storagePrefix}:chartPublished`, false);
  const [meetingStarted, setMeetingStarted] = useLocalState(`${storagePrefix}:meetingStarted`, false);
  const [meetingIndex, setMeetingIndex] = useLocalState(`${storagePrefix}:meetingIndex`, 7);
  const [meetingDecision, setMeetingDecision] = useLocalState(`${storagePrefix}:meetingDecision`, "");
  const [lastRefresh, setLastRefresh] = useState("zojuist");

  const moduleName = useMemo(() => navItems.find((n) => n[0] === moduleSlug)?.[2] || "Dashboard", [moduleSlug]);
  const allTracks = [
    { id: "base1", artist: "ANOTR & 54 Ultra", title: "Talk To You", genre: "Dance", release: "05/09/2026" },
    { id: "base2", artist: "Bebe Rexha", title: "New Religion", genre: "Pop / Dance", release: "04/09/2026" },
    { id: "base3", artist: "Joel Corry", title: "Whisper", genre: "Dance", release: "28/08/2026" },
    { id: "base4", artist: "Topic & Becky G", title: "Sorry Papi", genre: "Dance Pop", release: "28/08/2026" },
    ...customTracks
  ];

  function notify(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(""), 2600);
  }
  function addTaskQuick() {
    if (!taskDraft.trim()) return;
    setTasks([{ id: uid(), title: taskDraft.trim(), owner: "Jasper", due: "Geen deadline", status: "Te doen", priority: "Normaal" }, ...tasks]);
    setTaskDraft("");
    notify("Taak toegevoegd");
  }
  function movePlaylist(index: number, direction: -1 | 1) {
    const next = [...playlist];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setPlaylist(next);
    notify("Playlistvolgorde aangepast");
  }
  function sendMessage() {
    if (!msgDraft.trim()) return;
    setMessages([...messages, { id: uid(), who: "Jasper", text: msgDraft.trim(), time: "nu" }]);
    setMsgDraft("");
  }
  function editPlaylistItem(index: number) {
    const changed = window.prompt("Pas dit playlistitem aan:", playlist[index]);
    if (!changed?.trim()) return;
    const next = [...playlist]; next[index] = changed.trim(); setPlaylist(next); notify("Playlistitem aangepast");
  }
  function downloadSocialPng() {
    const canvas = document.createElement("canvas");
    canvas.width = 1080; canvas.height = 1350;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const g = ctx.createLinearGradient(0, 0, 1080, 1350);
    g.addColorStop(0, "#24239e"); g.addColorStop(1, "#5b38ff");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1350);
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 64px Arial"; ctx.fillText("VLACORA radio", 80, 120);
    ctx.fillStyle = "#7549ff"; ctx.fillRect(80, 230, 620, 110);
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 48px Arial"; ctx.fillText("TUNE OF THE WEEK", 120, 302);
    ctx.font = "bold 78px Arial"; ctx.fillText(socialArtist, 80, 850);
    ctx.font = "56px Arial"; ctx.fillText(socialTitle, 80, 940);
    ctx.font = "bold 32px Arial"; ctx.fillText("THIS WEEK • ON AIR", 80, 1240);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `vlacora-${socialArtist}-${socialTitle}.png`.replace(/\s+/g, "-").toLowerCase();
    a.click();
    notify("PNG gemaakt");
  }

  return (
    <div className="hub-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">V</div><div><div className="brand-name">VLACORA</div><div className="brand-sub">HUB</div></div></div>
        <div className="station-mini"><span className="station-dot" style={{ background: station.accent }} /><div><strong>{station.name}</strong><small>Multi-station workspace</small></div></div>
        <nav className="nav">
          {navItems.map(([slug, icon, label]) => (
            <Link key={slug} href={`/hub/${station.slug}/${slug}`} className={moduleSlug === slug ? "nav-item active" : "nav-item"}>
              <span className="nav-icon">{icon}</span><span>{label}</span>
              {slug === "meldpunt" && incidents.filter(i=>i.status==="Open").length > 0 && <span className="nav-count">{incidents.filter(i=>i.status==="Open").length}</span>}
              {slug === "messenger" && <span className="nav-count">{Math.min(messages.length,9)}</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-user"><div className="avatar">JC</div><div><strong>Jasper</strong><small>Superadmin</small></div></div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><div className="eyebrow">VLACORA / {station.name}</div><h1>{moduleName}</h1></div>
          <div className="top-actions">
            <select className="select" value={station.slug} onChange={(e) => router.push(`/hub/${e.target.value}/${moduleSlug}`)}>
              {stations.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
            </select>
            <button className="icon-button" onClick={()=>notify("3 demo-notificaties: playlist, meeting en stream")}>🔔<span className="ping">3</span></button>
            <div className="live-pill"><span /> LIVE</div>
          </div>
        </header>

        <div className="content">
          {moduleSlug === "dashboard" && <>
            <section className="hero">
              <div><div className="hero-kicker">DINSDAG 1 SEPTEMBER 2026</div><h2>Goedemorgen, Jasper.</h2><p>Dit vraagt vandaag aandacht binnen {station.name}.</p></div>
              <div className="hero-now"><span className="tiny">NU ON AIR</span><strong>HUGEL – Movin&apos; To The Sun</strong><span>184 luisteraars • Playout online</span></div>
            </section>
            <div className="metric-grid">
              <Card><span className="metric-label">Luisteraars nu</span><strong className="metric">184</strong><span className="positive">+12% vs. gisteren</span></Card>
              <Card><span className="metric-label">Playlistdekking</span><strong className="metric">8 sep</strong><span className="muted">7 dagen vooruit</span></Card>
              <Card><span className="metric-label">Open taken</span><strong className="metric">{tasks.filter(t=>t.status!=="Klaar").length}</strong><span className="warning">live uit demo-data</span></Card>
              <Card><span className="metric-label">Nieuwe muziek</span><strong className="metric">{allTracks.length}</strong><span className="muted">te beoordelen</span></Card>
            </div>
            <div className="two-col">
              <Card><div className="section-head"><div><h3>Vandaag</h3><p>Automatisch samengesteld</p></div><Badge tone="red">{incidents.filter(i=>i.status==="Open" && i.severity==="Hoog").length} kritisch</Badge></div>
                <div className="attention-list">
                  {incidents.filter(i=>i.status==="Open").slice(0,2).map(i=><div className={`attention ${i.severity==="Hoog"?"red":"orange"}`} key={i.id}><span>!</span><div><strong>{i.title}</strong><small>{i.category} • {i.created}</small></div></div>)}
                  <div className="attention blue"><span>♫</span><div><strong>{allTracks.length} tracks in muziekinbox</strong><small>Muziekmeeting morgen 10:00</small></div></div>
                </div>
              </Card>
              <Card><div className="section-head"><div><h3>Systeemstatus</h3><p>Demo realtime overzicht</p></div><Badge tone="green">Gezond</Badge></div>
                <div className="status-grid">{["Rotation One","Playout One","SHOUTcast","Nieuws","Reclame","VLACORA Agent"].map((x,i)=><button className="status-row status-button" key={x} onClick={()=>notify(`${x}: demo-status geopend`)}><span className={`status-light ${i===4?"orange-light":""}`}/><strong>{x}</strong><span>{i===4?"Controle":"Online"}</span></button>)}</div>
              </Card>
            </div>
            <Card><div className="section-head"><div><h3>Uitzendschema</h3><p>Vandaag • {station.name}</p></div><button className="ghost" onClick={()=>router.push(`/hub/${station.slug}/programmering`)}>Volledig schema →</button></div>
              <div className="show-row">{shows.slice(2).map(show=><div className={`show-card ${show.live?"on-air":""}`} key={show.time}><span className="show-time">{show.time}</span><div className="show-avatar">{show.host.split(" ").map(x=>x[0]).slice(0,2).join("")}</div><div><strong>{show.name}</strong><small>{show.host}</small></div>{show.live&&<Badge tone="red">ON AIR</Badge>}</div>)}</div>
            </Card>
          </>}

          {moduleSlug === "stations" && <div className="station-grid">{stations.filter(s=>s.slug!=="all").map((s,idx)=><Card key={s.slug} className="station-card"><div className="station-card-head"><div className="station-logo" style={{background:s.accent}}>{s.short}</div><div><h3>{s.name}</h3><span className="positive">● ONLINE</span></div></div><div className="station-stat"><span>Now playing</span><strong>{idx===0?"HUGEL – Movin' To The Sun":idx===1?"Calvin Harris – Satisfy":"Joel Corry – Whisper"}</strong></div><div className="station-kpis"><span><b>{184-idx*47}</b> luisteraars</span><span><b>{idx===2?"6 sep":"8 sep"}</b> playlists</span></div><Link className="primary wide" href={`/hub/${s.slug}/dashboard`}>Open station</Link></Card>)}</div>}

          {moduleSlug === "taken" && <>
            <div className="toolbar"><input className="input grow" placeholder="Nieuwe taak..." value={taskDraft} onChange={e=>setTaskDraft(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTaskQuick()}/><button className="primary" onClick={addTaskQuick}>+ Snel toevoegen</button><button className="ghost" onClick={()=>setModal("task")}>Uitgebreid</button></div>
            <div className="kanban">{["Te doen","Bezig","Controle","Klaar"].map(column=><div className="kanban-col" key={column}><div className="kanban-head"><strong>{column}</strong><span>{tasks.filter(t=>t.status===column).length}</span></div>
              {tasks.filter(t=>t.status===column).map(task=><Card key={task.id} className={`task-card ${column==="Klaar"?"done":""}`}><Badge tone={task.priority==="Hoog"?"red":"gray"}>{task.priority}</Badge><h3>{task.title}</h3><p>{task.owner}</p><small>⏱ {task.due}</small><div className="task-actions"><select className="select compact-select" value={task.status} onChange={e=>setTasks(tasks.map(t=>t.id===task.id?{...t,status:e.target.value}:t))}>{["Te doen","Bezig","Controle","Klaar"].map(s=><option key={s}>{s}</option>)}</select><button className="mini-btn danger" onClick={()=>setTasks(tasks.filter(t=>t.id!==task.id))}>×</button></div></Card>)}
            </div>)}</div>
          </>}

          {moduleSlug === "meldpunt" && <>
            <div className="page-intro"><div><h2>Waar gaat je melding over?</h2><p>Klik een categorie om meteen een echte demo-melding te registreren.</p></div><button className="primary" onClick={()=>{setIncidentCategory("Technisch");setModal("incident")}}>+ Nieuwe melding</button></div>
            <div className="report-grid">{["Programmering","Muziek","Technisch","Vormgeving","Facilities","Afwezigheid","Website / socials","Nieuws","Reclame","Rotation One","Tip redactie","Ander"].map((x,i)=><button className="report-card" key={x} onClick={()=>{setIncidentCategory(x);setModal("incident")}}><span>{["◫","♫","⚙","✦","⌂","♙","◎","▣","▤","⌁","☆","?"][i]}</span><strong>{x}</strong></button>)}</div>
            <div className="two-col"><Card><h3>Open meldingen</h3>{incidents.filter(i=>i.status==="Open").map(i=><div className="incident" key={i.id}><Badge tone={i.severity==="Hoog"?"red":"orange"}>{i.severity}</Badge><strong>{i.title}</strong><span>{i.category}</span><button className="ghost" onClick={()=>setIncidents(incidents.map(x=>x.id===i.id?{...x,status:"Opgelost"}:x))}>Oplossen</button></div>)}{!incidents.some(i=>i.status==="Open")&&<p className="positive">Geen open meldingen.</p>}</Card>
              <Card><h3>Afgehandeld</h3>{incidents.filter(i=>i.status!=="Open").map(i=><div className="incident" key={i.id}><Badge tone="green">Opgelost</Badge><strong>{i.title}</strong><button className="ghost" onClick={()=>setIncidents(incidents.map(x=>x.id===i.id?{...x,status:"Open"}:x))}>Heropen</button></div>)}</Card></div>
          </>}

          {moduleSlug === "messenger" && <MessengerModule stationSlug={station.slug} />}

          {moduleSlug === "communicatie" && <>
            <div className="page-intro"><div><h2>Officiële communicatie</h2><p>Publiceer berichten en deel ook vaste interne documenten met het zenderteam.</p></div><div className="button-row"><button className="ghost" onClick={()=>router.push(`/hub/${station.slug}/muziekmappen`)}>Muziekmappen PDF</button><button className="primary" onClick={()=>setModal("announcement")}>+ Bericht publiceren</button></div></div>
            <Card className="internal-doc-banner"><div><Badge tone="blue">INTERN DOCUMENT</Badge><h3>Muziekmappen / rotation overzicht</h3><p>Maak een gebrande PDF met per map alle songs en deel die als officiële interne communicatie.</p></div><button className="primary" onClick={()=>router.push(`/hub/${station.slug}/muziekmappen`)}>Open PDF-maker →</button></Card>
            {announcements.map(a=><Card className={`announcement ${a.importance==="Belangrijk"?"important":""}`} key={a.id}><div className="announcement-head"><div><Badge tone={a.importance==="Belangrijk"?"red":"blue"}>{a.importance.toUpperCase()}</Badge><span>{a.category}</span></div><span>VLACORA</span></div><h2>{a.title}</h2><p>{a.body}</p><div className="readline"><strong>{a.read?"Gelezen":"Nog niet gelezen"}</strong><button className="ghost" onClick={()=>setAnnouncements(announcements.map(x=>x.id===a.id?{...x,read:!x.read}:x))}>{a.read?"Markeer ongelezen":"Markeer gelezen"}</button><button className="mini-btn danger" onClick={()=>setAnnouncements(announcements.filter(x=>x.id!==a.id))}>×</button></div></Card>)}
          </>}

          {moduleSlug === "muziekmappen" && <MusicFoldersModule stationSlug={station.slug} />}

          {moduleSlug === "kalender" && <>
            <div className="calendar-head"><div><button className="ghost" onClick={()=>notify("Vorige week")}>‹</button><button className="ghost" onClick={()=>notify("Volgende week")}>›</button><button className="primary soft" onClick={()=>notify("Terug naar deze week")}>Vandaag</button><h2>31 aug – 6 september 2026</h2></div><div><button className="primary" onClick={()=>setModal("event")}>+ Item</button></div></div>
            <Card className="calendar-card"><div className="week-head"><div></div>{["ma 31","di 1","wo 2","do 3","vr 4","za 5","zo 6"].map(d=><div key={d}>{d}</div>)}</div><div className="week-body"><div className="hours">{["08:00","10:00","12:00","14:00","16:00","18:00","20:00"].map(x=><span key={x}>{x}</span>)}</div><div className="week-grid">{events.map(e=><button title="Klik om te verwijderen" className={`cal-event ${e.type}`} style={{gridColumn:String(e.day),gridRow:String(e.row)}} key={e.id} onClick={()=>{if(confirm(`"${e.title}" verwijderen?`))setEvents(events.filter(x=>x.id!==e.id))}}><strong>{e.title}</strong><small>{e.time}</small></button>)}</div></div></Card>
          </>}

          {moduleSlug === "programmering" && <>
            <div className="day-tabs">{["Ma 31","Di 1","Wo 2","Do 3","Vr 4","Za 5","Zo 6"].map((d,i)=><button className={i===0?"active":""} key={d} onClick={()=>notify(`Schema ${d} geselecteerd`)}>{d}</button>)}<button onClick={()=>notify("Schema-editor wordt later gekoppeld aan echte programmadatabase")}>+ Programma</button></div>
            <div className="schedule-list">{shows.map(show=><Card className={`schedule-item ${show.live?"live-item":""}`} key={show.time}><div className="time-line"><strong>{show.time}</strong><span/></div><div className="show-avatar large">{show.host.split(" ").map(x=>x[0]).slice(0,2).join("")}</div><div className="schedule-info"><h3>{show.name} {show.live&&<Badge tone="red">ON AIR</Badge>}</h3><p>{show.host}</p></div><span className="muted">{show.time} – {show.end}</span><button className="ghost" onClick={()=>notify(`${show.name}: editor geopend (demo)`) }>Bewerk</button></Card>)}</div>
          </>}

          {moduleSlug === "muziek" && <MusicLibraryModule stationSlug={station.slug} />}

          {moduleSlug === "meetings" && <div className="meeting-layout"><Card className="meeting-summary"><Badge tone={meetingStarted?"green":"blue"}>{meetingStarted?"BEZIG":"GEPLAND"}</Badge><h2>Nieuwe muziek • Week 36</h2><p>Dinsdag 1 september • 10:00 – 11:30</p><div className="meeting-kpis"><span><b>18</b> tracks</span><span><b>{meetingIndex}</b> beoordeeld</span><span><b>4</b> deelnemers</span></div><button className="primary wide" onClick={()=>{setMeetingStarted(!meetingStarted);notify(meetingStarted?"Meeting gepauzeerd":"Meeting gestart")}}>{meetingStarted?"Meeting pauzeren":"Meeting starten"}</button></Card>
            <Card className="meeting-main"><div className="section-head"><div><span className="eyebrow">{String(meetingIndex).padStart(2,"0")} / 18</span><h2>ANOTR & 54 Ultra – Talk To You</h2></div><button className="primary soft" onClick={()=>notify("Preview gestart (demo)")}>▶ Beluister</button></div><div className="score-big">8,2<small>/10 teamgemiddelde</small></div><div className="decision-grid">{["A-hit","B-hit","C-hit","Testen","Later","Afwijzen"].map((x,i)=><button className={`decision d${i} ${meetingDecision===x?"selected-decision":""}`} onClick={()=>setMeetingDecision(x)} key={x}>{x}</button>)}</div><label className="field">Notitie<textarea className="input textarea" defaultValue="Sterke opener, goede daytime fit. Testen op A-rotatie vanaf maandag."/></label><button className="primary" onClick={()=>{if(!meetingDecision){notify("Kies eerst een beslissing");return;}setMeetingIndex(Math.min(18,meetingIndex+1));notify(`${meetingDecision} opgeslagen • volgende track`)}}>Beslissing opslaan & volgende →</button></Card>
          </div>}

          {moduleSlug === "playlists" && <>
            <div className="page-intro"><div><h2>Rotation One playlists</h2><p>Interactieve browserdemo: wijzigingen blijven na refresh bewaard.</p></div><div className="button-row"><button className="ghost" onClick={()=>notify("Synchronisatie met Rotation One gesimuleerd")}>↻ Synchroniseer</button><button className="primary" onClick={()=>notify("Playlist lokaal opgeslagen")}>Opslaan</button></div></div>
            <div className="playlist-layout"><Card className="playlist-timeline"><div className="playlist-head"><div><h3>Dinsdag 1 september • 16:00</h3><span className="positive">● Demo lokaal</span></div><Badge tone="green">Versie 20</Badge></div>{playlist.map((item,i)=><div className={`playlist-item ${item.includes("Commercial")||item.includes("News")?"special":""}`} key={`${item}-${i}`}><span className="drag">⋮⋮</span><span className="playlist-time">{`16:${String(i*4).padStart(2,"0")}`}</span><button className="playlist-edit-text" onClick={()=>editPlaylistItem(i)}><strong>{item}</strong><small>Klik om tekst te wijzigen</small></button><div className="item-actions"><button onClick={()=>movePlaylist(i,-1)} className="mini-btn">↑</button><button onClick={()=>movePlaylist(i,1)} className="mini-btn">↓</button><button onClick={()=>{setPlaylist(playlist.filter((_,x)=>x!==i));notify("Item verwijderd")}} className="mini-btn danger">×</button></div></div>)}</Card>
              <Card className="inspector"><h3>Playlist inspector</h3><p className="muted">Items kun je nu wijzigen, verplaatsen en verwijderen.</p><div className="inspector-box"><span>Rotation One</span><strong>nog niet gekoppeld</strong><Badge tone="orange">DEMO</Badge></div><button className="primary wide" onClick={()=>setModal("playlist")}>+ Item toevoegen</button><button className="ghost wide spaced" onClick={()=>{setPlaylist(initialPlaylist);notify("Demo-playlist hersteld")}}>Reset demo</button></Card></div>
          </>}

          {moduleSlug === "redactie" && <EditorialModule stationSlug={station.slug} />}

          {moduleSlug === "hitlijsten" && <>
            <div className="page-intro"><div><h2>Versuz TOP 50</h2><p>Week 36 • {chartPublished?"gepubliceerd":"concepteditie"}</p></div><div className="button-row"><button className="ghost" onClick={()=>setHistoryVisible(!historyVisible)}>{historyVisible?"Verberg historiek":"Historiek"}</button><button className="primary" onClick={()=>{setChartPublished(!chartPublished);notify(chartPublished?"Terug naar concept":"Hitlijst gepubliceerd")}}>{chartPublished?"Publicatie intrekken":"Publiceren"}</button></div></div>
            {historyVisible&&<Card className="history-card"><h3>Recente edities</h3><p>Week 35 • #1 ANOTR & 54 Ultra</p><p>Week 34 • #1 Jennifer Lopez & David Guetta</p><p>Week 33 • #1 Joel Corry</p></Card>}
            <div className="metric-grid compact"><Card><span className="metric-label">Nieuwe binnenkomers</span><strong className="metric">4</strong></Card><Card><span className="metric-label">Grootste stijger</span><strong className="metric">▲ 12</strong></Card><Card><span className="metric-label">Grootste daler</span><strong className="metric">▼ 9</strong></Card><Card><span className="metric-label">Langst genoteerd</span><strong className="metric">16 wk</strong></Card></div>
            <Card className="table-card"><table><thead><tr><th>#</th><th>Vorige</th><th>Artiest</th><th>Titel</th><th>Trend</th><th>Weken</th><th>Peak</th></tr></thead><tbody>{chart.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j} className={j===4?(String(c).includes("▲")?"positive":String(c).includes("▼")?"negative":""):""}>{c}</td>)}</tr>)}</tbody></table></Card>
          </>}

          {moduleSlug === "presentatie" && <PresentationModule stationSlug={station.slug} />}

          {moduleSlug === "social" && <SocialStudioModule stationSlug={station.slug} />}

          {moduleSlug === "statistieken" && <>
            <div className="page-intro"><div><h2>Luistercijfers</h2><p>Laatste refresh: {lastRefresh}</p></div><button className="ghost" onClick={()=>{setLastRefresh(new Date().toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit",second:"2-digit"}));notify("Statistieken vernieuwd")}}>↻ Vernieuwen</button></div>
            <div className="metric-grid"><Card><span className="metric-label">Nu</span><strong className="metric">184</strong><span className="positive">+12%</span></Card><Card><span className="metric-label">Piek vandaag</span><strong className="metric">291</strong><span className="muted">16:21</span></Card><Card><span className="metric-label">Gemiddeld</span><strong className="metric">153</strong><span className="muted">vandaag</span></Card><Card><span className="metric-label">Luistertijd</span><strong className="metric">31m</strong><span className="positive">+4m</span></Card></div>
            <Card><div className="section-head"><div><h3>Listeners vandaag</h3><p>Per uur</p></div><select className="select" onChange={()=>notify("Periode gewijzigd")}><option>Vandaag</option><option>7 dagen</option><option>30 dagen</option></select></div><div className="bar-chart">{[48,55,62,76,74,90,88,98,83,71,92,100,84,67].map((h,i)=><div className="bar-wrap" key={i}><div className="bar" style={{height:`${h}%`}}/><span>{i+7}</span></div>)}</div></Card>
          </>}

          {moduleSlug === "control" && <>
            <div className="page-intro"><div><h2>On-Air Control Center</h2><p>Laatste refresh: {lastRefresh}</p></div><button className="ghost" onClick={()=>{setLastRefresh(new Date().toLocaleTimeString("nl-BE"));notify("Alle stations vernieuwd")}}>↻ Alles verversen</button></div>
            <Card className="table-card"><table><thead><tr><th>Station</th><th>Playout</th><th>Rotation</th><th>Stream</th><th>Playlists</th><th>Nieuws</th><th>Listeners</th></tr></thead><tbody><tr><td><b>Versuz Radio</b></td><td><Badge tone="green">Online</Badge></td><td><Badge tone="green">Online</Badge></td><td><Badge tone="green">Online</Badge></td><td>8 sep</td><td>✓ 08:00</td><td><b>184</b></td></tr><tr><td><b>Club FM</b></td><td><Badge tone="green">Online</Badge></td><td><Badge tone="green">Online</Badge></td><td><Badge tone="green">Online</Badge></td><td>7 sep</td><td>✓ 08:00</td><td><b>137</b></td></tr><tr><td><b>Vlacora One</b></td><td><Badge tone="red">Offline</Badge></td><td><Badge tone="green">Online</Badge></td><td><Badge tone="red">Offline</Badge></td><td>5 sep</td><td>⚠ ontbreekt</td><td><b>0</b></td></tr></tbody></table></Card>
          </>}

          {moduleSlug === "radio-api" && <RadioApiModule stationSlug={station.slug} />}

          {moduleSlug === "team" && <TeamRightsModule stationSlug={station.slug} />}

          {moduleSlug === "beheer" && <AdminIntegrationsModule stationName={station.name} />}
        </div>
      </main>

      {toast && <div className="toast">{toast}</div>}

      {modal === "task" && <Modal title="Nieuwe taak" onClose={()=>setModal(null)}><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);setTasks([{id:uid(),title:String(f.get("title")),owner:String(f.get("owner")||"Jasper"),due:String(f.get("due")||"Geen deadline"),status:"Te doen",priority:String(f.get("priority")||"Normaal")},...tasks]);setModal(null);notify("Taak aangemaakt")}} className="modal-form"><label className="field">Titel<input required name="title" className="input"/></label><label className="field">Verantwoordelijke<input name="owner" className="input" defaultValue="Jasper"/></label><label className="field">Deadline<input name="due" className="input" placeholder="bv. Morgen 17:00"/></label><label className="field">Prioriteit<select name="priority" className="select"><option>Normaal</option><option>Hoog</option></select></label><button className="primary">Aanmaken</button></form></Modal>}

      {modal === "incident" && <Modal title={`Nieuwe melding • ${incidentCategory}`} onClose={()=>setModal(null)}><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);setIncidents([{id:uid(),category:incidentCategory,title:String(f.get("title")),severity:String(f.get("severity")),status:"Open",created:"zojuist"},...incidents]);setModal(null);notify("Melding geregistreerd")}} className="modal-form"><label className="field">Titel<input required name="title" className="input" placeholder="Wat is er aan de hand?"/></label><label className="field">Ernst<select name="severity" className="select"><option>Normaal</option><option>Hoog</option></select></label><label className="field">Beschrijving<textarea className="input textarea" name="description"/></label><button className="primary">Melding indienen</button></form></Modal>}

      {modal === "announcement" && <Modal title="Officieel bericht publiceren" onClose={()=>setModal(null)}><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);setAnnouncements([{id:uid(),title:String(f.get("title")),body:String(f.get("body")),category:String(f.get("category")),importance:String(f.get("importance")),read:false},...announcements]);setModal(null);notify("Officieel bericht gepubliceerd")}} className="modal-form"><label className="field">Titel<input required name="title" className="input"/></label><label className="field">Categorie<input name="category" className="input" defaultValue="Muziekredactie"/></label><label className="field">Belang<select name="importance" className="select"><option>Normaal</option><option>Belangrijk</option></select></label><label className="field">Bericht<textarea required name="body" className="input textarea"/></label><button className="primary">Publiceren</button></form></Modal>}

      {modal === "event" && <Modal title="Kalenderitem toevoegen" onClose={()=>setModal(null)}><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);setEvents([...events,{id:uid(),title:String(f.get("title")),type:String(f.get("type")),day:Number(f.get("day")),row:Number(f.get("row")),time:String(f.get("time"))}]);setModal(null);notify("Kalenderitem toegevoegd")}} className="modal-form"><label className="field">Titel<input required name="title" className="input"/></label><label className="field">Dag<select name="day" className="select">{["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag","Zondag"].map((d,i)=><option value={i+1} key={d}>{d}</option>)}</select></label><label className="field">Tijdslot<select name="row" className="select">{["08:00","10:00","12:00","14:00","16:00","18:00","20:00"].map((t,i)=><option value={i+1} key={t}>{t}</option>)}</select></label><label className="field">Tijdtekst<input name="time" className="input" defaultValue="10:00 – 11:00"/></label><label className="field">Type<select name="type" className="select"><option value="purple">Meeting</option><option value="red">Uitzending</option><option value="green">Deadline</option><option value="orange">Technisch</option></select></label><button className="primary">Toevoegen</button></form></Modal>}

      {modal === "playlist" && <Modal title="Playlistitem toevoegen" onClose={()=>setModal(null)}><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);setPlaylist([...playlist,String(f.get("item"))]);setModal(null);notify("Playlistitem toegevoegd")}} className="modal-form"><label className="field">Item<input required name="item" className="input" placeholder="Artiest - Titel"/></label><button className="primary">Toevoegen</button></form></Modal>}

      {modal === "track" && <Modal title="Nieuwe track" onClose={()=>setModal(null)}><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);setCustomTracks([...customTracks,{id:uid(),artist:String(f.get("artist")),title:String(f.get("title")),genre:String(f.get("genre")||"Dance"),release:String(f.get("release")||"Onbekend")}]);setModal(null);notify("Track toegevoegd aan inbox")}} className="modal-form"><label className="field">Artiest<input required name="artist" className="input"/></label><label className="field">Titel<input required name="title" className="input"/></label><label className="field">Genre<input name="genre" className="input" defaultValue="Dance"/></label><label className="field">Release<input name="release" className="input" placeholder="dd/mm/jjjj"/></label><button className="primary">Toevoegen</button></form></Modal>}

      {modal === "team" && <Modal title="Gebruiker toevoegen" onClose={()=>setModal(null)}><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);const name=String(f.get("name"));setTeam([...team,{id:uid(),name,role:String(f.get("role")),initials:name.split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase(),scope:String(f.get("scope"))}]);setModal(null);notify("Teamlid toegevoegd")}} className="modal-form"><label className="field">Naam<input required name="name" className="input"/></label><label className="field">Rol<input required name="role" className="input" defaultValue="Presentator"/></label><label className="field">Stations<input name="scope" className="input" defaultValue={station.name}/></label><button className="primary">Toevoegen</button></form></Modal>}
    </div>
  );
}
