import { NextResponse } from "next/server";
import { publicRadioConfig } from "@/lib/radio/adapter";

export async function GET() {
  return NextResponse.json(publicRadioConfig(), {
    headers: { "Cache-Control":"no-store" }
  });
}
