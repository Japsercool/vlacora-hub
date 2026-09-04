"use client";

import {
  useCallback,useEffect,useMemo,useRef,useState,
  type CSSProperties,type DragEvent as ReactDragEvent,type PointerEvent as ReactPointerEvent
} from "react";
import { can,type PermissionMap } from "@/lib/permissions";
import {
  deleteSocialAsset,deleteSocialTemplate,loadBrandKit,loadSocialAssets,loadSocialTemplates,saveSocialTemplate,uploadSocialAsset,
  type BrandKit,type SocialAsset,type SocialTemplate
} from "@/lib/supabase/social";
import {
  BUILDER_FONTS,BUILDER_FORMATS,BUILDER_STARTERS,BUILDER_VARIABLES,blankTemplate,cloneConfig,imageLayer,isBuilderConfig,
  renderBuilderCanvas,replaceBuilderVars,shapeLayer,starterTemplate,textLayer,type BuilderConfig,type BuilderFormatKey,type BuilderImageLayer,type BuilderLayer,
  type BuilderShapeLayer,type BuilderTextLayer
} from "@/lib/social-template-builder";

const sampleCtx={station:"VERSUZ",artist:"Lost Frequencies",title:"Black Friday",program:"Drive",presenter:"Jasper Cool",chartPosition:"1",previousPosition:"4",nextShow:"Fresh om 18:00",date:"03/09/2026",time:"16:00",cta:"Luister nu",artworkImage:""};
const formatLabels:Record<BuilderFormatKey,string>={"1:1":"Vierkant 1:1","4:5":"Post 4:5","9:16":"Story 9:16","16:9":"Banner 16:9"};
const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
type LeftTab="designs"|"layers"|"uploads";

type DragState={mode:"move"|"resize";layerId:string;startX:number;startY:number;initial:BuilderLayer;rect:DOMRect};

function asBuilder(template:SocialTemplate,brand:BrandKit):BuilderConfig{
  if(isBuilderConfig(template.config))return cloneConfig(template.config);
  const format=(template.aspect_ratio in BUILDER_FORMATS?template.aspect_ratio:"4:5") as BuilderFormatKey;
  const t=blankTemplate(template.station_slug||"all",brand,format);
  return cloneConfig(t.config as unknown as BuilderConfig);
}
function layerIcon(layer:BuilderLayer){return layer.type==="text"?"T":layer.type==="image"?"▧":"●"}
function cssColor(value:string){return value||"transparent"}
function maxZ(config:BuilderConfig){return Math.max(1,...config.layers.map(x=>x.z))+1}

export default function SocialTemplateBuilderModule({stationSlug,permissions}:{stationSlug:string;permissions?:PermissionMap|null}){
  const canView=!permissions||can(permissions.social_template_builder,"view");
  const canEdit=!permissions||can(permissions.social_template_builder,"edit");
  const canAdmin=!permissions||can(permissions.social_template_builder,"admin");
  const[brand,setBrand]=useState<BrandKit|null>(null);
  const[templates,setTemplates]=useState<SocialTemplate[]>([]);
  const[selectedTemplateId,setSelectedTemplateId]=useState("");
  const[draft,setDraft]=useState<SocialTemplate|null>(null);
  const[config,setConfig]=useState<BuilderConfig|null>(null);
  const[selectedLayerId,setSelectedLayerId]=useState("");
  const[assets,setAssets]=useState<SocialAsset[]>([]);
  const[notice,setNotice]=useState("");
  const[busy,setBusy]=useState(false);
  const[zoom,setZoom]=useState(45);
  const[history,setHistory]=useState<BuilderConfig[]>([]);
  const[future,setFuture]=useState<BuilderConfig[]>([]);
  const[assetUpload,setAssetUpload]=useState(false);
  const[leftTab,setLeftTab]=useState<LeftTab>("designs");
  const canvasRef=useRef<HTMLDivElement|null>(null);
  const dragRef=useRef<DragState|null>(null);

  const flash=useCallback((message:string)=>{setNotice(message);window.setTimeout(()=>setNotice(""),3200)},[]);

  useEffect(()=>{
    if(stationSlug==="all"||!canView)return;
    let alive=true;setBusy(true);
    Promise.all([loadBrandKit(stationSlug),loadSocialTemplates(stationSlug),loadSocialAssets(stationSlug)]).then(([b,t,a])=>{
      if(!alive)return;
      setBrand(b);setTemplates(t);setAssets(a);
      const first=t[0];
      if(first){setSelectedTemplateId(first.id);setDraft(first);setConfig(asBuilder(first,b))}
      else{const fresh=blankTemplate(stationSlug,b,"4:5");setTemplates([fresh]);setSelectedTemplateId(fresh.id);setDraft(fresh);setConfig(asBuilder(fresh,b))}
    }).catch(e=>flash(e instanceof Error?e.message:"Templatebouwer laden mislukt")).finally(()=>alive&&setBusy(false));
    return()=>{alive=false};
  },[stationSlug,canView,flash]);

  const selectedLayer=useMemo(()=>config?.layers.find(x=>x.id===selectedLayerId)||null,[config,selectedLayerId]);
  const sortedLayers=useMemo(()=>[...(config?.layers||[])].sort((a,b)=>b.z-a.z),[config]);

  function pushHistory(){if(!config)return;setHistory(rows=>[...rows.slice(-39),cloneConfig(config)]);setFuture([])}
  function setNext(next:BuilderConfig,record=true){if(record&&config)setHistory(rows=>[...rows.slice(-39),cloneConfig(config)]);if(record)setFuture([]);setConfig(next)}
  function patchCanvas(patch:Partial<BuilderConfig["canvas"]>){if(!config)return;setNext({...config,canvas:{...config.canvas,...patch}})}
  function patchLayer(id:string,patch:Partial<BuilderLayer>,record=true){if(!config)return;setNext({...config,layers:config.layers.map(x=>x.id===id?({...x,...patch} as BuilderLayer):x)},record)}
  function undo(){if(!config||!history.length)return;const previous=history[history.length-1];setFuture(rows=>[cloneConfig(config),...rows].slice(0,40));setHistory(rows=>rows.slice(0,-1));setConfig(cloneConfig(previous))}
  function redo(){if(!config||!future.length)return;const next=future[0];setHistory(rows=>[...rows,cloneConfig(config)].slice(-40));setFuture(rows=>rows.slice(1));setConfig(cloneConfig(next))}

  function selectTemplate(template:SocialTemplate){if(!brand)return;setSelectedTemplateId(template.id);setDraft(template);setConfig(asBuilder(template,brand));setSelectedLayerId("");setHistory([]);setFuture([])}
  function createBlank(){if(!brand)return;const t=blankTemplate(stationSlug,brand,"4:5");setTemplates(rows=>[t,...rows]);selectTemplate(t);setLeftTab("layers")}
  function createStarter(index:number){const preset=BUILDER_STARTERS[index];if(!preset)return;const t=starterTemplate(stationSlug,preset);setTemplates(rows=>[t,...rows]);selectTemplate(t);setLeftTab("layers")}
  function changeFormat(format:BuilderFormatKey){
    if(!config||!draft)return;
    const f=BUILDER_FORMATS[format],sx=f.width/config.canvas.width,sy=f.height/config.canvas.height;
    const next={...config,canvas:{...config.canvas,width:f.width,height:f.height},layers:config.layers.map(layer=>({...layer,x:Math.round(layer.x*sx),y:Math.round(layer.y*sy),width:Math.max(10,Math.round(layer.width*sx)),height:Math.max(10,Math.round(layer.height*sy))}))};
    setNext(next);setDraft({...draft,aspect_ratio:format});setSelectedLayerId("");
  }

  function addText(value="Nieuwe tekst"){
    if(!config||!canEdit)return;
    const layer=textLayer(`Tekst ${config.layers.filter(x=>x.type==="text").length+1}`,value,80,110,Math.min(780,config.canvas.width-160),145,{z:maxZ(config)});
    setNext({...config,layers:[...config.layers,layer]});setSelectedLayerId(layer.id);setLeftTab("layers");
  }
  function addImage(source:"post-image"|"brand-logo"|"asset"="post-image",src=""){
    if(!config||!canEdit)return;
    const layer=imageLayer(source==="post-image"?"Invulbare foto":source==="brand-logo"?"Stationlogo":"Afbeelding",source,100,180,Math.min(650,config.canvas.width-200),Math.min(650,config.canvas.height-300),{src,z:maxZ(config),borderRadius:24});
    setNext({...config,layers:[...config.layers,layer]});setSelectedLayerId(layer.id);setLeftTab("layers");
  }
  function addShape(shape:"rect"|"ellipse"|"line"="rect"){
    if(!config||!canEdit)return;
    const layer=shapeLayer(shape==="ellipse"?"Cirkel / ovaal":shape==="line"?"Lijn":"Rechthoek",shape,100,180,420,220,{z:maxZ(config)});
    setNext({...config,layers:[...config.layers,layer]});setSelectedLayerId(layer.id);setLeftTab("layers");
  }
  function duplicateLayer(){
    if(!config||!selectedLayer||!canEdit)return;
    const copy={...structuredClone(selectedLayer),id:`layer-${uid()}`,name:`${selectedLayer.name} kopie`,x:selectedLayer.x+24,y:selectedLayer.y+24,z:maxZ(config)} as BuilderLayer;
    setNext({...config,layers:[...config.layers,copy]});setSelectedLayerId(copy.id);
  }
  function deleteLayer(){if(!config||!selectedLayer||!canEdit)return;setNext({...config,layers:config.layers.filter(x=>x.id!==selectedLayer.id)});setSelectedLayerId("")}
  function layerOrder(id:string,delta:number){if(!config)return;const layer=config.layers.find(x=>x.id===id);if(!layer)return;patchLayer(id,{z:Math.max(0,layer.z+delta)})}
  function alignSelected(direction:"left"|"center"|"right"|"top"|"middle"|"bottom"){
    if(!config||!selectedLayer||!canEdit)return;
    const p:Partial<BuilderLayer>={};
    if(direction==="left")p.x=0;
    if(direction==="center")p.x=Math.round((config.canvas.width-selectedLayer.width)/2);
    if(direction==="right")p.x=Math.round(config.canvas.width-selectedLayer.width);
    if(direction==="top")p.y=0;
    if(direction==="middle")p.y=Math.round((config.canvas.height-selectedLayer.height)/2);
    if(direction==="bottom")p.y=Math.round(config.canvas.height-selectedLayer.height);
    patchLayer(selectedLayer.id,p);
  }

  function pointerStart<T extends HTMLElement>(ev:ReactPointerEvent<T>,layer:BuilderLayer,mode:"move"|"resize"){
    if(!config||!canEdit||layer.locked)return;
    ev.preventDefault();ev.stopPropagation();
    const rect=canvasRef.current?.getBoundingClientRect();if(!rect)return;
    pushHistory();dragRef.current={mode,layerId:layer.id,startX:ev.clientX,startY:ev.clientY,initial:structuredClone(layer),rect};setSelectedLayerId(layer.id);
    const onMove=(event:PointerEvent)=>{
      const drag=dragRef.current;if(!drag)return;
      const live=config;const scaleX=live.canvas.width/drag.rect.width,scaleY=live.canvas.height/drag.rect.height;
      const dx=(event.clientX-drag.startX)*scaleX,dy=(event.clientY-drag.startY)*scaleY,snap=live.canvas.snap?10:1,round=(v:number)=>Math.round(v/snap)*snap;
      if(drag.mode==="move")patchLayer(drag.layerId,{x:round(Math.max(0,Math.min(live.canvas.width-drag.initial.width,drag.initial.x+dx))),y:round(Math.max(0,Math.min(live.canvas.height-drag.initial.height,drag.initial.y+dy)))},false);
      else patchLayer(drag.layerId,{width:round(Math.max(30,Math.min(live.canvas.width-drag.initial.x,drag.initial.width+dx))),height:round(Math.max(30,Math.min(live.canvas.height-drag.initial.y,drag.initial.height+dy)))},false);
    };
    const onUp=()=>{dragRef.current=null;window.removeEventListener("pointermove",onMove);window.removeEventListener("pointerup",onUp)};
    window.addEventListener("pointermove",onMove);window.addEventListener("pointerup",onUp);
  }

  useEffect(()=>{
    const handler=(ev:KeyboardEvent)=>{
      const target=ev.target as HTMLElement|null;if(target&&["INPUT","TEXTAREA","SELECT"].includes(target.tagName))return;
      const cmd=ev.ctrlKey||ev.metaKey;
      if(cmd&&ev.key.toLowerCase()==="z"){ev.preventDefault();ev.shiftKey?redo():undo();return}
      if(cmd&&ev.key.toLowerCase()==="y"){ev.preventDefault();redo();return}
      if(cmd&&ev.key.toLowerCase()==="d"){ev.preventDefault();duplicateLayer();return}
      if((ev.key==="Delete"||ev.key==="Backspace")&&selectedLayer){ev.preventDefault();deleteLayer();return}
      if(!selectedLayer||!canEdit)return;
      const amount=ev.shiftKey?10:1;
      if(ev.key==="ArrowLeft"){ev.preventDefault();patchLayer(selectedLayer.id,{x:Math.max(0,selectedLayer.x-amount)})}
      if(ev.key==="ArrowRight"){ev.preventDefault();patchLayer(selectedLayer.id,{x:Math.min((config?.canvas.width||0)-selectedLayer.width,selectedLayer.x+amount)})}
      if(ev.key==="ArrowUp"){ev.preventDefault();patchLayer(selectedLayer.id,{y:Math.max(0,selectedLayer.y-amount)})}
      if(ev.key==="ArrowDown"){ev.preventDefault();patchLayer(selectedLayer.id,{y:Math.min((config?.canvas.height||0)-selectedLayer.height,selectedLayer.y+amount)})}
    };
    window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler);
  },[selectedLayer,config,canEdit,history,future]);

  async function save(){
    if(!draft||!config||!canEdit)return;setBusy(true);
    try{const saved=await saveSocialTemplate({...draft,config:config as unknown as Record<string,unknown>});setTemplates(rows=>[saved,...rows.filter(x=>x.id!==draft.id&&x.id!==saved.id)]);setDraft(saved);setSelectedTemplateId(saved.id);setHistory([]);setFuture([]);flash("Template centraal opgeslagen")}
    catch(e){flash(e instanceof Error?e.message:"Opslaan mislukt")}finally{setBusy(false)}
  }
  async function removeTemplate(){if(!draft||draft.id.startsWith("new-")||!canAdmin)return;if(!confirm(`Template “${draft.name}” verwijderen?`))return;try{await deleteSocialTemplate(draft.id);const next=templates.filter(x=>x.id!==draft.id);setTemplates(next);setDraft(null);setConfig(null);setSelectedTemplateId("");if(next[0])selectTemplate(next[0]);flash("Template verwijderd")}catch(e){flash(e instanceof Error?e.message:"Verwijderen mislukt")}}
  async function duplicateTemplate(){if(!draft||!config||!canEdit)return;const copy={...draft,id:`new-${uid()}`,name:`${draft.name} kopie`,config:cloneConfig(config) as unknown as Record<string,unknown>};setTemplates(rows=>[copy,...rows]);selectTemplate(copy)}
  async function downloadPng(){if(!draft||!config||!brand)return;const canvas=await renderBuilderCanvas(config,{...sampleCtx,artworkImage:assets[0]?.public_url||""},brand);const a=document.createElement("a");a.href=canvas.toDataURL("image/png");a.download=`${draft.name}.png`.replace(/[^a-z0-9._-]+/gi,"-").toLowerCase();a.click()}

  async function uploadAsset(file:File|undefined,placement?:{x:number;y:number}){
    if(!file||!config||!canEdit)return;setAssetUpload(true);
    try{
      const asset=await uploadSocialAsset(stationSlug,file,["template-builder"]);setAssets(rows=>[asset,...rows]);
      const width=Math.min(620,Math.max(260,config.canvas.width*.48)),height=Math.min(620,Math.max(260,config.canvas.height*.34));
      const x=Math.max(0,Math.min(config.canvas.width-width,placement?.x??Math.max(40,(config.canvas.width-width)/2))),y=Math.max(0,Math.min(config.canvas.height-height,placement?.y??Math.max(40,(config.canvas.height-height)/2)));
      const layer=imageLayer(asset.name||"Afbeelding","asset",Math.round(x),Math.round(y),Math.round(width),Math.round(height),{src:asset.public_url,z:maxZ(config),borderRadius:18});
      setNext({...config,layers:[...config.layers,layer]});setSelectedLayerId(layer.id);setLeftTab("layers");flash("Afbeelding op canvas geplaatst");
    }catch(e){flash(e instanceof Error?e.message:"Upload mislukt")}finally{setAssetUpload(false)}
  }
  async function uploadBackground(file:File|undefined){if(!file||!config||!canEdit)return;setAssetUpload(true);try{const asset=await uploadSocialAsset(stationSlug,file,["template-background"]);setAssets(rows=>[asset,...rows]);patchCanvas({backgroundImage:asset.public_url});flash("Achtergrond ingesteld")}catch(e){flash(e instanceof Error?e.message:"Upload mislukt")}finally{setAssetUpload(false)}}
  function dropImage(ev:ReactDragEvent<HTMLDivElement>){ev.preventDefault();ev.stopPropagation();if(!config||!canEdit)return;const file=Array.from(ev.dataTransfer.files||[]).find(f=>f.type.startsWith("image/"));if(!file)return;const rect=canvasRef.current?.getBoundingClientRect();if(!rect)return void uploadAsset(file);const x=(ev.clientX-rect.left)*(config.canvas.width/rect.width),y=(ev.clientY-rect.top)*(config.canvas.height/rect.height);void uploadAsset(file,{x:x-180,y:y-180})}
  async function removeAsset(asset:SocialAsset){if(!canAdmin||!confirm(`Asset “${asset.name}” verwijderen?`))return;try{await deleteSocialAsset(asset);setAssets(rows=>rows.filter(x=>x.id!==asset.id))}catch(e){flash(e instanceof Error?e.message:"Asset verwijderen mislukt")}}

  if(!canView)return <div className="card empty-live-state"><strong>Geen toegang tot Social templatebouwer</strong><span>Een beheerder kan dit recht per gebruiker instellen.</span></div>;
  if(stationSlug==="all")return <div className="card empty-live-state"><strong>Kies één station</strong><span>Social templates en assets zijn station-specifiek.</span></div>;

  const canvasScale=zoom/100;
  const stageBackground=config?.canvas.backgroundImage?`url(${config.canvas.backgroundImage})`:config?.canvas.gradient?`linear-gradient(${config.canvas.gradientAngle??145}deg,${config.canvas.background},${config.canvas.background2})`:undefined;

  return <div className="mini-canva-shell">
    <div className="page-intro mini-canva-intro"><div><span className="eyebrow">SOCIAL / MINI CANVA</span><h2>Social templatebouwer</h2><p>Ontwerp visueel: sleep lagen op het canvas, upload foto&apos;s, kies fonts en bouw herbruikbare templates voor je team.</p></div><div className="button-row"><button className="ghost" disabled={!draft||!config} onClick={()=>void downloadPng()}>PNG test</button><button className="ghost" disabled={!draft||!canEdit} onClick={()=>void duplicateTemplate()}>Dupliceer</button><button className="primary" disabled={!draft||!config||busy||!canEdit} onClick={()=>void save()}>{busy?"Opslaan…":"Template opslaan"}</button></div></div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}

    <div className="mini-canva-toolbar card">
      <div className="builder-tool-group"><button disabled={!canEdit} onClick={()=>addText()}>T Tekst</button><label className={`builder-toolbar-upload ${!canEdit||assetUpload?"disabled":""}`}>{assetUpload?"Uploaden…":"▧ Afbeelding"}<input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={!canEdit||assetUpload} onChange={e=>{void uploadAsset(e.target.files?.[0]);e.currentTarget.value=""}}/></label><button disabled={!canEdit} onClick={()=>addImage("post-image")}>▧ Invulbare foto</button><button disabled={!canEdit} onClick={()=>addImage("brand-logo")}>Logo</button><button disabled={!canEdit} onClick={()=>addShape("rect")}>▰ Vorm</button><button disabled={!canEdit} onClick={()=>addShape("ellipse")}>● Cirkel</button><button disabled={!canEdit} onClick={()=>addShape("line")}>━ Lijn</button></div>
      <div className="builder-tool-group"><button disabled={!history.length} onClick={undo}>↶</button><button disabled={!future.length} onClick={redo}>↷</button><span className="toolbar-divider"/><button disabled={!selectedLayer||!canEdit} onClick={duplicateLayer}>⧉</button><button disabled={!selectedLayer||!canEdit} onClick={deleteLayer}>⌫</button></div>
      <div className="builder-tool-group builder-zoom"><button onClick={()=>setZoom(z=>Math.max(25,z-5))}>−</button><strong>{zoom}%</strong><button onClick={()=>setZoom(z=>Math.min(100,z+5))}>＋</button></div>
    </div>

    <div className="mini-canva-layout">
      <aside className="mini-canva-left card">
        <div className="mini-canva-left-tabs"><button className={leftTab==="designs"?"active":""} onClick={()=>setLeftTab("designs")}>Ontwerpen</button><button className={leftTab==="layers"?"active":""} onClick={()=>setLeftTab("layers")}>Lagen</button><button className={leftTab==="uploads"?"active":""} onClick={()=>setLeftTab("uploads")}>Uploads</button></div>
        {leftTab==="designs"&&<div className="mini-canva-panel-body"><div className="mini-canva-panel-head"><strong>Jouw templates</strong><button className="mini-btn" disabled={!canEdit} onClick={createBlank}>＋</button></div><div className="builder-template-list">{templates.map(t=><button key={t.id} className={selectedTemplateId===t.id?"selected":""} onClick={()=>selectTemplate(t)}><span>{t.name.slice(0,1).toUpperCase()}</span><div><strong>{t.name}</strong><small>{t.aspect_ratio} • {t.content_type}</small></div></button>)}</div><div className="mini-design-heading"><strong>PULSE ontwerpen</strong><span>Startpunt — daarna volledig aanpasbaar</span></div><div className="mini-design-grid">{BUILDER_STARTERS.map((s,i)=><button key={s.name} disabled={!canEdit} onClick={()=>createStarter(i)}><span className={`mini-design-thumb type-${s.contentType}`}><b>{s.contentType.toUpperCase()}</b><em>{s.name}</em></span><strong>{s.name}</strong><small>{s.format}</small></button>)}</div></div>}
        {leftTab==="layers"&&<div className="mini-canva-panel-body"><div className="mini-canva-panel-head"><strong>Lagen</strong><span>{config?.layers.length||0}</span></div><div className="builder-layer-list">{sortedLayers.map(layer=><button key={layer.id} className={selectedLayerId===layer.id?"selected":""} onClick={()=>setSelectedLayerId(layer.id)}><span className="layer-icon">{layerIcon(layer)}</span><strong>{layer.name}</strong><span className="layer-actions"><i onClick={e=>{e.stopPropagation();patchLayer(layer.id,{hidden:!layer.hidden})}}>{layer.hidden?"◌":"◉"}</i><i onClick={e=>{e.stopPropagation();patchLayer(layer.id,{locked:!layer.locked})}}>{layer.locked?"🔒":"○"}</i></span></button>)}</div></div>}
        {leftTab==="uploads"&&<div className="mini-canva-panel-body"><label className={`mini-canva-upload ${!canEdit||assetUpload?"disabled":""}`}>＋ Upload afbeelding<input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={!canEdit||assetUpload} onChange={e=>{void uploadAsset(e.target.files?.[0]);e.currentTarget.value=""}}/></label><p className="mini-canva-help">Je kunt een PNG/JPG/WebP ook rechtstreeks vanuit Windows op het canvas slepen.</p><div className="mini-upload-grid">{assets.map(a=><button key={a.id} onClick={()=>addImage("asset",a.public_url)}><img src={a.public_url} alt=""/><span>{a.name}</span></button>)}</div></div>}
      </aside>

      <main className="mini-canva-stage card" onClick={()=>setSelectedLayerId("")}>
        {!draft||!config||!brand?<div className="empty-live-state"><strong>{busy?"Templates laden…":"Kies een template"}</strong><span>Of start links vanaf een leeg ontwerp.</span></div>:<>
          <div className="mini-canva-documentbar"><div><input value={draft.name} disabled={!canEdit} onChange={e=>setDraft({...draft,name:e.target.value})}/><span>{config.canvas.width} × {config.canvas.height}px</span></div><div><select value={draft.aspect_ratio} disabled={!canEdit} onChange={e=>changeFormat(e.target.value as BuilderFormatKey)}>{(Object.keys(BUILDER_FORMATS) as BuilderFormatKey[]).map(k=><option key={k} value={k}>{formatLabels[k]}</option>)}</select><label><input type="checkbox" checked={config.canvas.grid} onChange={e=>patchCanvas({grid:e.target.checked})}/> Raster</label><label><input type="checkbox" checked={config.canvas.snap} onChange={e=>patchCanvas({snap:e.target.checked})}/> Snap</label></div></div>
          <div className="mini-canva-stage-scroll" onDragOver={e=>{if(canEdit)e.preventDefault()}} onDrop={dropImage}>
            <div ref={canvasRef} className={`builder-artboard ${config.canvas.grid?"show-grid":""}`} style={{width:config.canvas.width*canvasScale,height:config.canvas.height*canvasScale,backgroundImage:stageBackground,backgroundColor:config.canvas.background,backgroundSize:"cover",backgroundPosition:"center"}} onClick={e=>e.stopPropagation()}>
              {config.layers.filter(x=>!x.hidden).sort((a,b)=>a.z-b.z).map(layer=>{
                const common={left:layer.x*canvasScale,top:layer.y*canvasScale,width:layer.width*canvasScale,height:layer.height*canvasScale,opacity:layer.opacity,transform:`rotate(${layer.rotation}deg)`,zIndex:layer.z} as CSSProperties;
                return <div key={layer.id} className={`builder-canvas-layer ${selectedLayerId===layer.id?"selected":""} ${layer.locked?"locked":""}`} style={common} onPointerDown={e=>pointerStart(e,layer,"move")} onClick={e=>{e.stopPropagation();setSelectedLayerId(layer.id)}}>
                  <LayerVisual layer={layer} brand={brand} assets={assets} canvasScale={canvasScale}/>
                  {selectedLayerId===layer.id&&!layer.locked&&<><span className="builder-resize-handle" onPointerDown={e=>pointerStart(e,layer,"resize")}/><span className="builder-selection-label">{layer.name}</span></>}
                </div>;
              })}
            </div>
          </div>
          <div className="builder-safe-note"><b>Mini Canva:</b> slepen = verplaatsen • hoek = schalen • pijltjes = 1px, Shift+pijltje = 10px • Ctrl/Cmd+D = dupliceren • Delete = verwijderen.</div>
        </>}
      </main>

      <aside className="mini-canva-right">
        {draft&&config&&<section className="card builder-document-inspector"><span className="eyebrow">DOCUMENT</span><label>Naam<input value={draft.name} disabled={!canEdit} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>Contenttype<select value={draft.content_type} disabled={!canEdit} onChange={e=>setDraft({...draft,content_type:e.target.value})}><option value="music">Nieuwe muziek</option><option value="chart">Hitlijst</option><option value="program">Programma</option><option value="presenter">Presentator</option><option value="event">Event</option><option value="quote">Quote</option><option value="custom">Vrij</option></select></label><label>Caption-template<textarea value={draft.caption_template} disabled={!canEdit} onChange={e=>setDraft({...draft,caption_template:e.target.value})}/></label></section>}
        {config&&!selectedLayer&&<CanvasInspector config={config} assets={assets} canEdit={canEdit} busy={assetUpload} onPatch={patchCanvas} onUpload={uploadBackground}/>} 
        {selectedLayer&&<LayerInspector layer={selectedLayer} canEdit={canEdit} assets={assets} onPatch={patch=>patchLayer(selectedLayer.id,patch)} onForward={()=>layerOrder(selectedLayer.id,1)} onBackward={()=>layerOrder(selectedLayer.id,-1)} onDelete={deleteLayer} onAlign={alignSelected}/>} 
        {!selectedLayer&&config&&<section className="card mini-canva-tip"><strong>Canvas geselecteerd</strong><span>Klik op een laag om tekst, font, foto, kleur, positie en formaat te bewerken.</span></section>}
        {canAdmin&&draft&&!draft.id.startsWith("new-")&&<button className="ghost danger-text wide" onClick={()=>void removeTemplate()}>Template verwijderen</button>}
      </aside>
    </div>
  </div>;
}

function LayerVisual({layer,brand,assets,canvasScale}:{layer:BuilderLayer;brand:BrandKit;assets:SocialAsset[];canvasScale:number}){
  if(layer.type==="shape")return layer.shape==="ellipse"?<div className="builder-shape ellipse" style={{background:cssColor(layer.fill),border:`${layer.strokeWidth*canvasScale}px solid ${cssColor(layer.stroke)}`}}/>:layer.shape==="line"?<div className="builder-line" style={{borderTop:`${Math.max(1,layer.strokeWidth*canvasScale)}px solid ${cssColor(layer.stroke)}`}}/>:<div className="builder-shape" style={{background:cssColor(layer.fill),border:`${layer.strokeWidth*canvasScale}px solid ${cssColor(layer.stroke)}`,borderRadius:layer.borderRadius*canvasScale}}/>;
  if(layer.type==="image"){
    const src=layer.source==="brand-logo"?brand.logo_url:layer.source==="post-image"?(sampleCtx.artworkImage||assets[0]?.public_url):layer.src;
    return <div className="builder-image-layer" style={{borderRadius:layer.borderRadius*canvasScale,border:`${layer.borderWidth*canvasScale}px solid ${cssColor(layer.borderColor)}`}}>{src?<img src={src} style={{objectFit:layer.fit,objectPosition:`${layer.positionX??50}% ${layer.positionY??50}%`}} alt=""/>:<span>FOTO</span>}</div>;
  }
  return <div className="builder-text-layer" style={{fontFamily:layer.fontFamily,fontSize:layer.fontSize*canvasScale,fontWeight:layer.fontWeight,color:layer.color,textAlign:layer.align,lineHeight:layer.lineHeight,letterSpacing:layer.letterSpacing*canvasScale,textTransform:layer.textTransform,background:cssColor(layer.background),borderRadius:layer.borderRadius*canvasScale,padding:layer.padding*canvasScale,WebkitTextStroke:layer.strokeWidth?`${layer.strokeWidth*canvasScale}px ${layer.stroke}`:undefined}}>{replaceBuilderVars(layer.text,sampleCtx)}</div>;
}

function CanvasInspector({config,assets,canEdit,busy,onPatch,onUpload}:{config:BuilderConfig;assets:SocialAsset[];canEdit:boolean;busy:boolean;onPatch:(p:Partial<BuilderConfig["canvas"]>)=>void;onUpload:(file:File|undefined)=>Promise<void>}){
  return <section className="card builder-canvas-inspector"><div className="section-head"><div><span className="eyebrow">CANVAS</span><h3>Achtergrond</h3></div></div><div className="builder-two-inputs"><label>Kleur 1<input type="color" value={config.canvas.background} disabled={!canEdit} onChange={e=>onPatch({background:e.target.value})}/></label><label>Kleur 2<input type="color" value={config.canvas.background2} disabled={!canEdit} onChange={e=>onPatch({background2:e.target.value})}/></label></div><label className="switch-line"><input type="checkbox" checked={config.canvas.gradient} disabled={!canEdit} onChange={e=>onPatch({gradient:e.target.checked})}/><span>Gradient</span></label>{config.canvas.gradient&&<label>Gradienthoek<input type="range" min="0" max="360" value={config.canvas.gradientAngle??145} disabled={!canEdit} onChange={e=>onPatch({gradientAngle:Number(e.target.value)})}/><small>{config.canvas.gradientAngle??145}°</small></label>}<div className="asset-mini-grid"><button disabled={!canEdit} onClick={()=>onPatch({backgroundImage:""})}>Geen foto</button>{assets.slice(0,12).map(a=><button key={a.id} onClick={()=>onPatch({backgroundImage:a.public_url})}><img src={a.public_url} alt=""/></button>)}</div><label className="ghost file-button">{busy?"Uploaden…":"＋ Achtergrond uploaden"}<input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={!canEdit||busy} onChange={e=>{void onUpload(e.target.files?.[0]);e.currentTarget.value=""}}/></label></section>;
}

function LayerInspector({layer,canEdit,assets,onPatch,onForward,onBackward,onDelete,onAlign}:{layer:BuilderLayer;canEdit:boolean;assets:SocialAsset[];onPatch:(patch:Partial<BuilderLayer>)=>void;onForward:()=>void;onBackward:()=>void;onDelete:()=>void;onAlign:(d:"left"|"center"|"right"|"top"|"middle"|"bottom")=>void}){
  const patch=(p:Partial<BuilderLayer>)=>{if(canEdit)onPatch(p)};
  return <section className="card builder-layer-inspector"><div className="section-head"><div><span className="eyebrow">LAAG</span><h3>{layer.name}</h3></div><span className="layer-type-chip">{layer.type}</span></div><label>Naam<input value={layer.name} disabled={!canEdit} onChange={e=>patch({name:e.target.value})}/></label><div className="builder-four-inputs"><label>X<input type="number" value={Math.round(layer.x)} disabled={!canEdit} onChange={e=>patch({x:Number(e.target.value)})}/></label><label>Y<input type="number" value={Math.round(layer.y)} disabled={!canEdit} onChange={e=>patch({y:Number(e.target.value)})}/></label><label>B<input type="number" value={Math.round(layer.width)} disabled={!canEdit} onChange={e=>patch({width:Number(e.target.value)})}/></label><label>H<input type="number" value={Math.round(layer.height)} disabled={!canEdit} onChange={e=>patch({height:Number(e.target.value)})}/></label></div><div className="builder-two-inputs"><label>Rotatie<input type="number" value={layer.rotation} disabled={!canEdit} onChange={e=>patch({rotation:Number(e.target.value)})}/></label><label>Dekking<input type="range" min="0" max="100" value={Math.round(layer.opacity*100)} disabled={!canEdit} onChange={e=>patch({opacity:Number(e.target.value)/100})}/></label></div><div className="mini-align-grid"><button disabled={!canEdit} onClick={()=>onAlign("left")}>←</button><button disabled={!canEdit} onClick={()=>onAlign("center")}>↔</button><button disabled={!canEdit} onClick={()=>onAlign("right")}>→</button><button disabled={!canEdit} onClick={()=>onAlign("top")}>↑</button><button disabled={!canEdit} onClick={()=>onAlign("middle")}>↕</button><button disabled={!canEdit} onClick={()=>onAlign("bottom")}>↓</button></div><div className="button-row compact"><button disabled={!canEdit} onClick={onForward}>Naar voren</button><button disabled={!canEdit} onClick={onBackward}>Naar achter</button></div>
    {layer.type==="text"&&<TextInspector layer={layer} canEdit={canEdit} onPatch={p=>onPatch(p as Partial<BuilderLayer>)}/>} 
    {layer.type==="image"&&<ImageInspector layer={layer} canEdit={canEdit} assets={assets} onPatch={p=>onPatch(p as Partial<BuilderLayer>)}/>} 
    {layer.type==="shape"&&<ShapeInspector layer={layer} canEdit={canEdit} onPatch={p=>onPatch(p as Partial<BuilderLayer>)}/>} 
    <div className="builder-layer-flags"><label><input type="checkbox" checked={layer.locked} disabled={!canEdit} onChange={e=>patch({locked:e.target.checked})}/> Vergrendel</label><label><input type="checkbox" checked={layer.hidden} disabled={!canEdit} onChange={e=>patch({hidden:e.target.checked})}/> Verberg</label></div><button className="ghost danger-text wide" disabled={!canEdit} onClick={onDelete}>Laag verwijderen</button></section>;
}

function TextInspector({layer,canEdit,onPatch}:{layer:BuilderTextLayer;canEdit:boolean;onPatch:(p:Partial<BuilderTextLayer>)=>void}){
  const fontKnown=BUILDER_FONTS.some(f=>f.value===layer.fontFamily);
  return <div className="builder-subinspector"><label>Tekst<textarea value={layer.text} disabled={!canEdit} onChange={e=>onPatch({text:e.target.value})}/></label><div className="builder-variable-buttons">{BUILDER_VARIABLES.map(v=><button key={v} disabled={!canEdit} onClick={()=>onPatch({text:`${layer.text}${layer.text.endsWith(" ")?"":" "}${v}`})}>{v}</button>)}</div><label>Lettertype<select className="font-family-select" value={fontKnown?layer.fontFamily:"__custom"} disabled={!canEdit} onChange={e=>{if(e.target.value!=="__custom")onPatch({fontFamily:e.target.value})}} style={{fontFamily:layer.fontFamily}}>{BUILDER_FONTS.map(f=><option key={f.value} value={f.value} style={{fontFamily:f.value}}>{f.label}</option>)}{!fontKnown&&<option value="__custom">Aangepast: {layer.fontFamily}</option>}</select></label>{!fontKnown&&<label>Aangepast font<input value={layer.fontFamily} disabled={!canEdit} onChange={e=>onPatch({fontFamily:e.target.value})}/></label>}<div className="font-preview-line" style={{fontFamily:layer.fontFamily}}>Aa Bb Cc 123 — PULSE</div><div className="builder-two-inputs"><label>Grootte<input type="number" min="8" max="400" value={layer.fontSize} disabled={!canEdit} onChange={e=>onPatch({fontSize:Number(e.target.value)})}/></label><label>Gewicht<select value={layer.fontWeight} disabled={!canEdit} onChange={e=>onPatch({fontWeight:Number(e.target.value)})}><option value="400">Normaal</option><option value="500">Medium</option><option value="600">Semibold</option><option value="700">Bold</option><option value="800">Extra bold</option><option value="900">Black</option></select></label><label>Uitlijning<select value={layer.align} disabled={!canEdit} onChange={e=>onPatch({align:e.target.value as BuilderTextLayer["align"]})}><option value="left">Links</option><option value="center">Midden</option><option value="right">Rechts</option></select></label><label>Regelhoogte<input type="number" min="0.7" max="2" step="0.05" value={layer.lineHeight} disabled={!canEdit} onChange={e=>onPatch({lineHeight:Number(e.target.value)})}/></label></div><div className="builder-two-inputs"><label>Tekstkleur<input type="color" value={layer.color} disabled={!canEdit} onChange={e=>onPatch({color:e.target.value})}/></label><label>Achtergrond<input type="color" value={layer.background==="transparent"?"#000000":layer.background} disabled={!canEdit} onChange={e=>onPatch({background:e.target.value})}/></label><label>Letterafstand<input type="number" value={layer.letterSpacing} disabled={!canEdit} onChange={e=>onPatch({letterSpacing:Number(e.target.value)})}/></label><label>Padding<input type="number" value={layer.padding} disabled={!canEdit} onChange={e=>onPatch({padding:Number(e.target.value)})}/></label><label>Ronding<input type="number" value={layer.borderRadius} disabled={!canEdit} onChange={e=>onPatch({borderRadius:Number(e.target.value)})}/></label><label>Outline<input type="number" min="0" max="12" value={layer.strokeWidth} disabled={!canEdit} onChange={e=>onPatch({strokeWidth:Number(e.target.value)})}/></label></div><label className="switch-line"><input type="checkbox" checked={layer.textTransform==="uppercase"} disabled={!canEdit} onChange={e=>onPatch({textTransform:e.target.checked?"uppercase":"none"})}/><span>Hoofdletters</span></label></div>;
}

function ImageInspector({layer,canEdit,assets,onPatch}:{layer:BuilderImageLayer;canEdit:boolean;assets:SocialAsset[];onPatch:(p:Partial<BuilderImageLayer>)=>void}){
  return <div className="builder-subinspector"><label>Bron<select value={layer.source} disabled={!canEdit} onChange={e=>onPatch({source:e.target.value as BuilderImageLayer["source"]})}><option value="post-image">Invulbare foto / DJ-foto</option><option value="brand-logo">Stationlogo</option><option value="asset">Vaste afbeelding</option></select></label>{layer.source==="asset"&&<div className="asset-mini-grid">{assets.slice(0,16).map(a=><button key={a.id} className={layer.src===a.public_url?"selected":""} onClick={()=>onPatch({src:a.public_url})}><img src={a.public_url} alt=""/></button>)}</div>}<div className="builder-two-inputs"><label>Vulling<select value={layer.fit} disabled={!canEdit} onChange={e=>onPatch({fit:e.target.value as BuilderImageLayer["fit"]})}><option value="cover">Vullen / crop</option><option value="contain">Hele afbeelding</option></select></label><label>Ronding<input type="number" value={layer.borderRadius} disabled={!canEdit} onChange={e=>onPatch({borderRadius:Number(e.target.value)})}/></label><label>Rand<input type="number" value={layer.borderWidth} disabled={!canEdit} onChange={e=>onPatch({borderWidth:Number(e.target.value)})}/></label><label>Randkleur<input type="color" value={layer.borderColor==="transparent"?"#ffffff":layer.borderColor} disabled={!canEdit} onChange={e=>onPatch({borderColor:e.target.value})}/></label></div>{layer.fit==="cover"&&<><label>Foto horizontaal<input type="range" min="0" max="100" value={layer.positionX??50} disabled={!canEdit} onChange={e=>onPatch({positionX:Number(e.target.value)})}/><small>{layer.positionX??50}%</small></label><label>Foto verticaal<input type="range" min="0" max="100" value={layer.positionY??50} disabled={!canEdit} onChange={e=>onPatch({positionY:Number(e.target.value)})}/><small>{layer.positionY??50}%</small></label></>}</div>;
}

function ShapeInspector({layer,canEdit,onPatch}:{layer:BuilderShapeLayer;canEdit:boolean;onPatch:(p:Partial<BuilderShapeLayer>)=>void}){
  return <div className="builder-subinspector"><label>Vorm<select value={layer.shape} disabled={!canEdit} onChange={e=>onPatch({shape:e.target.value as BuilderShapeLayer["shape"]})}><option value="rect">Rechthoek</option><option value="ellipse">Cirkel / ovaal</option><option value="line">Lijn</option></select></label><div className="builder-two-inputs"><label>Vulling<input type="color" value={layer.fill==="transparent"?"#000000":layer.fill} disabled={!canEdit} onChange={e=>onPatch({fill:e.target.value})}/></label><label>Randkleur<input type="color" value={layer.stroke==="transparent"?"#ffffff":layer.stroke} disabled={!canEdit} onChange={e=>onPatch({stroke:e.target.value})}/></label><label>Rand<input type="number" value={layer.strokeWidth} disabled={!canEdit} onChange={e=>onPatch({strokeWidth:Number(e.target.value)})}/></label><label>Ronding<input type="number" value={layer.borderRadius} disabled={!canEdit} onChange={e=>onPatch({borderRadius:Number(e.target.value)})}/></label></div></div>;
}
