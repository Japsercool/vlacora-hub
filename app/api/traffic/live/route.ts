import { NextRequest,NextResponse } from "next/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const FEED_URL="https://www.verkeerscentrum.be/uitwisseling/datex2v3full";

type TrafficIncident={
  id:string;
  type:string;
  typeLabel:string;
  severity:"high"|"medium"|"low";
  road:string;
  direction:string;
  location:string;
  summary:string;
  validUntil:string;
  updatedAt:string;
};

function decodeXml(value:string){
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1")
    .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#39;/g,"'")
    .replace(/&#x([0-9a-f]+);/gi,(_,hex)=>String.fromCodePoint(parseInt(hex,16)))
    .replace(/&#(\d+);/g,(_,num)=>String.fromCodePoint(Number(num)));
}
function stripTags(value:string){return decodeXml(value.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim())}
function firstTag(block:string,names:string[]){
  for(const name of names){
    const re=new RegExp(`<(?:(?:\\w+):)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${name}>`,`i`);
    const m=block.match(re);if(m)return stripTags(m[1]);
  }
  return"";
}
function values(block:string){
  const out:string[]=[];
  const re=/<(?:(?:\w+):)?value\b([^>]*)>([\s\S]*?)<\/(?:(?:\w+):)?value>/gi;
  let m:RegExpExecArray|null;
  while((m=re.exec(block))){
    const attrs=m[1]||"",text=stripTags(m[2]);
    if(!text)continue;
    const lang=attrs.match(/\blang=["']([^"']+)/i)?.[1]?.toLowerCase()||"";
    out.push(`${lang}|${text}`);
  }
  return out;
}
function bestComment(block:string){
  const commentBlock=block.match(/<(?:(?:\w+):)?(?:generalPublicComment|nonGeneralPublicComment)\b[^>]*>([\s\S]*?)<\/(?:(?:\w+):)?(?:generalPublicComment|nonGeneralPublicComment)>/i)?.[1]||block;
  const vals=values(commentBlock);
  const preferred=vals.find(x=>x.startsWith("nl|"))||vals.find(x=>x.startsWith("en|"))||vals[0];
  return preferred?preferred.slice(preferred.indexOf("|")+1):"";
}
function recordType(openTag:string){return openTag.match(/(?:xsi:)?type=["'](?:\w+:)?([^"']+)["']/i)?.[1]||"TrafficSituation"}
function typeInfo(type:string){
  const lower=type.toLowerCase();
  if(lower.includes("accident"))return{label:"Ongeval",severity:"high" as const,kind:"incident"};
  if(lower.includes("vehicleobstruction"))return{label:"Defect voertuig / obstakel",severity:"high" as const,kind:"incident"};
  if(lower.includes("infrastructuredamage")||lower.includes("obstruction"))return{label:"Hinder / obstakel",severity:"high" as const,kind:"incident"};
  if(lower.includes("abnormaltraffic")||lower.includes("trafficcongestion"))return{label:"File / vertraagd verkeer",severity:"high" as const,kind:"congestion"};
  if(lower.includes("roadworks")||lower.includes("maintenance"))return{label:"Wegenwerken",severity:"medium" as const,kind:"roadworks"};
  if(lower.includes("weather"))return{label:"Weerhinder",severity:"medium" as const,kind:"incident"};
  if(lower.includes("publicevent")||lower.includes("specialevent"))return{label:"Evenement",severity:"medium" as const,kind:"incident"};
  return{label:"Verkeershinder",severity:"low" as const,kind:"incident"};
}
function roadFrom(block:string,comment:string){
  const explicit=firstTag(block,["roadName","roadNumber","roadIdentifier"]);
  const hay=`${explicit} ${comment} ${stripTags(block)}`;
  const match=hay.match(/\b(?:A|E|R|N)\s?-?\d{1,3}\b/i)?.[0]||"";
  return match.toUpperCase().replace(/[\s-]+/g,"");
}
function cleanLocation(block:string,comment:string){
  const direct=firstTag(block,["locationDescriptor","locationName"]);
  if(direct&&direct.length<160)return direct;
  return comment.match(/(?:ter hoogte van|tussen|aan|bij)\s+([^,.]{2,80})/i)?.[1]?.trim()||"";
}
function directionFrom(block:string,comment:string){
  const fromComment=comment.match(/richting\s+([^,.;]{2,60})/i)?.[1]?.trim();
  if(fromComment)return fromComment;
  const raw=firstTag(block,["directionAtPoint","directionRelativeAtLinearSection","alertCDirection"]);
  if(/both/i.test(raw))return"beide richtingen";
  if(/positive/i.test(raw))return"positieve rijrichting";
  if(/negative/i.test(raw))return"negatieve rijrichting";
  return raw;
}
function compactSummary(comment:string,label:string,road:string,location:string,direction:string){
  let text=comment.replace(/\s+/g," ").trim();
  if(text.length>260)text=text.slice(0,257).replace(/\s+\S*$/,"")+"…";
  if(text)return text.replace(/[.\s]+$/,".");
  const bits=[road||"Op de weg",direction?`richting ${direction}`:"",location?`ter hoogte van ${location}`:""].filter(Boolean).join(" ");
  return `${bits}: ${label.toLowerCase()}.`;
}
function parseDatex(xml:string){
  const publicationTime=firstTag(xml,["publicationTime","publicationCreationTime"])||new Date().toISOString();
  const incidents:TrafficIncident[]=[];
  const re=/<(?:(?:\w+):)?situationRecord\b([^>]*)>([\s\S]*?)<\/(?:(?:\w+):)?situationRecord>/gi;
  let m:RegExpExecArray|null,index=0;
  while((m=re.exec(xml))){
    const attrs=m[1]||"",block=m[2]||"";
    const validity=firstTag(block,["validityStatus"]);
    if(/suspended/i.test(validity))continue;
    const type=recordType(attrs),info=typeInfo(type),comment=bestComment(block),road=roadFrom(block,comment);
    const location=cleanLocation(block,comment),direction=directionFrom(block,comment);
    const id=attrs.match(/\bid=["']([^"']+)/i)?.[1]||`traffic-${index++}`;
    incidents.push({
      id,type,typeLabel:info.label,severity:info.severity,road,direction,location,
      summary:compactSummary(comment,info.label,road,location,direction),
      validUntil:firstTag(block,["overallEndTime","endTime"]),
      updatedAt:firstTag(block,["situationRecordVersionTime","overallStartTime","situationRecordCreationTime"])||publicationTime
    });
  }
  return{publicationTime,incidents};
}
function incidentKind(type:string){return typeInfo(type).kind}
function score(i:TrafficIncident,roads:string[]){
  let s=i.severity==="high"?100:i.severity==="medium"?60:30;
  const ri=roads.indexOf(i.road);if(ri>=0)s+=50-ri*4;
  if(incidentKind(i.type)==="congestion")s+=15;
  if(i.summary.length>30)s+=5;
  return s;
}
function makeRadioText(items:TrafficIncident[]){
  if(!items.length)return"Op de belangrijkste Vlaamse wegen zijn momenteel geen grote verkeersproblemen gemeld door het Vlaams Verkeerscentrum.";
  return items.slice(0,4).map((item,idx)=>{
    let text=item.summary.trim();
    if(item.road&&!new RegExp(`\\b${item.road}\\b`,`i`).test(text))text=`${item.road}: ${text}`;
    if(!/[.!?]$/.test(text))text+=".";
    return idx===0?text:text.charAt(0).toUpperCase()+text.slice(1);
  }).join(" ");
}

export async function GET(req:NextRequest){
  const params=req.nextUrl.searchParams;
  const roads=(params.get("roads")||"").split(",").map(x=>x.trim().toUpperCase().replace(/[\s-]+/g,"")).filter(Boolean).slice(0,20);
  const all=params.get("all")==="1";
  const includeRoadworks=params.get("roadworks")!=="0";
  const includeIncidents=params.get("incidents")!=="0";
  const includeCongestion=params.get("congestion")!=="0";
  const limit=Math.min(50,Math.max(1,Number(params.get("limit")||20)));
  try{
    const response=await fetch(FEED_URL,{headers:{Accept:"application/xml,text/xml;q=0.9,*/*;q=0.8","User-Agent":"VLACORA-HUB/0.19.4"},next:{revalidate:60}});
    if(!response.ok)throw new Error(`Verkeerscentrum HTTP ${response.status}`);
    const parsed=parseDatex(await response.text());
    let items=parsed.incidents.filter(i=>{
      const kind=incidentKind(i.type);
      if(kind==="roadworks"&&!includeRoadworks)return false;
      if(kind==="congestion"&&!includeCongestion)return false;
      if(kind==="incident"&&!includeIncidents)return false;
      if(all||!roads.length)return true;
      if(i.road&&roads.includes(i.road))return true;
      const hay=`${i.summary} ${i.location}`.toUpperCase();
      return roads.some(r=>hay.includes(r));
    });
    items=items.sort((a,b)=>score(b,roads)-score(a,roads)).slice(0,limit);
    const radioItems=items.filter(i=>i.severity!=="low").slice(0,4);
    return NextResponse.json({
      ok:true,source:"Vlaams Verkeerscentrum",feed:"DATEX II v3 full",feedUrl:FEED_URL,
      publicationTime:parsed.publicationTime,fetchedAt:new Date().toISOString(),roads,allFlanders:all,
      totalParsed:parsed.incidents.length,count:items.length,items,
      radioText:makeRadioText(radioItems.length?radioItems:items.slice(0,3))
    },{headers:{"Cache-Control":"public, s-maxage=60, stale-while-revalidate=300"}});
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Verkeersfeed kon niet geladen worden",source:"Vlaams Verkeerscentrum",feedUrl:FEED_URL,fetchedAt:new Date().toISOString()},{status:502,headers:{"Cache-Control":"no-store"}});
  }
}
