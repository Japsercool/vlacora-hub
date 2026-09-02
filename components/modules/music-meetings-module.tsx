"use client";

import { useCallback,useEffect,useMemo,useState } from "react";
import {
  addMusicMeetingTracks,createMusicMeeting,deleteMusicMeeting,loadMusicMeetingReviews,loadMusicMeetingTracks,loadMusicMeetings,
  removeMusicMeetingTrack,saveMyMusicMeetingReview,updateMusicMeeting,updateMusicMeetingTrack,
  type MusicMeeting,type MusicMeetingReview,type MusicMeetingTrack
} from "@/lib/supabase/music-meetings";
import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import { pathFor,pathForFolder,radioRead,readIntegration,readMappings } from "@/lib/radio/client-config";
import { useHubStation } from "@/lib/radio/hub-stations";
import { emitActivity } from "@/lib/collaboration/activity";

type LiveFolder={id:string;name:string;count?:number};
type LiveSong={id:string;artist:string;title:string;category?:string;year?:string;audioUrl?:string};
type AddMode="rotation"|"manual";
const decisions=["A-hit","B-hit","C-hit","Testen","Later","Afwijzen"];

function localInput(iso:string|null){
  if(!iso)return"";const d=new Date(iso);if(Number.isNaN(d.getTime()))return"";
  const p=(n:number)=>String(n).padStart(2,"0");
  return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fromLocal(value:string){return value?new Date(value).toISOString():null}
function when(meeting:MusicMeeting){if(!meeting.scheduledAt)return"Nog niet ingepland";const s=new Date(meeting.scheduledAt);const e=meeting.endsAt?new Date(meeting.endsAt):null;return`${s.toLocaleDateString("nl-BE",{weekday:"long",day:"numeric",month:"long"})} • ${s.toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit"})}${e?` – ${e.toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit"})}`:""}`}
function avg(reviews:MusicMeetingReview[]){const vals=reviews.map(r=>r.score).filter((x):x is number=>x!=null);return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null}

export default function MusicMeetingsModule({stationSlug}:{stationSlug:string}){
  const station=useHubStation(stationSlug);
  const configured=isSupabaseBrowserConfigured();
  const[meetings,setMeetings]=useState<MusicMeeting[]>([]);
  const[selectedMeetingId,setSelectedMeetingId]=useState("");
  const[tracks,setTracks]=useState<MusicMeetingTrack[]>([]);
  const[selectedTrackId,setSelectedTrackId]=useState("");
  const[reviews,setReviews]=useState<MusicMeetingReview[]>([]);
  const[notice,setNotice]=useState("");
  const[busy,setBusy]=useState(false);
  const[showNewMeeting,setShowNewMeeting]=useState(false);
  const[showAdd,setShowAdd]=useState(false);
  const[addMode,setAddMode]=useState<AddMode>("rotation");
  const[newMeeting,setNewMeeting]=useState({title:"Nieuwe muziek",start:"",end:"",notes:""});
  const[manual,setManual]=useState({artist:"",title:"",category:"",audioUrl:""});
  const[folders,setFolders]=useState<LiveFolder[]>([]);
  const[selectedFolder,setSelectedFolder]=useState("");
  const[liveSongs,setLiveSongs]=useState<LiveSong[]>([]);
  const[rotationBusy,setRotationBusy]=useState(false);
  const[score,setScore]=useState("");
  const[decision,setDecision]=useState("");
  const[note,setNote]=useState("");

  const meeting=meetings.find(m=>m.id===selectedMeetingId)||null;
  const track=tracks.find(t=>t.id===selectedTrackId)||tracks[0]||null;
  const mapping=readMappings()[stationSlug];
  const rotationId=mapping?.rotationId||station.rotationId||"";

  function flash(message:string){setNotice(message);window.setTimeout(()=>setNotice(""),3000)}

  const loadMeetings=useCallback(async()=>{
    if(!configured)return;
    try{
      const rows=await loadMusicMeetings(stationSlug);setMeetings(rows);
      setSelectedMeetingId(id=>rows.some(m=>m.id===id)?id:rows[0]?.id||"");
    }catch(e){flash(e instanceof Error?e.message:"Meetings laden mislukt")}
  },[configured,stationSlug]);

  const loadTracks=useCallback(async(id:string)=>{
    if(!id){setTracks([]);setSelectedTrackId("");return}
    try{
      const rows=await loadMusicMeetingTracks(id);setTracks(rows);
      setSelectedTrackId(current=>rows.some(x=>x.id===current)?current:rows[0]?.id||"");
    }catch(e){flash(e instanceof Error?e.message:"Songs laden mislukt")}
  },[]);

  useEffect(()=>{void loadMeetings()},[loadMeetings]);
  useEffect(()=>{void loadTracks(selectedMeetingId)},[selectedMeetingId,loadTracks]);
  useEffect(()=>{
    if(!track){setReviews([]);setScore("");setDecision("");setNote("");return}
    emitActivity({detail:`Muziekmeeting • ${track.artist} – ${track.title}`,entityType:"meeting-track",entityId:track.id});
    let alive=true;
    void loadMusicMeetingReviews(track.id).then(rows=>{
      if(!alive)return;setReviews(rows);
      void createClient().auth.getUser().then(({data})=>{
        const mine=rows.find(r=>r.userId===data.user?.id);
        if(mine){setScore(mine.score==null?"":String(mine.score));setDecision(mine.decision);setNote(mine.note)}
        else{setScore("");setDecision(track.decision||"");setNote(track.note||"")}
      });
    }).catch(()=>{});
    return()=>{alive=false};
  },[track?.id]);

  useEffect(()=>{
    if(!configured)return;
    const supabase=createClient();
    const channel=supabase.channel(`music-meetings-${stationSlug}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"hub_music_meetings"},()=>void loadMeetings())
      .on("postgres_changes",{event:"*",schema:"public",table:"hub_music_meeting_tracks"},(payload:any)=>{
        const row=payload.new||payload.old;if(String(row?.meeting_id||"")===selectedMeetingId)void loadTracks(selectedMeetingId);
      }).subscribe();
    return()=>{void supabase.removeChannel(channel)};
  },[configured,stationSlug,selectedMeetingId,loadMeetings,loadTracks]);

  async function createMeeting(){
    if(!newMeeting.title.trim())return flash("Geef de meeting een naam.");
    setBusy(true);
    try{
      const row=await createMusicMeeting({stationSlug,title:newMeeting.title,scheduledAt:fromLocal(newMeeting.start),endsAt:fromLocal(newMeeting.end),notes:newMeeting.notes});
      setMeetings(current=>[row,...current]);setSelectedMeetingId(row.id);setShowNewMeeting(false);setNewMeeting({title:"Nieuwe muziek",start:"",end:"",notes:""});flash("Meeting aangemaakt");
    }catch(e){flash(e instanceof Error?e.message:"Meeting aanmaken mislukt")}
    finally{setBusy(false)}
  }

  async function setMeetingStatus(status:MusicMeeting["status"]){
    if(!meeting)return;
    try{const saved=await updateMusicMeeting(meeting,{status});setMeetings(rows=>rows.map(x=>x.id===saved.id?saved:x));flash(status==="active"?"Meeting gestart":status==="paused"?"Meeting gepauzeerd":status==="closed"?"Meeting afgesloten":"Meeting gepland")}catch(e){flash(e instanceof Error?e.message:"Status wijzigen mislukt")}
  }

  async function removeMeeting(){
    if(!meeting||!confirm(`Meeting “${meeting.title}” en alle songs verwijderen?`))return;
    try{await deleteMusicMeeting(meeting.id);setSelectedMeetingId("");setTracks([]);await loadMeetings();flash("Meeting verwijderd")}catch(e){flash(e instanceof Error?e.message:"Meeting verwijderen mislukt")}
  }

  async function loadFolders(){
    const cfg=readIntegration("rotation");if(!cfg?.host)return flash("Rotation One is niet ingesteld.");if(!rotationId)return flash("Dit station is nog niet aan Rotation One gekoppeld.");if(!cfg.musicFoldersPath)return flash("Muziekmappen endpoint ontbreekt.");
    setRotationBusy(true);
    try{
      const data=await radioRead("rotation",pathFor(cfg.musicFoldersPath,rotationId),"folders");const rows=data.folders||[];setFolders(rows);
      if(rows[0]){setSelectedFolder(rows[0].id);await loadFolderSongs(rows[0].id)}
      flash(`${rows.length} Rotation One-mappen geladen`);
    }catch(e){flash(e instanceof Error?e.message:"Mappen laden mislukt")}
    finally{setRotationBusy(false)}
  }
  async function loadFolderSongs(folderId:string){
    const cfg=readIntegration("rotation");if(!cfg?.musicFolderItemsPath||!rotationId)return;
    setRotationBusy(true);
    try{const data=await radioRead("rotation",pathForFolder(cfg.musicFolderItemsPath,rotationId,folderId),"songs");setLiveSongs(data.songs||[])}
    catch(e){setLiveSongs([]);flash(e instanceof Error?e.message:"Songs laden mislukt")}
    finally{setRotationBusy(false)}
  }
  async function addRotationSong(song:LiveSong){
    if(!meeting)return flash("Kies eerst een meeting.");
    const folder=folders.find(f=>f.id===selectedFolder);
    try{
      const added=await addMusicMeetingTracks(meeting.id,[{source:"rotation",sourceSongId:song.id,artist:song.artist,title:song.title,category:song.category||"",rotationFolder:folder?.name||"",audioUrl:song.audioUrl||""}]);
      setTracks(rows=>[...rows,...added]);setSelectedTrackId(added[0]?.id||selectedTrackId);flash(`${song.artist} – ${song.title} toegevoegd`);
    }catch(e){flash(e instanceof Error?e.message:"Song toevoegen mislukt")}
  }
  async function addManualSong(){
    if(!meeting)return flash("Kies eerst een meeting.");if(!manual.title.trim())return flash("Geef een titel in.");
    try{
      const added=await addMusicMeetingTracks(meeting.id,[{source:"manual",artist:manual.artist,title:manual.title,category:manual.category,audioUrl:manual.audioUrl}]);
      setTracks(rows=>[...rows,...added]);setSelectedTrackId(added[0]?.id||"");setManual({artist:"",title:"",category:"",audioUrl:""});flash("Song toegevoegd");
    }catch(e){flash(e instanceof Error?e.message:"Song toevoegen mislukt")}
  }

  async function saveReviewAndNext(){
    if(!track)return;const n=score.trim()===""?null:Number(score);if(n!=null&&(n<0||n>10))return flash("Score moet tussen 0 en 10 liggen.");
    try{
      await saveMyMusicMeetingReview(track.id,n,decision,note);
      const updated=await updateMusicMeetingTrack(track,{decision,note});
      setTracks(rows=>rows.map(x=>x.id===updated.id?updated:x));
      setReviews(await loadMusicMeetingReviews(track.id));
      const i=tracks.findIndex(x=>x.id===track.id);const next=tracks[i+1];if(next)setSelectedTrackId(next.id);
      flash("Beoordeling opgeslagen");
    }catch(e){flash(e instanceof Error?e.message:"Beoordeling opslaan mislukt")}
  }
  async function removeTrack(){
    if(!track||!confirm(`“${track.artist} – ${track.title}” uit deze meeting verwijderen?`))return;
    try{await removeMusicMeetingTrack(track.id);await loadTracks(selectedMeetingId);flash("Song verwijderd")}catch(e){flash(e instanceof Error?e.message:"Song verwijderen mislukt")}
  }
  async function moveTrack(delta:-1|1){
    if(!track)return;const i=tracks.findIndex(x=>x.id===track.id),other=tracks[i+delta];if(!other)return;
    try{
      await Promise.all([updateMusicMeetingTrack(track,{position:other.position}),updateMusicMeetingTrack(other,{position:track.position})]);
      const next=[...tracks];[next[i],next[i+delta]]=[next[i+delta],next[i]];setTracks(next);
    }catch(e){flash(e instanceof Error?e.message:"Volgorde wijzigen mislukt")}
  }

  const reviewed=tracks.filter(t=>t.decision).length;
  const teamAverage=avg(reviews);

  if(!configured)return <div className="card empty-live-state"><strong>Supabase nodig</strong><span>Muziekmeetings worden centraal per station bewaard.</span></div>;

  return <div className="music-meeting-v182">
    <div className="page-intro meeting-page-head">
      <div><span className="eyebrow">MUZIEKREDACTIE</span><h2>Muziekmeetings</h2><p>Selecteer een meeting, voeg songs toe en beoordeel ze samen.</p></div>
      <div className="button-row"><button className="ghost" onClick={()=>setShowNewMeeting(v=>!v)}>＋ Nieuwe meeting</button><button className="primary" disabled={!meeting} onClick={()=>setShowAdd(v=>!v)}>＋ Songs toevoegen</button></div>
    </div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}

    {showNewMeeting&&<div className="card meeting-create-card">
      <div className="section-head"><div><h3>Nieuwe muziekmeeting</h3><p>Maak zoveel meetings als je nodig hebt.</p></div><button className="mini-btn" onClick={()=>setShowNewMeeting(false)}>×</button></div>
      <div className="meeting-create-grid"><label className="field">Naam<input className="input" value={newMeeting.title} onChange={e=>setNewMeeting({...newMeeting,title:e.target.value})} placeholder="bv. Nieuwe muziek • Week 37"/></label><label className="field">Start<input className="input" type="datetime-local" value={newMeeting.start} onChange={e=>setNewMeeting({...newMeeting,start:e.target.value})}/></label><label className="field">Einde<input className="input" type="datetime-local" value={newMeeting.end} onChange={e=>setNewMeeting({...newMeeting,end:e.target.value})}/></label><label className="field meeting-notes-create">Notitie<input className="input" value={newMeeting.notes} onChange={e=>setNewMeeting({...newMeeting,notes:e.target.value})}/></label></div>
      <button className="primary" disabled={busy} onClick={()=>void createMeeting()}>Meeting aanmaken</button>
    </div>}

    <div className="meeting-selector-bar">
      <label><span>Meeting</span><select value={selectedMeetingId} onChange={e=>setSelectedMeetingId(e.target.value)}><option value="">Kies een meeting…</option>{meetings.map(m=><option key={m.id} value={m.id}>{m.title} • {m.scheduledAt?new Date(m.scheduledAt).toLocaleDateString("nl-BE"):"geen datum"}</option>)}</select></label>
      <button className="ghost" onClick={()=>void loadMeetings()}>↻ Vernieuw</button>
    </div>

    {!meeting?<div className="card empty-live-state"><strong>Nog geen meeting geselecteerd</strong><span>Kies hierboven een bestaande meeting of maak er één aan.</span></div>:<>
      {showAdd&&<div className="card meeting-add-songs">
        <div className="section-head"><div><h3>Songs toevoegen aan {meeting.title}</h3><p>Handmatig of rechtstreeks uit de echte Rotation One-muziekmappen.</p></div><button className="mini-btn" onClick={()=>setShowAdd(false)}>×</button></div>
        <div className="source-tabs"><button className={addMode==="rotation"?"active":""} onClick={()=>setAddMode("rotation")}>Rotation One</button><button className={addMode==="manual"?"active":""} onClick={()=>setAddMode("manual")}>Handmatig</button></div>
        {addMode==="manual"?<div className="meeting-manual-add"><label className="field">Artiest<input className="input" value={manual.artist} onChange={e=>setManual({...manual,artist:e.target.value})}/></label><label className="field">Titel<input className="input" value={manual.title} onChange={e=>setManual({...manual,title:e.target.value})}/></label><label className="field">Categorie<input className="input" value={manual.category} onChange={e=>setManual({...manual,category:e.target.value})}/></label><label className="field">Preview/audio URL<input className="input" value={manual.audioUrl} onChange={e=>setManual({...manual,audioUrl:e.target.value})} placeholder="optioneel"/></label><button className="primary" onClick={()=>void addManualSong()}>Song toevoegen</button></div>
        :<div className="meeting-rotation-add">
          <div className="meeting-folder-picker"><label className="field">Rotation One-map<select className="select" value={selectedFolder} onChange={e=>{setSelectedFolder(e.target.value);void loadFolderSongs(e.target.value)}}><option value="">Kies map…</option>{folders.map(f=><option key={f.id} value={f.id}>{f.name}{f.count!=null?` • ${f.count}`:""}</option>)}</select></label><button className="ghost" disabled={rotationBusy} onClick={()=>void loadFolders()}>↻ Mappen ophalen</button></div>
          {!folders.length?<div className="empty-live-state compact"><strong>Haal eerst de Rotation One-mappen op</strong><span>Daarna kun je per song met één klik “Toevoegen” kiezen.</span></div>:<div className="meeting-song-picker">{liveSongs.map(song=><div key={song.id} className="meeting-song-option"><div><strong>{song.artist||"—"}</strong><span>{song.title}</span><small>{song.category||folders.find(f=>f.id===selectedFolder)?.name||""}</small></div><button className="mini-btn" onClick={()=>void addRotationSong(song)}>＋ Toevoegen</button></div>)}</div>}
        </div>}
      </div>}

      <div className="meeting-workspace-v182">
        <aside className="card meeting-sidebar-v182">
          <span className={`meeting-status-pill ${meeting.status}`}>{meeting.status==="active"?"BEZIG":meeting.status==="paused"?"GEPAUZEERD":meeting.status==="closed"?"AFGESLOTEN":"GEPLAND"}</span>
          <h2>{meeting.title}</h2><p>{when(meeting)}</p>
          <div className="meeting-kpis"><span><b>{tracks.length}</b> tracks</span><span><b>{reviewed}</b> beoordeeld</span><span><b>{Math.max(0,tracks.length-reviewed)}</b> te gaan</span></div>
          <div className="meeting-status-actions">{meeting.status!=="active"&&<button className="primary wide" onClick={()=>void setMeetingStatus("active")}>▶ Meeting starten</button>}{meeting.status==="active"&&<button className="ghost wide" onClick={()=>void setMeetingStatus("paused")}>Ⅱ Pauzeren</button>}{meeting.status!=="closed"&&<button className="ghost wide" onClick={()=>void setMeetingStatus("closed")}>✓ Afsluiten</button>}</div>
          <div className="meeting-track-list">{tracks.map((item,i)=><button key={item.id} className={selectedTrackId===item.id?"selected":""} onClick={()=>setSelectedTrackId(item.id)}><span>{String(i+1).padStart(2,"0")}</span><div><strong>{item.artist||"—"}</strong><small>{item.title}</small></div>{item.decision&&<b>{item.decision}</b>}</button>)}</div>
          {!tracks.length&&<div className="empty-live-state compact"><strong>Nog geen songs</strong><span>Klik bovenaan op “Songs toevoegen”.</span></div>}
          <button className="ghost danger-text wide" onClick={()=>void removeMeeting()}>Verwijder meeting</button>
        </aside>

        <main className="card meeting-main-v182">
          {!track?<div className="empty-live-state"><strong>Voeg een song toe</strong><span>Je meeting is klaar. Voeg nu songs toe uit Rotation One of handmatig.</span></div>:<>
            <div className="section-head"><div><span className="eyebrow">{String(tracks.findIndex(x=>x.id===track.id)+1).padStart(2,"0")} / {tracks.length}</span><h2>{track.artist} – {track.title}</h2><p>{track.rotationFolder||track.category||track.source}</p></div><div className="button-row">{track.audioUrl&&<button className="primary soft" onClick={()=>window.open(track.audioUrl,"_blank")}>▶ Beluister</button>}<button className="mini-btn" onClick={()=>void moveTrack(-1)}>↑</button><button className="mini-btn" onClick={()=>void moveTrack(1)}>↓</button></div></div>
            <div className="meeting-score-row"><div className="score-big">{teamAverage==null?"—":teamAverage.toFixed(1).replace(".",",")}<small>/10 teamgemiddelde</small></div><label className="field meeting-own-score">Mijn score<input className="input" type="number" min="0" max="10" step=".1" value={score} onChange={e=>setScore(e.target.value)} placeholder="0–10"/></label></div>
            <div className="decision-grid">{decisions.map((x,i)=><button className={`decision d${i} ${decision===x?"selected-decision":""}`} onClick={()=>setDecision(x)} key={x}>{x}</button>)}</div>
            <label className="field">Notitie<textarea className="input textarea" value={note} onChange={e=>setNote(e.target.value)} placeholder="Waarom wel/niet? Daytime fit, energie, doelgroep, rotatie…"/></label>
            <div className="meeting-review-meta"><span>{reviews.length} beoordeling{reviews.length===1?"":"en"} voor deze song</span><span>{track.source==="rotation"?`Rotation One • ${track.sourceSongId||"song"}`:"Handmatig toegevoegd"}</span></div>
            <div className="button-row meeting-save-row"><button className="ghost danger-text" onClick={()=>void removeTrack()}>Verwijder uit meeting</button><button className="primary" onClick={()=>void saveReviewAndNext()}>Beoordeling opslaan & volgende →</button></div>
          </>}
        </main>
      </div>
    </>}
  </div>;
}
