# FairPitch — Verifiable Judging Infrastructure

> **Humans make the decision. FairPitch makes the decision auditable.**
>
> An enterprise-grade, statistically informed, and cryptographically verifiable evaluation platform for hackathons, incubators, universities, and technical competitions.

---

## Overview

Hackathon and competition outcomes routinely hinge on subjective human judgment. Traditional evaluation dashboards operate as opaque black boxes — offering zero visibility into evaluator leniency/harshness, fatigue drift, inter-judge disagreement, or mathematical loss attribution.

**FairPitch transforms competitive evaluation into a verifiable engineering pipeline:**
1. **Humans Judge:** Vetted evaluators score projects using strictly enforced, normalized rubrics.
2. **FairPitch Audits:** Every score is statistically inspected for bias, normalized against pre-event calibration baselines, and committed to an append-only SHA-256 cryptographic ledger.
3. **AI Explains:** Google Gemini 2.5 Flash delivers zero-hallucination **Loss Autopsies**, explaining to participant squads precisely why marks were deducted and breaking down inter-judge consensus.

```
                         FAIRPITCH ARCHITECTURE
  ┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
  │   EVALUATION    │    │  FAIRNESS ENGINE │    │    AI AUTOPSY    │
  │ • Double-Blind  │───▶│ • Pre-Calib Zero │───▶│ • Gemini 2.5 Fl. │
  │ • Rubric Freeze │    │ • Z-Score Bias   │    │ • Disagreement   │
  │ • Anti-Fatigue  │    │ • Fatigue Drift  │    │ • Remediation    │
  └────────┬────────┘    └────────┬─────────┘    └──────────────────┘
           │                      │
           ▼                      ▼
  ┌─────────────────────────────────────────┐
  │   SERVER-AUTHORITATIVE SHA-256 LEDGER   │
  │   PostgreSQL Atomic Block Commits       │
  │   Public Verification URL (/verify)     │
  └─────────────────────────────────────────┘
```

---

## Core Pillars & Differentiators

### 1. Pre-Event Judge Calibration (Proactive Bias Prevention)
Traditional systems only discover bias after prizes have been awarded. FairPitch shifts the paradigm from *post-hoc detection* to **proactive prevention**:
* Before evaluating live teams, judges evaluate 3 standardized, anonymized benchmark submissions (`CALIB-PROJECT-ALPHA`, `BETA`, `GAMMA`).
* FairPitch calculates the evaluator's baseline mean, deviation against panel consensus ($\Delta$), standardized $z$-score, and rank-order correlation.
* Evaluators exhibiting systematic harshness ($z < -1.0$) or leniency ($z > +1.0$) are flagged, allowing organizers to apply automatic calibration offsets to normalize score distributions.

### 2. Strict Double-Blind Evaluation Mode
To eliminate university pedigree bias, friend-network favoritism, and track reputation bias:
* The evaluator interface masks all institutional affiliations, college names, and team identities as **`PROJECT #CODE`** (e.g., `PROJECT #A17`).
* Evaluators review solely: Problem Statement, Solution Architecture, Live Demo, Repository Evidence, and Technical Milestones.
* Once the evaluator submits and locks their score, the block is sealed on the cryptographic ledger and identity is safely unmasked.

### 3. Server-Authoritative Cryptographic Audit Ledger (SHA-256)
* Every committed evaluation atomically generates an immutable ledger block:
  $$\text{Block Hash} = \text{SHA-256}(\text{Index} \parallel \text{Timestamp} \parallel \text{ScorePayload} \parallel \text{PrevHash})$$
* **Server-Authoritative:** Timestamps, sequence order, and previous block hashes are enforced by server-side PostgreSQL transactions, preventing client-side spoofing.
* **Tamper Evident:** Modifying any historical score immediately invalidates all subsequent block hashes across the entire chain.
* **Public Verification Portal (`/verify`):** Anyone (participants, sponsors, public) can verify the competition ledger's cryptographic integrity without requiring login.

### 4. Executive Fairness Health Index (0–100)
A real-time diagnostic gauge summarizing panel integrity across 5 core dimensions:
* **Judge Consistency (25%):** Penalizes significant standard deviation outliers ($|z| > 1.5$).
* **Inter-Judge Agreement (25%):** Quantifies inter-rater consensus spread ($\sigma$).
* **Distribution Normality (20%):** Validates healthy score dispersion without extreme clustering.
* **Blind Judging Integrity (15%):** Confirms institutional masking controls are active.
* **Ledger Validity (15%):** 100% when sequential SHA-256 chain is unbroken; 0% upon any detected anomaly.

### 5. AI Loss Autopsy with Inter-Judge Consensus (Google Gemini 2.5 Flash)
Participants don't just see a rank — they understand why:
* **Head-to-Head Gap Analysis:** Mathematical deficit attribution comparing the squad's marks against the 1st-place benchmark across each weighted criterion.
* **Inter-Judge Consensus Meter:** Displays panel agreement percentage (e.g., *81% Consensus: HIGH*).
* **High Disagreement Breakdown ($\sigma \ge 1.4$):** Highlights criteria where judges diverged, displaying individual evaluator marks (e.g., Judge A: 9.0 vs Judge B: 5.5) and AI synthesis explaining the qualitative tension (novelty vs framework dependency).
* **Actionable Remediation Triad:** Exactly 3 concrete, high-leverage engineering and product improvements tailored directly to overcoming the panel's critique.

---

## Role-Based Architecture & Portals

FairPitch provides tailored workspaces with strict Row-Level Security (RLS) and server session guards:

| Portal | Route | Primary Capabilities |
| :--- | :--- | :--- |
| **Platform Owner** | `/admin` | Institution provisioning, enterprise approval, global ledger telemetry |
| **Institution Admin** | `/institution` | Organizer management, student domain vetting, fee routing rules |
| **Organizer Desk** | `/org` | Event creation, dynamic rubric weighting ($\sum w_i = 100\%$), balanced jury assignment matrices, Fairness Health index, direct UPI UTR auditing, append-only score edit approvals |
| **Jury Desk** | `/jury` | Pre-event calibration, randomized anti-fatigue evaluation queue, double-blind scoring desk, conflict-of-interest declarations, personal SHA-256 hash chains |
| **Team Portal** | `/team` | Squad registration, join codes, direct UPI verification, project submission desk, Gemini Loss Autopsy, dispute ticket desk |
| **Public Verifier** | `/verify` | Zero-login cryptographic ledger verification, tamper detection engine |

---

## Technical Stack

* **Frontend:** [Next.js 16](https://nextjs.org/) (App Router, Turbopack), React 19, TypeScript
* **Styling & UI:** Tailwind CSS, Lucide Icons, Glassmorphic Design System
* **Data Visualization:** [Recharts](https://recharts.org/)
* **Backend Database:** Multi-tenant [PostgreSQL](https://www.postgresql.org/) via [Supabase](https://supabase.com/)
* **Security & Auth:** Row-Level Security (RLS), Signed HttpOnly Session Tokens, Strict Route Middleware
* **Cryptography:** Server-Authoritative Web Crypto SHA-256 Ledger
* **AI Diagnostics:** Google GenAI SDK (`@google/genai` — Gemini 2.5 Flash) with deterministic rule-based fallback
* **Payments:** Direct P2P UPI verification via 12-digit bank UTR matching (0% platform intermediary fee)

---

## Project Structure

```
src/
├── app/
│   ├── admin/                    # Platform Owner workspace
│   ├── institution/              # Institution Admin workspace
│   ├── org/                      # Organizer competition director desk
│   ├── jury/                     # Jury evaluation portal & calibration desk
│   │   └── evaluate/[teamId]/    # Strict double-blind evaluation desk
│   ├── team/                     # Participant team workspace
│   │   └── [teamId]/autopsy/     # Gemini Loss Autopsy with consensus analysis
│   ├── verify/                   # Public zero-login cryptographic verification
│   ├── api/                      # Enterprise REST API routes & server guards
│   │   ├── auth/                 # Multi-role authentication & session handling
│   │   ├── events/               # Lifecycle, rubrics, & autopsies
│   │   ├── jury/                 # Scoring, calibration, conflicts, & edit requests
│   │   └── ledger/               # Cryptographic SHA-256 ledger endpoints
│   └── globals.css               # Design tokens & modern aesthetic styling
├── lib/
│   ├── auth/                     # Session cookies, RBAC permissions, & guards
│   ├── autopsy/                  # Head-to-head math attribution & Gemini engine
│   ├── events/                   # Lifecycle states & 100% rubric freeze presets
│   ├── fairness/                 # Calibration engine & 0-100 Fairness Health metric
│   ├── jury/                     # Balanced randomized assignment matrices
│   ├── ledger/                   # SHA-256 chain construction & tamper verification
│   └── supabase/                 # Authenticated SSR & service-role database clients
└── proxy.ts                      # Strict edge routing & role boundary enforcement
```

---

## Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/BLx-Ankush/FairPitch.git
cd FairPitch
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env.local` and configure your credentials:
```bash
cp .env.example .env.local
```

The configuration contract is split cleanly between production deployments and local testing:

```env
# Production Supabase Infrastructure (Required for live deployment)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Google Gemini AI Loss Autopsy
GEMINI_API_KEY=your_google_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash

# Canonical URL
NEXT_PUBLIC_APP_URL=https://fairpitch.app

# Production Security Mode (Disable demo mode in production!)
NEXT_PUBLIC_DEMO_MODE=false
DEMO_COOKIE_SECRET=your_32_character_hmac_secret_for_local_signing
```

*(Note: If `GEMINI_API_KEY` is omitted, FairPitch automatically activates its deterministic mathematical fallback autopsy generator).*

### 3. Database Migrations & Automated Test Harness
FairPitch includes 6 production PostgreSQL migrations in `supabase/migrations/` and an automated offline test harness using PGlite and `pgcrypto`. You can verify all 24 tables, RLS policies, append-only triggers, and the 100-judge concurrent load test locally:

```bash
# Run complete database harness & pgTAP security tests
node scripts/run-all-tests.js
```

For complete database schema specifications, Row-Level Security rules, and production deployment instructions, see [docs/DATABASE_AND_DEPLOYMENT.md](./docs/DATABASE_AND_DEPLOYMENT.md).

### 4. Run Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Production Build & Verification
```bash
npm run build
npm start
```

---

## License

MIT License. Designed and engineered for hackathon integrity, statistical fairness, and verifiable evaluations.
