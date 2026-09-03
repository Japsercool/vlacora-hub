"use client";

import { loadSharedSetting,saveSharedSetting } from "@/lib/supabase/settings";

export type DatabaseBackendConfig={
  active:"supabase";
  futureTarget:"postgresql"|"self-hosted-supabase"|"none";
  targetLabel:string;
  hostHint:string;
  databaseHint:string;
  sslRequired:boolean;
  migrationPrepared:boolean;
};
export const defaultDatabaseBackendConfig:DatabaseBackendConfig={active:"supabase",futureTarget:"none",targetLabel:"",hostHint:"",databaseHint:"",sslRequired:true,migrationPrepared:false};

export async function loadDatabaseBackendConfig(){
  const value=await loadSharedSetting<Partial<DatabaseBackendConfig>>("global","database-backend");
  return {...defaultDatabaseBackendConfig,...(value||{}),active:"supabase" as const};
}
export async function saveDatabaseBackendConfig(value:DatabaseBackendConfig){
  await saveSharedSetting("global","database-backend",{...value,active:"supabase"});
}
