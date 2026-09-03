export type BroadPlaylistType="music"|"commercial"|"news"|"weather"|"traffic"|"imaging"|"promo"|"link"|"talk"|"browse"|"tease"|"item";
type Input={type?:unknown;rawType?:unknown;category?:unknown;externalKind?:unknown;artist?:unknown;musicId?:unknown;songId?:unknown;isSweeper?:unknown};
const n=(v:unknown)=>String(v??"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
export function canonicalPlaylistType(x:Input):BroadPlaylistType{
 const raw=n(x.rawType||x.type),cat=n(x.category),ext=n(x.externalKind),all=`${raw} ${cat} ${ext}`;
 if(Boolean(x.isSweeper)||/sweeper/.test(all))return"imaging";
 if(/nieuws|news/.test(ext)||/nieuws|news/.test(raw))return"news";
 if(/weer|weather|meteo/.test(ext)||/weer|weather|meteo/.test(raw))return"weather";
 if(/verkeer|traffic/.test(ext)||/verkeer|traffic/.test(raw))return"traffic";
 if(/commercial|advert|advertising|reclame|spot/.test(all))return"commercial";
 if(/jingle|imaging|liner|station ?id|sweeper/.test(all))return"imaging";
 if(/promo|promotie/.test(all))return"promo";
 if(/browse ?list|browselist/.test(all))return"browse";
 if(/tease|teaser/.test(all))return"tease";
 if(/(^|\s)link(\s|$)/.test(all))return"link";
 if(/talk|praat|voice ?track|voicetrack|presentatie/.test(all))return"talk";
 if(/muziek|music|song|track/.test(all))return"music";
 if(String(x.musicId??x.songId??"").trim()||String(x.artist??"").trim())return"music";
 return"item";
}
export function broadPlaylistLabel(t:BroadPlaylistType){
 return t==="music"?"Muziek":t==="commercial"?"Advertentie":t==="news"?"Nieuws":t==="weather"?"Weer":t==="traffic"?"Verkeer":t==="imaging"?"Jingle / imaging":t==="promo"?"Promo":t==="link"?"Link":t==="browse"?"Browse list":t==="tease"?"Tease":t==="talk"?"Talk":"Item";
}
