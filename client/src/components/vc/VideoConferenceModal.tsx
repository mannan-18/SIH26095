import { useState, useEffect } from "react";
import { Video, PhoneCall, PhoneOff, X, Clock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface VideoConferenceModalProps {
  onCallStateChange?: () => void;
}

export default function VideoConferenceModal({ onCallStateChange }: VideoConferenceModalProps) {
  const activeCalls = trpc.vc.activeCalls.useQuery(undefined, { refetchInterval: 3000 });
  const answerCall = trpc.vc.answerCall.useMutation({
    onSuccess: () => {
      toast.success("Joined surprise video conference");
      activeCalls.refetch();
      onCallStateChange?.();
    },
  });
  const declineCall = trpc.vc.declineCall.useMutation({
    onSuccess: () => {
      toast.error("Call declined. Logged as anomaly in forensic ledger.");
      activeCalls.refetch();
      onCallStateChange?.();
    },
  });
  const missCall = trpc.vc.missCall.useMutation({
    onSuccess: () => {
      toast.error("Call missed! Unanswered call recorded in audit ledger.");
      activeCalls.refetch();
      onCallStateChange?.();
    },
  });
  const endCall = trpc.vc.endCall.useMutation({
    onSuccess: () => {
      toast.info("Video call session ended.");
      activeCalls.refetch();
      onCallStateChange?.();
    },
  });

  const [timeLeft, setTimeLeft] = useState<number>(30);

  // Find latest active call (RINGING or ANSWERED)
  const currentCall = activeCalls.data?.find(
    (s) => s.status === "RINGING" || s.status === "ANSWERED"
  );

  useEffect(() => {
    if (!currentCall || currentCall.status !== "RINGING") {
      setTimeLeft(30);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          missCall.mutate({ sessionId: currentCall.id });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentCall?.id, currentCall?.status]);

  if (!currentCall) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="panel max-w-2xl w-full bg-[#161610] text-white border-2 border-[#B58863]/60 shadow-2xl overflow-hidden rounded-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between bg-[#152D3F] p-4 border-b border-[#B58863]/40">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
            </span>
            <div>
              <p className="eyebrow text-[#B58863]">Command Centre Directive</p>
              <h3 className="text-base font-bold text-white tracking-wide">
                Surprise Spot-Check Video Call
              </h3>
            </div>
          </div>
          <span className="rounded bg-[#B58863] px-2.5 py-1 text-[10px] font-bold text-[#161610]">
            RANDOM SELECTION
          </span>
        </div>

        {/* Modal Content */}
        {currentCall.status === "RINGING" && (
          <div className="p-6 text-center space-y-5">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#152D3F] border-2 border-[#FFB162] animate-bounce">
              <PhoneCall className="h-10 w-10 text-[#FFB162]" />
            </div>

            <div>
              <h4 className="text-xl font-bold text-white">{currentCall.instituteName}</h4>
              <p className="text-xs text-[#D3C3B9] mt-1 font-mono">
                Target: {currentCall.contactName} ({currentCall.contactRole})
              </p>
            </div>

            {/* Countdown bar */}
            <div className="rounded-xl bg-[#2C3B4D] p-3 border border-[#B58863]/30 max-w-sm mx-auto">
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="text-[#D3C3B9] flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-[#FFB162]" /> Time to Respond:
                </span>
                <span className="font-mono text-rose-400 font-bold">{timeLeft}s</span>
              </div>
              <div className="w-full bg-[#161610] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 h-full transition-all duration-1000 ease-linear"
                  style={{ width: `${(timeLeft / 30) * 100}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">
                Unanswered calls automatically log as "MISSED" anomaly in hash-chained audit ledger.
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                type="button"
                disabled={declineCall.isPending}
                onClick={() => declineCall.mutate({ sessionId: currentCall.id })}
                className="button-press inline-flex items-center gap-2 rounded-xl bg-rose-600 px-6 py-3 text-xs font-bold text-white hover:bg-rose-700 transition-colors shadow-md"
              >
                <PhoneOff className="h-4 w-4" /> Decline Call
              </button>
              <button
                type="button"
                disabled={answerCall.isPending}
                onClick={() => answerCall.mutate({ sessionId: currentCall.id })}
                className="button-press inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-md animate-pulse"
              >
                <Video className="h-4 w-4" /> Join Video Call
              </button>
            </div>
          </div>
        )}

        {currentCall.status === "ANSWERED" && (
          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between text-xs font-mono text-[#D3C3B9] px-1">
              <span>Connected: {currentCall.contactName}</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" /> SECURE JITSI ENCRYPTED
              </span>
            </div>

            {/* Jitsi Embed Iframe */}
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black border border-[#B58863]/40">
              <iframe
                src={`${currentCall.jitsiUrl}#config.prejoinPageEnabled=false`}
                allow="camera; microphone; fullscreen; display-capture; autoplay"
                className="h-full w-full border-none"
                title="Random Inspection Video Conference"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={endCall.isPending}
                onClick={() => endCall.mutate({ sessionId: currentCall.id })}
                className="button-press inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 transition-colors shadow-sm"
              >
                <PhoneOff className="h-4 w-4" /> End Call
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
