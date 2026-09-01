import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  try{
    const auth=req.headers.get("Authorization")||"";
    const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const{data:userData,error:userError}=await userClient.auth.getUser();
    if(userError||!userData.user)return json({error:"Niet ingelogd"},401);
    const{data:profile}=await admin.from("profiles").select("role,active").eq("id",userData.user.id).maybeSingle();
    if(!profile?.active||String(profile.role).toLowerCase()!=="superadmin")return json({error:"Alleen een superadmin kan teamaccounts beheren."},403);
    const body=await req.json(),action=String(body?.action||"");
    if(action==="invite"){
      const email=String(body?.email||"").trim().toLowerCase(),displayName=String(body?.displayName||"").trim();
      const role=String(body?.role||"kijker").trim().toLowerCase(),jobTitle=String(body?.jobTitle||"").trim();
      const stations=Array.isArray(body?.stationSlugs)?body.stationSlugs.map((x:unknown)=>String(x).trim()).filter(Boolean):[];
      const redirectTo=String(body?.redirectTo||"").trim()||undefined;
      if(!email||!email.includes("@"))return json({error:"Ongeldig e-mailadres."},400);
      const allowed=new Set(["superadmin","stationmanager","muziekredactie","redactie","presentator","social & marketing","techniek","kijker"]);
      if(!allowed.has(role))return json({error:"Ongeldige rol."},400);
      const{data,error}=await admin.auth.admin.inviteUserByEmail(email,{data:{display_name:displayName||email.split("@")[0]},redirectTo});
      if(error)return json({error:error.message},400);
      const id=data.user?.id;
      if(id){
        await admin.from("profiles").upsert({id,email,display_name:displayName||email.split("@")[0],role,job_title:jobTitle||role,active:true,updated_at:new Date().toISOString()},{onConflict:"id"});
        await admin.from("station_memberships").delete().eq("user_id",id);
        if(stations.length)await admin.from("station_memberships").insert(stations.map((stationSlug:string)=>({user_id:id,station_slug:stationSlug,role,permissions:{},active:true,updated_at:new Date().toISOString()})));
      }
      return json({ok:true,userId:id||null});
    }
    if(action==="delete"){
      const targetUserId=String(body?.userId||"");if(!targetUserId)return json({error:"userId ontbreekt"},400);
      if(targetUserId===userData.user.id)return json({error:"Je kunt je eigen superadmin-account hier niet verwijderen."},400);
      const{error}=await admin.auth.admin.deleteUser(targetUserId);if(error)return json({error:error.message},400);return json({ok:true});
    }
    if(action==="send_recovery"){
      const email=String(body?.email||"").trim().toLowerCase(),redirectTo=String(body?.redirectTo||"").trim()||undefined;
      if(!email)return json({error:"E-mailadres ontbreekt"},400);
      const{error}=await admin.auth.resetPasswordForEmail(email,{redirectTo});if(error)return json({error:error.message},400);return json({ok:true});
    }
    return json({error:"Onbekende actie"},400);
  }catch(error){return json({error:error instanceof Error?error.message:"Onbekende fout"},500)}
});
function json(value:unknown,status=200){return new Response(JSON.stringify(value),{status,headers:{...cors,"Content-Type":"application/json"}})}
