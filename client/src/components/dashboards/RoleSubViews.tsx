import { useState } from "react";
import { 
  FileCheck2, Wallet, BarChart3, Bell, CheckCircle2, 
  Download, ArrowRight, Send, AlertTriangle, ShieldCheck, 
  Calendar, Clock, Check
} from "lucide-react";
import { toast } from "sonner";

export function InstituteComplianceView({ user, onSelectView }: { user: any; onSelectView: (v: any) => void }) {
  const [uploaded, setUploaded] = useState(false);

  const handleUpload = () => {
    toast.success("Document uploaded & registered with SHA-256 seal in Ministry Repository");
    setUploaded(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow text-[#A35139]">Institute Governance</p>
          <h2 className="mt-1 text-2xl font-bold text-[#1B2632]">Sanctions &amp; Statutory Compliance</h2>
          <p className="mt-1 text-sm text-slate-500">Utilization certificates (GFR 12-A), fire safety clearance, accessibility audit records.</p>
        </div>
        <button
          onClick={handleUpload}
          className="button-press inline-flex items-center gap-2 rounded-lg bg-[#FFB162] px-3.5 py-2.5 text-xs font-bold text-[#1B2632] hover:bg-[#f59e4b]"
        >
          <FileCheck2 className="h-4 w-4" /> Upload New Compliance Certificate
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#C9C1B1]/30 pb-2.5">
            <div>
              <p className="font-bold text-sm text-[#1B2632]">Utilization Certificate (GFR 12-A)</p>
              <p className="text-xs text-slate-500">Financial Year 2025-26 · Q2 Submission</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">VERIFIED</span>
          </div>
          <p className="text-xs text-slate-600">Certified by Chartered Accountant. Verified against PFMS disbursements for ₹18.50 Lakhs grant allocation.</p>
          <div className="text-[11px] font-mono text-slate-500">Hash: 8f4b23a9d012... · Submitted 05 Sep 2026</div>
        </div>

        <div className="panel p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#C9C1B1]/30 pb-2.5">
            <div>
              <p className="font-bold text-sm text-[#1B2632]">Fire Safety &amp; Structural Clearance</p>
              <p className="text-xs text-slate-500">Municipal Fire Department NOC</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">VALID</span>
          </div>
          <p className="text-xs text-slate-600">Valid up to 31 December 2026. Annual emergency exit audit and fire extinguisher inspection cleared.</p>
          <div className="text-[11px] font-mono text-slate-500">NOC Ref: HYD-FIRE-2025-912 · Verified</div>
        </div>

        <div className="panel p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#C9C1B1]/30 pb-2.5">
            <div>
              <p className="font-bold text-sm text-[#1B2632]">Disability Accessibility Audit</p>
              <p className="text-xs text-slate-500">Rights of Persons with Disabilities Act Compliance</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">GRADE A</span>
          </div>
          <p className="text-xs text-slate-600">Wheelchair ramps, tactile corridors, accessible restrooms, and auditory signage certified on campus.</p>
          <div className="text-[11px] font-mono text-slate-500">Cert #ACC-TS-2025-014 · Verified</div>
        </div>

        <div className="panel p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#C9C1B1]/30 pb-2.5">
            <div>
              <p className="font-bold text-sm text-[#1B2632]">Staff &amp; Special Educator Roster</p>
              <p className="text-xs text-slate-500">Rehabilitation Council of India (RCI) Registered</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">VERIFIED</span>
          </div>
          <p className="text-xs text-slate-600">12 qualified special educators, speech therapists, and physiotherapists registered with RCI numbers on file.</p>
          <div className="text-[11px] font-mono text-slate-500">Roster Sync: Active · 12 Verified</div>
        </div>
      </div>
    </div>
  );
}

export function BeneficiaryDbtView({ user, onSelectView }: { user: any; onSelectView: (v: any) => void }) {
  const transactions = [
    { id: "TXN-2026-Q3", quarter: "Quarter 3 (Jul - Sep 2026)", amount: "₹12,000", date: "22 Sep 2026", utr: "SBIN0048192049", pfms: "PFMS-491028", status: "DISBURSED" },
    { id: "TXN-2026-Q2", quarter: "Quarter 2 (Apr - Jun 2026)", amount: "₹12,000", date: "18 Jun 2026", utr: "SBIN0039281044", pfms: "PFMS-480912", status: "DISBURSED" },
    { id: "TXN-2026-Q1", quarter: "Quarter 1 (Jan - Mar 2026)", amount: "₹12,000", date: "24 Mar 2026", utr: "SBIN0028190281", pfms: "PFMS-470129", status: "DISBURSED" },
    { id: "TXN-2025-Q4", quarter: "Quarter 4 (Oct - Dec 2025)", amount: "₹12,000", date: "20 Dec 2025", utr: "SBIN0019280193", pfms: "PFMS-461048", status: "DISBURSED" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow text-[#A35139]">Direct Benefit Transfer (DBT)</p>
          <h2 className="mt-1 text-2xl font-bold text-[#1B2632]">Scholarship &amp; Stipend Disbursement Ledger</h2>
          <p className="mt-1 text-sm text-slate-500">Government of India direct transfer history into your Aadhaar-linked State Bank of India account.</p>
        </div>
        <div className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 border border-emerald-200">
          Total Disbursed: ₹48,000
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Installment Quarter</th>
                <th>Amount</th>
                <th>Disbursed Date</th>
                <th>Bank UTR Reference</th>
                <th>PFMS Clearance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-[#EEE9DF]/40">
                  <td className="font-mono text-xs font-bold text-[#2C3B4D]">{t.id}</td>
                  <td className="text-xs font-medium text-slate-800">{t.quarter}</td>
                  <td className="text-xs font-bold text-emerald-700">{t.amount}</td>
                  <td className="text-xs text-slate-500">{t.date}</td>
                  <td className="font-mono text-[11px] text-slate-600">{t.utr}</td>
                  <td className="font-mono text-[11px] text-slate-500">{t.pfms}</td>
                  <td>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                      <Check className="h-3 w-3" /> {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-[#C9C1B1] bg-[#EEE9DF]/60 p-4 text-xs text-[#2C3B4D] leading-relaxed">
        <strong>Direct Benefit Notice:</strong> Under DoSJE DBT guidelines, all payments are credited without intermediaries. If your Aadhaar seeding changes, update your bank branch immediately to avoid transfer delays.
      </div>
    </div>
  );
}

export function BeneficiaryAttendanceView({ user, attendance, onSelectView }: { user: any; attendance: any; onSelectView: (v: any) => void }) {
  const days = Array.from({ length: 28 }, (_, i) => ({
    day: i + 1,
    present: i !== 5 && i !== 12 && i !== 19, // sample absent days
    verified: true,
  }));

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow text-[#A35139]">Biometric Attendance Verification</p>
        <h2 className="mt-1 text-2xl font-bold text-[#1B2632]">My Monthly Attendance Log</h2>
        <p className="mt-1 text-sm text-slate-500">Transparent attendance verified by on-campus biometric machine and transmitted to Ministry servers.</p>
      </div>

      <div className="panel p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#C9C1B1]/30 pb-3">
          <div>
            <h4 className="font-bold text-sm text-[#1B2632]">September 2026 Attendance Summary</h4>
            <p className="text-xs text-slate-500">25 Days Present · 3 Days Excused · 0 Unexcused</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
            94.5% Attendance (Eligible for Full DBT)
          </span>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center text-xs">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="font-bold text-slate-400 text-[11px] py-1">{d}</div>
          ))}
          {days.map((item) => (
            <div
              key={item.day}
              className={`rounded-lg p-2.5 border text-xs font-bold transition-all ${
                item.present
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-slate-100 border-slate-200 text-slate-400"
              }`}
            >
              <div>{item.day}</div>
              <div className="text-[9px] font-normal mt-0.5">
                {item.present ? "Present" : "Leave"}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500 pt-3 border-t border-[#C9C1B1]/30">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-100 border border-emerald-300" /> Biometric Present (Verified)</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-100 border border-slate-300" /> Authorized Leave / Holiday</span>
        </div>
      </div>
    </div>
  );
}

export function BeneficiaryGrievanceView({ user, onSelectView }: { user: any; onSelectView: (v: any) => void }) {
  const [ticketText, setTicketText] = useState("");
  const [category, setCategory] = useState("scholarship");
  const [submitted, setSubmitted] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketText.trim()) return toast.error("Please enter grievance details");
    const id = `GRV-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    setSubmitted(id);
    toast.success(`Complaint registered directly with Department of Social Justice. ID: ${id}`);
    setTicketText("");
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow text-[#A35139]">Citizen Rights &amp; Redressal</p>
        <h2 className="mt-1 text-2xl font-bold text-[#1B2632]">Lodge Ministry Grievance</h2>
        <p className="mt-1 text-sm text-slate-500">Direct escalation to State and Central Department of Social Justice &amp; Empowerment officers.</p>
      </div>

      <div className="grid gap-5 md:grid-cols-[1.3fr_0.7fr]">
        <div className="panel p-5 sm:p-6">
          {submitted ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 space-y-2">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Grievance Registered Successfully
              </h4>
              <p className="text-xs">Ticket Tracking Number: <b className="font-mono text-sm">{submitted}</b></p>
              <p className="text-xs text-emerald-800">
                Your complaint has been queued for inquiry by the DoSJE District PMU Officer. You will receive an SMS update on your registered mobile number.
              </p>
              <button onClick={() => setSubmitted(null)} className="text-xs font-semibold text-emerald-700 underline mt-2 block">
                Submit another grievance
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="eyebrow block mb-1">Issue Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-[#C9C1B1] bg-white p-2.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#FFB162]"
                >
                  <option value="scholarship">Delayed DBT Scholarship / Financial Aid</option>
                  <option value="attendance">Disputed Biometric Attendance Record</option>
                  <option value="infrastructure">Ramps / Accessibility Equipment Not Maintained</option>
                  <option value="hostel">Hostel / Nutrition / Medical Neglect</option>
                  <option value="misconduct">Harassment or Discrimination by Institute Staff</option>
                </select>
              </div>

              <div>
                <label className="eyebrow block mb-1">Detailed Explanation</label>
                <textarea
                  value={ticketText}
                  onChange={(e) => setTicketText(e.target.value)}
                  placeholder="Explain your grievance clearly with dates, institute remarks, or specific shortcomings..."
                  className="w-full min-h-32 rounded-lg border border-[#C9C1B1] p-3 text-xs outline-none focus:ring-2 focus:ring-[#FFB162]"
                />
              </div>

              <button
                type="submit"
                className="button-press inline-flex items-center gap-2 rounded-lg bg-[#FFB162] px-4 py-2.5 text-xs font-bold text-[#1B2632] hover:bg-[#f59e4b]"
              >
                <Send className="h-4 w-4" />
                Submit Directly to Ministry
              </button>
            </form>
          )}
        </div>

        <div className="panel p-5 bg-[#1B2632] text-white border border-[#C9C1B1]/30 space-y-3">
          <div className="flex items-center gap-2 text-[#FFB162]">
            <ShieldCheck className="h-5 w-5" />
            <h4 className="font-bold text-sm">Beneficiary Protection</h4>
          </div>
          <p className="text-xs text-[#EEE9DF]/80 leading-5">
            Under Section 89 of the Rights of Persons with Disabilities Act, 2016, all beneficiaries have the statutory right to impartial Ministry oversight.
          </p>
          <ul className="text-xs text-[#EEE9DF]/70 space-y-1.5 list-disc pl-4">
            <li>No institute can withhold your scholarship or attendance for filing a complaint.</li>
            <li>Inquiries are carried out by an independent PMU field officer.</li>
            <li>Emergency toll-free helpline: <b>1800-11-2001</b> (DoSJE).</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
