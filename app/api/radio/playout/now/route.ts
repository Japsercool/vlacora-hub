import { NextRequest, NextResponse } from "next/server";
import { radioFetch } from "@/lib/radio/adapter";
import { normalizeNow } from "@/lib/radio/normalize";
import { requireRadioReadAccess } from "@/lib/security/radio-access";

export async function GET(request:NextRequest) {
  const denied=requireRadioReadAccess(request); if(denied)return denied;
  const stationId=request.nextUrl.searchParams.get("stationId")||"";
  if(!stationId)return NextResponse.json({error:"stationId is required"},{status:400});
  try{
    const template=process.env.PLAYOUT_ONE_NOWPLAYING_PATH||"/api/v1/stations/{stationId}/nowplaying";
    const path=template.replace("{stationId}",encodeURIComponent(stationId));
    const res=await radioFetch("playout",path);
    const text=await res.text(); let raw:unknown=text; try{raw=JSON.parse(text)}catch{}
    return NextResponse.json({ok:res.ok,status:res.status,...normalizeNow(raw)});
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Playout now-playing failed"},{status:502});
  }
}
