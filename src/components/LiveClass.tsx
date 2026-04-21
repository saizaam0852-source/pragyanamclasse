import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { Users } from "lucide-react";

// ════════════════════════════════════════════════════════════════
// 🔑 PASTE YOUR ZEGOCLOUD CREDENTIALS HERE
// Get them from: https://console.zegocloud.com/
// ════════════════════════════════════════════════════════════════
const ZEGO_APP_ID = 1303117872;
const ZEGO_SERVER_SECRET = "1d3468cc0670f7a121559be2b7a700cd";
// ════════════════════════════════════════════════════════════════

const SUPER_ADMIN_EMAIL = "superadmin5670@gmail.com";

interface LiveClassProps {
  roomID: string;
  forceHost?: boolean;
  onLeave?: () => void;
  onStudentJoin?: () => Promise<void> | void;
  onStudentLeave?: () => Promise<void> | void;
  onParticipantCountChange?: (count: number) => void;
  className?: string;
}

const LiveClass = ({
  roomID,
  forceHost,
  onLeave,
  onStudentJoin,
  onStudentLeave,
  onParticipantCountChange,
  className,
}: LiveClassProps) => {
  const { user, role, profile } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const zpRef = useRef<any>(null);
  const attendanceIdRef = useRef<string | null>(null);
  const joinedRef = useRef(false);
  const initStartedRef = useRef(false);
  const [participantCount, setParticipantCount] = useState(0);

  // Keep latest callbacks in refs so the init effect doesn't depend on them
  const cbRef = useRef({ onLeave, onStudentJoin, onStudentLeave, onParticipantCountChange });
  useEffect(() => {
    cbRef.current = { onLeave, onStudentJoin, onStudentLeave, onParticipantCountChange };
  }, [onLeave, onStudentJoin, onStudentLeave, onParticipantCountChange]);

  useEffect(() => {
    if (!user || !roomID || !containerRef.current) return;
    // Guard against React StrictMode double-mount and parent re-renders
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    let cancelled = false;
    const isAdminOrTeacher = role === "admin" || role === "teacher";
    const isSuperAdmin = user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    const isHost = !!forceHost || isAdminOrTeacher || isSuperAdmin;
    const userID = user.id;
    const userName = profile?.full_name || user.email || "User";

    const init = async () => {
      // 1. Fetch secure token from edge function
      const { data, error } = await supabase.functions.invoke("get-zego-token", {
        body: { roomID },
      });
      if (cancelled) return;
      if (error || !data?.token || !data?.appID) {
        console.error("[LiveClass] Token fetch failed:", error);
        initStartedRef.current = false;
        return;
      }

      // 2. Build kit token from server-issued token (kit token format string)
      // ZegoUIKitPrebuilt accepts a kit token string; reuse the test helper
      // shape by using the raw 04 token via generateKitTokenForProduction would
      // require server SDK. We pass the server-signed token directly.
      const kitToken = (ZegoUIKitPrebuilt as any).generateKitTokenForProduction
        ? (ZegoUIKitPrebuilt as any).generateKitTokenForProduction(
            Number(data.appID),
            data.token,
            roomID,
            userID,
            userName,
          )
        : // fallback (older SDK): build kit token manually
          buildKitToken(Number(data.appID), data.token, roomID, userID, userName);

      const markAttendanceJoin = async () => {
        if (isHost || joinedRef.current) return;
        joinedRef.current = true;
        const { data: existing } = await supabase
          .from("attendance")
          .select("id")
          .eq("student_id", userID)
          .eq("room_id", roomID)
          .is("leave_time", null)
          .order("join_time", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existing?.id) {
          attendanceIdRef.current = existing.id;
        } else {
          const { data: created } = await supabase
            .from("attendance")
            .insert({ student_id: userID, room_id: roomID, join_time: new Date().toISOString() } as any)
            .select("id")
            .single();
          attendanceIdRef.current = created?.id ?? null;
        }
        await cbRef.current.onStudentJoin?.();
      };

      const markAttendanceLeave = async () => {
        if (isHost) return;
        if (attendanceIdRef.current) {
          await supabase
            .from("attendance")
            .update({ leave_time: new Date().toISOString() } as any)
            .eq("id", attendanceIdRef.current);
        } else {
          await supabase
            .from("attendance")
            .update({ leave_time: new Date().toISOString() } as any)
            .eq("student_id", userID)
            .eq("room_id", roomID)
            .is("leave_time", null);
        }
        await cbRef.current.onStudentLeave?.();
      };

      const zp = ZegoUIKitPrebuilt.create(kitToken);
      zpRef.current = zp;

      zp.joinRoom({
        container: containerRef.current!,
        scenario: {
          mode: ZegoUIKitPrebuilt.LiveStreaming,
          config: {
            role: isHost ? ZegoUIKitPrebuilt.Host : ZegoUIKitPrebuilt.Audience,
          },
        },
        showPreJoinView: false,
        showUserList: false,
        showTextChat: false,
        showRoomDetailsButton: false,
        sharedLinks: [],
        // Force a layout that fills the container in landscape
        layout: "Auto",
        showLayoutButton: false,
        showScreenSharingButton: isHost,
        showMyMicrophoneToggleButton: isHost,
        showMyCameraToggleButton: isHost,
        onJoinRoom: () => {
          // Initial count: self + remote (we'll get accurate from onUserJoin)
          setParticipantCount((c) => {
            const next = Math.max(c, 1);
            cbRef.current.onParticipantCountChange?.(next);
            return next;
          });
          void markAttendanceJoin();
        },
        onLeaveRoom: () => {
          void markAttendanceLeave();
          cbRef.current.onLeave?.();
        },
        onUserJoin: (users: any[]) => {
          setParticipantCount((c) => {
            const next = c + (users?.length || 0);
            cbRef.current.onParticipantCountChange?.(next);
            return next;
          });
        },
        onUserLeave: (users: any[]) => {
          setParticipantCount((c) => {
            const next = Math.max(0, c - (users?.length || 0));
            cbRef.current.onParticipantCountChange?.(next);
            return next;
          });
        },
      });
    };

    void init();

    return () => {
      cancelled = true;
      try {
        zpRef.current?.destroy?.();
      } catch {}
      zpRef.current = null;
      attendanceIdRef.current = null;
      joinedRef.current = false;
      initStartedRef.current = false;
    };
    // Only depend on identity values that should *actually* re-init the room.
    // Do NOT depend on callback props — they change every parent render.
  }, [roomID, user?.id, role, forceHost]);

  if (!user) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-white text-sm">
        Please sign in to join the live class.
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full ${className ?? ""}`}>
      <div ref={containerRef} className="absolute inset-0 w-full h-full bg-black" />
      {/* Live participant pill — overlay top-left */}
      <div className="absolute top-3 left-3 z-20 pointer-events-none flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full">
        <Users className="w-3 h-3" />
        <span>{participantCount}</span>
        <span className="opacity-70 font-normal">live</span>
      </div>
    </div>
  );
};

// Fallback kit-token builder for older SDKs that lack
// generateKitTokenForProduction. Uses the same payload shape internally used by
// the prebuilt UIKit when handed a server-signed 04 token.
function buildKitToken(
  appID: number,
  token: string,
  roomID: string,
  userID: string,
  userName: string,
): any {
  return {
    app_id: appID,
    user_id: userID,
    user_name: userName,
    room_id: roomID,
    token,
  } as any;
}

export default LiveClass;
