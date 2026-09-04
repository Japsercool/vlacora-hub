import type { SupabaseClient } from "@supabase/supabase-js";

export async function markAnnouncementRead(client: SupabaseClient, announcementId: string, userId: string) {
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("hub_announcement_recipients")
    .select("first_read_at")
    .eq("announcement_id", announcementId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  const patch = { last_read_at: now, first_read_at: data?.first_read_at || now };
  const { error: updateError } = await client
    .from("hub_announcement_recipients")
    .update(patch)
    .eq("announcement_id", announcementId)
    .eq("user_id", userId);
  if (updateError) throw updateError;
}

export async function acknowledgeAnnouncement(client: SupabaseClient, announcementId: string, userId: string) {
  const { error } = await client
    .from("hub_announcement_recipients")
    .update({ acknowledged_at: new Date().toISOString() })
    .eq("announcement_id", announcementId)
    .eq("user_id", userId);
  if (error) throw error;
}
