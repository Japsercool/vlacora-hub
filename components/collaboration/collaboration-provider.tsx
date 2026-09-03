"use client";

import {
  createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode
} from "react";
import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import { VLACORA_ACTIVITY_EVENT,type ActivitySignal } from "@/lib/collaboration/activity";

export type NotificationSeverity="info"|"warning"|"critical";
export type HubNotification={
  id:string;
  stationSlug:string|null;
  title:string;
  body:string;
  category:string;
  severity:NotificationSeverity;
  requiresAck:boolean;
  actionPath:string;
  createdAt:string;
  createdBy:string;
  recipientUserId:string|null;
  seenAt:string|null;
  acknowledgedAt:string|null;
  source:"supabase"|"local";
};
export type PresencePerson={
  key:string;
  userId:string;
  name:string;
  email:string;
  initials:string;
  role:string;
  stationSlug:string;
  moduleSlug:string;
  moduleLabel:string;
  detail:string;
  entityType:string;
  entityId:string;
  onlineAt:string;
  isMe:boolean;
};

type PublishInput={
  stationSlug?:string|null;
  title:string;
  body?:string;
  category?:string;
  severity?:NotificationSeverity;
  requiresAck?:boolean;
  actionPath?:string;
  recipientUserId?:string|null;
};

type CollaborationContextValue={
  configured:boolean;
  currentUser:{id:string;name:string;email:string;role:string}|null;
  presence:PresencePerson[];
  notifications:HubNotification[];
  unreadCount:number;
  requiredCount:number;
  mandatoryNotification:HubNotification|null;
  notificationsOpen:boolean;
  presenceOpen:boolean;
  openNotifications:()=>void;
  closeNotifications:()=>void;
  openPresence:()=>void;
  closePresence:()=>void;
  markSeen:(id:string)=>Promise<void>;
  acknowledge:(id:string)=>Promise<void>;
  markAllSeen:()=>Promise<void>;
  publishNotification:(input:PublishInput)=>Promise<void>;
};

const CollaborationContext=createContext<CollaborationContextValue|null>(null);

const MODULES:Record<string,string>={
  dashboard:"TODAY","voor-mij":"Voor mij","mijn-uitzending":"Mijn uitzending",stations:"Stations",meldingen:"Meldingen",taken:"Taken",meldpunt:"Meldpunt",aanvragen:"Aanvragen","content-inbox":"Content-inbox",
  messenger:"Messenger",communicatie:"Communicatie",kalender:"Kalender",
  programmering:"Programmering",programmas:"Programma-pagina's",afwezigheden:"Afwezigheden",contacten:"Contacten",sjablonen:"Sjablonen",muziek:"Muziek",meetings:"Muziekmeeting",redactie:"Redactie",verkeer:"Verkeer",
  hitlijsten:"Hitlijsten","hitlijst-beheer":"Hitlijstbeheer",presentatie:"Presentatie",social:"Social Studio","social-beheer":"Social beheer","social-templatebouwer":"Templatebouwer",team:"Team",beheer:"Beheer"
};
const LOCAL_NOTIFICATIONS="vlacora:collaboration:notifications:v13";
const LOCAL_RECEIPTS="vlacora:collaboration:receipts:v13";
const LOCAL_PRESENCE_CHANNEL="vlacora:presence:v13";
const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);

function initials(name:string){
  return (name||"V").split(/\s+/).filter(Boolean).map(x=>x[0]).slice(0,2).join("").toUpperCase()||"V";
}
function safeRead<T>(key:string,fallback:T):T{
  try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}
}
function safeWrite(key:string,value:unknown){
  try{localStorage.setItem(key,JSON.stringify(value))}catch{}
}
function mapNotification(row:any,receipt:any,source:"supabase"|"local"):HubNotification{
  return {
    id:String(row.id),
    stationSlug:row.station_slug==null?null:String(row.station_slug),
    title:String(row.title||"Melding"),
    body:String(row.body||""),
    category:String(row.category||"Algemeen"),
    severity:(["info","warning","critical"].includes(String(row.severity))?row.severity:"info") as NotificationSeverity,
    requiresAck:Boolean(row.requires_acknowledgement),
    actionPath:String(row.action_path||""),
    createdAt:String(row.created_at||new Date().toISOString()),
    createdBy:String(row.created_by||""),
    recipientUserId:row.recipient_user_id==null?null:String(row.recipient_user_id),
    seenAt:receipt?.seen_at?String(receipt.seen_at):null,
    acknowledgedAt:receipt?.acknowledged_at?String(receipt.acknowledged_at):null,
    source
  };
}

export function CollaborationProvider({
  stationSlug,moduleSlug,children
}:{stationSlug:string;moduleSlug:string;children:ReactNode}){
  const configured=isSupabaseBrowserConfigured();
  const [currentUser,setCurrentUser]=useState<{id:string;name:string;email:string;role:string}|null>(null);
  const [presence,setPresence]=useState<PresencePerson[]>([]);
  const [notifications,setNotifications]=useState<HubNotification[]>([]);
  const [notificationsOpen,setNotificationsOpen]=useState(false);
  const [presenceOpen,setPresenceOpen]=useState(false);
  const [activityDetail,setActivityDetail]=useState("");
  const [activityEntityType,setActivityEntityType]=useState("");
  const [activityEntityId,setActivityEntityId]=useState("");
  const supabaseRef=useRef<any>(null);
  const channelRef=useRef<any>(null);
  const localChannelRef=useRef<BroadcastChannel|null>(null);
  const localPresenceRef=useRef<Record<string,PresencePerson>>({});
  const sessionKeyRef=useRef(`local-${uid()}`);

  const moduleLabel=MODULES[moduleSlug]||moduleSlug;
  const activityPayload=useMemo(()=>({
    stationSlug,moduleSlug,moduleLabel,
    detail:activityDetail||moduleLabel,
    entityType:activityEntityType,
    entityId:activityEntityId
  }),[stationSlug,moduleSlug,moduleLabel,activityDetail,activityEntityType,activityEntityId]);

  useEffect(()=>{setActivityDetail("");setActivityEntityType("");setActivityEntityId("")},[moduleSlug,stationSlug]);
  useEffect(()=>{
    const handler=(event:Event)=>{
      const signal=(event as CustomEvent<ActivitySignal>).detail;
      if(signal?.detail)setActivityDetail(signal.detail);
      setActivityEntityType(signal?.entityType||"");
      setActivityEntityId(signal?.entityId||"");
    };
    window.addEventListener(VLACORA_ACTIVITY_EVENT,handler);
    return()=>window.removeEventListener(VLACORA_ACTIVITY_EVENT,handler);
  },[]);

  const loadLocalNotifications=useCallback((userId="local-user")=>{
    const rows=safeRead<any[]>(LOCAL_NOTIFICATIONS,[]);
    const receipts=safeRead<Record<string,{seen_at?:string;acknowledged_at?:string}>>(LOCAL_RECEIPTS,{});
    const filtered=rows
      .filter(row=>(!row.station_slug||row.station_slug==="all"||stationSlug==="all"||row.station_slug===stationSlug))
      .filter(row=>!row.recipient_user_id||row.recipient_user_id===userId)
      .map(row=>mapNotification(row,receipts[row.id],"local"))
      .sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
      .slice(0,100);
    setNotifications(filtered);
  },[stationSlug]);

  const loadRemoteNotifications=useCallback(async(userId:string)=>{
    const supabase=supabaseRef.current;
    if(!supabase)return;
    const {data:rows,error}=await supabase.from("hub_notifications")
      .select("id,station_slug,title,body,category,severity,requires_acknowledgement,action_path,created_at,created_by,recipient_user_id")
      .order("created_at",{ascending:false}).limit(100);
    if(error)throw error;
    const {data:receipts,error:receiptError}=await supabase.from("hub_notification_receipts")
      .select("notification_id,seen_at,acknowledged_at").eq("user_id",userId);
    if(receiptError)throw receiptError;
    const receiptMap=new Map((receipts||[]).map((r:any)=>[String(r.notification_id),r]));
    const filtered=(rows||[])
      .filter((row:any)=>(!row.station_slug||row.station_slug==="all"||stationSlug==="all"||row.station_slug===stationSlug))
      .filter((row:any)=>!row.recipient_user_id||String(row.recipient_user_id)===userId)
      .map((row:any)=>mapNotification(row,receiptMap.get(String(row.id)),"supabase"));
    setNotifications(filtered);
  },[stationSlug]);

  // Real Supabase collaboration: one channel combines Presence + postgres changes.
  useEffect(()=>{
    let cancelled=false;
    if(!configured){
      const user={id:"local-user",name:"Setup gebruiker",email:"",role:"setup"};
      setCurrentUser(user);
      loadLocalNotifications(user.id);
      return;
    }
    const supabase=createClient();
    supabaseRef.current=supabase;
    (async()=>{
      const {data:userData}=await supabase.auth.getUser();
      if(cancelled||!userData.user)return;
      const user=userData.user;
      let displayName=String(user.user_metadata?.display_name||user.email?.split("@")[0]||"VLACORA gebruiker");
      let role="redactie";
      try{
        const {data:profile}=await supabase.from("profiles").select("display_name,role").eq("id",user.id).maybeSingle();
        if(profile?.display_name)displayName=String(profile.display_name);
        if(profile?.role)role=String(profile.role);
      }catch{}
      const me={id:user.id,name:displayName,email:user.email||"",role};
      setCurrentUser(me);
      void (async()=>{try{await supabase.rpc("vlacora_touch_last_seen")}catch{}})();
      await loadRemoteNotifications(user.id).catch(()=>loadLocalNotifications(user.id));

      const channel:any=supabase.channel("vlacora-collaboration-v13",{config:{presence:{key:user.id}}});
      channelRef.current=channel;

      const syncPresence=()=>{
        const state=channel.presenceState()||{};
        const people:PresencePerson[]=[];
        Object.entries(state).forEach(([key,values]:any)=>{
          (Array.isArray(values)?values:[]).forEach((value:any)=>{
            people.push({
              key:String(key),userId:String(value.userId||key),name:String(value.name||"Gebruiker"),
              email:String(value.email||""),initials:String(value.initials||initials(value.name||"V")),
              role:String(value.role||""),stationSlug:String(value.stationSlug||"all"),
              moduleSlug:String(value.moduleSlug||"dashboard"),moduleLabel:String(value.moduleLabel||"HUB"),
              detail:String(value.detail||value.moduleLabel||"HUB"),
              entityType:String(value.entityType||""),entityId:String(value.entityId||""),
              onlineAt:String(value.onlineAt||new Date().toISOString()),
              isMe:String(value.userId||key)===user.id
            });
          });
        });
        setPresence(people.sort((a,b)=>Number(b.isMe)-Number(a.isMe)||a.name.localeCompare(b.name)));
      };

      channel
        .on("presence",{event:"sync"},syncPresence)
        .on("presence",{event:"join"},syncPresence)
        .on("presence",{event:"leave"},syncPresence)
        .on("postgres_changes",{event:"*",schema:"public",table:"hub_notifications"},()=>loadRemoteNotifications(user.id))
        .on("postgres_changes",{event:"*",schema:"public",table:"hub_notification_receipts",filter:`user_id=eq.${user.id}`},()=>loadRemoteNotifications(user.id))
        .subscribe(async(status:string)=>{
          if(status==="SUBSCRIBED"){
            await channel.track({
              userId:user.id,name:displayName,email:user.email||"",initials:initials(displayName),role,
              stationSlug,moduleSlug,moduleLabel,detail:moduleLabel,onlineAt:new Date().toISOString()
            });
          }
        });
    })().catch(()=>{});
    return()=>{
      cancelled=true;
      try{if(channelRef.current)supabase.removeChannel(channelRef.current)}catch{}
      channelRef.current=null;
      supabaseRef.current=null;
    };
  },[configured,loadLocalNotifications,loadRemoteNotifications]);

  // Track route / selected entity changes without polling.
  useEffect(()=>{
    const channel=channelRef.current;
    if(!channel||!currentUser||currentUser.id==="local-user")return;
    channel.track({
      userId:currentUser.id,name:currentUser.name,email:currentUser.email,initials:initials(currentUser.name),role:currentUser.role,
      ...activityPayload,onlineAt:new Date().toISOString()
    }).catch(()=>{});
  },[activityPayload,currentUser]);

  // Local same-browser fallback. No server polling.
  useEffect(()=>{
    if(configured||!currentUser)return;
    if(typeof BroadcastChannel==="undefined")return;
    const bc=new BroadcastChannel(LOCAL_PRESENCE_CHANNEL);
    localChannelRef.current=bc;
    const key=sessionKeyRef.current;
    const publish=()=>{
      const person:PresencePerson={
        key,userId:key,name:currentUser.name,email:currentUser.email,initials:initials(currentUser.name),role:currentUser.role,
        ...activityPayload,onlineAt:new Date().toISOString(),isMe:true
      };
      localPresenceRef.current[key]=person;
      setPresence(Object.values(localPresenceRef.current));
      bc.postMessage({type:"presence",person});
    };
    bc.onmessage=(e)=>{
      if(e.data?.type==="presence"&&e.data.person){
        const p=e.data.person as PresencePerson;
        localPresenceRef.current[p.key]={...p,isMe:p.key===key};
        setPresence(Object.values(localPresenceRef.current));
      }
      if(e.data?.type==="leave"&&e.data.key){
        delete localPresenceRef.current[String(e.data.key)];
        setPresence(Object.values(localPresenceRef.current));
      }
      if(e.data?.type==="notifications")loadLocalNotifications(currentUser.id);
    };
    publish();
    const timer=window.setInterval(publish,30000);
    return()=>{
      window.clearInterval(timer);
      try{bc.postMessage({type:"leave",key});bc.close()}catch{}
      localChannelRef.current=null;
      delete localPresenceRef.current[key];
    };
  },[configured,currentUser,activityPayload,loadLocalNotifications]);

  const markSeen=useCallback(async(id:string)=>{
    const now=new Date().toISOString();
    if(configured&&currentUser&&currentUser.id!=="local-user"&&supabaseRef.current){
      await supabaseRef.current.from("hub_notification_receipts").upsert(
        {notification_id:id,user_id:currentUser.id,seen_at:now},
        {onConflict:"notification_id,user_id"}
      );
      await loadRemoteNotifications(currentUser.id);
      return;
    }
    const receipts=safeRead<Record<string,any>>(LOCAL_RECEIPTS,{});
    receipts[id]={...(receipts[id]||{}),seen_at:now};
    safeWrite(LOCAL_RECEIPTS,receipts);
    loadLocalNotifications(currentUser?.id||"local-user");
  },[configured,currentUser,loadLocalNotifications,loadRemoteNotifications]);

  const acknowledge=useCallback(async(id:string)=>{
    const now=new Date().toISOString();
    if(configured&&currentUser&&currentUser.id!=="local-user"&&supabaseRef.current){
      await supabaseRef.current.from("hub_notification_receipts").upsert(
        {notification_id:id,user_id:currentUser.id,seen_at:now,acknowledged_at:now},
        {onConflict:"notification_id,user_id"}
      );
      await loadRemoteNotifications(currentUser.id);
      return;
    }
    const receipts=safeRead<Record<string,any>>(LOCAL_RECEIPTS,{});
    receipts[id]={...(receipts[id]||{}),seen_at:now,acknowledged_at:now};
    safeWrite(LOCAL_RECEIPTS,receipts);
    loadLocalNotifications(currentUser?.id||"local-user");
  },[configured,currentUser,loadLocalNotifications,loadRemoteNotifications]);

  const markAllSeen=useCallback(async()=>{
    const unread=notifications.filter(n=>!n.seenAt);
    for(const item of unread)await markSeen(item.id);
  },[notifications,markSeen]);

  const publishNotification=useCallback(async(input:PublishInput)=>{
    const row={
      station_slug:input.stationSlug===undefined?stationSlug:input.stationSlug,
      title:input.title.trim(),body:(input.body||"").trim(),category:input.category||"Algemeen",
      severity:input.severity||"info",requires_acknowledgement:Boolean(input.requiresAck),
      action_path:input.actionPath||"",recipient_user_id:input.recipientUserId||null,
      created_by:currentUser&&currentUser.id!=="local-user"?currentUser.id:null,
      created_at:new Date().toISOString()
    };
    if(configured&&currentUser&&currentUser.id!=="local-user"&&supabaseRef.current){
      const {error}=await supabaseRef.current.from("hub_notifications").insert(row);
      if(error)throw error;
      await loadRemoteNotifications(currentUser.id);
      return;
    }
    const rows=safeRead<any[]>(LOCAL_NOTIFICATIONS,[]);
    rows.unshift({id:`local-${uid()}`,...row});
    safeWrite(LOCAL_NOTIFICATIONS,rows.slice(0,100));
    loadLocalNotifications(currentUser?.id||"local-user");
    try{localChannelRef.current?.postMessage({type:"notifications"})}catch{}
  },[configured,currentUser,stationSlug,loadLocalNotifications,loadRemoteNotifications]);

  const unreadCount=notifications.filter(n=>!n.seenAt).length;
  const requiredCount=notifications.filter(n=>n.requiresAck&&!n.acknowledgedAt).length;
  const mandatoryNotification=notifications.find(n=>n.requiresAck&&!n.acknowledgedAt)||null;

  const value=useMemo<CollaborationContextValue>(()=>({
    configured,currentUser,presence,notifications,unreadCount,requiredCount,mandatoryNotification,
    notificationsOpen,presenceOpen,
    openNotifications:()=>setNotificationsOpen(true),closeNotifications:()=>setNotificationsOpen(false),
    openPresence:()=>setPresenceOpen(true),closePresence:()=>setPresenceOpen(false),
    markSeen,acknowledge,markAllSeen,publishNotification
  }),[
    configured,currentUser,presence,notifications,unreadCount,requiredCount,mandatoryNotification,
    notificationsOpen,presenceOpen,markSeen,acknowledge,markAllSeen,publishNotification
  ]);

  return <CollaborationContext.Provider value={value}>{children}</CollaborationContext.Provider>;
}

export function useCollaboration(){
  const value=useContext(CollaborationContext);
  if(!value)throw new Error("useCollaboration must be used inside CollaborationProvider");
  return value;
}
