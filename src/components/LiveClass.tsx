import { useEffect, useRef, useState } from "react";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import LiveChatSidebar from "./LiveChatSidebar";
import { useAuth } from "@/contexts/AuthContext";

interface LiveClassProps {
  classId: string;
  onLeave?: () => void;
}

const LiveClass = ({ classId, onLeave }: LiveClassProps) => {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const zegoRef = useRef<any>(null);
  const initializedRef = useRef(false);
  const attendanceIdRef = useRef<string | null>(null);
  const onLeaveRef = useRef(onLeave);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [isHost, setIsHost] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [userName, setUserName] = useState("");

  useEffect(() => { onLeaveRef.current = onLeave; }, [onLeave]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    let cancelled = false;

    const fetchToken = async (attempt: number): Promise<any> => {
      const maxAttempts = 3;
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("get-zego-token", {
          body: { classId },
        });
        const status = (fnErr as any)?.context?.status ?? (data as any)?.status;
        if (status === 429 || (data as any)?.error?.toString?.().toLowerCase?.().includes("too many")) {
          throw new Error((data as any)?.error || "Too many requests. Please wait a moment.");
        }
        if (fnErr) throw new Error(fnErr.message || "Failed to get token");
        if (!data?.token) throw new Error(data?.error || "No token returned");
        return data;
      } catch (err: any) {
        const isRateLimited = /too many|429/i.test(err?.message || "");
        if (!isRateLimited && attempt < maxAttempts && !cancelled) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
          setRetryAttempt(attempt);
          await new Promise((r) => setTimeout(r, delay));
          if (cancelled) throw err;
          return fetchToken(attempt + 1);
        }
        throw err;
      }
    };

    const recordJoin = async (host: boolean) => {
      if (host || !user?.id) return; // record attendance for students only
      const { data: cls } = await supabase
        .from("live_classes")
        .select("room_id")
        .eq("id", classId)
        .maybeSingle();
      const { data, error } = await supabase
        .from("attendance")
        .insert({
          student_id: user.id,
          class_id: classId,
          room_id: cls?.room_id || classId,
          join_time: new Date().toISOString(),
        })
        .select("id")
        .maybeSingle();
      if (!error && data) attendanceIdRef.current = data.id;
    };

    const init = async () => {
      try {
        setLoading(true);
        setError(null);
        setRetryAttempt(0);

        const data = await fetchToken(1);
        if (cancelled) return;

        const { token, appID, roomID, userID, userName: uName, role } = data;
        setUserName(uName || "");
        const host = role === "host";
        setIsHost(host);

        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(
          Number(appID), token, roomID, userID, uName,
        );

        if (!containerRef.current || cancelled) return;

        const zego = ZegoUIKitPrebuilt.create(kitToken);
        zegoRef.current = zego;

        zego.joinRoom({
          container: containerRef.current,
          scenario: {
            mode: ZegoUIKitPrebuilt.LiveStreaming,
            config: {
              role: host ? ZegoUIKitPrebuilt.Host : ZegoUIKitPrebuilt.Audience,
              liveStreamingMode: ZegoUIKitPrebuilt.LiveStreamingMode.RealTimeLive,
            },
          },
          showPreJoinView: false,
          turnOnCameraWhenJoining: host,
          turnOnMicrophoneWhenJoining: host,
          useFrontFacingCamera: true,
          showMyCameraToggleButton: host,
          showMyMicrophoneToggleButton: host,
          showAudioVideoSettingsButton: host,
          showScreenSharingButton: host,
          showRoomDetailsButton: false,
          showTextChat: false,
          showUserList: true,
          maxUsers: 100,
          layout: "Auto",
          showLayoutButton: host,
          showRoomTimer: true,
          showLeaveRoomConfirmDialog: false,
          showLeavingView: false,
          liveNotStartedTextForAudience: "Waiting for teacher to start the class…",
          startLiveButtonText: "Start Class",
          videoScreenConfig: { objectFit: "contain", localMirror: true, pullStreamMirror: false },
          onLeaveRoom: () => {
            try { zego.destroy(); } catch (_) { /* noop */ }
            onLeaveRef.current?.();
          },
          onJoinRoom: () => {
            setLoading(false);
            recordJoin(host);
          },
        });
      } catch (e: any) {
        if (cancelled) return;
        console.error("LiveClass init error:", e);
        setError(e?.message || "Could not start live class");
        setLoading(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      // mark leave time for attendance
      if (attendanceIdRef.current) {
        supabase.from("attendance")
          .update({ leave_time: new Date().toISOString() })
          .eq("id", attendanceIdRef.current);
      }
      try { zegoRef.current?.destroy(); } catch (_) { /* noop */ }
      zegoRef.current = null;
      initializedRef.current = false;
    };
  }, [classId, user?.id]);

  if (error) {
    return (
      <div className="w-full h-full min-h-[60vh] flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-destructive" />
          </div>
          <h3 className="font-semibold text-foreground mb-2">Unable to join live class</h3>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={onLeave} variant="outline" size="sm">Go back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[60vh] bg-black flex">
      <div className="relative flex-1 min-w-0">
        {loading && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/80 text-white">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
              <p className="text-sm">Connecting to live class…</p>
              {retryAttempt > 0 && (
                <p className="text-xs text-white/70 mt-1">Retrying… (attempt {retryAttempt + 1}/3)</p>
              )}
            </div>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full min-h-[60vh]" />

        {!chatOpen && (
          <button
            onClick={() => setChatOpen(true)}
            className="absolute bottom-4 right-4 z-20 bg-primary text-primary-foreground rounded-full p-3 shadow-lg"
            aria-label="Open chat"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        )}
      </div>

      {chatOpen && user && (
        <div className="hidden md:flex w-80 shrink-0 flex-col relative">
          <button
            onClick={() => setChatOpen(false)}
            className="absolute top-1 right-1 z-10 p-1 rounded hover:bg-muted text-muted-foreground"
            aria-label="Close chat"
          >
            <X className="w-4 h-4" />
          </button>
          <LiveChatSidebar
            classId={classId}
            isHost={isHost}
            currentUserId={user.id}
            currentUserName={userName || user.email || "User"}
          />
        </div>
      )}

      {/* Mobile chat drawer */}
      {chatOpen && user && (
        <div className="md:hidden fixed inset-x-0 bottom-0 top-1/2 z-30 bg-card border-t border-border rounded-t-2xl flex flex-col">
          <button
            onClick={() => setChatOpen(false)}
            className="absolute top-2 right-2 z-10 p-1 rounded hover:bg-muted text-muted-foreground"
            aria-label="Close chat"
          >
            <X className="w-4 h-4" />
          </button>
          <LiveChatSidebar
            classId={classId}
            isHost={isHost}
            currentUserId={user.id}
            currentUserName={userName || user.email || "User"}
          />
        </div>
      )}
    </div>
  );
};

export default LiveClass;
