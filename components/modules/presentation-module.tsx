"use client";

import { useEffect, useMemo, useState } from "react";

type SongText = { id: string; artist: string; title: string; text: string; notes: string; tags: string[] };
type TemplateItem = { id: string; name: string; type: string; instruction: string; sample: string };
type ProgramTemplate = { id: string; program: string; presenter: string; intro: string; items: TemplateItem[] };

const songSeed: SongText[] = [
  { id: "s1", artist: "Joel Corry", title: "Whisper", text: "Joel Corry is deze week onze Tune of the Week. Dit is Whisper.", notes: "Niet benoemen als eerste samenwerking.", tags: ["Tune of the Week", "A-rotatie"] },
  { id: "s2", artist: "ANOTR & 54 Ultra", title: "Talk To You", text: "Nieuwe muziek van ANOTR en 54 Ultra. Deze week nieuw in onze muziekselectie: Talk To You.", notes: "Kan gelinkt worden aan de nieuwe muziekmeeting.", tags: ["Nieuw", "Dance"] },
  { id: "s3", artist: "Bebe Rexha", title: "New Religion", text: "Bebe Rexha hoor je met New Religion, één van de nieuwe toevoegingen van deze week.", notes: "Korte intro gebruiken in daytime.", tags: ["Nieuw"] },
  { id: "s4", artist: "Topic & Becky G", title: "Sorry Papi", text: "Topic en Becky G samen op Sorry Papi. Versuz Radio, only the best club music.", notes: "Ook bruikbaar als backannounce.", tags: ["B-rotatie"] },
];

const templateSeed: ProgramTemplate[] = [
  { id: "p1", program: "Morning Club", presenter: "Lena & Tibo", intro: "Goedemorgen! Dit is Morning Club op {station}.", items: [
    { id: "pi1", name: "Opening", type: "Vaste tekst", instruction: "Begroeting, tijd en programma noemen.", sample: "Goedemorgen, het is {time}. Welkom bij Morning Club." },
    { id: "pi2", name: "Weer / verkeer tease", type: "Redactie-item", instruction: "Tease wat binnen 10 minuten komt.", sample: "Straks het weer en de belangrijkste verkeersinfo." },
    { id: "pi3", name: "Nieuwe muziek", type: "Songtekst", instruction: "Gebruik automatisch de presentatiekst van de gekozen song.", sample: "{song.presentation_text}" },
    { id: "pi4", name: "Closing", type: "Vaste tekst", instruction: "Volgend programma aankondigen.", sample: "Zo meteen neemt Workday het over." },
  ]},
  { id: "p2", program: "Drive", presenter: "Bram & Tibo", intro: "Dit is Drive op {station}: jouw soundtrack naar huis.", items: [
    { id: "pi5", name: "Hour opener", type: "Vaste tekst", instruction: "Kort en energiek openen.", sample: "Nieuwe uur, nieuwe muziek. Dit is Drive." },
    { id: "pi6", name: "Coming up", type: "Draaiboekitem", instruction: "Noem 2 komende tracks en 1 redactie-item.", sample: "Straks {next_song_1}, {next_song_2} en om half het nieuws." },
  ]},
];

function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }
function useStored<T>(key:string, initial:T){ const [v,setV]=useState(initial); const [ready,setReady]=useState(false); useEffect(()=>{try{const x=localStorage.getItem(key);if(x)setV(JSON.parse(x));}catch{}setReady(true)},[key]); useEffect(()=>{if(ready)try{localStorage.setItem(key,JSON.stringify(v))}catch{}},[key,ready,v]); return [v,setV] as const; }

export default function PresentationModule({ stationSlug }: { stationSlug:string }){
  const [tab,setTab]=useState<"songs"|"templates">("songs");
  const [songs,setSongs]=useStored<SongText[]>(`vlacora:${stationSlug}:presentation:songs`, songSeed);
  const [templates,setTemplates]=useStored<ProgramTemplate[]>(`vlacora:${stationSlug}:presentation:templates`, templateSeed);
  const [selectedSong,setSelectedSong]=useState(songSeed[0].id);
  const [selectedTemplate,setSelectedTemplate]=useState(templateSeed[0].id);
  const [search,setSearch]=useState("");
  const song=songs.find(s=>s.id===selectedSong) || songs[0];
  const template=templates.find(t=>t.id===selectedTemplate) || templates[0];
  const filtered=useMemo(()=>songs.filter(s=>`${s.artist} ${s.title}`.toLowerCase().includes(search.toLowerCase())),[songs,search]);

  function updateSong(patch:Partial<SongText>){ if(!song)return; setSongs(songs.map(s=>s.id===song.id?{...s,...patch}:s)); }
  function addSong(){ const artist=prompt("Artiest:"); if(!artist)return; const title=prompt("Titel:"); if(!title)return; const n={id:uid(),artist,title,text:"",notes:"",tags:[]}; setSongs([...songs,n]);setSelectedSong(n.id); }
  function aiVariant(){ if(!song)return; updateSong({text:`${song.artist} met ${song.title}. Nieuw op VLACORA Radio en geselecteerd door onze muziekredactie. Dit is ${song.title}.`}); }
  function addProgram(){ const program=prompt("Programmanaam:"); if(!program)return; const n:ProgramTemplate={id:uid(),program,presenter:"Nog te bepalen",intro:`Welkom bij ${program} op {station}.`,items:[]};setTemplates([...templates,n]);setSelectedTemplate(n.id); }
  function addItem(){ if(!template)return; const name=prompt("Naam item:","Nieuw item"); if(!name)return; const item={id:uid(),name,type:"Redactie-item",instruction:"Beschrijf hier wat de presentator moet doen.",sample:"Voorbeeldtekst..."};setTemplates(templates.map(t=>t.id===template.id?{...t,items:[...t.items,item]}:t)); }
  function moveItem(index:number,dir:-1|1){ if(!template)return; const items=[...template.items];const to=index+dir;if(to<0||to>=items.length)return;[items[index],items[to]]=[items[to],items[index]];setTemplates(templates.map(t=>t.id===template.id?{...t,items}:t)); }
  function updateItem(id:string,patch:Partial<TemplateItem>){ if(!template)return;setTemplates(templates.map(t=>t.id===template.id?{...t,items:t.items.map(i=>i.id===id?{...i,...patch}:i)}:t)); }

  return <div>
    <div className="page-intro"><div><h2>Presentatie & programmateksten</h2><p>Elke song krijgt een eigen tekst. Programma&apos;s krijgen herbruikbare tekstsjablonen en redactie-items.</p></div><div className="button-row"><button className={tab==="songs"?"primary":"ghost"} onClick={()=>setTab("songs")}>Songteksten</button><button className={tab==="templates"?"primary":"ghost"} onClick={()=>setTab("templates")}>Programmasjablonen</button></div></div>
    {tab==="songs" ? <div className="presentation-workspace">
      <div className="song-library card"><div className="module-title-row"><div><h3>Songbibliotheek</h3><small>{songs.length} songs met redactietekst</small></div><button className="primary tiny-btn" onClick={addSong}>＋</button></div><input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Zoek artiest of song..."/>
        <div className="song-list">{filtered.map(s=><button key={s.id} onClick={()=>setSelectedSong(s.id)} className={`song-list-item ${song?.id===s.id?"selected":""}`}><div className="song-dot">♫</div><div><strong>{s.artist}</strong><span>{s.title}</span></div><small>{s.text?"Tekst ✓":"Geen tekst"}</small></button>)}</div>
      </div>
      {song && <div className="card song-editor"><div className="section-head"><div><span className="eyebrow">PRESENTATIETEKST PER SONG</span><h2>{song.artist} - {song.title}</h2></div><button className="ghost" onClick={aiVariant}>✨ Maak variant</button></div>
        <label className="field">Presentatietekst<textarea className="input presenter-editor" value={song.text} onChange={e=>updateSong({text:e.target.value})}/></label>
        <div className="two-form-cols"><label className="field">Interne notities<textarea className="input textarea" value={song.notes} onChange={e=>updateSong({notes:e.target.value})}/></label><label className="field">Tags<input className="input" value={song.tags.join(", ")} onChange={e=>updateSong({tags:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)})}/><span className="helper">bv. Tune of the Week, nieuw, A-rotatie</span></label></div>
        <div className="text-preview"><span>Zo ziet de presentator het:</span><p>{song.text || "Nog geen tekst geschreven."}</p></div>
      </div>}
    </div> : <div className="template-workspace">
      <div className="card program-list"><div className="module-title-row"><div><h3>Programma&apos;s</h3><small>Sjablonen per programma</small></div><button className="primary tiny-btn" onClick={addProgram}>＋</button></div>{templates.map(t=><button key={t.id} className={`program-option ${template?.id===t.id?"selected":""}`} onClick={()=>setSelectedTemplate(t.id)}><strong>{t.program}</strong><span>{t.presenter}</span><small>{t.items.length} items</small></button>)}</div>
      {template && <div className="card template-editor"><div className="section-head"><div><span className="eyebrow">PROGRAMMASJABLOON</span><h2>{template.program}</h2><p>{template.presenter}</p></div><button className="primary" onClick={addItem}>+ Item</button></div><label className="field">Standaard intro<textarea className="input textarea" value={template.intro} onChange={e=>setTemplates(templates.map(t=>t.id===template.id?{...t,intro:e.target.value}:t))}/></label>
        <h3>Items / tekstblokken</h3><div className="template-items">{template.items.map((item,index)=><div className="template-item" key={item.id}><div className="template-order"><button onClick={()=>moveItem(index,-1)}>↑</button><span>{index+1}</span><button onClick={()=>moveItem(index,1)}>↓</button></div><div className="template-item-body"><div className="two-form-cols"><label className="field">Itemnaam<input className="input" value={item.name} onChange={e=>updateItem(item.id,{name:e.target.value})}/></label><label className="field">Type<select className="select" value={item.type} onChange={e=>updateItem(item.id,{type:e.target.value})}><option>Vaste tekst</option><option>Redactie-item</option><option>Songtekst</option><option>Draaiboekitem</option><option>Nieuws / info</option><option>Promo</option></select></label></div><label className="field">Instructie<input className="input" value={item.instruction} onChange={e=>updateItem(item.id,{instruction:e.target.value})}/></label><label className="field">Voorbeeld / sjabloontekst<textarea className="input textarea compact-area" value={item.sample} onChange={e=>updateItem(item.id,{sample:e.target.value})}/></label></div><button className="mini-btn danger" onClick={()=>setTemplates(templates.map(t=>t.id===template.id?{...t,items:t.items.filter(i=>i.id!==item.id)}:t))}>×</button></div>)}</div>
        <div className="template-variables"><strong>Beschikbare variabelen</strong><code>{"{station} {time} {presenter} {song.artist} {song.title} {song.presentation_text} {next_song_1}"}</code></div>
      </div>}
    </div>}
  </div>
}
