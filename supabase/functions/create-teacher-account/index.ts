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

    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Only admins can create teacher accounts" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    const full_name = String(body.full_name || "").trim();

    if (!email || !password || password.length < 6 || !full_name) {
      return new Response(JSON.stringify({ error: "Name, email and password are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metadata = {
      role: "teacher",
      full_name,
      phone: body.phone || null,
      school: body.school || null,
      state: body.state || null,
      district: body.district || null,
      qualification: body.qualification || null,
      subjects_taught: body.subjects_taught || null,
      subscription_plan: "paid",
      is_free_student: false,
    };

    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });

    if (createError || !createdUser.user) {
      throw new Error(createError?.message || "Unable to create teacher account");
    }

    const teacherId = createdUser.user.id;

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      user_id: teacherId,
      full_name,
      phone: metadata.phone,
      school: metadata.school,
      state: metadata.state,
      district: metadata.district,
      qualification: metadata.qualification,
      subjects_taught: metadata.subjects_taught,
      subscription_plan: "paid",
      is_free_student: false,
      is_verified: true,
      trial_starts_at: new Date().toISOString(),
      trial_ends_at: null,
      onboarding_completed: true,
    }, { onConflict: "user_id" });

    if (profileError) {
      throw new Error(profileError.message);
    }

    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: teacherId,
      role: "teacher",
    });

    if (roleError) {
      throw new Error(roleError.message);
    }

    return new Response(JSON.stringify({ user_id: teacherId, email, full_name }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[create-teacher-account]", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
