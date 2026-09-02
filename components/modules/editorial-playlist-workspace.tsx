"use client";

import { useEffect,useMemo,useState } from "react";
import type { EditorialItem,EditorialType } from "@/components/modules/editorial-module";
import { loadEditorialTemplates,type EditorialTemplateRecord,type EditorialTemplateSlot } from "@/lib/supabase/editorial";
import { broadPlaylistLabel,canonicalPlaylistType } from "@/lib/radio/item-types";

const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
const pad=(n:number)=>String(n).padStart(2,"0");

type Props={
  stationName:string;
  stationSlug:string;
  date:string;
  setDate:(value:string)=>void;
  hour:string;
  setHour:(value:string)=>void;
  playlist:EditorialItem[];
  setPlaylist:(items:EditorialItem[])=>void;
  onPull:()=>void|Promise<void>;
  playlistVersion:string;
  syncLabel?:string;
};

const filters:{key:string;label:string;types:EditorialType[]}[]=[
  {key:"tease",label:"Tease",types:["tease"]},
  {key:"number",label:"Nummer",types:["music"]},
  {key:"commercial",label:"Reclame",types:["commercial"]},
  {key:"talk",label:"Talk",types:["talk","weather","traffic","news","browse"]},
  {key:"link",label:"Link",types:["link","imaging","promo"]},
  {key:"browse",label:"Browselist",types:["browse"]}
];

function isoDate(date:Date){
  const y=date.getFullYear(),m=pad(date.getMonth()+1),d=pad(date.getDate());
  return `${y}-${m}-${d}`;
}
function shiftDate(value:string,days:number){
  const d=new Date(`${value}T12:00:00`);d.setDate(d.getDate()+days);return isoDate(d);
}
function durationSeconds(value:string){
  const bits=value.split(":").map(Number);
  if(bits.length===2)return(bits[0]||0)*60+(bits[1]||0);
  return Number(value)||0;
}
function durationText(seconds:number){return `${pad(Math.floor(seconds/60))}:${pad(Math.max(0,seconds%60))}`}
function itemKind(item:EditorialItem){return canonicalPlaylistType({type:item.type,rawType:(item as any).rawType,category:(item as any).category,externalKind:(item as any).externalKind,artist:item.artist,musicId:item.musicId,isSweeper:(item as any).isSweeper})}
function normalizedType(item:EditorialItem){const k=itemKind(item);if(k==="music")return"number";if(k==="commercial")return"commercial";if(["imaging","promo","link"].includes(k))return"link";if(k==="tease")return"tease";if(k==="browse")return"browse";return"talk"}
function badgeLabel(item:EditorialItem){const k=itemKind(item);if(k==="music")return"Nummer";if(k==="commercial")return"Reclame";if(k==="traffic")return"Verkeer";if(k==="weather")return"Weer";if(k==="news")return"Nieuws";if(k==="browse")return"Browse List";if(k==="tease")return"Tease";if(["imaging","promo","link"].includes(k))return"Jingle";return k==="talk"?"Talk":broadPlaylistLabel(k)}
function manualType(slot:EditorialTemplateSlot):EditorialType{
  if(slot.type==="tease")return"tease";
  if(slot.type==="browse")return"browse";
  if(slot.type==="commercial")return"commercial";
  if(slot.type==="link")return"link";
  return"talk";
}

function generalPlaylistType(item:EditorialItem){const k=itemKind(item);return ["imaging","promo","link"].includes(k)?"jingle":k}
function defaultNotes(type:EditorialType,label:string){
  const text=`${label} ${type}`.toLowerCase();
  if(text.includes("actie")||text.includes("sponsor")||text.includes("wedstrijd"))return"Verkochte actie / sponsor";
  if(type==="news")return"Nieuws";
  if(type==="weather")return"Weer";
  return"Redactie";
}

export default function EditorialPlaylistWorkspace(props:Props){
  const{stationName,stationSlug,date,setDate,hour,setHour,playlist,setPlaylist,onPull,playlistVersion,syncLabel}=props;
  const[query,setQuery]=useState("");
  const[enabled,setEnabled]=useState(()=>new Set(filters.map(x=>x.key)));
  const[selectedId,setSelectedId]=useState("");
  const[live,setLive]=useState(false);
  const[dragId,setDragId]=useState("");
  const[template,setTemplate]=useState<EditorialTemplateRecord|null>(null);
  const[templateMessage,setTemplateMessage]=useState("");
  const hourNumber=Number(hour.slice(0,2));

  useEffect(()=>{
    let alive=true;
    (async()=>{
      try{
        const all=await loadEditorialTemplates(stationSlug);
        if(!alive)return;
        const weekday=new Date(`${date}T12:00:00`).getDay();
        const match=all.find(t=>t.active&&t.assignments.some(a=>Number(a.weekday)===weekday&&Number(a.hour)===hourNumber));
        setTemplate(match||null);
        setTemplateMessage(match?`${match.name} • ${match.sequence.length} slots`:"Geen redactietemplate toegewezen aan dit uur");
      }catch{if(alive){setTemplate(null);setTemplateMessage("Templates konden niet geladen worden")}}
    })();
    return()=>{alive=false};
  },[stationSlug,date,hourNumber]);

  const visible=useMemo(()=>playlist.filter(item=>{
    const key=normalizedType(item);
    if(!enabled.has(key)&&!(key==="talk"&&enabled.has("browse")&&item.type==="browse"))return false;
    const hay=`${item.artist||""} ${item.title} ${item.presenterText} ${item.notes}`.toLowerCase();
    return!query.trim()||hay.includes(query.toLowerCase());
  }),[playlist,query,enabled]);

  const hidden=Math.max(0,playlist.length-visible.length);
  const selected=playlist.find(x=>x.id===selectedId);

  function toggleFilter(key:string){
    const next=new Set(enabled);
    if(next.has(key))next.delete(key);else next.add(key);
    setEnabled(next);
  }
  function patchItem(id:string,patch:Partial<EditorialItem>){setPlaylist(playlist.map(x=>x.id===id?{...x,...patch}:x))}
  function removeItem(id:string){setPlaylist(playlist.filter(x=>x.id!==id))}
  function moveItem(id:string,targetId:string){
    if(id===targetId)return;
    const from=playlist.findIndex(x=>x.id===id),to=playlist.findIndex(x=>x.id===targetId);
    if(from<0||to<0)return;
    const next=[...playlist];const[row]=next.splice(from,1);next.splice(to,0,row);setPlaylist(next);
  }
  function addTalkAfter(afterId:string,type:EditorialType="talk",label="Nieuwe talk"){
    const idx=playlist.findIndex(x=>x.id===afterId);
    const source=playlist[Math.max(0,idx)];
    const item:EditorialItem={id:uid(),time:source?.time||hour,type,title:label,duration:"00:20",presenterText:"",notes:defaultNotes(type,label),source:"VLACORA"};
    const next=[...playlist];next.splice(idx<0?next.length:idx+1,0,item);setPlaylist(next);setSelectedId(item.id);
  }
  function quickAdd(type:EditorialType,label:string){
    const after=selected?.id||playlist[playlist.length-1]?.id||"";
    if(after)addTalkAfter(after,type,label);
    else{
      const item:EditorialItem={id:uid(),time:hour,type,title:label,duration:"00:20",presenterText:"",notes:defaultNotes(type,label),source:"VLACORA"};
      setPlaylist([item]);setSelectedId(item.id);
    }
  }

  function applyTemplate(){
    if(!template)return setTemplateMessage("Geen redactietemplate toegewezen aan dit uur.");

    const unused=new Set(playlist.map(item=>item.id));
    const next:EditorialItem[]=[];

    function consume(predicate:(item:EditorialItem)=>boolean){
      const found=playlist.find(item=>unused.has(item.id)&&predicate(item));
      if(found)unused.delete(found.id);
      return found;
    }

    for(const slot of template.sequence){
      let item:EditorialItem|undefined;

      if(slot.type==="category"&&slot.categoryKey){
        item=consume(candidate=>slot.categoryKey===`general::${generalPlaylistType(candidate)}`);
      }else if(slot.type==="number"){
        item=consume(candidate=>itemKind(candidate)==="music");
      }else if(slot.type==="commercial"){
        item=consume(candidate=>itemKind(candidate)==="commercial");
      }else if(slot.type==="link"){
        item=consume(candidate=>["link","imaging","promo"].includes(itemKind(candidate)));
      }

      if(item){
        next.push(item);
        continue;
      }

      if(["talk","required_talk","tease","browse"].includes(slot.type)){
        next.push({
          id:uid(),
          time:next[next.length-1]?.time||hour,
          type:manualType(slot),
          title:slot.label||"Redactieslot",
          duration:durationText(slot.durationSec||20),
          presenterText:slot.content||"",
          notes:slot.required?"Verplicht redactieslot":"Redactieslot",
          source:"VLACORA"
        });
      }else if(slot.type==="category"){
        // Keep the missing category visible in the editorial workspace,
        // instead of silently substituting a different type.
        next.push({
          id:uid(),
          time:next[next.length-1]?.time||hour,
          type:"talk",
          title:`Ontbreekt: ${slot.categoryLabel||slot.label||"playlisttype"}`,
          duration:"00:00",
          presenterText:"",
          notes:`Geen item uit echte playlist gevonden voor ${slot.categoryLabel||slot.categoryKey||"type"}`,
          source:"VLACORA"
        });
      }
    }

    // Keep every Rotation One item that was not consumed in its original order.
    next.push(...playlist.filter(item=>unused.has(item.id)));
    setPlaylist(next);
    setTemplateMessage(`${template.name} toegepast • ${next.length} items`);
  }

  const today=isoDate(new Date());
  const dateLabel=new Intl.DateTimeFormat("nl-BE",{weekday:"short",day:"numeric",month:"short",year:"numeric"}).format(new Date(`${date}T12:00:00`));

  return <div className={`topplaylist-shell ${live?"live-mode":""}`}>
    <div className="topplaylist-header">
      <div className="topplaylist-brand"><span className="topplaylist-logo">♫</span><div><strong>{stationName} playlist</strong><small>Redactionele werkplek</small></div></div>
      <div className="topplaylist-date-nav">
        <button className="square-nav" onClick={()=>setDate(shiftDate(date,-1))}>‹</button>
        <label className="topplaylist-date-input"><span>▣</span><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
        <button className="square-nav" onClick={()=>setDate(shiftDate(date,1))}>›</button>
        <button className="today-btn" onClick={()=>setDate(today)}>Vandaag</button>
      </div>
      <span className="station-bubble">{stationName.slice(0,10).toUpperCase()}</span>
      <div className="topplaylist-date-label">{dateLabel}</div>
    </div>

    <div className="topplaylist-livebar">
      <span>{live?"LIVE-weergave actief: focus op huidige uur en essentiële redactie.":"Zet LIVE aan tijdens de uitzending voor een opgeruimde weergave"}</span>
      <button className={`live-toggle ${live?"active":""}`} onClick={()=>setLive(!live)}><span>○</span> LIVE</button>
    </div>

    <div className="topplaylist-hourbar">
      {Array.from({length:24},(_,i)=>i).map(i=><button key={i} className={i===hourNumber?"active":""} onClick={()=>setHour(`${pad(i)}:00`)}>{pad(i)}</button>)}
    </div>

    <div className="topplaylist-filters">
      {filters.map(f=><button key={f.key} className={`filter-chip filter-${f.key} ${enabled.has(f.key)?"active":"muted"}`} onClick={()=>toggleFilter(f.key)}>{f.label}</button>)}
    </div>

    <div className="topplaylist-templatebar">
      <div><strong>{template?template.name:"Geen uurtemplate"}</strong><span>{syncLabel||templateMessage}</span></div>
      <div className="button-row"><button className="ghost" onClick={()=>void onPull()}>↻ Rotation One</button><button className="primary soft" disabled={!template} onClick={applyTemplate}>Sjabloon toepassen</button><span className="version-badge">rev {playlistVersion}</span></div>
    </div>

    <div className="topplaylist-main">
      <section className="topplaylist-center">
        <div className="topplaylist-searchrow">
          <label><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Zoek op titel of artiest…"/></label>
          <span>{visible.length} zichtbaar · {hidden} verborgen</span><span>✎ Filters actief</span>
        </div>
        <div className="topplaylist-list">
          {visible.length===0&&<div className="topplaylist-empty"><strong>Nog niets zichtbaar</strong><span>Haal de echte Rotation One-playlist op of pas een redactietemplate toe.</span></div>}
          {visible.map(item=>{
            const kind=itemKind(item);
            const isTalk=!["music","commercial","imaging","promo","link"].includes(kind);
            const isYellow=["commercial","imaging","promo","link"].includes(kind);
            const sec=durationSeconds(item.duration);
            return <div key={item.id}
              className={`topplaylist-row ${isTalk?"talk-row":isYellow?"link-row":"music-row"} ${selectedId===item.id?"selected":""}`}
              draggable={!item.locked}
              onDragStart={()=>setDragId(item.id)}
              onDragOver={e=>e.preventDefault()}
              onDrop={()=>{if(dragId)moveItem(dragId,item.id);setDragId("")}}
              onClick={()=>setSelectedId(item.id)}>
              {isTalk?<div className="talk-row-inner">
                <span className="drag-dots">⠿</span><span className="row-time">{item.time}</span>
                <span className={`slot-pill slot-${normalizedType(item)}`}>{badgeLabel(item)}</span>
                <input className="slot-title-input" value={item.title} onChange={e=>patchItem(item.id,{title:e.target.value})} onClick={e=>e.stopPropagation()}/>
                <span className="slot-kind">Talk</span>
                <label className="slot-duration"><input type="number" min="0" value={Math.floor(sec/60)} onChange={e=>patchItem(item.id,{duration:durationText(Number(e.target.value)*60+(sec%60))})}/> min</label>
                <label className="slot-duration"><input type="number" min="0" max="59" value={sec%60} onChange={e=>patchItem(item.id,{duration:durationText(Math.floor(sec/60)*60+Number(e.target.value))})}/> sec</label>
                <button className={`content-button ${item.presenterText?"filled":""}`} onClick={e=>{e.stopPropagation();setSelectedId(item.id)}}>✎ Inhoud{item.presenterText?" ✓":""}</button>
                <button className="row-icon" title="Omhoog" onClick={e=>{e.stopPropagation();const idx=playlist.findIndex(x=>x.id===item.id);if(idx>0)moveItem(item.id,playlist[idx-1].id)}}>⌃</button>
                <button className="row-icon" title="Omlaag" onClick={e=>{e.stopPropagation();const idx=playlist.findIndex(x=>x.id===item.id);if(idx<playlist.length-1)moveItem(item.id,playlist[idx+1].id)}}>⌄</button>
                <button className="row-icon danger" onClick={e=>{e.stopPropagation();removeItem(item.id)}}>⌫</button>
                {selectedId===item.id&&<div className="talk-content-panel"><textarea value={item.presenterText} onChange={e=>patchItem(item.id,{presenterText:e.target.value})} placeholder="Inhoud / presentatietekst voor dit slot…"/><input value={item.notes} onChange={e=>patchItem(item.id,{notes:e.target.value})} placeholder="Notitie of bron…"/></div>}
              </div>:<>
                <span className="row-time">{item.time}</span>
                <div className="music-main">{item.artist&&<span className="music-artist">{item.artist}</span>}<strong>{item.title}</strong></div>
                <span className="music-duration">{item.duration}</span>
                {!item.locked&&<button className="add-talk-after" title="Talk toevoegen na dit item" onClick={e=>{e.stopPropagation();addTalkAfter(item.id)}}>＋</button>}
              </>}
            </div>
          })}
        </div>
      </section>

      <aside className="topplaylist-actions">
        <button onClick={()=>quickAdd("weather","Weer")}><span>☁</span> WEER</button>
        <button onClick={()=>quickAdd("news","Nieuws")}><span>▣</span> NIEUWS</button>
        <button onClick={()=>quickAdd("talk","Redactie")}><span>✎</span> REDACTIE</button>
        <button onClick={()=>quickAdd("talk","Verkochte actie")}><span>★</span> ACTIE</button>
        <button onClick={()=>quickAdd("talk","Wedstrijd / sponsoractie")}><span>✓</span> WEDSTRIJD</button>
        <button onClick={()=>quickAdd("talk","Doorverwijs")}><span>➤</span> DOORVERWIJS</button>
        <button onClick={()=>quickAdd("talk","Check bericht")}><span>⌕</span> CHECK BERICHT</button>
        <div className="topplaylist-side-info"><strong>Uur {pad(hourNumber)}</strong><span>{playlist.length} items</span><span>{template?`Template: ${template.name}`:"Geen template"}</span><span>Gebruik toewijzingen in sjablonen om verkochte acties automatisch op vaste uren te tonen.</span></div>
      </aside>
    </div>
  </div>
}
