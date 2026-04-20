import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";

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
  className?: string;
}

const LiveClass = ({ roomID, forceHost, onLeave, onStudentJoin, onStudentLeave, className }: LiveClassProps) => {
  const { user, role, profile } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const zpRef = useRef<any>(null);
  const attendanceIdRef = useRef<string | null>(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!user || !roomID || !containerRef.current) return;

    if (!ZEGO_APP_ID || !ZEGO_SERVER_SECRET) {
      console.error("[LiveClass] Missing ZEGOCLOUD credentials. Set ZEGO_APP_ID and ZEGO_SERVER_SECRET in src/components/LiveClass.tsx");
      return;
    }

    const isAdminOrTeacher = role === "admin" || role === "teacher";
    const isSuperAdmin = user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    const isHost = !!forceHost || isAdminOrTeacher || isSuperAdmin;
    const userID = user.id;
    const userName = profile?.full_name || user.email || "User";

    const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
      ZEGO_APP_ID,
      ZEGO_SERVER_SECRET,
      roomID,
      userID,
      userName
    );

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

      await onStudentJoin?.();
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

      await onStudentLeave?.();
    };

    const zp = ZegoUIKitPrebuilt.create(kitToken);
    zpRef.current = zp;

    zp.joinRoom({
      container: containerRef.current,
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
      onJoinRoom: () => {
        void markAttendanceJoin();
      },
      onLeaveRoom: () => {
        void markAttendanceLeave();
        onLeave?.();
      },
    });

    return () => {
      try {
        zpRef.current?.destroy?.();
      } catch {}
      zpRef.current = null;
      attendanceIdRef.current = null;
      joinedRef.current = false;
    };
  }, [roomID, user?.id, user?.email, role, profile?.full_name, forceHost, onLeave, onStudentJoin, onStudentLeave]);

  if (!user) {
    return <div className="w-full h-full flex items-center justify-center bg-black text-white text-sm">Please sign in to join the live class.</div>;
  }

  return <div ref={containerRef} className={className ?? "absolute inset-0 w-full h-full bg-black"} />;
};

export default LiveClass;
