-- VLACORA HUB 0.14.0 — remove accidental anonymous execution grants.
revoke execute on function public.rls_auto_enable() from anon, authenticated;
revoke execute on function public.sync_profile_email_from_auth() from anon, authenticated;
revoke execute on function public.vlacora_current_role() from anon;
revoke execute on function public.vlacora_can_access_station(text) from anon;
revoke execute on function public.vlacora_can_manage_setting(text) from anon;
revoke execute on function public.vlacora_can_manage_station(text) from anon;
revoke execute on function public.vlacora_replace_station_memberships(uuid,jsonb) from anon;
revoke execute on function public.vlacora_update_team_member(uuid,text,text,text,boolean,jsonb) from anon;
revoke execute on function public.vlacora_touch_last_seen() from anon;
revoke execute on function public.vlacora_update_own_profile(text,text) from anon;
