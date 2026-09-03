-- VLACORA HUB 0.23.1 — helper functions are needed by authenticated RLS checks,
-- but anonymous clients must not execute them directly.
revoke execute on function public.vlacora_can_manage_chat_channel(uuid) from anon;
revoke execute on function public.vlacora_can_read_chat_channel(uuid) from anon;
