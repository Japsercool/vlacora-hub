"use client";

import { useEffect,useMemo,useState } from "react";
import type { EditorialItem } from "@/components/modules/editorial-module";
import { canonicalPlaylistType } from "@/lib/radio/item-types";
import { deleteEditorialTemplate,loadEditorialTemplates,saveEditorialTemplate,type EditorialTemplateAssignment,type EditorialTemplateRecord,type EditorialTemplateSlot } from "@/lib/supabase/editorial";
import { isSupabaseBrowserConfigured } from "@/lib/supabase/client";

const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
const weekdays=["zondag","maandag","dinsdag","woensdag","donderdag","vrijdag","zaterdag"];

type PlaylistCategoryOption={
  key:string;
  label:string;
  count:number;
  examples:string[];
};

const GENERAL_PLAYLIST_TYPES=[
  {key:"music",label:"Muziek"},
  {key:"jingle",label:"Jingle / imaging"},
  {key:"commercial",label:"Advertentie"},
  {key:"news",label:"Nieuws"},
  {key:"weather",label:"Weer"},
  {key:"traffic",label:"Verkeer"},
  {key:"talk",label:"Talk"},
  {key:"tease",label:"Tease"},
  {key:"browse",label:"Browse list"}
] as const;

function generalPlaylistType(item:EditorialItem){const k=canonicalPlaylistType({type:item.type,rawType:(item as any).rawType,category:(item as any).category,externalKind:(item as any).externalKind,artist:item.artist,musicId:item.musicId,isSweeper:(item as any).isSweeper});return["imaging","promo","link"].includes(k)?"jingle":k}

function derivePlaylistCategories(playlist:EditorialItem[]):PlaylistCategoryOption[]{
  const counts=new Map<string,PlaylistCategoryOption>();
  for(const item of playlist){
    const key=generalPlaylistType(item);
    const label=GENERAL_PLAYLIST_TYPES.find(x=>x.key===key)?.label||key;
    const current=counts.get(key)||{key,label,count:0,examples:[]};
    current.count++;
    const example=[item.artist,item.title].filter(Boolean).join(" — ");
    if(example&&!current.examples.includes(example)&&current.examples.length<3)current.examples.push(example);
    counts.set(key,current);
  }
  return GENERAL_PLAYLIST_TYPES
    .map(type=>counts.get(type.key))
    .filter(Boolean) as PlaylistCategoryOption[];
}

const slotButtons:{type:EditorialTemplateSlot["type"];label:string}[]=[
  {type:"number",label:"Nummer"},{type:"link",label:"Link"},{type:"commercial",label:"Reclame"},
  {type:"browse",label:"Browse List"},{type:"talk",label:"Talk"},{type:"required_talk",label:"Verplichte talk"},{type:"tease",label:"Tease"}
];
const defaultSequence:EditorialTemplateSlot[]=[
  {id:uid(),type:"link",label:"Link",durationSec:0,content:"",required:false,permanentMessage:""},
  {id:uid(),type:"talk",label:"Prenews",durationSec:10,content:"",required:false,permanentMessage:""},
  {id:uid(),type:"number",label:"Nummer",durationSec:0,content:"",required:false,permanentMessage:""},
  {id:uid(),type:"link",label:"Link",durationSec:0,content:"",required:false,permanentMessage:""},
  {id:uid(),type:"talk",label:"Verkeer",durationSec:40,content:"",required:false,permanentMessage:""},
  {id:uid(),type:"link",label:"Link",durationSec:0,content:"",required:false,permanentMessage:""},
  {id:uid(),type:"talk",label:"TOTH",durationSec:20,content:"",required:false,permanentMessage:""},
  {id:uid(),type:"number",label:"Nummer",durationSec:0,content:"",required:false,permanentMessage:""},
  {id:uid(),type:"number",label:"Nummer",durationSec:0,content:"",required:false,permanentMessage:""},
  {id:uid(),type:"tease",label:"Tease",durationSec:15,content:"",required:false,permanentMessage:""},
  {id:uid(),type:"commercial",label:"Reclame",durationSec:0,content:"",required:false,permanentMessage:""},
  {id:uid(),type:"number",label:"Nummer",durationSec:0,content:"",required:false,permanentMessage:""}
];

function labelFor(type:EditorialTemplateSlot["type"]){return type==="category"?"Playlistcategorie":slotButtons.find(x=>x.type===type)?.label||type}
function chipClass(type:EditorialTemplateSlot["type"]){return type==="category"?"category":type==="number"?"number":type==="commercial"?"commercial":type==="link"?"link":type==="tease"?"tease":"talk"}
function isTalk(type:EditorialTemplateSlot["type"]){return["talk","required_talk","browse","tease"].includes(type)}
function blank(stationSlug:string):EditorialTemplateRecord{
  return{id:`new-${uid()}`,station_slug:stationSlug,name:"Nieuw redactietemplate",program_name:"",sequence:defaultSequence.map(x=>({...x,id:uid()})),assignments:[],notes:"",active:true};
}

export default function EditorialTemplateStudio({stationSlug,playlist}:{stationSlug:string;playlist:EditorialItem[]}){
  const[templates,setTemplates]=useState<EditorialTemplateRecord[]>([]);
  const[selectedId,setSelectedId]=useState("");
  const[draft,setDraft]=useState<EditorialTemplateRecord|null>(null);
  const[notice,setNotice]=useState("");
  const[loading,setLoading]=useState(true);
  const[dragId,setDragId]=useState("");
  const configured=isSupabaseBrowserConfigured();
  const playlistCategories=useMemo(()=>derivePlaylistCategories(playlist),[playlist]);

  function flash(text:string){setNotice(text);window.setTimeout(()=>setNotice(""),3000)}
  async function load(){
    setLoading(true);
    try{const rows=await loadEditorialTemplates(stationSlug);setTemplates(rows);if(!selectedId&&rows[0])setSelectedId(rows[0].id)}
    catch(e){flash(e instanceof Error?e.message:"Templates laden mislukt")}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[stationSlug]);
  useEffect(()=>{
    if(selectedId.startsWith("new-"))return;
    const row=templates.find(x=>x.id===selectedId);
    if(row)setDraft(JSON.parse(JSON.stringify(row)));
  },[selectedId,templates]);

  const active=draft;
  const assignments=active?.assignments||[];

  function patch(p:Partial<EditorialTemplateRecord>){if(draft)setDraft({...draft,...p})}
  function patchSlot(id:string,p:Partial<EditorialTemplateSlot>){if(draft)patch({sequence:draft.sequence.map(x=>x.id===id?{...x,...p}:x)})}
  function addSlot(type:EditorialTemplateSlot["type"]){
    if(!draft)return;
    const slot:EditorialTemplateSlot={id:uid(),type,label:labelFor(type),durationSec:isTalk(type)?20:0,content:"",required:type==="required_talk",permanentMessage:""};
    patch({sequence:[...draft.sequence,slot]});
  }

  function addCategorySlot(category:PlaylistCategoryOption){
    if(!draft)return;
    const slot:EditorialTemplateSlot={
      id:uid(),
      type:"category",
      label:category.label,
      categoryLabel:category.label,
      categoryKey:`general::${category.key}`,
      durationSec:0,
      content:"",
      required:false,
      permanentMessage:""
    };
    patch({sequence:[...draft.sequence,slot]});
  }
  function moveSlot(id:string,targetId:string){
    if(!draft||id===targetId)return;
    const from=draft.sequence.findIndex(x=>x.id===id),to=draft.sequence.findIndex(x=>x.id===targetId);
    if(from<0||to<0)return;
    const next=[...draft.sequence];const[row]=next.splice(from,1);next.splice(to,0,row);patch({sequence:next});
  }
  function moveBy(id:string,dir:-1|1){
    if(!draft)return;const from=draft.sequence.findIndex(x=>x.id===id),to=from+dir;if(from<0||to<0||to>=draft.sequence.length)return;
    const next=[...draft.sequence];[next[from],next[to]]=[next[to],next[from]];patch({sequence:next});
  }
  function addAssignment(){
    if(!draft)return;
    const a:EditorialTemplateAssignment={id:uid(),program:draft.program_name||"Programma",weekday:1,hour:7};
    patch({assignments:[...draft.assignments,a]});
  }
  function patchAssignment(id:string,p:Partial<EditorialTemplateAssignment>){if(draft)patch({assignments:draft.assignments.map(x=>x.id===id?{...x,...p}:x)})}

  async function save(){
    if(!draft)return;
    try{
      const saved=await saveEditorialTemplate(draft);
      setSelectedId(saved.id);setDraft(saved);flash("Redactietemplate centraal opgeslagen");
      await load();window.dispatchEvent(new CustomEvent("vlacora:editorial-template-changed",{detail:{stationSlug}}));
    }catch(e){flash(e instanceof Error?e.message:"Opslaan mislukt")}
  }
  async function remove(){
    if(!draft||draft.id.startsWith("new-"))return;
    if(!confirm(`Template “${draft.name}” verwijderen?`))return;
    try{await deleteEditorialTemplate(draft.id);setDraft(null);setSelectedId("");await load();flash("Template verwijderd")}
    catch(e){flash(e instanceof Error?e.message:"Verwijderen mislukt")}
  }
  function duplicate(row:EditorialTemplateRecord){
    const copy:EditorialTemplateRecord={...JSON.parse(JSON.stringify(row)),id:`new-${uid()}`,name:`${row.name} kopie`,assignments:[],sequence:row.sequence.map(x=>({...x,id:uid()}))};
    setDraft(copy);setSelectedId(copy.id);
  }
  function createNew(){
    const n=blank(stationSlug);
    if(playlistCategories.length)n.sequence=[];
    setDraft(n);setSelectedId(n.id);
  }

  const itemCount=useMemo(()=>draft?.sequence.length||0,[draft]);

  return <div className="redactie-template-studio">
    {notice&&<div className="inline-notice standalone">{notice}</div>}
    <div className="page-intro redactie-template-intro"><div><h2>Redactietemplates</h2><p>Definieer de echte volgorde van slottypes per uur. Nummers, links, reclame en talks worden als één draaiboek opgebouwd.</p></div><button className="primary template-new" onClick={createNew}>＋ Nieuw template</button></div>
    {!configured&&<div className="team-security-note"><strong>Supabase nodig</strong><span>Log in om redactietemplates centraal te bewaren.</span></div>}
    <div className="redactie-template-layout">
      <section className="redactie-template-cards">
        {loading&&<div className="card">Templates laden…</div>}
        {!loading&&templates.length===0&&<div className="card empty-live-state"><strong>Nog geen redactietemplates</strong><span>Maak je eerste template. De standaardvolgorde start al met Nummer/Link/Talk-slots.</span><button className="primary soft" onClick={createNew}>Nieuw template</button></div>}
        {templates.map(row=><article key={row.id} className={`redactie-template-card ${selectedId===row.id?"selected":""}`} onClick={()=>setSelectedId(row.id)}>
          <div className="redactie-template-card-head"><div><strong>{row.name}</strong><span>{row.sequence.length} items · {row.assignments.length} toewijzing{row.assignments.length===1?"":"en"}</span></div><div className="template-card-actions"><button onClick={e=>{e.stopPropagation();setSelectedId(row.id)}}>☷</button><button onClick={e=>{e.stopPropagation();duplicate(row)}}>▢</button></div></div>
          <div className="template-sequence-preview">{row.sequence.slice(0,20).map(slot=><span key={slot.id} className={`mini-slot ${chipClass(slot.type)}`}>{slot.type==="category"?(slot.categoryLabel||slot.label):labelFor(slot.type)}</span>)}{row.sequence.length>20&&<span className="mini-slot more">+{row.sequence.length-20}</span>}</div>
        </article>)}
      </section>

      <section className="redactie-template-editor">
        {!active?<div className="card empty-live-state"><strong>Kies een template</strong><span>Of maak rechtsboven een nieuw template.</span></div>:<div className="card redactie-template-editor-card">
          <div className="redactie-template-editor-head"><div><input className="template-title-input" value={active.name} onChange={e=>patch({name:e.target.value})}/><small>{itemCount} items · sleep om te herschikken</small></div><button className="close-template" onClick={()=>{setDraft(null);setSelectedId("")}}>×</button></div>
          <div className="template-meta-grid"><label>Programma<input value={active.program_name} onChange={e=>patch({program_name:e.target.value})} placeholder="bv. Bram & Tibo"/></label><label className="template-active-check"><input type="checkbox" checked={active.active} onChange={e=>patch({active:e.target.checked})}/> Actief</label></div>

          <div className="slot-add-section">
            <strong>Redactieslots toevoegen:</strong>
            <div className="slot-add-buttons">{slotButtons.filter(x=>["talk","required_talk","tease","browse"].includes(x.type)).map(x=><button key={x.type} className={`add-slot add-${chipClass(x.type)}`} onClick={()=>addSlot(x.type)}>＋ {x.label}</button>)}</div>

            <div className="real-category-section">
              <div className="real-category-head">
                <div><strong>Types uit de echte playlist</strong><span>Alleen algemene itemtypes die werkelijk in het geladen Rotation One-uur voorkomen.</span></div>
                <span className="real-category-count">{playlistCategories.length} gevonden</span>
              </div>
              {playlistCategories.length===0?
                <div className="real-category-empty">Haal eerst op het tabblad <b>Playlist</b> een echte Rotation One-playlist op. Daarna verschijnen hier automatisch knoppen zoals Muziek, Jingle / imaging en Advertentie.</div>:
                <div className="real-category-buttons">{playlistCategories.map(cat=><button key={cat.key} className="real-category-button" title={`${cat.count} item(s)${cat.examples.length?` • bv. ${cat.examples.join(", ")}`:""}`} onClick={()=>addCategorySlot(cat)}>＋ <b>{cat.label}</b><span>{cat.count}</span></button>)}</div>}
            </div>

            <details className="generic-slot-fallback">
              <summary>Generieke technische slots</summary>
              <div className="slot-add-buttons">{slotButtons.filter(x=>["number","link","commercial"].includes(x.type)).map(x=><button key={x.type} className={`add-slot add-${chipClass(x.type)}`} onClick={()=>addSlot(x.type)}>＋ {x.label}</button>)}</div>
            </details>
          </div>

          <div className="slot-sequence-title">Volgorde ({active.sequence.length} items) — sleep om te herschikken:</div>
          <div className="slot-sequence-list">
            {active.sequence.map((slot,index)=><div key={slot.id} className={`slot-editor-row slot-${chipClass(slot.type)}`} draggable onDragStart={()=>setDragId(slot.id)} onDragOver={e=>e.preventDefault()} onDrop={()=>{if(dragId)moveSlot(dragId,slot.id);setDragId("")}}>
              <span className="slot-drag">⠿</span><span className="slot-index">{index+1}</span><span className={`slot-pill slot-${chipClass(slot.type)}`}>{slot.type==="category"?(slot.categoryLabel||slot.label):labelFor(slot.type)}</span>
              {isTalk(slot.type)?<>
                <input className="slot-name" value={slot.label} onChange={e=>patchSlot(slot.id,{label:e.target.value})}/>
                <label className="slot-sec">◷ <input type="number" min="0" value={slot.durationSec} onChange={e=>patchSlot(slot.id,{durationSec:Number(e.target.value)})}/> sec</label>
                <button className={`content-button ${slot.content?"filled":""}`} onClick={()=>patchSlot(slot.id,{content:slot.content||" "})}>✎ Inhoud{slot.content?" ✓":""}</button>
              </>:<span className="slot-spacer">{slot.type==="category"?<small className="category-source-note">echte playlistcategorie</small>:null}</span>}
              <button className="row-icon" onClick={()=>moveBy(slot.id,-1)}>⌃</button><button className="row-icon" onClick={()=>moveBy(slot.id,1)}>⌄</button><button className="row-icon danger" onClick={()=>patch({sequence:active.sequence.filter(x=>x.id!==slot.id)})}>×</button>
              {isTalk(slot.type)&&<div className="slot-detail-panel">
                <select value={slot.permanentMessage} onChange={e=>patchSlot(slot.id,{permanentMessage:e.target.value})}><option value="">Geen permanent bericht gekoppeld</option><option value="station-default">Station standaardbericht</option><option value="program-default">Programma standaardbericht</option></select>
                <textarea value={slot.content} onChange={e=>patchSlot(slot.id,{content:e.target.value})} placeholder="Vaste inhoud, instructie of presentatietekst…"/>
                <label><input type="checkbox" checked={slot.required} onChange={e=>patchSlot(slot.id,{required:e.target.checked})}/> verplicht slot</label>
              </div>}
            </div>)}
          </div>

          <div className="template-assignment-section">
            <div className="section-head"><div><h3>Toewijzingen</h3><p>Laat hetzelfde template automatisch gelden voor één of meerdere programma-uren.</p></div><button className="ghost" onClick={addAssignment}>＋ Toewijzing</button></div>
            {assignments.length===0&&<div className="empty-live-state compact"><strong>Nog geen toewijzing</strong><span>Het template wordt pas automatisch aangeboden in de playlist wanneer dag en uur overeenkomen.</span></div>}
            {assignments.map(a=><div className="template-assignment-row" key={a.id}><input value={a.program} onChange={e=>patchAssignment(a.id,{program:e.target.value})} placeholder="Programma"/><select value={a.weekday} onChange={e=>patchAssignment(a.id,{weekday:Number(e.target.value)})}>{weekdays.map((d,i)=><option value={i} key={d}>{d}</option>)}</select><label>uur <input type="number" min="0" max="23" value={a.hour} onChange={e=>patchAssignment(a.id,{hour:Number(e.target.value)})}/></label><button onClick={()=>patch({assignments:active.assignments.filter(x=>x.id!==a.id)})}>×</button></div>)}
          </div>

          <label className="template-notes">Notities over dit template (optioneel)<textarea value={active.notes} onChange={e=>patch({notes:e.target.value})}/></label>
          <div className="template-savebar"><button className="primary" onClick={()=>void save()}>Opslaan</button>{!active.id.startsWith("new-")&&<button className="ghost danger-text" onClick={()=>void remove()}>Verwijderen</button>}<span>Centraal in Supabase · updates wissen dit niet</span></div>
        </div>}
      </section>
    </div>
  </div>
}
