# Securesight (DoSJE Nigrani 2.0 Grid) - 3-Minute Live Demo Script

**Problem Statement 26095:** Smart Real-Time Monitoring & Inspection Mobile App  
**Target Audience:** MoSJE Jury / Technical Evaluators  
**Duration:** 3 Minutes  

---

## Demo Overview Flow

```
[0:00 - 0:30] Department Command Centre & Risk-Weighted AI Assignment
    │
[0:30 - 1:15] Inspector Mobile Workspace: Geofence Rejection & Live Photo Ingestion
    │
[1:15 - 1:45] Audit Ledger Verification & SHA-256 Tamper Detection
    │
[1:45 - 2:15] Real-Time Random Video Call (VC) & CCTV Outage Watchdog
    │
[2:15 - 3:00] State Authority Scoped Dashboard & Server Protection Proof
```

---

## Step-by-Step Script & Actions

### Scene 1: Department Command Centre & Risk-Weighted AI Assignment (0:00 - 0:30)
1. **Open Browser Window 1:** Navigate to `http://localhost:5000/login` and log in as **Department Official** (`DEPARTMENT_ADMIN`).
2. **Presenter Explanation:** 
   > *"Welcome to Securesight DoSJE Nigrani 2.0 Grid. Notice our Command Centre overview: every metric—system integrity score, attendance variance, and anomaly count—is computed directly from our active store, never hardcoded."*
3. **Action:** Click on the **Assignments / Scheduling** tab.
4. **Presenter Explanation:** 
   > *"When assigning high-priority inspections, our AI Engine ranks institutes by multi-factor risk: recent anomaly frequency, CCTV downtime, and attendance spikes. Furthermore, it automatically enforces regulatory constraints—blocking repeat inspector-institute pairings within 14 days and preventing same-district conflict of interest."*
5. **Action:** Click **"Generate AI Assignment"**. Point out the calculated risk score (e.g. `84.5% Risk`), factors list, and sealed inspector assignment card.

---

### Scene 2: Inspector Mobile Capture & Geofence Spoof Rejection (0:30 - 1:15)
1. **Open Browser Window 2 (Mobile View, 375px width):** Navigate to `http://localhost:5000/login` and log in as **PMU Inspector** (`PMU_INSPECTOR`).
2. **Action:** Open an active assignment and navigate to the **Live Evidence Capture** section.
3. **Presenter Explanation:** 
   > *"To prevent proxy inspections and photo uploads from gallery storage, Securesight enforces live camera capture coupled with a single-use 120-second cryptographic server nonce."*
4. **Action (Spoof Test):** Toggle on **"Simulate Geofence Spoof"** (or report location outside 500m) and click **"Capture & Submit Evidence"**.
5. **Presenter Explanation:** 
   > *"Notice the immediate red toast rejection: 'Server Rejection: Reported location is outside institute geofence (642m > 500m)'. The server recomputes Haversine distance independently and logs an anomaly automatically."*
6. **Action (Valid Capture):** Toggle off spoofing, grant camera access (or click the clearly-labelled **"1-Click Sample Capture [SIMULATED]"** button), and submit. Show the green acceptance checkmark and generated evidence hash.

---

### Scene 3: SHA-256 Audit Ledger & Chain Tamper Detection (1:15 - 1:45)
1. **Switch back to Browser Window 1 (Department Admin):** Navigate to the **Audit Ledger / Evidence Integrity** tab.
2. **Action:** Click the **"Verify Chain"** button.
3. **Presenter Explanation:** 
   > *"Every system event—inspection submission, geofence failure, VC call, or CCTV drop—is appended to an immutable SHA-256 hash chain where `entryHash = SHA256(prevHash + payload + timestamp)`. Clicking 'Verify Chain' recomputes all hashes sequentially from the genesis block."*
4. **Result:** Display green status badge: **`✓ Hash Chain Intact (N Entries Verified)`**.
5. **Action (Tamper Demo):** Click **"Simulate Ledger Tampering"**.
6. **Action:** Click **"Verify Chain"** again.
7. **Presenter Explanation:** 
   > *"If an attacker or malicious database admin modifies a historic record, our chain verification instantly flags the precise index: 'Broken at Entry #3 (Event ID: EVT-...)'. Credibility is mathematically guaranteed."*

---

### Scene 4: Random Video Call & Live CCTV Outage Alert (1:45 - 2:15)
1. **In Department Admin Command Centre Header:** Click **"Trigger Random VC"**.
2. **Presenter Explanation:** 
   > *"To ensure unannounced visual verification, administrators can trigger a random Video Call. The server selects an institute at random and opens an instant WebRTC room."*
3. **Observe Window 2 (Inspector / Institute Admin):** An incoming call modal pops up via Server-Sent Events (SSE) with a 30-second countdown timer. Click **"Join Call"** on both sides to demonstrate the live WebRTC stream.
4. **Navigate to CCTV Monitoring Grid (`CctvView`):**
5. **Presenter Explanation:** 
   > *"Our CCTV grid streams live HLS video feeds from registered institutes. An automated watchdog monitors frame progress."*
6. **Action:** On any feed, click **"Simulate Outage"**.
7. **Result:** The player immediately flags `OFFLINE / FROZEN`, pushes a real-time critical alert across all active dashboard sessions without page refresh, and records a `CCTV_FEED_DISRUPTED` audit log entry.

---

### Scene 5: State Authority Dashboard & Scoping Enforcement (2:15 - 3:00)
1. **Open Browser Window 3:** Log in as **State Authority** (`STATE_AUTHORITY`, assigned to state `"MH"`).
2. **Presenter Explanation:** 
   > *"State and District Officials require high-level regional oversight without exposing cross-state data."*
3. **Observe:** The dashboard displays regional inspections, CCTV status, and compliance scores strictly for Maharashtra (`MH`).
4. **Action:** Click **"Test Cross-State Fetch Protection (Fetch 'DL')"**.
5. **Result:** An error toast appears: **`HTTP 403 FORBIDDEN: Access denied for state scope DL`**.
6. **Presenter Explanation:** 
   > *"Jurisdiction protection is enforced at the server level in tRPC procedures, preventing parameter tampering even if a client attempts to craft manual API requests."*
7. **Closing Summary:** 
   > *"Securesight DoSJE Nigrani 2.0 Grid delivers a mobile-first, installable PWA with tamper-evident audit trails, real-time WebRTC/SSE monitoring, and zero unverified claims."*
