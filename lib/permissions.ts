export type PermissionLevel = "none" | "view" | "edit" | "publish" | "admin";

export type PermissionKey =
  | "dashboard" | "stations" | "taken" | "meldpunt" | "messenger" | "communicatie"
  | "kalender" | "programmering" | "programmas" | "afwezigheden" | "contacten"
  | "sjablonen" | "muziek" | "muziek_voorstellen" | "meetings"
  | "redactie" | "redactie_versies" | "verkeer"
  | "hitlijsten" | "hitlijsten_import" | "presentatie"
  | "social_content" | "social_calendar" | "social_templates" | "social_assets" | "social_approval"
  | "team" | "beheer";

export type PermissionMap = Record<PermissionKey, PermissionLevel>;

export const permissionLabels: Record<PermissionKey,string> = {
  dashboard:"Dashboard", stations:"Zenders bekijken", taken:"Taken", meldpunt:"Meldpunt",
  messenger:"Messenger", communicatie:"Officiële communicatie", kalender:"Gedeelde agenda",
  programmering:"Programmering", programmas:"Programmapagina's", afwezigheden:"Afwezigheden & vervanging",
  contacten:"Contacten", sjablonen:"Algemene sjablonen", muziek:"Muziekinformatie",
  muziek_voorstellen:"Muziek- & formatvoorstellen", meetings:"Muziekmeetings",
  redactie:"Redactie / talks", redactie_versies:"Redactie-versiegeschiedenis", verkeer:"Verkeer",
  hitlijsten:"Hitlijsten", hitlijsten_import:"Hitlijsten importeren", presentatie:"Presentatie",
  social_content:"Social • Content maken", social_calendar:"Social • Contentkalender",
  social_templates:"Social • Templates & brand kit", social_assets:"Social • Assets & copyblokken",
  social_approval:"Social • Goedkeuren & publiceren", team:"Team & gebruikers", beheer:"Superbeheer"
};

export const permissionGroups: Array<{label:string;keys:PermissionKey[]}> = [
  {label:"Algemeen",keys:["dashboard","stations","taken","meldpunt","messenger","communicatie","kalender"]},
  {label:"Zender & programma's",keys:["programmering","programmas","afwezigheden","contacten","sjablonen"]},
  {label:"Muziek",keys:["muziek","muziek_voorstellen","meetings","hitlijsten","hitlijsten_import"]},
  {label:"Redactie",keys:["redactie","redactie_versies","verkeer","presentatie"]},
  {label:"Social media",keys:["social_content","social_calendar","social_templates","social_assets","social_approval"]},
  {label:"Beheer",keys:["team","beheer"]}
];

const allKeys = Object.keys(permissionLabels) as PermissionKey[];
function base(level:PermissionLevel="none"): PermissionMap { return Object.fromEntries(allKeys.map(k=>[k,level])) as PermissionMap; }
function withLevels(levels:Partial<PermissionMap>):PermissionMap { return {...base("none"),...levels}; }

export const rolePresets: Record<string,PermissionMap> = {
  "Superadmin": base("admin"),
  "Stationmanager": withLevels({
    dashboard:"view",stations:"view",taken:"admin",meldpunt:"admin",messenger:"edit",communicatie:"publish",kalender:"admin",
    programmering:"publish",programmas:"publish",afwezigheden:"admin",contacten:"publish",sjablonen:"admin",
    muziek:"publish",muziek_voorstellen:"publish",meetings:"publish",redactie:"publish",redactie_versies:"publish",verkeer:"publish",
    hitlijsten:"publish",hitlijsten_import:"publish",presentatie:"edit",
    social_content:"publish",social_calendar:"publish",social_templates:"admin",social_assets:"publish",social_approval:"publish",
    team:"admin",beheer:"edit"
  }),
  "Muziekredactie": withLevels({
    dashboard:"view",stations:"view",taken:"edit",meldpunt:"edit",messenger:"edit",communicatie:"edit",kalender:"view",
    programmering:"view",programmas:"view",afwezigheden:"view",contacten:"view",sjablonen:"edit",
    muziek:"publish",muziek_voorstellen:"publish",meetings:"publish",redactie:"edit",redactie_versies:"view",verkeer:"edit",
    hitlijsten:"publish",hitlijsten_import:"publish",presentatie:"edit",
    social_content:"edit",social_calendar:"view",social_assets:"view"
  }),
  "Redactie": withLevels({
    dashboard:"view",stations:"view",taken:"edit",meldpunt:"edit",messenger:"edit",communicatie:"edit",kalender:"edit",
    programmering:"view",programmas:"edit",afwezigheden:"view",contacten:"view",sjablonen:"publish",
    muziek:"view",muziek_voorstellen:"edit",meetings:"view",redactie:"publish",redactie_versies:"publish",verkeer:"publish",
    hitlijsten:"view",presentatie:"publish",social_content:"edit",social_calendar:"view",social_assets:"view"
  }),
  "Presentator": withLevels({
    dashboard:"view",stations:"view",taken:"edit",meldpunt:"edit",messenger:"edit",communicatie:"view",kalender:"view",
    programmering:"view",programmas:"view",afwezigheden:"edit",contacten:"view",sjablonen:"view",muziek:"view",
    muziek_voorstellen:"edit",redactie:"edit",redactie_versies:"view",verkeer:"view",presentatie:"edit",
    social_content:"edit",social_calendar:"view",social_assets:"view"
  }),
  "Social & Marketing": withLevels({
    dashboard:"view",stations:"view",taken:"edit",meldpunt:"edit",messenger:"edit",communicatie:"edit",kalender:"edit",
    programmering:"view",programmas:"view",contacten:"view",sjablonen:"edit",muziek:"view",hitlijsten:"view",presentatie:"view",
    social_content:"publish",social_calendar:"publish",social_templates:"publish",social_assets:"publish",social_approval:"publish"
  }),
  "Techniek": withLevels({
    dashboard:"view",stations:"view",taken:"edit",meldpunt:"admin",messenger:"edit",communicatie:"view",kalender:"edit",
    programmering:"view",programmas:"view",contacten:"view",sjablonen:"admin",verkeer:"view",beheer:"admin"
  }),
  "Kijker": withLevels({
    dashboard:"view",stations:"view",communicatie:"view",kalender:"view",programmering:"view",programmas:"view",contacten:"view",
    sjablonen:"view",muziek:"view",verkeer:"view",hitlijsten:"view",social_calendar:"view"
  })
};

export const permissionLevels: PermissionLevel[] = ["none","view","edit","publish","admin"];
export function can(level:PermissionLevel|undefined, required:PermissionLevel="view") {
  const rank:Record<PermissionLevel,number>={none:0,view:1,edit:2,publish:3,admin:4};
  return rank[level||"none"] >= rank[required];
}

export function resolvePermissions(role:string,value:any):PermissionMap {
  const normalized = role === "social" || role === "social & marketing" ? "Social & Marketing" :
    role ? role.charAt(0).toUpperCase()+role.slice(1) : "Kijker";
  const preset=rolePresets[normalized]||rolePresets.Kijker;
  return {...preset,...(value&&typeof value==="object"?value:{})} as PermissionMap;
}

export const modulePermission: Record<string,PermissionKey|null> = {
  dashboard:"dashboard", "voor-mij":null, "mijn-uitzending":null, meldingen:null,
  stations:"stations", taken:"taken", meldpunt:"meldpunt", aanvragen:"beheer", "content-inbox":"redactie",
  messenger:"messenger", communicatie:"communicatie", kalender:"kalender", programmering:"programmering",
  programmas:"programmas", afwezigheden:"afwezigheden", contacten:"contacten", sjablonen:"sjablonen",
  muziek:"muziek", "muziek-voorstellen":"muziek_voorstellen", meetings:"meetings", redactie:"redactie", verkeer:"verkeer", hitlijsten:"hitlijsten",
  presentatie:"presentatie", social:"social_content", team:"team", beheer:"beheer"
};
