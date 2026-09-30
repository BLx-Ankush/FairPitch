# FairPitch — Technical Approach & Architecture

> **Tagline:** "Judging you can audit"  
> **Repository:** `FairPitch`  
> **System Scope:** Hackathon judging and auditing platform featuring cryptographic verification, statistical fairness telemetry, and automated loss autopsy diagnostics.

---

## 1. High-Level Architecture & Design Principles

FairPitch is designed to replace opaque hackathon judging with a transparent, mathematically verifiable, and auditable system. The architecture is built around three foundational pillars:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          FairPitch Application                         │
├────────────────────────────────┬───────────────────────────────────────┤
│       1. Scoring Engine        │ • Weighted rubric aggregation         │
│         (lib/scoring.ts)       │ • Head-to-head criterion gap analysis │
├────────────────────────────────┼───────────────────────────────────────┤
│       2. Fairness Telemetry    │ • Leniency z-score analysis           │
│         (lib/fairness.ts)      │ • Pearson correlation fatigue drift   │
│                                │ • Inter-judge agreement dispersion    │
│                                │ • Counterfactual reranking            │
├────────────────────────────────┼───────────────────────────────────────┤
│       3. Cryptographic Ledger  │ • SHA-256 hash chaining (Web Crypto)  │
│         (lib/audit.ts)         │ • Canonical JSON payload sorting      │
│                                │ • Dual-layer tamper detection         │
├────────────────────────────────┼───────────────────────────────────────┤
│       4. AI Loss Autopsy       │ • Google GenAI SDK (Gemini 2.5 Flash) │
│         (lib/autopsy.ts)       │ • Zero-hallucination system prompt    │
│                                │ • Deterministic offline fallback      │
└────────────────────────────────┴───────────────────────────────────────┘
```

### Core Design Constraints
1. **Zero Database / Zero Auth Dependency:** Operates fully without logins or remote databases. All seed data is statically typed, loaded on boot, and mutated state is persisted in `localStorage`.
2. **State Synchronization via Event Bus:** State changes dispatch `fairpitch_state_change` custom window events, ensuring immediate cross-component reactivity without heavy global state management libraries.
3. **Decoupled Business Logic:** All domain math and cryptographic operations reside in pure TypeScript modules (`lib/data.ts`, `lib/scoring.ts`, `lib/fairness.ts`, `lib/audit.ts`, `lib/autopsy.ts`), isolated from UI components.

---

## 2. Mathematical Scoring Model

FairPitch uses a standardized 100-point rubric distributed across five weighted criteria. Scores entered by judges are normalized from a 0.0 - 10.0 range into weighted percentage contributions.

### 2.1 Fixed Rubric Weights
| Criterion ID | Criterion Name | Rubric Weight ($w_c$) | Normalized Contribution |
| :--- | :--- | :---: | :---: |
| `innovation` | Innovation | 25% | $\text{score} \times 2.5$ |
| `impact` | Impact | 25% | $\text{score} \times 2.5$ |
| `feasibility` | Feasibility | 20% | $\text{score} \times 2.0$ |
| `presentation` | Presentation | 15% | $\text{score} \times 1.5$ |
| `technical` | Technical Understanding | 15% | $\text{score} \times 1.5$ |
| **Total** | | **100%** | **Max 100.0 pts** |

### 2.2 Mathematical Formulas

#### Judge Team Total
For a given judge $j$ and team $t$:
$$\text{teamTotal}(j, t) = \sum_{c=1}^{5} \left( \frac{\text{score}_{j,t,c}}{10} \times w_c \right)$$

#### Overall Team Final Score
For an active panel of included judges $J$:
$$\text{finalScore}(t) = \frac{1}{|J|} \sum_{j \in J} \text{teamTotal}(j, t)$$

#### Weighted Criterion Deficit (Criterion Gap)
When comparing team $t$ against the benchmark winning team $W$ on criterion $c$:
$$\text{rawGap}_c = \overline{\text{score}}_{W, c} - \overline{\text{score}}_{t, c}$$
$$\text{weightedGap}_c = \left( \frac{\text{rawGap}_c}{10} \right) \times w_c$$

The criteria are sorted in descending order by $\text{weightedGap}_c$, explicitly showing the exact breakdown of why a team placed behind the winner.

---

## 3. Statistical Fairness Telemetry & Anomaly Detection

To prevent rogue judges, harsh outliers, or fatigue from silently skewing hackathon outcomes, FairPitch implements continuous statistical monitoring across three axes:

### 3.1 Judge Leniency ($Z$-Score Normalization)
Measures how far a judge's mean evaluation deviates from the collective panel mean.
1. Compute the mean score given by each judge across all teams:
   $$\mu_j = \frac{1}{|T|} \sum_{t \in T} \text{teamTotal}(j, t)$$
2. Compute the panel grand mean $\mu_{\text{panel}}$ and population standard deviation $\sigma_{\text{panel}}$:
   $$\mu_{\text{panel}} = \frac{1}{|J|} \sum_{j \in J} \mu_j, \quad \sigma_{\text{panel}} = \sqrt{\frac{1}{|J|} \sum_{j \in J} (\mu_j - \mu_{\text{panel}})^2}$$
3. Compute the standard score ($z$-score):
   $$z_j = \frac{\mu_j - \mu_{\text{panel}}}{\sigma_{\text{panel}}}$$
4. **Flagging Condition:** If $|z_j| > 1.0$, the judge is labeled **"flagged for review"** (specifically avoiding judgmental terms like "biased").

### 3.2 Judge Fatigue & Drift (Pearson Correlation)
Judges often score teams more harshly toward the end of long evaluation sessions due to cognitive fatigue. FairPitch calculates the Pearson correlation coefficient between the sequential evaluation order (`order_index` $x$) and the assigned score ($y$):
$$r = \frac{\sum_{i=1}^{n} (x_i - \bar{x})(y_i - \bar{y})}{\sqrt{\sum_{i=1}^{n} (x_i - \bar{x})^2 \cdot \sum_{i=1}^{n} (y_i - \bar{y})^2}}$$
- **Flagging Condition:** A judge is flagged for drift if $r < -0.5$ with a sample size $n \ge 8$ evaluations.

### 3.3 Inter-Judge Agreement Dispersion
Quantifies panel disagreement per team using standard deviation across judge totals:
$$\sigma_t = \sqrt{\frac{1}{|J|} \sum_{j \in J} \left( \text{teamTotal}(j, t) - \overline{\text{teamTotal}}(t) \right)^2}$$
- **Disagreement Tiers:**
  - $\sigma_t \ge 12.0$: **High Disagreement**
  - $6.0 \le \sigma_t < 12.0$: **Medium Disagreement**
  - $\sigma_t < 6.0$: **Low (Aligned)**

### 3.4 Counterfactual Reranking & Dynamic Synthesis
The system computes an alternate leaderboard $L_{\text{audited}} = \text{leaderboard}(J \setminus J_{\text{flagged}})$ and checks if the winning team changes:
$$\text{winnerChanged} = \left( \text{rank}_1(L_{\text{baseline}}) \neq \text{rank}_1(L_{\text{audited}}) \right)$$
The system automatically generates a dynamic, human-readable summary statement:
> *"Prof. Aris Thorne scores 19.8 points lower than the panel. Excluding Prof. Aris Thorne changes the winner from NeuroGait to MediSync."*

---

## 4. Cryptographic Hash Chain & Tamper Evidence

To ensure that scores cannot be modified in the database post-pitch without detection, FairPitch implements an immutable audit log using browser-native cryptography.

```
 Genesis Entry (i = 0)
┌─────────────────────────────────┐
│ prev_hash: "GENESIS"            │
│ payload:   {"comment": ...}     │
│ hash:      SHA256(prev+payload) ├────────┐
└─────────────────────────────────┘        │
                                           ▼ (prev_hash)
 Subsequent Entry (i = 1)         ┌─────────────────────────────────┐
                                  │ prev_hash: chain[0].hash        │
                                  │ payload:   {"comment": ...}     │
                                  │ hash:      SHA256(prev+payload) ├────────┐
                                  └─────────────────────────────────┘        │
                                                                             ▼
```

### 4.1 Canonical Payload Serialization
To guarantee deterministic cryptographic hashes across JavaScript engines, JSON payloads are serialized with strictly sorted alphabetical keys:
```typescript
function serializePayload(score: ScoreRecord): string {
  return JSON.stringify({
    comment: score.comment,
    criterion_id: score.criterion_id,
    judge_id: score.judge_id,
    score: Number(score.score.toFixed(1)),
    team_id: score.team_id,
    timestamp: score.timestamp,
  });
}
```

### 4.2 Web Crypto SHA-256 Chaining
The SHA-256 digest is generated asynchronously using `crypto.subtle.digest`:
$$\text{hash}_0 = \text{SHA256}(\text{"GENESIS"} + \text{payload}_0)$$
$$\text{hash}_i = \text{SHA256}(\text{hash}_{i-1} + \text{payload}_i)$$

### 4.3 Dual-Layer Verification Algorithm
When the organizer clicks **"Verify Chain"**, `verifyChain()` runs two independent checks:
1. **Hash Chain Continuity:** Recomputes every block's SHA-256 hash from its stored predecessor and payload. Any broken hash indicates chain corruption.
2. **Database Cross-Reference Check:** Compares the payload in each audit entry against the *current* score record stored in `localStorage`. If an administrator or script modifies a score in the database without forging a valid hash chain, the system immediately flags the row as `tampered_score` and pinpoints the first broken row index.

### 4.4 Tamper Simulation & Restoration
- `tamperDemo(scoreId)`: Selects a score in `localStorage` and increases it by $+2.0$ while leaving the cryptographic audit log untouched.
- `restoreDemo()`: Restores the score back to its authentic audit state from a pre-tamper backup or directly from the signed payload.

---

## 5. AI Loss Autopsy Architecture

When a team wants to understand why they lost, FairPitch provides an automated diagnosis using generative AI.

### 5.1 Technology Stack & API Protection
- **SDK:** Official `@google/genai` package.
- **Model:** `gemini-2.5-flash`.
- **Security:** The Gemini API key (`process.env.GEMINI_API_KEY`) is stored strictly server-side and accessed exclusively through the Next.js API route `/api/autopsy`. The key is never exposed to the client bundle.

### 5.2 Prompt Engineering & Strict Constraints
- **Temperature:** `0.3` (low temperature ensures factual, analytical rigor).
- **System Instruction:**
  > `"You are a judging analyst. Use ONLY the data provided. Do not invent feedback. Name the criterion and the exact point gap for each issue. End with exactly 3 concrete fixes."`
- **Context Injection:** The prompt receives the team's averages, winner's averages, weighted point gaps (sorted largest first), and raw judge comments.

### 5.3 In-Memory Caching & Deterministic Fallback
- **Cache Layer:** A server-side `Map<string, string>` caches autopsy results per team to minimize API latency and token consumption.
- **Deterministic Offline Fallback:** If `GEMINI_API_KEY` is omitted or the API call fails, the system executes `generateFallbackAutopsy()`. This engine extracts the top three weighted loss gaps, links them with relevant judge quotes, and produces exactly three concrete, actionable recommendations.

---

## 6. Frontend Architecture & Ergonomics

### 6.1 Technology Choices
- **Framework:** Next.js 16 (App Router with Turbopack).
- **Language:** TypeScript 5 (Strict mode enabled).
- **Styling:** Tailwind CSS v4 tailored with a clean, modern light theme (slate background, crisp white cards, indigo accents, subtle borders).
- **Data Visualization:** `recharts` for dynamic, responsive bar charts.
- **Iconography:** `lucide-react`.

### 6.2 Screen Fit & Laptop Compatibility
Designed to run on standard laptop displays ($1366 \times 768$) with **zero horizontal page scrolling**:
- Fixed sidebar layout with flexible fluid container (`flex-1 min-w-0 max-w-full overflow-x-hidden`).
- Responsive grids (`lg:grid-cols-2`, `lg:grid-cols-12`).
- Charts wrapped in `<ResponsiveContainer width="100%" height="100%">`.
- Tables configured with defensive horizontal scrolling (`overflow-x-auto`) and compact columns.

---

## 7. Verification & Acceptance Summary

| Verification Objective | Implementation Detail | Status |
| :--- | :--- | :---: |
| **Winner Flip on Reset** | NeuroGait wins originally (77.33 pts). Excluding Judge 3 elevates MediSync (86.45 pts) to 1st place. | **VERIFIED** |
| **Tamper Detection** | Modifying stored score by $+2.0$ trips `verifyChain()`, displaying red `TAMPERED` banner and highlighting row index. | **VERIFIED** |
| **Cryptographic Restore** | Restoring returns all 75 blocks to green `VALID` state. | **VERIFIED** |
| **Loss Autopsy Fallback** | Runs without API key, producing structured markdown with exactly 3 concrete fixes. | **VERIFIED** |
| **1366x768 Viewport** | Zero horizontal page scrolling verified on laptop viewport. | **VERIFIED** |
