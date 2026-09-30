import { useState } from "react";
import { 
  Users, Wallet, BarChart3, CheckCircle2, 
  ArrowRight, ShieldCheck, Clock, Landmark, 
  Download, Send, AlertTriangle, FileText, Check, HeartHandshake, ScanLine
} from "lucide-react";
import { toast } from "sonner";
import BiometricCheckinModal from "@/components/capture/BiometricCheckinModal";

interface BeneficiaryDashboardViewProps {
  user: any;
  onSelectView: (view: any) => void;
}

export default function BeneficiaryDashboardView({
  user,
  onSelectView,
}: BeneficiaryDashboardViewProps) {
  const beneficiaryName = user?.name || "Anand Kumar";
  const beneficiaryId = "BEN-2026-999";
  const [grievanceText, setGrievanceText] = useState("");
  const [grievanceCategory, setGrievanceCategory] = useState("stipend");
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [biometricResult, setBiometricResult] = useState<{ faceMatchScore: number; livenessPassed: boolean } | null>(null);

  const handleLodgeGrievance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!grievanceText.trim()) {
      toast.error("Please provide grievance details before submitting");
      return;
    }
    const ticketId = `GRV-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    setSubmittedTicket(ticketId);
    toast.success(`Grievance submitted directly to DoSJE Ministry. Ticket ID: ${ticketId}`);
    setGrievanceText("");
  };

  return (
    <div className="space-y-6">
      {showBiometricModal && (
        <BiometricCheckinModal
          onClose={() => setShowBiometricModal(false)}
          onSuccess={(res) => {
            setBiometricResult(res);
            setShowBiometricModal(false);
            toast.success(`Biometric Check-in Recorded for ${beneficiaryName}!`);
          }}
        />
      )}

      {/* Citizen Hero Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end rounded-2xl bg-gradient-to-r from-[#161610] via-[#152D3F] to-[#161610] p-6 text-white shadow-md border border-[#B58863]/30">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-emerald-300 border border-emerald-400/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              VERIFIED BENEFICIARY · CITIZEN PORTAL
            </span>
            <span className="font-mono text-xs text-[#B58863] font-bold">ID: {beneficiaryId}</span>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Welcome, {beneficiaryName}
          </h2>
          <p className="mt-2 max-w-2xl text-xs sm:text-sm leading-5 text-[#D3C3B9]/90">
            Post-Matric Scholarship &amp; Aid Scheme. Transparently monitor your DBT scholarship transfers, biometric attendance validation, and lodge complaints directly to the Ministry.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => setShowBiometricModal(true)}
            className="button-press inline-flex items-center gap-2 rounded-lg bg-[#FFB162] px-4 py-2.5 text-xs sm:text-sm font-bold text-[#161610] shadow-sm hover:bg-[#f59e4b] transition-colors"
          >
            <ScanLine className="h-4 w-4" /> Biometric Check-in (Face Match)
          </button>
          <button
            onClick={() => onSelectView("beneficiary-dbt")}
            className="button-press inline-flex items-center gap-2 rounded-lg bg-[#B58863] px-4 py-2.5 text-xs sm:text-sm font-bold text-[#161610] shadow-sm hover:bg-[#c69974] transition-colors"
          >
            Track DBT Payments <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="panel p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">Sanctioned Annual Aid</p>
              <p className="mt-1 text-2xl font-bold text-[#2C3B4D] sm:text-3xl">₹48,000</p>
              <p className="mt-1 text-xs text-slate-500">Post-Matric Scholarship &amp; Stipend</p>
            </div>
            <div className="rounded-lg bg-[#EEE9DF] p-2.5 text-[#2C3B4D]">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="panel p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">Quarterly DBT Status</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700 sm:text-3xl">₹12,000</p>
              <p className="mt-1 text-xs text-emerald-700 font-semibold">Disbursed · Q3 Confirmed</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="panel p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">My Verified Attendance</p>
              <p className="mt-1 text-2xl font-bold text-teal-700 sm:text-3xl">
                {biometricResult ? "96.2%" : "94.5%"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {biometricResult 
                  ? `Bio-Verified (${biometricResult.faceMatchScore}% Match)` 
                  : "Meets 75% threshold for DBT"}
              </p>
            </div>
            <div className="rounded-lg bg-teal-50 p-2.5 text-teal-700">
              <BarChart3 className="h-5 w-5" />
            </div>
          </div>
          {biometricResult && (
            <div className="mt-2 rounded bg-emerald-100 p-1.5 text-[10px] font-bold text-emerald-900 flex items-center justify-between border border-emerald-300">
              <span>✓ Face-Match: {biometricResult.faceMatchScore}% · Liveness: PASS</span>
              <span className="bg-emerald-800 text-white text-[8px] px-1 rounded">MOCK</span>
            </div>
          )}
        </div>

        <div className="panel p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">Institute Verification</p>
              <p className="mt-1 text-2xl font-bold text-[#2C3B4D] sm:text-3xl">Grade A</p>
              <p className="mt-1 text-xs text-slate-500">Samarthan Kendra (Compliant)</p>
            </div>
            <div className="rounded-lg bg-[#EEE9DF] p-2.5 text-[#2C3B4D]">
              <Landmark className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* DBT Disbursement Tracker Pipeline */}
      <div className="panel p-5 sm:p-6">
        <div className="flex items-center justify-between border-b border-[#C9C1B1]/30 pb-3 mb-4">
          <div>
            <p className="eyebrow text-[#A35139]">Direct Benefit Transfer (DBT) Pipeline</p>
            <h3 className="text-base font-bold text-[#1B2632]">Latest Quarterly Installment Progress (₹12,000)</h3>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
            Transferred to Bank
          </span>
        </div>

        {/* Visual 4-step pipeline */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 my-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Step 1</span>
              <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-white text-xs">
                <Check className="h-3.5 w-3.5" />
              </span>
            </div>
            <h4 className="text-xs font-bold text-emerald-950">Eligibility Sanctioned</h4>
            <p className="text-[11px] text-emerald-800/80 mt-1">Application verified by State Nodal Officer</p>
            <span className="text-[10px] font-mono text-emerald-700 mt-2 block">12 Aug 2026</span>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Step 2</span>
              <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-white text-xs">
                <Check className="h-3.5 w-3.5" />
              </span>
            </div>
            <h4 className="text-xs font-bold text-emerald-950">Attendance Validated</h4>
            <p className="text-[11px] text-emerald-800/80 mt-1">26/28 days confirmed by institute biometric log</p>
            <span className="text-[10px] font-mono text-emerald-700 mt-2 block">01 Sep 2026</span>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Step 3</span>
              <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-white text-xs">
                <Check className="h-3.5 w-3.5" />
              </span>
            </div>
            <h4 className="text-xs font-bold text-emerald-950">PFMS Treasury Cleared</h4>
            <p className="text-[11px] text-emerald-800/80 mt-1">Public Financial Management System Batch #491028</p>
            <span className="text-[10px] font-mono text-emerald-700 mt-2 block">15 Sep 2026</span>
          </div>

          <div className="rounded-xl border border-[#C9C1B1] bg-[#EEE9DF]/70 p-4 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-[#1B2632] uppercase tracking-wider">Step 4</span>
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[#1B2632] text-[#FFB162] text-xs">
                <Check className="h-3.5 w-3.5" />
              </span>
            </div>
            <h4 className="text-xs font-bold text-[#1B2632]">DBT Bank Credit</h4>
            <p className="text-[11px] text-[#2C3B4D] mt-1">Aadhaar Bridge · UTR: SBIN0048192049</p>
            <span className="text-[10px] font-mono text-[#A35139] font-bold mt-2 block">22 Sep 2026</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-[#C9C1B1]/30">
          <span>Next Scheduled Installment: <b>₹12,000</b> on 15 December 2026</span>
          <button
            onClick={() => onSelectView("beneficiary-dbt")}
            className="font-bold text-[#A35139] hover:text-[#1B2632]"
          >
            View full transaction history →
          </button>
        </div>
      </div>

      {/* Grid: Scheme Details & Citizen Grievance Portal */}
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        {/* Scheme Details Card */}
        <div className="panel p-5 sm:p-6 space-y-4">
          <div className="border-b border-[#C9C1B1]/30 pb-3">
            <p className="eyebrow text-[#A35139]">Sanctioned Entitlement</p>
            <h3 className="text-base font-bold text-[#1B2632]">Scheme Registration Details</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-[#C9C1B1]/20">
              <span className="text-slate-500 font-medium">Scheme Name</span>
              <span className="font-bold text-[#1B2632] text-right">Post-Matric Scholarship for Students with Disabilities</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#C9C1B1]/20">
              <span className="text-slate-500 font-medium">Application Reference</span>
              <span className="font-mono font-bold text-[#2C3B4D]">DoSJE-SCH-2026-8819</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#C9C1B1]/20">
              <span className="text-slate-500 font-medium">Enrolled Institute</span>
              <span className="font-bold text-[#2C3B4D]">Samarthan Institute for Disabilities (INS-001)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#C9C1B1]/20">
              <span className="text-slate-500 font-medium">Aadhaar Authentication</span>
              <span className="font-semibold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Verified (UIDAI Bio-Auth)
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#C9C1B1]/20">
              <span className="text-slate-500 font-medium">Disbursement Account</span>
              <span className="font-mono text-slate-700">State Bank of India (***9012)</span>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => onSelectView("beneficiary-attendance")}
              className="button-press inline-flex items-center gap-2 rounded-lg bg-[#FFB162]/20 border border-[#FFB162]/40 px-3.5 py-2 text-xs font-bold text-[#1B2632] hover:bg-[#FFB162]/30"
            >
              <BarChart3 className="h-4 w-4 text-[#A35139]" />
              View My Attendance Verification Calendar
            </button>
          </div>
        </div>

        {/* Direct Grievance Redressal to Ministry */}
        <div className="panel p-5 sm:p-6 bg-[#EEE9DF]/40 border-[#C9C1B1]">
          <div className="border-b border-[#C9C1B1]/40 pb-3">
            <div className="flex items-center gap-2 text-[#A35139]">
              <ShieldCheck className="h-5 w-5 text-[#A35139]" />
              <h3 className="text-sm font-bold text-[#1B2632]">Direct Ministry Grievance Portal</h3>
            </div>
            <p className="text-[11px] text-slate-600 mt-1">
              Your grievance goes directly to the Department of Social Justice &amp; Empowerment and cannot be suppressed by institute authorities.
            </p>
          </div>

          {submittedTicket ? (
            <div className="my-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
              <div className="flex items-center gap-2 font-bold text-emerald-950 mb-1">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Grievance Registered Successfully
              </div>
              <p>Ticket Number: <span className="font-mono font-bold">{submittedTicket}</span></p>
              <p className="mt-1 text-[11px] text-emerald-800">
                A DoSJE Nodal Officer has been assigned to investigate your complaint within 48 business hours.
              </p>
              <button
                onClick={() => setSubmittedTicket(null)}
                className="mt-3 text-xs font-semibold text-emerald-700 underline"
              >
                Submit another request
              </button>
            </div>
          ) : (
            <form onSubmit={handleLodgeGrievance} className="mt-4 space-y-3">
              <div>
                <label className="eyebrow block mb-1">Grievance Category</label>
                <select
                  value={grievanceCategory}
                  onChange={(e) => setGrievanceCategory(e.target.value)}
                  className="w-full rounded-lg border border-[#C9C1B1] bg-white p-2 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-[#FFB162]"
                >
                  <option value="stipend">Delayed Scholarship / DBT Transfer</option>
                  <option value="attendance">Disputed Biometric Attendance Record</option>
                  <option value="facilities">Inadequate Hostel / Sanitation / Food Quality</option>
                  <option value="harassment">Discrimination or Grievance Against Staff</option>
                </select>
              </div>

              <div>
                <label className="eyebrow block mb-1">Details of Complaint</label>
                <textarea
                  value={grievanceText}
                  onChange={(e) => setGrievanceText(e.target.value)}
                  placeholder="Describe your issue with date, details, or missing scholarship..."
                  className="w-full rounded-lg border border-[#C9C1B1] bg-white p-2.5 text-xs outline-none focus:ring-2 focus:ring-[#FFB162] min-h-20"
                />
              </div>

              <button
                type="submit"
                className="button-press w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#FFB162] px-4 py-2.5 text-xs font-bold text-[#1B2632] hover:bg-[#f59e4b] shadow-sm"
              >
                <Send className="h-3.5 w-3.5" />
                Submit Directly to Ministry
              </button>
            </form>
          )}

          <div className="mt-3 text-[10px] text-slate-500">
            Protected by Whistleblower &amp; Beneficiary Rights Framework under Rights of Persons with Disabilities Act, 2016.
          </div>
        </div>
      </div>
    </div>
  );
}
