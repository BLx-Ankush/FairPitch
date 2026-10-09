# FairPitch Database Architecture & Production Deployment Guide

> **A technical verification reference for the multi-tenant PostgreSQL schema, Row-Level Security (RLS) policies, server-authoritative cryptographic audit triggers, and production environment contracts.**

---

## 1. Database Schema & Migrations Inventory

The FairPitch persistence layer is built on PostgreSQL with Row-Level Security (RLS) and server-authoritative triggers. All schema definitions reside in `supabase/migrations/` and apply sequentially:

| Migration File | Primary Responsibility | Key Tables & Triggers |
| :--- | :--- | :--- |
| **`20261001000001_tables_and_indexes.sql`** | Core relational architecture (24 public tables) | `institutions`, `profiles`, `events`, `rubric_criteria`, `teams`, `team_members`, `submissions`, `judge_assignments`, `conflicts`, `edit_requests`, `scores`, `audit_log`, `fairness_reports`, `autopsies`, `review_requests`, `payments` |
| **`20261001000002_helper_functions.sql`** | Atomic transactional RPCs & data hygiene | `submit_scores` (atomic score submission), balanced assignment matrix generator, PII masking |
| **`20261001000003_audit_chain_and_triggers.sql`** | Immutability triggers & SHA-256 ledger | `trg_block_score_mutations` (blocks UPDATE/DELETE on scores), `trg_block_audit_log_mutations`, `append_score_audit_block` (advisory-locked per-judge sequential SHA-256 chain), Merkle tree root generator with odd-leaf parity rule |
| **`20261001000004_rls_policies.sql`** | Row-Level Security & Role boundary enforcement | RLS enabled on all 24 tables; zero client write policies on `scores` (writes strictly through `submit_scores` RPC); judges isolated to assigned squads; scores hidden from organizers until `review` or `published` event states |
| **`20261001000005_progress_view_and_jobs.sql`** | Real-time views & background job queue | `v_latest_scores` (resolves Version 2 append-only edits), `v_evaluation_progress`, asynchronous job queue |
| **`20261001000006_upi_dynamic_qr_and_registrations.sql`** | P2P direct UPI payments & squad join codes | 12-digit UTR bank matching, direct merchant UPI VPA allocation, team join codes |

---

## 2. Server-Authoritative Cryptographic Ledger Mechanics

Unlike client-side prototypes where timestamps or hashes can be fabricated in the browser, FairPitch's audit ledger executes entirely within PostgreSQL:

```
  Judge Browser
       │
       ▼ HTTPS POST /api/jury/evaluate
  Next.js Server Guard (Session + Role Verification)
       │
       ▼ RPC: public.submit_scores(...)
  PostgreSQL Atomic Transaction
       ├── 1. Verify Event is in 'judging' status
       ├── 2. Verify Evaluator is assigned & has zero declared conflicts
       ├── 3. Verify Rubric criteria IDs match and scores are within [0, max_score]
       ├── 4. Insert into public.scores (Version 1)
       │      │
       │      ▼ Trigger: append_score_audit_block()
       │        ├── Acquire pg_advisory_xact_lock(event_id : judge_id)
       │        ├── Select latest block_index & current_hash for this judge
       │        ├── Compute sequential block_index = prev_index + 1
       │        ├── Compute SHA-256 = Digest(prev_hash || index || payload || timestamp)
       │        └── Insert into public.audit_log
       │
       └── 5. Mark judge_assignment as completed
  Commit Transaction
```

### Guarantees Enforced:
1. **Append-Only Immutability:** Any direct `UPDATE` or `DELETE` query on `public.scores` or `public.audit_log` raises a PostgreSQL exception (`trg_block_score_mutations`).
2. **Post-Submission Revisions (Version 2):** When an organizer approves a score correction request, the corrected score is inserted as `version = 2` with an audit block. The database view `v_latest_scores` automatically surfaces the newest version while preserving historical marks permanently.
3. **Tamper Detection:** Modifying any historical block breaks all subsequent block hashes. The built-in verification function `verify_judge_chain(event_id, judge_id)` verifies mathematical parity from the `GENESIS` block to the chain head.

---

## 3. Row-Level Security (RLS) Isolation Rules

FairPitch enforces enterprise multi-tenant isolation across all 4 roles:

* **Platform Owner:** Global read/write access across all institutions and events.
* **Institution Admin:** Restricted to managing organizers, events, and billing within their own `institution_id`.
* **Organizers:** Can configure rubrics and review teams. Cannot view individual judge marks during the live scoring stage (`status = 'judging'`) to eliminate organizer bias. Scores are unlocked only once the event transitions to `review`.
* **Jury (Evaluators):** Can only `SELECT` assigned squads and `INSERT` evaluations through the `submit_scores` RPC. Cannot read other evaluators' marks or unassigned squads.
* **Participants (Teams):** Can view their own team roster, submission status, and project details. Loss Autopsies and leaderboard marks are unlocked only after event publication (`status = 'published'`).

---

## 4. Local Test Harness (Zero-Cloud Verification)

You can verify the complete database migration suite, RLS policies, and load test locally without needing a live cloud database. FairPitch includes an in-memory PostgreSQL test harness powered by `@electric-sql/pglite` and `pgcrypto`:

```bash
# Run complete database harness (migrations, pgTAP security tests, seed data, and 100-judge load test)
node scripts/run-all-tests.js

# Run individual functional verification test suites
node scripts/test-task-a-security.js       # Signed cookie session guards
node scripts/test-module-3-lifecycle.js      # 100% rubric freeze & lifecycle transitions
node scripts/test-module-4-scoring.js        # submit_scores RPC & SHA-256 chains
node scripts/test-module-5-fairness.js       # Z-score leniency & Pearson drift
node scripts/test-module-6-autopsy.js        # Gemini loss autopsies & RLS disclosure
node scripts/test-module-7-production.js     # Merkle trees, public verification, & webhooks
```

---

## 5. Production Deployment Instructions

### Step 1: Provision a Supabase Project
1. Create a project at [supabase.com](https://supabase.com).
2. Under **Project Settings -> API**, obtain:
   * **Project URL:** `https://your-project-id.supabase.co`
   * **anon / public key:** `eyJhbGciOi...`
   * **service_role key:** `eyJhbGciOi...`

### Step 2: Apply Database Migrations
Option A — Via Supabase CLI:
```bash
npx supabase login
npx supabase link --project-ref your-project-id
npx supabase db push
```

Option B — Via Supabase SQL Editor:
Execute the files in `supabase/migrations/` sequentially (01 through 06) in your Supabase dashboard SQL editor. Optionally run `supabase/seed.sql` to populate sample benchmark events and teams.

### Step 3: Configure Production Environment Variables
Set the following environment variables in your production environment (e.g., Vercel, AWS Amplify, or Docker):

```env
# 1. Supabase Infrastructure (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# 2. AI Loss Autopsy Engine (Required for Live Gemini)
GEMINI_API_KEY=your_actual_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash

# 3. Canonical Domain
NEXT_PUBLIC_APP_URL=https://fairpitch.app

# 4. Strict Production Security
NEXT_PUBLIC_DEMO_MODE=false
DEMO_COOKIE_SECRET=replace_with_a_secure_random_32_character_secret

# 5. Optional Integrations
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM="FairPitch <audits@fairpitch.io>"
```

### Step 4: Verify Deployment
1. Navigate to `https://your-domain.com/verify` to confirm the public cryptographic ledger is online.
2. Sign in as Organizer at `https://your-domain.com/auth?role=organizer`.
3. Create an event, define rubrics, and activate double-blind evaluation.
