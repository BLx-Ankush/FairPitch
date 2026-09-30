# FairPitch — Judging You Can Audit

> **An auditable, mathematically rigorous, and cryptographically verifiable hackathon judging system with AI Loss Autopsy diagnostics.**

FairPitch eliminates "black box" hackathon judging by providing transparent score normalization, statistical judge bias telemetry, a client-side SHA-256 cryptographic audit chain, and automated loss autopsies explaining precisely why marks were deducted.

---

## Key Capabilities

### 1. Dual Mode System
* **Demo Mode:** Interactive showcase populated with 5 realistic student teams, 3 judges, 5 criteria, and 75 evaluations. Includes a pre-calibrated outlier scenario where excluding an anomalous judge flips the tournament winner from *NeuroGait* to *MediSync*. Includes a header caption (*"All data is simulated"*).
* **Live Mode:** Production-ready interface for actual events. Organizers can register custom teams, onboard judges, and configure dynamic evaluation criteria with real-time weight validation ($\sum w_i = 100\%$).

### 2. Statistical Fairness Engine
* **Judge Leniency Metric ($z$-score):** Detects harsh or lenient judges by standardizing their scoring distributions against the panel average.
* **Judge Drift Analysis (Pearson Correlation $r$):** Detects judging fatigue or drift across sequential evaluation orders.
* **Team Agreement Spread ($\sigma$):** Computes per-team standard deviation across judges to flag controversial pitches.
* **Sensitivity Reranking:** Simulates leaderboards with outlier judges excluded to protect participant integrity.

### 3. Cryptographic Audit Chain (SHA-256)
* Every submitted evaluation is hashed into a sequential cryptographic ledger block:
  $$\text{Block Hash} = \text{SHA-256}(\text{Index} \parallel \text{Timestamp} \parallel \text{ScoreData} \parallel \text{PrevHash})$$
* **Tamper Simulation & Detection:** Test database tampering with a single click and run instant cryptographic verification to catch broken chains and identify the exact modified block.
* **One-Click Ledger Recovery:** Restore authentic data directly from the verified ledger.

### 4. AI Loss Autopsy (Powered by Google Gemini 2.5 Flash)
* Provides losing teams with an actionable, auditable breakdown of their performance against the winner.
* **Detailed Rubric Deductions:** Explains specifically *why marks were cut* for each criterion, citing individual judge comments and scores.
* **Benchmark Winner Comparison:** Highlights what the winning project demonstrated in each dimension.
* **Actionable Fixes:** Ends with 3 concrete, high-leverage engineering and product improvements.
* **Resilient Fallback:** Includes deterministic rule-based analysis if an API key is not configured.

---

## Tech Stack

* **Framework:** [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
* **Frontend:** React 19, TypeScript
* **Styling:** Tailwind CSS
* **Data Visualization:** [Recharts](https://recharts.org/)
* **Cryptography:** Native browser Web Crypto API (`crypto.subtle.digest`)
* **AI Diagnostic:** Google GenAI SDK (`@google/genai` — Gemini 2.5 Flash)
* **Icons:** Lucide React
* **Persistence:** Client-side `localStorage` (zero backend database, zero login required

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── autopsy/
│   │       └── route.ts          # Gemini AI API route with in-memory caching
│   ├── layout.tsx                # Root layout with Inter font & metadata
│   ├── page.tsx                  # Main orchestration page & notifications
│   └── globals.css               # Styling & Tailwind setup
├── components/
│   ├── Header.tsx                # Mode switch segmented control & ledger badge
│   ├── Sidebar.tsx               # Navigation, rubric overview, & reset
│   ├── EventSetupPage.tsx        # Live event setup (Teams, Judges, Criteria)
│   ├── JudgeScoringPage.tsx      # Real-time scoring sliders & judge inputs
│   ├── OrganizerDashboardPage.tsx# Live leaderboard & fairness telemetry
│   ├── TeamReportPage.tsx        # Benchmark charts & AI Loss Autopsy
│   ├── AuditLogPage.tsx          # SHA-256 cryptographic chain inspection
│   └── MarkdownView.tsx          # GitHub-flavored markdown renderer
└── lib/
    ├── data.ts                   # Core types, seeds, & localStorage helpers
    ├── scoring.ts                # Leaderboard, weighted totals, & gap formulas
    ├── fairness.ts               # z-score leniency, Pearson r, & reranking
    ├── audit.ts                  # Web Crypto SHA-256 chain builder & verification
    ├── autopsy.ts                # Gemini diagnostic prompt & fallback engine
    └── useFairPitch.ts           # State management hook for Demo & Live modes
```

---

## Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) v18+ or v20+
* npm or pnpm

### 1. Clone Repository
```bash
git clone https://github.com/BLx-Ankush/FairPitch.git
cd FairPitch
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment (Optional for AI Autopsy)
Copy `.env.example` to `.env.local` and add your Google Gemini API key:
```bash
cp .env.example .env.local
```
Add your key inside `.env.local`:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```
*(Note: If no API key is set, FairPitch automatically uses its built-in rule-based autopsy diagnostic engine).*

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Production Build
```bash
npm run build
npm start
```

---

## Architecture & Math Documentation

For full mathematical formulas, scoring proofs, fairness statistical calculations, and cryptographic specifications, see [Technical approach.md](./Technical%20approach.md).

---

## License

MIT License. Built for hackathon integrity and transparent evaluations.
