import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find students whose subscription expires in exactly 3 days (±12 hours window)
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const windowStart = new Date(threeDaysFromNow.getTime() - 12 * 60 * 60 * 1000);
    const windowEnd = new Date(threeDaysFromNow.getTime() + 12 * 60 * 60 * 1000);

    const { data: expiringProfiles, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name, trial_ends_at")
      .eq("subscription_plan", "paid")
      .gte("trial_ends_at", windowStart.toISOString())
      .lte("trial_ends_at", windowEnd.toISOString());

    if (fetchError) throw new Error(`Fetch error: ${fetchError.message}`);

    let notified = 0;

    for (const profile of (expiringProfiles || [])) {
      // Check if we already sent a reminder for this cycle
      const { data: existing } = await supabaseAdmin
        .from("notifications")
        .select("id")
        .eq("user_id", profile.user_id)
        .eq("type", "renewal")
        .gte("created_at", new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (existing && existing.length > 0) continue;

      const { error: insertError } = await supabaseAdmin
        .from("notifications")
        .insert({
          user_id: profile.user_id,
          title: "Subscription Expiring Soon! ⏰",
          message: `${profile.full_name}, your subscription expires in 3 days. Renew now to continue enjoying all features. आपकी सदस्यता 3 दिनों में समाप्त हो रही है। सभी सुविधाओं का आनंद लेने के लिए अभी नवीनीकरण करें।`,
          type: "renewal",
        });

      if (!insertError) notified++;
    }

    return new Response(
      JSON.stringify({ success: true, notified, checked: expiringProfiles?.length || 0 }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
