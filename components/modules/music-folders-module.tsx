"use client";
import { useEffect, useState } from "react";
import { jsPDF } from "jspdf";

type Folder={id:string;name:string;description:string;songs:{id:string;artist:string;title:string;category:string}[]};
const seed:Folder[]=[
 {id:"f1",name:"A-ROTATIE",description:"Hoogste rotatie / actuele hits",songs:[{id:"1",artist:"Joel Corry",title:"Whisper",category:"A"},{id:"2",artist:"ANOTR & 54 Ultra",title:"Talk To You",category:"A"},{id:"3",artist:"HUGEL",title:"Movin' To The Sun",category:"A"}]},
 {id:"f2",name:"B-ROTATIE",description:"Sterke currents met iets lagere frequentie",songs:[{id:"4",artist:"Topic & Becky G",title:"Sorry Papi",category:"B"},{id:"5",artist:"Bebe Rexha",title:"New Religion",category:"B"}]},
 {id:"f3",name:"RECURRENTS",description:"Recente herkenbare titels",songs:[{id:"6",artist:"Calvin Harris & Jazzy",title:"Satisfy",category:"REC"},{id:"7",artist:"Jennifer Lopez & David Guetta",title:"Save Me Tonight",category:"REC"}]},
];
function uid(){return Math.random().toString(36).slice(2)+Date.now().toString(36)}
function useStored<T>(key:string,initial:T){const[v,s]=useState(initial);const[r,setR]=useState(false);useEffect(()=>{try{const x=localStorage.getItem(key);if(x)s(JSON.parse(x))}catch{}setR(true)},[key]);useEffect(()=>{if(r)try{localStorage.setItem(key,JSON.stringify(v))}catch{}},[key,r,v]);return[v,s]as const}
export default function MusicFoldersModule({stationSlug}:{stationSlug:string}){
 const[folders,setFolders]=useStored<Folder[]>(`vlacora:${stationSlug}:musicfolders`,seed);const[selected,setSelected]=useState(seed[0].id);const[docs,setDocs]=useStored<{id:string;name:string;created:string}[]>(`vlacora:${stationSlug}:musicfolders:docs`,[]);const folder=folders.find(f=>f.id===selected)||folders[0];
 function addFolder(){const name=prompt("Naam map:");if(!name)return;const n={id:uid(),name:name.toUpperCase(),description:"Nieuwe muziekmap",songs:[]};setFolders([...folders,n]);setSelected(n.id)}
 function addSong(){if(!folder)return;const artist=prompt("Artiest:");if(!artist)return;const title=prompt("Titel:");if(!title)return;setFolders(folders.map(f=>f.id===folder.id?{...f,songs:[...f.songs,{id:uid(),artist,title,category:f.name}]}:f))}
 function generatePdf(publish=false){
   const doc=new jsPDF({unit:"mm",format:"a4"});
   const W=210,H=297,margin=16;
   function background(pageNo:number){doc.setFillColor(31,31,117);doc.rect(0,0,W,H,"F");doc.setFillColor(77,55,210);doc.circle(184,28,48,"F");doc.setFillColor(40,40,145);doc.circle(20,280,65,"F");doc.setTextColor(255,255,255);doc.setFont("helvetica","bold");doc.setFontSize(22);doc.text("VLACORA",margin,19);doc.setFontSize(8);doc.setFont("helvetica","normal");doc.text("INTERNAL MUSIC COMMUNICATION",margin,25);doc.text(`Pagina ${pageNo}`,W-margin,287,{align:"right"});}
   let page=1; background(page); let y=42;
   doc.setFont("helvetica","bold");doc.setFontSize(24);doc.text("MUZIEKMAPPEN",margin,y);y+=8;doc.setFontSize(11);doc.setFont("helvetica","normal");doc.setTextColor(220,222,255);doc.text(`Station: ${stationSlug==="all"?"Alle zenders":stationSlug.toUpperCase()}`,margin,y);y+=6;doc.text(`Gegenereerd: ${new Date().toLocaleString("nl-BE")}`,margin,y);y+=12;
   for(const f of folders){
     const needed=18+f.songs.length*8;
     if(y+needed>272){doc.addPage();page++;background(page);y=38;}
     doc.setFillColor(255,255,255);doc.roundedRect(margin,y,W-margin*2,12,3,3,"F");doc.setTextColor(37,36,118);doc.setFont("helvetica","bold");doc.setFontSize(13);doc.text(f.name,margin+5,y+7.6);doc.setFontSize(8);doc.setFont("helvetica","normal");doc.text(`${f.songs.length} songs`,W-margin-5,y+7.4,{align:"right"});y+=17;
     doc.setTextColor(220,222,250);doc.setFontSize(9);doc.text(f.description,margin,y);y+=6;
     if(f.songs.length===0){doc.setTextColor(195,198,235);doc.text("Geen songs in deze map.",margin+3,y);y+=8;}
     for(let i=0;i<f.songs.length;i++){
       if(y>273){doc.addPage();page++;background(page);y=38;}
       const s=f.songs[i]; if(i%2===0){doc.setFillColor(47,47,137);doc.roundedRect(margin,y-4,W-margin*2,7.5,1,1,"F");}
       doc.setTextColor(255,255,255);doc.setFontSize(9);doc.setFont("helvetica","bold");doc.text(String(i+1).padStart(2,"0"),margin+3,y);doc.text(s.artist,margin+14,y);doc.setFont("helvetica","normal");doc.text(s.title,85,y);doc.setTextColor(190,195,255);doc.text(s.category,W-margin-4,y,{align:"right"});y+=8;
     }
     y+=5;
   }
   const filename=`vlacora-muziekmappen-${stationSlug}-${new Date().toISOString().slice(0,10)}.pdf`;
   doc.save(filename);
   if(publish)setDocs([{id:uid(),name:filename,created:new Date().toLocaleString("nl-BE")},...docs]);
 }
 return <div><div className="page-intro"><div><h2>Muziekmappen & interne PDF</h2><p>Beheer welke songs in welke Rotation One-map/categorie zitten en maak er een gebrande interne PDF van.</p></div><div className="button-row"><button className="ghost" onClick={()=>generatePdf(false)}>PDF downloaden</button><button className="primary" onClick={()=>generatePdf(true)}>PDF + interne communicatie</button></div></div>
 <div className="folder-layout"><div className="card folder-list"><div className="module-title-row"><div><h3>Muziekmappen</h3><small>{folders.reduce((a,f)=>a+f.songs.length,0)} songs totaal</small></div><button className="primary tiny-btn" onClick={addFolder}>＋</button></div>{folders.map(f=><button className={`folder-option ${folder?.id===f.id?"selected":""}`} key={f.id} onClick={()=>setSelected(f.id)}><div><strong>{f.name}</strong><span>{f.description}</span></div><b>{f.songs.length}</b></button>)}</div>
 {folder&&<div className="card folder-editor"><div className="section-head"><div><span className="eyebrow">ROTATION / MAP</span><h2>{folder.name}</h2><p>{folder.description}</p></div><div className="button-row"><button className="ghost" onClick={()=>{const d=prompt("Beschrijving:",folder.description);if(d!==null)setFolders(folders.map(f=>f.id===folder.id?{...f,description:d}:f))}}>Bewerk map</button><button className="primary" onClick={addSong}>+ Song</button></div></div><div className="folder-song-head"><span>#</span><span>Artiest</span><span>Titel</span><span>Map</span><span></span></div>{folder.songs.map((s,i)=><div className="folder-song-row" key={s.id}><span>{i+1}</span><strong>{s.artist}</strong><span>{s.title}</span><span className="folder-pill">{s.category}</span><button className="mini-btn danger" onClick={()=>setFolders(folders.map(f=>f.id===folder.id?{...f,songs:f.songs.filter(x=>x.id!==s.id)}:f))}>×</button></div>)}{folder.songs.length===0&&<div className="empty-block">Nog geen songs in deze map.</div>}</div>}
 <div className="card pdf-preview-card"><div className="pdf-mini"><div className="pdf-mini-brand">VLACORA</div><span>INTERNAL MUSIC COMMUNICATION</span><h3>MUZIEKMAPPEN</h3>{folders.slice(0,3).map(f=><div className="pdf-mini-folder" key={f.id}><strong>{f.name}</strong><small>{f.songs.length} songs</small></div>)}</div><h3>Gepubliceerde documenten</h3>{docs.length===0?<p className="muted">Nog geen PDF naar interne communicatie gestuurd.</p>:docs.map(d=><div className="document-row" key={d.id}><div><strong>{d.name}</strong><small>{d.created}</small></div><button className="mini-btn danger" onClick={()=>setDocs(docs.filter(x=>x.id!==d.id))}>×</button></div>)}</div></div></div>
}
