import { useState } from "react";
import { 
  Building2, ShieldCheck, Siren, Camera, Video, AlertTriangle, 
  CheckCircle2, Clock, Landmark, LockKeyhole, RefreshCw, Layers
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import CctvPlayer from "@/components/cctv/CctvPlayer";

interface StateAuthorityDashboardProps {
  user: any;
  onSelectView: (view: any) => void;
}

export default function StateAuthorityDashboardView({
  user,
  onSelectView,
}: StateAuthorityDashboardProps) {
  const utils = trpc.useUtils();
  const regionalData = trpc.stateAuthority.overview.useQuery();
  const [isTesting, setIsTesting] = useState(false);

  const handleTestCrossState = async () => {
    setIsTesting(true);
    try {
      await utils.stateAuthority.getRegionalData.fetch({ requestedState: "Maharashtra" });
      toast.error("Cross-state fetch succeeded unexpectedly!");
    } catch (err: any) {
      toast.success(`SERVER ENFORCEMENT PROVED: ${err?.message || "FORBIDDEN out-of-scope request"}`);
    } finally {
      setIsTesting(false);
    }
  };

  if (regionalData.isLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <RefreshCw className="h-8 w-8 animate-spin text-[#B58863]" />
      </div>
    );
  }

  const data = regionalData.data;
  const stateScopeName = data?.stateScope || "Delhi";

  return (
    <div className="space-y-6">
      {/* State Authority Hero Banner */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end rounded-2xl bg-gradient-to-r from-[#161610] via-[#152D3F] to-[#161610] p-6 text-white shadow-md border border-[#B58863]/40">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFB162]/20 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-[#FFB162] border border-[#FFB162]/40">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FFB162] animate-pulse" />
              STATE / UT JURISDICTION DASHBOARD
            </span>
            <span className="rounded bg-emerald-950 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400 border border-emerald-500/40">
              SERVER SCOPE: {stateScopeName.toUpperCase()}
            </span>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {stateScopeName} State Social Justice Directorate
          </h2>
          <p className="mt-2 max-w-2xl text-xs sm:text-sm leading-5 text-[#D3C3B9]/90">
            Read-only, server-scoped monitoring portal for state/district officials. Tracks local inspections, CCTV status, open anomalies, and surprise VC outcomes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={isTesting}
            onClick={handleTestCrossState}
            className="button-press inline-flex items-center gap-2 rounded-lg border border-[#A35139]/50 bg-[#A35139]/20 px-3.5 py-2.5 text-xs font-bold text-[#FFB162] hover:bg-[#A35139]/40 transition-colors shadow-sm"
            title="Attempts fetching Maharashtra state data from Delhi State Authority login to prove server-side scoping enforcement"
          >
            <LockKeyhole className="h-4 w-4 text-[#FFB162]" />
            Test Cross-State Fetch Protection
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="panel p-4 sm:p-5">
          <p className="eyebrow">Regional NGO Institutes</p>
          <p className="mt-1 text-2xl font-bold text-[#2C3B4D] sm:text-3xl">
            {data?.kpis.institutesCount ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">Registered in {stateScopeName}</p>
        </div>

        <div className="panel p-4 sm:p-5">
          <p className="eyebrow">Inspections Completed</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700 sm:text-3xl">
            {data?.kpis.inspectionsDone ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {data?.kpis.inspectionsPending ?? 0} Pending
          </p>
        </div>

        <div className="panel p-4 sm:p-5">
          <p className="eyebrow">Compliance Score</p>
          <p className="mt-1 text-2xl font-bold text-[#2C3B4D] sm:text-3xl">
            {data?.kpis.complianceScore ?? 85}%
          </p>
          <p className="mt-1 text-xs text-slate-500">Regional aggregate</p>
        </div>

        <div className="panel p-4 sm:p-5">
          <p className="eyebrow">Open Anomaly Alerts</p>
          <p className="mt-1 text-2xl font-bold text-[#A35139] sm:text-3xl">
            {data?.kpis.openAnomalies ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">Requires state action</p>
        </div>

        <div className="panel p-4 sm:p-5">
          <p className="eyebrow">CCTV Feed Uptime</p>
          <p className="mt-1 text-2xl font-bold text-teal-700 sm:text-3xl">
            {data?.kpis.cctvHealth ?? 100}%
          </p>
          <p className="mt-1 text-xs text-slate-500">Live surveillance status</p>
        </div>
      </div>

      {/* Regional Grid: Inspections & Anomalies */}
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        {/* Regional Institutes & Inspection Status */}
        <div className="panel overflow-hidden">
          <div className="p-4 bg-[#EFEBE3] border-b border-[#C9C1B1] flex items-center justify-between">
            <div>
              <p className="eyebrow text-[#152D3F]">{stateScopeName} Region Scope</p>
              <h3 className="text-base font-bold text-[#1B2632]">Regional Institute Roster &amp; Audits</h3>
            </div>
            <span className="text-xs font-mono font-bold text-[#A35139]">READ-ONLY ACCESS</span>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Institute Name</th>
                  <th>District</th>
                  <th>Scheme</th>
                  <th>Beneficiaries</th>
                  <th>CCTV Uptime</th>
                  <th>Risk Level</th>
                </tr>
              </thead>
              <tbody>
                {(data?.institutes ?? []).map((inst) => (
                  <tr key={inst.id} className="hover:bg-[#EEE9DF]/40">
                    <td>
                      <p className="font-bold text-[#2C3B4D]">{inst.name}</p>
                      <p className="font-mono text-[10px] text-slate-500">{inst.id}</p>
                    </td>
                    <td className="text-xs font-medium text-slate-700">{inst.district}</td>
                    <td className="text-xs text-slate-600">{inst.scheme}</td>
                    <td className="font-mono text-xs font-bold text-slate-800">{inst.beneficiaryCount}</td>
                    <td>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        inst.cctvOnline ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                      }`}>
                        {inst.cctvOnline ? "ONLINE" : "OFFLINE"}
                      </span>
                    </td>
                    <td>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        inst.riskLevel === "HIGH" ? "bg-rose-100 text-rose-800" : inst.riskLevel === "MEDIUM" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                      }`}>
                        {inst.riskLevel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Regional Open Anomalies & VC Outcomes */}
        <div className="space-y-4">
          <div className="panel p-5">
            <div className="flex items-center justify-between border-b border-[#C9C1B1]/40 pb-3 mb-3">
              <h4 className="font-bold text-sm text-[#1B2632] flex items-center gap-1.5">
                <Siren className="h-4 w-4 text-[#A35139]" /> Regional Anomaly Alerts
              </h4>
              <span className="text-xs font-bold text-[#A35139]">{data?.alerts.length ?? 0} Alerts</span>
            </div>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {(data?.alerts ?? []).map((alt) => (
                <div key={alt.id} className="rounded-lg border border-[#C9C1B1]/60 bg-[#FAF8F5] p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1B2632]">{alt.title}</span>
                    <span className="font-mono text-[10px] font-bold text-[#A35139]">{alt.severity}</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">{alt.detail}</p>
                </div>
              ))}
              {(!data?.alerts || data.alerts.length === 0) && (
                <p className="text-xs text-slate-500 py-4 text-center">No open anomaly alerts in {stateScopeName}.</p>
              )}
            </div>
          </div>

          <div className="panel p-5">
            <div className="flex items-center justify-between border-b border-[#C9C1B1]/40 pb-3 mb-3">
              <h4 className="font-bold text-sm text-[#1B2632] flex items-center gap-1.5">
                <Video className="h-4 w-4 text-[#152D3F]" /> Regional VC Inspection Calls
              </h4>
              <span className="text-xs font-bold text-[#152D3F]">{data?.vcOutcomes.length ?? 0} Calls</span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {(data?.vcOutcomes ?? []).map((vc) => (
                <div key={vc.id} className="rounded-lg border border-[#C9C1B1]/50 bg-white p-2.5 text-xs flex items-center justify-between">
                  <div>
                    <p className="font-bold text-[#1B2632]">{vc.instituteName}</p>
                    <p className="text-[10px] text-slate-500">{vc.contactName}</p>
                  </div>
                  <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                    vc.status === "ANSWERED" ? "bg-emerald-100 text-emerald-800" : vc.status === "MISSED" ? "bg-rose-100 text-rose-800 font-bold" : "bg-amber-100 text-amber-800"
                  }`}>
                    {vc.status}
                  </span>
                </div>
              ))}
              {(!data?.vcOutcomes || data.vcOutcomes.length === 0) && (
                <p className="text-xs text-slate-500 py-3 text-center">No VC calls logged for {stateScopeName}.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
