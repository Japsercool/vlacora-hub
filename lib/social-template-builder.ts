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
  borderColor:string;borderWidth:number;
};
export type BuilderShapeLayer=BuilderLayerBase&{
  type:"shape";shape:BuilderShape;fill:string;stroke:string;strokeWidth:number;borderRadius:number;
};
export type BuilderLayer=BuilderTextLayer|BuilderImageLayer|BuilderShapeLayer;
export type BuilderCanvas={
  width:number;height:number;background:string;background2:string;backgroundImage:string;
  gradient:boolean;grid:boolean;snap:boolean;
};
export type BuilderConfig={builderVersion:2;canvas:BuilderCanvas;layers:BuilderLayer[]};

const makeId=()=>`layer-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
const formats:Record<BuilderFormatKey,{width:number;height:number}>={
  "1:1":{width:1080,height:1080},"4:5":{width:1080,height:1350},"9:16":{width:1080,height:1920},"16:9":{width:1600,height:900}
};
export const BUILDER_FORMATS=formats;

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
  return{builderVersion:2,canvas:{width:f.width,height:f.height,background:brand?.primary_color||"#2924a8",background2:brand?.secondary_color||"#6b4cff",backgroundImage:"",gradient:true,grid:true,snap:true},layers:[]};
}

export function textLayer(name:string,text:string,x:number,y:number,width:number,height:number,opts:Partial<BuilderTextLayer>={}):BuilderTextLayer{
  return{id:makeId(),name,type:"text",x,y,width,height,rotation:0,opacity:1,locked:false,hidden:false,z:10,
    text,fontSize:72,fontWeight:800,fontFamily:"Space Grotesk",color:"#ffffff",align:"left",lineHeight:1.05,letterSpacing:0,
    textTransform:"none",background:"transparent",borderRadius:0,padding:0,stroke:"transparent",strokeWidth:0,...opts};
}
export function imageLayer(name:string,source:BuilderImageSource,x:number,y:number,width:number,height:number,opts:Partial<BuilderImageLayer>={}):BuilderImageLayer{
  return{id:makeId(),name,type:"image",x,y,width,height,rotation:0,opacity:1,locked:false,hidden:false,z:5,src:"",source,fit:"cover",borderRadius:0,borderColor:"transparent",borderWidth:0,...opts};
}
export function shapeLayer(name:string,shape:BuilderShape,x:number,y:number,width:number,height:number,opts:Partial<BuilderShapeLayer>={}):BuilderShapeLayer{
  return{id:makeId(),name,type:"shape",x,y,width,height,rotation:0,opacity:1,locked:false,hidden:false,z:1,shape,fill:"#ef4a5d",stroke:"transparent",strokeWidth:0,borderRadius:0,...opts};
}

export type BuilderStarter={name:string;contentType:string;format:BuilderFormatKey;caption:string;description:string;config:BuilderConfig};
function starter(name:string,contentType:string,format:BuilderFormatKey,caption:string,description:string,layers:BuilderLayer[],canvas:Partial<BuilderCanvas>={}):BuilderStarter{
  return{name,contentType,format,caption,description,config:{...blankBuilderConfig(format),canvas:{...blankBuilderConfig(format).canvas,...canvas},layers}};
}

export const BUILDER_STARTERS:BuilderStarter[]=[
  starter("Neon Release","music","4:5","Nieuw op {station}: {artist} — {title}. {cta}","Asymmetrische releasekaart met groot artwork en neon typografie",[
    shapeLayer("Accent strip","rect",0,0,26,1350,{fill:"#ff4c75",z:1}),
    shapeLayer("Glass panel","rect",72,760,936,500,{fill:"rgba(12,14,38,.76)",borderRadius:54,z:3}),
    imageLayer("Artwork","post-image",480,120,520,630,{borderRadius:56,z:4}),
    textLayer("Eyebrow","NEW MUSIC",82,105,380,80,{fontSize:32,fontWeight:800,color:"#ff6689",letterSpacing:2,z:10}),
    textLayer("Title","{title}",82,790,850,170,{fontSize:92,fontWeight:900,z:11}),
    textLayer("Artist","{artist}",82,980,820,95,{fontSize:48,fontWeight:600,color:"#d8d9ff",z:11}),
    textLayer("Station","{station}",82,1170,450,70,{fontSize:32,fontWeight:800,color:"#ffffff",z:11})
  ],{background:"#11122d",background2:"#3c21ba"}),
  starter("Chart Shock","chart","4:5","#{chart_position} in de hitlijst: {artist} — {title}. Vorige week #{previous_position}.","Grote positie, compacte songkaart en duidelijke trend",[
    shapeLayer("Top block","rect",0,0,1080,520,{fill:"#15163c",z:1}),
    shapeLayer("Position bubble","ellipse",72,115,350,350,{fill:"#ff4c75",z:2}),
    textLayer("Position","#{chart_position}",112,177,270,210,{fontSize:150,fontWeight:900,align:"center",z:9}),
    textLayer("Chart label","HITLIJST",500,120,470,75,{fontSize:35,fontWeight:800,color:"#9c91ff",align:"right",z:9}),
    imageLayer("Artwork","post-image",570,260,430,430,{borderRadius:40,z:4}),
    textLayer("Title","{title}",75,735,930,190,{fontSize:92,fontWeight:900,z:10}),
    textLayer("Artist","{artist}",75,945,900,85,{fontSize:48,fontWeight:600,color:"#c9caff",z:10}),
    textLayer("Trend","VORIGE WEEK  #{previous_position}",75,1100,760,80,{fontSize:34,fontWeight:800,color:"#ff6689",z:10}),
    textLayer("Station","{station}",75,1230,700,55,{fontSize:28,fontWeight:700,z:10})
  ],{background:"#5c31ff",background2:"#25157a"}),
  starter("Takeover Frame","presenter","16:9","{presenter} neemt {station} over • {program} • {time}.","Breed takeover-template met DJ-foto als hoofdbeeld",[
    imageLayer("DJ photo","post-image",790,0,810,900,{z:1}),
    shapeLayer("Dark panel","rect",0,0,900,900,{fill:"rgba(19,21,56,.95)",z:2}),
    shapeLayer("Red pill","rect",110,210,360,62,{fill:"#ef4a5d",borderRadius:31,z:4}),
    textLayer("Takeover","TAKEOVER",128,220,325,50,{fontSize:26,fontWeight:900,align:"center",z:5}),
    textLayer("Presenter","{presenter}",105,330,720,180,{fontSize:96,fontWeight:900,z:5}),
    textLayer("Program","{program}",105,535,700,90,{fontSize:44,fontWeight:600,color:"#bcb8ff",z:5}),
    textLayer("Time","{time}  •  {station}",105,690,650,65,{fontSize:32,fontWeight:800,color:"#ffffff",z:5})
  ],{background:"#191b48",background2:"#3d23c8"}),
  starter("Story Radar","program","9:16","Vanavond: {program} met {presenter}, om {time} op {station}.","Verticale story met sterk tijdstip en presenterbeeld",[
    imageLayer("Presenter image","post-image",0,0,1080,1120,{z:1}),
    shapeLayer("Bottom gradient card","rect",0,1010,1080,910,{fill:"rgba(18,19,47,.96)",z:2}),
    textLayer("When","VANAVOND  •  {time}",80,1100,900,80,{fontSize:34,fontWeight:900,color:"#ff6689",z:4}),
    textLayer("Program","{program}",80,1230,900,230,{fontSize:105,fontWeight:900,z:4}),
    textLayer("Presenter","MET {presenter}",80,1500,900,90,{fontSize:42,fontWeight:700,color:"#c9caff",z:4}),
    textLayer("Station","{station}",80,1740,700,70,{fontSize:36,fontWeight:900,z:4})
  ],{background:"#16183b",background2:"#5929dc"}),
  starter("Editorial Quote","quote","1:1","{presenter}: “{title}” — {program} op {station}.","Rustige quote-card voor presentatoren en redactie",[
    shapeLayer("Accent square","rect",70,70,110,110,{fill:"#ef4a5d",borderRadius:28,z:2}),
    textLayer("Quote mark","“",92,64,70,90,{fontSize:82,fontWeight:900,align:"center",z:3}),
    textLayer("Quote","{title}",90,280,900,340,{fontSize:76,fontWeight:850,align:"left",z:4}),
    textLayer("Presenter","— {presenter}",90,690,800,80,{fontSize:39,fontWeight:700,color:"#c9caff",z:4}),
    textLayer("Program","{program}  •  {station}",90,890,850,55,{fontSize:27,fontWeight:800,color:"#ff6689",z:4})
  ],{background:"#191a42",background2:"#2d1f77"}),
  starter("Event Cutout","event","4:5","{title} • {date}. {cta}","Eventposter met foto, datum en CTA",[
    imageLayer("Event image","post-image",0,0,1080,720,{z:1}),
    shapeLayer("Content card","rect",55,650,970,630,{fill:"#ffffff",borderRadius:52,z:3}),
    textLayer("Date","{date}",100,710,780,70,{fontSize:32,fontWeight:900,color:"#ef4a5d",z:4}),
    textLayer("Event","{title}",100,820,820,220,{fontSize:82,fontWeight:900,color:"#14162f",z:4}),
    textLayer("CTA","{cta}",100,1100,720,70,{fontSize:34,fontWeight:750,color:"#3834b2",z:4}),
    textLayer("Station","{station}",100,1210,620,45,{fontSize:25,fontWeight:800,color:"#14162f",z:4})
  ],{background:"#26269f",background2:"#6b4cff"})
];

export function starterTemplate(stationSlug:string,preset:BuilderStarter):SocialTemplate{
  return{id:`new-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,station_slug:stationSlug,name:preset.name,
    content_type:preset.contentType,aspect_ratio:preset.format,caption_template:preset.caption,config:structuredClone(preset.config) as unknown as Record<string,unknown>,active:true};
}

export function blankTemplate(stationSlug:string,brand:BrandKit,format:BuilderFormatKey="4:5"):SocialTemplate{
  const config=blankBuilderConfig(format,brand);
  config.layers=[
    textLayer("Headline","{title}",90,260,900,200,{fontSize:96,fontWeight:900,z:5}),
    textLayer("Subline","{artist}",90,500,850,90,{fontSize:45,fontWeight:600,color:"#d7d8ff",z:5}),
    imageLayer("Post image","post-image",90,690,900,520,{borderRadius:42,z:3})
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
  if(config.canvas.backgroundImage){try{const im=await imageFrom(config.canvas.backgroundImage);const r=Math.max(width/im.width,height/im.height);g.drawImage(im,(width-im.width*r)/2,(height-im.height*r)/2,im.width*r,im.height*r)}catch{g.fillStyle=config.canvas.background;g.fillRect(0,0,width,height)}}else if(config.canvas.gradient){const grad=g.createLinearGradient(0,0,width,height);grad.addColorStop(0,config.canvas.background);grad.addColorStop(1,config.canvas.background2);g.fillStyle=grad;g.fillRect(0,0,width,height)}else{g.fillStyle=config.canvas.background;g.fillRect(0,0,width,height)}
  for(const layer of [...config.layers].filter(x=>!x.hidden).sort((a,b)=>a.z-b.z)){
    g.save();g.globalAlpha=Math.max(0,Math.min(1,layer.opacity));const x=layer.x*sx,y=layer.y*sy,w=layer.width*sx,h=layer.height*sy;g.translate(x+w/2,y+h/2);g.rotate(layer.rotation*Math.PI/180);g.translate(-(x+w/2),-(y+h/2));
    if(layer.type==="shape"){
      g.fillStyle=layer.fill;g.strokeStyle=layer.stroke;g.lineWidth=layer.strokeWidth*Math.min(sx,sy);
      if(layer.shape==="ellipse"){g.beginPath();g.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);if(layer.fill!=="transparent")g.fill();if(layer.strokeWidth)g.stroke()}
      else if(layer.shape==="line"){g.beginPath();g.moveTo(x,y+h/2);g.lineTo(x+w,y+h/2);g.stroke()}
      else{g.beginPath();g.roundRect(x,y,w,h,layer.borderRadius*Math.min(sx,sy));if(layer.fill!=="transparent")g.fill();if(layer.strokeWidth)g.stroke()}
    }else if(layer.type==="image"){
      const src=layerImageSource(layer,ctx,brand);if(src){try{const im=await imageFrom(src);g.save();g.beginPath();g.roundRect(x,y,w,h,layer.borderRadius*Math.min(sx,sy));g.clip();const ir=layer.fit==="contain"?Math.min(w/im.width,h/im.height):Math.max(w/im.width,h/im.height);const dw=im.width*ir,dh=im.height*ir;g.drawImage(im,x+(w-dw)/2,y+(h-dh)/2,dw,dh);g.restore();if(layer.borderWidth){g.strokeStyle=layer.borderColor;g.lineWidth=layer.borderWidth*Math.min(sx,sy);g.strokeRect(x,y,w,h)}}catch{}}
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
