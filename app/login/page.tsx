import LoginForm from "@/components/auth/login-form";
import { isSupabaseServerConfigured } from "@/lib/supabase/server";

export default function LoginPage({searchParams}:{searchParams?:{error?:string}}){
  const configured=isSupabaseServerConfigured();
  const resetError=searchParams?.error==="reset-link-invalid";
  const disabledError=searchParams?.error==="account-disabled";
  return <main className="login-page">{configured?<div className="login-page-stack">
    {resetError&&<div className="login-global-error">De resetlink is ongeldig of verlopen. Vraag hieronder een nieuwe link aan.</div>}
    {disabledError&&<div className="login-global-error">Dit VLACORA-account is uitgeschakeld. Neem contact op met een beheerder.</div>}
    <LoginForm/>
  </div>:<div className="login-card">
    <div className="login-brand"><div className="brand-mark">V</div><div><strong>VLACORA</strong><span>HUB</span></div></div>
    <span className="eyebrow">EENMALIGE LOGIN SETUP</span><h1>Echte teamlogin is ingebouwd</h1>
    <p>Voor een echte beveiligingsgrens moet één Supabase-project centraal aan deze deployment gekoppeld zijn. Dat kan met twee publieke Vercel-waarden óf door de twee publieke waarden in <code>lib/supabase/public-config.ts</code> te plakken.</p>
    <div className="auth-setup-values"><code>NEXT_PUBLIC_SUPABASE_URL</code><code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code></div>
    <div className="auth-setup-note">Voer daarnaast één keer de meegeleverde Supabase-migraties uit en maak je gebruikers aan onder Auth → Users. De HUB blijft gesloten zolang Supabase Auth niet is geconfigureerd.</div>
  </div>}</main>
}
