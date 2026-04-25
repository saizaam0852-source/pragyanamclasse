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

// ─── ZEGO Kit Token 04 generator (HMAC-SHA256) ───
// Mirrors @zegocloud/zego-server-assistant generateToken04 logic.
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

  const plaintext = JSON.stringify(tokenInfo);
  // ZEGOCLOUD Token04 uses AES-CBC with the full 32-character server secret
  // as the 256-bit key. Using only the first 16 bytes creates tokens that can
  // appear to join the room but fail to subscribe to the host stream.
  const ivText = Math.random().toString().slice(2, 18).padEnd(16, "0");
  const iv = new TextEncoder().encode(ivText);
  const keyBytes = new TextEncoder().encode(serverSecret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-CBC" },
    false,
    ["encrypt"],
  );
  const ptBytes = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv },
    cryptoKey,
    ptBytes,
  );
  const cipher = new Uint8Array(cipherBuf);

  // Build binary: [expire(8 BE)] [iv_len(2 BE)] [iv(16)] [cipher_len(2 BE)] [cipher]
  const expireBuf = new ArrayBuffer(8);
  new DataView(expireBuf).setBigInt64(0, BigInt(tokenInfo.expire), false);
  const expireBytes = new Uint8Array(expireBuf);

  const ivLen = new Uint8Array(2);
  new DataView(ivLen.buffer).setUint16(0, iv.length, false);

  const cipherLen = new Uint8Array(2);
  new DataView(cipherLen.buffer).setUint16(0, cipher.length, false);

  const total = new Uint8Array(
    expireBytes.length + ivLen.length + iv.length + cipherLen.length + cipher.length,
  );
  let off = 0;
  total.set(expireBytes, off); off += expireBytes.length;
  total.set(ivLen, off); off += ivLen.length;
  total.set(iv, off); off += iv.length;
  total.set(cipherLen, off); off += cipherLen.length;
  total.set(cipher, off);

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

    // Token valid for 2 hours
    const token = await generateZegoToken04(
      ZEGO_APP_ID,
      user.id,
      ZEGO_SERVER_SECRET,
      7200,
      "",
    );

    return new Response(
      JSON.stringify({ token, appID: ZEGO_APP_ID, userID: user.id }),
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
