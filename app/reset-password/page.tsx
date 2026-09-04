import ResetPasswordForm from "@/components/auth/reset-password-form";
import { isSupabaseServerConfigured } from "@/lib/supabase/server";

export default function ResetPasswordPage(){
  if(!isSupabaseServerConfigured())return <main className="login-page"><div className="login-card">
    <div className="login-brand pulse-login-brand"><img src="/brand/pulse-icon.png" alt="PULSE"/><div><strong>PULSE</strong><span>YOUR STATION. ONE TEAM. ALL IN SYNC.</span></div></div>
    <span className="eyebrow">ACCOUNT HERSTELLEN</span><h1>Login nog niet geactiveerd</h1>
    <p>Activeer eerst de centrale Supabase-login voordat wachtwoordherstel gebruikt kan worden.</p>
    <a className="ghost wide" href="/login">Terug naar login</a>
  </div></main>;
  return <main className="login-page"><ResetPasswordForm/></main>;
}
