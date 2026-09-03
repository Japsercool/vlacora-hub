"use client";

import { useCallback,useEffect,useMemo,useState } from "react";
import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";

type FieldType="text"|"textarea"|"number"|"date"|"time"|"select"|"checkbox";
type TemplateField={id:string;label:string;type:FieldType;required:boolean;options:string[]};
type Trigger="on_start"|"after_songs"|"after_items"|"at_minute"|"at_time"|"on_finish";
type Action="instruction"|"notification"|"task"|"playlist_marker"|"check";
type Automation={id:string;trigger:Trigger;amount:number;time:string;action:Action;value:string};
type Template={id:string;station_slug:string|null;name:string;category:string;description:string;fields:TemplateField[];automations:Automation[];active:boolean;created_at?:string;updated_at?:string};

const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
const blank=():Template=>({id:`new-${uid()}`,station_slug:null,name:"Nieuw sjabloon",category:"Workflow",description:"",fields:[],automations:[],active:true});
const fieldTypes:[FieldType,string][]=[["text","Korte tekst"],["textarea","Lange tekst"],["number","Getal"],["date","Datum"],["time","Tijd"],["select","Keuzelijst"],["checkbox","Checkbox"]];
const triggers:[Trigger,string][]=[["on_start","Bij start"],["after_songs","Na X songs"],["after_items","Na X items"],["at_minute","Op minuut in het uur"],["at_time","Op exact tijdstip"],["on_finish","Bij einde"]];
const actions:[Action,string][]=[["instruction","Toon instructie"],["notification","Stuur teammelding"],["task","Maak taak"],["playlist_marker","Draaiboek-marker / opdracht"],["check","Controlepunt"]];

function triggerLabel(rule:Automation){
  if(rule.trigger==="after_songs")return `Na ${rule.amount||1} song${(rule.amount||1)===1?"":"s"}`;
  if(rule.trigger==="after_items")return `Na ${rule.amount||1} item${(rule.amount||1)===1?"":"s"}`;
  if(rule.trigger==="at_minute")return `Op minuut ${String(rule.amount||0).padStart(2,"0")}`;
  if(rule.trigger==="at_time")return `Om ${rule.time||"00:00"}`;
  return triggers.find(x=>x[0]===rule.trigger)?.[1]||rule.trigger;
}
function actionLabel(rule:Automation){return actions.find(x=>x[0]===rule.action)?.[1]||rule.action}

export default function TemplatesModule({stationSlug}:{stationSlug:string}){
  const[templates,setTemplates]=useState<Template[]>([]);
  const[selectedId,setSelectedId]=useState("");
  const[draft,setDraft]=useState<Template|null>(null);
  const[loading,setLoading]=useState(true);
  const[notice,setNotice]=useState("");
  const configured=isSupabaseBrowserConfigured();
  const flash=(x:string)=>{setNotice(x);setTimeout(()=>setNotice(""),2800)};

  const load=useCallback(async()=>{
    if(!configured){setLoading(false);return}
    const supabase=createClient();
    let q=supabase.from("hub_templates").select("id,station_slug,name,category,description,fields,automations,active,created_at,updated_at").order("name");
    if(stationSlug!=="all")q=q.or(`station_slug.is.null,station_slug.eq.all,station_slug.eq.${stationSlug}`);
    const{data,error}=await q;if(error){flash(error.message);setLoading(false);return}
    const rows=(data||[]).map((x:any)=>({...x,fields:Array.isArray(x.fields)?x.fields:[],automations:Array.isArray(x.automations)?x.automations:[]})) as Template[];
    setTemplates(rows);setSelectedId(current=>current&&rows.some(x=>x.id===current)?current:(rows[0]?.id||""));setLoading(false);
  },[configured,stationSlug]);
  useEffect(()=>{void load()},[load]);
  useEffect(()=>{const item=templates.find(x=>x.id===selectedId);if(item)setDraft(JSON.parse(JSON.stringify(item)))},[selectedId,templates]);

  function newTemplate(preset?:"after-two"|"news"){
    const t=blank();t.station_slug=stationSlug==="all"?"all":stationSlug;
    if(preset==="after-two"){t.name="Na tweede song";t.category="Programma-automatisering";t.description="Voorbeeld: voer automatisch een vaste stap uit na de tweede song.";t.automations=[{id:uid(),trigger:"after_songs",amount:2,time:"",action:"playlist_marker",value:"Voer hier de gewenste stap uit"}]}
    if(preset==="news"){t.name="Nieuwsbulletin";t.category="Redactie";t.description="Vaste velden en controles voor elk nieuwsbulletin.";t.fields=[{id:uid(),label:"Hoofdnieuws",type:"textarea",required:true,options:[]},{id:uid(),label:"Weer",type:"textarea",required:false,options:[]}];t.automations=[{id:uid(),trigger:"on_start",amount:0,time:"",action:"check",value:"Controleer actualiteit en uitspraak van namen"}]}
    setDraft(t);setSelectedId(t.id);
  }
  function patch(p:Partial<Template>){if(draft)setDraft({...draft,...p})}
  function patchField(id:string,p:Partial<TemplateField>){if(draft)patch({fields:draft.fields.map(x=>x.id===id?{...x,...p}:x)})}
  function patchAutomation(id:string,p:Partial<Automation>){if(draft)patch({automations:draft.automations.map(x=>x.id===id?{...x,...p}:x)})}
  function move<T extends{id:string}>(rows:T[],id:string,dir:-1|1){const i=rows.findIndex(x=>x.id===id),j=i+dir;if(i<0||j<0||j>=rows.length)return rows;const n=[...rows];[n[i],n[j]]=[n[j],n[i]];return n}

  async function save(){
    if(!draft||!configured)return flash("Supabase-login is nodig om sjablonen centraal te bewaren.");
    if(!draft.name.trim())return flash("Geef het sjabloon een naam.");
    const supabase=createClient();const{data:user}=await supabase.auth.getUser();if(!user.user)return flash("Log opnieuw in.");
    const row={station_slug:draft.station_slug,name:draft.name.trim(),category:draft.category.trim()||"Workflow",description:draft.description,fields:draft.fields,automations:draft.automations,active:draft.active,updated_by:user.user.id,updated_at:new Date().toISOString()};
    if(draft.id.startsWith("new-")){
      const{data,error}=await supabase.from("hub_templates").insert({...row,created_by:user.user.id}).select().single();if(error)return flash(error.message);setSelectedId(data.id);flash("Sjabloon aangemaakt");
    }else{
      const{error}=await supabase.from("hub_templates").update(row).eq("id",draft.id);if(error)return flash(error.message);flash("Sjabloon opgeslagen");
    }
    await load();
  }
  async function remove(){if(!draft||draft.id.startsWith("new-")||!configured)return; if(!confirm(`Sjabloon “${draft.name}” verwijderen?`))return;const{error}=await createClient().from("hub_templates").delete().eq("id",draft.id);if(error)return flash(error.message);setDraft(null);setSelectedId("");flash("Sjabloon verwijderd");await load()}
  function exportJson(){if(!draft)return;const blob=new Blob([JSON.stringify(draft,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${draft.name.replace(/[^a-z0-9]+/gi,"-").toLowerCase()}.vlacora-template.json`;a.click();URL.revokeObjectURL(a.href)}

  const automaticCount=useMemo(()=>draft?.automations.length||0,[draft]);
  return <div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}
    <div className="page-intro"><div><h2>Sjablonen</h2><p>Maak herbruikbare workflows met onbeperkt veel eigen velden én automatische regels zoals “na de tweede song”.</p></div><div className="button-row"><button className="ghost" onClick={()=>newTemplate("after-two")}>Voorbeeld: na 2 songs</button><button className="primary" onClick={()=>newTemplate()}>+ Nieuw sjabloon</button></div></div>
    <div className="template-capability-grid"><div className="card"><strong>∞ Eigen velden</strong><span>Tekst, datum, tijd, keuzes, checkboxen… voeg er zoveel toe als je nodig hebt.</span></div><div className="card"><strong>⚡ Automatische stappen</strong><span>Bij start, na X songs/items, op minuut/tijdstip of bij einde.</span></div><div className="card"><strong>☁ Centraal</strong><span>Supabase bewaart sjablonen onafhankelijk van nieuwe VLACORA-versies.</span></div></div>
    {!configured&&<div className="team-security-note"><strong>Supabase nodig</strong><span>Log in om sjablonen centraal te bewaren en met het team te delen.</span></div>}
    <div className="templates-layout">
      <div className="card template-list"><div className="module-title-row"><div><h3>Sjablonen</h3><small>{templates.length} opgeslagen</small></div><button className="mini-btn" onClick={()=>void load()}>↻</button></div>{loading?<p>laden…</p>:templates.length===0?<div className="empty-live-state compact"><strong>Nog geen sjablonen</strong><span>Start blanco of gebruik een voorbeeld.</span><button className="ghost" onClick={()=>newTemplate("news")}>Nieuwsbulletin voorbeeld</button></div>:templates.map(t=><button className={`template-list-row ${selectedId===t.id?"selected":""}`} key={t.id} onClick={()=>setSelectedId(t.id)}><div><strong>{t.name}</strong><small>{t.category}</small></div><span>{t.automations.length?`⚡ ${t.automations.length}`:"Handmatig"}</span></button>)}</div>
      <div className="template-editor-column">
        {!draft?<div className="card empty-live-state"><strong>Kies of maak een sjabloon</strong><span>De editor verschijnt hier.</span></div>:<>
          <div className="card template-editor"><div className="section-head"><div><span className="eyebrow">SJABLOON</span><h2>{draft.name}</h2><p>{automaticCount?`${automaticCount} automatische regel(s)`:"Geen automatische regels"}</p></div><label className="switch-line"><input type="checkbox" checked={draft.active} onChange={e=>patch({active:e.target.checked})}/><span>Actief</span></label></div><div className="two-form-cols"><label className="field">Naam<input className="input" value={draft.name} onChange={e=>patch({name:e.target.value})}/></label><label className="field">Categorie<input className="input" value={draft.category} onChange={e=>patch({category:e.target.value})}/></label></div><label className="field">Beschrijving<textarea className="input textarea" value={draft.description} onChange={e=>patch({description:e.target.value})}/></label><div className="button-row"><button className="primary" onClick={()=>void save()}>Opslaan</button><button className="ghost" onClick={exportJson}>Export JSON</button>{!draft.id.startsWith("new-")&&<button className="ghost danger-text" onClick={()=>void remove()}>Verwijderen</button>}</div></div>

          <div className="card"><div className="section-head"><div><h3>Eigen velden</h3><p>Geen vaste limiet in VLACORA. Velden worden als JSON in Supabase opgeslagen.</p></div><button className="primary soft" onClick={()=>patch({fields:[...draft.fields,{id:uid(),label:`Nieuw veld ${draft.fields.length+1}`,type:"text",required:false,options:[]}]})}>+ Veld</button></div><div className="dynamic-fields-list">{draft.fields.length===0&&<div className="empty-live-state compact"><strong>Geen eigen velden</strong><span>Voeg alleen toe wat dit proces nodig heeft.</span></div>}{draft.fields.map((field,index)=><div className="dynamic-field-row" key={field.id}><div className="dynamic-order"><button className="mini-btn" onClick={()=>patch({fields:move(draft.fields,field.id,-1)})}>↑</button><button className="mini-btn" onClick={()=>patch({fields:move(draft.fields,field.id,1)})}>↓</button><span>{index+1}</span></div><input className="input" value={field.label} onChange={e=>patchField(field.id,{label:e.target.value})}/><select className="select" value={field.type} onChange={e=>patchField(field.id,{type:e.target.value as FieldType})}>{fieldTypes.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select><label className="mini-check"><input type="checkbox" checked={field.required} onChange={e=>patchField(field.id,{required:e.target.checked})}/> verplicht</label>{field.type==="select"&&<input className="input" value={field.options.join(", ")} onChange={e=>patchField(field.id,{options:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)})} placeholder="Optie 1, Optie 2"/>}<button className="mini-btn danger" onClick={()=>patch({fields:draft.fields.filter(x=>x.id!==field.id)})}>×</button></div>)}</div></div>

          <div className="card"><div className="section-head"><div><h3>Automatische regels</h3><p>Voorbeeld: <strong>Na 2 inhoudsblokken → interne instructie</strong>.</p></div><button className="primary soft" onClick={()=>patch({automations:[...draft.automations,{id:uid(),trigger:"after_songs",amount:2,time:"",action:"instruction",value:"Nieuwe automatische stap"}]})}>+ Automatische regel</button></div><div className="automation-list">{draft.automations.length===0&&<div className="empty-live-state compact"><strong>Nog niets automatisch</strong><span>Je kunt elk sjabloon ook volledig handmatig gebruiken.</span></div>}{draft.automations.map((rule,index)=><div className="automation-rule" key={rule.id}><div className="automation-number">{index+1}</div><div className="automation-rule-main"><div className="automation-grid"><select className="select" value={rule.trigger} onChange={e=>patchAutomation(rule.id,{trigger:e.target.value as Trigger})}>{triggers.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>{["after_songs","after_items","at_minute"].includes(rule.trigger)&&<input className="input small-number" type="number" min="0" value={rule.amount} onChange={e=>patchAutomation(rule.id,{amount:Number(e.target.value)})}/>} {rule.trigger==="at_time"&&<input className="input" type="time" value={rule.time} onChange={e=>patchAutomation(rule.id,{time:e.target.value})}/>}<select className="select" value={rule.action} onChange={e=>patchAutomation(rule.id,{action:e.target.value as Action})}>{actions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div><input className="input" value={rule.value} onChange={e=>patchAutomation(rule.id,{value:e.target.value})} placeholder="Wat moet VLACORA dan doen/tonen?"/><div className="automation-readable"><strong>{triggerLabel(rule)}</strong><span>→</span><strong>{actionLabel(rule)}</strong><span>{rule.value||"…"}</span></div></div><div className="dynamic-order"><button className="mini-btn" onClick={()=>patch({automations:move(draft.automations,rule.id,-1)})}>↑</button><button className="mini-btn" onClick={()=>patch({automations:move(draft.automations,rule.id,1)})}>↓</button><button className="mini-btn danger" onClick={()=>patch({automations:draft.automations.filter(x=>x.id!==rule.id)})}>×</button></div></div>)}</div><div className="template-execution-note"><strong>Wat is al echt automatisch?</strong><span>VLACORA bewaart deze workflowregels centraal en gebruikt ze uitsluitend binnen de HUB voor instructies, meldingen, taken en redactionele controlepunten.</span></div></div>
        </>}
      </div>
    </div>
  </div>
}
