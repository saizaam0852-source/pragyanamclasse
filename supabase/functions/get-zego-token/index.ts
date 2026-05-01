// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TOKEN_TTL_SECONDS = 7200;
const RL_WINDOW_MS = 60_000;
const RL_MAX = 30;
const rlMap = new Map<string, { count: number; resetAt: number }>();

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function rateLimit(key: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const current = rlMap.get(key);

  if (!current || current.resetAt <= now) {
    rlMap.set(key, { count: 1, resetAt: now + RL_WINDOW_MS });
    return { ok: true };
  }

  if (current.count >= RL_MAX) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }

  current.count += 1;
  return { ok: true };
}

function normalizeZegoId(value: string, fallbackPrefix: string) {
  const cleaned = value.replace(/[^A-Za-z0-9_]/g, "").slice(0, 64);
  return cleaned || `${fallbackPrefix}${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

function makeNonce() {
  const bytes = crypto.getRandomValues(new Uint32Array(1))[0];
  return (bytes % 4_294_967_296) - 2_147_483_648;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function generateToken04(
  appId: number,
  userId: string,
  secret: string,
  effectiveTimeInSeconds: number,
  payload: string,
) {
  const secretBytes = new TextEncoder().encode(secret);
  if (!appId || !Number.isFinite(appId)) throw new Error("Invalid ZEGO app ID");
  if (!userId || userId.length > 64) throw new Error("Invalid ZEGO user ID");
  if (secretBytes.byteLength !== 32) throw new Error("ZEGO server secret must be 32 bytes");
  if (effectiveTimeInSeconds <= 0) throw new Error("Invalid token TTL");

  const now = Math.floor(Date.now() / 1000);
  const tokenInfo = {
    app_id: appId,
    user_id: userId,
    nonce: makeNonce(),
    ctime: now,
    expire: now + effectiveTimeInSeconds,
    payload: payload || "",
  };

  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await crypto.subtle.importKey("raw", secretBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      cryptoKey,
      new TextEncoder().encode(JSON.stringify(tokenInfo)),
    ),
  );

  const expireBytes = new Uint8Array(8);
  new DataView(expireBytes.buffer).setBigInt64(0, BigInt(tokenInfo.expire), false);

  const nonceLengthBytes = new Uint8Array(2);
  new DataView(nonceLengthBytes.buffer).setUint16(0, nonce.byteLength, false);

  const encryptedLengthBytes = new Uint8Array(2);
  new DataView(encryptedLengthBytes.buffer).setUint16(0, encrypted.byteLength, false);

  const modeBytes = new Uint8Array([1]);
  const output = new Uint8Array(
    expireBytes.byteLength +
      nonceLengthBytes.byteLength +
      nonce.byteLength +
      encryptedLengthBytes.byteLength +
      encrypted.byteLength +
      modeBytes.byteLength,
  );

  let offset = 0;
  output.set(expireBytes, offset);
  offset += expireBytes.byteLength;
  output.set(nonceLengthBytes, offset);
  offset += nonceLengthBytes.byteLength;
  output.set(nonce, offset);
  offset += nonce.byteLength;
  output.set(encryptedLengthBytes, offset);
  offset += encryptedLengthBytes.byteLength;
  output.set(encrypted, offset);
  offset += encrypted.byteLength;
  output.set(modeBytes, offset);

  return `04${bytesToBase64(output)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const ZEGO_APP_ID = Number(Deno.env.get("ZEGO_APP_ID") || "0");
    const ZEGO_SERVER_SECRET = Deno.env.get("ZEGO_SERVER_SECRET") || "";

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Backend configuration missing" }, 500);
    }

    if (!ZEGO_APP_ID || !ZEGO_SERVER_SECRET) {
      return jsonResponse({ error: "Live class service is not configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Please sign in again" }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return jsonResponse({ error: "Please sign in again" }, 401);
    }

    const user = authData.user;
    const limited = rateLimit(user.id);
    if (!limited.ok) {
      return new Response(JSON.stringify({ error: "Too many token requests", retryAfter: limited.retryAfter }), {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(limited.retryAfter || 60),
        },
      });
    }

    const body = await req.json().catch(() => ({}));
    const requestedRoomID = String(body.roomID || "").trim();
    if (!requestedRoomID || requestedRoomID.length > 128) {
      return jsonResponse({ error: "Invalid live class room" }, 400);
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: liveClass, error: classError } = await adminClient
      .from("live_classes")
      .select("id, room_id, teacher_id, course_id, status, title")
      .eq("room_id", requestedRoomID)
      .maybeSingle();

    if (classError) {
      console.error("[get-zego-token] live_classes lookup failed", classError);
      return jsonResponse({ error: "Unable to load live class" }, 500);
    }

    if (!liveClass) {
      return jsonResponse({ error: "Live class room not found" }, 404);
    }

    const { data: roleRows, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (roleError) {
      console.error("[get-zego-token] user_roles lookup failed", roleError);
      return jsonResponse({ error: "Unable to verify account role" }, 500);
    }

    const roles = new Set((roleRows || []).map((row: any) => row.role));
    const isAdmin = roles.has("admin");
    const isTeacher = roles.has("teacher");
    const isAssignedTeacher = liveClass.teacher_id === user.id;
    const canPublish = isAdmin || (isTeacher && isAssignedTeacher);
    let canJoin = canPublish || isAdmin || isTeacher;
    let trackAttendance = false;

    if (!canJoin) {
      if (liveClass.status !== "live") {
        return jsonResponse({ error: "Class has not started yet" }, 403);
      }

      if (!liveClass.course_id) {
        canJoin = true;
      } else {
        const { data: enrollment, error: enrollmentError } = await adminClient
          .from("enrollments")
          .select("id")
          .eq("user_id", user.id)
          .eq("course_id", liveClass.course_id)
          .eq("status", "active")
          .maybeSingle();

        if (enrollmentError) {
          console.error("[get-zego-token] enrollment lookup failed", enrollmentError);
          return jsonResponse({ error: "Unable to verify enrollment" }, 500);
        }

        canJoin = !!enrollment;
      }

      trackAttendance = canJoin;
    }

    if (!canJoin) {
      return jsonResponse({ error: "You are not enrolled in this live class" }, 403);
    }

    const zegoRoomID = normalizeZegoId(liveClass.room_id || liveClass.id, "room_");
    const zegoUserID = normalizeZegoId(user.id, "user_");
    const payload = JSON.stringify({
      room_id: zegoRoomID,
      privilege: {
        1: 1,
        2: canPublish ? 1 : 0,
      },
      stream_id_list: null,
    });
    const token = await generateToken04(ZEGO_APP_ID, zegoUserID, ZEGO_SERVER_SECRET, TOKEN_TTL_SECONDS, payload);

    return jsonResponse({
      token,
      appID: ZEGO_APP_ID,
      userID: zegoUserID,
      roomID: zegoRoomID,
      originalRoomID: liveClass.room_id,
      canPublish,
      trackAttendance,
      classStatus: liveClass.status,
    });
  } catch (error) {
    console.error("[get-zego-token] error", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unable to join live class" }, 500);
  }
});
