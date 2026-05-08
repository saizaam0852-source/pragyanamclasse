import { useCallback, useEffect, useRef, useState } from "react";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, Loader2, MessageSquare, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import LiveChatSidebar from "./LiveChatSidebar";

interface LiveClassProps {
  classId: string;
  onLeave?: () => void;
}

type ZegoTokenResponse = {
  token: string;
  appID: number;
  roomID: string;
  userID: string;
  userName: string;
  role: "host" | "audience";
  classTitle?: string;
  error?: string;
};

const MAX_RETRIES = 2;

const getZegoMessage = (message: string) => {
  if (/not live|not started|not live yet/i.test(message)) return "Class is not live yet. Teacher must start it first.";
  if (/not enrolled/i.test(message)) return "Only enrolled students can join this class.";
  if (/credentials|secret|appId/i.test(message)) return "ZEGOCLOUD credentials are not configured correctly.";
  if (/too many|429/i.test(message)) return "Too many join attempts. Please wait a moment before retrying.";
  return message || "Unable to join live class.";
};

const LiveClass = ({ classId, onLeave }: LiveClassProps) => {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const zegoRef = useRef<ReturnType<typeof ZegoUIKitPrebuilt.create> | null>(null);
  const attendanceIdRef = useRef<string | null>(null);
  const onLeaveRef = useRef(onLeave);
  const [joining, setJoining] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [session, setSession] = useState<ZegoTokenResponse | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const isHost = session?.role === "host";

  useEffect(() => { onLeaveRef.current = onLeave; }, [onLeave]);

  const destroyZego = useCallback(() => {
    try { zegoRef.current?.destroy(); } catch (_) { /* SDK cleanup is best-effort */ }
    zegoRef.current = null;
    if (containerRef.current) containerRef.current.innerHTML = "";
  }, []);

  const recordJoin = useCallback(async (tokenData: ZegoTokenResponse) => {
    if (tokenData.role === "host" || !user?.id) return;
    const { data, error: attendanceError } = await supabase
      .from("attendance")
      .insert({
        student_id: user.id,
        class_id: classId,
        room_id: tokenData.roomID,
        join_time: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    if (!attendanceError && data?.id) attendanceIdRef.current = data.id;
  }, [classId, user?.id]);

  const recordLeave = useCallback(() => {
    if (!attendanceIdRef.current) return;
    const id = attendanceIdRef.current;
    attendanceIdRef.current = null;
    supabase.from("attendance").update({ leave_time: new Date().toISOString() }).eq("id", id).then(() => undefined);
  }, []);

  const fetchToken = useCallback(async () => {
    const { data, error: invokeError } = await supabase.functions.invoke("get-zego-token", {
      body: { classId },
    });
    const status = (invokeError as any)?.context?.status ?? (data as any)?.status;
    const message = (data as ZegoTokenResponse | null)?.error || invokeError?.message;
    if (status === 429 || /too many/i.test(message || "")) throw new Error("Too many join attempts. Please wait and try again.");
    if (invokeError) throw new Error(message || "Token request failed");
    if (!data?.token || !data?.appID || !data?.roomID || !data?.userID) throw new Error(message || "Invalid ZEGOCLOUD token response");
    return data as ZegoTokenResponse;
  }, [classId]);

  const startLiveClass = useCallback(async (attempt = 0) => {
    if (!containerRef.current) return;
    setJoining(true);
    setError(null);
    setRetryCount(attempt);
    destroyZego();

    try {
      const tokenData = await fetchToken();
      const role = tokenData.role === "host" ? ZegoUIKitPrebuilt.Host : ZegoUIKitPrebuilt.Audience;
      const kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(
        Number(tokenData.appID),
        tokenData.token,
        tokenData.roomID,
        tokenData.userID,
        tokenData.userName || "User",
      );

      if (!containerRef.current) return;
      const zego = ZegoUIKitPrebuilt.create(kitToken);
      zegoRef.current = zego;
      setSession(tokenData);

      zego.joinRoom({
        container: containerRef.current,
        scenario: {
          mode: ZegoUIKitPrebuilt.LiveStreaming,
          config: {
            role,
            liveStreamingMode: ZegoUIKitPrebuilt.LiveStreamingMode.RealTimeLive,
          },
        },
        showPreJoinView: false,
        turnOnCameraWhenJoining: tokenData.role === "host",
        turnOnMicrophoneWhenJoining: tokenData.role === "host",
        useFrontFacingCamera: true,
        showMyCameraToggleButton: tokenData.role === "host",
        showMyMicrophoneToggleButton: tokenData.role === "host",
        showAudioVideoSettingsButton: tokenData.role === "host",
        showScreenSharingButton: tokenData.role === "host",
        showLayoutButton: tokenData.role === "host",
        showTextChat: false,
        showUserList: true,
        showRoomDetailsButton: false,
        showRoomTimer: true,
        showLeaveRoomConfirmDialog: false,
        showLeavingView: false,
        maxUsers: 100,
        layout: "Auto",
        liveNotStartedTextForAudience: "Waiting for teacher to start the class…",
        startLiveButtonText: "Start Class",
        videoScreenConfig: { objectFit: "contain", localMirror: true, pullStreamMirror: false },
        onJoinRoom: () => {
          setJoining(false);
          recordJoin(tokenData);
        },
        onLeaveRoom: () => {
          recordLeave();
          destroyZego();
          onLeaveRef.current?.();
        },
        onLiveEnd: () => {
          recordLeave();
          onLeaveRef.current?.();
        },
      });
    } catch (err: any) {
      const message = getZegoMessage(err?.message || "Unable to join live class.");
      const retryable = !/too many|not enrolled|not live|credentials|secret/i.test(message);
      if (retryable && attempt < MAX_RETRIES) {
        window.setTimeout(() => startLiveClass(attempt + 1), 1200 * (attempt + 1));
        return;
      }
      setError(message);
      setJoining(false);
    }
  }, [destroyZego, fetchToken, recordJoin, recordLeave]);

  useEffect(() => {
    startLiveClass();
    return () => {
      recordLeave();
      destroyZego();
    };
  }, [startLiveClass, recordLeave, destroyZego]);

  if (error) {
    return (
      <div className="w-full h-full min-h-[60vh] flex items-center justify-center bg-background p-6">
        <div className="max-w-sm text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-destructive" />
          </div>
          <h3 className="font-semibold text-foreground mb-2">Unable to join live class</h3>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <div className="flex items-center justify-center gap-2">
            <Button onClick={() => startLiveClass()} size="sm" className="gradient-saffron border-0 text-primary-foreground">
              <RefreshCw className="w-4 h-4 mr-1" /> Retry
            </Button>
            <Button onClick={onLeave} variant="outline" size="sm">Go back</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[60vh] bg-background flex overflow-hidden">
      <div className="relative flex-1 min-w-0 bg-black">
        {joining && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/85 text-primary-foreground">
            <div className="text-center px-4">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
              <p className="text-sm font-medium">Connecting to live class…</p>
              {retryCount > 0 && <p className="text-xs text-primary-foreground/70 mt-1">Retrying… attempt {retryCount + 1}</p>}
            </div>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full min-h-[60vh]" />
        {!chatOpen && session && (
          <button
            onClick={() => setChatOpen(true)}
            className="absolute bottom-4 right-4 z-20 bg-primary text-primary-foreground rounded-full p-3 shadow-lg"
            aria-label="Open chat"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        )}
      </div>

      {chatOpen && session && user && (
        <aside className="hidden md:flex w-80 shrink-0 flex-col relative border-l border-border bg-card">
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
            currentUserName={session.userName || user.email || "User"}
          />
        </aside>
      )}

      {chatOpen && session && user && (
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
            currentUserName={session.userName || user.email || "User"}
          />
        </div>
      )}
    </div>
  );
};

export default LiveClass;