import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return timingSafeEqual(aa, bb);
}

export function radioApiEnabled() {
  return process.env.RADIO_API_ENABLED === "true";
}

export function radioWriteEnabled() {
  return process.env.RADIO_API_WRITE_ENABLED === "true";
}

export function insecureHttpAllowed() {
  return process.env.RADIO_API_ALLOW_INSECURE_HTTP === "true";
}

export function isBasicAuthConfigured() {
  return Boolean(process.env.VLACORA_BASIC_AUTH_USER && process.env.VLACORA_BASIC_AUTH_PASSWORD);
}

export function basicAuthOk(request: NextRequest) {
  const user = process.env.VLACORA_BASIC_AUTH_USER || "";
  const password = process.env.VLACORA_BASIC_AUTH_PASSWORD || "";
  if (!user || !password) return false;

  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Basic ")) return false;

  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const split = decoded.indexOf(":");
    if (split < 0) return false;
    const givenUser = decoded.slice(0, split);
    const givenPassword = decoded.slice(split + 1);
    return safeEqual(givenUser, user) && safeEqual(givenPassword, password);
  } catch {
    return false;
  }
}

export function requireRadioReadAccess(request: NextRequest) {
  if (!radioApiEnabled()) {
    return NextResponse.json(
      { error: "Real radio API access is disabled. Set RADIO_API_ENABLED=true only after protecting VLACORA." },
      { status: 503 }
    );
  }
  if (!isBasicAuthConfigured()) {
    return NextResponse.json(
      { error: "Real radio API access requires VLACORA_BASIC_AUTH_USER and VLACORA_BASIC_AUTH_PASSWORD in this build." },
      { status: 503 }
    );
  }
  if (!basicAuthOk(request)) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="VLACORA HUB"' }
    });
  }
  return null;
}

export function requireRadioWriteAccess(request: NextRequest) {
  const read = requireRadioReadAccess(request);
  if (read) return read;

  if (!radioWriteEnabled()) {
    return NextResponse.json(
      { error: "Radio write access is disabled. Set RADIO_API_WRITE_ENABLED=true only when you explicitly want remote playlist edits." },
      { status: 403 }
    );
  }

  const origin = request.headers.get("origin");
  const publicOrigin = process.env.VLACORA_PUBLIC_ORIGIN?.replace(/\/$/, "");
  if (publicOrigin && origin && origin.replace(/\/$/, "") !== publicOrigin) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return NextResponse.json({ error: "application/json required" }, { status: 415 });
  }

  return null;
}
