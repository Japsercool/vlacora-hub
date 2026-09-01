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
