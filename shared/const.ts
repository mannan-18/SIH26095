export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

// One-time nonce cookie that binds an OAuth login to the browser that started
// it. The `__Host-` prefix forces the cookie host-only (Secure, Path=/, no
// Domain), so a sibling *.manus.space site cannot plant a matching value in a
// victim's browser.
export const OAUTH_STATE_COOKIE = "__Host-oauth_state";

// `state` carries the callback redirect URI (used at token exchange) plus the
// CSRF nonce. Defined here so the client encoder and server decoder never drift.
export type OAuthState = { redirectUri: string; nonce?: string };

export const encodeOAuthState = (state: OAuthState): string =>
  btoa(JSON.stringify(state));

export const decodeOAuthState = (state: string): OAuthState => {
  let decoded: string;
  try {
    decoded = atob(state);
  } catch {
    // Malformed base64 (e.g. attacker-supplied garbage). Return no nonce so the
    // callback's CSRF guard rejects it with 403 — never throw, since the caller
    // runs outside the request handler's try/catch.
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
    // Legacy links: `state` was a bare base64(redirectUri) with no nonce.
  }
  return { redirectUri: decoded };
};

export interface PublicRoleMetadata {
  roleKey: "official" | "pmu" | "ngo" | "beneficiary" | "state";
  dbRole: "DEPARTMENT_ADMIN" | "PMU_INSPECTOR" | "INSTITUTE_ADMIN" | "STATE_AUTHORITY" | "user";
  title: string;
  primaryId: string;
  name: string;
  email: string;
  organizationId: string | null;
  stateScope?: string | null;
}

export const DEMO_ROLES: Record<string, PublicRoleMetadata> = {
  official: {
    roleKey: "official",
    dbRole: "DEPARTMENT_ADMIN",
    title: "Department Official",
    primaryId: "DOSJE-OFF-01",
    name: "Rajeshwar Verma (Director, DoSJE)",
    email: "r.verma@dosje.gov.in",
    organizationId: null,
  },
  pmu: {
    roleKey: "pmu",
    dbRole: "PMU_INSPECTOR",
    title: "PMU Inspector",
    primaryId: "PMU-INSP-101",
    name: "Dr. Sunita Rao (Field Inspector)",
    email: "sunita.rao@pmu.gov.in",
    organizationId: null,
  },
  ngo: {
    roleKey: "ngo",
    dbRole: "INSTITUTE_ADMIN",
    title: "NGO / Institute Principal",
    primaryId: "NGO-INST-501",
    name: "Fr. Thomas Mathew (Director, Samarthan Kendra)",
    email: "contact@samarthan.org",
    organizationId: "INS-001",
  },
  beneficiary: {
    roleKey: "beneficiary",
    dbRole: "user",
    title: "Beneficiary (Citizen)",
    primaryId: "BEN-2026-999",
    name: "Anand Kumar (Scholarship Beneficiary)",
    email: "anand.kumar@beneficiary.dosje.in",
    organizationId: null,
  },
  state: {
    roleKey: "state",
    dbRole: "STATE_AUTHORITY",
    title: "State Authority (Maharashtra)",
    primaryId: "STATE-MH-001",
    name: "Prakash Deshmukh (Secretary, Social Welfare MH)",
    email: "p.deshmukh@maharashtra.gov.in",
    organizationId: null,
    stateScope: "Maharashtra",
  },
};

DEMO_ROLES["inspector"] = DEMO_ROLES.pmu;
DEMO_ROLES["institute"] = DEMO_ROLES.ngo;
DEMO_ROLES["state_authority"] = DEMO_ROLES.state;


