"use client";

import { useCallback,useEffect,useMemo,useState } from "react";
import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import { useCollaboration } from "@/components/collaboration/collaboration-provider";
import { readHubStations } from "@/lib/hub-stations";
import { emitActivity } from "@/lib/collaboration/activity";
import { downloadAttachment,formatBytes,loadAttachmentsForEntities,uploadAttachments,type HubAttachment } from "@/lib/supabase/attachments";

type Person={id:string;name:string;email:string;role:string;jobTitle:string;initials:string};
type Channel={id:string;stationSlug:string;name:string;type:"direct"|"group"|"station";createdBy:string|null;memberIds:string[];createdAt:string;updatedAt:string};
type Message={id:string;channelId:string;senderId:string|null;senderName:string;text:string;createdAt:string;attachments:HubAttachment[]};

const initials=(name:string)=>(name||"T").split(/\s+/).filter(Boolean).map(x=>x[0]).slice(0,2).join("").toUpperCase()||"T";

export default function MessengerModule({stationSlug}:{stationSlug:string}){
  const collab=useCollaboration();
  const configured=isSupabaseBrowserConfigured();
  const[people,setPeople]=useState<Person[]>([]);
  const[channels,setChannels]=useState<Channel[]>([]);
  const[messages,setMessages]=useState<Message[]>([]);
  const[selectedId,setSelectedId]=useState("");
  const[search,setSearch]=useState("");
  const[draft,setDraft]=useState("");
  const[draftFiles,setDraftFiles]=useState<File[]>([]);
  const[notice,setNotice]=useState("");
  const[busy,setBusy]=useState(false);
  const[showCreate,setShowCreate]=useState(false);
  const[newType,setNewType]=useState<Channel["type"]>("direct");
  const[newName,setNewName]=useState("");
  const[newStation,setNewStation]=useState(stationSlug==="all"?"all":stationSlug);
  const[newMembers,setNewMembers]=useState<string[]>([]);
  const stations=useMemo(()=>readHubStations(),[]);

  function flash(text:string){setNotice(text);window.setTimeout(()=>setNotice(""),2600)}

  const loadPeople=useCallback(async()=>{
    if(!configured)return;
    const supabase=createClient();
    const[{data:profiles,error:pError},{data:memberships,error:mError}]=await Promise.all([
      supabase.from("profiles").select("id,display_name,email,role,job_title,active").eq("active",true).order("display_name"),
      supabase.from("station_memberships").select("user_id,station_slug,active").eq("active",true)
    ]);
    if(pError)throw pError;if(mError)throw mError;
    const stationMembers=new Set((memberships||[]).filter((m:any)=>newStation==="all"||String(m.station_slug)===newStation).map((m:any)=>String(m.user_id)));
    const hasScoped=newStation!=="all"&&stationMembers.size>0;
    const rows=(profiles||[]).filter((p:any)=>newStation==="all"||String(p.role).toLowerCase()==="superadmin"||!hasScoped||stationMembers.has(String(p.id))).map((p:any)=>({
      id:String(p.id),name:String(p.display_name||p.email||"Teamlid"),email:String(p.email||""),role:String(p.role||"team"),jobTitle:String(p.job_title||""),initials:initials(String(p.display_name||p.email||"T"))
    }));
    setPeople(rows);
  },[configured,newStation]);

  const loadChannels=useCallback(async()=>{
    if(!configured||!collab.currentUser)return;
    const supabase=createClient();
    let query=supabase.from("hub_chat_channels").select("id,station_slug,name,channel_type,created_by,created_at,updated_at").order("updated_at",{ascending:false});
    if(stationSlug!=="all")query=query.in("station_slug",[stationSlug,"all"]);
    const{data:rows,error}=await query;if(error)throw error;
    const ids=(rows||[]).map((r:any)=>String(r.id));
    let memberRows:any[]=[];
    if(ids.length){
      const{data,error:mError}=await supabase.from("hub_chat_members").select("channel_id,user_id").in("channel_id",ids);
      if(mError)throw mError;memberRows=data||[];
    }
    const membersBy=new Map<string,string[]>();
    for(const m of memberRows){const id=String(m.channel_id),arr=membersBy.get(id)||[];arr.push(String(m.user_id));membersBy.set(id,arr)}
    const activeIds=new Set(people.map(p=>p.id));
    const mapped=(rows||[]).map((r:any)=>({
      id:String(r.id),stationSlug:String(r.station_slug||"all"),name:String(r.name||""),type:String(r.channel_type) as Channel["type"],
      createdBy:r.created_by?String(r.created_by):null,memberIds:membersBy.get(String(r.id))||[],createdAt:String(r.created_at),updatedAt:String(r.updated_at)
    })).filter((c:Channel)=>{
      if(c.type!=="direct")return true;
      const other=c.memberIds.find(id=>id!==collab.currentUser?.id);
      return Boolean(other&&activeIds.has(other));
    });
    setChannels(mapped);
    setSelectedId(current=>mapped.some(c=>c.id===current)?current:mapped[0]?.id||"");
  },[configured,stationSlug,collab.currentUser?.id,people]);

  const loadMessages=useCallback(async(channelId:string)=>{
    if(!configured||!channelId){setMessages([]);return}
    const supabase=createClient();
    const{data:rows,error}=await supabase.from("hub_chat_messages").select("id,channel_id,sender_id,content,created_at").eq("channel_id",channelId).order("created_at",{ascending:true}).limit(250);
    if(error)throw error;
    const names=new Map(people.map(p=>[p.id,p.name]));
    const ids=(rows||[]).map((r:any)=>String(r.id));
    let attachmentMap:Record<string,HubAttachment[]>={};
    try{attachmentMap=await loadAttachmentsForEntities("chat_message",ids)}catch{}
    setMessages((rows||[]).map((r:any)=>({
      id:String(r.id),channelId:String(r.channel_id),senderId:r.sender_id?String(r.sender_id):null,
      senderName:r.sender_id?names.get(String(r.sender_id))||"Verwijderde gebruiker":"Verwijderde gebruiker",
      text:String(r.content||""),createdAt:String(r.created_at),attachments:attachmentMap[String(r.id)]||[]
    })));
  },[configured,people]);

  useEffect(()=>{
    try{
      for(let i=localStorage.length-1;i>=0;i--){
        const key=localStorage.key(i);
        if(key?.includes(":messenger:")&&key.includes(":v4"))localStorage.removeItem(key);
      }
    }catch{}
  },[]);
  useEffect(()=>{void loadPeople().catch(e=>flash(e instanceof Error?e.message:"Gebruikers laden mislukt"))},[loadPeople]);
  useEffect(()=>{void loadChannels().catch(e=>flash(e instanceof Error?e.message:"Gesprekken laden mislukt"))},[loadChannels]);
  useEffect(()=>{void loadMessages(selectedId).catch(()=>{})},[selectedId,loadMessages]);

  useEffect(()=>{
    if(!configured)return;
    const supabase=createClient();
    const channel=supabase.channel(`vlacora-chat-${stationSlug}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"hub_chat_channels"},()=>void loadChannels())
      .on("postgres_changes",{event:"*",schema:"public",table:"hub_chat_members"},()=>{void loadPeople();void loadChannels()})
      .on("postgres_changes",{event:"*",schema:"public",table:"hub_chat_messages"},(payload:any)=>{
        const row=payload.new||payload.old;
        if(String(row?.channel_id||"")===selectedId)void loadMessages(selectedId);
      }).subscribe();
    return()=>{void supabase.removeChannel(channel)};
  },[configured,stationSlug,selectedId,loadPeople,loadChannels,loadMessages]);

  const selected=channels.find(c=>c.id===selectedId)||null;
  const personMap=useMemo(()=>new Map(people.map(p=>[p.id,p])),[people]);
  const presenceMap=useMemo(()=>new Map(collab.presence.map(p=>[p.userId,p])),[collab.presence]);
  const channelName=(c:Channel)=>{
    if(c.type==="direct"){
      const other=c.memberIds.find(id=>id!==collab.currentUser?.id);
      return other?personMap.get(other)?.name||"Verwijderde gebruiker":"Privé";
    }
    return c.name||"Gesprek";
  };
  const channelMembers=(c:Channel)=>{
    if(c.type==="station")return `Iedereen met toegang tot ${stations.find(s=>s.slug===c.stationSlug)?.name||c.stationSlug}`;
    return c.memberIds.map(id=>personMap.get(id)?.name).filter(Boolean).join(" • ");
  };
  const visible=channels.filter(c=>channelName(c).toLowerCase().includes(search.toLowerCase()));

  async function create(){
    if(!collab.currentUser)return;
    const selectedMembers=newMembers.filter(id=>people.some(p=>p.id===id));
    if(newType==="direct"&&selectedMembers.length!==1)return flash("Kies precies één echte gebruiker.");
    if(newType==="group"&&!newName.trim())return flash("Geef de groep een naam.");
    setBusy(true);
    try{
      const supabase=createClient();
      const name=newType==="direct"?"":newType==="station"?(newName.trim()||`${stations.find(s=>s.slug===newStation)?.name||"Station"} team`):newName.trim();
      const{data:row,error}=await supabase.from("hub_chat_channels").insert({station_slug:newStation,name,channel_type:newType,created_by:collab.currentUser.id}).select("*").single();
      if(error)throw error;
      if(newType!=="station"){
        const ids=[...new Set([collab.currentUser.id,...selectedMembers])];
        const{error:mError}=await supabase.from("hub_chat_members").insert(ids.map(userId=>({channel_id:row.id,user_id:userId})));
        if(mError)throw mError;
      }
      setShowCreate(false);setNewName("");setNewMembers([]);setSelectedId(String(row.id));await loadChannels();flash("Gesprek aangemaakt");
    }catch(e){flash(e instanceof Error?e.message:"Gesprek aanmaken mislukt")}
    finally{setBusy(false)}
  }

  async function send(){
    if(!selected||(!draft.trim()&&!draftFiles.length)||!collab.currentUser)return;
    const text=draft.trim();const files=[...draftFiles];setDraft("");setDraftFiles([]);
    try{
      const{data,error}=await createClient().from("hub_chat_messages").insert({channel_id:selected.id,sender_id:collab.currentUser.id,content:text||"📎 Bijlage"}).select("id").single();
      if(error)throw error;
      if(files.length)await uploadAttachments(selected.stationSlug||stationSlug,"chat_message",String(data.id),files);
      emitActivity({detail:`Messenger • ${channelName(selected)}`,entityType:"chat",entityId:selected.id});
      await loadMessages(selected.id);
    }catch(e){setDraft(text);setDraftFiles(files);flash(e instanceof Error?e.message:"Bericht versturen mislukt")}
  }

  async function removeChannel(){
    if(!selected)return;
    if(!confirm(`Gesprek “${channelName(selected)}” verwijderen?`))return;
    try{
      const{error}=await createClient().from("hub_chat_channels").delete().eq("id",selected.id);
      if(error)throw error;setSelectedId("");await loadChannels();flash("Gesprek verwijderd");
    }catch(e){flash(e instanceof Error?e.message:"Verwijderen mislukt")}
  }

  if(!configured)return <div className="card empty-live-state"><strong>Messenger vereist Supabase-login</strong><span>Demo-gebruikers worden niet meer gebruikt.</span></div>;

  return <div className="messenger messenger-v182">
    <div className="channels">
      <div className="module-title-row"><div><h3>Messenger</h3><small>Alleen echte, actieve VLACORA-gebruikers</small></div><button className="primary tiny-btn" onClick={()=>setShowCreate(v=>!v)}>＋</button></div>
      <input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Zoek gesprek…"/>
      {showCreate&&<div className="channel-create-v4">
        <div className="two-form-cols"><label className="field">Type<select className="select" value={newType} onChange={e=>setNewType(e.target.value as Channel["type"])}><option value="direct">Privé</option><option value="group">Groep</option><option value="station">Stationkanaal</option></select></label><label className="field">Station<select className="select" value={newStation} onChange={e=>setNewStation(e.target.value)}>{stations.map(s=><option value={s.slug} key={s.slug}>{s.name}</option>)}</select></label></div>
        {newType!=="direct"&&<label className="field">Naam<input className="input" value={newName} onChange={e=>setNewName(e.target.value)} placeholder={newType==="station"?"bv. Versuz team":"bv. Muziekredactie"}/></label>}
        {newType!=="station"&&<><div className="member-picker-head"><strong>{newType==="direct"?"Kies gebruiker":"Leden"}</strong><button className="ghost small-action" onClick={()=>void loadPeople()}>↻ Echte gebruikers vernieuwen</button></div><div className="member-picker">{people.filter(p=>p.id!==collab.currentUser?.id).map(p=><label className={`member-chip ${newMembers.includes(p.id)?"selected":""}`} key={p.id}><input type={newType==="direct"?"radio":"checkbox"} checked={newMembers.includes(p.id)} onChange={()=>setNewMembers(newType==="direct"?[p.id]:newMembers.includes(p.id)?newMembers.filter(x=>x!==p.id):[...newMembers,p.id])}/><span>{p.name}{presenceMap.has(p.id)?" • online":""}</span></label>)}</div></>}
        <div className="button-row"><button className="primary" disabled={busy} onClick={()=>void create()}>Aanmaken</button><button className="ghost" onClick={()=>setShowCreate(false)}>Annuleren</button></div>
      </div>}
      {notice&&<div className="inline-notice">{notice}</div>}
      <div className="channel-list">{visible.map(c=><button key={c.id} onClick={()=>{setSelectedId(c.id);emitActivity({detail:`Messenger • ${channelName(c)}`,entityType:"chat",entityId:c.id})}} className={`channel ${selectedId===c.id?"selected":""}`}><span className="channel-avatar">{c.type==="direct"?initials(channelName(c)):c.type==="station"?"◉":"✉"}</span><div><strong>{c.type==="station"?"#":""}{channelName(c)}</strong><small>{stations.find(s=>s.slug===c.stationSlug)?.name||"Alle zenders"} • {c.type==="direct"?"privé":c.type==="station"?"station":`${c.memberIds.length} leden`}</small></div></button>)}</div>
      {!visible.length&&<div className="empty-live-state compact"><strong>Nog geen echte gesprekken</strong><span>Oude demo-kanalen en verwijderde gebruikers worden bewust niet meer getoond.</span></div>}
    </div>
    <div className="chat">{selected?<><div className="chat-head"><div><strong>{selected.type==="station"?"#":""}{channelName(selected)}</strong><small>{channelMembers(selected)}</small></div><div className="button-row"><button className="ghost" onClick={()=>void loadPeople().then(()=>loadChannels())}>↻ Gebruikers</button><button className="ghost danger-text" onClick={()=>void removeChannel()}>Verwijder</button></div></div>
      <div className="messages">{messages.map(m=>{const mine=m.senderId===collab.currentUser?.id;return <div className={`message ${mine?"mine":""}`} key={m.id}><div className="avatar small">{initials(m.senderName)}</div><div><div className="message-meta"><strong>{m.senderName}</strong><span>{new Date(m.createdAt).toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit"})}</span></div><p>{m.text}</p></div></div>})}{!messages.length&&<div className="empty-chat"><strong>Nog geen berichten</strong><span>Stuur het eerste bericht.</span></div>}</div>
      <div className="composer composer-with-files"><label className="ghost file-button">📎<input type="file" multiple hidden onChange={e=>setDraftFiles(Array.from(e.target.files||[]))}/></label><input className="input grow" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void send()}}} placeholder={`Bericht naar ${channelName(selected)}…`}/><button className="primary" onClick={()=>void send()}>Verstuur</button>{draftFiles.length>0&&<div className="composer-file-preview">{draftFiles.map((f,i)=><span key={`${f.name}-${i}`}>{f.name}<button onClick={()=>setDraftFiles(draftFiles.filter((_,j)=>j!==i))}>×</button></span>)}</div>}</div></>:<div className="empty-chat"><strong>Kies een gesprek</strong><span>De gebruikerslijst komt live uit Supabase profiles.</span></div>}</div>
  </div>;
}
