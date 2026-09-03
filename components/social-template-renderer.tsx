"use client";

import type { CSSProperties } from "react";
import type { BrandKit } from "@/lib/supabase/social";
import { replaceBuilderVars,type BuilderConfig,type BuilderContext,type BuilderLayer } from "@/lib/social-template-builder";

function imageSource(layer:Extract<BuilderLayer,{type:"image"}>,ctx:BuilderContext,brand:BrandKit){
  if(layer.source==="post-image")return ctx.artworkImage||layer.src;
  if(layer.source==="brand-logo")return brand.logo_url||layer.src;
  return layer.src;
}

export default function SocialTemplateRenderer({config,ctx,brand,className=""}:{config:BuilderConfig;ctx:BuilderContext;brand:BrandKit;className?:string}){
  const w=config.canvas.width,h=config.canvas.height;
  const bg=config.canvas.backgroundImage?`url(${config.canvas.backgroundImage}) center/cover no-repeat`:config.canvas.gradient?`linear-gradient(145deg,${config.canvas.background},${config.canvas.background2})`:config.canvas.background;
  return <div className={`social-builder-render ${className}`} style={{aspectRatio:`${w}/${h}`,background:bg}}>
    {config.layers.filter(x=>!x.hidden).sort((a,b)=>a.z-b.z).map(layer=>{
      const common:CSSProperties={position:"absolute",left:`${layer.x/w*100}%`,top:`${layer.y/h*100}%`,width:`${layer.width/w*100}%`,height:`${layer.height/h*100}%`,opacity:layer.opacity,transform:`rotate(${layer.rotation}deg)`,zIndex:layer.z};
      if(layer.type==="shape")return <div key={layer.id} style={{...common,background:layer.shape==="line"?"transparent":layer.fill,border:layer.shape==="line"?"none":`${layer.strokeWidth}px solid ${layer.stroke}`,borderRadius:layer.shape==="ellipse"?"50%":`${layer.borderRadius}px`}}>{layer.shape==="line"&&<span style={{position:"absolute",left:0,right:0,top:"50%",borderTop:`${Math.max(1,layer.strokeWidth)}px solid ${layer.stroke}`}}/>}</div>;
      if(layer.type==="image"){const src=imageSource(layer,ctx,brand);return <div key={layer.id} style={{...common,borderRadius:`${layer.borderRadius}px`,overflow:"hidden",border:`${layer.borderWidth}px solid ${layer.borderColor}`}}>{src?<img src={src} alt="" style={{width:"100%",height:"100%",objectFit:layer.fit,display:"block"}}/>:<span className="social-builder-placeholder">FOTO</span>}</div>}
      const text=layer.textTransform==="uppercase"?replaceBuilderVars(layer.text,ctx).toUpperCase():replaceBuilderVars(layer.text,ctx);
      return <div key={layer.id} style={{...common,display:"flex",alignItems:"flex-start",justifyContent:layer.align==="center"?"center":layer.align==="right"?"flex-end":"flex-start",fontFamily:layer.fontFamily,fontWeight:layer.fontWeight,fontSize:`${layer.fontSize/w*100}cqw`,lineHeight:layer.lineHeight,letterSpacing:`${layer.letterSpacing/w*100}cqw`,color:layer.color,textAlign:layer.align,background:layer.background,borderRadius:`${layer.borderRadius}px`,padding:`${layer.padding/w*100}cqw`,WebkitTextStroke:layer.strokeWidth?`${layer.strokeWidth/w*100}cqw ${layer.stroke}`:undefined,boxSizing:"border-box",whiteSpace:"pre-wrap",overflow:"hidden"}}>{text}</div>
    })}
  </div>
}
