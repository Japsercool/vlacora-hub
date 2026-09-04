import type { BrandKit,SocialTemplate } from "@/lib/supabase/social";

export type BuilderFormatKey="1:1"|"4:5"|"9:16"|"16:9";
export type BuilderLayerType="text"|"image"|"shape";
export type BuilderImageSource="asset"|"post-image"|"brand-logo";
export type BuilderShape="rect"|"ellipse"|"line";

export type BuilderLayerBase={
  id:string;name:string;type:BuilderLayerType;x:number;y:number;width:number;height:number;
  rotation:number;opacity:number;locked:boolean;hidden:boolean;z:number;
};
export type BuilderTextLayer=BuilderLayerBase&{
  type:"text";text:string;fontSize:number;fontWeight:number;fontFamily:string;color:string;
  align:"left"|"center"|"right";lineHeight:number;letterSpacing:number;textTransform:"none"|"uppercase";
  background:string;borderRadius:number;padding:number;stroke:string;strokeWidth:number;
};
export type BuilderImageLayer=BuilderLayerBase&{
  type:"image";src:string;source:BuilderImageSource;fit:"cover"|"contain";borderRadius:number;
  borderColor:string;borderWidth:number;positionX?:number;positionY?:number;
};
export type BuilderShapeLayer=BuilderLayerBase&{
  type:"shape";shape:BuilderShape;fill:string;stroke:string;strokeWidth:number;borderRadius:number;
};
export type BuilderLayer=BuilderTextLayer|BuilderImageLayer|BuilderShapeLayer;
export type BuilderCanvas={
  width:number;height:number;background:string;background2:string;backgroundImage:string;
  gradient:boolean;grid:boolean;snap:boolean;gradientAngle?:number;
};
export type BuilderConfig={builderVersion:2;canvas:BuilderCanvas;layers:BuilderLayer[]};

const makeId=()=>`layer-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
const formats:Record<BuilderFormatKey,{width:number;height:number}>={
  "1:1":{width:1080,height:1080},"4:5":{width:1080,height:1350},"9:16":{width:1080,height:1920},"16:9":{width:1600,height:900}
};
export const BUILDER_FORMATS=formats;

export const BUILDER_FONTS=[
  {label:"Space Grotesk",value:"Space Grotesk"},
  {label:"Inter / modern sans",value:"Inter"},
  {label:"Segoe UI",value:"Segoe UI"},
  {label:"Arial",value:"Arial"},
  {label:"Arial Black",value:"Arial Black"},
  {label:"Trebuchet MS",value:"Trebuchet MS"},
  {label:"Verdana",value:"Verdana"},
  {label:"Impact",value:"Impact"},
  {label:"Georgia",value:"Georgia"},
  {label:"Times New Roman",value:"Times New Roman"},
  {label:"Courier New",value:"Courier New"},
  {label:"Systeemfont",value:"system-ui"}
] as const;

export type BuilderContext={
  station:string;artist:string;title:string;program:string;presenter:string;chartPosition:string;
  previousPosition:string;nextShow:string;date:string;time:string;cta:string;artworkImage:string;
};

export const BUILDER_VARIABLES=[
  "{station}","{artist}","{title}","{program}","{presenter}","{chart_position}",
  "{previous_position}","{next_show}","{date}","{time}","{cta}"
] as const;

export function replaceBuilderVars(text:string,ctx:BuilderContext){
  return text.replaceAll("{station}",ctx.station).replaceAll("{artist}",ctx.artist).replaceAll("{title}",ctx.title)
    .replaceAll("{program}",ctx.program).replaceAll("{presenter}",ctx.presenter)
    .replaceAll("{chart_position}",ctx.chartPosition).replaceAll("{previous_position}",ctx.previousPosition)
    .replaceAll("{next_show}",ctx.nextShow).replaceAll("{date}",ctx.date).replaceAll("{time}",ctx.time).replaceAll("{cta}",ctx.cta);
}

export function isBuilderConfig(value:unknown):value is BuilderConfig{
  const v=value as Partial<BuilderConfig>|null;
  return Boolean(v&&v.builderVersion===2&&v.canvas&&Array.isArray(v.layers));
}

export function blankBuilderConfig(format:BuilderFormatKey="4:5",brand?:Partial<BrandKit>):BuilderConfig{
  const f=formats[format];
  return{builderVersion:2,canvas:{width:f.width,height:f.height,background:brand?.primary_color||"#2924a8",background2:brand?.secondary_color||"#6b4cff",backgroundImage:"",gradient:true,grid:true,snap:true,gradientAngle:145},layers:[]};
}

export function textLayer(name:string,text:string,x:number,y:number,width:number,height:number,opts:Partial<BuilderTextLayer>={}):BuilderTextLayer{
  return{id:makeId(),name,type:"text",x,y,width,height,rotation:0,opacity:1,locked:false,hidden:false,z:10,
    text,fontSize:72,fontWeight:800,fontFamily:"Space Grotesk",color:"#ffffff",align:"left",lineHeight:1.05,letterSpacing:0,
    textTransform:"none",background:"transparent",borderRadius:0,padding:0,stroke:"transparent",strokeWidth:0,...opts};
}
export function imageLayer(name:string,source:BuilderImageSource,x:number,y:number,width:number,height:number,opts:Partial<BuilderImageLayer>={}):BuilderImageLayer{
  return{id:makeId(),name,type:"image",x,y,width,height,rotation:0,opacity:1,locked:false,hidden:false,z:5,src:"",source,fit:"cover",borderRadius:0,borderColor:"transparent",borderWidth:0,positionX:50,positionY:50,...opts};
}
export function shapeLayer(name:string,shape:BuilderShape,x:number,y:number,width:number,height:number,opts:Partial<BuilderShapeLayer>={}):BuilderShapeLayer{
  return{id:makeId(),name,type:"shape",x,y,width,height,rotation:0,opacity:1,locked:false,hidden:false,z:1,shape,fill:"#ef4a5d",stroke:"transparent",strokeWidth:0,borderRadius:0,...opts};
}

export type BuilderStarter={name:string;contentType:string;format:BuilderFormatKey;caption:string;description:string;config:BuilderConfig};
function starter(name:string,contentType:string,format:BuilderFormatKey,caption:string,description:string,layers:BuilderLayer[],canvas:Partial<BuilderCanvas>={}):BuilderStarter{
  const base=blankBuilderConfig(format);
  return{name,contentType,format,caption,description,config:{...base,canvas:{...base.canvas,...canvas},layers}};
}

/*
 * Starter collection is intentionally varied: each design has a clearly different
 * hierarchy, image treatment and composition so Social Studio feels like a useful
 * template library instead of six colour variants of the same card.
 */
export const BUILDER_STARTERS:BuilderStarter[]=[
  starter("Showtime Card","program","4:5","Vanavond {program} met {presenter} • {time} • {station}","Grote DJ-foto met compacte showkaart en duidelijk tijdstip",[
    imageLayer("DJ / programmafoto","post-image",0,0,1080,820,{z:1}),
    shapeLayer("Donkere basis","rect",0,760,1080,590,{fill:"#11132f",z:2}),
    shapeLayer("Accent balk","rect",72,812,150,18,{fill:"#ff516f",borderRadius:9,z:4}),
    textLayer("Programma","{program}",72,865,930,160,{fontSize:96,fontWeight:900,z:5}),
    textLayer("Presentator","MET {presenter}",72,1045,790,66,{fontSize:35,fontWeight:700,color:"#c8c9f6",z:5}),
    textLayer("Tijd","{time}",72,1170,260,86,{fontSize:48,fontWeight:900,color:"#ff7188",z:5}),
    textLayer("Station","{station}",690,1190,310,55,{fontSize:28,fontWeight:800,align:"right",z:5})
  ],{background:"#11132f",background2:"#3626b8"}),

  starter("Fresh Drop","music","4:5","Nieuw op {station}: {artist} — {title}. {cta}","Editorial releaseposter met groot artwork en rustige typografie",[
    shapeLayer("Linker accent","rect",0,0,28,1350,{fill:"#ff4f77",z:1}),
    textLayer("Label","FRESH DROP",72,82,520,70,{fontSize:30,fontWeight:900,color:"#ff7892",letterSpacing:4,z:5}),
    imageLayer("Artwork","post-image",72,205,936,720,{borderRadius:34,z:3}),
    textLayer("Titel","{title}",72,975,900,145,{fontSize:76,fontWeight:900,z:5}),
    textLayer("Artiest","{artist}",72,1130,770,65,{fontSize:38,fontWeight:600,color:"#d5d6ff",z:5}),
    textLayer("CTA","{cta}",72,1240,430,48,{fontSize:25,fontWeight:800,color:"#ff7892",z:5}),
    textLayer("Station","{station}",670,1240,330,48,{fontSize:25,fontWeight:800,align:"right",z:5})
  ],{background:"#13152d",background2:"#3c28aa"}),

  starter("Super 50 Spotlight","chart","4:5","#{chart_position}: {artist} — {title}. Vorige week #{previous_position}.","Hitlijstkaart met krachtige positie en artwork zonder overvolle look",[
    shapeLayer("Topvlak","rect",0,0,1080,500,{fill:"#242099",z:1}),
    textLayer("Hitlijst","SUPER 50",72,72,460,65,{fontSize:30,fontWeight:900,letterSpacing:3,z:5}),
    textLayer("Positie","#{chart_position}",65,145,430,250,{fontSize:178,fontWeight:900,z:5}),
    imageLayer("Artwork","post-image",575,80,430,430,{borderRadius:34,z:4}),
    textLayer("Titel","{title}",72,590,920,180,{fontSize:84,fontWeight:900,color:"#17182e",z:5}),
    textLayer("Artiest","{artist}",72,800,880,72,{fontSize:41,fontWeight:700,color:"#575b7f",z:5}),
    shapeLayer("Trendkaart","rect",72,980,936,185,{fill:"#f1f0ff",borderRadius:34,z:2}),
    textLayer("Trend label","VORIGE WEEK",108,1020,350,45,{fontSize:24,fontWeight:800,color:"#7773ad",z:5}),
    textLayer("Vorige positie","#{previous_position}",108,1060,330,75,{fontSize:54,fontWeight:900,color:"#3028b8",z:5}),
    textLayer("Station","{station}",610,1055,350,60,{fontSize:29,fontWeight:900,color:"#3028b8",align:"right",z:5})
  ],{gradient:false,background:"#ffffff",background2:"#ffffff"}),

  starter("Tonight Story","program","9:16","Vanavond {program} met {presenter}, om {time} op {station}.","Story met full-bleed foto en duidelijke informatie onderaan",[
    imageLayer("DJ / showfoto","post-image",0,0,1080,1250,{z:1}),
    shapeLayer("Onderkaart","rect",0,1160,1080,760,{fill:"#13142f",z:2}),
    textLayer("Vanavond","VANAVOND • {time}",72,1230,880,70,{fontSize:34,fontWeight:900,color:"#ff7188",letterSpacing:2,z:5}),
    textLayer("Programma","{program}",72,1355,920,230,{fontSize:105,fontWeight:900,z:5}),
    textLayer("Presentator","MET {presenter}",72,1625,850,82,{fontSize:43,fontWeight:700,color:"#c8c9f6",z:5}),
    textLayer("Station","{station}",72,1790,760,58,{fontSize:32,fontWeight:900,z:5})
  ],{background:"#13142f",background2:"#4b2ac2"}),

  starter("DJ Takeover","presenter","9:16","{presenter} neemt {station} over • {program} • {time}","Magazine-achtige DJ-poster met verticale titel",[
    imageLayer("DJ-foto","post-image",150,120,780,1160,{borderRadius:38,z:2}),
    shapeLayer("Accentblok","rect",80,980,920,740,{fill:"#2d27b8",borderRadius:44,z:3}),
    textLayer("Takeover","TAKEOVER",125,1030,780,66,{fontSize:34,fontWeight:900,color:"#ff8aa0",letterSpacing:5,z:5}),
    textLayer("Naam","{presenter}",125,1140,800,245,{fontSize:112,fontWeight:900,z:5}),
    textLayer("Programma","{program}",125,1435,760,82,{fontSize:44,fontWeight:700,color:"#d5d4ff",z:5}),
    textLayer("Tijd & station","{time} • {station}",125,1585,760,65,{fontSize:33,fontWeight:900,z:5})
  ],{background:"#101127",background2:"#3926a7"}),

  starter("Event Poster","event","4:5","{title} • {date}. {cta}","Heldere eventposter met foto bovenaan en compacte CTA",[
    imageLayer("Eventbeeld","post-image",0,0,1080,690,{z:1}),
    shapeLayer("Witte kaart","rect",48,625,984,670,{fill:"#ffffff",borderRadius:42,z:3}),
    textLayer("Datum","{date}",90,690,620,55,{fontSize:29,fontWeight:900,color:"#ff4f68",z:5}),
    textLayer("Event","{title}",90,800,830,225,{fontSize:80,fontWeight:900,color:"#17182e",z:5}),
    textLayer("CTA","{cta}",90,1085,680,60,{fontSize:33,fontWeight:800,color:"#3930b7",z:5}),
    textLayer("Station","{station}",90,1195,660,50,{fontSize:26,fontWeight:900,color:"#17182e",z:5})
  ],{background:"#2f29ad",background2:"#7657ff"}),

  starter("Quote Minimal","quote","1:1","{presenter}: “{title}” — {program} op {station}","Rustige quote voor redactie, presentator of campagne",[
    shapeLayer("Accent","rect",80,82,96,14,{fill:"#ff4f77",borderRadius:7,z:2}),
    textLayer("Quote","“{title}”",80,220,920,430,{fontSize:74,fontWeight:800,color:"#17182e",lineHeight:1.08,z:5}),
    textLayer("Presentator","{presenter}",80,740,760,62,{fontSize:37,fontWeight:900,color:"#332bb1",z:5}),
    textLayer("Programma","{program} • {station}",80,825,790,50,{fontSize:26,fontWeight:700,color:"#777b93",z:5}),
    shapeLayer("Footer","rect",80,960,920,2,{fill:"#e2e3ec",z:2})
  ],{gradient:false,background:"#ffffff",background2:"#ffffff"}),

  starter("Announcement","custom","1:1","{title} • {station}. {cta}","Krachtige mededeling zonder foto; ideaal voor korte updates",[
    shapeLayer("Accent cirkel","ellipse",770,-80,390,390,{fill:"#ff526f",opacity:.95,z:1}),
    textLayer("Label","UPDATE",80,90,360,60,{fontSize:29,fontWeight:900,color:"#ff7188",letterSpacing:4,z:5}),
    textLayer("Titel","{title}",80,285,880,360,{fontSize:96,fontWeight:900,lineHeight:1.02,z:5}),
    textLayer("CTA","{cta}",80,760,640,70,{fontSize:35,fontWeight:700,color:"#cacbff",z:5}),
    textLayer("Station","{station}",80,910,600,55,{fontSize:28,fontWeight:900,z:5})
  ],{background:"#151632",background2:"#3528ae"})
];

export function starterTemplate(stationSlug:string,preset:BuilderStarter):SocialTemplate{
  return{id:`new-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,station_slug:stationSlug,name:preset.name,
    content_type:preset.contentType,aspect_ratio:preset.format,caption_template:preset.caption,config:structuredClone(preset.config) as unknown as Record<string,unknown>,active:true};
}

export function blankTemplate(stationSlug:string,brand:BrandKit,format:BuilderFormatKey="4:5"):SocialTemplate{
  const config=blankBuilderConfig(format,brand);
  config.layers=[
    textLayer("Titel","{title}",84,140,910,175,{fontSize:86,fontWeight:900,z:5}),
    textLayer("Subtitel","{artist}",84,340,820,74,{fontSize:40,fontWeight:650,color:"#d7d8ff",z:5}),
    imageLayer("Invulbare foto","post-image",84,500,912,700,{borderRadius:34,z:3})
  ];
  return{id:`new-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,station_slug:stationSlug,name:"Nieuw social template",
    content_type:"custom",aspect_ratio:format,caption_template:"{title} • {station}",config:config as unknown as Record<string,unknown>,active:true};
}

export function cloneConfig(config:BuilderConfig):BuilderConfig{return structuredClone(config)}

function layerImageSource(layer:BuilderImageLayer,ctx:BuilderContext,brand:BrandKit){
  if(layer.source==="post-image")return ctx.artworkImage||layer.src;
  if(layer.source==="brand-logo")return brand.logo_url||layer.src;
  return layer.src;
}

function drawWrappedText(g:CanvasRenderingContext2D,text:string,x:number,y:number,width:number,lineHeight:number,maxHeight:number){
  const words=text.split(/\s+/).filter(Boolean);let line="";let yy=y;const bottom=y+maxHeight;
  for(const word of words){const test=line?`${line} ${word}`:word;if(g.measureText(test).width>width&&line){g.fillText(line,x,yy);yy+=lineHeight;line=word;if(yy+lineHeight>bottom)break}else line=test}if(line&&yy<=bottom)g.fillText(line,x,yy);
}
async function imageFrom(src:string){return new Promise<HTMLImageElement>((resolve,reject)=>{const im=new Image();if(/^https?:/i.test(src))im.crossOrigin="anonymous";im.onload=()=>resolve(im);im.onerror=reject;im.src=src})}

export async function renderBuilderCanvas(config:BuilderConfig,ctx:BuilderContext,brand:BrandKit,target?:{width:number;height:number}){
  const sourceW=config.canvas.width||1080,sourceH=config.canvas.height||1350;const width=target?.width||sourceW,height=target?.height||sourceH;
  const sx=width/sourceW,sy=height/sourceH;const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;const g=canvas.getContext("2d");if(!g)return canvas;
  if(config.canvas.backgroundImage){try{const im=await imageFrom(config.canvas.backgroundImage);const r=Math.max(width/im.width,height/im.height);g.drawImage(im,(width-im.width*r)/2,(height-im.height*r)/2,im.width*r,im.height*r)}catch{g.fillStyle=config.canvas.background;g.fillRect(0,0,width,height)}}else if(config.canvas.gradient){const angle=((config.canvas.gradientAngle??145)-90)*Math.PI/180;const cx=width/2,cy=height/2,len=Math.abs(width*Math.cos(angle))+Math.abs(height*Math.sin(angle));const dx=Math.cos(angle)*len/2,dy=Math.sin(angle)*len/2;const grad=g.createLinearGradient(cx-dx,cy-dy,cx+dx,cy+dy);grad.addColorStop(0,config.canvas.background);grad.addColorStop(1,config.canvas.background2);g.fillStyle=grad;g.fillRect(0,0,width,height)}else{g.fillStyle=config.canvas.background;g.fillRect(0,0,width,height)}
  for(const layer of [...config.layers].filter(x=>!x.hidden).sort((a,b)=>a.z-b.z)){
    g.save();g.globalAlpha=Math.max(0,Math.min(1,layer.opacity));const x=layer.x*sx,y=layer.y*sy,w=layer.width*sx,h=layer.height*sy;g.translate(x+w/2,y+h/2);g.rotate(layer.rotation*Math.PI/180);g.translate(-(x+w/2),-(y+h/2));
    if(layer.type==="shape"){
      g.fillStyle=layer.fill;g.strokeStyle=layer.stroke;g.lineWidth=layer.strokeWidth*Math.min(sx,sy);
      if(layer.shape==="ellipse"){g.beginPath();g.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);if(layer.fill!=="transparent")g.fill();if(layer.strokeWidth)g.stroke()}
      else if(layer.shape==="line"){g.beginPath();g.moveTo(x,y+h/2);g.lineTo(x+w,y+h/2);g.stroke()}
      else{g.beginPath();g.roundRect(x,y,w,h,layer.borderRadius*Math.min(sx,sy));if(layer.fill!=="transparent")g.fill();if(layer.strokeWidth)g.stroke()}
    }else if(layer.type==="image"){
      const src=layerImageSource(layer,ctx,brand);if(src){try{const im=await imageFrom(src);g.save();g.beginPath();g.roundRect(x,y,w,h,layer.borderRadius*Math.min(sx,sy));g.clip();const ir=layer.fit==="contain"?Math.min(w/im.width,h/im.height):Math.max(w/im.width,h/im.height);const dw=im.width*ir,dh=im.height*ir;const px=Math.max(0,Math.min(100,layer.positionX??50))/100,py=Math.max(0,Math.min(100,layer.positionY??50))/100;g.drawImage(im,x+(w-dw)*px,y+(h-dh)*py,dw,dh);g.restore();if(layer.borderWidth){g.strokeStyle=layer.borderColor;g.lineWidth=layer.borderWidth*Math.min(sx,sy);g.strokeRect(x,y,w,h)}}catch{}}
    }else{
      const size=layer.fontSize*Math.min(sx,sy),pad=layer.padding*Math.min(sx,sy),tx=layer.align==="left"?x+pad:layer.align==="center"?x+w/2:x+w-pad;let text=replaceBuilderVars(layer.text,ctx);if(layer.textTransform==="uppercase")text=text.toUpperCase();
      if(layer.background!=="transparent"){g.fillStyle=layer.background;g.beginPath();g.roundRect(x,y,w,h,layer.borderRadius*Math.min(sx,sy));g.fill()}
      g.font=`${layer.fontWeight} ${size}px ${layer.fontFamily||brand.font_family}, Arial`;g.textAlign=layer.align;g.textBaseline="top";g.fillStyle=layer.color;
      if(layer.strokeWidth>0&&layer.stroke!=="transparent"){g.strokeStyle=layer.stroke;g.lineWidth=layer.strokeWidth*Math.min(sx,sy);g.strokeText(text,tx,y+pad,w-pad*2)}
      drawWrappedText(g,text,tx,y+pad,w-pad*2,size*layer.lineHeight,h-pad*2);
    }g.restore();
  }
  return canvas;
}

export function variablesUsed(config:BuilderConfig){
  const text=config.layers.filter((x):x is BuilderTextLayer=>x.type==="text").map(x=>x.text).join(" ");
  return BUILDER_VARIABLES.filter(v=>text.includes(v));
}
