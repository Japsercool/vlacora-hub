import { insecureHttpAllowed } from "@/lib/security/radio-access";

export type RadioTarget = "rotation" | "playout";

function targetConfig(target: RadioTarget) {
  const prefix = target === "rotation" ? "ROTATION_ONE" : "PLAYOUT_ONE";
  return {
    baseUrl: process.env[`${prefix}_BASE_URL`],
    apiKey: process.env[`${prefix}_API_KEY`],
    apiKeyHeader: process.env[`${prefix}_API_KEY_HEADER`] || "Authorization",
    apiKeyPrefix: process.env[`${prefix}_API_KEY_PREFIX`] ?? "Bearer",
  };
}

function validateBaseUrl(raw: string) {
  const url = new URL(raw);
  const allowedHosts = (process.env.RADIO_API_ALLOWED_HOSTS || "")
    .split(",").map(x=>x.trim()).filter(Boolean);
  if (allowedHosts.length && !allowedHosts.includes(url.hostname)) {
    throw new Error(`Radio API host ${url.hostname} is not in RADIO_API_ALLOWED_HOSTS`);
  }
  if (url.username || url.password) {
    throw new Error("Do not put credentials inside the radio base URL.");
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && insecureHttpAllowed())) {
    throw new Error(
      "Insecure HTTP radio API blocked. Use HTTPS, or explicitly set RADIO_API_ALLOW_INSECURE_HTTP=true for temporary testing."
    );
  }
  return url.toString().replace(/\/$/, "");
}

export function publicRadioConfig() {
  return {
    radioApiEnabled: process.env.RADIO_API_ENABLED === "true",
    radioWriteEnabled: process.env.RADIO_API_WRITE_ENABLED === "true",
    insecureHttpAllowed: process.env.RADIO_API_ALLOW_INSECURE_HTTP === "true",
    basicAuthConfigured: Boolean(process.env.VLACORA_BASIC_AUTH_USER && process.env.VLACORA_BASIC_AUTH_PASSWORD),
    rotationConfigured: Boolean(process.env.ROTATION_ONE_BASE_URL),
    playoutConfigured: Boolean(process.env.PLAYOUT_ONE_BASE_URL),
    paths: {
      rotationStatus: process.env.ROTATION_ONE_STATUS_PATH || "/api/v1/status",
      rotationStations: process.env.ROTATION_ONE_STATIONS_PATH || "/api/v1/stations",
      rotationPlaylist: process.env.ROTATION_ONE_PLAYLIST_PATH || "/api/v1/stations/{stationId}/playlists",
      rotationWrite: process.env.ROTATION_ONE_PLAYLIST_WRITE_PATH || "",
      playoutStatus: process.env.PLAYOUT_ONE_STATUS_PATH || "/api/v1/status",
      playoutStations: process.env.PLAYOUT_ONE_STATIONS_PATH || "/api/v1/stations",
      playoutNow: process.env.PLAYOUT_ONE_NOWPLAYING_PATH || "/api/v1/stations/{stationId}/nowplaying",
    }
  };
}

export async function radioFetch(target: RadioTarget, path: string, init?: RequestInit) {
  const cfg = targetConfig(target);
  if (!cfg.baseUrl) throw new Error(`${target.toUpperCase()} base URL is not configured`);

  const base = validateBaseUrl(cfg.baseUrl);
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${cleanPath}`;

  const headers = new Headers(init?.headers || {});
  headers.set("Accept", "application/json");
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  if (cfg.apiKey) {
    const value = cfg.apiKeyPrefix ? `${cfg.apiKeyPrefix} ${cfg.apiKey}`.trim() : cfg.apiKey;
    headers.set(cfg.apiKeyHeader, value);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    return await fetch(url, {
      ...init,
      headers,
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
