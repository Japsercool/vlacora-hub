"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { createClient, isSupabaseBrowserConfigured } from "@/lib/supabase/client";
import styles from "./database-backend-v2.module.css";

type BackendName = "supabase" | "external_postgres";
type Config = {
  scope: string;
  active_backend: BackendName;
  target_kind: "postgres" | "self_hosted_supabase";
  target_name: string;
  gateway_url: string;
  database_name: string;
  ssl_required: boolean;
  status: "not_configured" | "configured" | "tested" | "migrating" | "ready" | "active" | "error" | "rollback";
  gateway_fingerprint: string;
  last_test_at: string | null;
  activated_at: string | null;
  previous_backend: string;
  target_host?: string;
  target_port?: number;
  target_user?: string;
  file_migration_enabled?: boolean;
  deployment_mode?: "managed_docker" | "existing_postgres";
  gateway_setup_complete?: boolean;
  gateway_version?: string;
  server_label?: string;
  postgres_managed?: boolean;
  public_site_url?: string;
  gateway_public_url?: string;
  allowed_origins?: string[];
  domain_status?: "not_configured" | "configured" | "tested" | "active" | "error";
  domain_updated_at?: string | null;
};

type MigrationTable = { source: number; copied: number; target: number; ok: boolean };
type MigrationState = {
  status?: string;
  stage?: string;
  current?: { table?: string; index?: number; total?: number; rows?: number } | null;
  tableTotal?: number;
  tables?: Record<string, MigrationTable>;
  files?: { copied?: number; failed?: number; total?: number };
  error?: string;
  updatedAt?: string | null;
  completedAt?: string | null;
};
type GatewayStatus = {
  migration?: MigrationState;
  backend?: { activeBackend?: BackendName; previousBackend?: BackendName; activatedAt?: string | null; fingerprint?: string };
  running?: boolean;
};

const initial: Config = {
  scope: "global",
  active_backend: "supabase",
  target_kind: "postgres",
  target_name: "",
  gateway_url: "",
  database_name: "pulse",
  ssl_required: true,
  status: "not_configured",
  gateway_fingerprint: "",
  last_test_at: null,
  activated_at: null,
  previous_backend: "supabase",
  target_host: "",
  target_port: 5432,
  target_user: "",
  file_migration_enabled: true,
  deployment_mode: "managed_docker",
  gateway_setup_complete: false,
  gateway_version: "",
  server_label: "",
  postgres_managed: true,
  public_site_url: "",
  gateway_public_url: "",
  allowed_origins: [],
  domain_status: "not_configured",
  domain_updated_at: null,
};

const stageLabels: Record<string, string> = {
  idle: "Nog niet gestart",
  catalog: "PULSE-schema inventariseren",
  "source-counts": "Brondata tellen",
  schema: "Doeldatabase voorbereiden",
  "identity-mirror": "Supabase user-UUID’s veilig spiegelen",
  "target-migrations": "PULSE-doelmigraties uitvoeren",
  "clear-target": "Oude migratiedoeldata opruimen",
  copying: "PULSE-data kopiëren",
  constraints: "Relaties en indexen aanmaken",
  verifying: "Data controleren",
  files: "Bijlagen kopiëren",
  ready: "Klaar voor omschakeling",
  failed: "Migratie gestopt",
};

export function DatabaseBackendV2() {
  const client = useMemo(() => (isSupabaseBrowserConfigured() ? createClient() : null), []);
  const [cfg, setCfg] = useState<Config>(initial);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("5432");
  const [dbUser, setDbUser] = useState("");
  const [dbPassword, setDbPassword] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [extraOrigins, setExtraOrigins] = useState("");
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [gatewayState, setGatewayState] = useState<GatewayStatus>({});
  const syncedBackend = useRef<BackendName | "">("");

  useEffect(() => {
    if (!client) return;
    void client
      .from("hub_data_backend_configs")
      .select("*")
      .eq("scope", "global")
      .maybeSingle()
      .then((result: { data: unknown; error: { message: string } | null }) => {
        const { data, error: loadError } = result;
        if (loadError) setError(loadError.message);
        if (data) {
          const next = data as Config;
          setCfg(next);
          setHost(next.target_host || "");
          setPort(String(next.target_port || 5432));
          setDbUser(next.target_user || "");
          setExtraOrigins(Array.isArray(next.allowed_origins) ? next.allowed_origins.filter((x) => x && x !== next.public_site_url).join(", ") : "");
        }
      });
  }, [client]);

  async function actor() {
    const { data } = await client!.auth.getUser();
    return data.user?.id || null;
  }

  async function saveConfig(patch: Partial<Config>) {
    if (!client) return;
    const row = {
      ...cfg,
      ...patch,
      target_host: String(patch.target_host ?? host.trim()),
      target_port: Number(patch.target_port ?? Number(port || 5432)),
      target_user: String(patch.target_user ?? dbUser.trim()),
      updated_by: await actor(),
      updated_at: new Date().toISOString(),
    };
    const { data, error: saveError } = await client
      .from("hub_data_backend_configs")
      .upsert(row, { onConflict: "scope" })
      .select("*")
      .single();
    if (saveError) throw saveError;
    setCfg(data as Config);
  }

  async function gateway(path: string, body: unknown = {}) {
    const base = cfg.gateway_url.trim().replace(/\/$/, "");
    if (!base) throw new Error("Vul eerst de PULSE Data Gateway URL in.");
    const { data: sessionData } = await client!.auth.getSession();
    const jwt = sessionData.session?.access_token || "";
    if (!jwt) throw new Error("Je Supabase sessie is verlopen. Meld opnieuw aan.");
    const headers: Record<string, string> = {
      "content-type": "application/json",
      authorization: `Bearer ${jwt}`,
    };
    if (setupToken) headers["x-pulse-setup-token"] = setupToken;
    const res = await fetch(base + path, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new Error(String(json.error || `Gateway antwoordde ${res.status}`));
    return json;
  }

  async function refreshStatus() {
    if (!client || !cfg.gateway_url) return;
    try {
      const status = (await gateway("/admin/status", {})) as GatewayStatus;
      setGatewayState(status);
      const active = status.backend?.activeBackend;
      if (active && active !== syncedBackend.current) {
        syncedBackend.current = active;
        if (active === "external_postgres" && cfg.active_backend !== "external_postgres") {
          await saveConfig({
            previous_backend: cfg.active_backend,
            active_backend: "external_postgres",
            status: "active",
            activated_at: status.backend?.activatedAt || new Date().toISOString(),
          });
          setMsg("Omschakeling voltooid: PULSE Gateway gebruikt nu de eigen PostgreSQL-backend.");
        }
        if (active === "supabase" && cfg.active_backend === "external_postgres") {
          await saveConfig({ active_backend: "supabase", status: "rollback", activated_at: null });
        }
      }
    } catch {
      // Statuspolling blijft stil; expliciete acties tonen hun eigen foutmelding.
    }
  }

  useEffect(() => {
    if (!cfg.gateway_url) return;
    void refreshStatus();
    const timer = window.setInterval(() => void refreshStatus(), 2500);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.gateway_url, setupToken, cfg.active_backend]);

  async function run(kind: string, fn: () => Promise<void>) {
    setBusy(kind);
    setError("");
    setMsg("");
    try {
      await fn();
    } catch (caught) {
      const e = caught as { message?: string };
      setError(e?.message || String(caught));
    } finally {
      setBusy("");
    }
  }

  const connection = {
    host: host.trim(),
    port: Number(port || 5432),
    database: cfg.database_name.trim(),
    user: dbUser.trim(),
    password: dbPassword,
    ssl: cfg.ssl_required,
  };

  const migration = gatewayState.migration || {};
  const currentIndex = migration.current?.index || 0;
  const currentTotal = migration.current?.total || migration.tableTotal || 0;
  const progress = currentTotal > 0 ? Math.min(100, Math.max(0, Math.round((currentIndex / currentTotal) * 100))) : migration.status === "ready" ? 100 : 0;
  const verifiedTables = Object.values(migration.tables || {}).filter((t) => t.ok).length;
  const totalTables = Object.keys(migration.tables || {}).length;
  const runtimeBackend = gatewayState.backend?.activeBackend || cfg.active_backend;

  async function pairServer() {
    if (!setupToken) return;
    const result = await gateway("/admin/pair", {});
    await saveConfig({
      gateway_setup_complete: true,
      postgres_managed: Boolean(result.managedDocker ?? cfg.postgres_managed),
      gateway_version: "0.30.1",
    });
    setSetupToken("");
  }

  async function configureTarget() {
    if ((cfg.deployment_mode || "managed_docker") === "managed_docker") {
      if (setupToken) await pairServer();
      const testResult = await gateway("/admin/postgres/managed-test", {});
      setHost(String(testResult.host || "postgres"));
      setPort(String(testResult.port || 5432));
      setDbUser(String(testResult.user || "pulse_app"));
      setCfg((v) => ({ ...v, database_name: String(testResult.database || v.database_name || "pulse") }));
      await saveConfig({
        status: "tested",
        gateway_fingerprint: String(testResult.fingerprint || ""),
        last_test_at: new Date().toISOString(),
        postgres_managed: true,
        gateway_setup_complete: true,
        gateway_version: "0.30.1",
        target_host: String(testResult.host || "postgres"),
        target_port: Number(testResult.port || 5432),
        target_user: String(testResult.user || "pulse_app"),
        database_name: String(testResult.database || cfg.database_name || "pulse"),
      });
      return;
    }

    if (!dbPassword) throw new Error("Vul het PostgreSQL-wachtwoord in om de bestaande database veilig op de Gateway op te slaan.");
    const testResult = await gateway("/admin/postgres/test", { connection });
    await gateway("/admin/postgres/configure", { connection });
    await saveConfig({
      status: "tested",
      gateway_fingerprint: String(testResult.fingerprint || ""),
      last_test_at: new Date().toISOString(),
      postgres_managed: false,
      gateway_setup_complete: true,
      gateway_version: "0.30.1",
    });
    setDbPassword("");
  }

  function parsedOrigins() {
    const values = [cfg.public_site_url || "", ...extraOrigins.split(/[\n,]/g)]
      .map((v) => v.trim())
      .filter(Boolean);
    return Array.from(new Set(values));
  }

  async function saveDomainConfig() {
    const siteUrl = (cfg.public_site_url || "").trim().replace(/\/$/, "");
    const gatewayUrl = cfg.gateway_url.trim().replace(/\/$/, "");
    if (!siteUrl) throw new Error("Vul de publieke PULSE website-URL in.");
    if (!gatewayUrl) throw new Error("Vul de PULSE Data Gateway URL in.");
    let siteOrigin = "";
    try { siteOrigin = new URL(siteUrl).origin; } catch { throw new Error("De PULSE website-URL is niet geldig."); }
    const origins = Array.from(new Set([siteOrigin, ...parsedOrigins().map((v) => {
      try { return new URL(v).origin; } catch { return ""; }
    }).filter(Boolean)]));
    const result = await gateway("/admin/domains/update", {
      siteUrl,
      gatewayPublicUrl: gatewayUrl,
      allowedOrigins: origins,
    });
    await saveConfig({
      public_site_url: siteUrl,
      gateway_public_url: gatewayUrl,
      allowed_origins: origins,
      domain_status: "active",
      domain_updated_at: new Date().toISOString(),
    });
    setExtraOrigins(origins.filter((x) => x !== siteOrigin).join(", "));
    setMsg(`URL-instellingen bijgewerkt. Supabase Auth callback voor de nieuwe site: ${String(result.supabaseRedirectUrl || siteUrl + "/auth/callback")}`);
  }

  async function testDomainConfig() {
    const result = await gateway("/admin/domains/status", {});
    const allowed = Array.isArray(result.allowedOrigins) ? result.allowedOrigins.join(", ") : "";
    await saveConfig({ domain_status: "tested", domain_updated_at: new Date().toISOString() });
    setMsg(`Gateway URL-configuratie is actief${allowed ? ` voor: ${allowed}` : ""}.`);
  }

  async function oneClickSwitch() {
    const confirmed = window.confirm(
      "PULSE gaat de eigen PostgreSQL testen, voorbereiden, alle PULSE-tabellen kopiëren, controleren en daarna automatisch omschakelen. Bestaande PULSE-data op de DOELdatabase kan worden vervangen. De huidige Supabase-data wordt NIET verwijderd en blijft beschikbaar voor rollback. Doorgaan?",
    );
    if (!confirmed) return;
    if (setupToken && (cfg.deployment_mode || "managed_docker") !== "managed_docker") await pairServer();
    await configureTarget();
    await gateway("/admin/switch", {});
    await saveConfig({ status: "migrating" });
    setMsg("Volledige omschakeling gestart. Je mag dit scherm open laten; de voortgang wordt automatisch bijgewerkt.");
  }

  return (
    <section className={styles.shell}>
      <div className={styles.head}>
        <div>
          <h2>Database-backend</h2>
          <p>Supabase Auth blijft vast. PULSE-data en bijlagen kunnen gecontroleerd naar je eigen PostgreSQL-server.</p>
        </div>
        <span>{runtimeBackend === "external_postgres" ? "EIGEN POSTGRESQL ACTIEF" : "SUPABASE / POSTGRESQL"}</span>
      </div>

      <div className={styles.cards}>
        <Card k="LOGIN / ACCOUNTS" t="Supabase Auth blijft vast" p="Login, sessies, wachtwoorden en dezelfde user UUID's blijven bij Supabase Auth." />
        <Card k="ACTIEVE DATA-BACKEND" t={runtimeBackend === "external_postgres" ? "Eigen PostgreSQL" : "Supabase PostgreSQL"} p="De Gateway bewaakt welke databron actief is en behoudt rollback." />
        <Card k="OMSCHAKELING" t={stageLabels[migration.stage || "idle"] || cfg.status.replaceAll("_", " ")} p={migration.error || (runtimeBackend === "external_postgres" ? "Omschakeling voltooid." : "Activeren gebeurt pas na een volledige controle.")} />
      </div>

      <div className={styles.grid}>
        <label>
          Servermodus
          <select
            value={cfg.deployment_mode || "managed_docker"}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setCfg((v) => ({
              ...v,
              deployment_mode: e.target.value as Config["deployment_mode"],
              postgres_managed: e.target.value === "managed_docker",
            }))}
          >
            <option value="managed_docker">Beheerde PULSE Docker-server (aanbevolen)</option>
            <option value="existing_postgres">Bestaande PostgreSQL-server (gevorderd)</option>
          </select>
        </label>
        <label>
          Naam doelomgeving
          <input value={cfg.target_name} onChange={(e: ChangeEvent<HTMLInputElement>) => setCfg((v) => ({ ...v, target_name: e.target.value }))} placeholder="bv. PULSE Server" />
        </label>
        <label className={styles.span2}>
          PULSE Data Gateway URL
          <input value={cfg.gateway_url} onChange={(e: ChangeEvent<HTMLInputElement>) => setCfg((v) => ({ ...v, gateway_url: e.target.value }))} placeholder="https://pulse-data.jouwdomein.be" />
          <small>Deze URL krijg je na het uitvoeren van INSTALL_PULSE_DOCKER.ps1 op de nieuwe server.</small>
        </label>
        <label className={styles.span2}>
          Eenmalige server setup-code (alleen eerste koppeling)
          <input type="password" value={setupToken} onChange={(e: ChangeEvent<HTMLInputElement>) => setSetupToken(e.target.value)} autoComplete="off" placeholder="Plak de code uit PULSE_SERVER_KOPPELING.txt" />
          <small>Na de eerste succesvolle koppeling wordt deze code niet meer gevraagd. De code en het databasewachtwoord worden niet in Supabase opgeslagen.</small>
        </label>

        {(cfg.deployment_mode || "managed_docker") === "managed_docker" ? (
          <div className={`${styles.span2} ${styles.managedBox}`}>
            <div>
              <b>Automatisch beheerde PostgreSQL</b>
              <p>PULSE maakt de PostgreSQL-container, database <code>pulse</code>, gebruiker, sterk wachtwoord, intern Docker-netwerk, volumes en Gateway zelf aan. Poort 5432 wordt niet gepubliceerd.</p>
            </div>
            <div className={styles.managedFacts}>
              <span><b>Host</b> postgres</span>
              <span><b>Poort</b> 5432 intern</span>
              <span><b>Database</b> pulse</span>
              <span><b>DB-login</b> server-side gegenereerd</span>
            </div>
          </div>
        ) : (
          <>
            <label>
              PostgreSQL host
              <input value={host} onChange={(e: ChangeEvent<HTMLInputElement>) => setHost(e.target.value)} placeholder="192.168.1.20" />
            </label>
            <label>
              Poort
              <input value={port} onChange={(e: ChangeEvent<HTMLInputElement>) => setPort(e.target.value)} inputMode="numeric" />
            </label>
            <label>
              Database
              <input value={cfg.database_name} onChange={(e: ChangeEvent<HTMLInputElement>) => setCfg((v) => ({ ...v, database_name: e.target.value }))} placeholder="pulse" />
            </label>
            <label>
              Gebruiker
              <input value={dbUser} onChange={(e: ChangeEvent<HTMLInputElement>) => setDbUser(e.target.value)} autoComplete="off" placeholder="pulse_app" />
            </label>
            <label className={styles.span2}>
              Databasewachtwoord
              <input type="password" value={dbPassword} onChange={(e: ChangeEvent<HTMLInputElement>) => setDbPassword(e.target.value)} autoComplete="new-password" />
              <small>Alleen nodig wanneer je bewust een bestaande PostgreSQL-server gebruikt. Het wachtwoord wordt versleuteld op de Gateway bewaard.</small>
            </label>
            <label className={styles.check}><input type="checkbox" checked={cfg.ssl_required} onChange={(e: ChangeEvent<HTMLInputElement>) => setCfg((v) => ({ ...v, ssl_required: e.target.checked }))} /> SSL voor PostgreSQL verplicht</label>
          </>
        )}
        <label className={styles.check}><input type="checkbox" checked={replaceExisting} onChange={(e: ChangeEvent<HTMLInputElement>) => setReplaceExisting(e.target.checked)} /> Bestaande PULSE-doeldata bij handmatige migratie vervangen</label>
      </div>

      <div className={styles.domainPanel}>
        <div className={styles.domainHead}>
          <div>
            <small>DOMEINEN & URL'S</small>
            <h3>Website later verhuizen zonder datamigratie</h3>
            <p>De PULSE website-URL staat los van Supabase Auth en PostgreSQL. Na een verhuizing blijven accounts, UUID's en alle data behouden.</p>
          </div>
          <span>{cfg.domain_status === "active" || cfg.domain_status === "tested" ? "GECONFIGUREERD" : "NOG INSTELLEN"}</span>
        </div>
        <div className={styles.grid}>
          <label>
            Publieke PULSE website-URL
            <input
              value={cfg.public_site_url || ""}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCfg((v) => ({ ...v, public_site_url: e.target.value }))}
              placeholder="https://pulse.jouwdomein.be"
            />
            <small>Dit is de URL waarop gebruikers PULSE openen. Deze mag later volledig veranderen.</small>
          </label>
          <label>
            Publieke Gateway URL
            <input
              value={cfg.gateway_url}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setCfg((v) => ({ ...v, gateway_url: e.target.value, gateway_public_url: e.target.value }))}
              placeholder="https://api.pulse.jouwdomein.be"
            />
            <small>De website praat alleen met deze Gateway; PostgreSQL blijft intern in Docker.</small>
          </label>
          <label className={styles.span2}>
            Extra tijdelijk toegestane website-URL's
            <input
              value={extraOrigins}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setExtraOrigins(e.target.value)}
              placeholder="https://oude-site.vercel.app, https://preview.jouwdomein.be"
            />
            <small>Handig tijdens een domeinwissel: oud en nieuw kunnen tijdelijk tegelijk werken. Verwijder oude origins na de overstap.</small>
          </label>
        </div>
        <div className={styles.domainInfo}>
          <span><b>Supabase login blijft:</b> hetzelfde Auth-project</span>
          <span><b>Callback nieuwe site:</b> {(cfg.public_site_url || "https://pulse.jouwdomein.be").replace(/\/$/, "")}/auth/callback</span>
          <span><b>Datamigratie nodig:</b> nee</span>
        </div>
        <div className={styles.actions}>
          <button className={styles.primary} disabled={Boolean(busy)} onClick={() => void run("domains-save", saveDomainConfig)}>URL-instellingen opslaan & Gateway bijwerken</button>
          <button disabled={Boolean(busy)} onClick={() => void run("domains-test", testDomainConfig)}>URL-configuratie controleren</button>
        </div>
        <p className={styles.domainHint}>PULSE kan de interne configuratie en Gateway-CORS automatisch aanpassen. Het nieuwe domein zelf moet natuurlijk eerst bestaan in DNS/Vercel, en bij Supabase Auth moet de nieuwe redirect-URL één keer toegestaan zijn.</p>
      </div>

      <div className={styles.notice}>
        <b>Veilige omschakeling</b>
        <span>In beheerde Docker-modus vul je alleen Gateway URL + setup-code in. De server genereert de database-login zelf. De browser verbindt nooit rechtstreeks met PostgreSQL; Supabase Auth blijft de loginlaag en de oude Supabase-data blijft beschikbaar voor rollback.</span>
      </div>

      {(migration.status && migration.status !== "idle") && (
        <div className={styles.progressBox}>
          <div className={styles.progressHead}>
            <div><b>{stageLabels[migration.stage || ""] || migration.stage}</b><small>{migration.current?.table ? `Tabel: ${migration.current.table}` : ""}</small></div>
            <strong>{progress}%</strong>
          </div>
          <div className={styles.progressTrack}><span style={{ width: `${progress}%` }} /></div>
          <div className={styles.metrics}>
            <span><b>{verifiedTables}/{totalTables || migration.tableTotal || 0}</b> tabellen gecontroleerd</span>
            <span><b>{migration.files?.copied || 0}</b> bestanden gekopieerd</span>
            <span><b>{migration.files?.failed || 0}</b> bestandswaarschuwingen</span>
          </div>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}
      {msg && <div className={styles.ok}>{msg}</div>}

      <div className={styles.switchPanel}>
        <div>
          <small>VOLLEDIGE OMSCHAKELING</small>
          <h3>Van Supabase-data naar eigen PostgreSQL</h3>
          <p>Test → versleuteld opslaan → schema maken → alle tabellen kopiëren → relaties/indexen → controle → finale synchronisatie → activeren.</p>
        </div>
        <button
          className={styles.switchButton}
          disabled={Boolean(busy) || gatewayState.running || runtimeBackend === "external_postgres"}
          onClick={() => void run("oneclick", oneClickSwitch)}
        >
          {busy === "oneclick" ? "Voorbereiden…" : gatewayState.running ? "Migratie loopt…" : "Omschakelen naar eigen PostgreSQL"}
        </button>
      </div>

      <details className={styles.advanced}>
        <summary>Geavanceerde stappen / handmatig uitvoeren</summary>
        <div className={styles.actions}>
          <button onClick={() => void run("save", async () => { await saveConfig({ status: "configured" }); setMsg("Databaseplan opgeslagen."); })} disabled={Boolean(busy)}>Databaseplan opslaan</button>
          <button onClick={() => void run("test", async () => {
            await configureTarget();
            setMsg((cfg.deployment_mode || "managed_docker") === "managed_docker"
              ? "Gateway en de automatisch beheerde Docker-PostgreSQL zijn bereikbaar."
              : "Gateway en PostgreSQL zijn bereikbaar.");
          })} disabled={Boolean(busy)}>1. Verbinding testen</button>
          <button onClick={() => void run("configure", async () => {
            if (setupToken) await pairServer();
            await configureTarget();
            setMsg("PULSE-server gekoppeld. De setup-code is hierna niet meer nodig.");
          })} disabled={Boolean(busy)}>2. Server koppelen</button>
          <button className={styles.primary} onClick={() => void run("migrate", async () => {
            await gateway("/admin/migrate", { replaceExisting });
            await saveConfig({ status: "migrating" });
            setMsg("Migratie gestart.");
          })} disabled={Boolean(busy) || gatewayState.running}>3. Migreren & controleren</button>
          <button className={styles.primary} onClick={() => void run("activate", async () => {
            const r = await gateway("/admin/activate", {});
            await saveConfig({ previous_backend: cfg.active_backend, active_backend: "external_postgres", status: "active", activated_at: String(r.activatedAt || new Date().toISOString()) });
            setMsg("Eigen PostgreSQL is geactiveerd.");
          })} disabled={Boolean(busy) || gatewayState.running || migration.status !== "ready" || runtimeBackend === "external_postgres"}>4. Alleen activeren</button>
          <button className={styles.rollback} onClick={() => void run("rollback", async () => {
            await gateway("/admin/rollback", {});
            await saveConfig({ active_backend: "supabase", status: "rollback", activated_at: null });
            setMsg("Teruggeschakeld naar Supabase. De PostgreSQL-kopie is behouden.");
          })} disabled={Boolean(busy) || gatewayState.running || runtimeBackend !== "external_postgres"}>Rollback naar Supabase</button>
        </div>
      </details>
    </section>
  );
}

function Card({ k, t, p }: { k: string; t: string; p: string }) {
  return <div className={styles.card}><small>{k}</small><strong>{t}</strong><p>{p}</p></div>;
}

export default DatabaseBackendV2;
