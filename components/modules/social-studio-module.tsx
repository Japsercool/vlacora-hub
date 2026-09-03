"use client";

import { useEffect,useMemo,useState } from "react";
import AttachmentPanel from "@/components/attachment-panel";
import SocialTemplateRenderer from "@/components/social-template-renderer";
import { useCollaboration } from "@/components/collaboration/collaboration-provider";
import { can,type PermissionMap } from "@/lib/permissions";
import { BUILDER_STARTERS,isBuilderConfig,renderBuilderCanvas,starterTemplate,variablesUsed,type BuilderConfig } from "@/lib/social-template-builder";
import { loadSharedHitlists,loadSharedProgramming } from "@/lib/supabase/hub-data";
import {
  addSocialReviewEvent,deleteSocialAsset,deleteSocialCopyBlock,deleteSocialPost,
  loadBrandKit,loadSocialAssets,loadSocialCopyBlocks,loadSocialPeople,loadSocialPosts,loadSocialReviewEvents,loadSocialTemplates,
  saveBrandKit,saveSocialCopyBlock,saveSocialPost,uploadSocialAsset,
  type BrandKit,type SocialAsset,type SocialCopyBlock,type SocialPerson,type SocialPost,type SocialReviewEvent,type SocialTemplate
} from "@/lib/supabase/social";

type Tab="studio"|"brand"|"calendar"|"copy"|"assets";
type FormatKey="1:1"|"4:5"|"9:16"|"16:9";
type Context={
  station:string;artist:string;title:string;program:string;presenter:string;
  chartPosition:string;previousPosition:string;nextShow:string;date:string;time:string;cta:string;artworkImage:string;
};
type VisualConfig={
  label:string;headline:string;subline:string;footer:string;
  backgroundImage:string;artworkImage:string;
  showArtwork:boolean;artworkShape:"circle"|"rounded"|"square";
  align:"left"|"center";overlay:number;accentBar:boolean;
  layout:"split"|"poster"|"chart"|"show"|"minimal"|"alert";
};

const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
const formats:Record<FormatKey,{w:number;h:number;label:string}>={
  "1:1":{w:1080,h:1080,label:"Square 1:1"},
  "4:5":{w:1080,h:1350,label:"Post 4:5"},
  "9:16":{w:1080,h:1920,label:"Story 9:16"},
  "16:9":{w:1600,h:900,label:"Banner 16:9"}
};
const variables=["{station}","{artist}","{title}","{program}","{presenter}","{chart_position}","{previous_position}","{next_show}","{date}","{time}","{cta}"];


const defaultContext=(stationSlug:string):Context=>({
  station:stationSlug==="all"?"VLACORA":stationSlug,artist:"Joel Corry",title:"Whisper",program:"",presenter:"",
  chartPosition:"1",previousPosition:"2",nextShow:"",date:new Date().toLocaleDateString("nl-BE"),
  time:new Date().toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit"}),cta:"Luister nu live",artworkImage:""
});
const defaultBrand=(stationSlug:string):BrandKit=>({
  station_slug:stationSlug,brand_name:stationSlug==="all"?"VLACORA":stationSlug,logo_url:"",
  primary_color:"#27269f",secondary_color:"#4d38ff",accent_color:"#ef4a5d",background_color:"#101124",
  text_color:"#ffffff",font_family:"Inter",default_cta:"Luister nu live",default_hashtags:"#radio #vlacora"
});

function replaceVars(text:string,ctx:Context){
  return text
    .replaceAll("{station}",ctx.station).replaceAll("{artist}",ctx.artist).replaceAll("{title}",ctx.title)
.replaceAll("{program}",ctx.program).replaceAll("{presenter}",ctx.presenter)
    .replaceAll("{chart_position}",ctx.chartPosition).replaceAll("{previous_position}",ctx.previousPosition)
    .replaceAll("{next_show}",ctx.nextShow).replaceAll("{date}",ctx.date).replaceAll("{time}",ctx.time).replaceAll("{cta}",ctx.cta);
}
function cfg(template:SocialTemplate|null):VisualConfig{
  const x=(template?.config||{}) as Partial<VisualConfig>;
  return{
    label:String(x.label||"SOCIAL"),
    headline:String(x.headline||"{artist}"),
    subline:String(x.subline||"{title}"),
    footer:String(x.footer||"{station}"),
    backgroundImage:String(x.backgroundImage||""),
    artworkImage:String(x.artworkImage||""),
    showArtwork:x.showArtwork!==false,
    artworkShape:(x.artworkShape==="square"||x.artworkShape==="rounded")?x.artworkShape:"circle",
    align:x.align==="center"?"center":"left",
    overlay:Number.isFinite(Number(x.overlay))?Number(x.overlay):28,
    accentBar:x.accentBar!==false,
    layout:(x.layout==="split"||x.layout==="poster"||x.layout==="chart"||x.layout==="show"||x.layout==="minimal"||x.layout==="alert")?x.layout:"split"
  };
}
function loadImage(src:string){return new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();if(/^https?:/i.test(src))image.crossOrigin="anonymous";image.onload=()=>resolve(image);image.onerror=reject;image.src=src})}
function wrap(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,maxWidth:number,lineHeight:number,maxLines=4){
  const words=text.split(/\s+/).filter(Boolean);let line="";let lines=0;
  for(const word of words){
    const test=line?`${line} ${word}`:word;
    if(ctx.measureText(test).width>maxWidth&&line){
      ctx.fillText(line,x,y);y+=lineHeight;lines++;line=word;
      if(lines>=maxLines-1)break;
    }else line=test;
  }
  if(line&&lines<maxLines)ctx.fillText(line,x,y);
}
function toLocalInput(iso:string|null){
  if(!iso)return"";
  const d=new Date(iso);if(Number.isNaN(d.getTime()))return"";
  const pad=(n:number)=>String(n).padStart(2,"0");
  return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(value:string){return value?new Date(value).toISOString():null}
function localDateKey(date:Date){
  const pad=(n:number)=>String(n).padStart(2,"0");
  return`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
}
function monthStart(date:Date){return new Date(date.getFullYear(),date.getMonth(),1,12)}
function addMonths(date:Date,delta:number){return new Date(date.getFullYear(),date.getMonth()+delta,1,12)}
function monthCells(date:Date){
  const first=monthStart(date);
  const mondayIndex=(first.getDay()+6)%7;
  const start=new Date(first);start.setDate(first.getDate()-mondayIndex);
  return Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d});
}
function postDay(post:SocialPost){return post.scheduled_at?localDateKey(new Date(post.scheduled_at)):""}
function statusLabel(status:SocialPost["status"]){
  return status==="concept"?"Concept":status==="review"?"Review gevraagd":status==="approved"?"Goedgekeurd":status==="published"?"Gepubliceerd":"Archief";
}
function reviewLabel(type:SocialReviewEvent["event_type"]){
  return type==="review_requested"?"Review gevraagd":type==="approved"?"Goedgekeurd":type==="changes_requested"?"Aanpassingen gevraagd":type==="published"?"Gepubliceerd":"Opmerking";
}
function newCopyBlock(stationSlug:string,category="Algemeen",content=""):SocialCopyBlock{
  return{id:`new-${uid()}`,station_slug:stationSlug,name:"Nieuw copyblok",category,content,active:true};
}
function newPost(stationSlug:string,template:SocialTemplate,ctx:Context):SocialPost{
  return{id:`new-${uid()}`,station_slug:stationSlug,template_id:template.id.startsWith("new-")?null:template.id,title:isBuilderConfig(template.config)?(ctx.title||template.name):replaceVars(String(cfg(template).headline),ctx),status:"concept",format:template.aspect_ratio||"4:5",payload:ctx,caption:replaceVars(template.caption_template,ctx),scheduled_at:null,published_at:null,platforms:["Instagram"],campaign:"",content_pillar:"",objective:"",assigned_to:null,reviewer_id:null,due_at:null,publication_url:"",internal_notes:"",checklist:{copy:false,visual:false,rights:false,links:false}};
}

export default function SocialStudioModule({stationSlug,permissions,initialTab="studio"}:{stationSlug:string;permissions?:PermissionMap|null;initialTab?:Tab}){
  const[tab,setTab]=useState<Tab>(initialTab);
  const[brand,setBrand]=useState<BrandKit>(()=>defaultBrand(stationSlug));
  const[templates,setTemplates]=useState<SocialTemplate[]>([]);
  const[posts,setPosts]=useState<SocialPost[]>([]);
  const[assets,setAssets]=useState<SocialAsset[]>([]);
  const[selectedTemplateId,setSelectedTemplateId]=useState("");
  const[templateDraft,setTemplateDraft]=useState<SocialTemplate|null>(null);
  const[ctx,setCtx]=useState<Context>(()=>defaultContext(stationSlug));
  const[currentPost,setCurrentPost]=useState<SocialPost|null>(null);
  const[format,setFormat]=useState<FormatKey>("4:5");
  const[notice,setNotice]=useState("");
  const[busy,setBusy]=useState(false);
  const[assetTags,setAssetTags]=useState("");
  const[assetUpload,setAssetUpload]=useState(false);
  const[copyBlocks,setCopyBlocks]=useState<SocialCopyBlock[]>([]);
  const[copyDraft,setCopyDraft]=useState<SocialCopyBlock|null>(null);
  const[people,setPeople]=useState<SocialPerson[]>([]);
  const[calendarMonth,setCalendarMonth]=useState(()=>monthStart(new Date()));
  const[selectedCalendarPostId,setSelectedCalendarPostId]=useState("");
  const[reviewEvents,setReviewEvents]=useState<SocialReviewEvent[]>([]);
  const[reviewComment,setReviewComment]=useState("");
  const[exportFormats,setExportFormats]=useState<Record<FormatKey,boolean>>({"1:1":true,"4:5":true,"9:16":true,"16:9":false});

  const collaboration=useCollaboration();
  const canContent=!permissions||can(permissions.social_content,"view");
  const canEditContent=!permissions||can(permissions.social_content,"edit");
  const canCalendar=!permissions||can(permissions.social_calendar,"view");
  const canTemplates=!permissions||can(permissions.social_templates,"view");
  const canAssets=!permissions||can(permissions.social_assets,"view");
  const canApprove=!permissions||can(permissions.social_approval,"publish");
  const visibleTabs=((initialTab==="brand"?[["brand","Brand kit",canTemplates],["assets","Assets",canAssets]]:[["studio","Content maken",canContent],["calendar","Contentkalender",canCalendar],["copy","Copyblokken",canAssets],["assets","Assets",canAssets]]) as [Tab,string,boolean][]).filter(x=>x[2]);

  useEffect(()=>{if(!visibleTabs.some(([key])=>key===tab)&&visibleTabs[0])setTab(visibleTabs[0][0])},[tab,permissions]);

  function flash(message:string){setNotice(message);window.setTimeout(()=>setNotice(""),3200)}
  async function loadAll(){
    if(stationSlug==="all"){setBrand(defaultBrand(stationSlug));setTemplates([]);setPosts([]);setAssets([]);return}
    setBusy(true);
    try{
      const[kit,cloudTemplates,cloudPosts,cloudAssets,cloudCopyBlocks,cloudPeople]=await Promise.all([
        loadBrandKit(stationSlug),loadSocialTemplates(stationSlug),loadSocialPosts(stationSlug),loadSocialAssets(stationSlug),loadSocialCopyBlocks(stationSlug),loadSocialPeople()
      ]);
      setBrand(kit);setCtx(x=>({...x,station:kit.brand_name||stationSlug,cta:kit.default_cta||x.cta}));
      const nextTemplates=cloudTemplates.length?cloudTemplates:BUILDER_STARTERS.map(p=>starterTemplate(stationSlug,p));
      setTemplates(nextTemplates);
      const first=nextTemplates[0];if(first){setSelectedTemplateId(first.id);setTemplateDraft(first);setFormat((first.aspect_ratio as FormatKey)||"4:5")}
      setPosts(cloudPosts);setAssets(cloudAssets);setCopyBlocks(cloudCopyBlocks);setPeople(cloudPeople);
    }catch(e){flash(e instanceof Error?e.message:"Social Studio laden mislukt")}
    finally{setBusy(false)}
  }
  useEffect(()=>{void loadAll()},[stationSlug]);

  const selectedTemplate=useMemo(()=>templateDraft&&templateDraft.id===selectedTemplateId?templateDraft:templates.find(x=>x.id===selectedTemplateId)||templateDraft||templates[0]||null,[templates,selectedTemplateId,templateDraft]);
  const selectedCalendarPost=useMemo(()=>posts.find(x=>x.id===selectedCalendarPostId)||null,[posts,selectedCalendarPostId]);
  const calendarCells=useMemo(()=>monthCells(calendarMonth),[calendarMonth]);
  const builderConfig=(selectedTemplate&&isBuilderConfig(selectedTemplate.config)?selectedTemplate.config:null) as BuilderConfig|null;
  const builderVariables=builderConfig?variablesUsed(builderConfig):[];
  const visual={...cfg(selectedTemplate),artworkImage:ctx.artworkImage||cfg(selectedTemplate).artworkImage};
  const liveCaption=currentPost?.caption??replaceVars(selectedTemplate?.caption_template||"",ctx);
  const previewHeadline=replaceVars(visual.headline,ctx);
  const previewSubline=replaceVars(visual.subline,ctx);
  const previewFooter=replaceVars(visual.footer,ctx);
  const formatInfo=formats[format];

  useEffect(()=>{
    if(!selectedTemplate)return;
    if(!currentPost||currentPost.template_id!==selectedTemplate.id){
      setCurrentPost(newPost(stationSlug,selectedTemplate,ctx));
    }
  },[selectedTemplateId]);

  useEffect(()=>{
    let alive=true;setReviewEvents([]);setReviewComment("");
    if(!selectedCalendarPost||selectedCalendarPost.id.startsWith("new-"))return()=>{alive=false};
    void loadSocialReviewEvents(selectedCalendarPost.id).then(rows=>{if(alive)setReviewEvents(rows)}).catch(()=>{});
    return()=>{alive=false};
  },[selectedCalendarPostId]);

  async function autofill(){
    if(stationSlug==="all")return flash("Kies één station om live data in te vullen.");
    setBusy(true);
    const next={...ctx,date:new Date().toLocaleDateString("nl-BE"),time:new Date().toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit"})};
    const notes:string[]=[];
    try{
      try{
        const blocks=await loadSharedProgramming(stationSlug);const now=new Date();const weekday=now.getDay();const hm=now.getHours()*60+now.getMinutes();
        const current=blocks.find(x=>x.active&&x.day===weekday&&Number(x.start.slice(0,2))*60+Number(x.start.slice(3,5))<=hm&&Number(x.end.slice(0,2))*60+Number(x.end.slice(3,5))>hm);
        const upcoming=blocks.filter(x=>x.active&&x.day===weekday&&Number(x.start.slice(0,2))*60+Number(x.start.slice(3,5))>hm).sort((a,b)=>a.start.localeCompare(b.start))[0];
        if(current){next.program=current.name;next.presenter=current.host;notes.push("programma")}
        if(upcoming)next.nextShow=`${upcoming.name} om ${upcoming.start}`;
      }catch{}
      try{
        const hitlists=await loadSharedHitlists(stationSlug);const latest=hitlists[0];const first=latest?.entries?.[0];
        if(first){next.chartPosition="1";next.previousPosition=first.previousPosition==null?"—":String(first.previousPosition);if(!next.artist)next.artist=first.artist;if(!next.title)next.title=first.title;notes.push("hitlijst")}
      }catch{}
      next.station=brand.brand_name||stationSlug;next.cta=brand.default_cta||next.cta;
      setCtx(next);
      setCurrentPost(post=>post?{...post,payload:next,title:builderConfig?(next.title||post.title):replaceVars(visual.headline,next),caption:replaceVars(selectedTemplate?.caption_template||post.caption,next)}:post);
      flash(notes.length?`Automatisch ingevuld: ${notes.join(", ")}`:"Geen gekoppelde HUB-data gevonden; handmatig verder werken.");
    }finally{setBusy(false)}
  }

  function chooseTemplate(template:SocialTemplate){
    setSelectedTemplateId(template.id);setTemplateDraft(template);setFormat((template.aspect_ratio as FormatKey)||"4:5");
    setCurrentPost(newPost(stationSlug,template,ctx));setTab("studio");
  }
  function patchContext(key:keyof Context,value:string){
    const next={...ctx,[key]:value};setCtx(next);
    setCurrentPost(post=>post?{...post,payload:next}:post);
  }
  function patchPost(patch:Partial<SocialPost>){
    setCurrentPost(post=>post?{...post,...patch}:post);
  }
  function togglePlatform(platform:string){
    setCurrentPost(post=>{if(!post)return post;const current=post.platforms||[];return{...post,platforms:current.includes(platform)?current.filter(x=>x!==platform):[...current,platform]}});
  }
  function toggleChecklist(key:string){
    setCurrentPost(post=>post?{...post,checklist:{...(post.checklist||{}),[key]:!Boolean(post.checklist?.[key])}}:post);
  }

  async function persistBrand(){
    setBusy(true);try{await saveBrandKit(brand);setCtx(x=>({...x,station:brand.brand_name||stationSlug,cta:brand.default_cta||x.cta}));flash("Brand kit centraal opgeslagen")}catch(e){flash(e instanceof Error?e.message:"Brand kit opslaan mislukt")}finally{setBusy(false)}
  }
  async function persistPost(){
    if(!selectedTemplate)return;
    const base=currentPost||newPost(stationSlug,selectedTemplate,ctx);
    const post:SocialPost={...base,format,template_id:selectedTemplate.id.startsWith("new-")?null:selectedTemplate.id,payload:ctx,title:builderConfig?(ctx.title||base.title||selectedTemplate.name):replaceVars(visual.headline,ctx),caption:base.caption||replaceVars(selectedTemplate.caption_template,ctx)};
    setBusy(true);try{
      const saved=await saveSocialPost(post);
      setCurrentPost(saved);
      setPosts(rows=>[saved,...rows.filter(x=>x.id!==base.id&&x.id!==saved.id)]);
      setSelectedCalendarPostId(saved.id);
      flash("Socialpost centraal opgeslagen");
    }catch(e){flash(e instanceof Error?e.message:"Post opslaan mislukt")}finally{setBusy(false)}
  }
  async function updatePostStatus(post:SocialPost,status:SocialPost["status"]){
    try{
      const now=new Date().toISOString();
      const next:SocialPost={...post,status};
      if(status==="review")next.review_requested_at=post.review_requested_at||now;
      if(status==="approved"){next.approved_at=now;next.approved_by=collaboration.currentUser?.id||post.approved_by||null}
      if(status==="published")next.published_at=post.published_at||now;
      const saved=await saveSocialPost(next);
      setPosts(rows=>rows.map(x=>x.id===saved.id?saved:x));
      if(currentPost?.id===saved.id)setCurrentPost(saved);
      flash(`Status: ${statusLabel(status)}`);
    }catch(e){flash(e instanceof Error?e.message:"Status wijzigen mislukt")}
  }

  async function workflow(post:SocialPost,action:"review_requested"|"approved"|"changes_requested"|"published",comment=""){
    if(post.id.startsWith("new-"))return flash("Bewaar de post eerst.");
    setBusy(true);
    try{
      const now=new Date().toISOString();
      let next:SocialPost={...post};
      if(action==="review_requested")next={...next,status:"review",review_requested_at:now};
      if(action==="approved")next={...next,status:"approved",approved_at:now,approved_by:collaboration.currentUser?.id||null};
      if(action==="changes_requested")next={...next,status:"concept",changes_requested_at:now};
      if(action==="published")next={...next,status:"published",published_at:now};
      const saved=await saveSocialPost(next);
      const event=await addSocialReviewEvent(saved,action,comment);
      setPosts(rows=>rows.map(x=>x.id===saved.id?saved:x));
      setReviewEvents(rows=>[...rows,event]);
      setReviewComment("");
      if(currentPost?.id===saved.id)setCurrentPost(saved);
      if(action==="review_requested"){
        await collaboration.publishNotification({
          stationSlug,title:`Social review gevraagd: ${saved.title||"socialpost"}`,
          body:comment||"Een socialpost staat klaar om na te kijken.",category:"Social",
          severity:"info",actionPath:`/hub/${stationSlug}/social`,recipientUserId:saved.reviewer_id||null
        }).catch(()=>{});
      }else if(action==="changes_requested"){
        await collaboration.publishNotification({
          stationSlug,title:`Aanpassing gevraagd: ${saved.title||"socialpost"}`,
          body:comment||"De socialpost heeft nog aanpassingen nodig.",category:"Social",
          severity:"warning",actionPath:`/hub/${stationSlug}/social`,recipientUserId:saved.assigned_to||null
        }).catch(()=>{});
      }else if(action==="approved"){
        await collaboration.publishNotification({
          stationSlug,title:`Socialpost goedgekeurd: ${saved.title||"socialpost"}`,
          body:comment||"De socialpost is klaar voor publicatie.",category:"Social",
          severity:"info",actionPath:`/hub/${stationSlug}/social`,recipientUserId:saved.assigned_to||null
        }).catch(()=>{});
      }
      flash(reviewLabel(action));
    }catch(e){flash(e instanceof Error?e.message:"Reviewactie mislukt")}
    finally{setBusy(false)}
  }

  async function addReviewComment(post:SocialPost){
    if(!reviewComment.trim())return;
    try{
      const event=await addSocialReviewEvent(post,"comment",reviewComment);
      setReviewEvents(rows=>[...rows,event]);setReviewComment("");flash("Opmerking toegevoegd");
    }catch(e){flash(e instanceof Error?e.message:"Opmerking toevoegen mislukt")}
  }

  async function reschedulePost(post:SocialPost,value:string){
    try{
      const saved=await saveSocialPost({...post,scheduled_at:fromLocalInput(value)});
      setPosts(rows=>rows.map(x=>x.id===saved.id?saved:x));
      flash("Planning aangepast");
    }catch(e){flash(e instanceof Error?e.message:"Planning aanpassen mislukt")}
  }

  async function saveCopyBlock(){
    if(!copyDraft)return;
    setBusy(true);
    try{
      const saved=await saveSocialCopyBlock(copyDraft);
      setCopyBlocks(rows=>[saved,...rows.filter(x=>x.id!==copyDraft.id&&x.id!==saved.id)]);
      setCopyDraft(saved);flash("Copyblok centraal opgeslagen");
    }catch(e){flash(e instanceof Error?e.message:"Copyblok opslaan mislukt")}
    finally{setBusy(false)}
  }

  async function removeCopyBlock(){
    if(!copyDraft||copyDraft.id.startsWith("new-"))return;
    if(!confirm(`Copyblok “${copyDraft.name}” verwijderen?`))return;
    try{
      await deleteSocialCopyBlock(copyDraft.id);
      setCopyBlocks(rows=>rows.filter(x=>x.id!==copyDraft.id));setCopyDraft(null);flash("Copyblok verwijderd");
    }catch(e){flash(e instanceof Error?e.message:"Copyblok verwijderen mislukt")}
  }

  function insertCopyBlock(block:SocialCopyBlock){
    const rendered=replaceVars(block.content,ctx);
    setCurrentPost(post=>{
      if(!post&&selectedTemplate)return{...newPost(stationSlug,selectedTemplate,ctx),caption:rendered};
      if(!post)return post;
      return{...post,caption:`${post.caption}${post.caption.trim()?"\\n\\n":""}${rendered}`};
    });
    flash(`${block.name} ingevoegd`);
  }

  async function renderPng(targetFormat:FormatKey,download=true){
    if(!selectedTemplate)return;
    const f=formats[targetFormat];
    if(isBuilderConfig(selectedTemplate.config)){
      const canvas=await renderBuilderCanvas(selectedTemplate.config,ctx,brand,{width:f.w,height:f.h});
      if(download){const a=document.createElement("a");a.href=canvas.toDataURL("image/png");a.download=`${ctx.station}-${selectedTemplate.name}-${targetFormat}.png`.replace(/[^a-z0-9._-]+/gi,"-").toLowerCase();a.click()}
      return canvas;
    }
    const canvas=document.createElement("canvas");canvas.width=f.w;canvas.height=f.h;const g=canvas.getContext("2d");if(!g)return;
    const v=cfg(selectedTemplate),scale=f.w/1080;
    if(v.backgroundImage){try{const im=await loadImage(v.backgroundImage);const ratio=Math.max(f.w/im.width,f.h/im.height);const dw=im.width*ratio,dh=im.height*ratio;g.drawImage(im,(f.w-dw)/2,(f.h-dh)/2,dw,dh)}catch{g.fillStyle=brand.background_color;g.fillRect(0,0,f.w,f.h)}}else{
      const grad=g.createLinearGradient(0,0,f.w,f.h);grad.addColorStop(0,brand.primary_color);grad.addColorStop(.62,brand.secondary_color);grad.addColorStop(1,brand.background_color);g.fillStyle=grad;g.fillRect(0,0,f.w,f.h);
    }
    if(v.overlay>0){g.fillStyle=`rgba(7,8,20,${Math.min(.75,v.overlay/100)})`;g.fillRect(0,0,f.w,f.h)}
    if(v.accentBar){g.fillStyle=brand.accent_color;g.fillRect(0,0,18*scale,f.h)}
    const centered=v.align==="center"||v.layout==="alert"||v.layout==="minimal";const left=centered?f.w/2:78*scale;const textAlign=centered?"center":"left";g.textAlign=textAlign as CanvasTextAlign;
    if(brand.logo_url){try{const logo=await loadImage(brand.logo_url);const maxW=260*scale,maxH=110*scale;const r=Math.min(maxW/logo.width,maxH/logo.height);g.drawImage(logo,centered?(f.w-logo.width*r)/2:78*scale,58*scale,logo.width*r,logo.height*r)}catch{}}
    else{g.fillStyle=brand.text_color;g.font=`900 ${50*scale}px ${brand.font_family}, Arial`;g.fillText(brand.brand_name||ctx.station,left,105*scale)}
    g.fillStyle=brand.accent_color;const label=replaceVars(v.label,ctx).toUpperCase();g.font=`900 ${25*scale}px ${brand.font_family}, Arial`;const labelWidth=Math.min(f.w*.72,g.measureText(label).width+42*scale);const labelX=centered?(f.w-labelWidth)/2:78*scale;g.fillRect(labelX,190*scale,labelWidth,58*scale);g.fillStyle=brand.text_color;g.textAlign="center";g.fillText(label,labelX+labelWidth/2,229*scale);
    const artwork=v.artworkImage;if(v.showArtwork&&artwork){try{const image=await loadImage(artwork);let aw=Math.min(f.w*.42,f.h*.32),ah=aw,ax=centered?(f.w-aw)/2:f.w-aw-80*scale,ay=310*scale;if(v.layout==="split"){aw=f.w*.47;ah=aw;ax=f.w-aw-58*scale;ay=f.h*.25}else if(v.layout==="chart"){aw=f.w*.27;ah=aw;ax=f.w-aw-70*scale;ay=f.h-ah-105*scale}else if(v.layout==="show"){aw=f.w*.88;ah=f.h*.52;ax=f.w*.06;ay=f.h*.18}else if(v.layout==="poster"){aw=f.w*.58;ah=f.h;ax=f.w-aw;ay=0}else if(v.layout==="alert"){aw=f.w*.34;ah=aw;ax=(f.w-aw)/2;ay=f.h*.27}g.save();if(v.artworkShape==="circle"&&Math.abs(aw-ah)<2){g.beginPath();g.arc(ax+aw/2,ay+ah/2,aw/2,0,Math.PI*2);g.clip()}else if(v.artworkShape==="rounded"){const r=36*scale;g.beginPath();g.roundRect(ax,ay,aw,ah,r);g.clip()}g.drawImage(image,ax,ay,aw,ah);g.restore()}catch{}}
    let textX=left,headlineY=f.h*.57,maxWidth=centered?f.w*.82:f.w*.78,headlineSize=Math.max(48,78*scale),subSize=Math.max(34,46*scale);if(v.layout==="split"){textX=78*scale;headlineY=f.h*.62;maxWidth=f.w*.43;headlineSize=Math.max(44,70*scale)}else if(v.layout==="chart"){textX=78*scale;headlineY=f.h*.55;maxWidth=f.w*.62;headlineSize=Math.max(75,128*scale)}else if(v.layout==="show"){textX=78*scale;headlineY=f.h*.76;maxWidth=f.w*.82;headlineSize=Math.max(48,76*scale)}else if(v.layout==="poster"){textX=78*scale;headlineY=f.h*.61;maxWidth=f.w*.46;headlineSize=Math.max(44,72*scale)}else if(v.layout==="minimal"){headlineY=f.h*.43;headlineSize=Math.max(45,72*scale)}else if(v.layout==="alert"){headlineY=f.h*.66;headlineSize=Math.max(58,92*scale);subSize=Math.max(32,42*scale)}g.textAlign=(v.layout==="split"||v.layout==="chart"||v.layout==="poster")?"left":textAlign as CanvasTextAlign;g.fillStyle=brand.text_color;g.font=`900 ${headlineSize}px ${brand.font_family}, Arial`;wrap(g,previewHeadline,textX,headlineY,maxWidth,headlineSize*1.04,3);g.font=`600 ${subSize}px ${brand.font_family}, Arial`;g.globalAlpha=.88;wrap(g,previewSubline,textX,headlineY+headlineSize*1.55,maxWidth,subSize*1.18,3);g.globalAlpha=1;g.font=`800 ${Math.max(23,27*scale)}px ${brand.font_family}, Arial`;g.globalAlpha=.8;g.fillText(previewFooter,textX,f.h-72*scale);g.globalAlpha=1;
    if(download){const a=document.createElement("a");a.href=canvas.toDataURL("image/png");a.download=`${ctx.station}-${selectedTemplate.name}-${targetFormat}.png`.replace(/[^a-z0-9._-]+/gi,"-").toLowerCase();a.click()}
    return canvas;
  }
  async function exportPack(){
    const selected=(Object.keys(formats) as FormatKey[]).filter(key=>exportFormats[key]);
    if(!selected.length)return flash("Kies minstens één exportformaat.");
    for(const key of selected){await renderPng(key,true);await new Promise(r=>setTimeout(r,180))}
    flash(`${selected.length} formaat${selected.length===1?"":"en"} gegenereerd`);
  }
  async function copyCaption(){try{await navigator.clipboard.writeText(currentPost?.caption||liveCaption);flash("Caption gekopieerd")}catch{flash("Kopiëren niet beschikbaar")}}
  async function handleAsset(file:File){
    if(stationSlug==="all")return flash("Kies één station.");
    setAssetUpload(true);try{const asset=await uploadSocialAsset(stationSlug,file,assetTags.split(",").map(x=>x.trim()).filter(Boolean));setAssets(rows=>[asset,...rows]);flash("Asset geüpload naar Supabase Storage")}catch(e){flash(e instanceof Error?e.message:"Upload mislukt")}finally{setAssetUpload(false)}
  }
  async function handleStudioPhoto(file:File|undefined){
    if(!file)return;setAssetUpload(true);try{const asset=await uploadSocialAsset(stationSlug,file,["studio","post-photo"]);setAssets(rows=>[asset,...rows]);patchContext("artworkImage",asset.public_url);flash("Foto toegevoegd aan deze socialpost") }catch(e){flash(e instanceof Error?e.message:"Foto uploaden mislukt")}finally{setAssetUpload(false)}
  }
  async function removeAsset(asset:SocialAsset){if(!confirm(`Asset “${asset.name}” verwijderen?`))return;try{await deleteSocialAsset(asset);setAssets(rows=>rows.filter(x=>x.id!==asset.id));flash("Asset verwijderd")}catch(e){flash(e instanceof Error?e.message:"Verwijderen mislukt")}}

  if(stationSlug==="all")return <div><div className="page-intro"><div><h2>Social Studio</h2><p>Kies één station zodat VLACORA de juiste brand kit, assets en templates gebruikt.</p></div></div><div className="card empty-live-state"><strong>Social Studio is station-specifiek</strong><span>Kies bovenaan een station.</span></div></div>;

  return <div className="social-studio-v16">
    <div className="page-intro social-studio-intro">
      <div><span className="eyebrow">VLACORA CONTENT</span><h2>Social Studio</h2><p>Kies een template uit de aparte Templatebouwer, vul alleen de inhoud in en plan daarna review/publicatie. De grafische opbouw kan hier niet per ongeluk verschoven worden.</p></div>
      <div className="button-row"><button className="ghost" disabled={busy} onClick={()=>void autofill()}>⚡ Vul HUB-data in</button>{canEditContent&&<button className="primary" disabled={busy||!selectedTemplate} onClick={()=>void persistPost()}>Bewaar concept</button>}</div>
    </div>
    {notice&&<div className="inline-notice standalone">{notice}</div>}
    <div className="social-tabs">
      {visibleTabs.map(([key,label])=><button key={key} className={tab===key?"active":""} onClick={()=>setTab(key)}>{label}</button>)}
    </div>

    {tab==="studio"&&selectedTemplate&&<div className="social-workbench">
      <section className="card social-composer social-fields-panel">
        <div className="section-head"><div><span className="eyebrow">VELDEN INVULLEN</span><h3>{currentPost?.title||selectedTemplate.name}</h3><p>Alleen de inhoud die dit template nodig heeft. De lagen en vormgeving worden centraal beheerd in de aparte Templatebouwer.</p></div><span className="badge badge-blue">{selectedTemplate.name}</span></div>
        <div className="social-template-select-row"><label className="field">Template<select className="select" value={selectedTemplate.id} onChange={e=>{const x=templates.find(t=>t.id===e.target.value);if(x)chooseTemplate(x)}}>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><a className="ghost social-builder-link" href={`/hub/${stationSlug}/social-templatebouwer`}>Open Templatebouwer →</a></div>
        {builderConfig?<div className="social-format-row compact builder-format-locked"><span>Formaat uit template</span><strong>{formats[format].label}</strong></div>:<div className="social-format-row compact">{(Object.keys(formats) as FormatKey[]).map(key=><button key={key} className={format===key?"active":""} onClick={()=>setFormat(key)}>{formats[key].label}</button>)}</div>}
        {(!builderConfig||builderConfig.layers.some(layer=>layer.type==="image"&&layer.source==="post-image"))&&<div className="social-photo-field"><div><strong>Afbeelding / DJ-foto</strong><small>Deze foto vult de invulbare fotolaag van het gekozen template.</small></div><div className="social-photo-actions"><label className="ghost file-button">{assetUpload?"Uploaden…":"Foto kiezen"}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>void handleStudioPhoto(e.target.files?.[0])}/></label>{ctx.artworkImage&&<button className="ghost" onClick={()=>patchContext("artworkImage","")}>Verwijder</button>}</div>{assets.length>0&&<div className="studio-asset-strip">{assets.slice(0,8).map(a=><button key={a.id} className={ctx.artworkImage===a.public_url?"selected":""} onClick={()=>patchContext("artworkImage",a.public_url)}><img src={a.public_url} alt=""/></button>)}</div>}</div>}
        <div className="social-context-grid clean">
          {(!builderConfig||builderVariables.includes("{artist}"))&&<label>Artiest<input value={ctx.artist} onChange={e=>patchContext("artist",e.target.value)}/></label>}
          {(!builderConfig||builderVariables.includes("{title}"))&&<label>Titel / onderwerp<input value={ctx.title} onChange={e=>patchContext("title",e.target.value)}/></label>}
          {(!builderConfig||builderVariables.includes("{program}"))&&<label>Programma<input value={ctx.program} onChange={e=>patchContext("program",e.target.value)}/></label>}
          {(!builderConfig||builderVariables.includes("{presenter}"))&&<label>Presentator<input value={ctx.presenter} onChange={e=>patchContext("presenter",e.target.value)}/></label>}
          {(!builderConfig||builderVariables.includes("{chart_position}"))&&<label>Hitlijstpositie<input value={ctx.chartPosition} onChange={e=>patchContext("chartPosition",e.target.value)}/></label>}
          {(!builderConfig||builderVariables.includes("{previous_position}"))&&<label>Vorige positie<input value={ctx.previousPosition} onChange={e=>patchContext("previousPosition",e.target.value)}/></label>}
          {(!builderConfig||builderVariables.includes("{next_show}"))&&<label>Volgende show<input value={ctx.nextShow} onChange={e=>patchContext("nextShow",e.target.value)}/></label>}
          {builderConfig&&builderVariables.includes("{date}")&&<label>Datum<input value={ctx.date} onChange={e=>patchContext("date",e.target.value)}/></label>}
          {builderConfig&&builderVariables.includes("{time}")&&<label>Tijd<input value={ctx.time} onChange={e=>patchContext("time",e.target.value)}/></label>}
          {builderConfig&&builderVariables.includes("{cta}")&&<label>CTA<input value={ctx.cta} onChange={e=>patchContext("cta",e.target.value)}/></label>}
        </div>
        <details className="social-editor-details" open><summary>Caption & tekst</summary><div className="social-caption-head"><strong>Caption</strong><button onClick={()=>void copyCaption()}>Kopieer</button></div><textarea className="social-caption-editor" value={currentPost?.caption??liveCaption} onChange={e=>setCurrentPost(p=>p?{...p,caption:e.target.value}:p)} /><div className="variable-strip">{variables.map(v=><button key={v} onClick={()=>setCurrentPost(p=>p?{...p,caption:`${p.caption}${p.caption.endsWith(" ")?"":" "}${v}`}:p)}>{v}</button>)}</div></details>{currentPost&&!currentPost.id.startsWith("new-")&&<div className="social-post-attachments"><AttachmentPanel stationSlug={stationSlug} entityType="social_post" entityId={currentPost.id} title="Bestanden bij deze socialpost"/></div>}
        <details className="social-editor-details"><summary>Planning, kanalen & goedkeuring</summary><div className="social-post-controls"><label>Status<select value={currentPost?.status||"concept"} onChange={e=>setCurrentPost(p=>p?{...p,status:e.target.value as SocialPost["status"]}:p)}><option value="concept">Concept</option><option value="review">Klaar voor review</option><option value="approved">Goedgekeurd</option><option value="published">Gepubliceerd</option></select></label><label>Planning<input type="datetime-local" value={toLocalInput(currentPost?.scheduled_at||null)} onChange={e=>setCurrentPost(p=>p?{...p,scheduled_at:fromLocalInput(e.target.value)}:p)}/></label></div><div className="social-platform-picker">{["Instagram","Instagram Story","Facebook","TikTok","YouTube Shorts","LinkedIn"].map(platform=><button key={platform} className={(currentPost?.platforms||[]).includes(platform)?"active":""} onClick={()=>togglePlatform(platform)}>{platform}</button>)}</div><div className="social-brief-grid"><label>Campagne<input value={currentPost?.campaign||""} onChange={e=>patchPost({campaign:e.target.value})}/></label><label>Contentpijler<input value={currentPost?.content_pillar||""} onChange={e=>patchPost({content_pillar:e.target.value})}/></label><label>Doel<input value={currentPost?.objective||""} onChange={e=>patchPost({objective:e.target.value})}/></label><label>Deadline<input type="datetime-local" value={toLocalInput(currentPost?.due_at||null)} onChange={e=>patchPost({due_at:fromLocalInput(e.target.value)})}/></label><label>Eigenaar<select value={currentPost?.assigned_to||""} onChange={e=>patchPost({assigned_to:e.target.value||null})}><option value="">Niet toegewezen</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Reviewer<select value={currentPost?.reviewer_id||""} onChange={e=>patchPost({reviewer_id:e.target.value||null})}><option value="">Geen vaste reviewer</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div><div className="social-checklist">{[["copy","Copy klaar"],["visual","Visual klaar"],["rights","Rechten gecheckt"],["links","Links/CTA gecheckt"]].map(([key,label])=><label key={key}><input type="checkbox" checked={Boolean(currentPost?.checklist?.[key])} onChange={()=>toggleChecklist(key)}/><span>{label}</span></label>)}</div><label className="field">Interne notitie<textarea className="input" value={currentPost?.internal_notes||""} onChange={e=>patchPost({internal_notes:e.target.value})}/></label>{currentPost?.status==="published"&&<label className="field">Link naar publicatie<input className="input" value={currentPost?.publication_url||""} onChange={e=>patchPost({publication_url:e.target.value})}/></label>}</details>
        <div className="social-panel-actions">{canAssets&&<button className="ghost" onClick={()=>setTab("copy")}>Copyblokken</button>}{canEditContent&&<button className="primary" disabled={busy} onClick={()=>void persistPost()}>Concept opslaan</button>}</div>
      </section>

      <section className="social-preview-stage">
        <div className="social-preview-toolbar"><div><strong>Live preview</strong><span>{formatInfo.w} × {formatInfo.h}</span></div><div className="button-row"><button className="primary soft" onClick={()=>void renderPng(format,true)}>PNG downloaden</button>{!builderConfig&&<button className="ghost" onClick={()=>void exportPack()}>Export geselecteerd</button>}</div></div>
        {!builderConfig&&<div className="social-export-set">{(Object.keys(formats) as FormatKey[]).map(key=><label key={key}><input type="checkbox" checked={exportFormats[key]} onChange={e=>setExportFormats({...exportFormats,[key]:e.target.checked})}/><span>{formats[key].label}</span></label>)}</div>}
        {builderConfig?<SocialTemplateRenderer config={builderConfig} ctx={ctx} brand={brand} className={`ratio-${format.replace(":","-")}`}/>:<div className={`social-artboard social-layout-${visual.layout} ratio-${format.replace(":","-")}`} style={{fontFamily:`${brand.font_family},sans-serif`,color:brand.text_color,background:visual.backgroundImage?`linear-gradient(rgba(7,8,20,${visual.overlay/100}),rgba(7,8,20,${visual.overlay/100})),url(${visual.backgroundImage}) center/cover`:`linear-gradient(145deg,${brand.primary_color},${brand.secondary_color} 62%,${brand.background_color})`,textAlign:visual.align}}>
          {visual.accentBar&&<span className="social-accent-edge" style={{background:brand.accent_color}}/>}
          <div className="social-preview-brand">{brand.logo_url?<img src={brand.logo_url} alt=""/>:<strong>{brand.brand_name}</strong>}</div>
          <span className="social-preview-label" style={{background:brand.accent_color}}>{replaceVars(visual.label,ctx)}</span>
          {visual.showArtwork&&<div className={`social-preview-artwork ${visual.artworkShape}`}>{visual.artworkImage?<img src={visual.artworkImage} alt=""/>:<span>♫</span>}</div>}
          <div className="social-preview-copy"><h2>{previewHeadline}</h2><h3>{previewSubline}</h3></div>
          <div className="social-preview-footer">{previewFooter}</div>
        </div>}
        <div className="card social-autofill-card"><div><strong>Automatische variabelen</strong><span>Programmering en de recentste hitlijst worden alleen opgehaald wanneer je de HUB-data vernieuwt.</span></div><button className="ghost" disabled={busy} onClick={()=>void autofill()}>⚡ Vernieuw data</button></div>
      </section>
    </div>}

    {tab==="brand"&&<div className="social-brand-layout">
      <section className="card"><div className="section-head"><div><h3>Brand kit • {stationSlug}</h3><p>Logo, kleuren en basisstijl. De laagopbouw zelf beheer je voortaan in Templatebouwer.</p></div><button className="primary" disabled={busy} onClick={()=>void persistBrand()}>Opslaan</button></div>
        <div className="brand-kit-grid">
          <label>Merknaam<input value={brand.brand_name} onChange={e=>setBrand({...brand,brand_name:e.target.value})}/></label>
          <label>Logo URL<input value={brand.logo_url} onChange={e=>setBrand({...brand,logo_url:e.target.value})} placeholder="of kies een asset hieronder"/></label>
          <label>Font<select value={brand.font_family} onChange={e=>setBrand({...brand,font_family:e.target.value})}><option>Inter</option><option>Arial</option><option>Georgia</option><option>Trebuchet MS</option><option>Verdana</option></select></label>
          <label>Standaard CTA<input value={brand.default_cta} onChange={e=>setBrand({...brand,default_cta:e.target.value})}/></label>
          <label className="wide-brand-field">Standaard hashtags<input value={brand.default_hashtags} onChange={e=>setBrand({...brand,default_hashtags:e.target.value})}/></label>
        </div>
        <div className="brand-color-grid">{([
          ["Primair","primary_color"],["Secundair","secondary_color"],["Accent","accent_color"],["Achtergrond","background_color"],["Tekst","text_color"]
        ] as [string,keyof BrandKit][]).map(([label,key])=><label key={String(key)}><span>{label}</span><input type="color" value={String(brand[key])} onChange={e=>setBrand({...brand,[key]:e.target.value})}/><code>{String(brand[key])}</code></label>)}</div>
      </section>
      <section className="card brand-preview-card" style={{background:`linear-gradient(140deg,${brand.primary_color},${brand.secondary_color} 65%,${brand.background_color})`,color:brand.text_color,fontFamily:`${brand.font_family},sans-serif`}}><span className="eyebrow" style={{color:brand.text_color}}>BRAND PREVIEW</span>{brand.logo_url?<img src={brand.logo_url} alt=""/>:<h2>{brand.brand_name}</h2>}<b style={{background:brand.accent_color}}>{brand.default_cta}</b><p>{brand.default_hashtags}</p></section>
      <section className="card brand-assets"><div className="section-head"><div><h3>Snel logo kiezen</h3><p>Gebruik één van de centrale assets.</p></div></div><div className="mini-asset-grid">{assets.slice(0,8).map(a=><button key={a.id} onClick={()=>setBrand({...brand,logo_url:a.public_url})}><img src={a.public_url} alt=""/><span>{a.name}</span></button>)}</div></section>
    </div>}

    {tab==="calendar"&&<div className="social-phase2-calendar">
      <div className="page-intro sub-intro">
        <div><h3>Contentkalender & review</h3><p>Plan de maand, vraag feedback, keur posts goed en houd alle opmerkingen bij.</p></div>
        <div className="button-row"><button className="ghost" onClick={()=>setCalendarMonth(addMonths(calendarMonth,-1))}>‹ Vorige</button><button className="ghost" onClick={()=>setCalendarMonth(monthStart(new Date()))}>Deze maand</button><button className="ghost" onClick={()=>setCalendarMonth(addMonths(calendarMonth,1))}>Volgende ›</button>{canEditContent&&<button className="primary soft" onClick={()=>setTab("studio")}>＋ Nieuwe post</button>}</div>
      </div>

      <div className="social-calendar-summary">
        <div className="card"><span>Concept</span><strong>{posts.filter(p=>p.status==="concept").length}</strong></div>
        <div className="card"><span>Wacht op review</span><strong>{posts.filter(p=>p.status==="review").length}</strong></div>
        <div className="card"><span>Goedgekeurd</span><strong>{posts.filter(p=>p.status==="approved").length}</strong></div>
        <div className="card"><span>Gepubliceerd</span><strong>{posts.filter(p=>p.status==="published").length}</strong></div>
      </div>

      <div className="social-calendar-review-layout">
        <section className="card social-month-card">
          <div className="social-month-title"><strong>{new Intl.DateTimeFormat("nl-BE",{month:"long",year:"numeric"}).format(calendarMonth)}</strong><span>Klik op een post om review en planning te openen.</span></div>
          <div className="social-month-weekdays">{["ma","di","wo","do","vr","za","zo"].map(d=><span key={d}>{d}</span>)}</div>
          <div className="social-month-grid">{calendarCells.map(day=>{
            const key=localDateKey(day);
            const dayPosts=posts.filter(post=>postDay(post)===key);
            const outside=day.getMonth()!==calendarMonth.getMonth();
            const today=key===localDateKey(new Date());
            return <div key={key} className={`social-day-cell ${outside?"outside":""} ${today?"today":""}`}>
              <div className="social-day-number"><b>{day.getDate()}</b>{today&&<span>vandaag</span>}</div>
              <div className="social-day-posts">{dayPosts.slice(0,4).map(post=><button key={post.id} className={`social-day-post ${post.status} ${selectedCalendarPostId===post.id?"selected":""}`} onClick={()=>setSelectedCalendarPostId(post.id)}><span>{post.scheduled_at?new Date(post.scheduled_at).toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit"}):""}</span><strong>{post.title||"Socialpost"}</strong></button>)}{dayPosts.length>4&&<small>+{dayPosts.length-4} meer</small>}</div>
            </div>
          })}</div>
          <div className="social-unscheduled">
            <strong>Nog niet ingepland</strong>
            <div>{posts.filter(p=>!p.scheduled_at&&p.status!=="archived").map(post=><button key={post.id} onClick={()=>setSelectedCalendarPostId(post.id)}><span className={`social-status-dot ${post.status}`}/>{post.title||"Socialpost"} <small>{statusLabel(post.status)}</small></button>)}</div>
          </div>
        </section>

        <aside className="card social-review-panel">
          {!selectedCalendarPost?<div className="empty-live-state"><strong>Kies een socialpost</strong><span>Dan zie je hier planning, reviewstatus en opmerkingen.</span></div>:<>
            <div className="social-review-head"><div><span className={`social-review-status ${selectedCalendarPost.status}`}>{statusLabel(selectedCalendarPost.status)}</span><h3>{selectedCalendarPost.title||"Socialpost"}</h3><p>{selectedCalendarPost.caption}</p></div><button className="mini-btn" onClick={()=>{setCurrentPost(selectedCalendarPost);setCtx({...defaultContext(stationSlug),...(selectedCalendarPost.payload as Partial<Context>)});setFormat((selectedCalendarPost.format as FormatKey)||"4:5");const tt=templates.find(x=>x.id===selectedCalendarPost.template_id);if(tt){setSelectedTemplateId(tt.id);setTemplateDraft(tt)}setTab("studio")}}>Bewerk</button></div>

            <label className="field">Publicatiemoment<input className="input" type="datetime-local" value={toLocalInput(selectedCalendarPost.scheduled_at)} onChange={e=>void reschedulePost(selectedCalendarPost,e.target.value)}/></label>
            <div className="social-calendar-meta">
              <div><span>Kanalen</span><strong>{selectedCalendarPost.platforms?.length?selectedCalendarPost.platforms.join(" • "):"Nog niet gekozen"}</strong></div>
              <div><span>Campagne</span><strong>{selectedCalendarPost.campaign||"—"}</strong></div>
              <div><span>Contentpijler</span><strong>{selectedCalendarPost.content_pillar||"—"}</strong></div>
              <div><span>Eigenaar</span><strong>{people.find(p=>p.id===selectedCalendarPost.assigned_to)?.name||"Niet toegewezen"}</strong></div>
              <div><span>Reviewer</span><strong>{people.find(p=>p.id===selectedCalendarPost.reviewer_id)?.name||"Niet toegewezen"}</strong></div>
              <div><span>Checklist</span><strong>{Object.values(selectedCalendarPost.checklist||{}).filter(Boolean).length}/4 klaar</strong></div>
            </div>

            <div className="social-review-actions">
              <button disabled={busy} className="review-request" onClick={()=>void workflow(selectedCalendarPost,"review_requested",reviewComment)}>👀 Vraag review</button>
              {canApprove&&<><button disabled={busy} className="review-approve" onClick={()=>void workflow(selectedCalendarPost,"approved",reviewComment)}>✓ Goedkeuren</button>
              <button disabled={busy} className="review-changes" onClick={()=>void workflow(selectedCalendarPost,"changes_requested",reviewComment)}>↺ Aanpassing nodig</button>
              <button disabled={busy} className="review-publish" onClick={()=>void workflow(selectedCalendarPost,"published",reviewComment)}>● Markeer gepubliceerd</button></>}
            </div>

            <div className="social-review-timeline">
              <div className="section-head"><div><h3>Reviewgeschiedenis</h3><p>Append-only: beslissingen en opmerkingen blijven zichtbaar.</p></div></div>
              {reviewEvents.length===0&&<div className="empty-live-state compact"><strong>Nog geen reviewhistoriek</strong><span>Vraag review of voeg hieronder een opmerking toe.</span></div>}
              {reviewEvents.map(event=><div className={`social-review-event event-${event.event_type}`} key={event.id}><span className="review-event-dot"/><div><strong>{reviewLabel(event.event_type)}</strong><small>{event.author_name||"Teamlid"} • {new Date(event.created_at).toLocaleString("nl-BE")}</small>{event.comment&&<p>{event.comment}</p>}</div></div>)}
            </div>

            <div className="review-comment-box"><textarea value={reviewComment} onChange={e=>setReviewComment(e.target.value)} placeholder="Opmerking voor de redactie / socialreview…"/><button className="primary soft" disabled={!reviewComment.trim()||busy} onClick={()=>void addReviewComment(selectedCalendarPost)}>Opmerking toevoegen</button></div>
          </>}
        </aside>
      </div>
    </div>}

    {tab==="copy"&&<div className="social-copy-layout">
      <section className="card social-copy-browser">
        <div className="section-head"><div><h3>Copyblokken</h3><p>Herbruikbare CTA’s, hashtags, promo’s en vaste teksten.</p></div><button className="mini-btn" onClick={()=>setCopyDraft(newCopyBlock(stationSlug))}>＋</button></div>
        {copyBlocks.length===0&&<div className="empty-live-state compact"><strong>Nog geen copyblokken</strong><span>Maak bijvoorbeeld “Luister live”, “Instagram hashtags” of “Winactie voorwaarden”.</span></div>}
        {[...new Set(copyBlocks.map(x=>x.category))].map(category=><div className="copy-category-group" key={category}><strong>{category}</strong>{copyBlocks.filter(x=>x.category===category).map(block=><button key={block.id} className={copyDraft?.id===block.id?"selected":""} onClick={()=>setCopyDraft(block)}><span>{block.name}</span><small>{block.content.slice(0,90)}</small></button>)}</div>)}
        <div className="copy-preset-section"><strong>Snelle starters</strong>
          <button onClick={()=>setCopyDraft(newCopyBlock(stationSlug,"CTA","🎧 {cta}: luister naar {station}."))}>＋ CTA luisteren</button>
          <button onClick={()=>setCopyDraft(newCopyBlock(stationSlug,"Hashtags","{station} #radio #music #onair"))}>＋ Hashtags</button>
          <button onClick={()=>setCopyDraft(newCopyBlock(stationSlug,"Programma","🎙️ {program} met {presenter} — vandaag om {time} op {station}."))}>＋ Programmapromo</button>
          <button onClick={()=>setCopyDraft(newCopyBlock(stationSlug,"Hitlijst","🏆 #{chart_position}: {artist} — {title}. Vorige week #{previous_position}."))}>＋ Hitlijst</button>
        </div>
      </section>

      <section className="card social-copy-editor">
        {!copyDraft?<div className="empty-live-state"><strong>Kies of maak een copyblok</strong><span>Copyblokken kunnen vanuit de Studio met één klik in je caption.</span></div>:<>
          <div className="section-head"><div><h3>{copyDraft.name}</h3><p>Variabelen worden pas bij gebruik ingevuld met de actuele postdata.</p></div><div className="button-row"><button className="primary" disabled={busy} onClick={()=>void saveCopyBlock()}>Opslaan</button>{!copyDraft.id.startsWith("new-")&&<button className="ghost danger-text" onClick={()=>void removeCopyBlock()}>Verwijder</button>}</div></div>
          <div className="copy-meta-grid"><label>Naam<input value={copyDraft.name} onChange={e=>setCopyDraft({...copyDraft,name:e.target.value})}/></label><label>Categorie<input value={copyDraft.category} onChange={e=>setCopyDraft({...copyDraft,category:e.target.value})}/></label></div>
          <label className="field">Tekst<textarea className="input textarea copy-main-textarea" value={copyDraft.content} onChange={e=>setCopyDraft({...copyDraft,content:e.target.value})}/></label>
          <div className="variable-strip">{variables.map(v=><button key={v} onClick={()=>setCopyDraft({...copyDraft,content:`${copyDraft.content}${copyDraft.content.endsWith(" ")?"":" "}${v}`})}>{v}</button>)}</div>
          <div className="copy-preview"><span>Voorbeeld met huidige Studio-data</span><p>{replaceVars(copyDraft.content,ctx)}</p></div>
          <button className="ghost" onClick={()=>insertCopyBlock(copyDraft)}>＋ Meteen in huidige caption invoegen</button>
        </>}
      </section>
    </div>}

    {tab==="assets"&&<div className="social-assets-layout">
      <section className="card asset-upload-card"><div className="section-head"><div><h3>Asset library</h3><p>Alleen uploaden wanneer nodig. Dit gebruikt Supabase Storage.</p></div></div>
        <label className="field">Tags<input className="input" value={assetTags} onChange={e=>setAssetTags(e.target.value)} placeholder="presentator, logo, zomer"/></label>
        <label className={`social-dropzone ${assetUpload?"busy":""}`}>{assetUpload?"Uploaden…":"Klik om PNG/JPG/WEBP te uploaden (max. 5 MB)"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={assetUpload} onChange={e=>{const file=e.target.files?.[0];if(file)void handleAsset(file);e.currentTarget.value=""}}/></label>
        <div className="usage-note compact"><strong>Zuinig</strong><span>Geen automatische uploads of thumbnails. Alleen bestanden die je bewust kiest gaan naar Storage.</span></div>
      </section>
      <section className="social-asset-grid-v16">{assets.map(asset=><article className="card" key={asset.id}><img src={asset.public_url} alt=""/><strong>{asset.name}</strong><small>{asset.tags?.join(" • ")||"geen tags"}</small><div className="button-row"><button className="ghost" onClick={()=>{patchContext("artworkImage",asset.public_url);setTab("studio")}}>Gebruik in post</button><button className="mini-btn danger" onClick={()=>void removeAsset(asset)}>×</button></div></article>)}</section>
    </div>}
  </div>
}
