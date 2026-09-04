export function normalizePublicUrl(value: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Alleen http(s)-URL's zijn toegestaan");
  return url.origin + url.pathname.replace(/\/$/, "");
}

export function pulseAuthCallbackUrl(publicSiteUrl: string): string {
  const base = normalizePublicUrl(publicSiteUrl).replace(/\/$/, "");
  return base ? `${base}/auth/callback` : "/auth/callback";
}

/**
 * PULSE app-routes blijven relatief zodat een nieuw domein geen codewijziging vereist.
 */
export function pulseAppPath(pathname: string): string {
  const value = String(pathname || "").trim();
  if (!value) return "/";
  if (/^https?:\/\//i.test(value)) throw new Error("Gebruik voor interne PULSE-routes geen absolute URL");
  return value.startsWith("/") ? value : `/${value}`;
}
