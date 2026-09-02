"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { initialPlaylist, navItems } from "@/lib/mock-data";
import MessengerModule from "@/components/modules/messenger-module";
import PresentationModule from "@/components/modules/presentation-module";
import SocialStudioModule from "@/components/modules/social-studio-module";
import MusicLibraryModule from "@/components/modules/music-library-module";
import EditorialModule from "@/components/modules/editorial-module";
import RadioApiModule from "@/components/modules/radio-api-module";
import PlayoutOneModule from "@/components/modules/playout-one-module";
import TrafficModule from "@/components/modules/traffic-module";
import PresenterDashboardModule from "@/components/modules/presenter-dashboard-module";
import AbsencesModule from "@/components/modules/absences-module";
import ContactsModule from "@/components/modules/contacts-module";
import ProgramPagesModule from "@/components/modules/program-pages-module";
import ContentInboxModule from "@/components/modules/content-inbox-module";
import PersonalInboxModule from "@/components/modules/personal-inbox-module";
import OperationalWarningsPanel from "@/components/modules/operational-warnings-panel";
import GlobalSearch from "@/components/global-search";
import AdminRequestsModule from "@/components/modules/admin-requests-module";
import MusicMeetingsModule from "@/components/modules/music-meetings-module";
import TeamRightsModule from "@/components/modules/team-rights-module";
import AdminIntegrationsModule from "@/components/modules/admin-integrations-module";
import MusicFoldersModule from "@/components/modules/music-folders-module";
import ProgrammingModule from "@/components/modules/programming-module";
import ChartsModule from "@/components/modules/charts-module";
import IncidentModule,{IncidentSummaryCard} from "@/components/modules/incident-module";
import TemplatesModule from "@/components/modules/templates-module";
import ShoutcastStatsModule,{ListenerNowCard} from "@/components/modules/shoutcast-stats-module";
import TasksModule,{TaskSummaryCard} from "@/components/modules/tasks-module";
import { hydrateSharedIntegrationSettings,loadSharedSetting } from "@/lib/supabase/settings";
import { HUB_STATIONS_EVENT, allHubStation, readHubStations, saveStationAlias, type HubStation, type HubStationAlias } from "@/lib/radio/hub-stations";
import AccountWidget from "@/components/auth/account-widget";
import { loadSharedRotationStations } from "@/lib/supabase/hub-data";
import { saveStationCache } from "@/lib/radio/client-config";
import { runOperationalChecks } from "@/lib/supabase/operations";
import { CollaborationProvider,useCollaboration } from "@/components/collaboration/collaboration-provider";
import {
  MandatoryNotificationModal,NotificationBell,NotificationDrawer,NotificationsPage,
  PresenceButton,PresencePanel,TodayCollaboration
} from "@/components/collaboration/collaboration-ui";

type Props = { stationSlug: string; moduleSlug: string };
type Tone = "blue" | "red" | "green" | "orange" | "gray";
type Announcement = { id: string; title: string; body: string; category: string; importance: string; read: boolean; requiresAck?: boolean };
type CalendarEvent = { id: string; title: string; type: string; day: number; row: number; time: string };
type CustomTrack = { id: string; artist: string; title: string; genre: string; release: string };
type ModalType = "announcement" | "event" | "playlist" | "track" | null;

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

function HubAppInner({ stationSlug, moduleSlug }: Props) {
  const router = useRouter();
  const collaboration=useCollaboration();
  const [hubStations,setHubStations] = useState<HubStation[]>([allHubStation()]);
  useEffect(()=>{
    let alive=true;
    const refresh=()=>setHubStations(readHubStations());
    refresh();
    loadSharedRotationStations().then(stations=>{if(alive&&stations.length){saveStationCache("rotation",stations);refresh()}}).catch(()=>{});
    window.addEventListener(HUB_STATIONS_EVENT,refresh as EventListener);
    window.addEventListener("storage",refresh);
    return()=>{alive=false;window.removeEventListener(HUB_STATIONS_EVENT,refresh as EventListener);window.removeEventListener("storage",refresh)};
  },[]);
  useEffect(()=>{void hydrateSharedIntegrationSettings(stationSlug)},[stationSlug]);
  useEffect(()=>{if(stationSlug!=="all")void runOperationalChecks(stationSlug).catch(()=>{})},[stationSlug,moduleSlug]);
  useEffect(()=>{
    if(stationSlug==="all")return;
    void loadSharedSetting<HubStationAlias>(`station:${stationSlug}`,"station-alias")
      .then(a=>{if(a?.name||a?.short)saveStationAlias(stationSlug,a)})
      .catch(()=>{});
  },[stationSlug]);
  const station = hubStations.find((s) => s.slug === stationSlug) || (stationSlug==="all"?allHubStation():{slug:stationSlug,name:"Station laden…",short:"…",accent:"#26269f",source:"rotation" as const});
  const storagePrefix = `vlacora:${stationSlug}`;

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
  const [stationSettings, setStationSettings] = useLocalState(`${storagePrefix}:settings`, {
    name: station.name, timezone: "Europe/Brussels", active: true, playlistWarnings: true, newsCheck: true, socialReminders: true
  });

  const [modal, setModal] = useState<ModalType>(null);
  const [toast, setToast] = useState("");
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
  function movePlaylist(index: number, direction: -1 | 1) {
    const next = [...playlist];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setPlaylist(next);
    notify("Playlistvolgorde aangepast");
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
              {slug === "meldingen" && collaboration.unreadCount > 0 && <span className={`nav-count ${collaboration.requiredCount?"critical-count":""}`}>{Math.min(collaboration.unreadCount,99)}</span>}
            </Link>
          ))}
        </nav>
        <AccountWidget />
      </aside>

      <main className="main">
        <header className="topbar">
          <div><div className="eyebrow">VLACORA / {station.name}</div><h1>{moduleName}</h1></div>
          <GlobalSearch stationSlug={station.slug}/>
          <div className="top-actions">
            <select className="select" value={station.slug} onChange={(e) => router.push(`/hub/${e.target.value}/${moduleSlug}`)}>
              {hubStations.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
            </select>
            <PresenceButton />
            <NotificationBell />
            <div className="live-pill"><span /> LIVE</div>
          </div>
        </header>

        <div className="content">
          {moduleSlug === "dashboard" && <>
            <section className="hero">
              <div><div className="hero-kicker">TODAY • LIVE WERKPLEK</div><h2>{collaboration.currentUser?.name?`Welkom, ${collaboration.currentUser.name}.`:"Vandaag in VLACORA"}</h2><p>Dit vraagt vandaag aandacht binnen {station.name}.</p></div>
              <div className="hero-now"><span className="tiny">LIVE RADIO</span><strong>Rotation One + Playout One</strong><span>Open Radio API voor echte now/next en status.</span></div>
            </section>
            <div className="metric-grid">
              <ListenerNowCard stationSlug={station.slug} />
              <Card><span className="metric-label">Playlistdekking</span><strong className="metric">LIVE</strong><span className="muted">Via Rotation One coverage</span></Card>
              <TaskSummaryCard stationSlug={station.slug} />
              <Card><span className="metric-label">Team bezig</span><strong className="metric">{collaboration.presence.length}</strong><span className="muted">live in de HUB</span></Card>
            </div>
            <div className="two-col">
              <IncidentSummaryCard stationSlug={station.slug} />
              <Card><div className="section-head"><div><h3>Systeemstatus</h3><p>Radio-status komt uitsluitend uit de echte API-koppelingen.</p></div><Badge tone="blue">LIVE API</Badge></div>
                <div className="attention-list"><div className="attention blue"><span>↻</span><div><strong>Rotation One / Playout One</strong><small>Open Radio API voor live health, stationmapping en now/next.</small></div></div></div>
                <button className="primary wide" onClick={()=>router.push(`/hub/${station.slug}/radio-api`)}>Open live Radio API →</button>
              </Card>
            </div>
            <TodayCollaboration stationName={station.name} onOpenNotifications={collaboration.openNotifications} onOpenPresence={collaboration.openPresence}/>
            <Card><div className="section-head"><div><h3>Uitzendschema</h3><p>Vandaag • {station.name}</p></div><button className="ghost" onClick={()=>router.push(`/hub/${station.slug}/programmering`)}>Open programmering →</button></div><div className="empty-live-state compact"><strong>Bewerkbare programmering</strong><span>Programma&apos;s worden niet meer uit een vaste demo geladen. Beheer ze in Programmering.</span></div></Card>
          </>}

          {moduleSlug === "voor-mij" && <PersonalInboxModule stationSlug={station.slug} />}

          {moduleSlug === "mijn-uitzending" && <PresenterDashboardModule stationSlug={station.slug} />}

          {moduleSlug === "meldingen" && <><NotificationsPage stationSlug={station.slug} /><OperationalWarningsPanel stationSlug={station.slug}/></>}

          {moduleSlug === "stations" && <><div className="page-intro"><div><h2>Stations uit Rotation One</h2><p>Deze lijst wordt rechtstreeks opgebouwd uit de laatst opgehaalde Rotation One-stations.</p></div><button className="primary" onClick={()=>router.push(`/hub/${station.slug}/radio-api`)}>↻ Stations beheren</button></div>{hubStations.filter(s=>s.slug!=="all").length===0?<Card><div className="empty-live-state"><strong>Nog geen Rotation One-stations opgehaald</strong><span>Ga naar Radio API of Beheer → Integraties en klik op Stations ophalen.</span></div></Card>:<div className="station-grid">{hubStations.filter(s=>s.slug!=="all").map(s=><Card key={s.slug} className="station-card"><div className="station-card-head"><div className="station-logo" style={{background:s.accent}}>{s.short}</div><div><h3>{s.name}</h3><span className="muted">Rotation One • {s.rotationId}</span></div></div><div className="station-stat"><span>Bron</span><strong>Live Rotation One</strong></div><Link className="primary wide" href={`/hub/${s.slug}/dashboard`}>Open station</Link></Card>)}</div>}</>}

          {moduleSlug === "taken" && <TasksModule stationSlug={station.slug} />}

          {moduleSlug === "meldpunt" && <IncidentModule stationSlug={station.slug} publishNotification={collaboration.publishNotification} />}

          {moduleSlug === "aanvragen" && <AdminRequestsModule stationSlug={station.slug} />}

          {moduleSlug === "content-inbox" && <ContentInboxModule stationSlug={station.slug} />}

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

          {moduleSlug === "programmering" && <ProgrammingModule stationSlug={station.slug} stationName={station.name} />}

          {moduleSlug === "programmas" && <ProgramPagesModule stationSlug={station.slug} />}

          {moduleSlug === "afwezigheden" && <AbsencesModule stationSlug={station.slug} />}

          {moduleSlug === "contacten" && <ContactsModule stationSlug={station.slug} />}

          {moduleSlug === "sjablonen" && <TemplatesModule stationSlug={station.slug} />}

          {moduleSlug === "muziek" && <MusicLibraryModule stationSlug={station.slug} />}

          {moduleSlug === "meetings" && <MusicMeetingsModule stationSlug={station.slug} />}

          {moduleSlug === "playlists" && <EditorialModule stationSlug={station.slug} /> }

          {moduleSlug === "redactie" && <EditorialModule stationSlug={station.slug} />}

          {moduleSlug === "verkeer" && <TrafficModule stationSlug={station.slug} />}

          {moduleSlug === "hitlijsten" && <ChartsModule stationSlug={station.slug} stationName={station.name} />}

          {moduleSlug === "presentatie" && <PresentationModule stationSlug={station.slug} />}

          {moduleSlug === "social" && <SocialStudioModule stationSlug={station.slug} />}

          {moduleSlug === "statistieken" && <ShoutcastStatsModule stationSlug={station.slug} />}

          {moduleSlug === "control" && <><div className="page-intro"><div><h2>On-Air Control Center</h2><p>Geen vaste demo-statussen: open per station de echte API-status.</p></div><button className="ghost" onClick={()=>router.push(`/hub/${station.slug}/radio-api`)}>↻ Live API</button></div><div className="station-grid">{hubStations.filter(s=>s.slug!=="all").map(s=><Card key={s.slug} className="station-card"><div className="station-card-head"><div className="station-logo" style={{background:s.accent}}>{s.short}</div><div><h3>{s.name}</h3><span className="muted">Rotation ID: {s.rotationId}</span></div></div><Link className="primary wide" href={`/hub/${s.slug}/radio-api`}>Bekijk Rotation + Playout status</Link></Card>)}</div></>}

          {moduleSlug === "playout" && <PlayoutOneModule stationSlug={station.slug} />}

          {moduleSlug === "radio-api" && <RadioApiModule stationSlug={station.slug} />}

          {moduleSlug === "team" && <TeamRightsModule stationSlug={station.slug} />}

          {moduleSlug === "beheer" && <AdminIntegrationsModule stationName={station.name} stationSlug={station.slug} />}
        </div>
      </main>

      <NotificationDrawer />
      <PresencePanel />
      <MandatoryNotificationModal />

      {toast && <div className="toast">{toast}</div>}


      {modal === "announcement" && <Modal title="Officieel bericht publiceren" onClose={()=>setModal(null)}><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);const title=String(f.get("title"));const body=String(f.get("body"));const category=String(f.get("category"));const importance=String(f.get("importance"));const requiresAck=f.get("requiresAck")==="on";setAnnouncements([{id:uid(),title,body,category,importance,read:false,requiresAck},...announcements]);void collaboration.publishNotification({stationSlug:station.slug,title,body,category,severity:importance==="Belangrijk"?"warning":"info",requiresAck,actionPath:`/hub/${station.slug}/communicatie`}).catch(()=>notify("Bericht lokaal opgeslagen; teamnotificatie kon niet worden gedeeld."));setModal(null);notify(requiresAck?"Verplicht bericht gepubliceerd":"Officieel bericht gepubliceerd")}} className="modal-form"><label className="field">Titel<input required name="title" className="input"/></label><label className="field">Categorie<input name="category" className="input" defaultValue="Muziekredactie"/></label><label className="field">Belang<select name="importance" className="select"><option>Normaal</option><option>Belangrijk</option></select></label><label className="field">Bericht<textarea required name="body" className="input textarea"/></label><label className="required-notification-toggle"><input type="checkbox" name="requiresAck"/><div><strong>Moet iedereen gezien hebben</strong><span>De melding blijft verplicht op het scherm tot de gebruiker ze expliciet bevestigt.</span></div></label><button className="primary">Publiceren</button></form></Modal>}

      {modal === "event" && <Modal title="Kalenderitem toevoegen" onClose={()=>setModal(null)}><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);setEvents([...events,{id:uid(),title:String(f.get("title")),type:String(f.get("type")),day:Number(f.get("day")),row:Number(f.get("row")),time:String(f.get("time"))}]);setModal(null);notify("Kalenderitem toegevoegd")}} className="modal-form"><label className="field">Titel<input required name="title" className="input"/></label><label className="field">Dag<select name="day" className="select">{["Maandag","Dinsdag","Woensdag","Donderdag","Vrijdag","Zaterdag","Zondag"].map((d,i)=><option value={i+1} key={d}>{d}</option>)}</select></label><label className="field">Tijdslot<select name="row" className="select">{["08:00","10:00","12:00","14:00","16:00","18:00","20:00"].map((t,i)=><option value={i+1} key={t}>{t}</option>)}</select></label><label className="field">Tijdtekst<input name="time" className="input" defaultValue="10:00 – 11:00"/></label><label className="field">Type<select name="type" className="select"><option value="purple">Meeting</option><option value="red">Uitzending</option><option value="green">Deadline</option><option value="orange">Technisch</option></select></label><button className="primary">Toevoegen</button></form></Modal>}

      {modal === "playlist" && <Modal title="Playlistitem toevoegen" onClose={()=>setModal(null)}><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);setPlaylist([...playlist,String(f.get("item"))]);setModal(null);notify("Playlistitem toegevoegd")}} className="modal-form"><label className="field">Item<input required name="item" className="input" placeholder="Artiest - Titel"/></label><button className="primary">Toevoegen</button></form></Modal>}

      {modal === "track" && <Modal title="Nieuwe track" onClose={()=>setModal(null)}><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);setCustomTracks([...customTracks,{id:uid(),artist:String(f.get("artist")),title:String(f.get("title")),genre:String(f.get("genre")||"Dance"),release:String(f.get("release")||"Onbekend")}]);setModal(null);notify("Track toegevoegd aan inbox")}} className="modal-form"><label className="field">Artiest<input required name="artist" className="input"/></label><label className="field">Titel<input required name="title" className="input"/></label><label className="field">Genre<input name="genre" className="input" defaultValue="Dance"/></label><label className="field">Release<input name="release" className="input" placeholder="dd/mm/jjjj"/></label><button className="primary">Toevoegen</button></form></Modal>}

    </div>
  );
}

export default function HubApp(props:Props){
  return <CollaborationProvider stationSlug={props.stationSlug} moduleSlug={props.moduleSlug}>
    <HubAppInner {...props}/>
  </CollaborationProvider>;
}
