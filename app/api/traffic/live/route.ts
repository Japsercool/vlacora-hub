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
  roadKeys:string[];
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
function stripTags(value:string){
  return decodeXml(value.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim());
}
function tagBlocks(block:string,name:string){
  const out:string[]=[];
  const re=new RegExp(`<(?:(?:\\w+):)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${name}>`,"gi");
  let m:RegExpExecArray|null;
  while((m=re.exec(block)))out.push(m[1]||"");
  return out;
}
function firstTag(block:string,names:string[]){
  for(const name of names){
    for(const inner of tagBlocks(block,name)){
      const valuesInside=multiValues(inner);
      if(valuesInside.length)return valuesInside[0];
      const text=stripTags(inner);
      if(text)return text;
    }
  }
  return"";
}
function multiValues(block:string){
  const found:Array<{lang:string;text:string}>=[];
  const re=/<(?:(?:\w+):)?value\b([^>]*)>([\s\S]*?)<\/(?:(?:\w+):)?value>/gi;
  let m:RegExpExecArray|null;
  while((m=re.exec(block))){
    const text=stripTags(m[2]||"");
    if(!text)continue;
    const lang=(m[1]||"").match(/\blang=["']([^"']+)/i)?.[1]?.toLowerCase()||"";
    found.push({lang,text});
  }
  return found
    .sort((a,b)=>(a.lang==="nl"?0:a.lang==="en"?1:2)-(b.lang==="nl"?0:b.lang==="en"?1:2))
    .map(x=>x.text);
}
function allTagTexts(block:string,names:string[]){
  const out:string[]=[];
  for(const name of names){
    for(const inner of tagBlocks(block,name)){
      const valuesInside=multiValues(inner);
      if(valuesInside.length)out.push(...valuesInside);
      else{
        const text=stripTags(inner);
        if(text)out.push(text);
      }
    }
  }
  return [...new Set(out.map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean))];
}
function roadCodes(value:string){
  return [...new Set(
    (value.match(/\b(?:E|A|R|N|B)\s*[- ]?\s*\d{1,3}\b/gi)||[])
      .map(x=>x.toUpperCase().replace(/\s+/g,"").replace(/([A-Z])-(\d)/,"$1$2"))
  )];
}
function normalizeRoad(value:string){return value.toUpperCase().replace(/[\s-]+/g,"")}
function genericDirectionText(value:string){
  return /^(?:positive|negative|positieve rijrichting|negatieve rijrichting|aligned|opposite|unknown)$/i.test(value.trim());
}
function genericComment(value:string){
  const s=value.toLowerCase();
  if(!s)return true;
  if(/op de weg richting (?:positieve|negatieve|positive|negative) rijrichting/.test(s))return true;
  if(/^(?:op de weg[: ]*)?(?:file\s*\/\s*vertraagd verkeer|verkeershinder)\.?$/.test(s))return true;
  return false;
}
function commentScore(value:string){
  if(!value)return-999;
  let score=Math.min(80,value.length/3);
  if(genericComment(value))score-=220;
  if(roadCodes(value).length)score+=100;
  if(/\b(?:vanaf|tussen|ter hoogte van|oprit|afrit|parking|tunnel|knooppunt)\b/i.test(value))score+=80;
  if(/\brichting\s+[A-ZÀ-ÖØ-Ý]/i.test(value))score+=45;
  if(/\b(?:file|vertraagd verkeer|ongeval|wegenwerken|rijbaan|rijstrook)\b/i.test(value))score+=25;
  return score;
}
function bestComment(block:string){
  const candidates:string[]=[];
  for(const name of ["generalPublicComment","nonGeneralPublicComment","situationSummary","description","trafficElementDescription"]){
    for(const inner of tagBlocks(block,name)){
      const vals=multiValues(inner);
      if(vals.length)candidates.push(...vals);
      else{
        const text=stripTags(inner);
        if(text)candidates.push(text);
      }
    }
  }
  return [...new Set(candidates)]
    .sort((a,b)=>commentScore(b)-commentScore(a))[0]||"";
}
function recordType(openTag:string){
  return openTag.match(/(?:xsi:)?type=["'](?:\w+:)?([^"']+)["']/i)?.[1]||"TrafficSituation";
}
function typeInfo(type:string,block=""){
  const lower=type.toLowerCase();
  if(lower.includes("accident"))return{label:"Ongeval",severity:"high" as const,kind:"incident"};
  if(lower.includes("vehicleobstruction"))return{label:"Defect voertuig / obstakel",severity:"high" as const,kind:"incident"};
  if(lower.includes("infrastructuredamage")||lower.includes("obstruction"))return{label:"Hinder / obstakel",severity:"high" as const,kind:"incident"};
  if(lower.includes("abnormaltraffic")||lower.includes("trafficcongestion")){
    const abnormal=firstTag(block,["abnormalTrafficType","trafficFlowCharacteristics","trafficTrendType"]).toLowerCase();
    if(/stationary|queue|queuing|congested/.test(abnormal))return{label:"File",severity:"high" as const,kind:"congestion"};
    if(/slow|heavy|unspecified/.test(abnormal))return{label:"Vertraagd verkeer",severity:"high" as const,kind:"congestion"};
    return{label:"File / vertraagd verkeer",severity:"high" as const,kind:"congestion"};
  }
  if(lower.includes("roadworks")||lower.includes("maintenance"))return{label:"Wegenwerken",severity:"medium" as const,kind:"roadworks"};
  if(lower.includes("weather"))return{label:"Weerhinder",severity:"medium" as const,kind:"incident"};
  if(lower.includes("publicevent")||lower.includes("specialevent"))return{label:"Evenement",severity:"medium" as const,kind:"incident"};
  return{label:"Verkeershinder",severity:"low" as const,kind:"incident"};
}
function humanText(value:string){
  const text=value.replace(/\s+/g," ").trim();
  if(!text||text.length>140)return"";
  if(/^(?:vlaanderen|belgië|belgium|unknown|positive|negative|aligned|opposite|both)$/i.test(text))return"";
  if(/^\d+$/.test(text))return"";
  return text;
}
function locationNameFrom(block:string){
  const vals=allTagTexts(block,["alertCLocationName","locationName","locationDescriptor","descriptor","pointName","junctionName","name"])
    .map(humanText).filter(Boolean);
  return vals.sort((a,b)=>{
    const sa=(/\b(?:parking|tunnel|knooppunt|afrit|oprit|viaduct|brug|centrum|luchthaven)\b/i.test(a)?30:0)+(roadCodes(a).length?-20:0)+Math.min(a.length,40);
    const sb=(/\b(?:parking|tunnel|knooppunt|afrit|oprit|viaduct|brug|centrum|luchthaven)\b/i.test(b)?30:0)+(roadCodes(b).length?-20:0)+Math.min(b.length,40);
    return sb-sa;
  })[0]||"";
}
function routeArrowDirection(block:string){
  const texts=allTagTexts(block,["roadName","locationName","locationDescriptor","descriptor","name"]);
  for(const text of texts){
    const m=text.match(/(?:^|\s)([^,;]{2,50}?)\s*(?:->|→)\s*([^,;]{2,50})(?:$|[,;])/);
    if(m)return humanText(m[2])||"";
  }
  return"";
}
function structuredLocation(block:string){
  const secondary=[
    ...tagBlocks(block,"alertCMethod2SecondaryPointLocation"),
    ...tagBlocks(block,"alertCMethod4SecondaryPointLocation"),
    ...tagBlocks(block,"secondaryPoint"),
    ...tagBlocks(block,"fromPoint"),
    ...tagBlocks(block,"fromLocation")
  ].map(locationNameFrom).filter(Boolean);
  const primary=[
    ...tagBlocks(block,"alertCMethod2PrimaryPointLocation"),
    ...tagBlocks(block,"alertCMethod4PrimaryPointLocation"),
    ...tagBlocks(block,"primaryPoint"),
    ...tagBlocks(block,"toPoint"),
    ...tagBlocks(block,"toLocation")
  ].map(locationNameFrom).filter(Boolean);

  const from=secondary[0]||"";
  const to=primary[0]||"";
  if(from&&to&&from!==to)return{from,to,display:`vanaf ${from} tot ${to}`};
  const point=to||from||locationNameFrom(block);
  return{from:"",to:"",display:point?`ter hoogte van ${point}`:""};
}
function roadInfo(block:string,comment:string){
  const direct=allTagTexts(block,["roadName","roadNumber","roadIdentifier"]);
  const humanCandidates=[...direct,comment]
    .map(x=>x.replace(/\s+/g," ").trim())
    .filter(x=>roadCodes(x).length);
  const codes=roadCodes(`${direct.join(" ")} ${comment} ${stripTags(block)}`);
  const display=humanCandidates.sort((a,b)=>{
    const score=(x:string)=>(/[()]/.test(x)?20:0)+(/\s-\s/.test(x)?18:0)+(x.length>roadCodes(x).join(" ").length?20:0)+Math.min(x.length,60);
    return score(b)-score(a);
  })[0]||codes.join(" - ");
  return{display:display.replace(/\s+/g," ").trim(),keys:codes.map(normalizeRoad)};
}
function directionFrom(block:string,comment:string){
  const human=comment.match(/richting\s+([^,.;]{2,70})/i)?.[1]?.trim();
  if(human&&!genericDirectionText(human))return human;

  const named=firstTag(block,["alertCDirectionNamed","directionName","destinationName","towards","toward"]);
  if(named&&!genericDirectionText(named))return named;

  const arrow=routeArrowDirection(block);
  if(arrow)return arrow;

  const bound=firstTag(block,["directionBound"]).toLowerCase();
  const map:Record<string,string>={
    northbound:"noordwaarts",southbound:"zuidwaarts",eastbound:"oostwaarts",westbound:"westwaarts",
    clockwise:"met de klok mee",anticlockwise:"tegen de klok in"
  };
  return map[bound]||"";
}
function summaryFrom(block:string,comment:string,label:string,road:string,direction:string){
  if(comment&&!genericComment(comment)&&(
    roadCodes(comment).length||
    /\b(?:vanaf|tussen|ter hoogte van|oprit|afrit|parking|tunnel|knooppunt)\b/i.test(comment)
  )){
    let text=comment.replace(/\s+/g," ").trim();
    if(text.length>300)text=text.slice(0,297).replace(/\s+\S*$/,"")+"…";
    return /[.!?]$/.test(text)?text:`${text}.`;
  }

  const loc=structuredLocation(block).display;
  const roadPart=road||"";
  const where=[roadPart,loc].filter(Boolean).join(" ");
  const dir=direction?`, richting ${direction}`:"";
  if(where)return`${label} ${where}${dir}.`;

  if(comment&&!genericComment(comment)){
    const text=comment.replace(/\s+/g," ").trim();
    return /[.!?]$/.test(text)?text:`${text}.`;
  }
  return`${label} op een Vlaamse weg.`;
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

    const type=recordType(attrs),comment=bestComment(block),info=typeInfo(type,block);
    const road=roadInfo(block,comment);
    const location=structuredLocation(block).display.replace(/^(?:vanaf|ter hoogte van)\s+/i,"");
    const direction=directionFrom(block,comment);
    const id=attrs.match(/\bid=["']([^"']+)/i)?.[1]||`traffic-${index++}`;

    incidents.push({
      id,type,typeLabel:info.label,severity:info.severity,
      road:road.display,roadKeys:road.keys,direction,location,
      summary:summaryFrom(block,comment,info.label,road.display,direction),
      validUntil:firstTag(block,["overallEndTime","endTime"]),
      updatedAt:firstTag(block,["situationRecordVersionTime","overallStartTime","situationRecordCreationTime"])||publicationTime
    });
  }
  return{publicationTime,incidents};
}
function incidentKind(type:string){return typeInfo(type).kind}
function score(i:TrafficIncident,roads:string[]){
  let s=i.severity==="high"?100:i.severity==="medium"?60:30;
  const ri=roads.findIndex(r=>i.roadKeys.includes(r));
  if(ri>=0)s+=50-ri*4;
  if(incidentKind(i.type)==="congestion")s+=15;
  if(i.road)s+=15;
  if(/\b(?:vanaf|tussen|ter hoogte van|richting)\b/i.test(i.summary))s+=12;
  if(i.summary.length>30)s+=5;
  return s;
}
function makeRadioText(items:TrafficIncident[]){
  if(!items.length)return"Op de belangrijkste Vlaamse wegen zijn momenteel geen grote verkeersproblemen gemeld door het Vlaams Verkeerscentrum.";
  return items.slice(0,4).map((item,idx)=>{
    let text=item.summary.trim();
    if(!/[.!?]$/.test(text))text+=".";
    return idx===0?text:text.charAt(0).toUpperCase()+text.slice(1);
  }).join(" ");
}

export async function GET(req:NextRequest){
  const params=req.nextUrl.searchParams;
  const roads=(params.get("roads")||"").split(",").map(x=>normalizeRoad(x.trim())).filter(Boolean).slice(0,20);
  const all=params.get("all")==="1";
  const includeRoadworks=params.get("roadworks")!=="0";
  const includeIncidents=params.get("incidents")!=="0";
  const includeCongestion=params.get("congestion")!=="0";
  const limit=Math.min(50,Math.max(1,Number(params.get("limit")||20)));
  try{
    const response=await fetch(FEED_URL,{
      headers:{Accept:"application/xml,text/xml;q=0.9,*/*;q=0.8","User-Agent":"VLACORA-HUB/0.20.1"},
      next:{revalidate:60}
    });
    if(!response.ok)throw new Error(`Verkeerscentrum HTTP ${response.status}`);

    const parsed=parseDatex(await response.text());
    let items=parsed.incidents.filter(i=>{
      const kind=incidentKind(i.type);
      if(kind==="roadworks"&&!includeRoadworks)return false;
      if(kind==="congestion"&&!includeCongestion)return false;
      if(kind==="incident"&&!includeIncidents)return false;
      if(all||!roads.length)return true;
      if(i.roadKeys.some(key=>roads.includes(key)))return true;
      const hay=`${i.road} ${i.summary} ${i.location}`.toUpperCase();
      return roads.some(r=>hay.includes(r));
    });

    items=items.sort((a,b)=>score(b,roads)-score(a,roads)).slice(0,limit);
    const radioItems=items.filter(i=>i.severity!=="low"&&i.road).slice(0,4);

    return NextResponse.json({
      ok:true,source:"Vlaams Verkeerscentrum",feed:"DATEX II v3 full",feedUrl:FEED_URL,
      publicationTime:parsed.publicationTime,fetchedAt:new Date().toISOString(),roads,allFlanders:all,
      totalParsed:parsed.incidents.length,count:items.length,items,
      radioText:makeRadioText(radioItems.length?radioItems:items.filter(i=>i.road).slice(0,3))
    },{headers:{"Cache-Control":"public, s-maxage=60, stale-while-revalidate=300"}});
  }catch(error){
    return NextResponse.json({
      ok:false,
      error:error instanceof Error?error.message:"Verkeersfeed kon niet geladen worden",
      source:"Vlaams Verkeerscentrum",feedUrl:FEED_URL,fetchedAt:new Date().toISOString()
    },{status:502,headers:{"Cache-Control":"no-store"}});
  }
}
