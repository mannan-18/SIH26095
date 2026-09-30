import { trpc } from "@/lib/trpc";
import { enqueueOffline, listOfflineQueue, type OfflineQueueItem } from "@/lib/offlineQueue";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, ArrowRight, BadgeCheck, BarChart3, Bell, Camera, Check, ChevronRight,
  ClipboardCheck, FileCheck2, Fingerprint, Gauge, Grid2X2, Landmark, LockKeyhole, LogOut, MapPin, Menu,
  Radio, RefreshCw, ScanLine, Search, ShieldCheck, Siren, Smartphone, Users, Video, X, Download, Send, CheckCircle2, Key
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { DEMO_ROLES } from "@shared/const";
import InspectorDashboardView from "@/components/dashboards/InspectorDashboardView";
import CameraCapture from "@/components/capture/CameraCapture";
import VideoConferenceModal from "@/components/vc/VideoConferenceModal";
import CctvPlayer from "@/components/cctv/CctvPlayer";
import InstituteDashboardView from "@/components/dashboards/InstituteDashboardView";
import BeneficiaryDashboardView from "@/components/dashboards/BeneficiaryDashboardView";
import StateAuthorityDashboardView from "@/components/dashboards/StateAuthorityDashboardView";
import { 
  InstituteComplianceView, 
  BeneficiaryDbtView, 
  BeneficiaryAttendanceView, 
  BeneficiaryGrievanceView 
} from "@/components/dashboards/RoleSubViews";

type View = 
  | "dashboard" 
  | "map" 
  | "institutes" 
  | "inspections" 
  | "assignments" 
  | "evidence" 
  | "cctv" 
  | "attendance" 
  | "alerts" 
  | "audit" 
  | "admin"
  | "inspector-home"
  | "institute-home"
  | "institute-compliance"
  | "beneficiary-home"
  | "beneficiary-dbt"
  | "beneficiary-attendance"
  | "beneficiary-grievance"
  | "state-home";

type Risk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type Overview = {
  kpis: { projects: number; inspections: number; highRisk: number; openAlerts: number; evidenceVerified: number; cctvOnline: number };
  trend: Array<{ day: string; inspections: number; alerts: number }>;
  recentInspections: Array<{ id: string; instituteName: string; riskLevel: Risk; status: string }>;
  recentAlerts: Array<{ id: string; severity: string; title: string; detail: string; status: string }>;
  cctvHealth: number;
};

function StatusPill({ value }: { value: string }) {
  const styles: Record<string, string> = {
    LOW: "bg-emerald-50 text-emerald-800 ring-emerald-300", 
    MEDIUM: "bg-amber-50 text-amber-900 ring-amber-300",
    HIGH: "bg-[#A35139]/10 text-[#A35139] ring-[#A35139]/30", 
    CRITICAL: "bg-red-50 text-red-800 ring-red-300",
    OPEN: "bg-[#A35139]/15 text-[#A35139] ring-[#A35139]/40 font-bold", 
    ACKNOWLEDGED: "bg-blue-50 text-blue-800 ring-blue-200",
    RESOLVED: "bg-emerald-50 text-emerald-800 ring-emerald-300", 
    MATCH: "bg-emerald-100 text-emerald-900 ring-emerald-400 font-bold",
    TAMPERED: "bg-[#A35139] text-white ring-[#A35139] font-bold animate-pulse", 
    VERIFIED: "bg-emerald-50 text-emerald-800 ring-emerald-300",
    CLOSED: "bg-slate-100 text-slate-700 ring-slate-200", 
    SUBMITTED: "bg-[#2C3B4D] text-white ring-[#2C3B4D] font-bold",
    ASSIGNED: "bg-blue-50 text-blue-800 ring-blue-300", 
    IN_PROGRESS: "bg-[#FFB162]/20 text-[#7A3F00] ring-[#FFB162]/50 font-bold",
    ASSIGNMENT_PENDING: "bg-[#FAF7F2] text-slate-600 ring-slate-300", 
    INSIDE_GEOFENCE: "bg-emerald-50 text-emerald-800 ring-emerald-300",
    OUTSIDE_GEOFENCE: "bg-[#A35139]/15 text-[#A35139] ring-[#A35139]/40 font-bold", 
    LOCATION_UNAVAILABLE: "bg-slate-100 text-slate-600 ring-slate-300",
    CREATED: "bg-slate-100 text-slate-700 ring-slate-300", 
    SEALED: "bg-[#2C3B4D] text-[#FFB162] ring-[#2C3B4D] font-bold", 
    REVEALED: "bg-blue-50 text-blue-900 ring-blue-300 font-semibold",
    COMPLETED: "bg-emerald-50 text-emerald-800 ring-emerald-300",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ring-1 ring-inset ${styles[value] ?? "bg-slate-100 text-slate-600 ring-slate-200"}`}>{value.replaceAll("_", " ")}</span>;
}

function KpiCard({ label, value, detail, icon: Icon, tone = "blue" }: { label: string; value: number | string; detail: string; icon: typeof Activity; tone?: "blue" | "red" | "teal" | "amber" }) {
  const tones = { 
    blue: "bg-[#2C3B4D]/10 text-[#2C3B4D]", 
    red: "bg-[#A35139]/15 text-[#A35139]", 
    teal: "bg-emerald-50 text-emerald-700", 
    amber: "bg-[#FFB162]/25 text-[#8A4600]" 
  };
  return <div className="panel p-4 sm:p-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="eyebrow">{label}</p>
        <p className="mt-2 text-2xl font-bold tracking-tight text-[#1B2632] sm:text-3xl">{value}</p>
        <p className="mt-1 text-xs text-[#5C6773]">{detail}</p>
      </div>
      <div className={`rounded-lg p-2.5 ${tones[tone]}`}><Icon className="h-5 w-5" /></div>
    </div>
  </div>;
}

function SectionHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return <div className="mb-4 flex items-end justify-between gap-3"><div><p className="eyebrow">{eyebrow}</p><h2 className="mt-1 text-lg font-bold tracking-tight text-[#1B2632]">{title}</h2></div>{action}</div>;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { user: authUser, logout } = useAuth();
  const { data: user } = trpc.auth.me.useQuery(undefined, { retry: false, initialData: authUser ?? undefined });
  const utils = trpc.useUtils();

  const activeRoleKey = useMemo<"official" | "pmu" | "ngo" | "beneficiary" | "state">(() => {
    if (user?.role === "PMU_INSPECTOR") return "pmu";
    if (user?.role === "INSTITUTE_ADMIN") return "ngo";
    if (user?.role === "STATE_AUTHORITY") return "state";
    if (user?.role === "user") return "beneficiary";
    return "official";
  }, [user?.role]);

  const defaultRoleView = useMemo<View>(() => {
    if (activeRoleKey === "pmu") return "inspector-home";
    if (activeRoleKey === "ngo") return "institute-home";
    if (activeRoleKey === "beneficiary") return "beneficiary-home";
    if (activeRoleKey === "state") return "state-home";
    return "dashboard";
  }, [activeRoleKey]);

  const [view, setView] = useState<View>(defaultRoleView);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedInstitute, setSelectedInstitute] = useState("INS-001");
  const [selectedInspectionId, setSelectedInspectionId] = useState("INSP-0001");
  const [observation, setObservation] = useState("Facility register and beneficiary interaction reviewed.");
  const [checkState, setCheckState] = useState<Record<string, boolean>>({});
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>([]);
  const [isSwitchingPersona, setIsSwitchingPersona] = useState(false);

  useEffect(() => {
    if (user?.role) {
      if (user.role === "PMU_INSPECTOR") setView("inspector-home");
      else if (user.role === "INSTITUTE_ADMIN") setView("institute-home");
      else if (user.role === "user") setView("beneficiary-home");
      else setView("dashboard");
    }
  }, [user?.role]);

  const roleDisplayName = useMemo(() => {
    if (user?.role === "DEPARTMENT_ADMIN" || user?.role === "admin") return "Department Official";
    if (user?.role === "PMU_INSPECTOR") return "PMU / Inspector";
    if (user?.role === "INSTITUTE_ADMIN") return "NGO / Institute Admin";
    if (user?.role === "user") return "Beneficiary (Citizen)";
    return "Department Official";
  }, [user?.role]);

  const userInitials = useMemo(() => {
    const name = user?.name || roleDisplayName;
    return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  }, [user?.name, roleDisplayName]);

  const handleSignOut = async () => {
    try {
      await logout();
      document.cookie = "app_session_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0";
      sessionStorage.removeItem("manus-cookie");
      localStorage.removeItem("dosje-selected-role");
      localStorage.removeItem("dosje-user-data");
      utils.auth.me.setData(undefined, undefined);
      toast.success("Signed out successfully");
    } catch (e) {
      console.warn("Sign out warning:", e);
    } finally {
      window.location.href = "/login";
    }
  };

  const overview = trpc.dashboard.overview.useQuery();
  const institutes = trpc.dashboard.institutes.useQuery();
  const inspections = trpc.dashboard.inspections.useQuery();
  const assignments = trpc.dashboard.assignments.useQuery();
  const evidence = trpc.dashboard.evidence.useQuery();
  const attendance = trpc.dashboard.attendance.useQuery();
  const alerts = trpc.dashboard.alerts.useQuery();
  const audit = trpc.dashboard.audit.useQuery(undefined, { 
    enabled: user?.role === "admin" || user?.role === "DEPARTMENT_ADMIN" || user?.role === "AUDITOR" 
  });
  const checklist = trpc.dashboard.checklist.useQuery({ inspectionId: selectedInspectionId });
  const adminUsers = trpc.administration.users.useQuery(undefined, { enabled: user?.role === "admin" || user?.role === "DEPARTMENT_ADMIN" });

  useEffect(() => { if (user?.openId) void listOfflineQueue(user.openId).then(setOfflineQueue).catch(() => undefined); }, [user?.openId]);

  const refreshAll = () => Promise.all([
    utils.dashboard.overview.invalidate(), utils.dashboard.institutes.invalidate(), utils.dashboard.inspections.invalidate(),
    utils.dashboard.assignments.invalidate(), utils.dashboard.evidence.invalidate(), utils.dashboard.attendance.invalidate(),
    utils.dashboard.alerts.invalidate(), utils.dashboard.audit.invalidate(),
  ]);

  const loginMutation = trpc.auth.login.useMutation();

  const DEFAULT_DEMO_PASSWORDS: Record<string, string> = { official: "Admin@2026", pmu: "Inspect@2026", ngo: "Partner@2026", beneficiary: "Benefit@2026", state: "State@2026" };

  // Instant Persona Switcher for Evaluators & Reviewers
  const switchPersona = async (roleKey: "official" | "pmu" | "ngo" | "beneficiary" | "state") => {
    if (roleKey === activeRoleKey && isSwitchingPersona) return;
    const cred = DEMO_ROLES[roleKey];
    if (!cred) return;
    setIsSwitchingPersona(true);
    try {
      const res = await loginMutation.mutateAsync({
        role: roleKey,
        identifier: cred.primaryId,
        password: DEFAULT_DEMO_PASSWORDS[roleKey] || "secret",
        rememberMe: true,
      });
      sessionStorage.setItem("manus-cookie", `app_session_id=${res.token}`);
      localStorage.setItem("dosje-selected-role", roleKey);
      localStorage.setItem("dosje-user-data", JSON.stringify(res.user));
      document.cookie = `app_session_id=${res.token}; path=/; max-age=31536000; SameSite=Lax`;
      utils.auth.me.setData(undefined, res.user);
      const targetView: View = 
        roleKey === "pmu" ? "inspector-home" :
        roleKey === "ngo" ? "institute-home" :
        roleKey === "beneficiary" ? "beneficiary-home" :
        roleKey === "state" ? "state-home" :
        "dashboard";
      setView(targetView);
      toast.success(`Active Persona Switched to ${cred.title}: ${cred.name}`);
      await refreshAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to switch persona");
    } finally {
      setIsSwitchingPersona(false);
    }
  };

  const startInspection = trpc.workflow.startInspection.useMutation({ 
    onSuccess: async (item) => { 
      setSelectedInspectionId(item.id); 
      toast.success(`Surprise inspection ${item.id} generated in server-sealed state`); 
      await refreshAll(); 
      setView("assignments"); 
    }, 
    onError: (error) => toast.error(error.message) 
  });
  const generateAssignment = trpc.workflow.generateAssignment.useMutation({ 
    onSuccess: async () => { 
      toast.success(`Assignment generated in real-time. Inspector sealed from client selection.`); 
      await refreshAll(); 
      setView("assignments"); 
    }, 
    onError: (error) => toast.error(error.message) 
  });
  const sealAssignment = trpc.workflow.sealAssignment.useMutation({ 
    onSuccess: async () => { 
      toast.success("Assignment sealed with SHA-256 integrity link."); 
      await refreshAll(); 
    }, 
    onError: (error) => toast.error(error.message) 
  });
  const revealAssignment = trpc.workflow.revealAssignment.useMutation({ 
    onSuccess: async (item) => { 
      toast.success(`Assignment revealed: Assigned to ${item.inspectorName}`); 
      await refreshAll(); 
    }, 
    onError: (error) => toast.error(error.message) 
  });
  const captureGps = trpc.workflow.captureGps.useMutation({ 
    onSuccess: async (item) => { 
      toast.success(`${item.status}: ${item.note}`); 
      await refreshAll(); 
    }, 
    onError: (error) => toast.error(error.message) 
  });
  const captureEvidence = trpc.workflow.captureEvidence.useMutation({ 
    onSuccess: async (item) => { 
      toast.success(`${item.id} captured with server-side SHA-256 hash`); 
      await refreshAll(); 
    }, 
    onError: (error) => toast.error(error.message) 
  });
  const submitInspection = trpc.workflow.submitInspection.useMutation({ 
    onSuccess: async () => { 
      toast.success("Observation encrypted (SHA-256) & transmitted to Ministry Command Center in real-time"); 
      await refreshAll(); 
    }, 
    onError: (error) => toast.error(error.message) 
  });
  const verifyEvidence = trpc.workflow.verifyEvidence.useMutation({ 
    onSuccess: async (item) => { 
      if (item.result === "MATCH") {
        toast.success(`MATCH: Cryptographic SHA-256 recomputation verified 100% integrity`); 
      } else {
        toast.error(`TAMPERED DETECTED: Hash mismatch logged to audit ledger & critical alert generated`); 
      }
      await refreshAll(); 
    }, 
    onError: (error) => toast.error(error.message) 
  });
  const analyzeRisk = trpc.workflow.analyzeRisk.useMutation({ 
    onSuccess: async (item) => { 
      toast.success(`Risk analysis complete: ${item.riskLevel} (${item.riskScore}/100)`); 
      await refreshAll(); 
    }, 
    onError: (error) => toast.error(error.message) 
  });
  const verifyAudit = trpc.workflow.verifyAudit.useMutation({ 
    onSuccess: (item) => toast[item.valid ? "success" : "error"](item.valid ? `Chain intact (${item.totalEntries} entries verified)` : `Broken at entry #${item.brokenAtIndex} (${item.brokenEventId})`), 
    onError: (error) => toast.error(error.message) 
  });
  const tamperAudit = trpc.ledger.tamperDemo.useMutation({
    onSuccess: async (item) => {
      toast.error(`Ledger tampered! Broken at entry #${item.brokenAtIndex} (${item.brokenEventId})`);
      await audit.refetch();
    },
    onError: (error) => toast.error(error.message)
  });
  const restoreAudit = trpc.ledger.restoreDemo.useMutation({
    onSuccess: async (item) => {
      toast.success(`Ledger chain restored! ${item.totalEntries} entries verified.`);
      await audit.refetch();
    },
    onError: (error) => toast.error(error.message)
  });
  const triggerRandomVc = trpc.vc.triggerRandom.useMutation({
    onSuccess: async (session) => {
      toast.success(`Surprise VC call triggered to ${session.instituteName} (${session.contactName})`);
      await refreshAll();
    },
    onError: (error) => toast.error(error.message),
  });
  const acknowledgeAlert = trpc.workflow.acknowledgeAlert.useMutation({ 
    onSuccess: async () => { toast.success("Alert acknowledged"); await refreshAll(); }, 
    onError: (error) => toast.error(error.message) 
  });
  const resolveAlert = trpc.workflow.resolveAlert.useMutation({ 
    onSuccess: async () => { toast.success("Alert resolved"); await refreshAll(); }, 
    onError: (error) => toast.error(error.message) 
  });
  const updateUser = trpc.administration.updateUser.useMutation({ 
    onSuccess: async () => { toast.success("User access updated"); await adminUsers.refetch(); }, 
    onError: (error) => toast.error(error.message) 
  });

  const selected = useMemo(() => institutes.data?.find((item) => item.id === selectedInstitute), [institutes.data, selectedInstitute]);
  const selectedInspection = useMemo(() => inspections.data?.find((item) => item.id === selectedInspectionId), [inspections.data, selectedInspectionId]);
  const selectedAssignment = useMemo(() => assignments.data?.find((item) => item.inspectionId === selectedInspectionId), [assignments.data, selectedInspectionId]);

  // Tailored navigation groups based on current persona
  const roleNavGroups = useMemo(() => {
    if (activeRoleKey === "pmu") {
      return [
        {
          label: "Field Inspection Terminal",
          items: [
            { key: "inspector-home" as View, label: "Inspector Workspace", icon: Grid2X2 },
            { key: "assignments" as View, label: "Active Field Audit & E2E Sync", icon: Users },
            { key: "inspections" as View, label: "My Inspection Queue", icon: ClipboardCheck },
          ],
        },
        {
          label: "Evidence & On-Site Tools",
          items: [
            { key: "evidence" as View, label: "Evidence Capture & SHA-256", icon: FileCheck2 },
            { key: "cctv" as View, label: "On-Site CCTV Feeds", icon: Camera },
          ],
        },
      ];
    }
    if (activeRoleKey === "ngo") {
      return [
        {
          label: "Institute Portal",
          items: [
            { key: "institute-home" as View, label: "Institute Facility Overview", icon: Landmark },
            { key: "attendance" as View, label: "Beneficiary Attendance Logs", icon: BarChart3 },
            { key: "cctv" as View, label: "Campus CCTV Stream Heartbeat", icon: Camera },
          ],
        },
        {
          label: "Statutory & Sanctions",
          items: [
            { key: "inspections" as View, label: "Audit Reports & History", icon: ClipboardCheck },
            { key: "institute-compliance" as View, label: "Sanctions & Compliance (GFR-12A)", icon: FileCheck2 },
          ],
        },
      ];
    }
    if (activeRoleKey === "beneficiary") {
      return [
        {
          label: "Citizen Beneficiary Portal",
          items: [
            { key: "beneficiary-home" as View, label: "My Welfare Dashboard", icon: Grid2X2 },
            { key: "beneficiary-dbt" as View, label: "DBT Scholarship Transfers", icon: Landmark },
            { key: "beneficiary-attendance" as View, label: "Biometric Attendance Status", icon: BarChart3 },
            { key: "beneficiary-grievance" as View, label: "Lodge Ministry Grievance", icon: Bell },
          ],
        },
      ];
    }
    if (activeRoleKey === "state") {
      return [
        {
          label: "State Directorate",
          items: [
            { key: "state-home" as View, label: "State Authority Dashboard", icon: Grid2X2 },
            { key: "cctv" as View, label: "Regional CCTV Surveillance", icon: Camera },
            { key: "attendance" as View, label: "Regional Attendance Analytics", icon: BarChart3 },
            { key: "alerts" as View, label: "Regional Alerts & Triage", icon: Bell },
          ],
        },
      ];
    }
    // Department Official (National Command Center)
    return [
      { 
        label: "National Command", 
        items: [
          { key: "dashboard" as View, label: "Apex Command Centre", icon: Grid2X2 }, 
          { key: "map" as View, label: "National Geographic Grid", icon: MapPin }
        ] 
      },
      { 
        label: "Field Oversight", 
        items: [
          { key: "institutes" as View, label: "Institutes & Projects", icon: Landmark },
          { key: "inspections" as View, label: "Inspections Queue", icon: ClipboardCheck },
          { key: "assignments" as View, label: "Surprise Assignment Engine", icon: Users },
          { key: "evidence" as View, label: "Forensic Evidence Verification", icon: FileCheck2 },
        ] 
      },
      { 
        label: "AI Signals & Audits", 
        items: [
          { key: "cctv" as View, label: "National CCTV Monitor", icon: Camera },
          { key: "attendance" as View, label: "Attendance Variance Analytics", icon: BarChart3 },
          { key: "alerts" as View, label: "Alerts & Risk Triage", icon: Bell },
          { key: "audit" as View, label: "Tamper-Evident Hash Chain", icon: Fingerprint },
        ] 
      },
      { 
        label: "Governance", 
        items: [
          { key: "admin" as View, label: "Role & Permission Control", icon: ShieldCheck }
        ] 
      },
    ];
  }, [activeRoleKey]);

  const runNextWorkflowStep = () => {
    if (!selectedInspection) return;
    if (!selectedAssignment) return generateAssignment.mutate({ inspectionId: selectedInspection.id, requestedInspectorId: "INSP-001" });
    if (selectedAssignment.status === "CREATED") return sealAssignment.mutate({ assignmentId: selectedAssignment.id });
    if (selectedAssignment.status === "SEALED") return revealAssignment.mutate({ assignmentId: selectedAssignment.id });
    if (selectedInspection.geofence === "LOCATION_UNAVAILABLE") return captureGps.mutate({ inspectionId: selectedInspection.id, latitude: selected?.latitude ?? null, longitude: selected?.longitude ?? null });
    if (selectedInspection.evidenceCount === 0) return captureEvidence.mutate({ inspectionId: selectedInspection.id });
    if (selectedInspection.status !== "SUBMITTED") return submitInspection.mutate({ inspectionId: selectedInspection.id, observation });
    return analyzeRisk.mutate({ inspectionId: selectedInspection.id });
  };

  const pageTitle = roleNavGroups.flatMap((group) => group.items).find((item) => item.key === view)?.label ?? (
    view === "inspector-home" ? "Inspector Workspace" :
    view === "institute-home" ? "Institute Facility Overview" :
    view === "beneficiary-home" ? "My Welfare Dashboard" :
    view === "institute-compliance" ? "Sanctions & Compliance" :
    view === "beneficiary-dbt" ? "DBT Disbursement Status" :
    view === "beneficiary-attendance" ? "My Attendance Record" :
    view === "beneficiary-grievance" ? "Lodge Ministry Grievance" :
    "Apex Command Centre"
  );

  const isBusy = startInspection.isPending || generateAssignment.isPending || sealAssignment.isPending || revealAssignment.isPending || captureGps.isPending || captureEvidence.isPending || submitInspection.isPending || analyzeRisk.isPending;
  
  const queueOfflineAction = async (type: string) => { 
    if (!user?.openId) return toast.error("Sign in before using offline inspection mode"); 
    try { 
      const item = await enqueueOffline({ type, createdAt: new Date().toISOString(), payload: { inspectionId: selectedInspectionId, checklist: checkState, observation } }, user.openId); 
      setOfflineQueue((current) => [...current, item]); 
      toast.success("Saved encrypted payload to IndexedDB offline queue"); 
    } catch (error) { 
      toast.error(error instanceof Error ? error.message : "Offline queue unavailable"); 
    } 
  };

  return <div className="min-h-screen bg-[#D3C3B9] text-[#161610]">
    {/* Left Navigation Sidebar */}
    <aside className={`${mobileNavOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 flex w-[275px] flex-col bg-[#161610] text-[#D3C3B9] border-r border-[#B58863]/30 transition-transform duration-200 lg:translate-x-0`}>
      {/* Top Left Clickable Logo -> Goes to Homepage/Dashboard */}
      <div 
        role="button"
        tabIndex={0}
        onClick={() => { setView(defaultRoleView); setMobileNavOpen(false); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setView(defaultRoleView); setMobileNavOpen(false); } }}
        className="flex h-20 w-full items-center gap-3 border-b border-[#152D3F] px-5 text-left transition-colors hover:bg-[#152D3F]/50 group cursor-pointer select-none"
        title="Return to Home Dashboard"
      >
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#B58863] text-[#161610] shadow-md group-hover:bg-[#c69974] transition-colors font-bold">
          <ShieldCheck className="h-6 w-6 text-[#161610]" />
        </div>
        <div>
          <div className="text-[15px] font-bold tracking-wide text-white group-hover:text-[#B58863] transition-colors font-mono">SECURESIGHT</div>
          <div className="text-[9px] uppercase tracking-[0.18em] text-[#D3C3B9]/80">DoSJE Nigrani Grid</div>
        </div>
        <span className="ml-auto hidden lg:inline-flex rounded bg-[#152D3F] px-2 py-0.5 text-[9px] font-mono text-[#B58863] font-bold border border-[#B58863]/30">
          GOV.IN
        </span>
        <button 
          type="button"
          className="ml-auto lg:hidden p-1 text-[#D3C3B9] hover:text-white" 
          onClick={(e) => { e.stopPropagation(); setMobileNavOpen(false); }}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Role Indicator Banner */}
      <div className="mx-3 mt-4 rounded-xl border border-[#B58863]/30 bg-[#152D3F]/70 p-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">{roleDisplayName}</span>
        </div>
        <p className="mt-1 text-[11px] leading-4 text-[#D3C3B9]">
          {user?.name || "Official Operator Session"}
        </p>
      </div>

      {/* Role-specific Navigation Groups */}
      <nav className="mt-5 flex-1 overflow-y-auto px-3">
        {roleNavGroups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.2em] text-[#B58863]">
              {group.label}
            </p>
            {group.items.map((item) => (
              <button 
                key={item.key} 
                onClick={() => { setView(item.key as View); setMobileNavOpen(false); }} 
                className={`button-press mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                  view === item.key 
                    ? "bg-[#B58863] font-bold text-[#161610] shadow-sm" 
                    : "text-[#D3C3B9]/90 hover:bg-[#152D3F] hover:text-white"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.key === "alerts" && (
                  <span className="ml-auto rounded-full bg-[#A35139] px-1.5 py-0.2 text-[9px] font-bold text-white">
                    {overview.data?.kpis.openAlerts ?? 4}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* Sidebar Footer with Sign Out */}
      <div className="border-t border-[#152D3F] p-3.5 bg-[#161610]">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-[#152D3F] text-xs font-bold text-[#B58863] border border-[#B58863]/40">
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">{user?.name ?? roleDisplayName}</p>
            <p className="truncate text-[10px] text-[#D3C3B9]">{roleDisplayName}</p>
          </div>
          <button className="text-[#D3C3B9] hover:text-white p-1" title="Refresh data" onClick={refreshAll}>
            <RefreshCw className="h-4 w-4" />
          </button>
          <button className="text-[#D3C3B9] hover:text-[#B58863] p-1" title="Sign out" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>

    {mobileNavOpen && <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileNavOpen(false)} />}

    <main className="lg:pl-[275px]">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 border-b border-[#B58863]/40 bg-[#FAF8F5]/95 backdrop-blur shadow-sm">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button className="rounded-md p-2 hover:bg-[#D3C3B9] lg:hidden" onClick={() => setMobileNavOpen(true)}>
              <Menu className="h-5 w-5 text-[#152D3F]" />
            </button>
            <button
              type="button"
              onClick={() => setView(defaultRoleView)}
              className="text-left group cursor-pointer"
              title="Return to Home Dashboard"
            >
              <p className="eyebrow flex items-center gap-1">
                <span>DoSJE Nigrani</span>
                <span>/</span>
                <span className="font-semibold text-[#152D3F]">{roleDisplayName}</span>
              </p>
              <h1 className="text-base font-bold text-[#161610] sm:text-lg">
                {pageTitle}
              </h1>
            </button>
          </div>

          {/* Quick Persona Switcher for Evaluators (Direct 1-Click Access) */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden xl:flex items-center gap-1 rounded-xl border border-[#B58863]/40 bg-[#D3C3B9]/60 p-1">
              <span className="px-2 text-[10px] font-bold uppercase tracking-wider text-[#161610]">Persona Switcher:</span>
              <button
                onClick={() => switchPersona("official")}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                  activeRoleKey === "official" 
                    ? "bg-[#152D3F] text-[#B58863] shadow-sm" 
                    : "text-[#152D3F] hover:bg-[#B58863]/20"
                }`}
                title="Switch to Department Official (Command Center)"
              >
                🏛️ Official
              </button>
              <button
                onClick={() => switchPersona("pmu")}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                  activeRoleKey === "pmu" 
                    ? "bg-[#152D3F] text-[#B58863] shadow-sm" 
                    : "text-[#152D3F] hover:bg-[#B58863]/20"
                }`}
                title="Switch to PMU Inspector (Field Terminal)"
              >
                📋 PMU Inspector
              </button>
              <button
                onClick={() => switchPersona("ngo")}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                  activeRoleKey === "ngo" 
                    ? "bg-[#152D3F] text-[#B58863] shadow-sm" 
                    : "text-[#152D3F] hover:bg-[#B58863]/20"
                }`}
                title="Switch to NGO / Institute Portal"
              >
                🏫 NGO Institute
              </button>
              <button
                onClick={() => switchPersona("beneficiary")}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                  activeRoleKey === "beneficiary" 
                    ? "bg-[#152D3F] text-[#B58863] shadow-sm" 
                    : "text-[#152D3F] hover:bg-[#B58863]/20"
                }`}
                title="Switch to Citizen Beneficiary Portal"
              >
                👤 Beneficiary
              </button>
            </div>

            <button 
              onClick={() => { window.location.href = "/login"; }}
              className="flex items-center gap-1.5 rounded-lg border border-[#B58863]/40 bg-[#FAF8F5] px-3 py-1.5 text-xs font-semibold text-[#152D3F] hover:bg-[#D3C3B9] transition-colors"
              title="Open DoSJE Login Portal"
            >
              <Key className="h-3.5 w-3.5 text-[#B58863]" />
              <span className="hidden sm:inline">Login Portal</span>
            </button>

            <button 
              onClick={handleSignOut} 
              className="flex items-center gap-1.5 rounded-lg border border-[#B58863]/40 bg-[#FAF8F5] px-3 py-1.5 text-xs font-semibold text-[#161610] hover:bg-[#D3C3B9] transition-colors"
            >
              <LogOut className="h-3.5 w-3.5 text-[#A35139]" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="container py-6 sm:py-8">
        <div className="fade-in">
          {/* 1. Department Official Home Dashboard */}
          {view === "dashboard" && (
            <DashboardView 
              user={user} 
              overview={overview.data} 
              onSelectView={setView} 
              onSelectInspection={setSelectedInspectionId} 
              onTriggerVc={() => triggerRandomVc.mutate()}
            />
          )}

          {/* 2. PMU Field Inspector Workspace */}
          {view === "inspector-home" && (
            <InspectorDashboardView
              user={user}
              inspections={inspections.data ?? []}
              assignments={assignments.data ?? []}
              offlineQueue={offlineQueue}
              onSelectView={setView}
              onSelectInspection={setSelectedInspectionId}
            />
          )}

          {/* 3. NGO / Institute Management Dashboard */}
          {view === "institute-home" && (
            <InstituteDashboardView
              user={user}
              institutes={institutes.data ?? []}
              attendance={attendance.data}
              inspections={inspections.data ?? []}
              onSelectView={setView}
            />
          )}

          {/* 4. Citizen Beneficiary Portal */}
          {view === "beneficiary-home" && (
            <BeneficiaryDashboardView
              user={user}
              onSelectView={setView}
            />
          )}

          {/* 5. State / District Authority Dashboard */}
          {view === "state-home" && (
            <StateAuthorityDashboardView
              user={user}
              onSelectView={setView}
            />
          )}

          {/* Role-Specific Supplemental Views */}
          {view === "institute-compliance" && (
            <InstituteComplianceView
              user={user}
              onSelectView={setView}
            />
          )}
          {view === "beneficiary-dbt" && (
            <BeneficiaryDbtView
              user={user}
              onSelectView={setView}
            />
          )}
          {view === "beneficiary-attendance" && (
            <BeneficiaryAttendanceView
              user={user}
              attendance={attendance.data}
              onSelectView={setView}
            />
          )}
          {view === "beneficiary-grievance" && (
            <BeneficiaryGrievanceView
              user={user}
              onSelectView={setView}
            />
          )}

          {/* Shared Operations Views */}
          {view === "map" && <MapView data={institutes.data ?? []} onSelect={(id) => { setSelectedInstitute(id); setView("inspections"); }} />}
          {view === "institutes" && <InstitutesView data={institutes.data ?? []} selected={selectedInstitute} onSelect={(id) => { setSelectedInstitute(id); setView("inspections"); }} onStart={(id) => { startInspection.mutate({ instituteId: id }); }} />}
          {view === "inspections" && <InspectionsView data={inspections.data ?? []} selectedId={selectedInspectionId} onSelect={setSelectedInspectionId} onStart={(id) => { startInspection.mutate({ instituteId: id }); }} />}
          {view === "assignments" && <AssignmentsView data={assignments.data ?? []} selectedInspection={selectedInspection} selectedAssignment={selectedAssignment} onNext={runNextWorkflowStep} isBusy={isBusy} observation={observation} setObservation={setObservation} checklist={checklist.data} checkState={checkState} setCheckState={setCheckState} offlineQueue={offlineQueue} onQueue={queueOfflineAction} onSendObservation={() => { if (selectedInspection) { const evdItem = (evidence.data ?? []).find((e: any) => e.inspectionId === selectedInspection.id); submitInspection.mutate({ inspectionId: selectedInspection.id, observation, evidenceHash: evdItem?.originalHash }); } }} isSubmittingObservation={submitInspection.isPending} />}
          {view === "evidence" && <EvidenceView data={evidence.data ?? []} inspectionId={selectedInspectionId} onUploaded={refreshAll} onVerify={(id, tamper) => { verifyEvidence.mutate({ evidenceId: id, tamper }); }} isVerifying={verifyEvidence.isPending} />}
          {view === "cctv" && <CctvView data={institutes.data ?? []} />}
          {view === "attendance" && <AttendanceView data={attendance.data} />}
          {view === "alerts" && <AlertsView data={alerts.data ?? []} onAcknowledge={(id) => { acknowledgeAlert.mutate({ alertId: id }); }} onResolve={(id) => { resolveAlert.mutate({ alertId: id }); }} />}
          {view === "audit" && <AuditView data={audit.data} onVerify={() => { verifyAudit.mutate(); }} isVerifying={verifyAudit.isPending} onTamper={() => { tamperAudit.mutate(); }} onRestore={() => { restoreAudit.mutate(); }} />}
          {view === "admin" && <AdminView data={adminUsers.data ?? []} onUpdate={(userId, role, organizationId) => { updateUser.mutate({ userId, role, organizationId }); }} />}
        </div>
      </div>
      <VideoConferenceModal onCallStateChange={refreshAll} />
    </main>
  </div>;
}

function DashboardView({ user, overview, onSelectView, onSelectInspection, onTriggerVc }: { user?: any; overview?: Overview; onSelectView: (view: View) => void; onSelectInspection: (id: string) => void; onTriggerVc?: () => void }) {
  if (!overview) return <LoadingState />;
  const officialName = user?.name || "Rajeshwar Verma (Director, DoSJE)";
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end rounded-2xl bg-gradient-to-r from-[#161610] via-[#152D3F] to-[#161610] p-6 text-white shadow-md border border-[#B58863]/40">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#B58863]/20 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-[#B58863] border border-[#B58863]/30">
              <span className="h-1.5 w-1.5 rounded-full bg-[#B58863] animate-pulse" />
              NATIONAL APEX OVERSIGHT · DOSJE
            </span>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            National Command Centre — {officialName}
          </h2>
          <p className="mt-2 max-w-2xl text-xs sm:text-sm leading-5 text-[#D3C3B9]/90">
            Real-time surprise inspection dispatch, cryptographic evidence integrity, AI anomaly flags, and multi-scheme compliance across all States &amp; UTs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {onTriggerVc && (
            <button
              type="button"
              onClick={onTriggerVc}
              className="button-press inline-flex items-center justify-center gap-2 rounded-lg border border-[#FFB162]/40 bg-[#152D3F] px-4 py-2.5 text-xs sm:text-sm font-bold text-[#FFB162] hover:bg-[#2C3B4D] transition-colors shadow-sm"
            >
              <Video className="h-4 w-4 text-[#FFB162]" />
              Trigger Random VC
              <span className="rounded bg-[#FFB162] px-1.5 py-0.5 text-[9px] font-bold text-[#161610]">LIVE</span>
            </button>
          )}
          <button onClick={() => onSelectView("inspections")} className="button-press inline-flex items-center justify-center gap-2 rounded-lg bg-[#B58863] px-4 py-2.5 text-xs sm:text-sm font-bold text-[#161610] shadow-sm hover:bg-[#c69974] transition-colors">
            Open Inspection Queue <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <KpiCard label="Registered Projects" value={overview.kpis.projects} detail="funded NGO institutes" icon={Landmark} />
        <KpiCard label="Inspections Active" value={overview.kpis.inspections} detail="NAPDDR · SMILE · AVYAY" icon={ClipboardCheck} />
        <KpiCard label="High Risk Centres" value={overview.kpis.highRisk} detail="priority surprise audit" icon={Siren} tone="red" />
        <KpiCard label="Open Alerts" value={overview.kpis.openAlerts} detail="geofence & tamper flags" icon={Bell} tone="amber" />
        <KpiCard label="Evidence Verified" value={overview.kpis.evidenceVerified} detail="SHA-256 server match" icon={FileCheck2} tone="teal" />
        <KpiCard label="CCTV Online" value={`${overview.cctvHealth}%`} detail="heartbeat uptime" icon={Camera} tone="teal" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="panel p-5">
          <SectionHeader eyebrow="Operational Trend" title="Weekly Inspection & Alert Trajectory" action={<span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200"><Activity className="h-3.5 w-3.5" /> LIVE GRID</span>} />
          <div className="flex h-52 items-end gap-2 border-b border-l border-[#C9C1B1] px-3 pb-0 pt-5 sm:gap-4">
            {overview.trend.map((item) => (
              <div key={item.day} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div className="flex w-full max-w-10 items-end gap-1" style={{ height: "82%" }}>
                  <div className="w-1/2 rounded-t bg-[#C9C1B1]" style={{ height: `${Math.min(100, item.inspections * 2.7)}%` }} title={`${item.inspections} inspections`} />
                  <div className="w-1/2 rounded-t bg-[#2C3B4D]" style={{ height: `${item.alerts * 10}%` }} title={`${item.alerts} alerts`} />
                </div>
                <span className="text-[10px] font-semibold text-[#5C6773]">{item.day}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-4 text-[11px] text-[#5C6773]">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#C9C1B1]" /> Field Inspections</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#2C3B4D]" /> AI Anomaly Alerts</span>
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-[#C9C1B1] bg-[#1B2632] p-5 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow text-[#FFB162]">National Control Posture</p>
                <h3 className="mt-1 text-lg font-bold text-white">Integrity &amp; Readiness Score</h3>
              </div>
              <LockKeyhole className="h-5 w-5 text-[#FFB162]" />
            </div>
            <div className="mt-4 flex items-end gap-3">
              <span className="text-4xl font-bold text-[#FFB162]">94</span>
              <span className="mb-1 text-xs text-[#C9C1B1]">/ 100 System Integrity Index</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
              <div className="h-full w-[94%] rounded-full bg-[#FFB162]" />
            </div>
          </div>
          <div className="space-y-3 p-5 bg-[#FAF8F4]">
            {[
              ["Tamper-evident audit chain", "Verified (SHA-256)", "text-emerald-700"],
              ["Surprise assignment engine", "Cryptographically Sealed", "text-[#2C3B4D]"],
              ["CCTV network availability", `${overview.cctvHealth}% Active Heartbeat`, "text-emerald-700"],
              ["Haversine geofence gates", "100-meter Radius Enforced", "text-blue-700"],
            ].map(([label, value, tone]) => (
              <div key={label} className="flex items-center justify-between gap-3 text-xs border-b border-[#E5E0D5] pb-2 last:border-none">
                <span className="text-[#5C6773] font-medium">{label}</span>
                <span className={`font-bold ${tone}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-[#C9C1B1] bg-[#EFEBE3]">
            <SectionHeader eyebrow="Real-time Dispatch" title="Recent Field Inspections" />
            <button className="text-xs font-bold text-[#2C3B4D] hover:underline" onClick={() => onSelectView("inspections")}>View Full Queue →</button>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Inspection ID</th>
                  <th>Institute Name</th>
                  <th>Risk Level</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {overview.recentInspections.map((item) => (
                  <tr key={item.id} className="hover:bg-[#EEE9DF]/40 cursor-pointer" onClick={() => { onSelectInspection(item.id); onSelectView("assignments"); }}>
                    <td className="font-mono font-bold text-[#2C3B4D]">{item.id}</td>
                    <td className="font-medium text-[#1B2632]">{item.instituteName}</td>
                    <td><StatusPill value={item.riskLevel} /></td>
                    <td><StatusPill value={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-[#C9C1B1] bg-[#EFEBE3]">
            <SectionHeader eyebrow="Priority Flags" title="Anomaly &amp; Tamper Alerts" />
            <button className="text-xs font-bold text-[#A35139] hover:underline" onClick={() => onSelectView("alerts")}>Triage All →</button>
          </div>
          <div className="divide-y divide-[#E5E0D5]">
            {overview.recentAlerts.slice(0, 4).map((item) => (
              <div key={item.id} className="flex gap-3 p-4 hover:bg-[#EEE9DF]/30">
                <div className={`mt-0.5 rounded-md p-2 shrink-0 ${item.severity === "CRITICAL" ? "bg-[#A35139]/15 text-[#A35139]" : "bg-[#FFB162]/25 text-[#8A4600]"}`}>
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-bold text-[#1B2632]">{item.title}</p>
                    <StatusPill value={item.status} />
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#5C6773]">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MapView({ data, onSelect }: { data: any[]; onSelect: (id: string) => void }) { 
  const minLat = Math.min(...data.map((item) => item.latitude)); 
  const maxLat = Math.max(...data.map((item) => item.latitude)); 
  const minLon = Math.min(...data.map((item) => item.longitude)); 
  const maxLon = Math.max(...data.map((item) => item.longitude)); 
  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">National GIS Grid</p>
        <h2 className="mt-1 text-2xl font-bold text-[#1B2632]">Geographic Institute &amp; Project Coordinates</h2>
        <p className="mt-1 text-sm text-[#5C6773]">Server-authoritative GPS markers mapped with 100m geofence radii for surprise audits.</p>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.5fr_0.5fr]">
        <div className="panel relative min-h-[520px] overflow-hidden bg-[#E7E2D7]">
          <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(#C9C1B1 1px, transparent 1px), linear-gradient(90deg, #C9C1B1 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
          {data.map((item) => { 
            const left = `${8 + ((item.longitude - minLon) / Math.max(0.01, maxLon - minLon)) * 84}%`; 
            const top = `${8 + (1 - (item.latitude - minLat) / Math.max(0.01, maxLat - minLat)) * 84}%`; 
            const tone = item.riskLevel === "HIGH" ? "bg-[#A35139]" : item.riskLevel === "MEDIUM" ? "bg-[#FFB162]" : "bg-emerald-600"; 
            return (
              <button key={item.id} onClick={() => onSelect(item.id)} className="group absolute -translate-x-1/2 -translate-y-1/2" style={{ left, top }} title={item.name}>
                <span className={`block h-4 w-4 rounded-full border-2 border-white ${tone} shadow-md transition-transform group-hover:scale-150`} />
                <span className="pointer-events-none absolute left-1/2 top-5 hidden -translate-x-1/2 whitespace-nowrap rounded bg-[#1B2632] px-2 py-1 text-[10px] font-semibold text-white group-hover:block z-10">{item.name}</span>
              </button>
            ); 
          })}
          <div className="absolute bottom-4 left-4 rounded-lg border border-[#C9C1B1] bg-[#FAF8F4]/95 p-3 text-[10px] shadow-sm">
            <p className="mb-2 font-bold text-[#1B2632]">Risk Legend</p>
            <div className="space-y-1.5">
              <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Low Risk</span>
              <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#FFB162]" /> Medium Risk</span>
              <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#A35139]" /> High Risk (Priority)</span>
            </div>
          </div>
        </div>
        <div className="panel p-5">
          <SectionHeader eyebrow="Registry Coverage" title="Institutes by Risk Profile" />
          <div className="space-y-2">
            {data.slice(0, 8).map((item) => (
              <button key={item.id} onClick={() => onSelect(item.id)} className="flex w-full items-center justify-between rounded-lg border border-[#C9C1B1] p-3 text-left hover:bg-[#EEE9DF] transition-colors">
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold text-[#1B2632]">{item.name}</span>
                  <span className="mt-1 block text-[10px] text-[#5C6773]">{item.district} · {item.cctvOnline ? "CCTV Active" : "CCTV Offline"}</span>
                </span>
                <StatusPill value={item.riskLevel} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  ); 
}

function InstitutesView({ data, selected, onSelect, onStart }: { data: any[]; selected: string; onSelect: (id: string) => void; onStart: (id: string) => void }) { 
  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">National Directory</p>
          <h2 className="mt-1 text-2xl font-bold text-[#1B2632]">Funded Institutes &amp; Facilities</h2>
          <p className="mt-1 text-sm text-[#5C6773]">Rehabilitation Centres (NAPDDR), Shelter Hubs (SMILE), Care Homes (AVYAY), DDRS Centres.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[#C9C1B1] bg-[#FAF8F4] px-3 py-2 text-xs text-[#5C6773]">
          <Search className="h-4 w-4 text-[#2C3B4D]" /> Directory Search &amp; Filter Active
        </div>
      </div>
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Institute Name</th>
                <th>District / State</th>
                <th>Scheme</th>
                <th>Risk Profile</th>
                <th>CCTV Signal</th>
                <th>Beneficiaries</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.id} className={selected === item.id ? "bg-[#FFB162]/10" : "hover:bg-[#EEE9DF]/40"}>
                  <td>
                    <button className="text-left" onClick={() => onSelect(item.id)}>
                      <p className="font-bold text-[#2C3B4D]">{item.name}</p>
                      <p className="mt-0.5 text-[10px] font-mono text-[#5C6773]">{item.id} · {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</p>
                    </button>
                  </td>
                  <td>{item.district}, {item.state}</td>
                  <td><span className="font-mono text-xs font-semibold">{item.scheme}</span></td>
                  <td><StatusPill value={item.riskLevel} /></td>
                  <td>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${item.cctvOnline ? "text-emerald-700" : "text-[#A35139]"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${item.cctvOnline ? "bg-emerald-500" : "bg-[#A35139]"}`} />
                      {item.cctvOnline ? "Online" : "Offline"}
                    </span>
                  </td>
                  <td className="font-bold">{item.beneficiaryCount}</td>
                  <td>
                    <button onClick={() => onStart(item.id)} className="whitespace-nowrap rounded-md border border-[#2C3B4D] bg-[#2C3B4D] px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-[#1B2632] transition-colors">
                      Start Surprise Audit
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

function InspectionsView({ data, selectedId, onSelect, onStart }: { data: any[]; selectedId: string; onSelect: (id: string) => void; onStart: (id: string) => void }) { 
  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Field Inspections</p>
          <h2 className="mt-1 text-2xl font-bold text-[#1B2632]">National Inspection Queue</h2>
          <p className="mt-1 text-sm text-[#5C6773]">Server-sealed assignments, GPS-gated audits, and live inspection records.</p>
        </div>
        <button onClick={() => onStart("INS-001")} className="button-press inline-flex items-center justify-center gap-2 rounded-lg bg-[#FFB162] px-3.5 py-2.5 text-xs font-bold text-[#1B2632] hover:bg-[#FFA040] shadow-sm">
          + Start Surprise Inspection
        </button>
      </div>
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Inspection ID</th>
                <th>Institute</th>
                <th>Assigned Inspector</th>
                <th>Risk Level</th>
                <th>Geofence Status</th>
                <th>Current State</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.id} className={selectedId === item.id ? "bg-[#FFB162]/10" : "hover:bg-[#EEE9DF]/40"}>
                  <td className="font-mono font-bold text-[#2C3B4D]">
                    {item.id}
                    <p className="mt-0.5 text-[10px] font-normal text-[#5C6773]">{new Date(item.scheduledAt).toLocaleString()}</p>
                  </td>
                  <td className="font-medium text-[#1B2632]">{item.instituteName}</td>
                  <td>{item.inspectorName}</td>
                  <td><StatusPill value={item.riskLevel} /></td>
                  <td><StatusPill value={item.geofence} /></td>
                  <td><StatusPill value={item.status} /></td>
                  <td>
                    <button onClick={() => onSelect(item.id)} className="rounded-md p-1.5 text-[#2C3B4D] hover:bg-[#C9C1B1]/40" title="Open Inspection">
                      <ChevronRight className="h-4 w-4" />
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

function AssignmentsView({ 
  data, selectedInspection, selectedAssignment, onNext, isBusy, 
  observation, setObservation, checklist, checkState, setCheckState, 
  offlineQueue, onQueue, onSendObservation, isSubmittingObservation 
}: { 
  data: any[]; 
  selectedInspection?: any; 
  selectedAssignment?: any; 
  onNext: () => void; 
  isBusy: boolean; 
  observation: string; 
  setObservation: (value: string) => void; 
  checklist?: { scheme: string; items: Array<{ id: string; label: string; required: boolean }> }; 
  checkState: Record<string, boolean>; 
  setCheckState: (value: Record<string, boolean>) => void; 
  offlineQueue: Array<{ type: string; createdAt: string }>; 
  onQueue: (type: string) => void;
  onSendObservation: () => void;
  isSubmittingObservation: boolean;
}) {
  const nextLabel = !selectedAssignment ? "Generate Secure Surprise Assignment" 
    : selectedAssignment.status === "CREATED" ? "Cryptographically Seal Assignment" 
    : selectedAssignment.status === "SEALED" ? "Reveal Assigned Inspector" 
    : selectedInspection?.geofence === "LOCATION_UNAVAILABLE" ? "Capture GPS & Validate 100m Geofence" 
    : selectedInspection?.evidenceCount === 0 ? "Capture Geotagged Evidence" 
    : selectedInspection?.status !== "SUBMITTED" ? "Submit Sealed Inspection Report" 
    : "Run Advisory AI Risk Analysis";

  const completedChecks = checklist?.items.filter((item) => checkState[item.id]).length ?? 0;

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Cryptographic Control</p>
        <h2 className="mt-1 text-2xl font-bold text-[#1B2632]">Surprise Assignment &amp; Field Execution</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[#5C6773]">
          Eligibility verification → Conflict-of-interest check → Workload distribution → Real-time cryptographic selection. Observations are end-to-end synchronized to the central command grid.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="panel p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Active Target Inspection</p>
              <h3 className="mt-1 text-lg font-bold text-[#1B2632]">{selectedInspection?.id ?? "Select an inspection"}</h3>
              <p className="mt-1 text-sm text-[#5C6773]">{selectedInspection?.instituteName ?? "Choose an inspection from the queue."}</p>
            </div>
            <StatusPill value={selectedInspection?.status ?? "ASSIGNMENT_PENDING"} />
          </div>

          {/* Stepper Progress */}
          <div className="my-6 flex items-center gap-1">
            {["CREATED", "SEALED", "REVEALED", "COMPLETED"].map((step, index) => {
              const isPassed = selectedAssignment?.status === step || ["SEALED", "REVEALED", "COMPLETED"].indexOf(selectedAssignment?.status) >= index;
              return (
                <div key={step} className="flex flex-1 items-center gap-1">
                  <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-bold ${isPassed ? "bg-[#2C3B4D] text-[#FFB162]" : "bg-[#EEE9DF] text-[#5C6773]"}`}>
                    {index + 1}
                  </div>
                  {index < 3 && <div className={`h-1 flex-1 ${isPassed ? "bg-[#2C3B4D]" : "bg-[#C9C1B1]"}`} />}
                </div>
              );
            })}
          </div>

          {/* Assignment Status Card */}
          <div className="rounded-xl border border-[#C9C1B1] bg-[#FAF8F4] p-4">
            {selectedAssignment ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="eyebrow">Assignment Token</p>
                  <p className="mt-1 text-sm font-mono font-bold text-[#2C3B4D]">{selectedAssignment.id}</p>
                </div>
                <div>
                  <p className="eyebrow">Inspector Secrecy</p>
                  <p className="mt-1 text-sm font-bold text-[#1B2632]">
                    {selectedAssignment.status === "CREATED" ? "🔒 Sealed from Client" : selectedAssignment.inspectorName}
                  </p>
                </div>
                <div>
                  <p className="eyebrow">Integrity State</p>
                  <div className="mt-1"><StatusPill value={selectedAssignment.status} /></div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm text-[#5C6773]">
                <LockKeyhole className="h-5 w-5 text-[#2C3B4D]" />
                No assignment generated yet. The server will select an eligible, conflict-free inspector using secure randomness.
              </div>
            )}
          </div>

          <button 
            disabled={isBusy || !selectedInspection} 
            onClick={onNext} 
            className="button-press mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#B58863] px-4 py-3 text-sm font-bold text-[#161610] hover:bg-[#c69974] disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all"
          >
            {isBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {nextLabel}
            <ArrowRight className="h-4 w-4" />
          </button>

          <div className="mt-4 rounded-lg border border-[#B58863]/40 bg-[#D3C3B9]/50 p-3 text-xs leading-5 text-[#161610]">
            <strong>Zero-Trust Guarantee:</strong> Inspector identity is locked in server-side memory until revealed. The client cannot pick or modify assignments.
          </div>
        </div>

        {/* Real-Time Inspector Observation & Checklist Panel */}
        <div className="panel p-5">
          <SectionHeader 
            eyebrow="On-Site Verification" 
            title={`${checklist?.scheme ?? "Scheme"} Audit Checklist`} 
            action={<span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">{completedChecks}/{checklist?.items.length ?? 0} Done</span>} 
          />

          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
            {(checklist?.items ?? []).map((item) => (
              <label key={item.id} className="flex items-start gap-3 rounded-lg border border-[#B58863]/30 p-2.5 hover:bg-[#D3C3B9]/40 transition-colors">
                <input 
                  type="checkbox" 
                  checked={Boolean(checkState[item.id])} 
                  onChange={(event) => setCheckState({ ...checkState, [item.id]: event.target.checked })} 
                  className="mt-0.5 h-4 w-4 accent-[#152D3F]" 
                />
                <span className="text-xs leading-5 text-[#161610]">{item.label}{item.required && <span className="ml-1 text-[#A35139] font-bold">*</span>}</span>
              </label>
            ))}
          </div>

          {/* Real-time Observation Box with Enter Key Submit */}
          <div className="mt-4 pt-3 border-t border-[#B58863]/30">
            <div className="flex items-center justify-between mb-1.5">
              <span className="eyebrow">Inspector Observation (E2E Encrypted)</span>
              <span className="text-[10px] font-mono text-[#4A5565]">Press Enter to transmit</span>
            </div>
            <textarea 
              value={observation} 
              onChange={(e) => setObservation(e.target.value)} 
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSendObservation();
                }
              }}
              placeholder="Type field findings (e.g. Beneficiary head-count verified, register discrepancies noted)..."
              className="w-full min-h-20 resize-y rounded-lg border border-[#B58863]/40 bg-white p-2.5 text-xs outline-none focus:border-[#152D3F] focus:ring-1 focus:ring-[#152D3F]" 
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Real-Time Sync Active
              </span>
              <button
                disabled={isSubmittingObservation || !observation.trim()}
                onClick={onSendObservation}
                className="button-press inline-flex items-center gap-1.5 rounded-md bg-[#152D3F] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#161610] transition-colors disabled:opacity-50"
              >
                {isSubmittingObservation ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3 text-[#B58863]" />}
                Send Observation (Enter)
              </button>
            </div>
          </div>

          {/* Offline Queue */}
          <div className="mt-4 rounded-lg border border-[#FFB162] bg-[#FFB162]/15 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[#7A3F00]">Offline Queue (IndexedDB)</p>
                <p className="mt-0.5 text-[11px] text-[#7A3F00]">{offlineQueue.length} payload(s) stored locally</p>
              </div>
              <button onClick={() => onQueue("INSPECTION_AUDIT_RECORD")} className="rounded-md bg-[#2C3B4D] px-2.5 py-1 text-[10px] font-bold text-white hover:bg-[#1B2632]">
                Save Offline
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sealed Assignment History */}
      <div className="panel overflow-hidden">
        <div className="p-5 border-b border-[#C9C1B1] bg-[#EFEBE3]">
          <SectionHeader eyebrow="Audit Register" title="Real-Time Cryptographic Assignment Ledger" />
        </div>
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Assignment ID</th>
                <th>Inspection Reference</th>
                <th>Assigned Inspector</th>
                <th>State</th>
                <th>Sealed Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {data.length ? data.map((item) => (
                <tr key={item.id}>
                  <td className="font-mono font-bold text-[#2C3B4D]">{item.id}</td>
                  <td className="font-mono text-xs">{item.inspectionId}</td>
                  <td className="font-medium text-[#1B2632]">{item.inspectorName}</td>
                  <td><StatusPill value={item.status} /></td>
                  <td className="font-mono text-xs text-[#5C6773]">{item.sealedAt ? new Date(item.sealedAt).toLocaleString() : "—"}</td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="py-8 text-center text-sm text-[#5C6773]">No assignments generated in this active session.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EvidenceView({ 
  data, inspectionId, onUploaded, onVerify, isVerifying 
}: { 
  data: any[]; 
  inspectionId: string; 
  onUploaded: () => Promise<unknown>; 
  onVerify: (id: string, tamper: boolean) => void;
  isVerifying: boolean;
}) { 
  const [file, setFile] = useState<File | null>(null); 
  const [uploading, setUploading] = useState(false); 

  // 1-Click Load Official Sample Evidence for Evaluators
  const handleLoadSample = async () => {
    try {
      const res = await fetch("/api/evidence/sample");
      const blob = await res.blob();
      const sampleFile = new File([blob], "dosje-sample-audit-evidence.jpg", { type: "image/jpeg" });
      setFile(sampleFile);
      toast.success("Official sample evidence loaded into upload input!");
    } catch {
      toast.error("Failed to load sample evidence");
    }
  };

  const upload = async () => { 
    if (!file) return toast.error("Choose or load a JPG, PNG, or PDF first"); 
    const form = new FormData(); 
    form.append("file", file); 
    form.append("inspectionId", inspectionId); 
    setUploading(true); 
    try { 
      const response = await fetch("/api/evidence/upload", { method: "POST", body: form, credentials: "include" }); 
      const payload = await response.json(); 
      if (!response.ok) throw new Error(payload.error ?? "Upload failed"); 
      toast.success(`Uploaded ${payload.evidence.id} with server-side SHA-256 fingerprint`); 
      setFile(null); 
      await onUploaded(); 
    } catch (error) { 
      toast.error(error instanceof Error ? error.message : "Upload failed"); 
    } finally { 
      setUploading(false); 
    } 
  }; 

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Forensic Integrity Grid</p>
        <h2 className="mt-1 text-2xl font-bold text-[#1B2632]">Cryptographic Evidence Verification (SHA-256)</h2>
        <p className="mt-1 text-sm text-[#5C6773]">
          Every inspection photo and document is hashed on server ingest. Zero-trust recomputation detects byte-level tampering.
        </p>
      </div>

      {/* Official Sample Evidence Sandbox Bar */}
      <div className="rounded-xl border border-[#B58863]/40 bg-[#152D3F] p-5 text-white shadow-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-[#B58863] px-2 py-0.5 text-[10px] font-bold text-[#161610]">EVALUATOR TOOL</span>
              <h3 className="text-sm font-bold text-white">Need a test inspection file?</h3>
            </div>
            <p className="mt-1 text-xs text-[#D3C3B9]/90">
              Download the official geotagged sample audit photo to test upload, or click "1-Click Load" to test immediately.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a 
              href="/api/evidence/sample" 
              download="dosje-sample-audit-evidence.jpg" 
              className="button-press inline-flex items-center gap-1.5 rounded-lg border border-[#B58863]/40 bg-[#FAF8F5] px-3 py-2 text-xs font-bold text-[#161610] hover:bg-[#D3C3B9] transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-[#152D3F]" />
              Download Sample File
            </a>
            <button 
              type="button" 
              onClick={handleLoadSample} 
              className="button-press inline-flex items-center gap-1.5 rounded-lg bg-[#B58863] px-3.5 py-2 text-xs font-bold text-[#161610] hover:bg-[#c69974] transition-colors shadow-sm"
            >
              ⚡ 1-Click Load Sample Evidence
            </button>
          </div>
        </div>
      </div>

      {/* Live Camera Capture Terminal */}
      <CameraCapture 
        inspectionId={inspectionId || "INSP-0001"} 
        onEvidenceCaptured={async () => {
          await onUploaded();
        }} 
      />

      {/* Forensic Evidence Ledger */}
      <div className="panel overflow-hidden">
        <div className="p-5 border-b border-[#C9C1B1] bg-[#EFEBE3] flex items-center justify-between">
          <SectionHeader eyebrow="Zero-Trust Audit" title="Captured Evidence SHA-256 Ledger" />
          <span className="text-xs text-[#5C6773] font-medium">Click "Verify" to test hash match or "Tamper &amp; Re-verify" to test alert trigger</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Evidence Record</th>
                <th>Inspection Ref</th>
                <th>Capture Date</th>
                <th>Geofence Proximity</th>
                <th>Verification State</th>
                <th>Zero-Trust Test</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 16).map((item) => (
                <tr key={item.id} className="hover:bg-[#EEE9DF]/30">
                  <td>
                    <p className="font-bold text-[#2C3B4D]">{item.filename}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-[#5C6773]">{item.id} · SHA: {item.originalHash.slice(0, 18)}…</p>
                  </td>
                  <td className="font-mono text-xs">{item.inspectionId}</td>
                  <td className="text-xs text-[#5C6773]">{new Date(item.capturedAt).toLocaleDateString()}</td>
                  <td><StatusPill value={item.gpsStatus} /></td>
                  <td><StatusPill value={item.verification} /></td>
                  <td>
                    <div className="flex gap-2">
                      <button 
                        disabled={isVerifying}
                        onClick={() => onVerify(item.id, false)} 
                        className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800 hover:bg-emerald-100 transition-colors"
                        title="Recompute SHA-256 on genuine content"
                      >
                        ✓ Verify
                      </button>
                      <button 
                        disabled={isVerifying}
                        onClick={() => onVerify(item.id, true)} 
                        className="rounded-md border border-[#A35139]/40 bg-[#A35139]/10 px-2.5 py-1 text-[10px] font-bold text-[#A35139] hover:bg-[#A35139]/20 transition-colors"
                        title="Mutate candidate content to test tamper detection"
                      >
                        ⚠️ Tamper &amp; Re-verify
                      </button>
                    </div>
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

function CctvView({ data }: { data: any[] }) { 
  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Facility Surveillance</p>
        <h2 className="mt-1 text-2xl font-bold text-[#1B2632]">CCTV Monitoring &amp; Live HLS Telemetry</h2>
        <p className="mt-1 text-sm text-[#5C6773]">Automated HLS stream playback, frame freeze watchdog, and instant outage triage.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.map((item) => (
          <CctvPlayer
            key={item.id}
            instituteId={item.id}
            instituteName={item.name}
            initialOnline={item.cctvOnline}
          />
        ))}
      </div>
    </div>
  ); 
}

function AttendanceView({ data }: { data?: any }) { 
  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Direct Benefit Integrity</p>
        <h2 className="mt-1 text-2xl font-bold text-[#1B2632]">Biometric Attendance Variance Analytics</h2>
        <p className="mt-1 text-sm text-[#5C6773]">Cross-referencing physical headcounts against biometric registers to eliminate ghost beneficiaries.</p>
      </div>
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Institute Name</th>
                <th>Observed Days</th>
                <th>Anomaly Variance Score</th>
                <th>Flagged Deviations</th>
                <th>Risk Classification</th>
              </tr>
            </thead>
            <tbody>
              {(data?.rows ?? []).map((item: any) => (
                <tr key={item.institute}>
                  <td className="font-bold text-[#2C3B4D]">{item.institute}</td>
                  <td>{item.observedDays} Days</td>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-28 overflow-hidden rounded-full bg-[#C9C1B1]/40">
                        <div className={`h-full rounded-full ${item.anomalyScore >= 60 ? "bg-[#A35139]" : item.anomalyScore >= 30 ? "bg-[#FFB162]" : "bg-emerald-600"}`} style={{ width: `${Math.min(100, item.anomalyScore)}%` }} />
                      </div>
                      <span className="text-xs font-bold text-[#1B2632]">{item.anomalyScore}/100</span>
                    </div>
                  </td>
                  <td className="font-bold text-[#A35139]">{item.flaggedDays} Days</td>
                  <td><StatusPill value={item.anomalyScore >= 60 ? "HIGH" : item.anomalyScore >= 30 ? "MEDIUM" : "LOW"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  ); 
}

function AlertsView({ data, onAcknowledge, onResolve }: { data: any[]; onAcknowledge: (id: string) => void; onResolve: (id: string) => void }) { 
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Real-Time Grid Triage</p>
          <h2 className="mt-1 text-2xl font-bold text-[#1B2632]">Alerts &amp; Operational Exceptions</h2>
          <p className="mt-1 text-sm text-[#5C6773]">Automated alerts raised by geofence breaches, CCTV blackouts, and SHA-256 evidence mismatches.</p>
        </div>
        <div className="rounded-lg bg-[#A35139]/15 border border-[#A35139]/30 px-3 py-1.5 text-xs font-bold text-[#A35139]">
          {data.filter((item) => item.status === "OPEN").length} Active Alerts
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {data.map((item) => (
          <div key={item.id} className="panel p-5">
            <div className="flex gap-3">
              <div className={`rounded-lg p-2.5 shrink-0 ${item.severity === "CRITICAL" ? "bg-[#A35139]/20 text-[#A35139]" : "bg-[#FFB162]/20 text-[#7A3F00]"}`}>
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-[#1B2632]">{item.title}</p>
                    <p className="mt-0.5 text-[10px] font-mono text-[#5C6773]">{item.id} · {item.type}</p>
                  </div>
                  <StatusPill value={item.status} />
                </div>
                <p className="mt-3 text-xs leading-5 text-[#5C6773]">{item.detail}</p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#C9C1B1] pt-3 text-[11px] text-[#5C6773]">
                  <span>{new Date(item.createdAt).toLocaleString()}</span>
                  <div className="flex gap-2">
                    {item.status === "OPEN" && (
                      <button onClick={() => onAcknowledge(item.id)} className="rounded-md border border-[#2C3B4D] px-2.5 py-1 text-[10px] font-bold text-[#2C3B4D] hover:bg-[#2C3B4D] hover:text-white transition-colors">
                        Acknowledge
                      </button>
                    )}
                    {item.status !== "RESOLVED" && (
                      <button onClick={() => onResolve(item.id)} className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800 hover:bg-emerald-100 transition-colors">
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  ); 
}

function AuditView({ data, onVerify, isVerifying, onTamper, onRestore }: { data?: any; onVerify: () => void; isVerifying: boolean; onTamper?: () => void; onRestore?: () => void }) { 
  const isChainIntact = data?.verification?.valid ?? true;
  const totalEntries = data?.verification?.totalEntries ?? data?.events?.length ?? 0;
  const brokenAtIndex = data?.verification?.brokenAtIndex;
  const brokenEventId = data?.verification?.brokenEventId;

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Forensic Audit Log</p>
          <h2 className="mt-1 text-2xl font-bold text-[#1B2632]">Tamper-Evident SHA-256 Hash Chain</h2>
          <p className="mt-1 text-sm text-[#5C6773]">Every dispatch, evidence capture, and observation is linked into a non-repudiable audit blockchain.</p>
        </div>
        <div className="flex items-center gap-2">
          {onTamper && isChainIntact && (
            <button 
              onClick={onTamper} 
              className="button-press inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#A35139]/40 bg-[#A35139]/10 px-3 py-2 text-xs font-bold text-[#A35139] hover:bg-[#A35139]/20 transition-colors shadow-sm"
              title="Demo Mode: Mutate a record to simulate ledger tampering"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Simulate Chain Tamper
            </button>
          )}
          {onRestore && !isChainIntact && (
            <button 
              onClick={onRestore} 
              className="button-press inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-400 bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-sm"
              title="Demo Mode: Restore original ledger payload"
            >
              <Check className="h-3.5 w-3.5" />
              Restore Ledger Chain
            </button>
          )}
          <button 
            disabled={isVerifying}
            onClick={onVerify} 
            className="button-press inline-flex items-center justify-center gap-2 rounded-lg bg-[#2C3B4D] px-4 py-2 text-xs font-bold text-[#FFB162] hover:bg-[#1B2632] transition-colors shadow-sm"
          >
            {isVerifying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
            Verify Chain Integrity
          </button>
        </div>
      </div>

      <div className={`flex items-center gap-3 rounded-xl border p-4 text-sm ${isChainIntact ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-[#A35139]/40 bg-[#A35139]/10 text-[#A35139]"}`}>
        <span className={`grid h-8 w-8 place-items-center rounded-full ${isChainIntact ? "bg-emerald-600 text-white" : "bg-[#A35139] text-white"}`}>
          {isChainIntact ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </span>
        <div>
          <p className="font-bold">
            {isChainIntact 
              ? `Chain Intact (${totalEntries} entries verified)` 
              : `Broken at entry #${brokenAtIndex ?? "N/A"} (${brokenEventId ?? "Unknown ID"})`}
          </p>
          <p className="mt-0.5 text-xs opacity-80">Hash Formula: H(n) = SHA256(H(n-1) + CanonicalJSON(Payload) + Timestamp)</p>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Event ID &amp; Time</th>
                <th>Event Type</th>
                <th>Actor Signature</th>
                <th>Previous Hash (Parent)</th>
                <th>Current Block Hash</th>
              </tr>
            </thead>
            <tbody>
              {(data?.events ?? []).map((item: any) => (
                <tr key={item.id} className="hover:bg-[#EEE9DF]/30">
                  <td className="font-mono text-[10px] text-[#5C6773]">
                    <span className="font-bold text-[#1B2632]">{item.id}</span>
                    <p className="text-[10px] text-[#5C6773]">{new Date(item.createdAt).toLocaleString()}</p>
                  </td>
                  <td><span className="text-xs font-bold text-[#2C3B4D]">{item.type}</span></td>
                  <td className="text-xs font-medium text-[#1B2632]">{item.actor}</td>
                  <td className="font-mono text-[10px] text-[#5C6773]">{item.previousHash?.slice(0, 16) ?? "GENESIS"}…</td>
                  <td className="font-mono text-[10px] font-bold text-[#2C3B4D]">{item.currentHash.slice(0, 16)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  ); 
}

function LoadingState() { 
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="flex items-center gap-3 text-sm font-semibold text-[#2C3B4D]">
        <RefreshCw className="h-5 w-5 animate-spin text-[#FFB162]" /> 
        Synchronizing with DoSJE National Grid…
      </div>
    </div>
  ); 
}

function AdminView({ 
  data, onUpdate 
}: { 
  data: Array<{ id: number; name: string | null; email: string | null; role: string; organizationId: string | null }>; 
  onUpdate: (userId: number, role: "DEPARTMENT_ADMIN" | "PMU_INSPECTOR" | "INSTITUTE_ADMIN" | "AUDITOR", organizationId: string | null) => void 
}) {
  const [drafts, setDrafts] = useState<Record<number, { role: "DEPARTMENT_ADMIN" | "PMU_INSPECTOR" | "INSTITUTE_ADMIN" | "AUDITOR"; organizationId: string }>>({});
  const setDraft = (item: (typeof data)[number], patch: Partial<(typeof drafts)[number]>) => 
    setDrafts((current) => ({ 
      ...current, 
      [item.id]: { 
        role: (current[item.id]?.role ?? (item.role === "admin" || item.role === "user" ? "PMU_INSPECTOR" : item.role)) as "DEPARTMENT_ADMIN" | "PMU_INSPECTOR" | "INSTITUTE_ADMIN" | "AUDITOR", 
        organizationId: current[item.id]?.organizationId ?? item.organizationId ?? "", 
        ...patch 
      } 
    }));

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Ministry RBAC</p>
        <h2 className="mt-1 text-2xl font-bold text-[#1B2632]">Role &amp; Jurisdiction Administration</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[#5C6773]">
          Department Admin controls enforced server-side. Scope isolation strictly prevents cross-institute record access.
        </p>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Operator Name</th>
                <th>Designated Role</th>
                <th>Organization Scope</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => { 
                const draft = drafts[item.id] ?? { 
                  role: (item.role === "admin" || item.role === "user" ? "PMU_INSPECTOR" : item.role) as "DEPARTMENT_ADMIN" | "PMU_INSPECTOR" | "INSTITUTE_ADMIN" | "AUDITOR", 
                  organizationId: item.organizationId ?? "" 
                }; 
                return (
                  <tr key={item.id}>
                    <td>
                      <p className="text-xs font-bold text-[#1B2632]">{item.name ?? "User"}</p>
                      <p className="text-[11px] text-[#5C6773]">{item.email ?? item.id}</p>
                    </td>
                    <td>
                      <select 
                        className="rounded-md border border-[#C9C1B1] bg-white px-2 py-1.5 text-xs text-[#1B2632]" 
                        value={draft.role} 
                        onChange={(event) => setDraft(item, { role: event.target.value as typeof draft.role })}
                      >
                        <option value="DEPARTMENT_ADMIN">Department Official</option>
                        <option value="PMU_INSPECTOR">PMU Inspector</option>
                        <option value="INSTITUTE_ADMIN">Institute Admin</option>
                        <option value="AUDITOR">Auditor</option>
                      </select>
                    </td>
                    <td>
                      <input 
                        className="w-28 rounded-md border border-[#C9C1B1] bg-white px-2 py-1.5 text-xs text-[#1B2632]" 
                        placeholder="INS-001" 
                        value={draft.organizationId} 
                        onChange={(event) => setDraft(item, { organizationId: event.target.value })} 
                      />
                    </td>
                    <td>
                      <button 
                        className="rounded-md bg-[#2C3B4D] px-3 py-1.5 text-[10px] font-bold text-[#FFB162] button-press hover:bg-[#1B2632]" 
                        onClick={() => onUpdate(item.id, draft.role, draft.organizationId || null)}
                      >
                        Save Access
                      </button>
                    </td>
                  </tr>
                ); 
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
