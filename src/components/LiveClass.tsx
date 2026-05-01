import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { Users } from "lucide-react";

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
  const { user, profile } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const zegoRef = useRef<any>(null);
  const attendanceIdRef = useRef<string | null>(null);
  const attendanceTrackedRef = useRef(false);
  const joinedRoomRef = useRef(false);
  const cleanupRef = useRef(false);
  const statusTimerRef = useRef<number | null>(null);
  const cbRef = useRef({ onLeave, onStudentJoin, onStudentLeave, onParticipantCountChange });
  const [statusText, setStatusText] = useState("Connecting live class…");
  const [participantCount, setParticipantCount] = useState(0);

  useEffect(() => {
    cbRef.current = { onLeave, onStudentJoin, onStudentLeave, onParticipantCountChange };
  }, [onLeave, onStudentJoin, onStudentLeave, onParticipantCountChange]);

  useEffect(() => {
    if (!user || !roomID || !containerRef.current) return;

    let cancelled = false;
    cleanupRef.current = false;
    attendanceTrackedRef.current = false;
    joinedRoomRef.current = false;
    attendanceIdRef.current = null;
    setParticipantCount(0);
    setStatusText("Connecting live class…");

    const clearStatusTimer = () => {
      if (statusTimerRef.current !== null) {
        window.clearTimeout(statusTimerRef.current);
        statusTimerRef.current = null;
      }
    };

    const setSafeParticipantCount = (updater: number | ((current: number) => number)) => {
      setParticipantCount((current) => {
        const next = Math.max(0, typeof updater === "function" ? updater(current) : updater);
        cbRef.current.onParticipantCountChange?.(next);
        return next;
      });
    };

    const markAttendanceJoin = async (shouldTrack: boolean) => {
      if (!shouldTrack || attendanceTrackedRef.current) return;
      attendanceTrackedRef.current = true;

      const { data: existing } = await supabase
        .from("attendance")
        .select("id")
        .eq("student_id", user.id)
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
          .insert({ student_id: user.id, room_id: roomID, join_time: new Date().toISOString() } as any)
          .select("id")
          .single();
        attendanceIdRef.current = created?.id ?? null;
      }

      await cbRef.current.onStudentJoin?.();
    };

    const markAttendanceLeave = async () => {
      if (!attendanceTrackedRef.current) return;
      attendanceTrackedRef.current = false;

      if (attendanceIdRef.current) {
        await supabase
          .from("attendance")
          .update({ leave_time: new Date().toISOString() } as any)
          .eq("id", attendanceIdRef.current);
      } else {
        await supabase
          .from("attendance")
          .update({ leave_time: new Date().toISOString() } as any)
          .eq("student_id", user.id)
          .eq("room_id", roomID)
          .is("leave_time", null);
      }

      attendanceIdRef.current = null;
      await cbRef.current.onStudentLeave?.();
    };

    const leaveRoom = async (notifyParent: boolean) => {
      await markAttendanceLeave();
      if (notifyParent) cbRef.current.onLeave?.();
    };

    const init = async () => {
      const { data, error } = await supabase.functions.invoke("get-zego-token", {
        body: { roomID },
      });

      if (error || !data?.token || !data?.appID || !data?.roomID || !data?.userID) {
        throw new Error((data as any)?.error || error?.message || "Unable to initialize live class");
      }

      if (cancelled || !containerRef.current) return;

      const userName = profile?.full_name || user.email || "User";
      const joinAsHost = Boolean(forceHost && data.canPublish);
      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(
        Number(data.appID),
        String(data.token),
        String(data.roomID),
        String(data.userID),
        userName,
      );
      const zego = ZegoUIKitPrebuilt.create(kitToken);
      zegoRef.current = zego;

      zego.joinRoom({
        container: containerRef.current,
        scenario: {
          mode: ZegoUIKitPrebuilt.LiveStreaming,
          config: {
            role: joinAsHost ? ZegoUIKitPrebuilt.Host : ZegoUIKitPrebuilt.Audience,
            liveStreamingMode: ZegoUIKitPrebuilt.LiveStreamingMode.RealTimeLive,
          },
        },
        showPreJoinView: false,
        showUserList: false,
        showTextChat: false,
        showRoomDetailsButton: false,
        showRoomTimer: false,
        sharedLinks: [],
        layout: "Auto",
        showLayoutButton: false,
        showPinButton: false,
        showMoreButton: false,
        showScreenSharingButton: joinAsHost,
        showMyMicrophoneToggleButton: joinAsHost,
        showMyCameraToggleButton: joinAsHost,
        showAudioVideoSettingsButton: joinAsHost,
        showTurnOffRemoteCameraButton: joinAsHost,
        showTurnOffRemoteMicrophoneButton: joinAsHost,
        showRemoveUserButton: joinAsHost,
        showInviteToCohostButton: false,
        showRemoveCohostButton: false,
        showRequestToCohostButton: false,
        turnOnMicrophoneWhenJoining: joinAsHost,
        turnOnCameraWhenJoining: joinAsHost,
        useFrontFacingCamera: true,
        showNonVideoUser: true,
        showOnlyAudioUser: true,
        showLeavingView: false,
        showLeaveRoomConfirmDialog: false,
        lowerLeftNotification: { showUserJoinAndLeave: true, showTextChat: false },
        liveNotStartedTextForAudience: "Waiting for teacher to start the class…",
        startLiveButtonText: "Start Class",
        videoScreenConfig: { objectFit: "contain" },
        onJoinRoom: () => {
          joinedRoomRef.current = true;
          setSafeParticipantCount(1);
          void markAttendanceJoin(Boolean(data.trackAttendance));
          clearStatusTimer();
          statusTimerRef.current = window.setTimeout(() => setStatusText(""), joinAsHost ? 1200 : 500);
        },
        onLeaveRoom: () => {
          void leaveRoom(!cleanupRef.current);
        },
        onUserJoin: (users: any[]) => {
          setStatusText("");
          setSafeParticipantCount((current) => current + (users?.length || 0));
        },
        onUserLeave: (users: any[]) => {
          setSafeParticipantCount((current) => current - (users?.length || 0));
        },
        onLiveStart: () => setStatusText(""),
        onStreamUpdate: () => setStatusText(""),
        onLocalStreamUpdated: (state: "created" | "published" | "stopped") => {
          if (state === "published") setStatusText("");
        },
      });
    };

    void init().catch((error) => {
      console.error("[LiveClass] join failed", error);
      setStatusText(error instanceof Error ? error.message : "Unable to join live class");
    });

    return () => {
      cancelled = true;
      cleanupRef.current = true;
      clearStatusTimer();
      void markAttendanceLeave();
      try {
        zegoRef.current?.destroy?.();
      } catch (error) {
        console.warn("[LiveClass] destroy failed", error);
      }
      if (containerRef.current) containerRef.current.innerHTML = "";
      zegoRef.current = null;
      joinedRoomRef.current = false;
    };
  }, [roomID, user?.id, user?.email, profile?.full_name, forceHost]);

  if (!user) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background text-foreground text-sm">
        Please sign in to join the live class.
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full ${className ?? ""}`}>
      <div ref={containerRef} className="absolute inset-0 w-full h-full bg-background" />
      {statusText && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 text-foreground text-sm font-medium px-4 text-center">
          {statusText}
        </div>
      )}
      <div className="absolute top-3 left-3 z-20 pointer-events-none flex items-center gap-1.5 bg-background/70 backdrop-blur-sm text-foreground text-xs font-semibold px-2.5 py-1 rounded-full border border-border">
        <Users className="w-3 h-3" />
        <span>{participantCount}</span>
        <span className="opacity-70 font-normal">live</span>
      </div>
    </div>
  );
};

export default LiveClass;
