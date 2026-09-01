"use client";

export const VLACORA_ACTIVITY_EVENT="vlacora:activity";

export type ActivitySignal={
  detail:string;
  entityType?:string;
  entityId?:string;
};

export function emitActivity(signal:ActivitySignal){
  if(typeof window==="undefined")return;
  window.dispatchEvent(new CustomEvent(VLACORA_ACTIVITY_EVENT,{detail:signal}));
}
