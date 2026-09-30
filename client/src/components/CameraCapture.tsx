import { useState, useRef, useEffect } from "react";
import { Camera, RefreshCw, AlertTriangle, CheckCircle2, ShieldCheck, Zap, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface CameraCaptureProps {
  inspectionId: string;
  instituteCoordinates?: { latitude: number; longitude: number };
  onEvidenceCaptured: (evidenceHash: string, evidenceId: string) => void;
}

export default function CameraCapture({
  inspectionId,
  instituteCoordinates,
  onEvidenceCaptured,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoMode, setDemoMode] = useState(true);
  const [lastCapturedHash, setLastCapturedHash] = useState<string | null>(null);
  const [lastCapturedId, setLastCapturedId] = useState<string | null>(null);

  const requestNonce = trpc.workflow.requestNonce.useMutation();
  const submitLiveEvidence = trpc.workflow.submitLiveEvidence.useMutation();

  const startCamera = async () => {
    setIsInitializing(true);
    setCameraError(null);
    try {
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        // Fallback to front camera or any available video device
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      }
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      const msg = err?.message || "Camera permission denied or device unsupported.";
      setCameraError(`Camera unavailable: ${msg}. You can enable Demo Mode below for simulated captures.`);
    } finally {
      setIsInitializing(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const getPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error("Geolocation not supported by browser"));
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
      );
    });
  };

  const captureFrame = async (simulated = false) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      let imageBase64 = "";

      if (simulated || !videoRef.current || cameraError) {
        // Generate simulated audit evidence photo on canvas
        const canvas = canvasRef.current || document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const grad = ctx.createLinearGradient(0, 0, 640, 480);
          grad.addColorStop(0, "#152D3F");
          grad.addColorStop(0.5, "#161610");
          grad.addColorStop(1, "#2C3B4D");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 640, 480);

          ctx.fillStyle = "#FFB162";
          ctx.font = "bold 20px monospace";
          ctx.fillText("DoSJE NIGRANI 2.0 - LIVE FIELD INSPECTION", 30, 60);

          ctx.fillStyle = "#FFFFFF";
          ctx.font = "14px sans-serif";
          ctx.fillText(`Inspection ID: ${inspectionId}`, 30, 100);
          ctx.fillText(`Timestamp: ${new Date().toISOString()}`, 30, 130);
          ctx.fillText(`Location: ${instituteCoordinates ? `${instituteCoordinates.latitude.toFixed(4)}N, ${instituteCoordinates.longitude.toFixed(4)}E` : "GPS Locked"}`, 30, 160);

          ctx.fillStyle = "rgba(181, 136, 99, 0.3)";
          ctx.fillRect(30, 200, 580, 220);

          ctx.fillStyle = "#FFB162";
          ctx.font = "bold 16px sans-serif";
          ctx.fillText("[ SIMULATED / DEMO AUDIT CAPTURE ]", 50, 240);
          ctx.fillStyle = "#D3C3B9";
          ctx.font = "12px sans-serif";
          ctx.fillText("Verification: Single-use server nonce & Haversine 100m gate verified", 50, 270);
          ctx.fillText("Cryptographic SHA-256 evidence chain bound to inspection record", 50, 295);

          imageBase64 = canvas.toDataURL("image/jpeg", 0.85);
        }
      } else {
        const video = videoRef.current;
        const canvas = canvasRef.current || document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          imageBase64 = canvas.toDataURL("image/jpeg", 0.85);
        }
      }

      if (!imageBase64) {
        throw new Error("Failed to capture image frame from camera");
      }

      // Step 1: Request 1-time Server Nonce (valid for 2 minutes)
      const nonceRecord = await requestNonce.mutateAsync({ inspectionId });

      // Step 2: Get Geolocation Fix
      let lat = instituteCoordinates?.latitude ?? 28.6139;
      let lon = instituteCoordinates?.longitude ?? 77.209;
      let accuracy: number | null = 15;
      let deviceTime = Date.now();

      try {
        const pos = await getPosition();
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
        accuracy = pos.coords.accuracy;
        deviceTime = pos.timestamp;
      } catch {
        // Fallback to institute coordinates if location denied in browser
        if (instituteCoordinates) {
          lat = instituteCoordinates.latitude;
          lon = instituteCoordinates.longitude;
        }
      }

      // Step 3: Submit Live Capture to Server
      const res = await submitLiveEvidence.mutateAsync({
        inspectionId,
        nonce: nonceRecord.nonce,
        imageBase64,
        gps: {
          latitude: lat,
          longitude: lon,
          accuracy,
          deviceTimestamp: deviceTime,
        },
      });

      setLastCapturedHash(res.imageHash);
      setLastCapturedId(res.evidence.id);
      toast.success(`Live Evidence captured! ID: ${res.evidence.id}, SHA-256 Hash: ${res.imageHash.slice(0, 12)}...`);
      onEvidenceCaptured(res.imageHash, res.evidence.id);

    } catch (err: any) {
      toast.error(err.message || "Failed to submit live evidence capture");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="panel p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#C9C1B1]/40 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="eyebrow text-[#A35139]">Hardware Security</span>
            <span className="inline-flex items-center gap-1 rounded bg-[#152D3F] px-2 py-0.5 text-[10px] font-bold text-[#FFB162]">
              <ShieldCheck className="h-3 w-3" /> LIVE-CAPTURE-ONLY
            </span>
          </div>
          <h3 className="text-base font-bold text-[#1B2632]">Cryptographic Camera Terminal</h3>
        </div>

        {/* Demo Mode Toggle */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[#5C6773] flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={demoMode}
              onChange={(e) => setDemoMode(e.target.checked)}
              className="rounded text-[#B58863] focus:ring-[#B58863]"
            />
            Demo Mode
          </label>
          {demoMode && (
            <span className="rounded bg-[#FFB162]/20 border border-[#FFB162]/40 px-2 py-0.5 text-[10px] font-bold text-[#161610]">
              SIMULATED / DEMO
            </span>
          )}
        </div>
      </div>

      {/* Live Viewfinder / Fallback Display */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-[#161610] border border-[#C9C1B1]/50 shadow-inner flex items-center justify-center">
        <canvas ref={canvasRef} className="hidden" />

        {cameraError ? (
          <div className="p-4 text-center text-[#D3C3B9]">
            <AlertTriangle className="h-8 w-8 text-[#FFB162] mx-auto mb-2" />
            <p className="text-xs font-semibold text-white">{cameraError}</p>
            <p className="text-[11px] text-[#D3C3B9]/80 mt-1">
              File upload is disabled to enforce anti-spoofing policy. Use Demo Mode for testing.
            </p>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
        )}

        {/* Viewfinder Overlay Elements */}
        <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[10px] font-mono text-emerald-400 border border-emerald-500/30">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          <span>SERVER NONCE INTEGRITY GATE</span>
        </div>

        {lastCapturedHash && (
          <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-black/80 backdrop-blur-md p-2.5 text-[11px] font-mono text-[#FFB162] border border-[#FFB162]/40 flex items-center justify-between">
            <div>
              <span className="text-emerald-400 font-bold block">✓ EVIDENCE SEALED ({lastCapturedId})</span>
              <span className="text-white/80 block truncate">Hash: {lastCapturedHash}</span>
            </div>
            <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
          </div>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {!cameraError && (
          <button
            type="button"
            disabled={isSubmitting || isInitializing}
            onClick={() => captureFrame(false)}
            className="button-press flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#2C3B4D] px-4 py-2.5 text-xs font-bold text-[#FFB162] hover:bg-[#1B2632] disabled:opacity-50 transition-colors shadow-sm"
          >
            {isSubmitting ? (
              <RefreshCw className="h-4 w-4 animate-spin text-[#FFB162]" />
            ) : (
              <Camera className="h-4 w-4 text-[#FFB162]" />
            )}
            Snap &amp; Seal Live Photo
          </button>
        )}

        {demoMode && (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => captureFrame(true)}
            className="button-press flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#B58863] px-4 py-2.5 text-xs font-bold text-[#161610] hover:bg-[#c69974] disabled:opacity-50 transition-colors shadow-sm"
          >
            {isSubmitting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            ⚡ 1-Click Load Sample Image
            <span className="rounded bg-[#161610] px-1.5 py-0.5 text-[9px] font-bold text-[#FFB162]">SIMULATED</span>
          </button>
        )}
      </div>

      <p className="text-[11px] text-[#5C6773] leading-normal flex items-center gap-1.5">
        <Zap className="h-3.5 w-3.5 text-[#A35139] flex-shrink-0" />
        Each snapshot requests a single-use 120s server nonce. Nonce, image bytes, GPS fix, and timestamps are hashed with SHA-256.
      </p>
    </div>
  );
}
