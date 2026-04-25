// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Simple in-memory rate limiter (per user, per minute) ───
// Note: edge function instances are short-lived, this is best-effort.
const RL_WINDOW_MS = 60_000;
const RL_MAX = 30; // 30 token requests / minute / user
const rlMap = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rlMap.get(key);
  if (!entry || entry.resetAt < now) {
    rlMap.set(key, { count: 1, resetAt: now + RL_WINDOW_MS });
    return { ok: true };
  }
  if (entry.count >= RL_MAX) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { ok: true };
}

// ─── ZEGO Kit Token 04 generator ───
// Mirrors the current official @zegocloud server assistant generateToken04 logic.
async function generateZegoToken04(
  appId: number,
  userId: string,
  serverSecret: string,
  effectiveTimeInSeconds: number,
  payload: string,
): Promise<string> {
  if (!appId || !serverSecret || serverSecret.length !== 32) {
    throw new Error("Invalid appId or serverSecret (must be 32 chars)");
  }
  const createTime = Math.floor(Date.now() / 1000);
  const tokenInfo = {
    app_id: appId,
    user_id: userId,
    nonce: Math.floor(Math.random() * 2147483647) - Math.floor(Math.random() * 2147483647),
    ctime: createTime,
    expire: createTime + effectiveTimeInSeconds,
    payload: payload || "",
  };

  const plainText = JSON.stringify(tokenInfo);
  // Current Token04 uses AES-256-GCM with a 12-byte nonce and appends the
  // encrypt-mode byte. CBC tokens can leave UIKit stuck on a black/connecting screen.
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const keyBytes = new TextEncoder().encode(serverSecret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const ptBytes = new TextEncoder().encode(plainText);
  const encryptedBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    cryptoKey,
    ptBytes,
  );
  const encrypted = new Uint8Array(encryptedBuf);

  // Build binary: [expire(8 BE)] [nonce_len(2 BE)] [nonce(12)] [encrypted_len(2 BE)] [encrypted] [mode=1]
  const expireBuf = new ArrayBuffer(8);
  new DataView(expireBuf).setBigInt64(0, BigInt(tokenInfo.expire), false);
  const expireBytes = new Uint8Array(expireBuf);

  const nonceLen = new Uint8Array(2);
  new DataView(nonceLen.buffer).setUint16(0, nonce.length, false);

  const encryptedLen = new Uint8Array(2);
  new DataView(encryptedLen.buffer).setUint16(0, encrypted.length, false);

  const mode = new Uint8Array([1]); // AesEncryptMode.GCM

  const total = new Uint8Array(
    expireBytes.length + nonceLen.length + nonce.length + encryptedLen.length + encrypted.length + mode.length,
  );
  let off = 0;
  total.set(expireBytes, off); off += expireBytes.length;
  total.set(nonceLen, off); off += nonceLen.length;
  total.set(nonce, off); off += nonce.length;
  total.set(encryptedLen, off); off += encryptedLen.length;
  total.set(encrypted, off); off += encrypted.length;
  total.set(mode, off);

  // Base64 encode
  let bin = "";
  for (let i = 0; i < total.length; i++) bin += String.fromCharCode(total[i]);
  const b64 = btoa(bin);

  return "04" + b64;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ZEGO_APP_ID = Number(Deno.env.get("ZEGO_APP_ID") || "0");
    const ZEGO_SERVER_SECRET = Deno.env.get("ZEGO_SERVER_SECRET") || "";

    if (!ZEGO_APP_ID || !ZEGO_SERVER_SECRET) {
      return new Response(
        JSON.stringify({ error: "ZEGO credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate JWT from Authorization header
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit per user
    const rl = rateLimit(user.id);
    if (!rl.ok) {
      return new Response(
        JSON.stringify({ error: "Too many requests", retryAfter: rl.retryAfter }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(rl.retryAfter || 60),
          },
        },
      );
    }

    const body = await req.json().catch(() => ({}));
    const roomID = String(body.roomID || "").trim();
    if (!roomID || roomID.length > 128) {
      return new Response(JSON.stringify({ error: "Invalid roomID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: roleRows } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const roles = new Set((roleRows || []).map((row: any) => row.role));
    const isAdmin = roles.has("admin");
    const isTeacher = roles.has("teacher");

    const { data: liveClass } = await adminClient
      .from("live_classes")
      .select("id, teacher_id, course_id, status")
      .eq("room_id", roomID)
      .maybeSingle();

    let canJoin = isAdmin || isTeacher;
    let canPublish = isAdmin || (isTeacher && (!liveClass || liveClass.teacher_id === user.id));

    if (!canJoin && liveClass?.status === "live") {
      if (!liveClass.course_id) {
        canJoin = true;
      } else {
        const { data: enrollment } = await adminClient
          .from("enrollments")
          .select("id")
          .eq("user_id", user.id)
          .eq("course_id", liveClass.course_id)
          .eq("status", "active")
          .maybeSingle();
        canJoin = !!enrollment;
      }
    }

    if (!canJoin) {
      return new Response(JSON.stringify({ error: "Not allowed to join this live class" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.stringify({
      room_id: roomID,
      privilege: {
        1: 1, // login room
        2: canPublish ? 1 : 0, // publish stream
      },
      stream_id_list: null,
    });

    // Token valid for 2 hours
    const token = await generateZegoToken04(
      ZEGO_APP_ID,
      user.id,
      ZEGO_SERVER_SECRET,
      7200,
      payload,
    );

    return new Response(
      JSON.stringify({ token, appID: ZEGO_APP_ID, userID: user.id, canPublish }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[get-zego-token] error:", e);
    return new Response(
      JSON.stringify({ error: e?.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
