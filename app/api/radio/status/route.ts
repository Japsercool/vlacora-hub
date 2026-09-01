export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { radioFetch } from "@/lib/radio/adapter";
import { requireRadioReadAccess } from "@/lib/security/radio-access";

async function probe(target:"rotation"|"playout", stationId:string) {
  try{
    const template=target==="rotation"
      ? (process.env.ROTATION_ONE_STATUS_PATH||"/api/v1/status")
      : (process.env.PLAYOUT_ONE_STATUS_PATH||"/api/v1/status");
    const path=template.replace("{stationId}",encodeURIComponent(stationId));
    const res=await radioFetch(target,path);
    return {online:res.ok,status:res.status};
  }catch(error){
    return {online:false,error:error instanceof Error?error.message:"probe failed"};
  }
}

export async function GET(request:NextRequest) {
  const denied=requireRadioReadAccess(request); if(denied)return denied;
  const rotationStationId=request.nextUrl.searchParams.get("rotationStationId")||"";
  const playoutStationId=request.nextUrl.searchParams.get("playoutStationId")||"";
  const [rotation,playout]=await Promise.all([
    probe("rotation",rotationStationId),
    probe("playout",playoutStationId),
  ]);
  return NextResponse.json({rotation,playout,checkedAt:new Date().toISOString()});
}
