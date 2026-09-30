import { 
  ClipboardCheck, Users, FileCheck2, Camera, MapPin, 
  ShieldCheck, AlertTriangle, ArrowRight, RefreshCw, Smartphone, 
  CheckCircle2, Clock, Check
} from "lucide-react";

interface InspectorDashboardViewProps {
  user: any;
  inspections: any[];
  assignments: any[];
  offlineQueue: any[];
  onSelectView: (view: any) => void;
  onSelectInspection: (id: string) => void;
}

export default function InspectorDashboardView({
  user,
  inspections,
  assignments,
  offlineQueue,
  onSelectView,
  onSelectInspection,
}: InspectorDashboardViewProps) {
  const inspectorName = user?.name || "Dr. Sunita Rao (Field Inspector)";
  const inspectorId = "PMU-INSP-101";

  // Filter or prioritize inspections assigned to PMU Inspector
  const assignedList = inspections.filter(
    (i) => i.inspectorName?.toLowerCase().includes("sunita") || i.inspectorName?.toLowerCase().includes("inspector") || true
  );
  const activeAssignment = assignments[0];
  const activeInspection = inspections.find((i) => i.id === activeAssignment?.inspectionId) || inspections[0];

  return (
    <div className="space-y-6">
      {/* Inspector Hero Banner */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end rounded-2xl bg-gradient-to-r from-[#161610] via-[#152D3F] to-[#161610] p-6 text-white shadow-md border border-[#B58863]/30">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#B58863]/20 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-[#B58863] border border-[#B58863]/40">
              <span className="h-1.5 w-1.5 rounded-full bg-[#B58863] animate-pulse" />
              PMU FIELD TERMINAL
            </span>
            <span className="font-mono text-xs text-[#D3C3B9]/90">ID: {inspectorId}</span>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Welcome, {inspectorName}
          </h2>
          <p className="mt-2 max-w-2xl text-xs sm:text-sm leading-5 text-[#D3C3B9]/90">
            Assigned surprise inspections, Haversine 100m geofence verification, on-site checklist execution, and cryptographic SHA-256 evidence sealing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => onSelectView("assignments")}
            className="button-press inline-flex items-center gap-2 rounded-lg bg-[#B58863] px-4 py-2.5 text-xs sm:text-sm font-bold text-[#161610] shadow-sm hover:bg-[#c69974] transition-colors"
          >
            Open field audit <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="panel p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">Assigned inspections</p>
              <p className="mt-1 text-2xl font-bold text-[#2C3B4D] sm:text-3xl">{assignedList.length}</p>
              <p className="mt-1 text-xs text-slate-500">In current jurisdiction</p>
            </div>
            <div className="rounded-lg bg-[#EEE9DF] p-2.5 text-[#2C3B4D]">
              <ClipboardCheck className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="panel p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">Geofence validation</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700 sm:text-3xl">100m</p>
              <p className="mt-1 text-xs text-slate-500">Haversine gate active</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-700">
              <MapPin className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="panel p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">Evidence integrity</p>
              <p className="mt-1 text-2xl font-bold text-[#2C3B4D] sm:text-3xl">SHA-256</p>
              <p className="mt-1 text-xs text-slate-500">Server verified hashes</p>
            </div>
            <div className="rounded-lg bg-[#EEE9DF] p-2.5 text-[#A35139]">
              <FileCheck2 className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="panel p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">Offline sync queue</p>
              <p className="mt-1 text-2xl font-bold text-[#A35139] sm:text-3xl">{offlineQueue.length}</p>
              <p className="mt-1 text-xs text-slate-500">IndexedDB stored actions</p>
            </div>
            <div className="rounded-lg bg-[#EEE9DF] p-2.5 text-[#A35139]">
              <Smartphone className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Active Field Verification Spotlight */}
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="panel p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3 border-b border-[#C9C1B1]/40 pb-4">
            <div>
              <span className="eyebrow text-[#A35139]">Active Field Mission</span>
              <h3 className="mt-1 text-lg font-bold text-[#1B2632]">
                {activeInspection?.instituteName || "Samarthan Institute for Disabilities"}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Inspection ID: <span className="font-mono font-bold text-[#2C3B4D]">{activeInspection?.id || "INSP-0001"}</span> · Scheme: Deendayal Disabled Rehabilitation Scheme
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-[#FFB162]/20 border border-[#FFB162]/40 px-2.5 py-1 text-xs font-bold text-[#1B2632]">
              {activeInspection?.status || "IN_PROGRESS"}
            </span>
          </div>

          {/* Stepper */}
          <div className="my-5">
            <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">Protocol Pipeline</p>
            <div className="grid grid-cols-5 gap-2 text-center text-[11px]">
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-emerald-800">
                <Check className="h-4 w-4 mx-auto mb-1 text-emerald-600" />
                <span className="font-semibold block">1. Sealed</span>
                <span className="text-[10px] text-emerald-600">Revealed</span>
              </div>
              <div className="rounded-lg bg-[#EEE9DF] border border-[#C9C1B1] p-2 text-[#2C3B4D]">
                <MapPin className="h-4 w-4 mx-auto mb-1 text-[#2C3B4D]" />
                <span className="font-semibold block">2. GPS Gate</span>
                <span className="text-[10px] text-[#A35139] font-semibold">100m Match</span>
              </div>
              <div className="rounded-lg bg-[#EEE9DF] border border-[#C9C1B1] p-2 text-[#2C3B4D]">
                <ClipboardCheck className="h-4 w-4 mx-auto mb-1 text-[#2C3B4D]" />
                <span className="font-semibold block">3. Checklist</span>
                <span className="text-[10px] text-[#2C3B4D]">8/8 Items</span>
              </div>
              <div className="rounded-lg bg-[#FFB162]/20 border border-[#FFB162]/50 p-2 text-[#1B2632]">
                <FileCheck2 className="h-4 w-4 mx-auto mb-1 text-[#A35139]" />
                <span className="font-semibold block">4. Evidence</span>
                <span className="text-[10px] text-[#A35139] font-bold">SHA-256</span>
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-2 text-slate-600">
                <CheckCircle2 className="h-4 w-4 mx-auto mb-1 text-slate-400" />
                <span className="font-semibold block">5. Submit</span>
                <span className="text-[10px] text-slate-400">Risk Audit</span>
              </div>
            </div>
          </div>

          {/* Quick Action Matrix */}
          <div className="mt-4 flex flex-wrap gap-2.5 pt-3 border-t border-[#C9C1B1]/40">
            <button
              onClick={() => {
                onSelectInspection(activeInspection?.id || "INSP-0001");
                onSelectView("assignments");
              }}
              className="button-press flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#FFB162] px-3.5 py-2.5 text-xs font-bold text-[#1B2632] hover:bg-[#f59e4b]"
            >
              <ClipboardCheck className="h-4 w-4" />
              Continue Checklist &amp; GPS
            </button>
            <button
              onClick={() => onSelectView("evidence")}
              className="button-press inline-flex items-center justify-center gap-2 rounded-lg border border-[#C9C1B1] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#2C3B4D] hover:bg-[#EEE9DF]"
            >
              <FileCheck2 className="h-4 w-4 text-[#A35139]" />
              Capture Evidence
            </button>
            <button
              onClick={() => onSelectView("cctv")}
              className="button-press inline-flex items-center justify-center gap-2 rounded-lg border border-[#C9C1B1] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#2C3B4D] hover:bg-[#EEE9DF]"
            >
              <Camera className="h-4 w-4 text-[#2C3B4D]" />
              View CCTV
            </button>
          </div>
        </div>

        {/* Proximity & Security Notice */}
        <div className="space-y-4">
          <div className="panel p-5 bg-[#1B2632] text-white border border-[#C9C1B1]/30">
            <div className="flex items-center gap-2.5 text-[#FFB162]">
              <ShieldCheck className="h-5 w-5" />
              <h4 className="font-bold text-sm tracking-wide">Inspector Integrity Rules</h4>
            </div>
            <ul className="mt-3 space-y-2 text-xs text-[#EEE9DF]/80 leading-5">
              <li className="flex items-start gap-2">
                <span className="text-[#FFB162] font-bold">•</span>
                <span>Assignments are randomized on the server and sealed prior to inspection time.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFB162] font-bold">•</span>
                <span>Geofencing requires physical presence within 100 meters of registered coordinates.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFB162] font-bold">•</span>
                <span>Evidence captures are stamped with client GPS and hashed with SHA-256 on upload.</span>
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-[#C9C1B1] bg-[#EEE9DF]/60 p-4 text-xs text-[#2C3B4D] leading-relaxed">
            <p className="font-bold text-[#1B2632] flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-[#A35139]" /> Offline Field Capability
            </p>
            <p className="mt-1">
              In low connectivity zones, checklist items and observations are saved to your browser&apos;s encrypted IndexedDB store and synced upon reconnection.
            </p>
          </div>
        </div>
      </div>

      {/* Inspector Assigned Inspections Table */}
      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[#C9C1B1]/30">
          <div>
            <p className="eyebrow">Assigned Roster</p>
            <h3 className="mt-0.5 text-base font-bold text-[#1B2632]">Field Inspection Queue</h3>
          </div>
          <button
            onClick={() => onSelectView("inspections")}
            className="text-xs font-bold text-[#A35139] hover:text-[#1B2632]"
          >
            View full queue →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Inspection ID</th>
                <th>Institute Name</th>
                <th>Assigned Date</th>
                <th>Geofence</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {assignedList.slice(0, 5).map((item) => (
                <tr key={item.id} className="hover:bg-[#EEE9DF]/40">
                  <td className="font-mono text-xs font-bold text-[#2C3B4D]">{item.id}</td>
                  <td className="font-semibold text-slate-800">{item.instituteName}</td>
                  <td className="text-xs text-slate-500">{new Date(item.scheduledAt).toLocaleDateString()}</td>
                  <td>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      item.geofence === "INSIDE_GEOFENCE" ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-600"
                    }`}>
                      {item.geofence ? item.geofence.replace("_", " ") : "PENDING"}
                    </span>
                  </td>
                  <td>
                    <span className="inline-flex items-center rounded-full bg-[#EEE9DF] border border-[#C9C1B1] px-2 py-0.5 text-[10px] font-bold text-[#2C3B4D]">
                      {item.status}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => {
                        onSelectInspection(item.id);
                        onSelectView("assignments");
                      }}
                      className="rounded-md bg-[#FFB162]/20 border border-[#FFB162]/50 px-2.5 py-1 text-xs font-bold text-[#1B2632] hover:bg-[#FFB162]/40"
                    >
                      Audit →
                    </button>
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
