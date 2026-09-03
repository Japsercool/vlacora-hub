import { NextResponse } from "next/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const DATEX_URL="https://www.verkeerscentrum.be/uitwisseling/datex2v3full";
const OVERVIEW_URL="https://www.verkeerscentrum.be/taxonomy/term/34";

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

function decodeEntities(value:string){
  return value
    .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#39;/g,"'")
    .replace(/&nbsp;/g," ")
    .replace(/&#x([0-9a-f]+);/gi,(_,hex)=>String.fromCodePoint(parseInt(hex,16)))
    .replace(/&#(\d+);/g,(_,num)=>String.fromCodePoint(Number(num)));
}
function stripTags(value:string){
  return decodeEntities(value.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim());
}
function normalizeRoad(value:string){return value.toUpperCase().replace(/[\s-]+/g,"")}
function roadCodes(value:string){
  return [...new Set(
    (value.match(/\b(?:E|A|R|N|B)\s*[- ]?\s*\d{1,3}\b/gi)||[])
      .map(x=>x.toUpperCase().replace(/\s+/g,"").replace(/([A-Z])-(\d)/,"$1$2"))
  )];
}
function classifyTitle(title:string){
  if(/^ongeval\b/i.test(title))return{type:"Accident",label:"Ongeval",severity:"high" as const,kind:"incident"};
  if(/^(?:defect|brandend)\s+voertuig\b/i.test(title))return{type:"VehicleObstruction",label:"Defect voertuig",severity:"high" as const,kind:"incident"};
  if(/^wegenwerken\b/i.test(title))return{type:"Roadworks",label:"Wegenwerken",severity:"medium" as const,kind:"roadworks"};
  if(/^vertraagd verkeer\b/i.test(title))return{type:"AbnormalTraffic",label:"Vertraagd verkeer",severity:"high" as const,kind:"congestion"};
  if(/^file\b/i.test(title))return{type:"AbnormalTraffic",label:"File",severity:"high" as const,kind:"congestion"};
  if(/^(?:afgesloten|versperring|hinder|obstakel)\b/i.test(title))return{type:"Obstruction",label:"Verkeershinder",severity:"high" as const,kind:"incident"};
  if(/^spookrijder\b/i.test(title))return{type:"Obstruction",label:"Spookrijder",severity:"high" as const,kind:"incident"};
  return{type:"TrafficSituation",label:"Verkeersmelding",severity:"medium" as const,kind:"incident"};
}
function eventTitle(line:string){
  return /^(?:File|Vertraagd verkeer|Ongeval|Defect voertuig|Brandend voertuig|Wegenwerken|Afgesloten|Versperring|Hinder|Obstakel|Spookrijder|Evenement)\b/i.test(line);
}
function isMetaLine(line:string){
  return !line
    || /^(?:Menu|Aanmelden|Registreren|Image|Publiek|Yes|No|Abonneer|Over het Vlaams Verkeerscentrum|Lees meer|Laatste update:)/i.test(line)
    || /^\d+(?:[,.]\d+)?\s*km\b/i.test(line)
    || /^\d+\s*km$/i.test(line);
}
function htmlToLines(html:string){
  const cleaned=html
    .replace(/<script\b[\s\S]*?<\/script>/gi,"")
    .replace(/<style\b[\s\S]*?<\/style>/gi,"")
    .replace(/<(?:br|\/p|\/div|\/li|\/h1|\/h2|\/h3|\/article|\/section|\/a)>/gi,"\n")
    .replace(/<[^>]+>/g," ");
  return decodeEntities(cleaned)
    .split(/\n+/)
    .map(x=>x.replace(/\s+/g," ").trim())
    .filter(Boolean);
}
function extractDirection(title:string,routeLine:string){
  const fromTitle=title.match(/\brichting\s+([^,.;]{2,80})/i)?.[1]?.trim();
  if(fromTitle)return fromTitle;
  const arrow=routeLine.match(/(?:->|→)\s*(.+)$/)?.[1]?.trim();
  return arrow||"";
}
function roadFromTitle(title:string,previousRoad:string){
  if(previousRoad&&roadCodes(previousRoad).length)return previousRoad;
  const withoutType=title.replace(/^(?:File|Vertraagd verkeer|Ongeval|Defect voertuig|Brandend voertuig|Wegenwerken|Afgesloten|Versperring|Hinder|Obstakel|Spookrijder|Evenement)\s+/i,"");
  const stop=withoutType.search(/\s+(?:vanaf|tussen|ter hoogte van|richting)\b/i);
  const candidate=(stop>=0?withoutType.slice(0,stop):withoutType).trim();
  if(roadCodes(candidate).length)return candidate;
  const codes=roadCodes(title);
  return codes.join(" - ");
}
function locationFromTitle(title:string,road:string){
  let rest=title.replace(/^(?:File|Vertraagd verkeer|Ongeval|Defect voertuig|Brandend voertuig|Wegenwerken|Afgesloten|Versperring|Hinder|Obstakel|Spookrijder|Evenement)\s+/i,"");
  if(road&&rest.toLowerCase().startsWith(road.toLowerCase()))rest=rest.slice(road.length).trim();
  rest=rest.replace(/,\s*richting\s+.+$/i,"").trim();
  return rest;
}
const MONTHS:Record<string,number>={
  januari:1,februari:2,maart:3,april:4,mei:5,juni:6,juli:7,augustus:8,september:9,oktober:10,november:11,december:12
};
function parseDutchDate(line:string){
  const m=line.match(/Laatst gewijzigd op\s+(\d{1,2})\s+([a-zé]+)\s+(\d{4})\s*-\s*(\d{1,2}):(\d{2})/i);
  if(!m)return new Date().toISOString();
  const month=MONTHS[m[2].toLowerCase()]||1;
  const summer=month>=4&&month<=10;
  return`${m[3]}-${String(month).padStart(2,"0")}-${String(Number(m[1])).padStart(2,"0")}T${String(Number(m[4])).padStart(2,"0")}:${m[5]}:00${summer?"+02:00":"+01:00"}`;
}
function parseOfficialOverview(html:string,page:number){
  const lines=htmlToLines(html),items:TrafficIncident[]=[];
  for(let i=0;i<lines.length;i++){
    const title=lines[i];
    if(!eventTitle(title))continue;

    let previousRoad="",routeLine="";
    for(let j=i-1;j>=0&&j>=i-6;j--){
      const candidate=lines[j];
      if(isMetaLine(candidate)||eventTitle(candidate)||/^Laatst gewijzigd op/i.test(candidate))continue;
      if(!routeLine&&/(?:->|→)/.test(candidate)){routeLine=candidate;continue}
      if(!previousRoad&&(roadCodes(candidate).length||/^Ring\s+\d/i.test(candidate))){previousRoad=candidate;break}
    }

    let updatedLine="";
    for(let j=i+1;j<lines.length&&j<=i+5;j++){
      if(/^Laatst gewijzigd op/i.test(lines[j])){updatedLine=lines[j];break}
      if(eventTitle(lines[j]))break;
    }

    const info=classifyTitle(title);
    const road=roadFromTitle(title,previousRoad);
    const direction=extractDirection(title,routeLine);
    const summary=/[.!?]$/.test(title)?title:`${title}.`;
    items.push({
      id:`overview-${page}-${i}-${summary.slice(0,40)}`,
      type:info.type,typeLabel:info.label,severity:info.severity,
      road,roadKeys:roadCodes(`${road} ${title}`).map(normalizeRoad),
      direction,location:locationFromTitle(title,road),
      summary,validUntil:"",updatedAt:parseDutchDate(updatedLine)
    });
  }
  return items;
}
function incidentKind(type:string){
  const lower=type.toLowerCase();
  if(lower.includes("roadwork"))return"roadworks";
  if(lower.includes("abnormaltraffic")||lower.includes("congestion"))return"congestion";
  return"incident";
}
function filterItems(items:TrafficIncident[],roads:string[],all:boolean,includeRoadworks:boolean,includeIncidents:boolean,includeCongestion:boolean){
  return items.filter(i=>{
    const kind=incidentKind(i.type);
    if(kind==="roadworks"&&!includeRoadworks)return false;
    if(kind==="congestion"&&!includeCongestion)return false;
    if(kind==="incident"&&!includeIncidents)return false;
    if(all||!roads.length)return true;
    if(i.roadKeys.some(key=>roads.includes(key)))return true;
    const hay=`${i.road} ${i.summary} ${i.location}`.toUpperCase();
    return roads.some(r=>hay.includes(r));
  });
}
function dedupe(items:TrafficIncident[]){
  const seen=new Set<string>();
  return items.filter(item=>{
    const key=item.summary.toLowerCase().replace(/\s+/g," ").trim();
    if(seen.has(key))return false;
    seen.add(key);return true;
  });
}
function score(i:TrafficIncident,roads:string[]){
  let s=i.severity==="high"?100:i.severity==="medium"?60:30;
  const roadIndex=roads.findIndex(r=>i.roadKeys.includes(r));
  if(roadIndex>=0)s+=50-roadIndex*3;
  if(incidentKind(i.type)==="congestion")s+=15;
  if(i.road)s+=15;
  return s;
}
function makeRadioText(items:TrafficIncident[]){
  if(!items.length)return"Op de belangrijkste Vlaamse wegen zijn momenteel geen grote verkeersproblemen gemeld door het Vlaams Verkeerscentrum.";
  return items.slice(0,4).map(i=>i.summary).join(" ");
}

/* DATEX is kept as a fallback source. We deliberately do not present
   records without a usable road/location as public cards. */
function xmlTag(block:string,name:string){
  const re=new RegExp(`<(?:(?:\\w+):)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:\\w+):)?${name}>`,"i");
  const m=block.match(re);return m?stripTags(m[1]||""):"";
}
function parseDatexFallback(xml:string){
  const publicationTime=xmlTag(xml,"publicationTime")||new Date().toISOString();
  const items:TrafficIncident[]=[];
  const re=/<(?:(?:\w+):)?situationRecord\b([^>]*)>([\s\S]*?)<\/(?:(?:\w+):)?situationRecord>/gi;
  let m:RegExpExecArray|null,index=0;
  while((m=re.exec(xml))){
    const attrs=m[1]||"",block=m[2]||"";
    const values=[...block.matchAll(/<(?:(?:\w+):)?value\b[^>]*>([\s\S]*?)<\/(?:(?:\w+):)?value>/gi)].map(x=>stripTags(x[1]||"")).filter(Boolean);
    const specific=values.filter(v=>roadCodes(v).length||/\b(?:vanaf|tussen|ter hoogte van|richting|parking|tunnel|afrit|oprit)\b/i.test(v))
      .sort((a,b)=>b.length-a.length)[0]||"";
    const codes=roadCodes(`${specific} ${stripTags(block)}`);
    if(!specific&&!codes.length)continue;
    const title=specific||`Verkeershinder ${codes.join(" - ")}`;
    const info=classifyTitle(title);
    const road=roadFromTitle(title,codes.join(" - "));
    items.push({
      id:attrs.match(/\bid=["']([^"']+)/i)?.[1]||`datex-${index++}`,
      type:info.type,typeLabel:info.label,severity:info.severity,
      road,roadKeys:roadCodes(`${road} ${title}`).map(normalizeRoad),
      direction:extractDirection(title,""),
      location:locationFromTitle(title,road),
      summary:/[.!?]$/.test(title)?title:`${title}.`,
      validUntil:"",updatedAt:xmlTag(block,"situationRecordVersionTime")||publicationTime
    });
  }
  return{publicationTime,items};
}

async function loadOfficialOverview(){
  /* Four small HTML pages give a much better human-readable overview than
     exposing hundreds of low-level DATEX records. Fetch caching keeps this
     cheap and the call only happens when traffic is explicitly requested. */
  const pages=await Promise.all([0,1,2,3].map(async page=>{
    const url=page===0?OVERVIEW_URL:`${OVERVIEW_URL}?page=${page}`;
    const response=await fetch(url,{
      headers:{Accept:"text/html,application/xhtml+xml","User-Agent":"VLACORA-HUB/0.23.1"},
      next:{revalidate:60}
    });
    if(!response.ok)throw new Error(`Verkeerscentrum overzicht HTTP ${response.status}`);
    return{page,html:await response.text()};
  }));
  return dedupe(pages.flatMap(x=>parseOfficialOverview(x.html,x.page)));
}

export async function GET(req: globalThis.Request){
  const params=new URL(req.url).searchParams;
  const roads=(params.get("roads")||"").split(",").map(x=>normalizeRoad(x.trim())).filter(Boolean).slice(0,20);
  const all=params.get("all")==="1";
  const includeRoadworks=params.get("roadworks")!=="0";
  const includeIncidents=params.get("incidents")!=="0";
  const includeCongestion=params.get("congestion")!=="0";
  const limit=Math.min(50,Math.max(1,Number(params.get("limit")||20)));
  const fetchedAt=new Date().toISOString();

  try{
    const humanItems=await loadOfficialOverview();
    if(humanItems.length){
      const filtered=filterItems(humanItems,roads,all,includeRoadworks,includeIncidents,includeCongestion)
        .sort((a,b)=>score(b,roads)-score(a,roads))
        .slice(0,limit);

      return NextResponse.json({
        ok:true,source:"Vlaams Verkeerscentrum",feed:"Officieel verkeersoverzicht",
        feedUrl:OVERVIEW_URL,publicationTime:filtered[0]?.updatedAt||fetchedAt,fetchedAt,
        roads,allFlanders:all,totalParsed:humanItems.length,count:filtered.length,items:filtered,
        radioText:makeRadioText(filtered.filter(x=>x.severity!=="low").slice(0,4))
      },{headers:{"Cache-Control":"public, s-maxage=60, stale-while-revalidate=300"}});
    }
  }catch{}

  try{
    const response=await fetch(DATEX_URL,{
      headers:{Accept:"application/xml,text/xml;q=0.9,*/*;q=0.8","User-Agent":"VLACORA-HUB/0.23.1"},
      next:{revalidate:60}
    });
    if(!response.ok)throw new Error(`DATEX HTTP ${response.status}`);
    const parsed=parseDatexFallback(await response.text());
    const filtered=filterItems(parsed.items,roads,all,includeRoadworks,includeIncidents,includeCongestion)
      .sort((a,b)=>score(b,roads)-score(a,roads))
      .slice(0,limit);

    return NextResponse.json({
      ok:true,source:"Vlaams Verkeerscentrum",feed:"DATEX II v3 fallback",
      feedUrl:DATEX_URL,publicationTime:parsed.publicationTime,fetchedAt,
      roads,allFlanders:all,totalParsed:parsed.items.length,count:filtered.length,items:filtered,
      radioText:makeRadioText(filtered)
    },{headers:{"Cache-Control":"public, s-maxage=60, stale-while-revalidate=300"}});
  }catch(error){
    return NextResponse.json({
      ok:false,error:error instanceof Error?error.message:"Verkeersinformatie kon niet geladen worden",
      source:"Vlaams Verkeerscentrum",feedUrl:OVERVIEW_URL,fetchedAt
    },{status:502,headers:{"Cache-Control":"no-store"}});
  }
}
