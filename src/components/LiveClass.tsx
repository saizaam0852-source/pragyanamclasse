import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";

// ════════════════════════════════════════════════════════════════
// 🔑 PASTE YOUR ZEGOCLOUD CREDENTIALS HERE
// Get them from: https://console.zegocloud.com/
// ════════════════════════════════════════════════════════════════
const ZEGO_APP_ID = 0; // ← Replace 0 with your AppID (number)
const ZEGO_SERVER_SECRET = ""; // ← Replace "" with your ServerSecret (string)
// ════════════════════════════════════════════════════════════════

// Email that should always be treated as Host/Teacher
const SUPER_ADMIN_EMAIL = "superadmin5670@gmail.com";

interface LiveClassProps {
  roomID: string;
  /** Optional: override host detection (e.g. owner of the class) */
  forceHost?: boolean;
  onLeave?: () => void;
  className?: string;
}

const LiveClass = ({ roomID, forceHost, onLeave, className }: LiveClassProps) => {
  const { user, role, profile } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const zpRef = useRef<any>(null);

  useEffect(() => {
    if (!user || !roomID || !containerRef.current) return;

    if (!ZEGO_APP_ID || !ZEGO_SERVER_SECRET) {
      console.error(
        "[LiveClass] Missing ZEGOCLOUD credentials. Set ZEGO_APP_ID and ZEGO_SERVER_SECRET in src/components/LiveClass.tsx"
      );
      return;
    }

    // Determine role: Host (teacher/admin/super-admin) vs Audience (student)
    const isAdminOrTeacher = role === "admin" || role === "teacher";
    const isSuperAdmin = user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    const isHost = !!forceHost || isAdminOrTeacher || isSuperAdmin;

    const userID = user.id;
    const userName = profile?.full_name || user.email || "User";

    // Generate test token (use server-issued token for production)
    const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
      ZEGO_APP_ID,
      ZEGO_SERVER_SECRET,
      roomID,
      userID,
      userName
    );

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
      showChatView: false,
      showRoomDetailsButton: false,
      sharedLinks: [],
      onLeaveRoom: () => {
        onLeave?.();
      },
    });

    return () => {
      try {
        zpRef.current?.destroy?.();
      } catch {}
      zpRef.current = null;
    };
  }, [roomID, user?.id, role, profile?.full_name, forceHost]);

  if (!user) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-white text-sm">
        Please sign in to join the live class.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className ?? "absolute inset-0 w-full h-full bg-black"}
    />
  );
};

export default LiveClass;
