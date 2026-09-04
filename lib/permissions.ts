export type PermissionLevel = "none" | "view" | "edit" | "publish" | "admin";

export type PermissionKey =
  | "dashboard" | "voor_mij" | "mijn_uitzending" | "meldingen" | "stations" | "taken" | "meldpunt" | "messenger" | "communicatie"
  | "kalender" | "programmering" | "beschikbaarheid" | "programmas" | "afwezigheden" | "contacten"
  | "sjablonen" | "muziek" | "muziek_voorstellen" | "meetings"
  | "redactie" | "redactie_versies" | "verkeer"
  | "hitlijsten" | "hitlijsten_import" | "presentatie"
  | "social_content" | "social_calendar" | "social_templates" | "social_template_builder" | "social_assets" | "social_approval"
  | "team" | "meldpunt_beheer" | "beheer";

export type PermissionMap = Record<PermissionKey, PermissionLevel>;

export const permissionLabels: Record<PermissionKey,string> = {
  dashboard:"Dashboard", voor_mij:"Voor mij", mijn_uitzending:"Mijn uitzending", meldingen:"Meldingen", stations:"Zenders bekijken", taken:"Taken", meldpunt:"Meldpunt",
  messenger:"Messenger", communicatie:"Officiële communicatie", kalender:"Gedeelde agenda",
  programmering:"Programmering", beschikbaarheid:"Beschikbaarheid", programmas:"Programmapagina's", afwezigheden:"Afwezigheden & vervanging",
  contacten:"Contacten", sjablonen:"Workflowbouwer", muziek:"Muziekinformatie",
  muziek_voorstellen:"Muziek- & formatvoorstellen", meetings:"Muziekmeetings",
  redactie:"Redactie / talks", redactie_versies:"Redactie-versiegeschiedenis", verkeer:"Verkeer",
  hitlijsten:"Hitlijsten", hitlijsten_import:"Hitlijsten importeren", presentatie:"Presentatie",
  social_content:"Social • Content maken", social_calendar:"Social • Contentkalender",
  social_templates:"Social • Brand kit & beheer", social_template_builder:"Social • Mini Canva / Templatebouwer", social_assets:"Social • Assets & copyblokken",
  social_approval:"Social • Goedkeuren & publiceren", team:"Team & gebruikers", meldpunt_beheer:"Meldpuntbeheer", beheer:"Superbeheer"
};

export const permissionGroups: Array<{label:string;keys:PermissionKey[]}> = [
  {label:"Algemeen & persoonlijk menu",keys:["dashboard","voor_mij","mijn_uitzending","meldingen","stations","taken","meldpunt","messenger","communicatie","kalender"]},
  {label:"Zender & programma's",keys:["programmering","beschikbaarheid","programmas","afwezigheden","contacten","sjablonen"]},
  {label:"Muziek",keys:["muziek","muziek_voorstellen","meetings","hitlijsten","hitlijsten_import"]},
  {label:"Redactie",keys:["redactie","redactie_versies","verkeer","presentatie"]},
  {label:"Social media",keys:["social_content","social_calendar","social_templates","social_template_builder","social_assets","social_approval"]},
  {label:"Beheer",keys:["team","meldpunt_beheer","beheer"]}
];

const allKeys = Object.keys(permissionLabels) as PermissionKey[];
function base(level:PermissionLevel="none"): PermissionMap { return Object.fromEntries(allKeys.map(k=>[k,level])) as PermissionMap; }
function withLevels(levels:Partial<PermissionMap>):PermissionMap { return {...base("none"),...levels}; }

export const rolePresets: Record<string,PermissionMap> = {
  "Superadmin": base("admin"),
  "Stationmanager": withLevels({
    dashboard:"view",voor_mij:"view",mijn_uitzending:"view",meldingen:"view",stations:"view",taken:"admin",meldpunt:"admin",messenger:"edit",communicatie:"publish",kalender:"admin",
    programmering:"publish",beschikbaarheid:"admin",programmas:"publish",afwezigheden:"admin",contacten:"publish",sjablonen:"admin",
    muziek:"publish",muziek_voorstellen:"publish",meetings:"publish",redactie:"publish",redactie_versies:"publish",verkeer:"publish",
    hitlijsten:"publish",hitlijsten_import:"publish",presentatie:"edit",
    social_content:"publish",social_calendar:"publish",social_templates:"admin",social_template_builder:"admin",social_assets:"publish",social_approval:"publish",
    team:"admin",meldpunt_beheer:"admin",beheer:"edit"
  }),
  "Muziekredactie": withLevels({
    dashboard:"view",voor_mij:"view",mijn_uitzending:"view",meldingen:"view",stations:"view",taken:"edit",meldpunt:"edit",messenger:"edit",communicatie:"edit",kalender:"view",
    programmering:"view",beschikbaarheid:"edit",programmas:"view",afwezigheden:"view",contacten:"view",sjablonen:"edit",
    muziek:"publish",muziek_voorstellen:"publish",meetings:"publish",redactie:"edit",redactie_versies:"view",verkeer:"edit",
    hitlijsten:"publish",hitlijsten_import:"publish",presentatie:"edit",
    social_content:"edit",social_calendar:"view",social_assets:"view"
  }),
  "Redactie": withLevels({
    dashboard:"view",voor_mij:"view",mijn_uitzending:"view",meldingen:"view",stations:"view",taken:"edit",meldpunt:"edit",messenger:"edit",communicatie:"edit",kalender:"edit",
    programmering:"view",beschikbaarheid:"edit",programmas:"edit",afwezigheden:"view",contacten:"view",sjablonen:"publish",
    muziek:"view",muziek_voorstellen:"edit",meetings:"view",redactie:"publish",redactie_versies:"publish",verkeer:"publish",
    hitlijsten:"view",presentatie:"publish",social_content:"edit",social_calendar:"view",social_assets:"view"
  }),
  "Presentator": withLevels({
    dashboard:"view",voor_mij:"view",mijn_uitzending:"view",meldingen:"view",stations:"view",taken:"edit",meldpunt:"edit",messenger:"edit",communicatie:"view",kalender:"view",
    programmering:"view",beschikbaarheid:"edit",programmas:"view",afwezigheden:"edit",contacten:"view",sjablonen:"view",muziek:"view",
    muziek_voorstellen:"edit",redactie:"edit",redactie_versies:"view",verkeer:"view",presentatie:"edit",
    social_content:"edit",social_calendar:"view",social_assets:"view"
  }),
  "Social & Marketing": withLevels({
    dashboard:"view",voor_mij:"view",mijn_uitzending:"view",meldingen:"view",stations:"view",taken:"edit",meldpunt:"edit",messenger:"edit",communicatie:"edit",kalender:"edit",
    programmering:"view",beschikbaarheid:"edit",programmas:"view",contacten:"view",sjablonen:"edit",muziek:"view",hitlijsten:"view",presentatie:"view",
    social_content:"publish",social_calendar:"publish",social_templates:"publish",social_template_builder:"publish",social_assets:"publish",social_approval:"publish"
  }),
  "Techniek": withLevels({
    dashboard:"view",voor_mij:"view",mijn_uitzending:"none",meldingen:"view",stations:"view",taken:"edit",meldpunt:"admin",messenger:"edit",communicatie:"view",kalender:"edit",
    programmering:"view",beschikbaarheid:"edit",programmas:"view",contacten:"view",sjablonen:"admin",verkeer:"view",meldpunt_beheer:"admin",beheer:"admin"
  }),
  "Kijker": withLevels({
    dashboard:"view",voor_mij:"view",mijn_uitzending:"none",meldingen:"view",stations:"view",communicatie:"view",kalender:"view",programmering:"view",beschikbaarheid:"edit",programmas:"view",contacten:"view",
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

export const modulePermission: Partial<Record<string,PermissionKey|null>> = {
  dashboard:"dashboard", "voor-mij":"voor_mij", "mijn-uitzending":"mijn_uitzending", meldingen:"meldingen",
  stations:"stations", taken:"taken", meldpunt:"meldpunt", aanvragen:"beheer", "content-inbox":"redactie",
  messenger:"messenger", communicatie:"communicatie", kalender:"kalender", programmering:"programmering", beschikbaarheid:"beschikbaarheid",
  programmas:"programmas", afwezigheden:"afwezigheden", contacten:"contacten", sjablonen:"sjablonen",
  muziek:"muziek", "muziek-voorstellen":"muziek_voorstellen", meetings:"meetings", redactie:"redactie", verkeer:"verkeer", hitlijsten:"hitlijsten",
  presentatie:"presentatie", social:"social_content", "social-beheer":"social_templates", "social-templatebouwer":"social_template_builder", "hitlijst-beheer":"hitlijsten", "meldpunt-beheer":"meldpunt_beheer", team:"team", beheer:"beheer"
};

export function canViewModule(permissions: PermissionMap | null | undefined, moduleSlug: string) {
  if (!permissions) return false;
  const key = modulePermission[moduleSlug];
  if (key === null) return true;
  if (!key) return false;
  return can(permissions[key], "view");
}
