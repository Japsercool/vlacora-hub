function sourceBase() {
  const base = (process.env.PULSE_SOURCE_SUPABASE_URL || process.env.SUPABASE_AUTH_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("PULSE_SOURCE_SUPABASE_URL/SUPABASE_AUTH_URL ontbreekt op de Gateway");
  return base;
}

function sourceKey() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.PULSE_SOURCE_PUBLISHABLE_KEY || "";
  if (!key) throw new Error("SUPABASE_PUBLISHABLE_KEY ontbreekt op de Gateway");
  return key;
}

export async function sourceRpc(jwt, fn, body = {}) {
  const res = await fetch(`${sourceBase()}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: sourceKey(),
      authorization: `Bearer ${jwt}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const detail = data?.message || data?.error || text || `HTTP ${res.status}`;
    throw new Error(`Supabase exportbrug: ${detail}`);
  }
  return data;
}

export async function assertSourceSuperadmin(jwt) {
  const ok = await sourceRpc(jwt, "pulse_assert_superadmin", {});
  if (ok !== true) throw new Error("De ingelogde gebruiker is geen PULSE-superadmin");
  return true;
}

export async function loadCatalog(jwt) {
  return sourceRpc(jwt, "pulse_export_catalog", {});
}

export async function loadRuntimeCatalog(jwt) {
  return sourceRpc(jwt, "pulse_export_runtime_catalog", {});
}

export async function loadStorageObjects(jwt) {
  const data = await sourceRpc(jwt, "pulse_export_storage_objects", {});
  return Array.isArray(data) ? data : [];
}

export async function loadAuthIdentities(jwt) {
  const data = await sourceRpc(jwt, "pulse_export_auth_identities", {});
  return Array.isArray(data) ? data : [];
}

export async function tableCount(jwt, table) {
  const value = await sourceRpc(jwt, "pulse_export_table_count", { p_table: table });
  return Number(value || 0);
}

export async function tablePage(jwt, table, offset, limit = 500) {
  return sourceRpc(jwt, "pulse_export_table", { p_table: table, p_offset: offset, p_limit: limit });
}

export async function validateSupabaseSession(jwt) {
  const res = await fetch(`${sourceBase()}/auth/v1/user`, {
    headers: { apikey: sourceKey(), authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) throw new Error("Supabase sessie is ongeldig of verlopen");
  return res.json();
}

export function sourceStorageBase() {
  return sourceBase();
}

export async function downloadStorageObject(jwt, bucket, storagePath, isPublic = false) {
  const encoded = storagePath.split("/").map(encodeURIComponent).join("/");
  const access = isPublic ? "public" : "authenticated";
  const headers = isPublic
    ? { apikey: sourceKey() }
    : { apikey: sourceKey(), authorization: `Bearer ${jwt}` };
  const res = await fetch(`${sourceBase()}/storage/v1/object/${access}/${encodeURIComponent(bucket)}/${encoded}`, { headers });
  if (!res.ok) throw new Error(`Storage download mislukt (${res.status}) voor ${bucket}/${storagePath}`);
  return Buffer.from(await res.arrayBuffer());
}
