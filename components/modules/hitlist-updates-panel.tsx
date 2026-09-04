"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { createClient, isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import styles from "./hitlist-updates-panel.module.css";

type Visibility = "private" | "managers" | "team";
type UpdateRow = {
  id: string;
  hitlist_id: string;
  station_slug: string;
  song_key: string | null;
  entry_position: number | null;
  visibility: Visibility;
  body: string;
  created_by: string;
  created_at: string;
};

export function HitlistUpdatesPanel({ hitlistId, stationSlug, songKey = null, entryPosition = null }: {
  hitlistId: string;
  stationSlug: string;
  songKey?: string | null;
  entryPosition?: number | null;
}) {
  const client = useMemo(() => (isSupabaseBrowserConfigured() ? createClient() : null), []);
  const [rows, setRows] = useState<UpdateRow[]>([]);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("team");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (!client || !hitlistId) return;
    let q = client.from("hub_chart_updates").select("*").eq("hitlist_id", hitlistId).order("created_at", { ascending: false });
    q = songKey ? q.eq("song_key", songKey) : q.is("song_key", null);
    const { data, error: e } = await q;
    if (e) setError(e.message); else setRows((data || []) as UpdateRow[]);
  }

  useEffect(() => { void load(); }, [client, hitlistId, songKey]);

  async function add() {
    if (!client || !body.trim()) return;
    setBusy(true); setError("");
    try {
      const { data: auth } = await client.auth.getUser();
      if (!auth.user) throw new Error("Niet aangemeld");
      const { error: e } = await client.from("hub_chart_updates").insert({
        hitlist_id: hitlistId,
        station_slug: stationSlug,
        song_key: songKey,
        entry_position: entryPosition,
        visibility,
        body: body.trim(),
        created_by: auth.user.id,
      });
      if (e) throw e;
      setBody("");
      await load();
    } catch (caught) {
      setError((caught as { message?: string }).message || String(caught));
    } finally { setBusy(false); }
  }

  return <section className={styles.panel}>
    <div className={styles.head}>
      <div><strong>{songKey ? "Song-update / notitie" : "Editie-updates"}</strong><small>Updates kunnen privé, voor hitlijstbeheer of voor het hele stationsteam zijn.</small></div>
    </div>
    <div className={styles.composer}>
      <textarea value={body} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)} placeholder={songKey ? "Voeg een update over deze song toe…" : "Voeg een update over deze editie toe…"} />
      <div className={styles.row}>
        <select value={visibility} onChange={(e: ChangeEvent<HTMLSelectElement>) => setVisibility(e.target.value as Visibility)}>
          <option value="private">Privé · alleen ik</option>
          <option value="managers">Alleen hitlijstbeheer</option>
          <option value="team">Team</option>
        </select>
        <button disabled={busy || !body.trim()} onClick={() => void add()}>{busy ? "Opslaan…" : "Update toevoegen"}</button>
      </div>
    </div>
    {error && <div className={styles.error}>{error}</div>}
    <div className={styles.list}>{rows.map((row) => <article key={row.id}><div><span>{row.visibility === "private" ? "Privé" : row.visibility === "managers" ? "Hitlijstbeheer" : "Team"}</span><time>{new Date(row.created_at).toLocaleString("nl-BE")}</time></div><p>{row.body}</p></article>)}</div>
  </section>;
}

export default HitlistUpdatesPanel;
