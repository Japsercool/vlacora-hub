"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { chart, initialPlaylist, navItems, shows, stations } from "@/lib/mock-data";

type Props = {
  stationSlug: string;
  moduleSlug: string;
};

function Badge({ children, tone = "blue" }: { children: React.ReactNode; tone?: "blue" | "red" | "green" | "orange" | "gray" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export default function HubApp({ stationSlug, moduleSlug }: Props) {
  const station = stations.find((s) => s.slug === stationSlug) || stations[0];
  const [tasks, setTasks] = useState([
    { title: "Playlist woensdag controleren", owner: "Jasper", due: "Vandaag 17:30", status: "Bezig", priority: "Hoog" },
    { title: "Nieuwe muziek voorbereiden", owner: "Muziekredactie", due: "Morgen 09:30", status: "Te doen", priority: "Normaal" },
    { title: "Tune of the Week visual", owner: "Social", due: "Morgen 12:00", status: "Controle", priority: "Normaal" }
  ]);
  const [taskDraft, setTaskDraft] = useState("");
  const [messages, setMessages] = useState([
    { who: "Tibo", text: "Nieuwe tracks voor de meeting staan klaar.", time: "16:20" },
    { who: "Jasper", text: "Top, ik luister ze straks nog even na.", time: "16:24" },
    { who: "Muziekredactie", text: "ANOTR staat voorlopig op 8,2/10.", time: "16:27" }
  ]);
  const [msgDraft, setMsgDraft] = useState("");
  const [playlist, setPlaylist] = useState(initialPlaylist);
  const [selectedChannel, setSelectedChannel] = useState("muziekredactie");
  const [socialArtist, setSocialArtist] = useState("Joel Corry");
  const [socialTitle, setSocialTitle] = useState("Whisper");
  const [socialReady, setSocialReady] = useState(true);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [presenterText, setPresenterText] = useState(
    "Joel Corry is deze week onze Tune of the Week. Dit is Whisper."
  );

  const moduleName = useMemo(() => navItems.find((n) => n[0] === moduleSlug)?.[2] || "Dashboard", [moduleSlug]);

  function movePlaylist(index: number, direction: -1 | 1) {
    const next = [...playlist];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setPlaylist(next);
  }

  function addTask() {
    if (!taskDraft.trim()) return;
    setTasks([{ title: taskDraft.trim(), owner: "Jasper", due: "Geen deadline", status: "Te doen", priority: "Normaal" }, ...tasks]);
    setTaskDraft("");
  }

  function sendMessage() {
    if (!msgDraft.trim()) return;
    setMessages([...messages, { who: "Jasper", text: msgDraft.trim(), time: "nu" }]);
    setMsgDraft("");
  }

  return (
    <div className="hub-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">V</div>
          <div>
            <div className="brand-name">VLACORA</div>
            <div className="brand-sub">HUB</div>
          </div>
        </div>

        <div className="station-mini">
          <span className="station-dot" style={{ background: station.accent }} />
          <div>
            <strong>{station.name}</strong>
            <small>Multi-station workspace</small>
          </div>
        </div>

        <nav className="nav">
          {navItems.map(([slug, icon, label]) => (
            <Link
              key={slug}
              href={`/hub/${station.slug}/${slug}`}
              className={moduleSlug === slug ? "nav-item active" : "nav-item"}
            >
              <span className="nav-icon">{icon}</span>
              <span>{label}</span>
              {slug === "meldpunt" && <span className="nav-count">2</span>}
              {slug === "messenger" && <span className="nav-count">4</span>}
            </Link>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="avatar">JC</div>
          <div>
            <strong>Jasper</strong>
            <small>Superadmin</small>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">VLACORA / {station.name}</div>
            <h1>{moduleName}</h1>
          </div>
          <div className="top-actions">
            <select
              className="select"
              value={station.slug}
              onChange={(e) => window.location.href = `/hub/${e.target.value}/${moduleSlug}`}
            >
              {stations.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
            </select>
            <button className="icon-button">🔔<span className="ping">3</span></button>
            <div className="live-pill"><span /> LIVE</div>
          </div>
        </header>

        <div className="content">
          {moduleSlug === "dashboard" && (
            <>
              <section className="hero">
                <div>
                  <div className="hero-kicker">DINSDAG 1 SEPTEMBER 2026</div>
                  <h2>Goedemorgen, Jasper.</h2>
                  <p>Dit vraagt vandaag aandacht binnen {station.name}.</p>
                </div>
                <div className="hero-now">
                  <span className="tiny">NU ON AIR</span>
                  <strong>HUGEL – Movin&apos; To The Sun</strong>
                  <span>184 luisteraars • Playout online</span>
                </div>
              </section>

              <div className="metric-grid">
                <Card><span className="metric-label">Luisteraars nu</span><strong className="metric">184</strong><span className="positive">+12% vs. gisteren</span></Card>
                <Card><span className="metric-label">Playlistdekking</span><strong className="metric">8 sep</strong><span className="muted">7 dagen vooruit</span></Card>
                <Card><span className="metric-label">Open taken</span><strong className="metric">6</strong><span className="warning">2 vandaag</span></Card>
                <Card><span className="metric-label">Nieuwe muziek</span><strong className="metric">13</strong><span className="muted">te beoordelen</span></Card>
              </div>

              <div className="two-col">
                <Card>
                  <div className="section-head"><div><h3>Vandaag</h3><p>Automatisch samengesteld</p></div><Badge tone="red">1 kritisch</Badge></div>
                  <div className="attention-list">
                    <div className="attention red"><span>!</span><div><strong>Back-up stream niet bevestigd</strong><small>Laatste check 4 minuten geleden</small></div></div>
                    <div className="attention orange"><span>≡</span><div><strong>Playlist woensdag controleren</strong><small>Deadline vandaag 17:30</small></div></div>
                    <div className="attention blue"><span>♫</span><div><strong>13 nieuwe tracks wachten</strong><small>Muziekmeeting morgen 10:00</small></div></div>
                  </div>
                </Card>
                <Card>
                  <div className="section-head"><div><h3>Systeemstatus</h3><p>Realtime overzicht</p></div><Badge tone="green">Gezond</Badge></div>
                  <div className="status-grid">
                    {["Rotation One", "Playout One", "SHOUTcast", "Nieuws", "Reclame", "VLACORA Agent"].map((x, i) => (
                      <div className="status-row" key={x}><span className={`status-light ${i === 4 ? "orange-light" : ""}`} /><strong>{x}</strong><span>{i === 4 ? "Controle" : "Online"}</span></div>
                    ))}
                  </div>
                </Card>
              </div>

              <Card>
                <div className="section-head"><div><h3>Uitzendschema</h3><p>Vandaag • {station.name}</p></div><button className="ghost">Volledig schema →</button></div>
                <div className="show-row">
                  {shows.slice(2).map((show) => (
                    <div className={`show-card ${show.live ? "on-air" : ""}`} key={show.time}>
                      <span className="show-time">{show.time}</span>
                      <div className="show-avatar">{show.host.split(" ").map(x => x[0]).slice(0,2).join("")}</div>
                      <div><strong>{show.name}</strong><small>{show.host}</small></div>
                      <span className="show-end">{show.end}</span>
                      {show.live && <Badge tone="red">ON AIR</Badge>}
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}

          {moduleSlug === "stations" && (
            <div className="station-grid">
              {stations.filter(s => s.slug !== "all").map((s, idx) => (
                <Card key={s.slug} className="station-card">
                  <div className="station-card-head">
                    <div className="station-logo" style={{ background: s.accent }}>{s.short}</div>
                    <div><h3>{s.name}</h3><span className="positive">● ONLINE</span></div>
                  </div>
                  <div className="station-stat"><span>Now playing</span><strong>{idx === 0 ? "HUGEL – Movin' To The Sun" : idx === 1 ? "Calvin Harris – Satisfy" : "Joel Corry – Whisper"}</strong></div>
                  <div className="station-kpis"><span><b>{184 - idx*47}</b> luisteraars</span><span><b>{idx === 2 ? "6 sep" : "8 sep"}</b> playlists</span></div>
                  <Link className="primary wide" href={`/hub/${s.slug}/dashboard`}>Open station</Link>
                </Card>
              ))}
            </div>
          )}

          {moduleSlug === "taken" && (
            <>
              <div className="toolbar">
                <input className="input grow" placeholder="Nieuwe taak..." value={taskDraft} onChange={(e)=>setTaskDraft(e.target.value)} onKeyDown={(e)=>e.key==="Enter" && addTask()} />
                <button className="primary" onClick={addTask}>+ Taak toevoegen</button>
              </div>
              <div className="kanban">
                {["Te doen","Bezig","Controle","Klaar"].map((column) => (
                  <div className="kanban-col" key={column}>
                    <div className="kanban-head"><strong>{column}</strong><span>{tasks.filter(t=>t.status===column).length}</span></div>
                    {tasks.filter(t=>t.status===column).map((task, i)=>(
                      <Card key={i} className="task-card">
                        <Badge tone={task.priority === "Hoog" ? "red" : "gray"}>{task.priority}</Badge>
                        <h3>{task.title}</h3>
                        <p>{task.owner}</p>
                        <small>⏱ {task.due}</small>
                      </Card>
                    ))}
                    {column === "Klaar" && <Card className="task-card done"><h3>Nieuwscontrole 07:00</h3><small>Afgerond om 07:02</small></Card>}
                  </div>
                ))}
              </div>
            </>
          )}

          {moduleSlug === "meldpunt" && (
            <>
              <div className="page-intro">
                <div><h2>Waar gaat je melding over?</h2><p>VLACORA zet je melding automatisch om in een taak bij de juiste verantwoordelijke.</p></div>
                <button className="primary">+ Nieuwe melding</button>
              </div>
              <div className="report-grid">
                {["Programmering","Muziek","Technisch","Vormgeving","Facilities","Afwezigheid","Website / socials","Nieuws","Reclame","Zetta / Rotation One","Tip redactie","Ander"].map((x, i)=>(
                  <button className="report-card" key={x}><span>{["◫","♫","⚙","✦","⌂","♙","◎","▣","▤","⌁","☆","?"][i]}</span><strong>{x}</strong></button>
                ))}
              </div>
              <div className="two-col">
                <Card><h3>Open meldingen</h3><div className="incident"><Badge tone="red">Hoog</Badge><strong>Back-up stream niet bevestigd</strong><span>Technisch • 12 min geleden</span></div><div className="incident"><Badge tone="orange">Normaal</Badge><strong>Song dubbel in uur 18:00</strong><span>Muziek • 26 min geleden</span></div></Card>
                <Card><h3>SLA & verdeling</h3><p className="muted">Techniek: 1 open • Muziek: 1 open • Overig: 0</p><div className="progress"><span style={{width:"72%"}} /></div><small>72% van meldingen vandaag binnen 30 min opgepakt</small></Card>
              </div>
            </>
          )}

          {moduleSlug === "messenger" && (
            <div className="messenger">
              <div className="channels">
                <h3>Messenger</h3>
                <input className="input" placeholder="Zoeken..." />
                {[
                  ["muziekredactie","♫","Muziekredactie","3"],
                  ["techniek","⚙","Techniek","1"],
                  ["versuz-team","◉","Versuz Team",""],
                  ["drive","◫","Drive",""],
                  ["tibo","T","Tibo",""]
                ].map(([id,icon,name,count])=>(
                  <button onClick={()=>setSelectedChannel(id)} className={`channel ${selectedChannel===id?"selected":""}`} key={id}>
                    <span className="channel-avatar">{icon}</span><div><strong>{name}</strong><small>Laatste activiteit zojuist</small></div>{count && <span className="nav-count">{count}</span>}
                  </button>
                ))}
              </div>
              <div className="chat">
                <div className="chat-head"><div><strong>#{selectedChannel}</strong><small>3 leden online</small></div><button className="ghost">⋯</button></div>
                <div className="messages">
                  {messages.map((m,i)=>(
                    <div className={`message ${m.who==="Jasper"?"mine":""}`} key={i}>
                      <div className="avatar small">{m.who.split(" ").map(x=>x[0]).slice(0,2).join("")}</div>
                      <div><div className="message-meta"><strong>{m.who}</strong><span>{m.time}</span></div><p>{m.text}</p></div>
                    </div>
                  ))}
                </div>
                <div className="composer"><button className="ghost">＋</button><input className="input grow" value={msgDraft} onChange={(e)=>setMsgDraft(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&sendMessage()} placeholder="Schrijf een bericht..." /><button className="primary" onClick={sendMessage}>Verstuur</button></div>
              </div>
            </div>
          )}

          {moduleSlug === "communicatie" && (
            <>
              <div className="page-intro"><div><h2>Officiële communicatie</h2><p>Belangrijke zenderinformatie die niet mag verdwijnen in chat.</p></div><button className="primary">+ Bericht publiceren</button></div>
              <Card className="announcement important"><div className="announcement-head"><div><Badge tone="red">BELANGRIJK</Badge><span>Muziekredactie • Versuz Radio</span></div><span>31 aug • 16:40</span></div><h2>Nieuwe muziek vanaf maandag</h2><p>Vanaf maandag gaan Joel Corry – Whisper en ANOTR – Talk To You naar de A-rotatie. Bebe Rexha schuift door naar B.</p><div className="readline"><strong>16 van 19 gelezen</strong><div className="progress"><span style={{width:"84%"}} /></div><button className="ghost">Details →</button></div></Card>
              <Card className="announcement"><div className="announcement-head"><div><Badge tone="blue">PROGRAMMERING</Badge><span>Programmaleiding</span></div><span>31 aug • 10:12</span></div><h2>Aangepast weekendschema</h2><p>Vanaf dit weekend start The Partyroom om 18:00. Het nieuwe schema staat in VLACORA Kalender.</p></Card>
            </>
          )}

          {moduleSlug === "kalender" && (
            <>
              <div className="calendar-head"><div><button className="ghost">‹</button><button className="ghost">›</button><button className="primary soft">Vandaag</button><h2>31 aug – 6 september 2026</h2></div><div><button className="ghost">Dag</button><button className="primary soft">Week</button><button className="ghost">Maand</button></div></div>
              <Card className="calendar-card">
                <div className="week-head"><div></div>{["ma 31","di 1","wo 2","do 3","vr 4","za 5","zo 6"].map(d=><div key={d}>{d}</div>)}</div>
                <div className="week-body">
                  <div className="hours">{["08:00","10:00","12:00","14:00","16:00","18:00","20:00"].map(x=><span key={x}>{x}</span>)}</div>
                  <div className="week-grid">
                    <div className="cal-event purple" style={{gridColumn:"2",gridRow:"2"}}><strong>Muziekmeeting</strong><small>10:00 – 11:30</small></div>
                    <div className="cal-event red" style={{gridColumn:"1",gridRow:"5"}}><strong>Drive</strong><small>16:00 – 18:00</small></div>
                    <div className="cal-event green" style={{gridColumn:"5",gridRow:"4"}}><strong>Top 50 deadline</strong><small>14:00</small></div>
                    <div className="cal-event orange" style={{gridColumn:"3",gridRow:"3"}}><strong>Studio onderhoud</strong><small>12:00</small></div>
                  </div>
                </div>
              </Card>
            </>
          )}

          {moduleSlug === "programmering" && (
            <>
              <div className="day-tabs">{["Ma 31","Di 1","Wo 2","Do 3","Vr 4","Za 5","Zo 6"].map((d,i)=><button className={i===0?"active":""} key={d}>{d}</button>)}</div>
              <div className="schedule-list">
                {shows.map(show=>(
                  <Card className={`schedule-item ${show.live?"live-item":""}`} key={show.time}>
                    <div className="time-line"><strong>{show.time}</strong><span /></div>
                    <div className="show-avatar large">{show.host.split(" ").map(x=>x[0]).slice(0,2).join("")}</div>
                    <div className="schedule-info"><h3>{show.name} {show.live && <Badge tone="red">ON AIR</Badge>}</h3><p>{show.host}</p></div>
                    <span className="muted">{show.time} – {show.end}</span>
                  </Card>
                ))}
              </div>
            </>
          )}

          {moduleSlug === "muziek" && (
            <>
              <div className="page-intro"><div><h2>Nieuwe muziek inbox</h2><p>13 tracks wachten op beoordeling.</p></div><button className="primary">+ Track toevoegen</button></div>
              <div className="music-grid">
                {[
                  ["ANOTR & 54 Ultra","Talk To You","Dance","05/09/2026"],
                  ["Bebe Rexha","New Religion","Pop / Dance","04/09/2026"],
                  ["Joel Corry","Whisper","Dance","28/08/2026"],
                  ["Topic & Becky G","Sorry Papi","Dance Pop","28/08/2026"]
                ].map(([artist,title,genre,date],i)=>{
                  const key = `${artist}-${title}`;
                  return <Card className="music-card" key={key}>
                    <div className={`cover cover-${i+1}`}>♫</div>
                    <div className="music-info"><Badge tone="blue">Te bespreken</Badge><h3>{artist}</h3><p>{title}</p><small>{genre} • release {date}</small>
                    <div className="vote-row"><span>Jouw score:</span>{[6,7,8,9,10].map(n=><button onClick={()=>setVotes({...votes,[key]:n})} className={votes[key]===n?"vote selected": "vote"} key={n}>{n}</button>)}</div></div>
                    <button className="ghost">▶ Preview</button>
                  </Card>
                })}
              </div>
            </>
          )}

          {moduleSlug === "meetings" && (
            <div className="meeting-layout">
              <Card className="meeting-summary"><Badge tone="blue">Live</Badge><h2>Nieuwe muziek • Week 36</h2><p>Dinsdag 1 september • 10:00 – 11:30</p><div className="meeting-kpis"><span><b>18</b> tracks</span><span><b>7</b> beoordeeld</span><span><b>4</b> deelnemers</span></div><button className="primary wide">Meeting starten</button></Card>
              <Card className="meeting-main">
                <div className="section-head"><div><span className="eyebrow">07 / 18</span><h2>ANOTR & 54 Ultra – Talk To You</h2></div><button className="primary soft">▶ Beluister</button></div>
                <div className="score-big">8,2<small>/10 teamgemiddelde</small></div>
                <div className="decision-grid">
                  {["A-hit","B-hit","C-hit","Testen","Later","Afwijzen"].map((x,i)=><button className={`decision d${i}`} key={x}>{x}</button>)}
                </div>
                <label className="field">Notitie<textarea className="input textarea" defaultValue="Sterke opener, goede daytime fit. Testen op A-rotatie vanaf maandag." /></label>
                <button className="primary">Beslissing opslaan & volgende →</button>
              </Card>
            </div>
          )}

          {moduleSlug === "playlists" && (
            <>
              <div className="page-intro"><div><h2>Rotation One playlists</h2><p>Demo-modus • wijzigingen worden nog niet naar Rotation One gestuurd.</p></div><div className="button-row"><button className="ghost">↻ Synchroniseer</button><button className="primary">Opslaan</button></div></div>
              <div className="playlist-layout">
                <Card className="playlist-timeline">
                  <div className="playlist-head"><div><h3>Dinsdag 1 september • 16:00</h3><span className="positive">● Export klaar</span></div><Badge tone="green">Versie 19</Badge></div>
                  {playlist.map((item,i)=>(
                    <div className={`playlist-item ${item.includes("Commercial")||item.includes("News")?"special":""}`} key={`${item}-${i}`}>
                      <span className="drag">⋮⋮</span><span className="playlist-time">{`16:${String(i*4).padStart(2,"0")}`}</span>
                      <div><strong>{item}</strong><small>{item.includes("Commercial")?"Traffic":item.includes("Sweeper")||item.includes("TOTH")||item.includes("Station")?"Imaging":"Music"}</small></div>
                      <div className="item-actions"><button onClick={()=>movePlaylist(i,-1)} className="mini-btn">↑</button><button onClick={()=>movePlaylist(i,1)} className="mini-btn">↓</button><button onClick={()=>setPlaylist(playlist.filter((_,x)=>x!==i))} className="mini-btn danger">×</button></div>
                    </div>
                  ))}
                </Card>
                <Card className="inspector"><h3>Playlist inspector</h3><p className="muted">Selecteer later een item voor mixpunten, songhistorie en presentatieteksten.</p><div className="inspector-box"><span>Rotation One</span><strong>verbinding simulatie</strong><Badge tone="orange">DEMO</Badge></div><button className="primary wide">+ Item toevoegen</button></Card>
              </div>
            </>
          )}

          {moduleSlug === "hitlijsten" && (
            <>
              <div className="page-intro"><div><h2>Versuz TOP 50</h2><p>Week 36 • concepteditie</p></div><div className="button-row"><button className="ghost">Historiek</button><button className="primary">Publiceren</button></div></div>
              <div className="metric-grid compact">
                <Card><span className="metric-label">Nieuwe binnenkomers</span><strong className="metric">4</strong></Card>
                <Card><span className="metric-label">Grootste stijger</span><strong className="metric">▲ 12</strong></Card>
                <Card><span className="metric-label">Grootste daler</span><strong className="metric">▼ 9</strong></Card>
                <Card><span className="metric-label">Langst genoteerd</span><strong className="metric">16 wk</strong></Card>
              </div>
              <Card className="table-card"><table><thead><tr><th>#</th><th>Vorige</th><th>Artiest</th><th>Titel</th><th>Trend</th><th>Weken</th><th>Peak</th></tr></thead><tbody>{chart.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j} className={j===4?(String(c).includes("▲")?"positive":String(c).includes("▼")?"negative":""):""}>{c}</td>)}</tr>)}</tbody></table></Card>
            </>
          )}

          {moduleSlug === "presentatie" && (
            <div className="presenter-layout">
              <Card><div className="cover big cover-3">♫</div><Badge tone="blue">TUNE OF THE WEEK</Badge><h2>Joel Corry</h2><p className="song-title">Whisper</p><div className="song-meta"><span>BPM 126</span><span>Dance</span><span>Release 28/08</span></div><button className="primary wide">▶ Beluister fragment</button></Card>
              <Card><div className="section-head"><div><h3>Presentatietekst</h3><p>Zichtbaar voor presentatoren</p></div><button className="ghost" onClick={()=>setPresenterText("Nieuwe muziek op Versuz Radio: Joel Corry met Whisper, onze Tune of the Week.")}>✨ AI-variant</button></div><textarea className="input presenter-editor" value={presenterText} onChange={(e)=>setPresenterText(e.target.value)} /><div className="editor-actions"><span className="muted">{presenterText.length} tekens</span><button className="primary">Opslaan</button></div><hr/><h3>Redactienotities</h3><p className="note">Niet benoemen als zijn eerste samenwerking. De track gaat maandag naar A-rotatie.</p></Card>
            </div>
          )}

          {moduleSlug === "social" && (
            <>
              <div className="page-intro"><div><h2>Social Studio</h2><p>Maak stationvisuals vanuit vaste templates.</p></div><Badge tone="orange">DEMO renderer</Badge></div>
              <div className="social-layout">
                <Card className="social-form"><label className="field">Template<select className="select"><option>Tune of the Week</option><option>Nieuwe #1</option><option>Grootste stijger</option><option>Now On Air</option></select></label><label className="field">Artiest<input className="input" value={socialArtist} onChange={(e)=>setSocialArtist(e.target.value)} /></label><label className="field">Titel<input className="input" value={socialTitle} onChange={(e)=>setSocialTitle(e.target.value)} /></label><label className="field">Formaat<select className="select"><option>Instagram 1080×1350</option><option>Story 1080×1920</option><option>Facebook post</option></select></label><button className="primary wide" onClick={()=>setSocialReady(true)}>✦ Visual genereren</button></Card>
                <div className="social-preview-wrap">
                  {socialReady && <div className="social-preview"><div className="social-brand">VLACORA<span>radio</span></div><div className="social-label">TUNE OF THE WEEK</div><div className="social-art">♫</div><h2>{socialArtist}</h2><h3>{socialTitle}</h3><div className="social-bottom">THIS WEEK • ON AIR</div></div>}
                  <div className="button-row center"><button className="ghost">Download PNG</button><button className="primary">Naar Social Planner</button></div>
                </div>
              </div>
            </>
          )}

          {moduleSlug === "statistieken" && (
            <>
              <div className="metric-grid">
                <Card><span className="metric-label">Nu</span><strong className="metric">184</strong><span className="positive">+12%</span></Card>
                <Card><span className="metric-label">Piek vandaag</span><strong className="metric">291</strong><span className="muted">16:21</span></Card>
                <Card><span className="metric-label">Gemiddeld</span><strong className="metric">153</strong><span className="muted">vandaag</span></Card>
                <Card><span className="metric-label">Luistertijd</span><strong className="metric">31m</strong><span className="positive">+4m</span></Card>
              </div>
              <Card><div className="section-head"><div><h3>Listeners vandaag</h3><p>Per uur</p></div><select className="select"><option>Vandaag</option><option>7 dagen</option><option>30 dagen</option></select></div><div className="bar-chart">{[48,55,62,76,74,90,88,98,83,71,92,100,84,67].map((h,i)=><div className="bar-wrap" key={i}><div className="bar" style={{height:`${h}%`}} /><span>{i+7}</span></div>)}</div></Card>
              <div className="two-col"><Card><h3>Beste programma&apos;s</h3>{["Drive","Morning Club","The Partyroom"].map((x,i)=><div className="rank-row" key={x}><span>{i+1}</span><strong>{x}</strong><b>{244-i*31}</b></div>)}</Card><Card><h3>Techniek</h3><div className="status-row"><span className="status-light"/><strong>Stream uptime</strong><span>99,98%</span></div><div className="status-row"><span className="status-light"/><strong>Encoder</strong><span>192 kbps</span></div><div className="status-row"><span className="status-light"/><strong>Reconnects</strong><span>1 vandaag</span></div></Card></div>
            </>
          )}

          {moduleSlug === "control" && (
            <>
              <div className="page-intro"><div><h2>On-Air Control Center</h2><p>Alle stations, systemen en waarschuwingen op één scherm.</p></div><button className="ghost">↻ Alles verversen</button></div>
              <Card className="table-card"><table><thead><tr><th>Station</th><th>Playout</th><th>Rotation</th><th>Stream</th><th>Playlists</th><th>Nieuws</th><th>Listeners</th></tr></thead><tbody>
                <tr><td><b>Versuz Radio</b></td><td><Badge tone="green">Online</Badge></td><td><Badge tone="green">Online</Badge></td><td><Badge tone="green">Online</Badge></td><td>8 sep</td><td>✓ 08:00</td><td><b>184</b></td></tr>
                <tr><td><b>Club FM</b></td><td><Badge tone="green">Online</Badge></td><td><Badge tone="green">Online</Badge></td><td><Badge tone="green">Online</Badge></td><td>7 sep</td><td>✓ 08:00</td><td><b>137</b></td></tr>
                <tr><td><b>Vlacora One</b></td><td><Badge tone="red">Offline</Badge></td><td><Badge tone="green">Online</Badge></td><td><Badge tone="red">Offline</Badge></td><td>5 sep</td><td>⚠ ontbreekt</td><td><b>0</b></td></tr>
              </tbody></table></Card>
              <Card><h3>Recente systeemevents</h3>{["07:43 • Rotation One export klaar","07:42 • Playlist Versuz 08:00 gesynchroniseerd","07:41 • Vlacora One encoder offline","07:40 • Listener snapshot opgeslagen"].map((x,i)=><div className="logline" key={i}><span className={i===2?"logdot red-dot":"logdot"}/>{x}</div>)}</Card>
            </>
          )}

          {moduleSlug === "team" && (
            <>
              <div className="page-intro"><div><h2>Team & rechten</h2><p>Rollen kunnen per station verschillen.</p></div><button className="primary">+ Gebruiker uitnodigen</button></div>
              <div className="team-grid">{[
                ["Jasper Cool","Superadmin","JC","Versuz • Club FM • Vlacora One"],
                ["Tibo Vanhee","Muziekredactie","TV","Versuz"],
                ["Bram","Presentator","BR","Versuz"],
                ["Wouter","Presentator","WD","Versuz"],
                ["Sarah","Social & Marketing","SA","Versuz • Club FM"],
                ["Techniek","Techniek","IT","Alle zenders"]
              ].map(([name,role,initials,scope])=><Card className="team-card" key={name}><div className="avatar large">{initials}</div><div><h3>{name}</h3><Badge tone="blue">{role}</Badge><p>{scope}</p></div><button className="ghost">Beheer</button></Card>)}</div>
            </>
          )}

          {moduleSlug === "beheer" && (
            <div className="settings-grid">
              <Card><h3>Stationinstellingen</h3><label className="field">Naam<input className="input" defaultValue={station.name}/></label><label className="field">Tijdzone<select className="select"><option>Europe/Brussels</option></select></label><label className="toggle-row"><div><strong>Actief station</strong><small>Toon in VLACORA</small></div><input type="checkbox" defaultChecked /></label><button className="primary">Opslaan</button></Card>
              <Card><h3>Integraties</h3>{[["Rotation One","Later koppelen"],["Playout One","Later koppelen"],["SHOUTcast","Later koppelen"],["Supabase","Nog niet verbonden"]].map(([x,s])=><div className="integration" key={x}><div><strong>{x}</strong><small>{s}</small></div><Badge tone="orange">DEMO</Badge></div>)}</Card>
              <Card><h3>Automatisering</h3><label className="toggle-row"><div><strong>Playlistwaarschuwingen</strong><small>Waarschuw onder 48 uur dekking</small></div><input type="checkbox" defaultChecked /></label><label className="toggle-row"><div><strong>Nieuwscontrole</strong><small>Maak taak als nieuws ontbreekt</small></div><input type="checkbox" defaultChecked /></label><label className="toggle-row"><div><strong>Social reminders</strong><small>Waarschuw bij niet-goedgekeurde posts</small></div><input type="checkbox" defaultChecked /></label></Card>
            </div>
          )}

          {!navItems.some(n=>n[0]===moduleSlug) && <Card><h2>Module niet gevonden</h2><p>Gebruik de navigatie links.</p></Card>}
        </div>
      </main>
    </div>
  );
}
