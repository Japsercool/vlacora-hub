"use client";

import { useEffect, useMemo, useState } from "react";
import { emitActivity } from "@/lib/collaboration/activity";

export type MusicSong = {
  id: string;
  artist: string;
  title: string;
  category: string;
  musicFolder: string;
  year: string;
  notes: string;
  artwork?: string;
  presentationText?: string;
};

const seedSongs: MusicSong[] = [
  { id:"ms1", artist:"Joel Corry", title:"Whisper", category:"Current", musicFolder:"A-MAP", year:"2026", notes:"Tune of the Week", presentationText:"Joel Corry is deze week onze Tune of the Week. Dit is Whisper." },
  { id:"ms2", artist:"ANOTR & 54 Ultra", title:"Talk To You", category:"Current", musicFolder:"A-MAP", year:"2026", notes:"Sterke daytime track" },
  { id:"ms3", artist:"HUGEL", title:"Movin' To The Sun", category:"Current", musicFolder:"A-MAP", year:"2026", notes:"" },
  { id:"ms4", artist:"Topic & Becky G", title:"Sorry Papi", category:"Current", musicFolder:"B-MAP", year:"2026", notes:"" },
  { id:"ms5", artist:"Bebe Rexha", title:"New Religion", category:"Current", musicFolder:"B-MAP", year:"2026", notes:"Nieuwe release" },
  { id:"ms6", artist:"Calvin Harris & Jazzy", title:"Satisfy", category:"Recurrent", musicFolder:"RECURRENTS", year:"2026", notes:"" },
  { id:"ms7", artist:"Jennifer Lopez & David Guetta", title:"Save Me Tonight", category:"Recurrent", musicFolder:"RECURRENTS", year:"2026", notes:"" },
  { id:"ms8", artist:"Lost Frequencies", title:"Live It All", category:"Current", musicFolder:"B-MAP", year:"2026", notes:"" },
  { id:"ms9", artist:"Bruno Mars", title:"I Just Might", category:"Current", musicFolder:"C-MAP", year:"2026", notes:"" }
];

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function normalizeSongs(value:unknown):MusicSong[]{
  if(!Array.isArray(value))return seedSongs;
  return value.map((raw:any)=>({
    ...raw,
    musicFolder:String(raw?.musicFolder||"A-MAP")
  })) as MusicSong[];
}
function useStoredSongs(key:string, initial:MusicSong[]) {
  const [value,setValue] = useState<MusicSong[]>(initial);
  const [ready,setReady] = useState(false);
  useEffect(()=>{ try { const raw=localStorage.getItem(key); if(raw) setValue(normalizeSongs(JSON.parse(raw))); } catch {} setReady(true); },[key]);
  useEffect(()=>{ if(ready) try { localStorage.setItem(key,JSON.stringify(value)); } catch {} },[key,ready,value]);
  return [value,setValue] as const;
}

function readFile(file: File, cb:(value:string)=>void) {
  const reader = new FileReader();
  reader.onload = () => cb(String(reader.result || ""));
  reader.readAsDataURL(file);
}

export default function MusicLibraryModule({stationSlug}:{stationSlug:string}) {
  const [songs,setSongs] = useStoredSongs(`vlacora:${stationSlug}:music:catalog`,seedSongs);
  const [selectedId,setSelectedId] = useState(seedSongs[0].id);
  const [search,setSearch] = useState("");
  const [filter,setFilter] = useState("Alle");
  const [showAdd,setShowAdd] = useState(false);

  useEffect(()=>{ if(!songs.some(s=>s.id===selectedId) && songs[0]) setSelectedId(songs[0].id); },[songs,selectedId]);

  const selected = songs.find(s=>s.id===selectedId) || songs[0];
  useEffect(()=>{emitActivity({detail:selected?`Muziek • ${selected.artist} – ${selected.title}`:"Muziekbibliotheek",entityType:"song",entityId:selected?.id})},[selected?.id,selected?.artist,selected?.title]);

  const maps = useMemo(()=>Array.from(new Set(["A-MAP","B-MAP","C-MAP","RECURRENTS","GOLD","SPECIALS",...songs.map(s=>s.musicFolder).filter(Boolean)])),[songs]);
  const categories = ["Alle",...Array.from(new Set(songs.map(s=>s.category)))];
  const visible = songs.filter(s => {
    const q = search.toLowerCase();
    return (!q || `${s.artist} ${s.title} ${s.musicFolder}`.toLowerCase().includes(q)) && (filter==="Alle" || s.category===filter);
  });

  function update(patch: Partial<MusicSong>) {
    if(!selected) return;
    setSongs(songs.map(s=>s.id===selected.id?{...s,...patch}:s));
  }

  function addSong(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const song:MusicSong = {
      id:uid(),
      artist:String(fd.get("artist")||""),
      title:String(fd.get("title")||""),
      category:String(fd.get("category")||"Current"),
      musicFolder:String(fd.get("musicFolder")||"A-MAP"),
      year:String(fd.get("year")||"2026"),
      notes:String(fd.get("notes")||""),
      presentationText:""
    };
    setSongs([song,...songs]); setSelectedId(song.id); setShowAdd(false);
  }

  function refresh() {
    try {
      const raw = localStorage.getItem(`vlacora:${stationSlug}:music:catalog`);
      if(raw) setSongs(normalizeSongs(JSON.parse(raw)));
    } catch {}
  }

  return <div>
    <div className="page-intro">
      <div><h2>Muziekbibliotheek</h2><p>Bekijk songs als echte bibliotheek, filter op map en bewerk alle metadata.</p></div>
      <div className="button-row"><button className="ghost" onClick={refresh}>↻ Refresh</button><button className="primary" onClick={()=>setShowAdd(!showAdd)}>+ Nieuwe song</button></div>
    </div>

    {showAdd && <div className="card inline-editor-card">
      <div className="module-title-row"><div><h3>Nieuwe song toevoegen</h3><small>Wordt meteen beschikbaar in de VLACORA-muziekbibliotheek.</small></div><button className="mini-btn" onClick={()=>setShowAdd(false)}>×</button></div>
      <form className="music-add-grid" onSubmit={addSong}>
        <label className="field">Artiest<input className="input" name="artist" required /></label>
        <label className="field">Titel<input className="input" name="title" required /></label>
        <label className="field">Categorie<select className="select" name="category"><option>Current</option><option>Recurrent</option><option>Gold</option><option>Special</option></select></label>
        <label className="field">Muziekmap<select className="select" name="musicFolder">{maps.map(x=><option key={x}>{x}</option>)}</select></label>
        <label className="field">Jaar<input className="input" name="year" defaultValue="2026"/></label>
        <label className="field wide-field">Notitie<input className="input" name="notes" /></label>
        <button className="primary">Song toevoegen</button>
      </form>
    </div>}

    <div className="music-library-layout">
      <div className="card music-browser">
        <div className="music-browser-toolbar">
          <input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Zoek artiest, titel of map..." />
          <select className="select" value={filter} onChange={e=>setFilter(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select>
        </div>
        <div className="music-browser-head"><span></span><span>Song</span><span>Map</span></div>
        <div className="music-browser-list">
          {visible.map(song=><button key={song.id} className={`music-browser-row ${selected?.id===song.id?"selected":""}`} onClick={()=>setSelectedId(song.id)}>
            <div className="music-art-thumb">{song.artwork?<img src={song.artwork} alt=""/>:<span>♫</span>}</div>
            <div><strong>{song.artist}</strong><span>{song.title}</span></div>
            <b>{song.musicFolder}</b>
          </button>)}
        </div>
      </div>

      {selected && <div className="card music-detail-editor">
        <div className="music-detail-top">
          <div className="music-art-large">{selected.artwork?<img src={selected.artwork} alt=""/>:<span>♫</span>}</div>
          <div><span className="eyebrow">SONG DETAIL</span><h2>{selected.artist}</h2><p>{selected.title}</p></div>
        </div>
        <div className="music-edit-grid">
          <label className="field">Artiest<input className="input" value={selected.artist} onChange={e=>update({artist:e.target.value})}/></label>
          <label className="field">Titel<input className="input" value={selected.title} onChange={e=>update({title:e.target.value})}/></label>
          <label className="field">Categorie<select className="select" value={selected.category} onChange={e=>update({category:e.target.value})}><option>Current</option><option>Recurrent</option><option>Gold</option><option>Special</option></select></label>
          <label className="field">Muziekmap<select className="select" value={selected.musicFolder} onChange={e=>update({musicFolder:e.target.value})}>{maps.map(x=><option key={x}>{x}</option>)}</select></label>
          <label className="field">Jaar<input className="input" value={selected.year} onChange={e=>update({year:e.target.value})}/></label>
          <label className="field">Artwork upload<input className="input file-input" type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)readFile(f,v=>update({artwork:v}))}}/></label>
        </div>
        <label className="field">Redactienotitie<textarea className="input textarea" value={selected.notes} onChange={e=>update({notes:e.target.value})}/></label>
        <label className="field">Presentatietekst voor deze song<textarea className="input presenter-editor mini-presenter-editor" value={selected.presentationText||""} onChange={e=>update({presentationText:e.target.value})} placeholder="Wat kan de presentator zeggen?"/></label>
        <div className="button-row"><button className="ghost" onClick={()=>update({presentationText:`Nieuwe muziek op VLACORA: ${selected.artist} met ${selected.title}.`})}>✨ Tekstvoorstel</button><button className="ghost danger-text" onClick={()=>setSongs(songs.filter(s=>s.id!==selected.id))}>Verwijder song</button></div>
      </div>}
    </div>
  </div>
}
