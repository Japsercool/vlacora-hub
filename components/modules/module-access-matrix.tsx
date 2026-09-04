"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient, isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import styles from "./module-access-matrix.module.css";

type AccessLevel = "view" | "edit" | "manage" | "hidden";
type Profile = {
  id: string;
  display_name: string | null;
  role: string | null;
  job_title: string | null;
  active: boolean | null;
};
type OverrideRow = {
  user_id: string;
  station_slug: string;
  module_key: string;
  access_level: AccessLevel;
};

type ModuleDef = { key: string; label: string; icon: string };

const MODULES: ModuleDef[] = [
  { key: "dashboard", label: "Dashboard", icon: "⌂" },
  { key: "tasks", label: "Taken", icon: "✓" },
  { key: "messenger", label: "Messenger", icon: "💬" },
  { key: "editorial", label: "Redactie", icon: "✎" },
  { key: "official_communications", label: "Communicatie", icon: "➤" },
  { key: "music", label: "Muziek", icon: "♫" },
  { key: "hitlists", label: "Hitlijsten", icon: "♬" },
  { key: "social", label: "Social Studio", icon: "▧" },
  { key: "programming", label: "Programmering", icon: "▦" },
  { key: "availability", label: "Beschikbaarheid", icon: "◷" },
  { key: "calendar", label: "Agenda", icon: "□" },
  { key: "bug_reports", label: "Bug Reports", icon: "⚠" },
  { key: "incidents", label: "Meldpunt", icon: "!" },
  { key: "team", label: "Team", icon: "♟" },
  { key: "contacts", label: "Contacten", icon: "☎" },
  { key: "templates", label: "Templates", icon: "◇" },
  { key: "team_rights", label: "Rechtenbeheer", icon: "⌘" },
  { key: "database_backend", label: "Database", icon: "▤" },
];

const NEXT: Array<AccessLevel | null> = [null, "view", "edit", "manage", "hidden"];

function nextLevel(current: AccessLevel | null): AccessLevel | null {
  const i = NEXT.indexOf(current);
  return NEXT[(i + 1) % NEXT.length] ?? null;
}

function badge(level: AccessLevel | null) {
  if (level === "view") return { text: "◉", title: "Kijken", className: styles.view };
  if (level === "edit") return { text: "✓", title: "Bewerken", className: styles.edit };
  if (level === "manage") return { text: "★", title: "Beheren", className: styles.manage };
  if (level === "hidden") return { text: "×", title: "Geblokkeerd", className: styles.hidden };
  return { text: "Rol", title: "Volgt standaard rol/rechten", className: styles.inherit };
}

export function ModuleAccessMatrix({ stationSlug = "all" }: { stationSlug?: string }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [error, setError] = useState("");

  const client = useMemo(() => (isSupabaseBrowserConfigured() ? createClient() : null), []);

  const load = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setError("");
    const [{ data: p, error: pe }, { data: o, error: oe }] = await Promise.all([
      client.from("profiles").select("id,display_name,role,job_title,active").eq("active", true).order("display_name"),
      client.from("hub_module_access_overrides").select("user_id,station_slug,module_key,access_level").eq("station_slug", stationSlug),
    ]);
    if (pe || oe) setError(pe?.message || oe?.message || "Kon rechten niet laden.");
    setProfiles((p || []) as Profile[]);
    setOverrides((o || []) as OverrideRow[]);
    setLoading(false);
  }, [client, stationSlug]);

  useEffect(() => { void load(); }, [load]);

  const map = useMemo(() => {
    const out = new Map<string, AccessLevel>();
    for (const row of overrides) out.set(`${row.user_id}:${row.module_key}`, row.access_level);
    return out;
  }, [overrides]);

  async function change(userId: string, moduleKey: string) {
    if (!client) return;
    const key = `${userId}:${moduleKey}`;
    const current = map.get(key) ?? null;
    const next = nextLevel(current);
    setSavingKey(key);
    setError("");
    const { data: authData } = await client.auth.getUser();
    const actor = authData.user?.id ?? null;

    if (next === null) {
      const { error: e } = await client
        .from("hub_module_access_overrides")
        .delete()
        .eq("user_id", userId)
        .eq("station_slug", stationSlug)
        .eq("module_key", moduleKey);
      if (e) setError(e.message); else setOverrides(v => v.filter(r => !(r.user_id === userId && r.station_slug === stationSlug && r.module_key === moduleKey)));
    } else {
      const row = { user_id: userId, station_slug: stationSlug, module_key: moduleKey, access_level: next, updated_by: actor, updated_at: new Date().toISOString() };
      const { error: e } = await client.from("hub_module_access_overrides").upsert(row, { onConflict: "user_id,station_slug,module_key" });
      if (e) setError(e.message); else setOverrides(v => [...v.filter(r => !(r.user_id === userId && r.station_slug === stationSlug && r.module_key === moduleKey)), row as OverrideRow]);
    }
    setSavingKey("");
  }

  return (
    <section className={styles.shell}>
      <div className={styles.info}>
        <span className={styles.infoIcon}>ⓘ</span>
        <div><strong>Moduletoegang per gebruiker</strong> — klik op een cel om het toegangsniveau te wijzigen. <b>Rol</b> volgt de standaard roltoewijzing; een override heeft voorrang.</div>
      </div>
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.scroller}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.userHead}>GEBRUIKER</th>
              {MODULES.map(m => <th key={m.key} className={styles.moduleHead}><span>{m.label}</span><b>{m.icon}</b></th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td className={styles.loading} colSpan={MODULES.length + 1}>Rechten laden…</td></tr> : profiles.map(p => (
              <tr key={p.id}>
                <td className={styles.userCell}>
                  <strong>{p.display_name || "Naamloos account"}</strong>
                  <div><span>{p.role || "geen rol"}</span>{p.job_title ? <span>{p.job_title}</span> : null}</div>
                </td>
                {MODULES.map(m => {
                  const k = `${p.id}:${m.key}`;
                  const level = map.get(k) ?? null;
                  const b = badge(level);
                  return <td key={m.key} className={styles.levelCell}>
                    <button type="button" disabled={savingKey === k} title={`${m.label}: ${b.title}`} className={`${styles.levelButton} ${b.className}`} onClick={() => void change(p.id, m.key)}>{savingKey === k ? "…" : b.text}</button>
                  </td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default ModuleAccessMatrix;
