export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { radioFetch } from "@/lib/radio/adapter";
import { normalizePlaylist } from "@/lib/radio/normalize";
import { requireRadioReadAccess, requireRadioWriteAccess } from "@/lib/security/radio-access";

function pathFor(stationId:string,date:string,hour:string,write=false){
  const template=write
    ? (process.env.ROTATION_ONE_PLAYLIST_WRITE_PATH||process.env.ROTATION_ONE_PLAYLIST_PATH||"/api/v1/stations/{stationId}/playlists")
    : (process.env.ROTATION_ONE_PLAYLIST_PATH||"/api/v1/stations/{stationId}/playlists");
  let path=template.replace("{stationId}",encodeURIComponent(stationId));
  const q=new URLSearchParams(); if(date)q.set("date",date); if(hour)q.set("hour",hour);
  const query=q.toString(); if(query)path+=`${path.includes("?")?"&":"?"}${query}`;
  return path;
}

export async function GET(request:NextRequest){
  const denied=requireRadioReadAccess(request); if(denied)return denied;
  const stationId=request.nextUrl.searchParams.get("stationId")||"";
  const date=request.nextUrl.searchParams.get("date")||"";
  const hour=request.nextUrl.searchParams.get("hour")||"";
  if(!stationId)return NextResponse.json({error:"stationId is required"},{status:400});
  try{
    const res=await radioFetch("rotation",pathFor(stationId,date,hour));
    const text=await res.text(); let raw:unknown=text; try{raw=JSON.parse(text)}catch{}
    const normalized=normalizePlaylist(raw);
    return NextResponse.json({ok:res.ok,status:res.status,version:normalized.version,items:normalized.items});
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Rotation playlist failed"},{status:502});
  }
}

export async function POST(request:NextRequest){
  const denied=requireRadioWriteAccess(request); if(denied)return denied;
  const body=await request.json();
  const stationId=String(body.stationId||"");
  if(!stationId)return NextResponse.json({error:"stationId is required"},{status:400});
  const method=(process.env.ROTATION_ONE_PLAYLIST_WRITE_METHOD||"PUT").toUpperCase();
  try{
    const res=await radioFetch("rotation",pathFor(stationId,String(body.date||""),String(body.hour||""),true),{
      method,
      body:JSON.stringify({items:body.items||[],version:body.version})
    });
    const text=await res.text(); let raw:unknown=text; try{raw=JSON.parse(text)}catch{}
    const normalized=normalizePlaylist(raw);
    return NextResponse.json({ok:res.ok,status:res.status,version:normalized.version,items:normalized.items});
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Rotation playlist update failed"},{status:502});
  }
}
