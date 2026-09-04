"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { createClient, isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import styles from "./admin-request-thread.module.css";

type Visibility = "requester" | "internal" | "team";
type UpdateRow = { id:string; request_id:string; station_slug:string; body:string; visibility:Visibility; created_by:string; created_at:string };

export function AdminRequestThread({ requestId, stationSlug, canManage = false }: { requestId:string; stationSlug:string; canManage?:boolean }) {
  const client = useMemo(() => (isSupabaseBrowserConfigured() ? createClient() : null), []);
  const [rows,setRows]=useState<UpdateRow[]>([]);
  const [body,setBody]=useState("");
  const [visibility,setVisibility]=useState<Visibility>("requester");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  async function load(){
    if(!client||!requestId)return;
    const {data,error:e}=await client.from("hub_admin_request_updates").select("*").eq("request_id",requestId).order("created_at",{ascending:true});
    if(e)setError(e.message);else setRows((data||[]) as UpdateRow[]);
  }
  useEffect(()=>{void load()},[client,requestId]);

  async function send(){
    if(!client||!body.trim())return;
    setBusy(true);setError("");
    try{
      const {data:auth}=await client.auth.getUser();
      if(!auth.user)throw new Error("Niet aangemeld");
      const chosen=canManage?visibility:"requester";
      const {error:e}=await client.from("hub_admin_request_updates").insert({request_id:requestId,station_slug:stationSlug,body:body.trim(),visibility:chosen,created_by:auth.user.id});
      if(e)throw e;
      setBody("");await load();
    }catch(caught){setError((caught as {message?:string}).message||String(caught))}finally{setBusy(false)}
  }

  return <section className={styles.panel}>
    <div className={styles.head}><div><strong>Updates & gesprek</strong><small>Privé antwoord naar de aanvrager of een interne beheerupdate.</small></div></div>
    <div className={styles.timeline}>{rows.map(row=><article key={row.id}><div><span>{row.visibility==="requester"?"Privé met aanvrager":row.visibility==="internal"?"Alleen beheer":"Team"}</span><time>{new Date(row.created_at).toLocaleString("nl-BE")}</time></div><p>{row.body}</p></article>)}</div>
    <textarea value={body} onChange={(e:ChangeEvent<HTMLTextAreaElement>)=>setBody(e.target.value)} placeholder={canManage?"Geef een update of antwoord…":"Antwoord op je aanvraag…"}/>
    <div className={styles.actions}>{canManage&&<select value={visibility} onChange={(e:ChangeEvent<HTMLSelectElement>)=>setVisibility(e.target.value as Visibility)}><option value="requester">Privé naar aanvrager</option><option value="internal">Interne beheerupdate</option><option value="team">Zichtbaar voor team</option></select>}<button onClick={()=>void send()} disabled={busy||!body.trim()}>{busy?"Versturen…":"Update versturen"}</button></div>
    {error&&<div className={styles.error}>{error}</div>}
  </section>
}

export default AdminRequestThread;
