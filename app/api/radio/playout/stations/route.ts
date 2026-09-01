import { NextRequest, NextResponse } from "next/server";
import { radioFetch } from "@/lib/radio/adapter";
import { normalizeStations } from "@/lib/radio/normalize";
import { requireRadioReadAccess } from "@/lib/security/radio-access";

export async function GET(request:NextRequest) {
  const denied=requireRadioReadAccess(request); if(denied)return denied;
  try{
    const path=process.env.PLAYOUT_ONE_STATIONS_PATH||"/api/v1/stations";
    const res=await radioFetch("playout",path);
    const text=await res.text(); let raw:unknown=text; try{raw=JSON.parse(text)}catch{}
    return NextResponse.json({ok:res.ok,status:res.status,stations:normalizeStations(raw)});
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Playout station discovery failed"},{status:502});
  }
}
