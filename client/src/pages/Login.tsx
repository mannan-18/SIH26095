import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { 
  ShieldCheck, CheckCircle2, Lock, Eye, EyeOff, 
  ArrowRight, RefreshCw, AlertTriangle, User,
  Building2, Users, Landmark, FileCheck2, Sparkles, LogOut, X, HelpCircle
} from "lucide-react";
import "./Login.css";

type RoleKey = "official" | "pmu" | "ngo" | "beneficiary" | "state";

interface RoleConfig {
  key: RoleKey;
  label: Record<"EN" | "HI", string>;
  fieldLabel: Record<"EN" | "HI", string>;
  placeholder: string;
  badge: string;
  desc: Record<"EN" | "HI", string>;
  defaultId: string;
}

const ROLES: Record<RoleKey, RoleConfig> = {
  official: {
    key: "official",
    label: { EN: "Department Official", HI: "विभाग अधिकारी" },
    fieldLabel: { EN: "Employee ID / Gov Email", HI: "कर्मचारी आईडी / सरकारी ईमेल" },
    placeholder: "e.g. DOSJE-OFF-01",
    badge: "CENTRAL COMMAND",
    desc: {
      EN: "National inspection oversight & surprise scheduling",
      HI: "राष्ट्रीय निरीक्षण देखरेख और आश्चर्यचकित अनुसूची"
    },
    defaultId: "DOSJE-OFF-01",
  },
  pmu: {
    key: "pmu",
    label: { EN: "PMU Inspector", HI: "पीएमयू निरीक्षक" },
    fieldLabel: { EN: "Inspector ID / Official Email", HI: "निरीक्षक आईडी / आधिकारिक ईमेल" },
    placeholder: "e.g. PMU-INSP-101",
    badge: "FIELD TERMINAL",
    desc: {
      EN: "100m Geofenced on-site audit & SHA-256 evidence sealing",
      HI: "100 मीटर भू-बाड़बद्ध साइट पर ऑडिट और साक्ष्य मुहर"
    },
    defaultId: "PMU-INSP-101",
  },
  ngo: {
    key: "ngo",
    label: { EN: "NGO / Institute", HI: "गैर सरकारी संगठन / संस्थान" },
    fieldLabel: { EN: "Institute ID / Org Email", HI: "संस्थान आईडी / संगठन ईमेल" },
    placeholder: "e.g. NGO-INST-501",
    badge: "INSTITUTE PORTAL",
    desc: {
      EN: "Beneficiary attendance, statutory clearances & compliance",
      HI: "लाभार्थी उपस्थिति, वैधानिक मंजूरी और अनुपालन"
    },
    defaultId: "NGO-INST-501",
  },
  beneficiary: {
    key: "beneficiary",
    label: { EN: "Beneficiary", HI: "लाभार्थी (नागरिक)" },
    fieldLabel: { EN: "Beneficiary ID / Mobile Number", HI: "लाभार्थी आईडी / मोबाइल नंबर" },
    placeholder: "e.g. BEN-2026-999",
    badge: "CITIZEN PORTAL",
    desc: {
      EN: "Direct Benefit Transfer (DBT) tracking & grievance portal",
      HI: "प्रत्यक्ष लाभ अंतरण (DBT) ट्रैकिंग और शिकायत पोर्टल"
    },
    defaultId: "BEN-2026-999",
  },
  state: {
    key: "state",
    label: { EN: "State / District Authority", HI: "राज्य / जिला प्राधिकरण" },
    fieldLabel: { EN: "Official State / District ID", HI: "आधिकारिक राज्य / जिला आईडी" },
    placeholder: "e.g. STATE-MH-001",
    badge: "REGIONAL VIEW",
    desc: {
      EN: "Regional inspection overview & district compliance monitoring",
      HI: "क्षेत्रीय निरीक्षण अवलोकन और जिला अनुपालन निगरानी"
    },
    defaultId: "STATE-MH-001",
  },
};

const DICTIONARY = {
  EN: {
    title: "Official Portal Sign In",
    subtext: "Select your designated role and authenticate with your Government or Institute credentials.",
    selectHeading: "SELECT ACCESS ROLE",
    passwordLabel: "Password",
    rememberMe: "Keep session active (Remember Me)",
    rememberHint: "Not recommended on shared devices.",
    submit: "Authorize & Enter Dashboard",
    verifying: "Verifying with DoSJE Directory…",
    needHelp: "Need help? Contact support",
    forgotPass: "Forgot password?",
    capsLock: "Caps Lock is ON",
    demoBadge: "SIMULATED / DEMO",
    demoTitle: "Demo access – for evaluators",
    demoAutofill: "Auto-fill demo credentials",
    demoPasswordMask: "Show demo password",
    activeSessionTitle: "Active Session Detected",
    enterDashboard: "Enter Dashboard →",
    switchAccount: "Switch Account",
    supportModalTitle: "Department Technical Support & Assistance",
    supportModalBody: "For account lockout, credentials retrieval, or official access provisioning, please contact the DoSJE Nodal Officer at support-dosje@gov.in or call our official helpline 1800-11-2026 (Mon–Sat, 09:30–18:00 IST).",
    close: "Close Support Window",
    secGeofence: "Server-Verified Geofence",
    secLedger: "Tamper-Evident Audit Log",
    secSession: "Session-Secured Sign-in",
    legalNotice: "Official GovTech portal of the Department of Social Justice & Empowerment, Government of India. Unauthorized access attempts are monitored and punishable under the IT Act, 2000.",
  },
  HI: {
    title: "आधिकारिक पोर्टल साइन इन",
    subtext: "अपनी मनोनीत भूमिका चुनें और अपने सरकारी या संस्थान के क्रेडेंशियल्स के साथ प्रमाणित करें।",
    selectHeading: "पहुंच भूमिका चुनें",
    passwordLabel: "पासवर्ड",
    rememberMe: "सत्र सक्रिय रखें (रिमेंबर मी)",
    rememberHint: "साझा उपकरणों पर अनुशंसित नहीं है।",
    submit: "अधिकृत करें और डैशबोर्ड दर्ज करें",
    verifying: "DoSJE निर्देशिका के साथ सत्यापन जारी…",
    needHelp: "सहायता चाहिए? संपर्क करें",
    forgotPass: "पासवर्ड भूल गए?",
    capsLock: "कैप्स लॉक ऑन है",
    demoBadge: "सिम्युलेटेड / डेमो",
    demoTitle: "डेमो एक्सेस – परीक्षकों के लिए",
    demoAutofill: "डेमो क्रेडेंशियल्स ऑटो-फिल करें",
    demoPasswordMask: "डेमो पासवर्ड दिखाएं",
    activeSessionTitle: "सक्रिय सत्र पाया गया",
    enterDashboard: "डैशबोर्ड दर्ज करें →",
    switchAccount: "खाता बदलें",
    supportModalTitle: "विभाग तकनीकी सहायता और मदद",
    supportModalBody: "खाता लॉकआउट, क्रेडेंशियल पुनर्प्राप्ति, या आधिकारिक पहुंच व्यवस्था के लिए कृपया DoSJE नोडल अधिकारी से support-dosje@gov.in पर संपर्क करें या हेल्पलाइन 1800-11-2026 (सोम-शनि, 09:30-18:00 IST) पर कॉल करें।",
    close: "बंद करें",
    secGeofence: "सर्वर-सत्यापित भू-बाड़",
    secLedger: "छेड़छाड़-रोधी ऑडिट लॉग",
    secSession: "सत्र-सुरक्षित साइन-इन",
    legalNotice: "सामाजिक न्याय और अधिकारिता विभाग, भारत सरकार का आधिकारिक पोर्टल। अनधिकृत पहुंच के प्रयासों की निगरानी की जाती है और आईटी अधिनियम, 2000 के तहत दंडनीय है।",
  },
};

export default function Login() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading, logout } = useAuth();
  const utils = trpc.useUtils();

  const [lang, setLang] = useState<"EN" | "HI">(() => {
    try {
      const saved = localStorage.getItem("dosje-lang");
      return saved === "HI" ? "HI" : "EN";
    } catch {
      return "EN";
    }
  });

  const [selectedRole, setSelectedRole] = useState<RoleKey>("official");
  const [identifier, setIdentifier] = useState(ROLES.official.defaultId);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showDemoPassword, setShowDemoPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const identifierInputRef = useRef<HTMLInputElement | null>(null);

  const activeConfig = ROLES[selectedRole];
  const t = DICTIONARY[lang];

  // Server Demo Credentials Query (Fetches only when DEMO_MODE=true on server)
  const demoQuery = trpc.auth.demoCredentials.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const isDemoActive = Boolean(demoQuery.data?.demoMode);
  const serverDemoCreds = demoQuery.data?.credentials;

  const toggleLanguage = () => {
    const nextLang = lang === "EN" ? "HI" : "EN";
    setLang(nextLang);
    try {
      localStorage.setItem("dosje-lang", nextLang);
    } catch {}
  };

  // Canvas background rendering respecting prefers-reduced-motion
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Draw static background if user prefers reduced motion
    if (prefersReducedMotion) {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#D3C3B9");
      grad.addColorStop(1, "#FAF8F5");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      return () => {
        window.removeEventListener("resize", handleResize);
      };
    }

    // Interactive Node Animation
    let mouse = { x: width / 2, y: height / 2, active: false };
    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };
    const handleMouseLeave = () => {
      mouse.active = false;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    const nodeCount = Math.min(36, Math.floor(width / 32));
    const nodes = Array.from({ length: nodeCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: 1.5 + Math.random() * 2,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Soft gradient background
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "rgba(211, 195, 185, 0.4)");
      grad.addColorStop(1, "rgba(250, 248, 245, 0.6)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Node mesh connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 140) {
            const alpha = (1 - dist / 140) * 0.2;
            ctx.strokeStyle = `rgba(21, 45, 63, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (const n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(21, 45, 63, 0.4)";
        ctx.fill();

        if (mouse.active) {
          const mdx = mouse.x - n.x;
          const mdy = mouse.y - n.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mdist < 120) {
            n.x += (mdx / mdist) * 0.3;
            n.y += (mdy / mdist) * 0.3;
          }
        }

        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      try {
        sessionStorage.setItem("manus-cookie", `app_session_id=${data.token}`);
        localStorage.setItem("dosje-selected-role", selectedRole);
        localStorage.setItem("dosje-user-data", JSON.stringify(data.user));
        document.cookie = `app_session_id=${data.token}; path=/; max-age=31536000; SameSite=Lax`;
      } catch (err) {
        console.warn("Storage write error:", err);
      }

      utils.auth.me.setData(undefined, data.user);
      setSuccess(true);
      setTimeout(() => {
        window.location.href = "/";
      }, 700);
    },
    onError: () => {
      setErrorMessage("Invalid credentials. Please verify your ID and password.");
      setTimeout(() => {
        identifierInputRef.current?.focus();
      }, 50);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setErrorMessage("Please enter both your ID/email and password to continue.");
      identifierInputRef.current?.focus();
      return;
    }

    setErrorMessage(null);
    loginMutation.mutate({
      role: selectedRole,
      identifier: identifier.trim(),
      password: password.trim(),
      rememberMe,
    });
  };

  const handleRoleSelect = (roleKey: RoleKey) => {
    setSelectedRole(roleKey);
    const cfg = ROLES[roleKey];
    setIdentifier(cfg.defaultId);
    setPassword("");
    setErrorMessage(null);
  };

  const handleRoleKeyDown = (e: React.KeyboardEvent, roleKey: RoleKey) => {
    const roleKeys: RoleKey[] = ["official", "pmu", "ngo", "beneficiary", "state"];
    const idx = roleKeys.indexOf(roleKey);

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const nextRole = roleKeys[(idx + 1) % roleKeys.length];
      handleRoleSelect(nextRole);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prevRole = roleKeys[(idx - 1 + roleKeys.length) % roleKeys.length];
      handleRoleSelect(prevRole);
    }
  };

  const handleAutofillDemo = () => {
    if (!serverDemoCreds) return;
    const cred = serverDemoCreds[selectedRole];
    if (cred) {
      setIdentifier(cred.primaryId);
      setPassword(cred.password);
      setErrorMessage(null);
    }
  };

  const handleClearSession = async () => {
    try {
      await logout();
    } catch {}
    window.location.reload();
  };

  const isSubmitting = loginMutation.isPending;
  const isFormInvalid = !identifier.trim() || !password.trim() || isSubmitting;

  return (
    <div className="dosje-login-wrapper">
      {/* Fixed 3D Mesh Canvas Background */}
      <canvas ref={canvasRef} className="login-mesh-canvas" />

      {/* Main Authentication Container */}
      <main className="login-main-stage">
        {/* Active Session Notice Banner */}
        {user && (
          <div className="active-session-banner fade-in">
            <div className="session-banner-left">
              <span className="session-dot animate-pulse" />
              <div>
                <p className="session-title">{t.activeSessionTitle}: <b>{user.name}</b></p>
                <p className="session-meta">Role: {user.role || "User"} · Session live</p>
              </div>
            </div>
            <div className="session-banner-actions">
              <button 
                type="button" 
                onClick={() => { window.location.href = "/"; }}
                className="session-resume-btn button-press"
              >
                {t.enterDashboard}
              </button>
              <button 
                type="button" 
                onClick={handleClearSession}
                className="session-switch-btn button-press"
              >
                <LogOut className="h-3.5 w-3.5" /> {t.switchAccount}
              </button>
            </div>
          </div>
        )}

        {/* Central Glassmorphic Portal Card */}
        <div className="login-card-glass">
          {!success ? (
            <div className="login-form-content">
              {/* Identity & Trust Header Block */}
              <div className="gov-card-header">
                <div className="gov-header-top-row">
                  <div className="gov-emblem-wrap">
                    <img 
                      src="/emblem.svg" 
                      alt="Government emblem placeholder" 
                      className="gov-emblem-img"
                    />
                  </div>
                  <div className="header-right-actions">
                    <button
                      type="button"
                      onClick={toggleLanguage}
                      className="lang-toggle-btn button-press"
                      title="Toggle Language / भाषा बदलें"
                      aria-label="Toggle language between English and Hindi"
                    >
                      {lang === "EN" ? "हिं" : "EN"}
                    </button>
                  </div>
                </div>

                <div className="gov-title-block">
                  <h2 className="gov-dept-name">DEPARTMENT OF SOCIAL JUSTICE &amp; EMPOWERMENT</h2>
                  <p className="gov-ministry-sub">Ministry of Social Justice &amp; Empowerment, Government of India</p>
                  <p className="gov-portal-tag">Nigrani 2.0 – Securesight</p>
                </div>

                <div className="login-title-divider" />

                <h1 className="login-main-heading">{t.title}</h1>
                <p className="login-sub-text">{t.subtext}</p>
              </div>

              {/* Accessible Role Selector Matrix */}
              <div className="role-selector-container">
                <label id="roleSelectorLabel" className="role-selector-heading">
                  {t.selectHeading}
                </label>
                <div 
                  role="radiogroup" 
                  aria-labelledby="roleSelectorLabel"
                  className="role-grid"
                >
                  {(Object.keys(ROLES) as RoleKey[]).map((roleKey) => {
                    const r = ROLES[roleKey];
                    const isSelected = selectedRole === roleKey;
                    return (
                      <button
                        key={roleKey}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        tabIndex={isSelected ? 0 : -1}
                        onClick={() => handleRoleSelect(roleKey)}
                        onKeyDown={(e) => handleRoleKeyDown(e, roleKey)}
                        className={`role-radio-card ${isSelected ? "selected" : ""} ${roleKey === "state" ? "sm:col-span-2" : ""}`}
                      >
                        <div className="role-card-header">
                          <div className="role-card-icon">
                            {roleKey === "official" && <Building2 className="h-4 w-4 text-[#152D3F]" />}
                            {roleKey === "pmu" && <FileCheck2 className="h-4 w-4 text-[#152D3F]" />}
                            {roleKey === "ngo" && <Landmark className="h-4 w-4 text-[#152D3F]" />}
                            {roleKey === "beneficiary" && <Users className="h-4 w-4 text-[#152D3F]" />}
                            {roleKey === "state" && <ShieldCheck className="h-4 w-4 text-[#152D3F]" />}
                          </div>
                          {isSelected ? (
                            <CheckCircle2 className="role-check-icon text-[#B58863]" />
                          ) : (
                            <span className="role-circle-placeholder" />
                          )}
                        </div>

                        <div className="role-card-body">
                          <span className={`role-card-title ${isSelected ? "font-bold" : ""}`}>
                            {r.label[lang]}
                          </span>
                          <span className="role-card-badge">{r.badge}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Server-Gated Collapsible Demo Access Disclosure Panel */}
              {isDemoActive && serverDemoCreds && (
                <details className="demo-credentials-disclosure">
                  <summary className="demo-credentials-summary">
                    <div className="demo-summary-title">
                      <span className="demo-pulse-dot" />
                      <span>{t.demoTitle}</span>
                    </div>
                    <span className="demo-badge-pill">{t.demoBadge}</span>
                  </summary>

                  <div className="demo-disclosure-content">
                    <div className="demo-cred-row">
                      <span className="demo-cred-label">Demo ID:</span>
                      <code className="demo-cred-code">
                        {serverDemoCreds[selectedRole]?.primaryId || "DOSJE-OFF-01"}
                      </code>
                    </div>

                    <div className="demo-cred-row">
                      <span className="demo-cred-label">Demo Pass:</span>
                      <div className="demo-pass-flex">
                        <code className="demo-cred-code">
                          {showDemoPassword
                            ? serverDemoCreds[selectedRole]?.password
                            : "••••••••••••"}
                        </code>
                        <button
                          type="button"
                          onClick={() => setShowDemoPassword(!showDemoPassword)}
                          className="demo-pass-toggle-btn"
                          aria-label={t.demoPasswordMask}
                        >
                          {showDemoPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    <p className="demo-role-desc">
                      {activeConfig.desc[lang]}
                    </p>

                    <button
                      type="button"
                      onClick={handleAutofillDemo}
                      className="demo-autofill-action-btn button-press"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {t.demoAutofill}
                    </button>
                  </div>
                </details>
              )}

              {/* Error Alert Message Region */}
              {errorMessage && (
                <div 
                  role="alert" 
                  aria-live="assertive" 
                  className="login-error-alert"
                >
                  <AlertTriangle className="h-4 w-4 text-[#A35139] flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Main Credentials Form */}
              <form onSubmit={handleSubmit} className="auth-form" noValidate>
                {/* Identifier Input */}
                <div className="form-group">
                  <label htmlFor="authIdentifier" className="form-label">
                    {activeConfig.fieldLabel[lang]}
                  </label>
                  <div className="input-field-wrap">
                    <User className="input-left-icon text-[#3D4752]" />
                    <input
                      ref={identifierInputRef}
                      id="authIdentifier"
                      type="text"
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder={activeConfig.placeholder}
                      className="auth-input-control font-mono"
                      autoComplete="username"
                      autoCapitalize="off"
                      spellCheck={false}
                      required
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="form-group">
                  <div className="label-with-action">
                    <label htmlFor="authPassword" className="form-label">
                      {t.passwordLabel}
                    </label>
                    {isCapsLockOn && (
                      <span className="capslock-warning">
                        ⚠️ {t.capsLock}
                      </span>
                    )}
                  </div>
                  <div className="input-field-wrap">
                    <Lock className="input-left-icon text-[#3D4752]" />
                    <input
                      id="authPassword"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      onKeyDown={(e) => {
                        setIsCapsLockOn(e.getModifierState("CapsLock"));
                      }}
                      onKeyUp={(e) => {
                        setIsCapsLockOn(e.getModifierState("CapsLock"));
                      }}
                      placeholder="••••••••••••"
                      className="auth-input-control font-mono"
                      autoComplete="current-password"
                      autoCapitalize="off"
                      spellCheck={false}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="input-eye-btn"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Session Checkbox & Helper Links */}
                <div className="form-options-stack">
                  <label className="remember-checkbox-label">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="remember-checkbox"
                    />
                    <span className="remember-text">{t.rememberMe}</span>
                  </label>
                  <p className="remember-hint">{t.rememberHint}</p>
                </div>

                {/* Primary Authorize Submit Button */}
                <button
                  type="submit"
                  disabled={isFormInvalid}
                  aria-busy={isSubmitting}
                  className="auth-submit-btn button-press"
                >
                  {isSubmitting ? (
                    <span className="submit-spinner-wrap">
                      <RefreshCw className="h-4 w-4 animate-spin text-[#1B2632]" />
                      {t.verifying}
                    </span>
                  ) : (
                    <span className="submit-label-wrap">
                      <span>{t.submit}</span>
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </button>

                {/* Support & Recovery Links */}
                <div className="support-links-row">
                  <button
                    type="button"
                    onClick={() => setShowHelpModal(true)}
                    className="support-link-btn"
                  >
                    <HelpCircle className="h-3.5 w-3.5 text-[#B58863]" />
                    {t.needHelp}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowHelpModal(true)}
                    className="support-link-btn"
                  >
                    {t.forgotPass}
                  </button>
                </div>
              </form>

              {/* Security Audit Footnote & Trust Badges */}
              <div className="auth-security-footer">
                <div className="security-checks-list">
                  <span className="sec-item"><ShieldCheck className="h-3.5 w-3.5 text-emerald-700" /> {t.secGeofence}</span>
                  <span className="sec-item"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" /> {t.secLedger}</span>
                  <span className="sec-item"><Lock className="h-3.5 w-3.5 text-emerald-700" /> {t.secSession}</span>
                </div>
                <p className="gov-disclaimer-text">
                  {t.legalNotice}
                </p>
              </div>
            </div>
          ) : (
            /* Success Transition View */
            <div className="login-success-view fade-in">
              <div className="success-icon-ring">
                <CheckCircle2 className="h-12 w-12 text-[#10B981] animate-bounce" />
              </div>
              <h2 className="success-heading">Identity Authorized</h2>
              <p className="success-sub">
                Authenticated as <b>{activeConfig.label[lang]}</b>. Launching dashboard…
              </p>
              <div className="success-progress-bar">
                <div className="success-progress-fill" />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Official Help & Support Dialog Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="panel max-w-md w-full bg-[#FAF8F5] border-2 border-[#B58863] p-6 rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#C9C1B1]/40 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#152D3F]" />
                <h3 className="text-sm font-bold text-[#161610]">{t.supportModalTitle}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="rounded-lg p-1 hover:bg-[#D3C3B9]/40 text-[#161610]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-[#3D4752] leading-relaxed">
              {t.supportModalBody}
            </p>

            <div className="rounded-xl bg-[#152D3F]/10 p-3 border border-[#B58863]/30 text-xs space-y-1">
              <p className="font-bold text-[#161610]">Official Helpdesk Contact:</p>
              <p className="text-[#3D4752] font-mono">Email: support-dosje@gov.in</p>
              <p className="text-[#3D4752] font-mono">Toll-Free Helpline: 1800-11-2026</p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="button-press rounded-lg bg-[#152D3F] px-4 py-2 text-xs font-bold text-white hover:bg-[#161610]"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Portal Footer */}
      <footer className="gov-login-footer">
        <p>© 2026 Department of Social Justice &amp; Empowerment (DoSJE) · Government of India</p>
        <p className="footer-links">
          <span>Surveillance Version: Nigrani 2.0</span>
          <span>·</span>
          <span>NIC Certified Architecture</span>
          <span>·</span>
          <span>Digital India Initiative</span>
        </p>
      </footer>
    </div>
  );
}
