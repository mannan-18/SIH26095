import { useState, useEffect } from "react";
import { ScanLine, CheckCircle2, AlertTriangle, ShieldCheck, UserCheck, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

interface BiometricCheckinModalProps {
  onClose: () => void;
  onSuccess: (result: { personId: string; faceMatchScore: number; livenessPassed: boolean }) => void;
}

export default function BiometricCheckinModal({ onClose, onSuccess }: BiometricCheckinModalProps) {
  const [step, setStep] = useState<"SCANNING" | "LIVENESS" | "VERIFYING" | "MATCHED">("SCANNING");
  const [livenessPrompt, setLivenessPrompt] = useState<string>("Align face within target frame");
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    let timer1: NodeJS.Timeout;
    let timer2: NodeJS.Timeout;
    let timer3: NodeJS.Timeout;

    if (step === "SCANNING") {
      setProgress(25);
      timer1 = setTimeout(() => {
        setStep("LIVENESS");
        setLivenessPrompt("Please blink twice to confirm passive liveness...");
        setProgress(60);
      }, 1500);
    } else if (step === "LIVENESS") {
      timer2 = setTimeout(() => {
        setStep("VERIFYING");
        setLivenessPrompt("Comparing 1:1 biometric vector hash against Aadhaar/DBT database...");
        setProgress(85);
      }, 2000);
    } else if (step === "VERIFYING") {
      timer3 = setTimeout(() => {
        setStep("MATCHED");
        setProgress(100);
        toast.success("Biometric Face-Match & Liveness 100% Verified (MOCK)");
        onSuccess({
          personId: "BEN-DL-98421",
          faceMatchScore: 99.4,
          livenessPassed: true,
        });
      }, 1500);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [step]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="panel max-w-md w-full bg-[#161610] text-white border-2 border-[#B58863]/60 shadow-2xl overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between bg-[#152D3F] p-4 border-b border-[#B58863]/40">
          <div className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-[#FFB162]" />
            <div>
              <h3 className="text-sm font-bold text-white">Biometric Verification Terminal</h3>
              <p className="text-[10px] text-[#D3C3B9]">Face-Match &amp; Passive Liveness Engine</p>
            </div>
          </div>
          <span className="rounded bg-[#FFB162]/20 border border-[#FFB162]/40 px-2 py-0.5 text-[9px] font-bold text-[#FFB162]">
            MOCK / SIMULATED
          </span>
        </div>

        {/* Viewfinder Canvas */}
        <div className="p-6 space-y-4">
          <div className="relative aspect-square w-full max-w-[280px] mx-auto overflow-hidden rounded-2xl bg-black border-2 border-[#B58863]/50 flex items-center justify-center shadow-inner">
            {/* Target Reticle Overlay */}
            <div className="absolute inset-6 rounded-full border-2 border-dashed border-[#FFB162]/60 animate-spin duration-10000" />
            
            {step !== "MATCHED" ? (
              <div className="text-center space-y-3 p-4 z-10">
                <ScanLine className="h-16 w-16 text-[#FFB162] mx-auto animate-pulse" />
                <p className="text-xs font-mono font-bold text-[#FFB162]">{livenessPrompt}</p>
                <div className="w-full bg-[#2C3B4D] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#FFB162] h-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>
            ) : (
              <div className="text-center space-y-2 p-4 z-10 animate-in zoom-in-95">
                <CheckCircle2 className="h-16 w-16 text-emerald-400 mx-auto" />
                <p className="text-sm font-bold text-emerald-400">BIOMETRIC MATCH VERIFIED</p>
                <p className="text-[11px] text-[#D3C3B9]/90 font-mono">Similarity Score: 99.4% · Liveness: PASS</p>
              </div>
            )}

            {/* Corner Markers */}
            <div className="absolute top-3 left-3 h-4 w-4 border-t-2 border-l-2 border-[#FFB162]" />
            <div className="absolute top-3 right-3 h-4 w-4 border-t-2 border-r-2 border-[#FFB162]" />
            <div className="absolute bottom-3 left-3 h-4 w-4 border-b-2 border-l-2 border-[#FFB162]" />
            <div className="absolute bottom-3 right-3 h-4 w-4 border-b-2 border-r-2 border-[#FFB162]" />
          </div>

          <div className="rounded-lg bg-[#2C3B4D]/60 p-3 border border-[#B58863]/30 text-center space-y-1">
            <p className="text-xs font-bold text-white flex items-center justify-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-[#FFB162]" /> Plug-and-Play Biometric Interface
            </p>
            <p className="text-[10px] text-[#D3C3B9]/80 leading-normal">
              Designed according to MoSJE/Aadhaar L1 Biometric Device specifications. Can be swapped with face-api.js or WebAuthn.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="button-press rounded-lg border border-[#C9C1B1]/40 bg-transparent px-4 py-2 text-xs font-bold text-[#D3C3B9] hover:bg-white/10"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
