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
  const retryTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const suppressLeaveRef = useRef(false);
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
    reconnectAttemptsRef.current = 0;
    suppressLeaveRef.current = false;

    let cancelled = false;
    const isAdminOrTeacher = role === "admin" || role === "teacher";
    const isSuperAdmin = user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    const isHost = !!forceHost || isAdminOrTeacher || isSuperAdmin;
    const userID = user.id;
    const userName = profile?.full_name || user.email || "User";
    const MAX_AUDIENCE_RETRIES = 2;
    const AUDIENCE_RECOVERY_DELAY_MS = 8000;

    const clearAudienceRetryTimer = () => {
      if (retryTimeoutRef.current !== null) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };

    const hasPlayableRemoteVideo = () => {
      const container = containerRef.current;
      if (!container) return false;

      const videos = Array.from(container.querySelectorAll("video")) as HTMLVideoElement[];
      return videos.some((video) => {
        const hasFrame = video.readyState >= 2;
        const hasVisibleSize = (video.videoWidth || 0) > 0 || video.clientHeight > 0 || video.clientWidth > 0;
        return hasFrame && hasVisibleSize && !video.paused;
      });
    };

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
      if (isHost || suppressLeaveRef.current) return;
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

    const scheduleAudienceRecovery = (attempt: number) => {
      if (isHost || cancelled) return;

      clearAudienceRetryTimer();
      retryTimeoutRef.current = window.setTimeout(() => {
        if (cancelled || reconnectAttemptsRef.current >= MAX_AUDIENCE_RETRIES) return;
        if (hasPlayableRemoteVideo()) return;

        reconnectAttemptsRef.current = attempt + 1;
        suppressLeaveRef.current = true;

        try {
          zpRef.current?.destroy?.();
        } catch {}

        zpRef.current = null;
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
        }

        window.setTimeout(() => {
          suppressLeaveRef.current = false;
          if (!cancelled) {
            void init(reconnectAttemptsRef.current);
          }
        }, 600);
      }, AUDIENCE_RECOVERY_DELAY_MS);
    };

    const init = async (attempt = 0) => {
      let kitToken: any;

      if (isHost) {
        kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          ZEGO_APP_ID,
          ZEGO_SERVER_SECRET,
          roomID,
          userID,
          userName,
        );
      } else {
        // Audience: also use test token with the SAME APP_ID/SECRET as host.
        // This guarantees host & audience are in the exact same Zego app + room.
        kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          ZEGO_APP_ID,
          ZEGO_SERVER_SECRET,
          roomID,
          userID,
          userName,
        );
      }

      if (cancelled) return;

      const zp = ZegoUIKitPrebuilt.create(kitToken);
      zpRef.current = zp;

      zp.joinRoom({
        container: containerRef.current!,
        scenario: {
          mode: ZegoUIKitPrebuilt.LiveStreaming,
          config: {
            role: isHost ? ZegoUIKitPrebuilt.Host : ZegoUIKitPrebuilt.Audience,
            liveStreamingMode: "LiveStreaming" as any,
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
        // Host controls only for host. Audience must NOT publish streams.
        showScreenSharingButton: isHost,
        showMyMicrophoneToggleButton: isHost,
        showMyCameraToggleButton: isHost,
        showAudioVideoSettingsButton: isHost,
        showTurnOffRemoteCameraButton: isHost,
        showTurnOffRemoteMicrophoneButton: isHost,
        showRemoveUserButton: isHost,
        // Audience: only subscribe, never publish
        turnOnMicrophoneWhenJoining: isHost,
        turnOnCameraWhenJoining: isHost,
        useFrontFacingCamera: true,
        showNonVideoUser: true,
        onJoinRoom: () => {
          setParticipantCount((c) => {
            const next = Math.max(c, 1);
            cbRef.current.onParticipantCountChange?.(next);
            return next;
          });
          void markAttendanceJoin();
          scheduleAudienceRecovery(attempt);
        },
        onLeaveRoom: () => {
          clearAudienceRetryTimer();
          if (suppressLeaveRef.current) return;
          void markAttendanceLeave();
          cbRef.current.onLeave?.();
        },
        onUserJoin: (users: any[]) => {
          setParticipantCount((c) => {
            const next = c + (users?.length || 0);
            cbRef.current.onParticipantCountChange?.(next);
            return next;
          });
          scheduleAudienceRecovery(attempt);
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
      clearAudienceRetryTimer();
      try {
        zpRef.current?.destroy?.();
      } catch {}
      zpRef.current = null;
      attendanceIdRef.current = null;
      joinedRef.current = false;
      initStartedRef.current = false;
      suppressLeaveRef.current = false;
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
