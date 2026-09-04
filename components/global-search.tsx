"use client";

import { FormEvent,useEffect,useRef,useState } from "react";
import { useRouter } from "next/navigation";
import { universalSearch,type SearchResult } from "@/lib/supabase/operations";

export default function GlobalSearch({stationSlug}:{stationSlug:string}){
  const router=useRouter();
  const inputRef=useRef<HTMLInputElement|null>(null);
  const[query,setQuery]=useState("");
  const[results,setResults]=useState<SearchResult[]>([]);
  const[open,setOpen]=useState(false);
  const[busy,setBusy]=useState(false);
  const[searched,setSearched]=useState(false);

  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setOpen(true);setTimeout(()=>inputRef.current?.focus(),0)}
      if(e.key==="Escape")setOpen(false);
    };
    window.addEventListener("keydown",key);
    return()=>window.removeEventListener("keydown",key);
  },[]);

  async function search(e?:FormEvent){
    e?.preventDefault();
    if(query.trim().length<2){setOpen(true);setResults([]);setSearched(true);return}
    setBusy(true);setOpen(true);setSearched(true);
    try{setResults(await universalSearch(stationSlug,query))}
    finally{setBusy(false)}
  }
  function go(item:SearchResult){setOpen(false);router.push(item.path)}

  return <div className="global-search">
    <form className="global-search-box" onSubmit={search}>
      <span>⌕</span>
      <input ref={inputRef} value={query} onFocus={()=>setOpen(true)} onChange={e=>setQuery(e.target.value)} placeholder="Zoek in PULSE…"/>
      <kbd>Ctrl K</kbd>
      <button type="submit" disabled={busy}>{busy?"…":"Zoek"}</button>
    </form>
    {open&&<div className="global-search-popover">
      <div className="global-search-head"><strong>Universeel zoeken</strong><span>Zoekt pas wanneer je op Zoek/Enter drukt • geen achtergrondqueries</span><button onClick={()=>setOpen(false)}>×</button></div>
      {!searched&&<div className="global-search-empty">Zoek bijvoorbeeld op <b>ANOTR</b>, een programma, taak, talk, contact, hitlijst of social post.</div>}
      {searched&&!busy&&results.length===0&&<div className="global-search-empty">Geen resultaten voor “{query}”.</div>}
      {busy&&<div className="global-search-empty">PULSE doorzoekt de gekoppelde werkdata…</div>}
      {results.length>0&&<div className="global-search-results">{results.map(item=><button key={item.id} onClick={()=>go(item)}><span className="search-kind">{item.kind}</span><div><strong>{item.title}</strong><small>{item.subtitle}</small></div><span>›</span></button>)}</div>}
    </div>}
  </div>;
}
