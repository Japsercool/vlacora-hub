export const stations = [
  { slug: "all", name: "Alle zenders", short: "ALL", accent: "#26269f" },
  { slug: "versuz", name: "Versuz Radio", short: "VZ", accent: "#5438ff" },
  { slug: "club-fm", name: "Club FM", short: "CF", accent: "#e94157" },
  { slug: "vlacora-one", name: "Vlacora One", short: "V1", accent: "#127a65" }
];

export const navItems = [
  ["dashboard", "⌂", "TODAY"],
  ["meldingen", "🔔", "Meldingen"],
  ["stations", "◉", "Stations"],
  ["taken", "✓", "Taken"],
  ["meldpunt", "!", "Meldpunt"],
  ["messenger", "✉", "Messenger"],
  ["communicatie", "▣", "Communicatie"],
  ["muziekmappen", "▦", "Muziekmappen PDF"],
  ["kalender", "□", "Kalender"],
  ["programmering", "◫", "Programmering"],
  ["muziek", "♫", "Muziek"],
  ["meetings", "◎", "Muziekmeetings"],
  ["redactie", "✎", "Redactie"],
  ["playlists", "≡", "Playlists"],
  ["hitlijsten", "↕", "Hitlijsten"],
  ["presentatie", "✎", "Presentatie"],
  ["social", "✦", "Social Studio"],
  ["statistieken", "▥", "Luistercijfers"],
  ["control", "⌁", "On-Air Control"],
  ["radio-api", "↔", "Radio API"],
  ["team", "♙", "Team"],
  ["beheer", "⚙", "Beheer"]
] as const;

export const shows = [
  { time: "07:00", end: "10:00", name: "Morning Club", host: "Lena & Tibo", live: false },
  { time: "10:00", end: "13:00", name: "Workday", host: "Jasper", live: false },
  { time: "13:00", end: "16:00", name: "Afternoon", host: "Bart-Jan", live: false },
  { time: "16:00", end: "18:00", name: "Drive", host: "Bram & Tibo", live: true },
  { time: "18:00", end: "19:00", name: "The Partyroom", host: "Wouter", live: false },
  { time: "19:00", end: "21:00", name: "Request", host: "Kurt", live: false }
];

export const chart = [
  ["1", "3", "Joel Corry", "Whisper", "▲ 2", "8", "1"],
  ["2", "1", "ANOTR & 54 Ultra", "Talk To You", "▼ 1", "11", "1"],
  ["3", "NEW", "Bebe Rexha", "New Religion", "NEW", "1", "3"],
  ["4", "4", "HUGEL", "Movin' To The Sun", "—", "7", "2"],
  ["5", "8", "Topic & Becky G", "Sorry Papi", "▲ 3", "5", "5"],
  ["6", "2", "Jennifer Lopez & David Guetta", "Save Me Tonight", "▼ 4", "9", "1"],
  ["7", "9", "Calvin Harris & Jazzy", "Satisfy", "▲ 2", "6", "6"]
];

export const initialPlaylist = [
  "TOTH - Versuz Radio",
  "HUGEL - Movin' To The Sun",
  "Sweeper - Only The Best Club Music",
  "Bebe Rexha - New Religion",
  "Commercial block",
  "Topic & Becky G - Sorry Papi",
  "Station ID",
  "Joel Corry - Whisper",
  "News 17:00"
];
