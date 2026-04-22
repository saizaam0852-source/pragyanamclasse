import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const meta = user.user_metadata || {};
    const subscriptionPlan = meta.subscription_plan === "free" ? "free" : "paid";
    const isFreeStudent = Boolean(meta.is_free_student) || subscriptionPlan === "free";
    const desiredRole = meta.role === "admin" || meta.role === "teacher" ? meta.role : "student";

    const profilePayload = {
      user_id: user.id,
      full_name: meta.full_name || user.email?.split("@")[0] || "",
      phone: meta.phone || null,
      parent_phone: meta.parent_phone || null,
      school: meta.school || null,
      class_level: meta.class_level || null,
      state: meta.state || null,
      district: meta.district || null,
      qualification: meta.qualification || null,
      subjects_taught: meta.subjects_taught || null,
      subscription_plan: subscriptionPlan,
      is_free_student: isFreeStudent,
      is_verified: desiredRole === "teacher" ? false : !isFreeStudent,
      trial_starts_at: subscriptionPlan === "paid" ? (meta.trial_starts_at || new Date().toISOString()) : null,
      trial_ends_at: subscriptionPlan === "paid"
        ? (meta.trial_ends_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
        : null,
      onboarding_completed: false,
    };

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(profilePayload, { onConflict: "user_id" });

    if (profileError) {
      throw new Error(profileError.message);
    }

    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existingRole) {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: user.id, role: desiredRole });
      if (roleError) {
        throw new Error(roleError.message);
      }
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    return new Response(JSON.stringify({ profile, role: roleRow?.role || desiredRole }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[ensure-user-account]", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
