"use client";

import { useEffect,useMemo,useRef,useState,type CSSProperties,type DragEvent as ReactDragEvent,type PointerEvent as ReactPointerEvent } from "react";
import { can,type PermissionMap } from "@/lib/permissions";
import {
  deleteSocialAsset,deleteSocialTemplate,loadBrandKit,loadSocialAssets,loadSocialTemplates,saveSocialTemplate,uploadSocialAsset,
  type BrandKit,type SocialAsset,type SocialTemplate
} from "@/lib/supabase/social";
import {
  BUILDER_FORMATS,BUILDER_STARTERS,BUILDER_VARIABLES,blankBuilderConfig,blankTemplate,cloneConfig,imageLayer,isBuilderConfig,
  renderBuilderCanvas,shapeLayer,starterTemplate,textLayer,type BuilderConfig,type BuilderFormatKey,type BuilderImageLayer,type BuilderLayer,
  type BuilderShapeLayer,type BuilderTextLayer
} from "@/lib/social-template-builder";

const sampleCtx={station:"VERSUZ",artist:"Lost Frequencies",title:"Black Friday",program:"Drive",presenter:"Jasper Cool",chartPosition:"1",previousPosition:"4",nextShow:"Fresh om 18:00",date:"03/09/2026",time:"16:00",cta:"Luister nu",artworkImage:""};
const formatLabels:Record<BuilderFormatKey,string>={"1:1":"Vierkant 1:1","4:5":"Post 4:5","9:16":"Story 9:16","16:9":"Banner 16:9"};
const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);

function asBuilder(template:SocialTemplate,brand:BrandKit):BuilderConfig{
  if(isBuilderConfig(template.config))return cloneConfig(template.config);
  const format=(template.aspect_ratio in BUILDER_FORMATS?template.aspect_ratio:"4:5") as BuilderFormatKey;
  const base=blankBuilderConfig(format,brand);
  base.layers=[
    textLayer("Label","SOCIAL",80,100,650,70,{fontSize:34,fontWeight:900,color:brand.accent_color,z:10}),
    textLayer("Titel","{title}",80,310,880,230,{fontSize:96,fontWeight:900,z:10}),
    textLayer("Subtitel","{artist}",80,560,820,90,{fontSize:48,fontWeight:600,color:"#d5d6ff",z:10}),
    imageLayer("Foto / artwork","post-image",80,730,920,470,{borderRadius:42,z:4})
  ];return base;
}
function layerIcon(layer:BuilderLayer){return layer.type==="text"?"T":layer.type==="image"?"▧":"●"}
function cssColor(value:string){return value||"transparent"}

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
  const[zoom,setZoom]=useState(55);
  const[history,setHistory]=useState<BuilderConfig[]>([]);
  const[future,setFuture]=useState<BuilderConfig[]>([]);
  const[assetUpload,setAssetUpload]=useState(false);
  const canvasRef=useRef<HTMLDivElement|null>(null);
  const dragRef=useRef<{mode:"move"|"resize";layerId:string;startX:number;startY:number;initial:BuilderLayer;rect:DOMRect}|null>(null);

  function flash(message:string){setNotice(message);window.setTimeout(()=>setNotice(""),3000)}
  useEffect(()=>{
    if(stationSlug==="all"||!canView)return;let alive=true;setBusy(true);
    Promise.all([loadBrandKit(stationSlug),loadSocialTemplates(stationSlug),loadSocialAssets(stationSlug)]).then(([b,t,a])=>{
      if(!alive)return;setBrand(b);setTemplates(t);setAssets(a);const first=t[0];if(first){setSelectedTemplateId(first.id);setDraft(first);setConfig(asBuilder(first,b))}
    }).catch(e=>flash(e instanceof Error?e.message:"Templatebouwer laden mislukt")).finally(()=>alive&&setBusy(false));
    return()=>{alive=false};
  },[stationSlug,canView]);

  const selectedLayer=useMemo(()=>config?.layers.find(x=>x.id===selectedLayerId)||null,[config,selectedLayerId]);
  const sortedLayers=useMemo(()=>[...(config?.layers||[])].sort((a,b)=>b.z-a.z),[config]);

  function pushHistory(){if(!config)return;setHistory(rows=>[...rows.slice(-39),cloneConfig(config)]);setFuture([])}
  function setNext(next:BuilderConfig,record=true){if(record&&config)setHistory(rows=>[...rows.slice(-39),cloneConfig(config)]);if(record)setFuture([]);setConfig(next)}
  function patchCanvas(patch:Partial<BuilderConfig["canvas"]>){if(!config)return;setNext({...config,canvas:{...config.canvas,...patch}})}
  function patchLayer(id:string,patch:Partial<BuilderLayer>,record=true){if(!config)return;const next={...config,layers:config.layers.map(x=>x.id===id?({...x,...patch} as BuilderLayer):x)};setNext(next,record)}
  function undo(){if(!config||!history.length)return;const previous=history[history.length-1];setFuture(rows=>[cloneConfig(config),...rows].slice(0,40));setHistory(rows=>rows.slice(0,-1));setConfig(cloneConfig(previous))}
  function redo(){if(!config||!future.length)return;const next=future[0];setHistory(rows=>[...rows,cloneConfig(config)].slice(-40));setFuture(rows=>rows.slice(1));setConfig(cloneConfig(next))}

  function selectTemplate(template:SocialTemplate){if(!brand)return;setSelectedTemplateId(template.id);setDraft(template);setConfig(asBuilder(template,brand));setSelectedLayerId("");setHistory([]);setFuture([])}
  function createBlank(){if(!brand)return;const t=blankTemplate(stationSlug,brand,"4:5");setTemplates(rows=>[t,...rows]);selectTemplate(t)}
  function createStarter(index:number){const preset=BUILDER_STARTERS[index];if(!preset)return;const t=starterTemplate(stationSlug,preset);setTemplates(rows=>[t,...rows]);selectTemplate(t)}
  function changeFormat(format:BuilderFormatKey){if(!config||!draft)return;const f=BUILDER_FORMATS[format],oldW=config.canvas.width,oldH=config.canvas.height;const sx=f.width/oldW,sy=f.height/oldH;const next={...config,canvas:{...config.canvas,width:f.width,height:f.height},layers:config.layers.map(layer=>({...layer,x:Math.round(layer.x*sx),y:Math.round(layer.y*sy),width:Math.max(10,Math.round(layer.width*sx)),height:Math.max(10,Math.round(layer.height*sy))}))};pushHistory();setConfig(next);setDraft({...draft,aspect_ratio:format})}

  function addText(value="Nieuwe tekst"){if(!config||!canEdit)return;const layer=textLayer(`Tekst ${config.layers.filter(x=>x.type==="text").length+1}`,value,80,120,Math.min(760,config.canvas.width-160),150,{z:Math.max(1,...config.layers.map(x=>x.z))+1});setNext({...config,layers:[...config.layers,layer]});setSelectedLayerId(layer.id)}
  function addImage(source:"post-image"|"brand-logo"|"asset"="post-image",src=""){if(!config||!canEdit)return;const layer=imageLayer(source==="post-image"?"Invulbare foto":source==="brand-logo"?"Logo":"Afbeelding",source,100,190,Math.min(620,config.canvas.width-200),Math.min(620,config.canvas.height-300),{src,z:Math.max(1,...config.layers.map(x=>x.z))+1,borderRadius:30});setNext({...config,layers:[...config.layers,layer]});setSelectedLayerId(layer.id)}
  function addShape(shape:"rect"|"ellipse"|"line"="rect"){if(!config||!canEdit)return;const layer=shapeLayer(shape==="ellipse"?"Cirkel / ovaal":shape==="line"?"Lijn":"Vorm",shape,100,180,420,220,{z:Math.max(1,...config.layers.map(x=>x.z))+1});setNext({...config,layers:[...config.layers,layer]});setSelectedLayerId(layer.id)}
  function duplicateLayer(){if(!config||!selectedLayer||!canEdit)return;const copy={...structuredClone(selectedLayer),id:`layer-${uid()}`,name:`${selectedLayer.name} kopie`,x:selectedLayer.x+24,y:selectedLayer.y+24,z:Math.max(1,...config.layers.map(x=>x.z))+1} as BuilderLayer;setNext({...config,layers:[...config.layers,copy]});setSelectedLayerId(copy.id)}
  function deleteLayer(){if(!config||!selectedLayer||!canEdit)return;setNext({...config,layers:config.layers.filter(x=>x.id!==selectedLayer.id)});setSelectedLayerId("")}
  function layerOrder(id:string,delta:number){if(!config)return;const layer=config.layers.find(x=>x.id===id);if(!layer)return;patchLayer(id,{z:Math.max(0,layer.z+delta)})}

  function pointerStart<T extends HTMLElement>(ev:ReactPointerEvent<T>,layer:BuilderLayer,mode:"move"|"resize"){
    if(!config||!canEdit||layer.locked)return;ev.preventDefault();ev.stopPropagation();const rect=canvasRef.current?.getBoundingClientRect();if(!rect)return;pushHistory();dragRef.current={mode,layerId:layer.id,startX:ev.clientX,startY:ev.clientY,initial:structuredClone(layer),rect};setSelectedLayerId(layer.id);
    const onMove=(event:PointerEvent)=>{const drag=dragRef.current;if(!drag||!config)return;const scaleX=config.canvas.width/drag.rect.width,scaleY=config.canvas.height/drag.rect.height;const dx=(event.clientX-drag.startX)*scaleX,dy=(event.clientY-drag.startY)*scaleY;const snap=config.canvas.snap?10:1;const round=(v:number)=>Math.round(v/snap)*snap;if(drag.mode==="move")patchLayer(drag.layerId,{x:round(Math.max(0,Math.min(config.canvas.width-drag.initial.width,drag.initial.x+dx))),y:round(Math.max(0,Math.min(config.canvas.height-drag.initial.height,drag.initial.y+dy)))},false);else patchLayer(drag.layerId,{width:round(Math.max(30,Math.min(config.canvas.width-drag.initial.x,drag.initial.width+dx))),height:round(Math.max(30,Math.min(config.canvas.height-drag.initial.y,drag.initial.height+dy)))},false)};
    const onUp=()=>{dragRef.current=null;window.removeEventListener("pointermove",onMove);window.removeEventListener("pointerup",onUp)};window.addEventListener("pointermove",onMove);window.addEventListener("pointerup",onUp);
  }

  async function save(){if(!draft||!config||!canEdit)return;setBusy(true);try{const saved=await saveSocialTemplate({...draft,config:config as unknown as Record<string,unknown>});setTemplates(rows=>[saved,...rows.filter(x=>x.id!==draft.id&&x.id!==saved.id)]);setDraft(saved);setSelectedTemplateId(saved.id);setHistory([]);setFuture([]);flash("Template centraal opgeslagen")}catch(e){flash(e instanceof Error?e.message:"Opslaan mislukt")}finally{setBusy(false)} }
  async function removeTemplate(){if(!draft||draft.id.startsWith("new-")||!canAdmin)return;if(!confirm(`Template “${draft.name}” verwijderen?`))return;try{await deleteSocialTemplate(draft.id);const next=templates.filter(x=>x.id!==draft.id);setTemplates(next);setDraft(null);setConfig(null);setSelectedTemplateId("");if(next[0])selectTemplate(next[0]);flash("Template verwijderd")}catch(e){flash(e instanceof Error?e.message:"Verwijderen mislukt")}}
  async function duplicateTemplate(){if(!draft||!config||!canEdit)return;const copy:{[K in keyof SocialTemplate]:SocialTemplate[K]}={...draft,id:`new-${uid()}`,name:`${draft.name} kopie`,config:cloneConfig(config) as unknown as Record<string,unknown>};setTemplates(rows=>[copy,...rows]);selectTemplate(copy)}
  async function downloadPng(){if(!draft||!config||!brand)return;const canvas=await renderBuilderCanvas(config,{...sampleCtx,artworkImage:assets[0]?.public_url||""},brand);const a=document.createElement("a");a.href=canvas.toDataURL("image/png");a.download=`${draft.name}.png`.replace(/[^a-z0-9._-]+/gi,"-").toLowerCase();a.click()}
  async function uploadAsset(file:File|undefined,placement?:{x:number;y:number}){
    if(!file||!config||!canEdit)return;setAssetUpload(true);
    try{
      const asset=await uploadSocialAsset(stationSlug,file,["template-builder"]);setAssets(rows=>[asset,...rows]);
      const width=Math.min(620,Math.max(260,config.canvas.width*.48)),height=Math.min(620,Math.max(260,config.canvas.height*.34));
      const x=Math.max(0,Math.min(config.canvas.width-width,placement?.x??Math.max(40,(config.canvas.width-width)/2)));
      const y=Math.max(0,Math.min(config.canvas.height-height,placement?.y??Math.max(40,(config.canvas.height-height)/2)));
      const layer=imageLayer(asset.name||"Afbeelding","asset",Math.round(x),Math.round(y),Math.round(width),Math.round(height),{src:asset.public_url,z:Math.max(1,...config.layers.map(v=>v.z))+1,borderRadius:24});
      setNext({...config,layers:[...config.layers,layer]});setSelectedLayerId(layer.id);flash("Afbeelding op canvas geplaatst");
    }catch(e){flash(e instanceof Error?e.message:"Upload mislukt")}finally{setAssetUpload(false)}
  }
  async function uploadBackground(file:File|undefined){
    if(!file||!config||!canEdit)return;setAssetUpload(true);
    try{const asset=await uploadSocialAsset(stationSlug,file,["template-background"]);setAssets(rows=>[asset,...rows]);patchCanvas({backgroundImage:asset.public_url});flash("Achtergrondafbeelding ingesteld")}
    catch(e){flash(e instanceof Error?e.message:"Upload mislukt")}finally{setAssetUpload(false)}
  }
  function dropImage(ev:ReactDragEvent<HTMLDivElement>){
    ev.preventDefault();ev.stopPropagation();if(!config||!canEdit)return;const file=Array.from(ev.dataTransfer.files||[]).find(f=>f.type.startsWith("image/"));if(!file)return flash("Sleep een PNG, JPG of WebP naar het canvas.");
    const rect=canvasRef.current?.getBoundingClientRect();if(!rect)return void uploadAsset(file);const x=(ev.clientX-rect.left)*(config.canvas.width/rect.width);const y=(ev.clientY-rect.top)*(config.canvas.height/rect.height);void uploadAsset(file,{x:x-180,y:y-180});
  }
  async function removeAsset(asset:SocialAsset){if(!canAdmin||!confirm(`Asset “${asset.name}” verwijderen?`))return;try{await deleteSocialAsset(asset);setAssets(rows=>rows.filter(x=>x.id!==asset.id))}catch(e){flash(e instanceof Error?e.message:"Asset verwijderen mislukt")}}

  if(!canView)return <div className="card empty-live-state"><strong>Geen toegang tot Templatebouwer</strong><span>Een beheerder kan dit recht per gebruiker instellen.</span></div>;
  if(stationSlug==="all")return <div className="card empty-live-state"><strong>Kies één station</strong><span>Templates en brand assets zijn station-specifiek.</span></div>;

  const canvasScale=zoom/100;
  return <div className="template-builder-shell">
    <div className="page-intro template-builder-intro"><div><span className="eyebrow">SOCIAL / BEHEER</span><h2>Templatebouwer</h2><p>Bouw social templates vanaf nul met lagen, vrije positionering, resize, vormen, foto&apos;s en dynamische HUB-velden.</p></div><div className="button-row"><button className="ghost" disabled={!draft||!config} onClick={()=>void downloadPng()}>PNG test</button><button className="ghost" disabled={!draft||!canEdit} onClick={()=>void duplicateTemplate()}>Dupliceer</button><button className="primary" disabled={!draft||!config||busy||!canEdit} onClick={()=>void save()}>{busy?"Opslaan…":"Template opslaan"}</button></div></div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}
    <div className="template-builder-toolbar card">
      <div className="builder-tool-group"><button disabled={!canEdit} onClick={()=>addText()}>T Tekst</button><label className={`builder-toolbar-upload ${!canEdit||assetUpload?"disabled":""}`}>{assetUpload?"Uploaden…":"▧ Afbeelding"}<input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={!canEdit||assetUpload} onChange={e=>{void uploadAsset(e.target.files?.[0]);e.currentTarget.value=""}}/></label><button disabled={!canEdit} onClick={()=>addImage("post-image")}>▧ Invulbare foto</button><button disabled={!canEdit} onClick={()=>addImage("brand-logo")}>Logo</button><button disabled={!canEdit} onClick={()=>addShape("rect")}>▰ Rechthoek</button><button disabled={!canEdit} onClick={()=>addShape("ellipse")}>● Cirkel</button><button disabled={!canEdit} onClick={()=>addShape("line")}>━ Lijn</button></div>
      <div className="builder-tool-group"><button disabled={!history.length} onClick={undo}>↶ Undo</button><button disabled={!future.length} onClick={redo}>↷ Redo</button><button disabled={!selectedLayer||!canEdit} onClick={duplicateLayer}>⧉ Laag</button><button disabled={!selectedLayer||!canEdit} onClick={deleteLayer}>⌫</button></div>
      <div className="builder-tool-group builder-zoom"><button onClick={()=>setZoom(z=>Math.max(25,z-10))}>−</button><strong>{zoom}%</strong><button onClick={()=>setZoom(z=>Math.min(100,z+10))}>＋</button></div>
    </div>

    <div className="template-builder-layout">
      <aside className="builder-left-column">
        <section className="card builder-template-library"><div className="section-head"><div><h3>Templates</h3><p>{templates.length} voor dit station</p></div><button className="mini-btn" disabled={!canEdit} onClick={createBlank}>＋</button></div><div className="builder-template-list">{templates.map(t=><button key={t.id} className={selectedTemplateId===t.id?"selected":""} onClick={()=>selectTemplate(t)}><span>{t.name.slice(0,1).toUpperCase()}</span><div><strong>{t.name}</strong><small>{t.aspect_ratio} • {t.content_type}</small></div></button>)}</div><details className="builder-starters" open><summary>Start vanaf ontwerp</summary>{BUILDER_STARTERS.map((s,i)=><button key={s.name} disabled={!canEdit} onClick={()=>createStarter(i)}><strong>{s.name}</strong><small>{s.description}</small></button>)}</details></section>
        {config&&<section className="card builder-layer-panel"><div className="section-head"><div><h3>Lagen</h3><p>{config.layers.length} lagen</p></div></div><div className="builder-layer-list">{sortedLayers.map(layer=><button key={layer.id} className={selectedLayerId===layer.id?"selected":""} onClick={()=>setSelectedLayerId(layer.id)}><span className="layer-icon">{layerIcon(layer)}</span><strong>{layer.name}</strong><span className="layer-actions"><i onClick={e=>{e.stopPropagation();patchLayer(layer.id,{hidden:!layer.hidden})}}>{layer.hidden?"◌":"◉"}</i><i onClick={e=>{e.stopPropagation();patchLayer(layer.id,{locked:!layer.locked})}}>{layer.locked?"🔒":"○"}</i></span></button>)}</div></section>}
      </aside>

      <main className="builder-stage card" onClick={()=>setSelectedLayerId("")}>
        {!draft||!config||!brand?<div className="empty-live-state"><strong>{busy?"Templates laden…":"Kies een template"}</strong><span>Of start links vanaf een leeg canvas.</span></div>:<>
          <div className="builder-document-head"><div><input value={draft.name} disabled={!canEdit} onChange={e=>setDraft({...draft,name:e.target.value})}/><span>{config.canvas.width} × {config.canvas.height}px</span></div><div className="button-row"><select value={draft.aspect_ratio} disabled={!canEdit} onChange={e=>changeFormat(e.target.value as BuilderFormatKey)}>{(Object.keys(BUILDER_FORMATS) as BuilderFormatKey[]).map(k=><option key={k} value={k}>{formatLabels[k]}</option>)}</select><label><input type="checkbox" checked={config.canvas.grid} onChange={e=>patchCanvas({grid:e.target.checked})}/> Raster</label><label><input type="checkbox" checked={config.canvas.snap} onChange={e=>patchCanvas({snap:e.target.checked})}/> Snap</label></div></div>
          <div className="builder-stage-scroll" onDragOver={e=>{if(canEdit)e.preventDefault()}} onDrop={dropImage}><div ref={canvasRef} className={`builder-artboard ${config.canvas.grid?"show-grid":""}`} style={{width:config.canvas.width*canvasScale,height:config.canvas.height*canvasScale,backgroundImage:config.canvas.backgroundImage?`url(${config.canvas.backgroundImage})`:config.canvas.gradient?`linear-gradient(145deg,${config.canvas.background},${config.canvas.background2})`:undefined,backgroundColor:config.canvas.background,backgroundSize:"cover",backgroundPosition:"center"}} onClick={e=>e.stopPropagation()}>
            {config.layers.filter(x=>!x.hidden).sort((a,b)=>a.z-b.z).map(layer=>{const common={left:layer.x*canvasScale,top:layer.y*canvasScale,width:layer.width*canvasScale,height:layer.height*canvasScale,opacity:layer.opacity,transform:`rotate(${layer.rotation}deg)`,zIndex:layer.z} as CSSProperties;return <div key={layer.id} className={`builder-canvas-layer ${selectedLayerId===layer.id?"selected":""} ${layer.locked?"locked":""}`} style={common} onPointerDown={e=>pointerStart(e,layer,"move")} onClick={e=>{e.stopPropagation();setSelectedLayerId(layer.id)}}>
              {layer.type==="shape"?(layer.shape==="ellipse"?<div className="builder-shape ellipse" style={{background:cssColor(layer.fill),border:`${layer.strokeWidth*canvasScale}px solid ${cssColor(layer.stroke)}`}}/>:layer.shape==="line"?<div className="builder-line" style={{borderTop:`${Math.max(1,layer.strokeWidth*canvasScale)}px solid ${cssColor(layer.stroke)}`}}/>:<div className="builder-shape" style={{background:cssColor(layer.fill),border:`${layer.strokeWidth*canvasScale}px solid ${cssColor(layer.stroke)}`,borderRadius:layer.borderRadius*canvasScale}}/>):layer.type==="image"?<div className="builder-image-layer" style={{borderRadius:layer.borderRadius*canvasScale,border:`${layer.borderWidth*canvasScale}px solid ${cssColor(layer.borderColor)}`}}>{(layer.source==="brand-logo"?brand.logo_url:layer.source==="post-image"?(sampleCtx.artworkImage||assets[0]?.public_url):layer.src)?<img src={layer.source==="brand-logo"?brand.logo_url:(layer.source==="post-image"?(sampleCtx.artworkImage||assets[0]?.public_url):layer.src)} style={{objectFit:layer.fit}} alt=""/>:<span>FOTO</span>}</div>:<div className="builder-text-layer" style={{fontFamily:layer.fontFamily,fontSize:layer.fontSize*canvasScale,fontWeight:layer.fontWeight,color:layer.color,textAlign:layer.align,lineHeight:layer.lineHeight,letterSpacing:layer.letterSpacing*canvasScale,textTransform:layer.textTransform,background:cssColor(layer.background),borderRadius:layer.borderRadius*canvasScale,padding:layer.padding*canvasScale,WebkitTextStroke:layer.strokeWidth?`${layer.strokeWidth*canvasScale}px ${layer.stroke}`:undefined}}>{layer.text.replaceAll("{station}",sampleCtx.station).replaceAll("{artist}",sampleCtx.artist).replaceAll("{title}",sampleCtx.title).replaceAll("{program}",sampleCtx.program).replaceAll("{presenter}",sampleCtx.presenter).replaceAll("{chart_position}",sampleCtx.chartPosition).replaceAll("{previous_position}",sampleCtx.previousPosition).replaceAll("{date}",sampleCtx.date).replaceAll("{time}",sampleCtx.time).replaceAll("{cta}",sampleCtx.cta)}</div>}
              {selectedLayerId===layer.id&&!layer.locked&&<span className="builder-resize-handle" onPointerDown={e=>pointerStart(e,layer,"resize")}/>} 
            </div>})}
          </div></div>
          <div className="builder-safe-note"><b>Direct werken:</b> sleep lagen om ze te verplaatsen • sleep de rechteronderhoek om te schalen • sleep een PNG/JPG/WebP vanuit je computer rechtstreeks op het canvas.</div>
        </>}
      </main>

      <aside className="builder-right-column">
        {draft&&config&&<section className="card builder-document-inspector"><span className="eyebrow">DOCUMENT</span><label>Naam<input value={draft.name} disabled={!canEdit} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>Contenttype<select value={draft.content_type} disabled={!canEdit} onChange={e=>setDraft({...draft,content_type:e.target.value})}><option value="music">Nieuwe muziek</option><option value="chart">Hitlijst</option><option value="program">Programma</option><option value="presenter">Presentator</option><option value="event">Event</option><option value="quote">Quote</option><option value="custom">Vrij</option></select></label><label>Caption-template<textarea value={draft.caption_template} disabled={!canEdit} onChange={e=>setDraft({...draft,caption_template:e.target.value})}/></label><div className="builder-variable-buttons">{BUILDER_VARIABLES.map(v=><button key={v} disabled={!canEdit} onClick={()=>setDraft({...draft,caption_template:`${draft.caption_template}${draft.caption_template.endsWith(" ")?"":" "}${v}`})}>{v}</button>)}</div></section>}
        {config&&<section className="card builder-canvas-inspector"><span className="eyebrow">CANVAS</span><div className="builder-two-inputs"><label>Kleur<input type="color" value={config.canvas.background} onChange={e=>patchCanvas({background:e.target.value})}/></label><label>Kleur 2<input type="color" value={config.canvas.background2} onChange={e=>patchCanvas({background2:e.target.value})}/></label></div><label className="switch-line"><input type="checkbox" checked={config.canvas.gradient} onChange={e=>patchCanvas({gradient:e.target.checked})}/><span>Gradient</span></label><div className="asset-mini-grid"><button disabled={!canEdit} onClick={()=>patchCanvas({backgroundImage:""})}>Geen achtergrondfoto</button>{assets.slice(0,10).map(a=><button key={a.id} onClick={()=>patchCanvas({backgroundImage:a.public_url})}><img src={a.public_url} alt=""/></button>)}</div><label className="ghost file-button">{assetUpload?"Uploaden…":"＋ Achtergrond uploaden"}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>{void uploadBackground(e.target.files?.[0]);e.currentTarget.value=""}}/></label></section>}
        {selectedLayer&&<LayerInspector layer={selectedLayer} canEdit={canEdit} assets={assets} onPatch={(patch)=>patchLayer(selectedLayer.id,patch)} onForward={()=>layerOrder(selectedLayer.id,1)} onBackward={()=>layerOrder(selectedLayer.id,-1)} onDelete={deleteLayer}/>} 
        {!selectedLayer&&config&&<section className="card empty-live-state compact"><strong>Selecteer een laag</strong><span>Klik op een laag op het canvas of in het lagenpaneel om eigenschappen te bewerken.</span></section>}
        {canAdmin&&assets.length>0&&<details className="card builder-asset-cleanup"><summary>Assetbeheer</summary>{assets.slice(0,14).map(a=><div key={a.id}><img src={a.public_url} alt=""/><span>{a.name}</span><button onClick={()=>void removeAsset(a)}>×</button></div>)}</details>}
        {canAdmin&&draft&&!draft.id.startsWith("new-")&&<button className="ghost danger-text wide" onClick={()=>void removeTemplate()}>Template verwijderen</button>}
      </aside>
    </div>
  </div>
}

function LayerInspector({layer,canEdit,assets,onPatch,onForward,onBackward,onDelete}:{layer:BuilderLayer;canEdit:boolean;assets:SocialAsset[];onPatch:(patch:Partial<BuilderLayer>)=>void;onForward:()=>void;onBackward:()=>void;onDelete:()=>void}){
  const patch=(p:Partial<BuilderLayer>)=>canEdit&&onPatch(p);
  return <section className="card builder-layer-inspector"><div className="section-head"><div><span className="eyebrow">LAAG</span><h3>{layer.name}</h3></div><span className="layer-type-chip">{layer.type}</span></div><label>Naam<input value={layer.name} disabled={!canEdit} onChange={e=>patch({name:e.target.value})}/></label><div className="builder-four-inputs"><label>X<input type="number" value={Math.round(layer.x)} onChange={e=>patch({x:Number(e.target.value)})}/></label><label>Y<input type="number" value={Math.round(layer.y)} onChange={e=>patch({y:Number(e.target.value)})}/></label><label>B<input type="number" value={Math.round(layer.width)} onChange={e=>patch({width:Number(e.target.value)})}/></label><label>H<input type="number" value={Math.round(layer.height)} onChange={e=>patch({height:Number(e.target.value)})}/></label></div><div className="builder-two-inputs"><label>Rotatie<input type="number" value={layer.rotation} onChange={e=>patch({rotation:Number(e.target.value)})}/></label><label>Dekking<input type="number" min="0" max="100" value={Math.round(layer.opacity*100)} onChange={e=>patch({opacity:Number(e.target.value)/100})}/></label></div><div className="button-row compact"><button disabled={!canEdit} onClick={onForward}>Naar voren</button><button disabled={!canEdit} onClick={onBackward}>Naar achter</button></div>
    {layer.type==="text"&&<TextInspector layer={layer} canEdit={canEdit} onPatch={p=>onPatch(p as Partial<BuilderLayer>)}/>} 
    {layer.type==="image"&&<ImageInspector layer={layer} canEdit={canEdit} assets={assets} onPatch={p=>onPatch(p as Partial<BuilderLayer>)}/>} 
    {layer.type==="shape"&&<ShapeInspector layer={layer} canEdit={canEdit} onPatch={p=>onPatch(p as Partial<BuilderLayer>)}/>} 
    <div className="builder-layer-flags"><label><input type="checkbox" checked={layer.locked} onChange={e=>patch({locked:e.target.checked})}/> Vergrendel</label><label><input type="checkbox" checked={layer.hidden} onChange={e=>patch({hidden:e.target.checked})}/> Verberg</label></div><button className="ghost danger-text wide" disabled={!canEdit} onClick={onDelete}>Laag verwijderen</button></section>
}
function TextInspector({layer,canEdit,onPatch}:{layer:BuilderTextLayer;canEdit:boolean;onPatch:(p:Partial<BuilderTextLayer>)=>void}){return <div className="builder-subinspector"><label>Tekst<textarea value={layer.text} disabled={!canEdit} onChange={e=>onPatch({text:e.target.value})}/></label><div className="builder-variable-buttons">{BUILDER_VARIABLES.map(v=><button key={v} disabled={!canEdit} onClick={()=>onPatch({text:`${layer.text}${layer.text.endsWith(" ")?"":" "}${v}`})}>{v}</button>)}</div><div className="builder-two-inputs"><label>Lettertype<input value={layer.fontFamily} disabled={!canEdit} onChange={e=>onPatch({fontFamily:e.target.value})}/></label><label>Grootte<input type="number" value={layer.fontSize} onChange={e=>onPatch({fontSize:Number(e.target.value)})}/></label><label>Gewicht<select value={layer.fontWeight} onChange={e=>onPatch({fontWeight:Number(e.target.value)})}><option value="400">Normaal</option><option value="600">Semibold</option><option value="700">Bold</option><option value="800">Extra bold</option><option value="900">Black</option></select></label><label>Uitlijning<select value={layer.align} onChange={e=>onPatch({align:e.target.value as BuilderTextLayer["align"]})}><option value="left">Links</option><option value="center">Midden</option><option value="right">Rechts</option></select></label></div><div className="builder-two-inputs"><label>Tekstkleur<input type="color" value={layer.color} onChange={e=>onPatch({color:e.target.value})}/></label><label>Achtergrond<input type="color" value={layer.background==="transparent"?"#000000":layer.background} onChange={e=>onPatch({background:e.target.value})}/></label><label>Regelhoogte<input type="number" step="0.05" value={layer.lineHeight} onChange={e=>onPatch({lineHeight:Number(e.target.value)})}/></label><label>Letterafstand<input type="number" value={layer.letterSpacing} onChange={e=>onPatch({letterSpacing:Number(e.target.value)})}/></label><label>Padding<input type="number" value={layer.padding} onChange={e=>onPatch({padding:Number(e.target.value)})}/></label><label>Ronding<input type="number" value={layer.borderRadius} onChange={e=>onPatch({borderRadius:Number(e.target.value)})}/></label></div><label className="switch-line"><input type="checkbox" checked={layer.textTransform==="uppercase"} onChange={e=>onPatch({textTransform:e.target.checked?"uppercase":"none"})}/><span>Hoofdletters</span></label></div>}
function ImageInspector({layer,canEdit,assets,onPatch}:{layer:BuilderImageLayer;canEdit:boolean;assets:SocialAsset[];onPatch:(p:Partial<BuilderImageLayer>)=>void}){return <div className="builder-subinspector"><label>Bron<select value={layer.source} disabled={!canEdit} onChange={e=>onPatch({source:e.target.value as BuilderImageLayer["source"]})}><option value="post-image">Invulbare foto / DJ-foto</option><option value="brand-logo">Stationlogo</option><option value="asset">Vaste asset</option></select></label>{layer.source==="asset"&&<div className="asset-mini-grid">{assets.slice(0,14).map(a=><button key={a.id} className={layer.src===a.public_url?"selected":""} onClick={()=>onPatch({src:a.public_url})}><img src={a.public_url} alt=""/></button>)}</div>}<div className="builder-two-inputs"><label>Fit<select value={layer.fit} onChange={e=>onPatch({fit:e.target.value as BuilderImageLayer["fit"]})}><option value="cover">Vullen</option><option value="contain">Hele afbeelding</option></select></label><label>Ronding<input type="number" value={layer.borderRadius} onChange={e=>onPatch({borderRadius:Number(e.target.value)})}/></label><label>Rand<input type="number" value={layer.borderWidth} onChange={e=>onPatch({borderWidth:Number(e.target.value)})}/></label><label>Randkleur<input type="color" value={layer.borderColor==="transparent"?"#ffffff":layer.borderColor} onChange={e=>onPatch({borderColor:e.target.value})}/></label></div></div>}
function ShapeInspector({layer,canEdit,onPatch}:{layer:BuilderShapeLayer;canEdit:boolean;onPatch:(p:Partial<BuilderShapeLayer>)=>void}){return <div className="builder-subinspector"><label>Vorm<select value={layer.shape} disabled={!canEdit} onChange={e=>onPatch({shape:e.target.value as BuilderShapeLayer["shape"]})}><option value="rect">Rechthoek</option><option value="ellipse">Cirkel / ovaal</option><option value="line">Lijn</option></select></label><div className="builder-two-inputs"><label>Vulling<input type="color" value={layer.fill==="transparent"?"#000000":layer.fill} onChange={e=>onPatch({fill:e.target.value})}/></label><label>Randkleur<input type="color" value={layer.stroke==="transparent"?"#ffffff":layer.stroke} onChange={e=>onPatch({stroke:e.target.value})}/></label><label>Rand<input type="number" value={layer.strokeWidth} onChange={e=>onPatch({strokeWidth:Number(e.target.value)})}/></label><label>Ronding<input type="number" value={layer.borderRadius} onChange={e=>onPatch({borderRadius:Number(e.target.value)})}/></label></div></div>}
