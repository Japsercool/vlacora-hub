import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import pg from "pg";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { encryptJson, decryptJson } from "./crypto.mjs";
const { Client }=pg;const app=express();app.use(express.json({limit:"2mb"}));app.use(cors({origin:process.env.PULSE_ALLOWED_ORIGIN?.split(",").map(x=>x.trim()).filter(Boolean)||false,credentials:false}));
const PORT=Number(process.env.PORT||8787);const AUTH_URL=(process.env.SUPABASE_AUTH_URL||"").replace(/\/$/,"");const ISSUER=process.env.SUPABASE_AUTH_ISSUER||`${AUTH_URL}/auth/v1`;const JWKS=createRemoteJWKSet(new URL(`${AUTH_URL}/auth/v1/.well-known/jwks.json`));const dataDir=path.resolve("data");const configFile=path.join(dataDir,"postgres.enc");fs.mkdirSync(dataDir,{recursive:true});
function setup(req){if(!process.env.PULSE_GATEWAY_SETUP_TOKEN||req.get("x-pulse-setup-token")!==process.env.PULSE_GATEWAY_SETUP_TOKEN)throw Object.assign(new Error("Ongeldig Gateway setup-token"),{status:403});}
async function user(req){const raw=(req.get("authorization")||"").replace(/^Bearer\s+/i,"");if(!raw)throw Object.assign(new Error("Geen Supabase sessie"),{status:401});const {payload}=await jwtVerify(raw,JWKS,{issuer:ISSUER,audience:"authenticated"});return payload;}
function dbConfigFrom(body){const c=body?.connection||body;if(!c?.host||!c?.database||!c?.user||!c?.password)throw new Error("Host, database, gebruiker en wachtwoord zijn verplicht");return {host:String(c.host),port:Number(c.port||5432),database:String(c.database),user:String(c.user),password:String(c.password),ssl:c.ssl?{rejectUnauthorized:true}:false};}
async function testDb(c){const cl=new Client({...c,connectionTimeoutMillis:7000});await cl.connect();const r=await cl.query("select current_database() db, current_user usr, version() version");await cl.end();return r.rows[0];}
function stored(){if(!fs.existsSync(configFile))throw new Error("Nog geen PostgreSQL-configuratie opgeslagen op de Gateway");return decryptJson(fs.readFileSync(configFile,"utf8"),process.env.PULSE_GATEWAY_MASTER_KEY||"");}
app.get("/health",(_q,res)=>res.json({ok:true,service:"PULSE Data Gateway",version:"0.28.0"}));
app.post("/admin/postgres/test",async(req,res,next)=>{try{setup(req);await user(req);const c=dbConfigFrom(req.body);const result=await testDb(c);const fingerprint=crypto.createHash("sha256").update(`${c.host}:${c.port}/${c.database}:${c.user}`).digest("hex").slice(0,16);res.json({ok:true,fingerprint,database:result.db,user:result.usr,version:result.version});}catch(e){next(e)}});
app.post("/admin/postgres/configure",async(req,res,next)=>{try{setup(req);await user(req);const c=dbConfigFrom(req.body);await testDb(c);fs.writeFileSync(configFile,encryptJson(c,process.env.PULSE_GATEWAY_MASTER_KEY||""),{mode:0o600});res.json({ok:true});}catch(e){next(e)}});
app.post("/admin/migrate",async(req,res,next)=>{try{setup(req);await user(req);const c=stored();await testDb(c);res.status(202).json({ok:true,status:"migrating",message:"Preflight geslaagd. De Gateway is klaar voor de volledige PULSE snapshot-import. Koppel hiervoor de 0.28 export-adapter uit de volledige PULSE-bron."});}catch(e){next(e)}});
app.post("/admin/activate",async(req,res,next)=>{try{setup(req);await user(req);const c=stored();await testDb(c);res.json({ok:true,status:"active"});}catch(e){next(e)}});
app.post("/admin/rollback",async(req,res,next)=>{try{setup(req);await user(req);res.json({ok:true,status:"rollback"});}catch(e){next(e)}});
app.use((err,_req,res,_next)=>{console.error(err);res.status(err.status||500).json({error:err.message||"Gateway fout"});});
app.listen(PORT,"0.0.0.0",()=>console.log(`PULSE Data Gateway 0.28.0 listening on ${PORT}`));
