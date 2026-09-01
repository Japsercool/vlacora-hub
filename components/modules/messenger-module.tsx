"use client";

import { useEffect, useMemo, useState } from "react";

type Channel = {
  id: string;
  name: string;
  type: "group" | "direct" | "station";
  members: string[];
  unread: number;
};

type Message = {
  id: string;
  channelId: string;
  sender: string;
  text: string;
  time: string;
};

const seedChannels: Channel[] = [
  { id: "music", name: "Muziekredactie", type: "group", members: ["Jasper", "Tibo", "Sarah"], unread: 2 },
  { id: "tech", name: "Techniek", type: "group", members: ["Jasper", "Techniek"], unread: 1 },
  { id: "team", name: "Versuz Team", type: "station", members: ["Jasper", "Tibo", "Bram", "Wouter", "Sarah"], unread: 0 },
  { id: "drive", name: "Drive", type: "group", members: ["Jasper", "Bram", "Tibo"], unread: 0 },
  { id: "tibo", name: "Tibo", type: "direct", members: ["Jasper", "Tibo"], unread: 0 },
];

const seedMessages: Message[] = [
  { id: "m1", channelId: "music", sender: "Tibo", text: "Ik heb 6 nieuwe tracks klaargezet voor de meeting.", time: "08:21" },
  { id: "m2", channelId: "music", sender: "Sarah", text: "Ik luister de nieuwe Bebe Rexha straks nog na.", time: "08:24" },
  { id: "m3", channelId: "tech", sender: "Techniek", text: "De back-up encoder is opnieuw bereikbaar.", time: "07:58" },
  { id: "m4", channelId: "team", sender: "Bram", text: "Wie neemt de promo voor vanavond nog op?", time: "08:05" },
  { id: "m5", channelId: "drive", sender: "Tibo", text: "Voor Drive wil ik om 17:15 de nieuwe hit tease doen.", time: "08:11" },
  { id: "m6", channelId: "tibo", sender: "Tibo", text: "Heb je straks 5 minuten voor de Top 50?", time: "08:14" },
];

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) setValue(JSON.parse(saved));
    } catch {}
    setReady(true);
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, ready, value]);
  return [value, setValue] as const;
}

export default function MessengerModule({ stationSlug }: { stationSlug: string }) {
  const [channels, setChannels] = useStored<Channel[]>(`vlacora:${stationSlug}:messenger:channels`, seedChannels);
  const [messages, setMessages] = useStored<Message[]>(`vlacora:${stationSlug}:messenger:messages`, seedMessages);
  const [selectedId, setSelectedId] = useState(seedChannels[0].id);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<Channel["type"]>("group");
  const [newMembers, setNewMembers] = useState("Tibo, Sarah");

  useEffect(() => {
    if (!channels.some(c => c.id === selectedId) && channels[0]) setSelectedId(channels[0].id);
  }, [channels, selectedId]);

  const selected = channels.find(c => c.id === selectedId) || channels[0];
  const shownChannels = channels.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const selectedMessages = useMemo(
    () => messages.filter(m => m.channelId === selected?.id),
    [messages, selected?.id]
  );

  function openChannel(id: string) {
    setSelectedId(id);
    setChannels(channels.map(c => c.id === id ? { ...c, unread: 0 } : c));
  }

  function send() {
    if (!draft.trim() || !selected) return;
    const now = new Date().toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });
    setMessages([...messages, { id: uid(), channelId: selected.id, sender: "Jasper", text: draft.trim(), time: now }]);
    setDraft("");
  }

  function createChannel() {
    if (!newName.trim()) return;
    const channel: Channel = {
      id: uid(),
      name: newName.trim(),
      type: newType,
      members: ["Jasper", ...newMembers.split(",").map(x => x.trim()).filter(Boolean)],
      unread: 0,
    };
    setChannels([...channels, channel]);
    setSelectedId(channel.id);
    setNewName("");
    setShowCreate(false);
  }

  function deleteChannel() {
    if (!selected || !confirm(`Chat '${selected.name}' verwijderen uit deze demo?`)) return;
    setChannels(channels.filter(c => c.id !== selected.id));
    setMessages(messages.filter(m => m.channelId !== selected.id));
  }

  return (
    <div className="messenger messenger-v2">
      <div className="channels">
        <div className="module-title-row"><div><h3>Messenger</h3><small>Privé, groepen en stationchats</small></div><button className="primary tiny-btn" onClick={() => setShowCreate(!showCreate)}>＋</button></div>
        <input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoek gesprek..." />
        {showCreate && <div className="channel-create">
          <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Naam gesprek" />
          <select className="select" value={newType} onChange={e => setNewType(e.target.value as Channel["type"])}><option value="group">Groep</option><option value="direct">Privé</option><option value="station">Station</option></select>
          <input className="input" value={newMembers} onChange={e => setNewMembers(e.target.value)} placeholder="Leden, komma gescheiden" />
          <button className="primary" onClick={createChannel}>Aanmaken</button>
        </div>}
        <div className="channel-list">
          {shownChannels.map(channel => <button key={channel.id} onClick={() => openChannel(channel.id)} className={`channel ${selected?.id === channel.id ? "selected" : ""}`}>
            <span className="channel-avatar">{channel.type === "direct" ? channel.name.slice(0,1).toUpperCase() : channel.type === "station" ? "◉" : "✉"}</span>
            <div><strong>{channel.name}</strong><small>{channel.type === "direct" ? "Privégesprek" : `${channel.members.length} leden`}</small></div>
            {channel.unread > 0 && <span className="nav-count">{channel.unread}</span>}
          </button>)}
        </div>
      </div>

      <div className="chat">
        {selected ? <>
          <div className="chat-head">
            <div><strong>{selected.type === "direct" ? selected.name : `#${selected.name}`}</strong><small>{selected.members.join(" • ")}</small></div>
            <div className="button-row"><button className="ghost" onClick={() => alert(`Leden: ${selected.members.join(", ")}`)}>Leden</button><button className="ghost" onClick={deleteChannel}>⋯</button></div>
          </div>
          <div className="messages">
            {selectedMessages.length === 0 && <div className="empty-chat"><strong>Nog geen berichten</strong><span>Stuur het eerste bericht in {selected.name}.</span></div>}
            {selectedMessages.map(m => <div className={`message ${m.sender === "Jasper" ? "mine" : ""}`} key={m.id}>
              <div className="avatar small">{m.sender.split(" ").map(x => x[0]).slice(0,2).join("")}</div>
              <div><div className="message-meta"><strong>{m.sender}</strong><span>{m.time}</span></div><p>{m.text}</p></div>
            </div>)}
          </div>
          <div className="composer"><button className="ghost" onClick={() => alert("Bestanden koppelen we in de Supabase-versie.")}>＋</button><input className="input grow" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder={`Bericht naar ${selected.name}...`} /><button className="primary" onClick={send}>Verstuur</button></div>
        </> : <div className="empty-chat"><strong>Geen chat geselecteerd</strong></div>}
      </div>
    </div>
  );
}
