export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { publicRadioConfig } from "@/lib/radio/adapter";

export async function GET() {
  return NextResponse.json(publicRadioConfig(), {
    headers: { "Cache-Control":"no-store" }
  });
}
