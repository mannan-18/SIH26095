import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Camera, AlertTriangle, RefreshCw, Power, ShieldAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface CctvPlayerProps {
  instituteId: string;
  instituteName: string;
  streamUrl?: string;
  initialOnline?: boolean;
  demoMode?: boolean;
  onStatusChange?: (status: "ONLINE" | "OFFLINE" | "FROZEN", reason?: string) => void;
}

const DEFAULT_HLS_STREAMS = [
  "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  "https://playertest.longtailvideo.com/adaptive/bbbell/bbbell.m3u8",
  "https://demo.unified-streaming.com/k8s/live/stable/hls/tears-of-steel/tears-of-steel.m3u8",
];

export default function CctvPlayer({
  instituteId,
  instituteName,
  streamUrl,
  initialOnline = true,
  demoMode = true,
  onStatusChange,
}: CctvPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [feedStatus, setFeedStatus] = useState<"ONLINE" | "OFFLINE" | "FROZEN">(
    initialOnline ? "ONLINE" : "OFFLINE"
  );
  const [simulatedOutage, setSimulatedOutage] = useState(!initialOnline);
  const [statusMessage, setStatusMessage] = useState<string>("Feed active and streaming");

  const reportStatus = trpc.cctv.reportFeedStatus.useMutation({
    onSuccess: (res) => {
      if (res.status === "OFFLINE" || res.status === "FROZEN") {
        toast.error(`CCTV Alert: ${instituteName} camera feed is ${res.status}`);
      }
    },
  });

  const activeUrl =
    streamUrl ||
    DEFAULT_HLS_STREAMS[
      Math.abs(
        instituteId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
      ) % DEFAULT_HLS_STREAMS.length
    ];

  useEffect(() => {
    if (simulatedOutage) {
      setFeedStatus("OFFLINE");
      setStatusMessage("Simulated hardware failure / Signal loss");
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    let freezeTimer: NodeJS.Timeout;
    let lastTime = 0;
    let sameTimeCount = 0;

    const checkFrameProgress = () => {
      if (video.paused || video.ended || simulatedOutage) return;
      if (video.currentTime === lastTime && video.currentTime > 0) {
        sameTimeCount++;
        if (sameTimeCount >= 8) {
          setFeedStatus("FROZEN");
          setStatusMessage("Video frame stall detected (no progress for >8s)");
          onStatusChange?.("FROZEN", "Frame freeze detected by client watchdog");
          reportStatus.mutate({
            instituteId,
            status: "FROZEN",
            reason: "Frame freeze detected (no progress >8s)",
          });
        }
      } else {
        lastTime = video.currentTime;
        sameTimeCount = 0;
        if (feedStatus !== "ONLINE" && !simulatedOutage) {
          setFeedStatus("ONLINE");
          setStatusMessage("Feed active and streaming");
        }
      }
    };

    freezeTimer = setInterval(checkFrameProgress, 1000);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
      });
      hlsRef.current = hls;
      hls.loadSource(activeUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {
          // Autoplay policy fallback
        });
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setFeedStatus("OFFLINE");
          setStatusMessage(`HLS Stream Error: ${data.type}`);
          onStatusChange?.("OFFLINE", `HLS fatal error: ${data.type}`);
          reportStatus.mutate({
            instituteId,
            status: "OFFLINE",
            reason: `HLS stream fatal error: ${data.type}`,
          });
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = activeUrl;
      video.addEventListener("loadedmetadata", () => {
        video.play().catch(() => {});
      });
    }

    return () => {
      clearInterval(freezeTimer);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeUrl, simulatedOutage, instituteId]);

  const toggleSimulatedOutage = () => {
    const nextState = !simulatedOutage;
    setSimulatedOutage(nextState);
    const newStatus = nextState ? "OFFLINE" : "ONLINE";
    setFeedStatus(newStatus);
    const msg = nextState
      ? "Simulated hardware failure / Signal loss"
      : "Feed restored";
    setStatusMessage(msg);
    onStatusChange?.(newStatus, nextState ? "Simulated outage trigger" : "Restored");
    reportStatus.mutate({
      instituteId,
      status: newStatus,
      reason: nextState ? "Manual outage simulation triggered" : "Feed recovered",
    });
  };

  return (
    <div className="panel p-3.5 space-y-2 bg-[#161610] text-white border border-[#B58863]/40 rounded-xl overflow-hidden shadow-md">
      {/* Feed Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] font-bold text-[#FFB162]">{instituteId}</span>
            <span className="rounded bg-[#B58863]/20 border border-[#B58863]/40 px-1.5 py-0.2 text-[9px] font-bold text-[#D3C3B9]">
              DEMO FEED
            </span>
          </div>
          <h4 className="text-xs font-bold text-white truncate max-w-[200px]">{instituteName}</h4>
        </div>

        {/* Status Badge */}
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            feedStatus === "ONLINE"
              ? "bg-emerald-950 text-emerald-400 border border-emerald-500/40"
              : feedStatus === "FROZEN"
              ? "bg-amber-950 text-amber-400 border border-amber-500/40"
              : "bg-rose-950 text-rose-400 border border-rose-500/40 animate-pulse"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              feedStatus === "ONLINE"
                ? "bg-emerald-400 animate-ping"
                : feedStatus === "FROZEN"
                ? "bg-amber-400"
                : "bg-rose-400"
            }`}
          />
          {feedStatus}
        </span>
      </div>

      {/* Video Display Container */}
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black flex items-center justify-center border border-slate-800">
        {simulatedOutage || feedStatus === "OFFLINE" ? (
          <div className="p-4 text-center space-y-2">
            <ShieldAlert className="h-8 w-8 text-rose-500 mx-auto animate-bounce" />
            <p className="text-xs font-bold text-rose-400">SIGNAL LOST / FEED OFFLINE</p>
            <p className="text-[10px] text-slate-400">{statusMessage}</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            muted
            playsInline
            className="h-full w-full object-cover"
          />
        )}

        {/* Live Indicator Overlay */}
        {feedStatus === "ONLINE" && !simulatedOutage && (
          <div className="absolute top-2 left-2 flex items-center gap-1 rounded bg-black/60 backdrop-blur-sm px-2 py-0.5 text-[9px] font-mono text-emerald-400 border border-emerald-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>LIVE HLS</span>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800 text-[10.5px]">
        <span className="text-slate-400 truncate flex-1">{statusMessage}</span>
        {demoMode && (
          <button
            type="button"
            onClick={toggleSimulatedOutage}
            className={`button-press inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold transition-colors ${
              simulatedOutage
                ? "bg-emerald-700 text-white hover:bg-emerald-600"
                : "bg-rose-900/80 text-rose-200 hover:bg-rose-800 border border-rose-500/40"
            }`}
            title="Demo Mode: Simulate camera feed outage"
          >
            <Power className="h-3 w-3" />
            {simulatedOutage ? "Restore Feed" : "Simulate Outage"}
            <span className="text-[8px] bg-black/40 px-1 rounded">DEMO</span>
          </button>
        )}
      </div>
    </div>
  );
}
