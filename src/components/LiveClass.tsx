import { useEffect, useRef, useState } from "react";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LiveClassProps {
  classId: string;
  onLeave?: () => void;
}

const LiveClass = ({ classId, onLeave }: LiveClassProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const zegoRef = useRef<any>(null);
  const initializedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);

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
        if (fnErr) throw new Error(fnErr.message || "Failed to get token");
        if (!data?.token) throw new Error(data?.error || "No token returned");
        return data;
      } catch (err) {
        if (attempt < maxAttempts && !cancelled) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
          console.warn(`Zego token fetch failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms`, err);
          setRetryAttempt(attempt);
          await new Promise((r) => setTimeout(r, delay));
          if (cancelled) throw err;
          return fetchToken(attempt + 1);
        }
        throw err;
      }
    };

    const init = async () => {
      try {
        setLoading(true);
        setError(null);
        setRetryAttempt(0);

        const data = await fetchToken(1);
        if (cancelled) return;

        const { token, appID, roomID, userID, userName, role } = data;

        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(
          Number(appID),
          token,
          roomID,
          userID,
          userName,
        );

        if (!containerRef.current || cancelled) return;

        const zego = ZegoUIKitPrebuilt.create(kitToken);
        zegoRef.current = zego;

        const isHost = role === "host";

        zego.joinRoom({
          container: containerRef.current,
          scenario: {
            mode: ZegoUIKitPrebuilt.LiveStreaming,
            config: {
              role: isHost ? ZegoUIKitPrebuilt.Host : ZegoUIKitPrebuilt.Audience,
              liveStreamingMode: ZegoUIKitPrebuilt.LiveStreamingMode.RealTimeLive,
            },
          },
          showPreJoinView: false,
          turnOnCameraWhenJoining: isHost,
          turnOnMicrophoneWhenJoining: isHost,
          useFrontFacingCamera: true,
          showMyCameraToggleButton: isHost,
          showMyMicrophoneToggleButton: isHost,
          showAudioVideoSettingsButton: isHost,
          showScreenSharingButton: isHost,
          showRoomDetailsButton: false,
          showTextChat: true,
          showUserList: true,
          maxUsers: 100,
          layout: "Auto",
          showLayoutButton: isHost,
          showLeaveRoomConfirmDialog: false,
          showLeavingView: false,
          liveNotStartedTextForAudience: "Waiting for teacher to start the class…",
          startLiveButtonText: "Start Class",
          videoScreenConfig: {
            objectFit: "contain",
            localMirror: true,
            pullStreamMirror: false,
          },
          onLeaveRoom: () => {
            try { zego.destroy(); } catch (_) { /* noop */ }
            onLeave?.();
          },
          onJoinRoom: () => {
            setLoading(false);
          },
        });
        setLoading(false);
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
      try { zegoRef.current?.destroy(); } catch (_) { /* noop */ }
      zegoRef.current = null;
      initializedRef.current = false;
    };
  }, [classId, onLeave]);

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
    <div className="relative w-full h-full min-h-[60vh] bg-black">
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
    </div>
  );
};

export default LiveClass;
