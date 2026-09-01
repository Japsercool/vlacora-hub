export type PermissionLevel = "none" | "view" | "edit" | "publish" | "admin";

export type PermissionKey =
  | "dashboard" | "stations" | "taken" | "meldpunt" | "messenger"
  | "communicatie" | "kalender" | "programmering" | "muziek" | "meetings"
  | "redactie" | "playlists" | "hitlijsten" | "presentatie" | "social"
  | "statistieken" | "control" | "radio-api" | "team" | "beheer";

export type PermissionMap = Record<PermissionKey, PermissionLevel>;

export const permissionLabels: Record<PermissionKey,string> = {
  dashboard:"Dashboard", stations:"Stations", taken:"Taken", meldpunt:"Meldpunt",
  messenger:"Messenger", communicatie:"Communicatie", kalender:"Kalender",
  programmering:"Programmering", muziek:"Muziek", meetings:"Muziekmeetings",
  redactie:"Redactie", playlists:"Playlists", hitlijsten:"Hitlijsten",
  presentatie:"Presentatie", social:"Social Studio", statistieken:"Luistercijfers",
  control:"On-Air Control", "radio-api":"Radio API", team:"Team & rechten", beheer:"Beheer"
};

const allKeys = Object.keys(permissionLabels) as PermissionKey[];

function base(level:PermissionLevel="none"): PermissionMap {
  return Object.fromEntries(allKeys.map(k=>[k,level])) as PermissionMap;
}
function withLevels(levels:Partial<PermissionMap>):PermissionMap {
  return {...base("none"),...levels};
}

export const rolePresets: Record<string,PermissionMap> = {
  "Superadmin": base("admin"),
  "Stationmanager": withLevels({
    dashboard:"view",stations:"view",taken:"admin",meldpunt:"admin",messenger:"edit",
    communicatie:"publish",kalender:"admin",programmering:"publish",muziek:"publish",
    meetings:"publish",redactie:"publish",playlists:"publish",hitlijsten:"publish",
    presentatie:"edit",social:"publish",statistieken:"view",control:"view",
    "radio-api":"view",team:"admin",beheer:"edit"
  }),
  "Muziekredactie": withLevels({
    dashboard:"view",taken:"edit",meldpunt:"edit",messenger:"edit",communicatie:"edit",
    kalender:"view",programmering:"view",muziek:"publish",meetings:"publish",
    redactie:"edit",playlists:"view",hitlijsten:"publish",presentatie:"edit",
    social:"edit",statistieken:"view"
  }),
  "Redactie": withLevels({
    dashboard:"view",taken:"edit",meldpunt:"edit",messenger:"edit",communicatie:"edit",
    kalender:"edit",programmering:"view",muziek:"view",meetings:"view",
    redactie:"publish",playlists:"edit",hitlijsten:"view",presentatie:"publish",
    social:"edit",statistieken:"view",control:"view"
  }),
  "Presentator": withLevels({
    dashboard:"view",taken:"edit",meldpunt:"edit",messenger:"edit",communicatie:"view",
    kalender:"view",programmering:"view",muziek:"view",redactie:"edit",
    playlists:"view",presentatie:"edit",statistieken:"view"
  }),
  "Social & Marketing": withLevels({
    dashboard:"view",taken:"edit",meldpunt:"edit",messenger:"edit",communicatie:"edit",
    kalender:"edit",programmering:"view",muziek:"view",hitlijsten:"view",
    presentatie:"view",social:"publish",statistieken:"view"
  }),
  "Techniek": withLevels({
    dashboard:"view",taken:"edit",meldpunt:"admin",messenger:"edit",communicatie:"view",
    kalender:"edit",programmering:"view",playlists:"view",statistieken:"view",
    control:"admin","radio-api":"admin",beheer:"admin"
  }),
  "Kijker": withLevels({
    dashboard:"view",communicatie:"view",kalender:"view",programmering:"view",
    muziek:"view",hitlijsten:"view",statistieken:"view"
  })
};

export const permissionLevels: PermissionLevel[] = ["none","view","edit","publish","admin"];

export function can(level:PermissionLevel, required:PermissionLevel="view") {
  const rank:Record<PermissionLevel,number>={none:0,view:1,edit:2,publish:3,admin:4};
  return rank[level] >= rank[required];
}
