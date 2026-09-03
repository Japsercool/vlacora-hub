"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { navItems } from "@/lib/mock-data";
import MessengerModule from "@/components/modules/messenger-module";
import PresentationModule from "@/components/modules/presentation-module";
import SocialStudioModule from "@/components/modules/social-studio-module";
import CalendarModule from "@/components/modules/calendar-module";
import MusicLibraryModule from "@/components/modules/music-library-module";
import MusicProposalsModule from "@/components/modules/music-proposals-module";
import CommunicationsModule from "@/components/modules/communications-module";
import EditorialModule from "@/components/modules/editorial-module";
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
import ProgrammingModule from "@/components/modules/programming-module";
import ChartsModule from "@/components/modules/charts-module";
import IncidentModule,{IncidentSummaryCard} from "@/components/modules/incident-module";
import TemplatesModule from "@/components/modules/templates-module";
import TasksModule,{TaskSummaryCard} from "@/components/modules/tasks-module";
import { HUB_STATIONS_EVENT, allHubStation, hydrateHubStations, readHubStations, type HubStation } from "@/lib/hub-stations";
import AccountWidget from "@/components/auth/account-widget";
import { runOperationalChecks } from "@/lib/supabase/operations";
import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import { can,modulePermission,resolvePermissions,type PermissionMap } from "@/lib/permissions";
import { CollaborationProvider,useCollaboration } from "@/components/collaboration/collaboration-provider";
import {
  MandatoryNotificationModal,NotificationBell,NotificationDrawer,NotificationsPage,
  PresenceButton,PresencePanel,TodayCollaboration
} from "@/components/collaboration/collaboration-ui";

type Props = { stationSlug: string; moduleSlug: string };
type Tone = "blue" | "red" | "green" | "orange" | "gray";
type ModalType = null;


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
    const refresh=()=>setHubStations(readHubStations());refresh();void hydrateHubStations().then(refresh);
    window.addEventListener(HUB_STATIONS_EVENT,refresh as EventListener);window.addEventListener("storage",refresh);
    return()=>{window.removeEventListener(HUB_STATIONS_EVENT,refresh as EventListener);window.removeEventListener("storage",refresh)};
  },[]);
  useEffect(()=>{if(stationSlug!=="all")void runOperationalChecks(stationSlug).catch(()=>{})},[stationSlug,moduleSlug]);
  const station = hubStations.find((s) => s.slug === stationSlug) || (stationSlug==="all"?allHubStation():{slug:stationSlug,name:"Station",short:"ST",accent:"#26269f",source:"vlacora" as const});

  const [modal, setModal] = useState<ModalType>(null);
  const [toast, setToast] = useState("");
  const [lastRefresh, setLastRefresh] = useState("zojuist");
  const [permissions,setPermissions]=useState<PermissionMap|null>(null);

  useEffect(()=>{
    let alive=true;
    if(!isSupabaseBrowserConfigured())return;
    const supabase=createClient();
    void supabase.auth.getUser().then(async({data})=>{
      if(!data.user||!alive)return;
      const{data:profile}=await supabase.from("profiles").select("role,permissions").eq("id",data.user.id).maybeSingle();
      if(!alive)return;
      setPermissions(resolvePermissions(String(profile?.role||"kijker"),profile?.permissions));
    });
    return()=>{alive=false};
  },[]);

  const visibleNavItems=useMemo(()=>navItems.filter(([slug])=>{const key=modulePermission[slug];return key===null||!permissions||can(permissions[key],"view")}),[permissions]);
  const currentPermissionKey=modulePermission[moduleSlug];
  const hasModuleAccess=currentPermissionKey===null||!permissions||can(permissions[currentPermissionKey],"view");
  const moduleName = useMemo(() => navItems.find((n) => n[0] === moduleSlug)?.[2] || "Dashboard", [moduleSlug]);

  function notify(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(""), 2600);
  }


  return (
    <div className="hub-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">V</div><div><div className="brand-name">VLACORA</div><div className="brand-sub">HUB</div></div></div>
        <div className="station-mini"><span className="station-dot" style={{ background: station.accent }} /><div><strong>{station.name}</strong><small>Multi-station workspace</small></div></div>
        <nav className="nav">
          {visibleNavItems.map(([slug, icon, label]) => (
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
            <div className="team-online-pill"><span /> TEAM ONLINE</div>
          </div>
        </header>

        <div className="content">
          {!hasModuleAccess && <div className="card empty-live-state"><strong>Geen toegang tot dit onderdeel</strong><span>Een superadmin kan dit per gebruiker aanpassen bij Team & rechten.</span></div>}
          {hasModuleAccess && moduleSlug === "dashboard" && <>
            <section className="hero">
              <div><div className="hero-kicker">TODAY • LIVE WERKPLEK</div><h2>{collaboration.currentUser?.name?`Welkom, ${collaboration.currentUser.name}.`:"Vandaag in VLACORA"}</h2><p>Dit vraagt vandaag aandacht binnen {station.name}.</p></div>
              <div className="hero-now"><span className="tiny">TEAM HUB</span><strong>Redactie • planning • communicatie</strong><span>Alles wat je team vandaag nodig heeft in één werkplek.</span></div>
            </section>
            <div className="metric-grid">
              <Card><span className="metric-label">Werkplek</span><strong className="metric">ACTIEF</strong><span className="muted">zelfstandig</span></Card>
              <Card><span className="metric-label">Redactie</span><strong className="metric">HUB</strong><span className="muted">draaiboeken & talks</span></Card>
              <TaskSummaryCard stationSlug={station.slug} />
              <Card><span className="metric-label">Team bezig</span><strong className="metric">{collaboration.presence.length}</strong><span className="muted">live in de HUB</span></Card>
            </div>
            <div className="two-col">
              <IncidentSummaryCard stationSlug={station.slug} />
              <Card><div className="section-head"><div><h3>Teamwerk</h3><p>Focus op redactie, taken, communicatie en planning.</p></div><Badge tone="green">STANDALONE</Badge></div><div className="attention-list"><div className="attention blue"><span>✓</span><div><strong>Zelfstandige HUB</strong><small>De HUB bewaart teamdata centraal in VLACORA/Supabase PostgreSQL.</small></div></div></div><button className="primary wide" onClick={()=>router.push(`/hub/${station.slug}/redactie`)}>Open redactie →</button></Card>
            </div>
            <TodayCollaboration stationName={station.name} onOpenNotifications={collaboration.openNotifications} onOpenPresence={collaboration.openPresence}/>
            <Card><div className="section-head"><div><h3>Uitzendschema</h3><p>Vandaag • {station.name}</p></div><button className="ghost" onClick={()=>router.push(`/hub/${station.slug}/programmering`)}>Open programmering →</button></div><div className="empty-live-state compact"><strong>Bewerkbare programmering</strong><span>Programma&apos;s worden niet meer uit een vaste demo geladen. Beheer ze in Programmering.</span></div></Card>
          </>}

          {hasModuleAccess && moduleSlug === "voor-mij" && <PersonalInboxModule stationSlug={station.slug} />}

          {hasModuleAccess && moduleSlug === "mijn-uitzending" && <PresenterDashboardModule stationSlug={station.slug} />}

          {hasModuleAccess && moduleSlug === "meldingen" && <><NotificationsPage stationSlug={station.slug} /><OperationalWarningsPanel stationSlug={station.slug}/></>}

          {hasModuleAccess && moduleSlug === "stations" && <><div className="page-intro"><div><h2>Stations</h2><p>VLACORA beheert deze zenders zelfstandig, zonder externe radio-engine.</p></div></div><div className="station-grid">{hubStations.filter(s=>s.slug!=="all").map(s=><Card key={s.slug} className="station-card"><div className="station-card-head"><div className="station-logo" style={{background:s.accent}}>{s.short}</div><div><h3>{s.name}</h3><span className="muted">VLACORA station</span></div></div><div className="station-stat"><span>Werkmodus</span><strong>Standalone HUB</strong></div><Link className="primary wide" href={`/hub/${s.slug}/dashboard`}>Open station</Link></Card>)}</div></>}

          {hasModuleAccess && moduleSlug === "taken" && <TasksModule stationSlug={station.slug} />}

          {hasModuleAccess && moduleSlug === "meldpunt" && <IncidentModule stationSlug={station.slug} publishNotification={collaboration.publishNotification} />}

          {hasModuleAccess && moduleSlug === "aanvragen" && <AdminRequestsModule stationSlug={station.slug} />}

          {hasModuleAccess && moduleSlug === "content-inbox" && <ContentInboxModule stationSlug={station.slug} />}

          {hasModuleAccess && moduleSlug === "messenger" && <MessengerModule stationSlug={station.slug} />}

          {hasModuleAccess && moduleSlug === "communicatie" && <CommunicationsModule stationSlug={station.slug} publishNotification={collaboration.publishNotification} />}


          {hasModuleAccess && moduleSlug === "kalender" && <CalendarModule stationSlug={station.slug} />}

          {hasModuleAccess && moduleSlug === "programmering" && <ProgrammingModule stationSlug={station.slug} stationName={station.name} />}

          {hasModuleAccess && moduleSlug === "programmas" && <ProgramPagesModule stationSlug={station.slug} />}

          {hasModuleAccess && moduleSlug === "afwezigheden" && <AbsencesModule stationSlug={station.slug} />}

          {hasModuleAccess && moduleSlug === "contacten" && <ContactsModule stationSlug={station.slug} />}

          {hasModuleAccess && moduleSlug === "sjablonen" && <TemplatesModule stationSlug={station.slug} />}

          {hasModuleAccess && moduleSlug === "muziek" && <MusicLibraryModule stationSlug={station.slug} />}

          {hasModuleAccess && moduleSlug === "muziek-voorstellen" && <MusicProposalsModule stationSlug={station.slug} />}

          {hasModuleAccess && moduleSlug === "meetings" && <MusicMeetingsModule stationSlug={station.slug} />}

          {hasModuleAccess && moduleSlug === "redactie" && <EditorialModule stationSlug={station.slug} />}

          {hasModuleAccess && moduleSlug === "verkeer" && <TrafficModule stationSlug={station.slug} />}

          {hasModuleAccess && moduleSlug === "hitlijsten" && <ChartsModule stationSlug={station.slug} stationName={station.name} />}

          {hasModuleAccess && moduleSlug === "presentatie" && <PresentationModule stationSlug={station.slug} />}

          {hasModuleAccess && moduleSlug === "social" && <SocialStudioModule stationSlug={station.slug} permissions={permissions} />}

          {hasModuleAccess && moduleSlug === "team" && <TeamRightsModule stationSlug={station.slug} />}

          {hasModuleAccess && moduleSlug === "beheer" && <AdminIntegrationsModule stationName={station.name} stationSlug={station.slug} />}
        </div>
      </main>

      <NotificationDrawer />
      <PresencePanel />
      <MandatoryNotificationModal />

      {toast && <div className="toast">{toast}</div>}


      {modal === "announcement" && <Modal title="Officieel bericht publiceren" onClose={()=>setModal(null)}><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);const title=String(f.get("title"));const body=String(f.get("body"));const category=String(f.get("category"));const importance=String(f.get("importance"));const requiresAck=f.get("requiresAck")==="on";setAnnouncements([{id:uid(),title,body,category,importance,read:false,requiresAck},...announcements]);void collaboration.publishNotification({stationSlug:station.slug,title,body,category,severity:importance==="Belangrijk"?"warning":"info",requiresAck,actionPath:`/hub/${station.slug}/communicatie`}).catch(()=>notify("Bericht lokaal opgeslagen; teamnotificatie kon niet worden gedeeld."));setModal(null);notify(requiresAck?"Verplicht bericht gepubliceerd":"Officieel bericht gepubliceerd")}} className="modal-form"><label className="field">Titel<input required name="title" className="input"/></label><label className="field">Categorie<input name="category" className="input" defaultValue="Muziekredactie"/></label><label className="field">Belang<select name="importance" className="select"><option>Normaal</option><option>Belangrijk</option></select></label><label className="field">Bericht<textarea required name="body" className="input textarea"/></label><label className="required-notification-toggle"><input type="checkbox" name="requiresAck"/><div><strong>Moet iedereen gezien hebben</strong><span>De melding blijft verplicht op het scherm tot de gebruiker ze expliciet bevestigt.</span></div></label><button className="primary">Publiceren</button></form></Modal>}





    </div>
  );
}

export default function HubApp(props:Props){
  return <CollaborationProvider stationSlug={props.stationSlug} moduleSlug={props.moduleSlug}>
    <HubAppInner {...props}/>
  </CollaborationProvider>;
}
