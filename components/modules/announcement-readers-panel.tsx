"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient, isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import styles from "./announcement-readers-panel.module.css";

type Recipient = { announcement_id:string; user_id:string; delivered_at:string; first_read_at:string|null; last_read_at:string|null; acknowledged_at:string|null; profiles?: { display_name?:string|null; avatar_url?:string|null } | null };
type Vote = { poll_id:string; option_id:string; user_id:string };
type Reply = { id:string; announcement_id:string; recipient_user_id:string; sender_user_id:string; body:string; created_at:string; sender?: { display_name?:string|null } | null };

export function AnnouncementReadersPanel({ announcementId }: { announcementId: string }) {
  const client = useMemo(() => (isSupabaseBrowserConfigured() ? createClient() : null), []);
  const [recipients,setRecipients]=useState<Recipient[]>([]);
  const [votes,setVotes]=useState<Vote[]>([]);
  const [replies,setReplies]=useState<Reply[]>([]);
  const [selected,setSelected]=useState<string>("");
  const [reply,setReply]=useState("");
  const [me,setMe]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    if(!client||!announcementId)return;
    setBusy(true);setError("");
    const {data:u}=await client.auth.getUser();setMe(u.user?.id||"");
    const [r,v,m]=await Promise.all([
      client.from("hub_announcement_recipients").select("announcement_id,user_id,delivered_at,first_read_at,last_read_at,acknowledged_at,profiles:user_id(display_name,avatar_url)").eq("announcement_id",announcementId),
      client.from("hub_announcement_poll_votes").select("poll_id,option_id,user_id"),
      client.from("hub_announcement_replies").select("id,announcement_id,recipient_user_id,sender_user_id,body,created_at,sender:sender_user_id(display_name)").eq("announcement_id",announcementId).order("created_at"),
    ]);
    const e=r.error||v.error||m.error;if(e)setError(e.message);
    const rows=(r.data||[]) as unknown as Recipient[];setRecipients(rows);setVotes((v.data||[]) as Vote[]);setReplies((m.data||[]) as unknown as Reply[]);
    if(!selected&&rows[0])setSelected(rows[0].user_id);
    setBusy(false);
  },[client,announcementId,selected]);
  useEffect(()=>{void load();},[announcementId]);

  const read=recipients.filter(r=>r.first_read_at).length;
  const ack=recipients.filter(r=>r.acknowledged_at).length;
  const answered=new Set(votes.filter(v=>recipients.some(r=>r.user_id===v.user_id)).map(v=>v.user_id)).size;
  const selectedRecipient=recipients.find(r=>r.user_id===selected);
  const thread=replies.filter(r=>r.recipient_user_id===selected);

  async function sendReply(){
    if(!client||!selected||!me||!reply.trim())return;
    setBusy(true);
    const {error:e}=await client.from("hub_announcement_replies").insert({announcement_id:announcementId,recipient_user_id:selected,sender_user_id:me,body:reply.trim()});
    if(e)setError(e.message);else{setReply("");await load();}
    setBusy(false);
  }

  return <section className={styles.shell}>
    <div className={styles.toolbar}><b>Lezers & Polls</b><button type="button" onClick={()=>void load()} disabled={busy}>↻ Vernieuwen</button></div>
    {error&&<div className={styles.error}>{error}</div>}
    <div className={styles.layout}>
      <aside className={styles.left}>
        <div className={styles.stats}>
          <Stat n={recipients.length} label="Ontvangers" />
          <Stat n={read} label="Gelezen" accent="blue" />
          <Stat n={ack} label="Bevestigd" accent="green" />
          <Stat n={answered} label="Geantwoord" accent="purple" />
        </div>
        <div className={styles.people}>{recipients.map(r=>{
          const name=r.profiles?.display_name||"Onbekende gebruiker";const isRead=!!r.first_read_at;const isAck=!!r.acknowledged_at;const hasVote=votes.some(v=>v.user_id===r.user_id);
          return <button key={r.user_id} type="button" className={`${styles.person} ${selected===r.user_id?styles.active:""}`} onClick={()=>setSelected(r.user_id)}>
            <span className={`${styles.dot} ${isRead?styles.dotRead:""}`} />
            <span><strong>{name}</strong><small>{isAck?"✓ Bevestigd":hasVote?"✓ Geantwoord":isRead?"✓ Gelezen":"Ongelezen"}</small></span>
          </button>;
        })}</div>
      </aside>
      <main className={styles.right}>{selectedRecipient? <>
        <header><div><strong>{selectedRecipient.profiles?.display_name||"Ontvanger"}</strong><small>{selectedRecipient.first_read_at?`Gelezen ${new Date(selectedRecipient.first_read_at).toLocaleString("nl-BE")}`:"Nog niet gelezen"}</small></div></header>
        <div className={styles.thread}>{thread.length===0?<div className={styles.empty}>Nog geen gesprek met deze ontvanger.</div>:thread.map(m=><div key={m.id} className={`${styles.message} ${m.sender_user_id===me?styles.mine:""}`}><b>{m.sender?.display_name||"Gebruiker"}</b><p>{m.body}</p><small>{new Date(m.created_at).toLocaleString("nl-BE")}</small></div>)}</div>
        <div className={styles.composer}><textarea value={reply} onChange={e=>setReply(e.target.value)} placeholder="Stuur een reactie…"/><button type="button" onClick={()=>void sendReply()} disabled={busy||!reply.trim()}>Verstuur</button></div>
      </>:<div className={styles.emptyBig}>Selecteer een ontvanger om het gesprek te zien</div>}</main>
    </div>
  </section>;
}

function Stat({n,label,accent="black"}:{n:number;label:string;accent?:string}){return <div className={`${styles.stat} ${styles[accent]||""}`}><b>{n}</b><span>{label}</span></div>}

export default AnnouncementReadersPanel;
