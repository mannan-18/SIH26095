export interface RoleCredential {
  roleKey: "official" | "pmu" | "ngo" | "beneficiary" | "state";
  dbRole: "DEPARTMENT_ADMIN" | "PMU_INSPECTOR" | "INSTITUTE_ADMIN" | "STATE_AUTHORITY" | "user";
  title: string;
  primaryId: string;
  allowedIds: string[];
  password: string;
  allowedPasswords: string[];
  name: string;
  email: string;
  organizationId: string | null;
  stateScope?: string | null;
}

export const SERVER_DEMO_CREDENTIALS: Record<string, RoleCredential> = {
  official: {
    roleKey: "official",
    dbRole: "DEPARTMENT_ADMIN",
    title: "Department Official",
    primaryId: "DOSJE-OFF-01",
    allowedIds: ["dosje-off-01", "official@dosje.gov.in", "dosje-2024-0417", "dp 001", "dp001", "dpoff", "admin"],
    password: process.env.DEMO_OFFICIAL_PASSWORD || "Admin@2026",
    allowedPasswords: [process.env.DEMO_OFFICIAL_PASSWORD || "Admin@2026", "password123", "secret", "12345"],
    name: "Rajeshwar Verma (Director, DoSJE)",
    email: "r.verma@dosje.gov.in",
    organizationId: null,
  },
  pmu: {
    roleKey: "pmu",
    dbRole: "PMU_INSPECTOR",
    title: "PMU Inspector",
    primaryId: "PMU-INSP-101",
    allowedIds: ["pmu-insp-101", "inspector@pmu.gov.in", "pmu-ts-0289", "pmu 001", "pmu001", "inspector"],
    password: process.env.DEMO_INSPECTOR_PASSWORD || "Inspect@2026",
    allowedPasswords: [process.env.DEMO_INSPECTOR_PASSWORD || "Inspect@2026", "secret", "12345"],
    name: "Dr. Sunita Rao (Field Inspector)",
    email: "sunita.rao@pmu.gov.in",
    organizationId: null,
  },
  ngo: {
    roleKey: "ngo",
    dbRole: "INSTITUTE_ADMIN",
    title: "NGO / Institute Principal",
    primaryId: "NGO-INST-501",
    allowedIds: ["ngo-inst-501", "contact@samarthan.org", "ngo/ts/2019/00341", "ngo 001", "ngo001", "institute"],
    password: process.env.DEMO_NGO_PASSWORD || "Partner@2026",
    allowedPasswords: [process.env.DEMO_NGO_PASSWORD || "Partner@2026", "secret", "12345"],
    name: "Fr. Thomas Mathew (Director, Samarthan Kendra)",
    email: "contact@samarthan.org",
    organizationId: "INS-001",
  },
  beneficiary: {
    roleKey: "beneficiary",
    dbRole: "user",
    title: "Beneficiary (Citizen)",
    primaryId: "BEN-2026-999",
    allowedIds: ["ben-2026-999", "9876543210", "beneficiary@dosje.in", "123 001", "123001", "student"],
    password: process.env.DEMO_BENEFICIARY_PASSWORD || "Benefit@2026",
    allowedPasswords: [process.env.DEMO_BENEFICIARY_PASSWORD || "Benefit@2026", "secret", "12345"],
    name: "Anand Kumar (Scholarship Beneficiary)",
    email: "anand.kumar@beneficiary.dosje.in",
    organizationId: null,
  },
  state: {
    roleKey: "state",
    dbRole: "STATE_AUTHORITY",
    title: "State Authority (Maharashtra)",
    primaryId: "STATE-MH-001",
    allowedIds: ["state-mh-001", "state@dosje.mh.gov.in", "state-off-mh", "state"],
    password: process.env.DEMO_STATE_PASSWORD || "State@2026",
    allowedPasswords: [process.env.DEMO_STATE_PASSWORD || "State@2026", "secret", "12345"],
    name: "Prakash Deshmukh (Secretary, Social Welfare MH)",
    email: "p.deshmukh@maharashtra.gov.in",
    organizationId: null,
    stateScope: "Maharashtra",
  }
};

SERVER_DEMO_CREDENTIALS["inspector"] = SERVER_DEMO_CREDENTIALS.pmu;
SERVER_DEMO_CREDENTIALS["institute"] = SERVER_DEMO_CREDENTIALS.ngo;

export function verifyServerRoleCredentials(role: string, identifier: string, password: string): { valid: boolean; credential?: RoleCredential; error?: string } {
  const normRole = (role || "").trim().toLowerCase();
  const roleKey = 
    normRole === "official" || normRole === "department_official" || normRole === "admin" ? "official"
    : normRole === "inspector" || normRole === "pmu_inspector" || normRole === "pmu" ? "pmu"
    : normRole === "ngo" || normRole === "institute" || normRole === "ngo_institute" || normRole === "institute_admin" ? "ngo"
    : normRole === "beneficiary" || normRole === "student" || normRole === "user" || normRole === "citizen" ? "beneficiary"
    : normRole === "state" || normRole === "state_authority" || normRole === "state_official" ? "state"
    : normRole;

  const roleConfig = SERVER_DEMO_CREDENTIALS[roleKey];
  if (!roleConfig) {
    return { valid: false, error: `Invalid role selected: ${role}` };
  }

  const cleanId = identifier.trim().toLowerCase();
  const cleanPass = password.trim();

  const idMatches = roleConfig.allowedIds.some(id => id.toLowerCase() === cleanId) || cleanId === roleConfig.primaryId.toLowerCase();
  if (!idMatches) {
    return {
      valid: false,
      error: `Invalid identifier for ${roleConfig.title}. Please enter test ID '${roleConfig.primaryId}'.`,
    };
  }

  const passMatches = roleConfig.allowedPasswords.some(p => p === cleanPass) || cleanPass === roleConfig.password;
  if (!passMatches) {
    return {
      valid: false,
      error: `Incorrect password for ${roleConfig.title}.`,
    };
  }

  return { valid: true, credential: roleConfig };
}
