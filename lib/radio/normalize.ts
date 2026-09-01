export type NormalizedStation = {
  id: string;
  name: string;
  slug?: string;
  raw?: unknown;
};

export type NormalizedPlaylistItem = {
  id: string;
  time: string;
  type: string;
  artist?: string;
  title: string;
  duration: string;
  presenterText: string;
  notes: string;
  source: "Rotation One" | "Playout One" | "VLACORA";
  locked?: boolean;
  musicId?: string;
  raw?: unknown;
};

function rec(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any> : {};
}
function first(obj: Record<string, any>, keys: string[], fallback: any = "") {
  for (const key of keys) if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  return fallback;
}
function arrayCandidate(body: unknown, keys: string[]): unknown[] {
  if (Array.isArray(body)) return body;
  const obj = rec(body);
  for (const key of keys) {
    if (Array.isArray(obj[key])) return obj[key];
    const nested = rec(obj[key]);
    for (const nk of keys) if (Array.isArray(nested[nk])) return nested[nk];
  }
  return [];
}
function duration(value: any) {
  if (typeof value === "string" && /^\d{1,2}:\d{2}(:\d{2})?$/.test(value)) return value;
  let n = Number(value);
  if (!Number.isFinite(n)) return "00:00";
  if (n > 10000) n = n / 1000;
  n = Math.max(0, Math.round(n));
  return `${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`;
}
function clock(value: any) {
  const s = String(value || "");
  const m = s.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
  return m ? m[1] : s;
}

export function normalizeStations(body: unknown): NormalizedStation[] {
  return arrayCandidate(body, ["stations","Stations","data","Data","items","Items","results","Results"]).map((value,index)=>{
    const obj=rec(value);
    const id=String(first(obj,["id","Id","stationId","StationId","station_id","key","Key","slug","Slug","name","Name"],index));
    const name=String(first(obj,["name","Name","stationName","StationName","displayName","DisplayName","title","Title"],id));
    const slug=first(obj,["slug","Slug","shortName","ShortName"],undefined);
    return {id,name,slug:slug?String(slug):undefined,raw:value};
  });
}

export function normalizePlaylist(body: unknown) {
  const root=rec(body);
  const arr=arrayCandidate(body,["items","Items","playlist","Playlist","entries","Entries","data","Data"]);
  const version=first(root,["version","Version","playlistVersion","PlaylistVersion","revision","Revision"],undefined);
  return {
    version,
    items:arr.map((value,index)=>{
      const obj=rec(value);
      const artist=String(first(obj,["artist","Artist","artistName","ArtistName","performer","Performer"],""));
      const title=String(first(obj,["title","Title","name","Name","trackTitle","TrackTitle"],artist?"Onbekende titel":"Item"));
      const rawType=String(first(obj,["type","Type","itemType","ItemType","category","Category"],artist?"music":"item")).toLowerCase();
      const type=rawType.includes("music")||rawType.includes("song")?"music":
        rawType.includes("commercial")||rawType.includes("advert")?"commercial":
        rawType.includes("news")?"news":
        rawType.includes("jingle")||rawType.includes("imaging")||rawType.includes("sweeper")?"imaging":
        rawType.includes("promo")?"promo":rawType||"item";
      return {
        id:String(first(obj,["id","Id","itemId","ItemId","playlistItemId","PlaylistItemId","guid","Guid"],`item-${index}`)),
        time:clock(first(obj,["time","Time","scheduledAt","ScheduledAt","startTime","StartTime","plannedAt","PlannedAt"],"")),
        type,
        artist:artist||undefined,
        title,
        duration:duration(first(obj,["duration","Duration","durationSeconds","DurationSeconds","length","Length"],0)),
        presenterText:String(first(obj,["presenterText","PresenterText","editorialText","EditorialText","text","Text"],"")),
        notes:String(first(obj,["notes","Notes","comment","Comment","categoryName","CategoryName"],"")),
        source:"Rotation One" as const,
        locked:["commercial","news"].includes(type)||Boolean(first(obj,["locked","Locked","isLocked","IsLocked"],false)),
        musicId:first(obj,["musicId","MusicId","trackId","TrackId","databaseId","DatabaseId"],undefined)?.toString(),
        raw:value
      };
    })
  };
}

export function normalizeNow(body: unknown) {
  const obj=rec(body);
  const current=rec(first(obj,["now","Now","current","Current","currentItem","CurrentItem","nowPlaying","NowPlaying"],obj));
  const next=rec(first(obj,["next","Next","nextItem","NextItem"],{}));
  const one=(x:Record<string,any>)=>({
    id:String(first(x,["id","Id","itemId","ItemId"],"")),
    artist:String(first(x,["artist","Artist","artistName","ArtistName"],"")),
    title:String(first(x,["title","Title","name","Name"],"")),
    startedAt:String(first(x,["startedAt","StartedAt","startTime","StartTime"],"")),
    duration:duration(first(x,["duration","Duration","durationSeconds","DurationSeconds"],0)),
  });
  return {now:one(current),next:Object.keys(next).length?one(next):null,raw:body};
}

export type NormalizedMusicFolder={id:string;name:string;description:string;count?:number;raw?:unknown};
export type NormalizedMusicSong={id:string;artist:string;title:string;category?:string;year?:string;raw?:unknown};

export function normalizeMusicFolders(body:unknown):NormalizedMusicFolder[]{
  return arrayCandidate(body,["folders","Folders","musicFolders","MusicFolders","items","Items","data","Data","results","Results"]).map((value,index)=>{
    const obj=rec(value);
    const id=String(first(obj,["id","Id","folderId","FolderId","key","Key","path","Path","name","Name"],index));
    const name=String(first(obj,["name","Name","title","Title","displayName","DisplayName","folderName","FolderName"],id));
    const description=String(first(obj,["description","Description","notes","Notes","path","Path"],""));
    const c=Number(first(obj,["count","Count","songCount","SongCount","trackCount","TrackCount"],NaN));
    return {id,name,description,count:Number.isFinite(c)?c:undefined,raw:value};
  });
}

export function normalizeMusicSongs(body:unknown):NormalizedMusicSong[]{
  return arrayCandidate(body,["songs","Songs","tracks","Tracks","items","Items","data","Data","results","Results"]).map((value,index)=>{
    const obj=rec(value);
    const id=String(first(obj,["id","Id","songId","SongId","trackId","TrackId","databaseId","DatabaseId","guid","Guid"],index));
    const artist=String(first(obj,["artist","Artist","artistName","ArtistName","performer","Performer"],""));
    const title=String(first(obj,["title","Title","name","Name","trackTitle","TrackTitle"],artist?"Onbekende titel":"Item"));
    const category=String(first(obj,["category","Category","categoryName","CategoryName","rotation","Rotation","folder","Folder"],""))||undefined;
    const year=String(first(obj,["year","Year","releaseYear","ReleaseYear"],""))||undefined;
    return {id,artist,title,category,year,raw:value};
  });
}


export type NormalizedChart={
  id:string;
  name:string;
  size?:number;
  currentEditionId?:string;
  revision?:string;
  raw?:unknown;
};
export type NormalizedChartEntry={
  id:string;
  position:number;
  previousPosition:number|null;
  songId?:string;
  artist:string;
  title:string;
  weeks:number;
  peak:number;
  notes:string;
  raw?:unknown;
};
export type NormalizedChartEdition={
  id:string;
  chartId?:string;
  label:string;
  publishDate:string;
  validFrom:string;
  validTo:string;
  status:"draft"|"published"|"archived";
  programName:string;
  notes:string;
  size:number;
  revision?:string;
  entries:NormalizedChartEntry[];
  raw?:unknown;
};

export function normalizeCharts(body:unknown):NormalizedChart[]{
  return arrayCandidate(body,["charts","Charts","hitlists","Hitlists","rankedLists","RankedLists","lists","Lists","items","Items","data","Data","results","Results"]).map((value,index)=>{
    const obj=rec(value);
    const id=String(first(obj,["id","Id","chartId","ChartId","listId","ListId","rankedListId","RankedListId","key","Key","name","Name"],index));
    const name=String(first(obj,["name","Name","title","Title","displayName","DisplayName","listName","ListName"],id));
    const n=Number(first(obj,["size","Size","count","Count","maxPosition","MaxPosition","length","Length"],NaN));
    const currentEditionId=first(obj,["currentEditionId","CurrentEditionId","activeEditionId","ActiveEditionId","editionId","EditionId"],undefined);
    const revision=first(obj,["revision","Revision","version","Version","etag","ETag"],undefined);
    return {id,name,size:Number.isFinite(n)?n:undefined,currentEditionId:currentEditionId==null?undefined:String(currentEditionId),revision:revision==null?undefined:String(revision),raw:value};
  });
}

export function normalizeChartEditions(body:unknown):NormalizedChartEdition[]{
  const arr=arrayCandidate(body,["editions","Editions","chartEditions","ChartEditions","items","Items","data","Data","results","Results"]);
  return arr.map((value,index)=>normalizeChartEdition(value,index));
}

export function normalizeChartEdition(body:unknown,index=0):NormalizedChartEdition{
  const obj=rec(body);
  const entriesRaw=arrayCandidate(first(obj,["entries","Entries","positions","Positions","songs","Songs","ranking","Ranking"],[]),["entries","Entries","positions","Positions","songs","Songs","items","Items","data","Data"]);
  const entries=entriesRaw.map((value,i)=>{
    const e=rec(value);
    const posNum=Number(first(e,["position","Position","rank","Rank","number","Number"],i+1));
    const prevRaw=first(e,["previousPosition","PreviousPosition","previous","Previous","lastPosition","LastPosition"],null);
    const prevNum=prevRaw==null||String(prevRaw).toUpperCase()==="NEW"?null:Number(prevRaw);
    const weeks=Number(first(e,["weeks","Weeks","weeksOnChart","WeeksOnChart"],1));
    const peak=Number(first(e,["peak","Peak","peakPosition","PeakPosition"],Number.isFinite(posNum)?posNum:i+1));
    const artist=String(first(e,["artist","Artist","artistName","ArtistName","performer","Performer"],""));
    const title=String(first(e,["title","Title","name","Name","trackTitle","TrackTitle"],artist?"Onbekende titel":"Item"));
    const songId=first(e,["songId","SongId","trackId","TrackId","databaseId","DatabaseId"],undefined);
    return {
      id:String(first(e,["id","Id","entryId","EntryId","positionId","PositionId"],`entry-${i}`)),
      position:Number.isFinite(posNum)?posNum:i+1,
      previousPosition:Number.isFinite(prevNum as number)?prevNum as number:null,
      songId:songId==null?undefined:String(songId),
      artist,title,
      weeks:Number.isFinite(weeks)?Math.max(1,weeks):1,
      peak:Number.isFinite(peak)?Math.max(1,peak):i+1,
      notes:String(first(e,["notes","Notes","comment","Comment"],"")),
      raw:value
    };
  }).sort((a,b)=>a.position-b.position);

  const statusRaw=String(first(obj,["status","Status","state","State"],"draft")).toLowerCase();
  const status=statusRaw.includes("publish")||statusRaw==="live"||statusRaw==="active"?"published":statusRaw.includes("arch")?"archived":"draft";
  const sizeRaw=Number(first(obj,["size","Size","count","Count","maxPosition","MaxPosition"],entries.length||50));
  const id=String(first(obj,["id","Id","editionId","EditionId","key","Key"],index));
  const chartId=first(obj,["chartId","ChartId","listId","ListId","rankedListId","RankedListId"],undefined);
  const label=String(first(obj,["label","Label","editionLabel","EditionLabel","name","Name","title","Title","weekLabel","WeekLabel"],`Editie ${id}`));
  const publishDate=String(first(obj,["publishDate","PublishDate","broadcastDate","BroadcastDate","date","Date"],"")).slice(0,10);
  const validFrom=String(first(obj,["validFrom","ValidFrom","broadcastDate","BroadcastDate","startDate","StartDate"],publishDate)).slice(0,10);
  const validTo=String(first(obj,["validTo","ValidTo","broadcastEndDate","BroadcastEndDate","endDate","EndDate"],validFrom)).slice(0,10);
  const revision=first(obj,["revision","Revision","version","Version","etag","ETag"],undefined);
  return {
    id,chartId:chartId==null?undefined:String(chartId),label,publishDate,validFrom,validTo,status,
    programName:String(first(obj,["programName","ProgramName","showName","ShowName"],"")),
    notes:String(first(obj,["notes","Notes","comment","Comment"],"")),
    size:Number.isFinite(sizeRaw)?Math.max(1,sizeRaw):Math.max(entries.length,50),
    revision:revision==null?undefined:String(revision),
    entries,
    raw:body
  };
}

export function normalizeRevision(body:unknown){
  if(typeof body==="string"||typeof body==="number")return String(body);
  const obj=rec(body);
  const value=first(obj,["revision","Revision","version","Version","etag","ETag","value","Value"],"");
  return String(value||"");
}
