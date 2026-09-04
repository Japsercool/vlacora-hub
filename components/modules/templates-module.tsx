"use client";

import { useCallback,useEffect,useMemo,useState } from "react";
import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";

type FieldType="text"|"textarea"|"number"|"date"|"time"|"select"|"checkbox";
type TemplateField={id:string;label:string;type:FieldType;required:boolean;options:string[]};
type Trigger="on_start"|"before_deadline"|"at_time"|"on_status"|"on_finish"|"after_songs"|"after_items"|"at_minute";
type Action="instruction"|"notification"|"task"|"check"|"approval"|"assign"|"playlist_marker";
type Automation={id:string;trigger:Trigger;amount:number;time:string;action:Action;value:string;when?:string};
type Template={id:string;station_slug:string|null;name:string;category:string;description:string;fields:TemplateField[];automations:Automation[];active:boolean;created_at?:string;updated_at?:string};
type Preset="program"|"social"|"incident";

const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
const blank=():Template=>({id:`new-${uid()}`,station_slug:null,name:"Nieuwe workflow",category:"Algemeen",description:"",fields:[],automations:[],active:true});
const fieldTypes:[FieldType,string][]=[["text","Korte tekst"],["textarea","Lange tekst"],["number","Getal"],["date","Datum"],["time","Tijd"],["select","Keuzelijst"],["checkbox","Checkbox"]];
const triggers:[Trigger,string][]=[["on_start","Bij starten"],["before_deadline","Voor deadline"],["at_time","Op tijdstip"],["on_status","Bij statuswijziging"],["on_finish","Bij afronden"]];
const actions:[Action,string][]=[["instruction","Toon instructie"],["notification","Stuur teammelding"],["task","Maak taak"],["check","Controlepunt"],["approval","Vraag goedkeuring"],["assign","Wijs toe"]];

function isLegacyTrigger(trigger:Trigger){return trigger==="after_songs"||trigger==="after_items"||trigger==="at_minute"}
function triggerLabel(rule:Automation){
  if(rule.trigger==="before_deadline")return `${Math.max(0,rule.amount||1)} dag(en) voor deadline`;
  if(rule.trigger==="at_time")return `Om ${rule.time||"00:00"}`;
  if(rule.trigger==="on_status")return `Bij status “${rule.when||"…"}”`;
  if(rule.trigger==="after_songs")return `Legacy: na ${rule.amount||1} songs`;
  if(rule.trigger==="after_items")return `Legacy: na ${rule.amount||1} items`;
  if(rule.trigger==="at_minute")return `Legacy: op minuut ${rule.amount||0}`;
  return triggers.find(x=>x[0]===rule.trigger)?.[1]||rule.trigger;
}
function actionLabel(rule:Automation){
  if(rule.action==="playlist_marker")return "Legacy draaiboekactie";
  return actions.find(x=>x[0]===rule.action)?.[1]||rule.action;
}

function presetTemplate(kind:Preset):Template{
  const t=blank();
  if(kind==="program"){
    t.name="Programma voorbereiden";t.category="Programma";t.description="Vaste voorbereiding voor een uitzending: onderwerpen, verantwoordelijke punten en laatste controle.";
    t.fields=[{id:uid(),label:"Hoofdonderwerpen",type:"textarea",required:true,options:[]},{id:uid(),label:"Gasten / contacten",type:"textarea",required:false,options:[]},{id:uid(),label:"Audio en bestanden klaar",type:"checkbox",required:false,options:[]}];
    t.automations=[{id:uid(),trigger:"on_start",amount:0,time:"",action:"instruction",value:"Verdeel de voorbereiding binnen het programmateam"},{id:uid(),trigger:"before_deadline",amount:1,time:"",action:"notification",value:"Herinner verantwoordelijke aan de programma-voorbereiding"},{id:uid(),trigger:"on_finish",amount:0,time:"",action:"check",value:"Controleer of alle onderdelen klaar zijn"}];
  }
  if(kind==="social"){
    t.name="Social briefing & review";t.category="Social";t.description="Van briefing naar visual, copy, review en publicatieklaar.";
    t.fields=[{id:uid(),label:"Doel van de post",type:"textarea",required:true,options:[]},{id:uid(),label:"Kanaal",type:"select",required:true,options:["Instagram","Facebook","TikTok","LinkedIn"]},{id:uid(),label:"Deadline",type:"date",required:false,options:[]}];
    t.automations=[{id:uid(),trigger:"on_start",amount:0,time:"",action:"task",value:"Maak visual en caption"},{id:uid(),trigger:"on_status",amount:0,time:"",when:"Review",action:"approval",value:"Vraag review aan social verantwoordelijke"},{id:uid(),trigger:"before_deadline",amount:1,time:"",action:"notification",value:"Waarschuw als de post nog niet klaar is"}];
  }
  if(kind==="incident"){
    t.name="Meldpunt opvolging";t.category="Meldpunt";t.description="Standaard opvolging voor een melding: analyse, actie, controle en afsluiting.";
    t.fields=[{id:uid(),label:"Analyse",type:"textarea",required:true,options:[]},{id:uid(),label:"Actie uitgevoerd",type:"checkbox",required:false,options:[]},{id:uid(),label:"Controle / resultaat",type:"textarea",required:false,options:[]}];
    t.automations=[{id:uid(),trigger:"on_start",amount:0,time:"",action:"assign",value:"Wijs een behandelaar toe"},{id:uid(),trigger:"on_status",amount:0,time:"",when:"Opgelost",action:"check",value:"Controleer resultaat vóór afsluiten"}];
  }
  return t;
}

export default function TemplatesModule({stationSlug}:{stationSlug:string}){
  const[templates,setTemplates]=useState<Template[]>([]);
  const[selectedId,setSelectedId]=useState("");
  const[draft,setDraft]=useState<Template|null>(null);
  const[loading,setLoading]=useState(true);
  const[notice,setNotice]=useState("");
  const configured=isSupabaseBrowserConfigured();
  const flash=(x:string)=>{setNotice(x);window.setTimeout(()=>setNotice(""),2800)};

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
  useEffect(()=>{const item=templates.find(x=>x.id===selectedId);if(item)setDraft(structuredClone(item))},[selectedId,templates]);

  function newTemplate(preset?:Preset){const t=preset?presetTemplate(preset):blank();t.station_slug=stationSlug==="all"?"all":stationSlug;setDraft(t);setSelectedId(t.id)}
  function patch(p:Partial<Template>){if(draft)setDraft({...draft,...p})}
  function patchField(id:string,p:Partial<TemplateField>){if(draft)patch({fields:draft.fields.map(x=>x.id===id?{...x,...p}:x)})}
  function patchAutomation(id:string,p:Partial<Automation>){if(draft)patch({automations:draft.automations.map(x=>x.id===id?{...x,...p}:x)})}
  function move<T extends{id:string}>(rows:T[],id:string,dir:-1|1){const i=rows.findIndex(x=>x.id===id),j=i+dir;if(i<0||j<0||j>=rows.length)return rows;const n=[...rows];[n[i],n[j]]=[n[j],n[i]];return n}

  async function save(){
    if(!draft||!configured)return flash("Supabase-login is nodig om workflows centraal te bewaren.");
    if(!draft.name.trim())return flash("Geef de workflow een naam.");
    const supabase=createClient();const{data:user}=await supabase.auth.getUser();if(!user.user)return flash("Log opnieuw in.");
    const row={station_slug:draft.station_slug,name:draft.name.trim(),category:draft.category.trim()||"Algemeen",description:draft.description,fields:draft.fields,automations:draft.automations,active:draft.active,updated_by:user.user.id,updated_at:new Date().toISOString()};
    if(draft.id.startsWith("new-")){const{data,error}=await supabase.from("hub_templates").insert({...row,created_by:user.user.id}).select().single();if(error)return flash(error.message);setSelectedId(data.id);flash("Workflow aangemaakt")}
    else{const{error}=await supabase.from("hub_templates").update(row).eq("id",draft.id);if(error)return flash(error.message);flash("Workflow opgeslagen")}
    await load();
  }
  async function remove(){if(!draft||draft.id.startsWith("new-")||!configured)return;if(!confirm(`Workflow “${draft.name}” verwijderen?`))return;const{error}=await createClient().from("hub_templates").delete().eq("id",draft.id);if(error)return flash(error.message);setDraft(null);setSelectedId("");flash("Workflow verwijderd");await load()}
  function exportJson(){if(!draft)return;const blob=new Blob([JSON.stringify(draft,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${draft.name.replace(/[^a-z0-9]+/gi,"-").toLowerCase()}.pulse-workflow.json`;a.click();URL.revokeObjectURL(a.href)}

  const stepCount=useMemo(()=>draft?.automations.length||0,[draft]);
  return <div className="workflow-builder-v25">
    {notice&&<div className="inline-notice standalone">{notice}</div>}
    <div className="page-intro"><div><span className="eyebrow">BEHEER / PROCESSEN</span><h2>Workflowbouwer</h2><p>Maak één herbruikbare blauwdruk voor terugkerend teamwerk. Geen radio-regels: alleen velden, stappen, deadlines, meldingen en controles.</p></div><button className="primary" onClick={()=>newTemplate()}>+ Nieuwe workflow</button></div>
    <div className="workflow-use-grid"><button className="card" onClick={()=>newTemplate("program")}><strong>🎙 Programma voorbereiden</strong><span>Onderwerpen, materiaal en eindcontrole.</span></button><button className="card" onClick={()=>newTemplate("social")}><strong>✦ Social briefing & review</strong><span>Briefing → ontwerp → review → klaar.</span></button><button className="card" onClick={()=>newTemplate("incident")}><strong>! Meldpunt opvolging</strong><span>Analyse → actie → controle → afsluiten.</span></button></div>
    <div className="workflow-explainer card"><strong>Waarvoor dient dit?</strong><span>Een workflow is een <b>blauwdruk</b>. Je legt één keer vast welke informatie en stappen een terugkerend proces nodig heeft. Concrete modules kunnen die blauwdruk daarna gebruiken zonder telkens opnieuw een checklist of formulier te bedenken.</span></div>
    {!configured&&<div className="team-security-note"><strong>Supabase nodig</strong><span>Log in om workflows centraal te bewaren en met het team te delen.</span></div>}
    <div className="templates-layout">
      <div className="card template-list"><div className="module-title-row"><div><h3>Workflows</h3><small>{templates.length} opgeslagen</small></div><button className="mini-btn" onClick={()=>void load()}>↻</button></div>{loading?<p>laden…</p>:templates.length===0?<div className="empty-live-state compact"><strong>Nog geen workflows</strong><span>Kies hierboven een voorbeeld of start blanco.</span></div>:templates.map(t=><button className={`template-list-row ${selectedId===t.id?"selected":""}`} key={t.id} onClick={()=>setSelectedId(t.id)}><div><strong>{t.name}</strong><small>{t.category}</small></div><span>{t.automations.length?`${t.automations.length} stap${t.automations.length===1?"":"pen"}`:"Alleen velden"}</span></button>)}</div>
      <div className="template-editor-column">
        {!draft?<div className="card empty-live-state"><strong>Kies of maak een workflow</strong><span>Daarna bouw je de velden en processtappen rechts op.</span></div>:<>
          <div className="card template-editor"><div className="section-head"><div><span className="eyebrow">WORKFLOW</span><h2>{draft.name}</h2><p>{stepCount?`${stepCount} processtap${stepCount===1?"":"pen"}`:"Nog geen processtappen"}</p></div><label className="switch-line"><input type="checkbox" checked={draft.active} onChange={e=>patch({active:e.target.checked})}/><span>Actief</span></label></div><div className="two-form-cols"><label className="field">Naam<input className="input" value={draft.name} onChange={e=>patch({name:e.target.value})}/></label><label className="field">Categorie<input className="input" value={draft.category} onChange={e=>patch({category:e.target.value})}/></label></div><label className="field">Wanneer gebruik je dit?<textarea className="input textarea" value={draft.description} onChange={e=>patch({description:e.target.value})} placeholder="Bijvoorbeeld: elke week vóór de vrijdagavondshow…"/></label><div className="button-row"><button className="primary" onClick={()=>void save()}>Opslaan</button><button className="ghost" onClick={exportJson}>Export JSON</button>{!draft.id.startsWith("new-")&&<button className="ghost danger-text" onClick={()=>void remove()}>Verwijderen</button>}</div></div>

          <div className="card"><div className="section-head"><div><h3>Informatie die je nodig hebt</h3><p>Bepaal welke velden bij elke uitvoering ingevuld moeten worden.</p></div><button className="primary soft" onClick={()=>patch({fields:[...draft.fields,{id:uid(),label:`Nieuw veld ${draft.fields.length+1}`,type:"text",required:false,options:[]}]})}>+ Veld</button></div><div className="dynamic-fields-list">{draft.fields.length===0&&<div className="empty-live-state compact"><strong>Geen eigen velden</strong><span>Voeg alleen informatie toe die dit proces echt nodig heeft.</span></div>}{draft.fields.map((field,index)=><div className="dynamic-field-row" key={field.id}><div className="dynamic-order"><button className="mini-btn" onClick={()=>patch({fields:move(draft.fields,field.id,-1)})}>↑</button><button className="mini-btn" onClick={()=>patch({fields:move(draft.fields,field.id,1)})}>↓</button><span>{index+1}</span></div><input className="input" value={field.label} onChange={e=>patchField(field.id,{label:e.target.value})}/><select className="select" value={field.type} onChange={e=>patchField(field.id,{type:e.target.value as FieldType})}>{fieldTypes.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select><label className="mini-check"><input type="checkbox" checked={field.required} onChange={e=>patchField(field.id,{required:e.target.checked})}/> verplicht</label>{field.type==="select"&&<input className="input" value={field.options.join(", ")} onChange={e=>patchField(field.id,{options:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)})} placeholder="Optie 1, Optie 2"/>}<button className="mini-btn danger" onClick={()=>patch({fields:draft.fields.filter(x=>x.id!==field.id)})}>×</button></div>)}</div></div>

          <div className="card"><div className="section-head"><div><h3>Stappen & afspraken</h3><p>Leg vast wat op welk moment moet gebeuren. Nieuwe workflows gebruiken alleen algemene HUB-triggers.</p></div><button className="primary soft" onClick={()=>patch({automations:[...draft.automations,{id:uid(),trigger:"on_start",amount:0,time:"",action:"instruction",value:"Nieuwe processtap"}]})}>+ Processtap</button></div><div className="automation-list">{draft.automations.length===0&&<div className="empty-live-state compact"><strong>Nog geen stappen</strong><span>Dat is prima: een workflow kan ook alleen een herbruikbaar formulier zijn.</span></div>}{draft.automations.map((rule,index)=><div className={`automation-rule ${isLegacyTrigger(rule.trigger)?"legacy-rule":""}`} key={rule.id}><div className="automation-number">{index+1}</div><div className="automation-rule-main"><div className="automation-grid"><select className="select" value={isLegacyTrigger(rule.trigger)?rule.trigger:rule.trigger} onChange={e=>patchAutomation(rule.id,{trigger:e.target.value as Trigger})}>{isLegacyTrigger(rule.trigger)&&<option value={rule.trigger}>{triggerLabel(rule)}</option>}{triggers.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>{rule.trigger==="before_deadline"&&<input className="input small-number" type="number" min="0" value={rule.amount||1} onChange={e=>patchAutomation(rule.id,{amount:Number(e.target.value)})}/>} {rule.trigger==="at_time"&&<input className="input" type="time" value={rule.time} onChange={e=>patchAutomation(rule.id,{time:e.target.value})}/>} {rule.trigger==="on_status"&&<input className="input" value={rule.when||""} onChange={e=>patchAutomation(rule.id,{when:e.target.value})} placeholder="bv. Review"/>}<select className="select" value={rule.action} onChange={e=>patchAutomation(rule.id,{action:e.target.value as Action})}>{rule.action==="playlist_marker"&&<option value="playlist_marker">Legacy draaiboekactie</option>}{actions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div><input className="input" value={rule.value} onChange={e=>patchAutomation(rule.id,{value:e.target.value})} placeholder="Wat moet er gebeuren?"/><div className="automation-readable"><strong>{triggerLabel(rule)}</strong><span>→</span><strong>{actionLabel(rule)}</strong><span>{rule.value||"…"}</span></div>{isLegacyTrigger(rule.trigger)&&<small className="legacy-note">Oude radio-specifieke regel. Kies een nieuwe trigger om deze om te zetten naar een algemene HUB-workflow.</small>}</div><div className="dynamic-order"><button className="mini-btn" onClick={()=>patch({automations:move(draft.automations,rule.id,-1)})}>↑</button><button className="mini-btn" onClick={()=>patch({automations:move(draft.automations,rule.id,1)})}>↓</button><button className="mini-btn danger" onClick={()=>patch({automations:draft.automations.filter(x=>x.id!==rule.id)})}>×</button></div></div>)}</div><div className="template-execution-note"><strong>Bewust algemeen gehouden</strong><span>“Na 2 songs”, playlistmarkers en andere playout-termen zijn verwijderd uit nieuwe workflows. Oude opgeslagen regels blijven alleen zichtbaar zodat je ze veilig kunt omzetten of verwijderen.</span></div></div>
        </>}
      </div>
    </div>
  </div>;
}
