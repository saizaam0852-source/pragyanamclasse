// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2.95.0/cors";

const ZEGO_APP_ID = Number(Deno.env.get("ZEGO_APP_ID") || "0");
const ZEGO_SERVER_SECRET = Deno.env.get("ZEGO_SERVER_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ---- Token04 generator -----------------------------------------------------------
function makeRandomIv(): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  let result = "";
  const random = new Uint8Array(16);
  crypto.getRandomValues(random);
  for (let i = 0; i < 16; i++) result += alphabet[random[i] % alphabet.length];
  return result;
}

async function aesCbcEncrypt(keyBytes: Uint8Array, iv: Uint8Array, plaintext: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-CBC" }, false, ["encrypt"]);
  const cipher = await crypto.subtle.encrypt({ name: "AES-CBC", iv }, key, plaintext);
  return new Uint8Array(cipher);
}

function concatBytes(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}

function int64BE(n: number | bigint): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigInt64(0, BigInt(n), false);
  return b;
}

function int16BE(n: number): Uint8Array {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n, false);
  return b;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

async function generateToken04(
  appId: number,
  userId: string,
  serverSecret: string,
  effectiveTimeInSeconds: number,
  payload: string,
): Promise<string> {
  if (!appId || !serverSecret || serverSecret.length !== 32) {
    throw new Error("Invalid Zego appId or serverSecret (secret must be 32 chars)");
  }
  const createTime = Math.floor(Date.now() / 1000);
  const expireTime = createTime + effectiveTimeInSeconds;
  const nonce = Math.floor(-2147483648 + Math.random() * 4294967295);

  const enc = new TextEncoder();
  const tokenInfo = JSON.stringify({
    app_id: appId,
    user_id: userId,
    nonce,
    ctime: createTime,
    expire: expireTime,
    payload: payload || "",
  });

  // Matches ZEGOCLOUD's official Token04 Node helper: AES-CBC + a 16-char IV,
  // then pack expire | iv length | iv | encrypted length | encrypted body.
  const ivText = makeRandomIv();
  const iv = enc.encode(ivText);
  const keyBytes = enc.encode(serverSecret);
  const encrypted = await aesCbcEncrypt(keyBytes, iv, enc.encode(tokenInfo));

  const body = concatBytes(
    int64BE(expireTime),
    int16BE(iv.length),
    iv,
    int16BE(encrypted.length),
    encrypted,
  );

  return "04" + bytesToB64(body);
}

// ----- Helpers --------------------------------------------------------------------
function normalizeId(input: string, prefix = ""): string {
  const cleaned = (input || "").replace(/[^a-zA-Z0-9_]/g, "");
  return (prefix + cleaned).slice(0, 64);
}

// ----- Rate limiter (in-memory, per instance) -------------------------------------
// Sliding window per IP. Supabase runs multiple isolates, so this is best-effort
// burst protection rather than a strict global limit.
const RL_WINDOW_MS = 60_000;
const RL_MAX = 20; // 20 requests per IP per minute
const ipHits = new Map<string, number[]>();

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") || "";
  return (
    fwd.split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function rateLimit(ip: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const arr = (ipHits.get(ip) || []).filter((t) => now - t < RL_WINDOW_MS);
  if (arr.length >= RL_MAX) {
    ipHits.set(ip, arr);
    return { allowed: false, retryAfter: Math.ceil((RL_WINDOW_MS - (now - arr[0])) / 1000) };
  }
  arr.push(now);
  ipHits.set(ip, arr);
  if (ipHits.size > 5000) {
    for (const [k, v] of ipHits) {
      const f = v.filter((t) => now - t < RL_WINDOW_MS);
      if (f.length === 0) ipHits.delete(k); else ipHits.set(k, f);
    }
  }
  return { allowed: true, retryAfter: 0 };
}

// ----- Handler --------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const ip = getClientIp(req);
  const rl = rateLimit(ip);
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please wait and try again." }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(rl.retryAfter),
        },
      },
    );
  }

  try {
    if (!ZEGO_APP_ID || !ZEGO_SERVER_SECRET) {
      return new Response(JSON.stringify({ error: "Zego credentials missing on server" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid auth token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    await supabase.rpc("auto_update_live_classes").catch(() => null);

    const body = await req.json().catch(() => ({}));
    const classId: string | undefined = body.classId;
    if (!classId) {
      return new Response(JSON.stringify({ error: "classId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load live class
    const { data: liveClass, error: lcErr } = await supabase
      .from("live_classes")
      .select("id, room_id, teacher_id, course_id, title, status")
      .eq("id", classId)
      .maybeSingle();

    if (lcErr || !liveClass) {
      return new Response(JSON.stringify({ error: "Live class not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (liveClass.status !== "live") {
      return new Response(JSON.stringify({ error: "Class is not live yet" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine role
    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id);
    const roles = (roleRow || []).map((r: any) => r.role);
    const isAdmin = roles.includes("admin");
    const isTeacher = roles.includes("teacher");
    const isOwner = liveClass.teacher_id === user.id;
    const canHost = isAdmin || (isTeacher && isOwner);

    // If student, must be enrolled (when class is tied to a course)
    if (!canHost && liveClass.course_id) {
      const { data: enrolment } = await supabase
        .from("enrollments")
        .select("id")
        .eq("user_id", user.id)
        .eq("course_id", liveClass.course_id)
        .eq("status", "active")
        .maybeSingle();
      if (!enrolment) {
        return new Response(JSON.stringify({ error: "Not enrolled in this course" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Build ids — must be alphanumeric/underscore for Zego
    const roomID = normalizeId(liveClass.room_id || liveClass.id, "room_");
    const userID = normalizeId(user.id, "u_");

    // Fetch profile name
    const { data: profile } = await supabase
      .from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
    const userName = (profile?.full_name || user.email || "User").slice(0, 64);

    // Build payload (token04 room privileges)
    const payload = JSON.stringify({
      room_id: roomID,
      privilege: { 1: 1, 2: canHost ? 1 : 0 }, // 1 = login, 2 = publish
      stream_id_list: null,
    });

    const token = await generateToken04(ZEGO_APP_ID, userID, ZEGO_SERVER_SECRET, 7200, payload);

    return new Response(JSON.stringify({
      token,
      appID: ZEGO_APP_ID,
      roomID,
      userID,
      userName,
      role: canHost ? "host" : "audience",
      classTitle: liveClass.title,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("get-zego-token error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
