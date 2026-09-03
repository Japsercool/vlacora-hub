"use client";

import { createClient,isSupabaseBrowserConfigured } from "@/lib/supabase/client";

export type BrandKit={
  station_slug:string;
  brand_name:string;
  logo_url:string;
  primary_color:string;
  secondary_color:string;
  accent_color:string;
  background_color:string;
  text_color:string;
  font_family:string;
  default_cta:string;
  default_hashtags:string;
};

export type SocialTemplate={
  id:string;
  station_slug:string;
  name:string;
  content_type:string;
  aspect_ratio:string;
  caption_template:string;
  config:Record<string,unknown>;
  active:boolean;
  created_at?:string;
  updated_at?:string;
};

export type SocialPost={
  id:string;
  station_slug:string;
  template_id:string|null;
  title:string;
  status:"concept"|"review"|"approved"|"published"|"archived";
  format:string;
  payload:Record<string,unknown>;
  caption:string;
  scheduled_at:string|null;
  published_at:string|null;
  review_requested_at?:string|null;
  approved_at?:string|null;
  approved_by?:string|null;
  changes_requested_at?:string|null;
  platforms?:string[];
  campaign?:string;
  content_pillar?:string;
  objective?:string;
  assigned_to?:string|null;
  reviewer_id?:string|null;
  due_at?:string|null;
  publication_url?:string;
  internal_notes?:string;
  checklist?:Record<string,boolean>;
  created_at?:string;
  updated_at?:string;
};

export type SocialPerson={id:string;name:string;email:string};

export type SocialCopyBlock={
  id:string;
  station_slug:string;
  name:string;
  category:string;
  content:string;
  active:boolean;
  created_at?:string;
  updated_at?:string;
};

export type SocialReviewEvent={
  id:string;
  post_id:string;
  station_slug:string;
  event_type:"comment"|"review_requested"|"approved"|"changes_requested"|"published";
  comment:string;
  created_by:string|null;
  author_name?:string;
  created_at:string;
};

export type SocialAsset={
  id:string;
  station_slug:string;
  name:string;
  kind:string;
  storage_path:string;
  public_url:string;
  tags:string[];
  created_at?:string;
};

const defaultBrand=(stationSlug:string):BrandKit=>({
  station_slug:stationSlug,
  brand_name:stationSlug==="all"?"VLACORA":stationSlug,
  logo_url:"",
  primary_color:"#27269f",
  secondary_color:"#4d38ff",
  accent_color:"#ef4a5d",
  background_color:"#101124",
  text_color:"#ffffff",
  font_family:"Inter",
  default_cta:"Luister nu live",
  default_hashtags:"#radio #vlacora"
});

async function userId(){
  if(!isSupabaseBrowserConfigured())return null;
  const{data}=await createClient().auth.getUser();
  return data.user?.id||null;
}

export async function loadBrandKit(stationSlug:string):Promise<BrandKit>{
  if(!isSupabaseBrowserConfigured())return defaultBrand(stationSlug);
  const{data,error}=await createClient().from("hub_brand_kits").select("*").eq("station_slug",stationSlug).maybeSingle();
  if(error)throw error;
  return data?{...defaultBrand(stationSlug),...data}:defaultBrand(stationSlug);
}

export async function saveBrandKit(kit:BrandKit){
  if(!isSupabaseBrowserConfigured())throw new Error("Supabase is niet actief.");
  const id=await userId();if(!id)throw new Error("Log opnieuw in.");
  const{error}=await createClient().from("hub_brand_kits").upsert({...kit,updated_by:id,updated_at:new Date().toISOString()},{onConflict:"station_slug"});
  if(error)throw error;
}

export async function loadSocialTemplates(stationSlug:string):Promise<SocialTemplate[]>{
  if(!isSupabaseBrowserConfigured())return[];
  const{data,error}=await createClient().from("hub_social_templates").select("*").eq("station_slug",stationSlug).eq("active",true).order("name");
  if(error)throw error;
  return(data||[]) as SocialTemplate[];
}

export async function saveSocialTemplate(template:SocialTemplate):Promise<SocialTemplate>{
  if(!isSupabaseBrowserConfigured())throw new Error("Supabase is niet actief.");
  const id=await userId();if(!id)throw new Error("Log opnieuw in.");
  const payload={
    station_slug:template.station_slug,
    name:template.name,
    content_type:template.content_type,
    aspect_ratio:template.aspect_ratio,
    caption_template:template.caption_template,
    config:template.config||{},
    active:template.active,
    updated_by:id,
    updated_at:new Date().toISOString()
  };
  if(template.id.startsWith("new-")){
    const{data,error}=await createClient().from("hub_social_templates").insert({...payload,created_by:id}).select("*").single();
    if(error)throw error;return data as SocialTemplate;
  }
  const{data,error}=await createClient().from("hub_social_templates").update(payload).eq("id",template.id).select("*").single();
  if(error)throw error;return data as SocialTemplate;
}

export async function deleteSocialTemplate(id:string){
  if(!isSupabaseBrowserConfigured())throw new Error("Supabase is niet actief.");
  const{error}=await createClient().from("hub_social_templates").delete().eq("id",id);if(error)throw error;
}


export async function loadSocialPeople():Promise<SocialPerson[]>{
  if(!isSupabaseBrowserConfigured())return[];
  const{data,error}=await createClient().from("profiles").select("id,display_name,email").order("display_name");
  if(error)throw error;
  return(data||[]).map((x:any)=>({id:String(x.id),name:String(x.display_name||x.email||"Teamlid"),email:String(x.email||"")}));
}

export async function loadSocialPosts(stationSlug:string):Promise<SocialPost[]>{
  if(!isSupabaseBrowserConfigured())return[];
  const{data,error}=await createClient().from("hub_social_posts").select("*").eq("station_slug",stationSlug).order("scheduled_at",{ascending:true,nullsFirst:false}).order("created_at",{ascending:false});
  if(error)throw error;return(data||[]) as SocialPost[];
}

export async function saveSocialPost(post:SocialPost):Promise<SocialPost>{
  if(!isSupabaseBrowserConfigured())throw new Error("Supabase is niet actief.");
  const id=await userId();if(!id)throw new Error("Log opnieuw in.");
  const payload={
    station_slug:post.station_slug,
    template_id:post.template_id||null,
    title:post.title,
    status:post.status,
    format:post.format,
    payload:post.payload||{},
    caption:post.caption,
    scheduled_at:post.scheduled_at||null,
    published_at:post.status==="published"?(post.published_at||new Date().toISOString()):post.published_at,
    review_requested_at:post.review_requested_at||null,
    approved_at:post.approved_at||null,
    approved_by:post.approved_by||null,
    changes_requested_at:post.changes_requested_at||null,
    platforms:post.platforms||[],
    campaign:post.campaign||"",
    content_pillar:post.content_pillar||"",
    objective:post.objective||"",
    assigned_to:post.assigned_to||null,
    reviewer_id:post.reviewer_id||null,
    due_at:post.due_at||null,
    publication_url:post.publication_url||"",
    internal_notes:post.internal_notes||"",
    checklist:post.checklist||{copy:false,visual:false,rights:false,links:false},
    updated_by:id,
    updated_at:new Date().toISOString()
  };
  if(post.id.startsWith("new-")){
    const{data,error}=await createClient().from("hub_social_posts").insert({...payload,created_by:id}).select("*").single();
    if(error)throw error;return data as SocialPost;
  }
  const{data,error}=await createClient().from("hub_social_posts").update(payload).eq("id",post.id).select("*").single();
  if(error)throw error;return data as SocialPost;
}

export async function deleteSocialPost(id:string){
  if(!isSupabaseBrowserConfigured())throw new Error("Supabase is niet actief.");
  const{error}=await createClient().from("hub_social_posts").delete().eq("id",id);if(error)throw error;
}


export async function loadSocialCopyBlocks(stationSlug:string):Promise<SocialCopyBlock[]>{
  if(!isSupabaseBrowserConfigured())return[];
  const{data,error}=await createClient().from("hub_social_copy_blocks")
    .select("*").eq("station_slug",stationSlug).eq("active",true).order("category").order("name");
  if(error)throw error;
  return(data||[]) as SocialCopyBlock[];
}

export async function saveSocialCopyBlock(block:SocialCopyBlock):Promise<SocialCopyBlock>{
  if(!isSupabaseBrowserConfigured())throw new Error("Supabase is niet actief.");
  const id=await userId();if(!id)throw new Error("Log opnieuw in.");
  const payload={
    station_slug:block.station_slug,
    name:block.name.trim()||"Copyblok",
    category:block.category.trim()||"Algemeen",
    content:block.content,
    active:block.active,
    updated_by:id,
    updated_at:new Date().toISOString()
  };
  if(block.id.startsWith("new-")){
    const{data,error}=await createClient().from("hub_social_copy_blocks")
      .insert({...payload,created_by:id}).select("*").single();
    if(error)throw error;return data as SocialCopyBlock;
  }
  const{data,error}=await createClient().from("hub_social_copy_blocks")
    .update(payload).eq("id",block.id).select("*").single();
  if(error)throw error;return data as SocialCopyBlock;
}

export async function deleteSocialCopyBlock(id:string){
  if(!isSupabaseBrowserConfigured())throw new Error("Supabase is niet actief.");
  const{error}=await createClient().from("hub_social_copy_blocks").delete().eq("id",id);
  if(error)throw error;
}

export async function loadSocialReviewEvents(postId:string):Promise<SocialReviewEvent[]>{
  if(!isSupabaseBrowserConfigured()||!postId||postId.startsWith("new-"))return[];
  const supabase=createClient();
  const{data,error}=await supabase.from("hub_social_review_events")
    .select("id,post_id,station_slug,event_type,comment,created_by,created_at")
    .eq("post_id",postId).order("created_at",{ascending:true});
  if(error)throw error;
  const rows=(data||[]) as SocialReviewEvent[];
  const ids=[...new Set(rows.map(x=>x.created_by).filter(Boolean))] as string[];
  if(!ids.length)return rows;
  const{data:profiles}=await supabase.from("profiles").select("id,display_name").in("id",ids);
  const names=new Map((profiles||[]).map((p:any)=>[String(p.id),String(p.display_name||"Teamlid")]));
  return rows.map(row=>({...row,author_name:row.created_by?names.get(row.created_by)||"Teamlid":"Systeem"}));
}

export async function addSocialReviewEvent(
  post:SocialPost,
  eventType:SocialReviewEvent["event_type"],
  comment=""
):Promise<SocialReviewEvent>{
  if(!isSupabaseBrowserConfigured())throw new Error("Supabase is niet actief.");
  if(post.id.startsWith("new-"))throw new Error("Bewaar de socialpost eerst.");
  const supabase=createClient();const{data:user}=await supabase.auth.getUser();
  if(!user.user)throw new Error("Log opnieuw in.");
  const{data,error}=await supabase.from("hub_social_review_events").insert({
    post_id:post.id,station_slug:post.station_slug,event_type:eventType,comment:comment.trim(),created_by:user.user.id
  }).select("id,post_id,station_slug,event_type,comment,created_by,created_at").single();
  if(error)throw error;
  const{data:profile}=await supabase.from("profiles").select("display_name").eq("id",user.user.id).maybeSingle();
  return{...(data as SocialReviewEvent),author_name:String(profile?.display_name||"Teamlid")};
}

export async function loadSocialAssets(stationSlug:string):Promise<SocialAsset[]>{
  if(!isSupabaseBrowserConfigured())return[];
  const{data,error}=await createClient().from("hub_social_assets").select("*").eq("station_slug",stationSlug).order("created_at",{ascending:false});
  if(error)throw error;return(data||[]) as SocialAsset[];
}

function safeName(name:string){return name.toLowerCase().replace(/[^a-z0-9._-]+/g,"-").replace(/-+/g,"-").slice(0,120)}

export async function uploadSocialAsset(stationSlug:string,file:File,tags:string[]=[]):Promise<SocialAsset>{
  if(!isSupabaseBrowserConfigured())throw new Error("Supabase is niet actief.");
  if(file.size>5*1024*1024)throw new Error("Afbeelding is groter dan 5 MB.");
  if(!["image/png","image/jpeg","image/webp"].includes(file.type))throw new Error("Gebruik PNG, JPG of WEBP.");
  const supabase=createClient();const{data:user}=await supabase.auth.getUser();if(!user.user)throw new Error("Log opnieuw in.");
  const path=`${stationSlug}/${user.user.id}/${Date.now()}-${safeName(file.name||"asset")}`;
  const{error:uploadError}=await supabase.storage.from("vlacora-social-assets").upload(path,file,{cacheControl:"3600",upsert:false,contentType:file.type});
  if(uploadError)throw uploadError;
  const{data:urlData}=supabase.storage.from("vlacora-social-assets").getPublicUrl(path);
  const{data,error}=await supabase.from("hub_social_assets").insert({
    station_slug:stationSlug,name:file.name||"Afbeelding",kind:"image",storage_path:path,public_url:urlData.publicUrl,tags,created_by:user.user.id
  }).select("*").single();
  if(error)throw error;return data as SocialAsset;
}

export async function deleteSocialAsset(asset:SocialAsset){
  if(!isSupabaseBrowserConfigured())throw new Error("Supabase is niet actief.");
  const supabase=createClient();
  const{error:storageError}=await supabase.storage.from("vlacora-social-assets").remove([asset.storage_path]);
  if(storageError)throw storageError;
  const{error}=await supabase.from("hub_social_assets").delete().eq("id",asset.id);if(error)throw error;
}
