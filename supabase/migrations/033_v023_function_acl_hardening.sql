-- VLACORA HUB 0.23.0 — explicit ACL hardening for newly introduced SECURITY DEFINER helpers.

revoke all on function public.vlacora_clone_station_configuration(text,text,text[]) from public, anon;
grant execute on function public.vlacora_clone_station_configuration(text,text,text[]) to authenticated;

revoke all on function public.vlacora_set_profile_avatar(uuid,text) from public, anon;
grant execute on function public.vlacora_set_profile_avatar(uuid,text) to authenticated;

-- This helper is used by RLS/storage policies. Signed-in callers may execute it,
-- but it must not be reachable from an unauthenticated API request.
revoke all on function public.vlacora_can_read_attachment(public.hub_attachments) from public, anon;
grant execute on function public.vlacora_can_read_attachment(public.hub_attachments) to authenticated;

-- Trigger functions are never intended as RPC endpoints.
revoke all on function public.vlacora_editorial_revision_before_save() from public, anon, authenticated;
revoke all on function public.vlacora_editorial_version_after_save() from public, anon, authenticated;
revoke all on function public.vlacora_sync_program_override_from_coverage() from public, anon, authenticated;
