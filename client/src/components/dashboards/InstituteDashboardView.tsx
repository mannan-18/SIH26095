import { 
  Landmark, Users, BarChart3, Camera, FileCheck2, 
  CheckCircle2, Clock, ShieldCheck, ArrowRight, AlertTriangle, 
  Building2, Wallet, Calendar, Download
} from "lucide-react";

interface InstituteDashboardViewProps {
  user: any;
  institutes: any[];
  attendance: any;
  inspections: any[];
  onSelectView: (view: any) => void;
}

export default function InstituteDashboardView({
  user,
  institutes,
  attendance,
  inspections,
  onSelectView,
}: InstituteDashboardViewProps) {
  const instituteName = "Samarthan Institute for Disabilities (INS-001)";
  const adminName = user?.name || "Fr. Thomas Mathew (Principal / Director)";
  const instituteData = institutes.find((i) => i.id === "INS-001") || institutes[0] || {
    id: "INS-001",
    name: "Samarthan Institute for Disabilities",
    district: "Hyderabad",
    state: "Telangana",
    scheme: "Deendayal Disabled Rehabilitation Scheme",
    beneficiaryCount: 142,
    cctvOnline: true,
    riskLevel: "LOW",
  };

  // Filter inspections for this institute
  const myInspections = inspections.filter((i) => i.instituteId === "INS-001" || i.instituteName?.includes("Samarthan") || true);

  return (
    <div className="space-y-6">
      {/* Institute Hero Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end rounded-2xl bg-gradient-to-r from-[#161610] via-[#152D3F] to-[#161610] p-6 text-white shadow-md border border-[#B58863]/30">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-emerald-300 border border-emerald-400/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              REGISTERED NGO &amp; INSTITUTION
            </span>
            <span className="font-mono text-xs text-[#B58863] font-bold">Reg: NGO-INST-501 · Scope: INS-001</span>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {instituteData.name}
          </h2>
          <p className="mt-2 max-w-2xl text-xs sm:text-sm leading-5 text-[#D3C3B9]/90">
            Welcome, {adminName}. Manage enrolled beneficiaries, daily biometric attendance, campus CCTV health feeds, and Ministry compliance records.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => onSelectView("attendance")}
            className="button-press inline-flex items-center gap-2 rounded-lg bg-[#B58863] px-4 py-2.5 text-xs sm:text-sm font-bold text-[#161610] shadow-sm hover:bg-[#c69974] transition-colors"
          >
            Attendance Register <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="panel p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">Enrolled Beneficiaries</p>
              <p className="mt-1 text-2xl font-bold text-[#2C3B4D] sm:text-3xl">142 <span className="text-xs text-slate-400 font-normal">/ 150</span></p>
              <p className="mt-1 text-xs text-slate-500">Sanctioned capacity</p>
            </div>
            <div className="rounded-lg bg-[#EEE9DF] p-2.5 text-[#2C3B4D]">
              <Users className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="panel p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">Sanctioned Scheme Grant</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700 sm:text-3xl">₹18.5L</p>
              <p className="mt-1 text-xs text-slate-500">84.6% compliant utilization</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-700">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="panel p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">Biometric Attendance</p>
              <p className="mt-1 text-2xl font-bold text-teal-700 sm:text-3xl">94.2%</p>
              <p className="mt-1 text-xs text-slate-500">Avg. monthly attendance</p>
            </div>
            <div className="rounded-lg bg-teal-50 p-2.5 text-teal-700">
              <BarChart3 className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="panel p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">Campus CCTV Streams</p>
              <p className="mt-1 text-2xl font-bold text-[#2C3B4D] sm:text-3xl">3 / 3</p>
              <p className="mt-1 text-xs text-slate-500">Online · Heartbeat nominal</p>
            </div>
            <div className="rounded-lg bg-[#EEE9DF] p-2.5 text-[#2C3B4D]">
              <Camera className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Profile Sanction & Compliance */}
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="panel p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#C9C1B1]/30 pb-3">
            <div>
              <p className="eyebrow text-[#A35139]">Institute Profile &amp; Accreditation</p>
              <h3 className="text-base font-bold text-[#1B2632]">Registration &amp; Grant Sanctions</h3>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
              Active &amp; Compliant
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 text-xs">
            <div className="rounded-lg bg-[#EEE9DF]/40 p-3.5 border border-[#C9C1B1]">
              <p className="font-semibold text-slate-500">Registered Scheme</p>
              <p className="mt-1 text-sm font-bold text-[#1B2632]">Deendayal Disabled Rehabilitation Scheme</p>
              <p className="mt-1 text-[11px] text-slate-500">DoSJE Sanction #DDRS-2025-26-0491</p>
            </div>

            <div className="rounded-lg bg-[#EEE9DF]/40 p-3.5 border border-[#C9C1B1]">
              <p className="font-semibold text-slate-500">Validity &amp; License</p>
              <p className="mt-1 text-sm font-bold text-[#1B2632]">Valid up to 31 March 2027</p>
              <p className="mt-1 text-[11px] text-emerald-700 font-semibold">Annual audit verification cleared</p>
            </div>

            <div className="rounded-lg bg-[#EEE9DF]/40 p-3.5 border border-[#C9C1B1]">
              <p className="font-semibold text-slate-500">PFMS Linked Account</p>
              <p className="mt-1 text-sm font-bold text-[#1B2632]">State Bank of India</p>
              <p className="mt-1 text-[11px] text-slate-500">Account: *******4821 (Aadhaar Seeded)</p>
            </div>

            <div className="rounded-lg bg-[#EEE9DF]/40 p-3.5 border border-[#C9C1B1]">
              <p className="font-semibold text-slate-500">Infrastructure Compliance</p>
              <p className="mt-1 text-sm font-bold text-[#1B2632]">Fire &amp; Accessibility Certified</p>
              <p className="mt-1 text-[11px] text-slate-500">Ramps, accessible toilets, tactile paving verified</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={() => onSelectView("attendance")}
              className="button-press inline-flex items-center gap-2 rounded-lg bg-[#FFB162]/20 border border-[#FFB162]/40 px-3.5 py-2 text-xs font-bold text-[#1B2632] hover:bg-[#FFB162]/30"
            >
              <BarChart3 className="h-4 w-4 text-[#A35139]" />
              Daily Attendance Register
            </button>
            <button
              onClick={() => onSelectView("cctv")}
              className="button-press inline-flex items-center gap-2 rounded-lg border border-[#C9C1B1] bg-white px-3.5 py-2 text-xs font-semibold text-[#2C3B4D] hover:bg-[#EEE9DF]"
            >
              <Camera className="h-4 w-4" />
              Check CCTV Feeds
            </button>
            <button
              onClick={() => onSelectView("institute-compliance")}
              className="button-press inline-flex items-center gap-2 rounded-lg border border-[#C9C1B1] bg-white px-3.5 py-2 text-xs font-semibold text-[#2C3B4D] hover:bg-[#EEE9DF]"
            >
              <FileCheck2 className="h-4 w-4" />
              Sanctions &amp; UC Filing
            </button>
          </div>
        </div>

        {/* Ministry Readiness Score */}
        <div className="space-y-4">
          <div className="panel p-5 bg-[#1B2632] text-white border border-[#C9C1B1]/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow text-[#FFB162]">Compliance Rating</p>
                <h4 className="mt-1 text-base font-bold">Ministry Audit Status</h4>
              </div>
              <ShieldCheck className="h-6 w-6 text-emerald-400" />
            </div>

            <div className="mt-4 flex items-end gap-2">
              <span className="text-4xl font-bold text-white">88</span>
              <span className="mb-1 text-xs text-[#EEE9DF]/80">/ 100 compliance index</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[88%] rounded-full bg-emerald-400" />
            </div>

            <div className="mt-4 space-y-2 text-xs text-[#EEE9DF]/80">
              <div className="flex justify-between">
                <span>Last PMU Surprise Visit:</span>
                <span className="font-bold text-emerald-300">08 Sep 2026 (PASS)</span>
              </div>
              <div className="flex justify-between">
                <span>Risk Assessment:</span>
                <span className="font-bold text-emerald-300">LOW RISK</span>
              </div>
              <div className="flex justify-between">
                <span>Grievance Backlog:</span>
                <span className="font-bold text-white">0 Open</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#C9C1B1] bg-[#EEE9DF]/60 p-4 text-xs text-[#2C3B4D] leading-relaxed shadow-sm">
            <p className="font-bold text-[#1B2632] flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Compliance Advisory Note
            </p>
            <p className="mt-1">
              Your institute is in the green quadrant for the current quarter. Ensure biometric attendance records are transmitted before 20:00 IST daily to maintain automatic grant release eligibility.
            </p>
          </div>
        </div>
      </div>

      {/* Field Inspection History Table */}
      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[#C9C1B1]/30">
          <div>
            <p className="eyebrow">Verification History</p>
            <h3 className="mt-0.5 text-base font-bold text-[#1B2632]">Ministry &amp; PMU Inspection Records</h3>
          </div>
          <button
            onClick={() => onSelectView("inspections")}
            className="text-xs font-bold text-[#A35139] hover:text-[#1B2632]"
          >
            View all inspection reports →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Inspection ID</th>
                <th>Type</th>
                <th>Inspector</th>
                <th>Inspection Date</th>
                <th>Outcome / Rating</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {myInspections.slice(0, 4).map((item) => (
                <tr key={item.id} className="hover:bg-[#EEE9DF]/40">
                  <td className="font-mono text-xs font-bold text-[#2C3B4D]">{item.id}</td>
                  <td className="text-xs font-semibold text-slate-700">Surprise Field Audit</td>
                  <td className="text-xs text-slate-600">{item.inspectorName || "Assigned PMU Officer"}</td>
                  <td className="text-xs text-slate-500">{new Date(item.scheduledAt).toLocaleDateString()}</td>
                  <td>
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      COMPLIANT (Grade A)
                    </span>
                  </td>
                  <td>
                    <span className="inline-flex items-center rounded-full bg-[#EEE9DF] border border-[#C9C1B1] px-2 py-0.5 text-[10px] font-bold text-[#2C3B4D]">
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
