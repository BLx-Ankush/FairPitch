-- FairPitch Complete Production Database Schema
-- Generated for one-click Supabase deployment



-- ================================================================
-- 20261001000001_tables_and_indexes.sql
-- ================================================================

-- Migration: 20261001000001_tables_and_indexes.sql
-- Description: Core 24 tables, constraints, foreign keys, and performance indexes for FairPitch.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure standard Supabase roles exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
END $$;

-- 1. institutions (tenant root)
CREATE TABLE IF NOT EXISTS public.institutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    domain TEXT,
    contact_email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('platform_owner', 'institution_admin', 'user')),
    organizer_approval_status TEXT NOT NULL DEFAULT 'none' CHECK (organizer_approval_status IN ('none', 'pending', 'approved', 'rejected')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. events
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    registration_deadline TIMESTAMPTZ,
    submission_deadline TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'judging', 'review', 'published')),
    blind_mode BOOLEAN NOT NULL DEFAULT false,
    min_judges_per_team INT NOT NULL DEFAULT 3,
    judging_mode TEXT NOT NULL DEFAULT 'rubric' CHECK (judging_mode IN ('rubric', 'pairwise')),
    anchored_merkle_root TEXT,
    anchored_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_events_institution_slug UNIQUE (institution_id, slug)
);

-- 4. invites
CREATE TABLE IF NOT EXISTS public.invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('organizer', 'jury')),
    token_hash TEXT NOT NULL UNIQUE,
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. event_roles
CREATE TABLE IF NOT EXISTS public.event_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'organizer', 'jury', 'participant')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_event_roles_user_event_role UNIQUE (user_id, event_id, role)
);

-- 6. rubric_criteria
CREATE TABLE IF NOT EXISTS public.rubric_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    weight NUMERIC NOT NULL CHECK (weight > 0 AND weight <= 100),
    max_score NUMERIC NOT NULL DEFAULT 10 CHECK (max_score > 0),
    score_bands JSONB NOT NULL DEFAULT '[]'::jsonb,
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. teams
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    team_code TEXT NOT NULL,
    tagline TEXT,
    track TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_teams_event_code UNIQUE (event_id, team_code)
);

-- 8. team_members
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('lead', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_team_members_team_user UNIQUE (team_id, user_id),
    CONSTRAINT uq_team_members_event_user UNIQUE (event_id, user_id)
);

-- 9. submissions
CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE UNIQUE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    repo_url TEXT,
    demo_url TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. judge_assignments
CREATE TABLE IF NOT EXISTS public.judge_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    judge_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    order_index INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'completed', 'excused')),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_judge_assignments_event_judge_team UNIQUE (event_id, judge_id, team_id)
);

-- 11. conflicts
CREATE TABLE IF NOT EXISTS public.conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    judge_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    declared_by UUID NOT NULL REFERENCES auth.users(id),
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_conflicts_event_judge_team UNIQUE (event_id, judge_id, team_id)
);

-- 12. edit_requests (defined before scores so scores can reference edit_request_id)
CREATE TABLE IF NOT EXISTS public.edit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    judge_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_changes JSONB NOT NULL DEFAULT '[]'::jsonb,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. scores (strictly append-only, NO is_latest column)
CREATE TABLE IF NOT EXISTS public.scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    judge_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    criterion_id UUID NOT NULL REFERENCES public.rubric_criteria(id) ON DELETE RESTRICT,
    score NUMERIC NOT NULL CHECK (score >= 0 AND score <= 10),
    comment TEXT NOT NULL CHECK (length(trim(comment)) > 0),
    version INT NOT NULL DEFAULT 1 CHECK (version >= 1),
    edit_request_id UUID REFERENCES public.edit_requests(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_scores_event_judge_team_criterion_version UNIQUE (event_id, judge_id, team_id, criterion_id, version)
);

-- 14. audit_log (SHA-256 chain blocks, per-judge + event-level)
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    judge_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    block_index BIGINT NOT NULL,
    prev_hash TEXT NOT NULL,
    current_hash TEXT NOT NULL,
    payload JSONB NOT NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. fairness_reports
CREATE TABLE IF NOT EXISTS public.fairness_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    flagged_judges JSONB NOT NULL DEFAULT '[]'::jsonb,
    sensitivity_rerank JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 16. autopsies
CREATE TABLE IF NOT EXISTS public.autopsies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    model_name TEXT NOT NULL,
    loss_gap_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    issues JSONB NOT NULL DEFAULT '[]'::jsonb,
    fixes JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw_markdown TEXT NOT NULL,
    verification_status TEXT NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('verified', 'regenerated', 'fallback')),
    CONSTRAINT uq_autopsies_event_team UNIQUE (event_id, team_id)
);

-- 17. review_requests
CREATE TABLE IF NOT EXISTS public.review_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved')),
    reason TEXT NOT NULL,
    resolution_notes TEXT,
    resolved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

-- 18. aliases (masking Judge A, Team 07)
CREATE TABLE IF NOT EXISTS public.aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('judge', 'team')),
    alias_label TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 19. consents
CREATE TABLE IF NOT EXISTS public.consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    consent_version TEXT NOT NULL,
    consent_text TEXT NOT NULL,
    ip_address TEXT,
    consented_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 20. notifications (queue for background email worker)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    recipient_email TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('invite', 'assignment', 'publish', 'review_update')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
    error_log TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ
);

-- 21. invoices (Rs 5/participant platform fee)
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    participant_count INT NOT NULL DEFAULT 0,
    rate_per_participant NUMERIC NOT NULL DEFAULT 5.00,
    total_amount NUMERIC NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid')),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 22. payments
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    gateway TEXT NOT NULL DEFAULT 'razorpay',
    gateway_order_id TEXT,
    gateway_payment_id TEXT,
    gateway_signature TEXT,
    amount NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'captured', 'failed', 'refunded')),
    payer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 23. pairwise_comparisons (reserved for future pairwise ranking mode)
CREATE TABLE IF NOT EXISTS public.pairwise_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    judge_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    team_a_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    team_b_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    winner_team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    confidence_score NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 24. jobs (heavy work background queue)
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT NOT NULL CHECK (job_type IN ('compute_fairness', 'generate_autopsies', 'export_results_pdf', 'compute_merkle_root', 'send_batch_emails')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    error TEXT,
    run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_at TIMESTAMPTZ,
    locked_by TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_events_institution ON public.events(institution_id, status);
CREATE INDEX IF NOT EXISTS idx_event_roles_user_event ON public.event_roles(user_id, event_id, role);
CREATE INDEX IF NOT EXISTS idx_teams_event ON public.teams(event_id, status);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_judge_assignments_event_judge ON public.judge_assignments(event_id, judge_id, status);
CREATE INDEX IF NOT EXISTS idx_judge_assignments_event_team ON public.judge_assignments(event_id, team_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_event_judge ON public.conflicts(event_id, judge_id);
CREATE INDEX IF NOT EXISTS idx_scores_lookup ON public.scores(event_id, judge_id, team_id, criterion_id, version);
CREATE INDEX IF NOT EXISTS idx_scores_event_team ON public.scores(event_id, team_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_chain_lookup ON public.audit_log(event_id, judge_id, block_index DESC);
CREATE INDEX IF NOT EXISTS idx_rubric_criteria_event ON public.rubric_criteria(event_id, order_index);
CREATE INDEX IF NOT EXISTS idx_jobs_queue ON public.jobs(status, run_at);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status, created_at);
CREATE INDEX IF NOT EXISTS idx_invites_lookup ON public.invites(token_hash, expires_at);


-- ================================================================
-- 20261001000002_helper_functions.sql
-- ================================================================

-- Migration: 20261001000002_helper_functions.sql
-- Description: Core security-definer helper functions for scoring, status transitions, approvals, and progress telemetry.

-- 1. submit_scores: Atomic transaction for jury evaluation submissions
CREATE OR REPLACE FUNCTION public.submit_scores(
    p_team_id UUID,
    p_criterion_scores JSONB
) RETURNS VOID AS $$
DECLARE
    v_judge_id UUID;
    v_event_id UUID;
    v_institution_id UUID;
    v_event_status TEXT;
    v_is_assigned BOOLEAN;
    v_has_conflict BOOLEAN;
    v_total_criteria INT;
    v_submitted_criteria INT;
    v_item JSONB;
    v_criterion_id UUID;
    v_score NUMERIC;
    v_comment TEXT;
    v_crit_exists BOOLEAN;
    v_max_score NUMERIC;
BEGIN
    v_judge_id := auth.uid();
    IF v_judge_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to submit scores';
    END IF;

    -- Derive event_id and institution_id directly from the team
    SELECT event_id, institution_id INTO v_event_id, v_institution_id
    FROM public.teams
    WHERE id = p_team_id;

    IF v_event_id IS NULL THEN
        RAISE EXCEPTION 'Target team does not exist: %', p_team_id;
    END IF;

    -- Verify event is in 'judging' phase
    SELECT status INTO v_event_status
    FROM public.events
    WHERE id = v_event_id;

    IF v_event_status IS NULL OR v_event_status != 'judging' THEN
        RAISE EXCEPTION 'Scores can only be submitted when event status is ''judging'' (current status: %)', COALESCE(v_event_status, 'unknown');
    END IF;

    -- Verify judge assignment
    SELECT EXISTS (
        SELECT 1 FROM public.judge_assignments
        WHERE event_id = v_event_id
          AND judge_id = v_judge_id
          AND team_id = p_team_id
          AND status = 'assigned'
    ) INTO v_is_assigned;

    IF NOT v_is_assigned THEN
        RAISE EXCEPTION 'Judge is not actively assigned to evaluate team %', p_team_id;
    END IF;

    -- Verify no declared conflict of interest
    SELECT EXISTS (
        SELECT 1 FROM public.conflicts
        WHERE event_id = v_event_id
          AND judge_id = v_judge_id
          AND team_id = p_team_id
    ) INTO v_has_conflict;

    IF v_has_conflict THEN
        RAISE EXCEPTION 'Cannot evaluate team: A conflict of interest was declared for this assignment';
    END IF;

    -- Verify all active rubric criteria for this event are evaluated
    SELECT COUNT(*) INTO v_total_criteria
    FROM public.rubric_criteria
    WHERE event_id = v_event_id;

    IF jsonb_typeof(p_criterion_scores) != 'array' THEN
        RAISE EXCEPTION 'p_criterion_scores must be a JSON array of evaluations';
    END IF;

    v_submitted_criteria := jsonb_array_length(p_criterion_scores);
    IF v_submitted_criteria != v_total_criteria THEN
        RAISE EXCEPTION 'Evaluation incomplete: exactly % criteria required, received %', v_total_criteria, v_submitted_criteria;
    END IF;

    -- Validate each criterion and insert atomically
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_criterion_scores)
    LOOP
        v_criterion_id := (v_item->>'criterion_id')::UUID;
        v_score := (v_item->>'score')::NUMERIC;
        v_comment := trim(COALESCE(v_item->>'comment', ''));

        IF v_criterion_id IS NULL THEN
            RAISE EXCEPTION 'Each evaluation item must specify a valid criterion_id';
        END IF;

        IF v_score IS NULL OR v_score < 0 OR v_score > 10 THEN
            RAISE EXCEPTION 'Score % for criterion % is outside valid range [0, 10]', v_score, v_criterion_id;
        END IF;

        IF length(v_comment) = 0 THEN
            RAISE EXCEPTION 'A non-empty feedback comment is required for criterion %', v_criterion_id;
        END IF;

        SELECT EXISTS (
            SELECT 1 FROM public.rubric_criteria
            WHERE id = v_criterion_id AND event_id = v_event_id
        ), max_score INTO v_crit_exists, v_max_score
        FROM public.rubric_criteria
        WHERE id = v_criterion_id AND event_id = v_event_id;

        IF NOT v_crit_exists THEN
            RAISE EXCEPTION 'Criterion % does not belong to event %', v_criterion_id, v_event_id;
        END IF;

        IF v_score > v_max_score THEN
            RAISE EXCEPTION 'Score % exceeds criterion maximum score %', v_score, v_max_score;
        END IF;

        -- Insert append-only score row (version = 1)
        INSERT INTO public.scores (
            event_id,
            institution_id,
            judge_id,
            team_id,
            criterion_id,
            score,
            comment,
            version
        ) VALUES (
            v_event_id,
            v_institution_id,
            v_judge_id,
            p_team_id,
            v_criterion_id,
            v_score,
            v_comment,
            1
        );
    END LOOP;

    -- Update assignment status to completed
    UPDATE public.judge_assignments
    SET status = 'completed'
    WHERE event_id = v_event_id AND judge_id = v_judge_id AND team_id = p_team_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. apply_approved_score_edit: Append-only version increment for approved edit requests
CREATE OR REPLACE FUNCTION public.apply_approved_score_edit(
    p_edit_request_id UUID
) RETURNS VOID AS $$
DECLARE
    v_caller_id UUID;
    v_event_id UUID;
    v_institution_id UUID;
    v_judge_id UUID;
    v_team_id UUID;
    v_status TEXT;
    v_requested_changes JSONB;
    v_is_organizer BOOLEAN;
    v_item JSONB;
    v_criterion_id UUID;
    v_new_score NUMERIC;
    v_new_comment TEXT;
    v_max_version INT;
BEGIN
    v_caller_id := auth.uid();

    SELECT event_id, institution_id, judge_id, team_id, status, requested_changes
    INTO v_event_id, v_institution_id, v_judge_id, v_team_id, v_status, v_requested_changes
    FROM public.edit_requests
    WHERE id = p_edit_request_id;

    IF v_event_id IS NULL THEN
        RAISE EXCEPTION 'Edit request % not found', p_edit_request_id;
    END IF;

    IF v_status != 'approved' THEN
        RAISE EXCEPTION 'Edit request % cannot be applied; status is % (must be approved)', p_edit_request_id, v_status;
    END IF;

    -- Verify caller is an organizer or admin for this event
    SELECT EXISTS (
        SELECT 1 FROM public.event_roles
        WHERE event_id = v_event_id
          AND user_id = v_caller_id
          AND role IN ('admin', 'organizer')
          AND status = 'active'
    ) INTO v_is_organizer;

    IF NOT v_is_organizer THEN
        RAISE EXCEPTION 'Only event organizers or admins can apply score edit requests';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_requested_changes)
    LOOP
        v_criterion_id := (v_item->>'criterion_id')::UUID;
        v_new_score := (v_item->>'score')::NUMERIC;
        v_new_comment := trim(COALESCE(v_item->>'comment', ''));

        IF v_new_score < 0 OR v_new_score > 10 THEN
            RAISE EXCEPTION 'Corrected score % is outside [0, 10]', v_new_score;
        END IF;

        -- Find current max version for this (event, judge, team, criterion)
        SELECT COALESCE(MAX(version), 0) INTO v_max_version
        FROM public.scores
        WHERE event_id = v_event_id
          AND judge_id = v_judge_id
          AND team_id = v_team_id
          AND criterion_id = v_criterion_id;

        IF v_max_version = 0 THEN
            RAISE EXCEPTION 'Cannot edit score: no baseline version found for criterion %', v_criterion_id;
        END IF;

        -- Insert new row with version = v_max_version + 1 (append-only)
        INSERT INTO public.scores (
            event_id,
            institution_id,
            judge_id,
            team_id,
            criterion_id,
            score,
            comment,
            version,
            edit_request_id
        ) VALUES (
            v_event_id,
            v_institution_id,
            v_judge_id,
            v_team_id,
            v_criterion_id,
            v_new_score,
            COALESCE(v_new_comment, 'Score corrected via approved edit request'),
            v_max_version + 1,
            p_edit_request_id
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. get_judge_progress: Organizer progress monitor ensuring all criteria are scored
CREATE OR REPLACE FUNCTION public.get_judge_progress(
    p_event_id UUID
) RETURNS TABLE (
    judge_id UUID,
    judge_name TEXT,
    judge_email TEXT,
    total_assigned BIGINT,
    teams_fully_scored BIGINT,
    progress_pct NUMERIC
) AS $$
DECLARE
    v_caller_id UUID;
    v_is_organizer BOOLEAN;
    v_total_event_criteria INT;
BEGIN
    v_caller_id := auth.uid();

    -- Verify caller is organizer or admin
    SELECT EXISTS (
        SELECT 1 FROM public.event_roles
        WHERE event_id = p_event_id
          AND user_id = v_caller_id
          AND role IN ('admin', 'organizer')
          AND status = 'active'
    ) INTO v_is_organizer;

    IF NOT v_is_organizer THEN
        RAISE EXCEPTION 'Access denied: Only event organizers or admins can view judging progress';
    END IF;

    -- Count active criteria for the event
    SELECT COUNT(*) INTO v_total_event_criteria
    FROM public.rubric_criteria
    WHERE event_id = p_event_id;

    RETURN QUERY
    WITH judge_assigned_counts AS (
        SELECT 
            ja.judge_id,
            COUNT(DISTINCT ja.team_id) AS assigned_count
        FROM public.judge_assignments ja
        WHERE ja.event_id = p_event_id
          AND ja.status IN ('assigned', 'completed')
        GROUP BY ja.judge_id
    ),
    teams_scored_counts AS (
        SELECT 
            s.judge_id,
            COUNT(DISTINCT s.team_id) AS scored_count
        FROM (
            -- Count only teams where the judge has evaluated ALL criteria
            SELECT s2.judge_id, s2.team_id
            FROM public.scores s2
            WHERE s2.event_id = p_event_id
            GROUP BY s2.judge_id, s2.team_id
            HAVING COUNT(DISTINCT s2.criterion_id) >= v_total_event_criteria
        ) s
        GROUP BY s.judge_id
    )
    SELECT 
        p.id AS judge_id,
        p.full_name AS judge_name,
        p.email AS judge_email,
        COALESCE(jac.assigned_count, 0) AS total_assigned,
        COALESCE(tsc.scored_count, 0) AS teams_fully_scored,
        ROUND((COALESCE(tsc.scored_count, 0)::numeric / NULLIF(COALESCE(jac.assigned_count, 0), 0)) * 100, 1) AS progress_pct
    FROM public.judge_assignments ja_all
    JOIN public.profiles p ON p.id = ja_all.judge_id
    LEFT JOIN judge_assigned_counts jac ON jac.judge_id = p.id
    LEFT JOIN teams_scored_counts tsc ON tsc.judge_id = p.id
    WHERE ja_all.event_id = p_event_id
    GROUP BY p.id, p.full_name, p.email, jac.assigned_count, tsc.scored_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. transition_event_status: Forward-only state machine enforcing rubric weight sum = 100
CREATE OR REPLACE FUNCTION public.transition_event_status(
    p_event_id UUID,
    p_new_status TEXT
) RETURNS TEXT AS $$
DECLARE
    v_caller_id UUID;
    v_current_status TEXT;
    v_is_authorized BOOLEAN;
    v_total_rubric_weight NUMERIC;
    v_merkle_root TEXT;
BEGIN
    v_caller_id := auth.uid();

    SELECT status INTO v_current_status
    FROM public.events
    WHERE id = p_event_id;

    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'Event % not found', p_event_id;
    END IF;

    -- Verify organizer or admin permission
    SELECT EXISTS (
        SELECT 1 FROM public.event_roles
        WHERE event_id = p_event_id
          AND user_id = v_caller_id
          AND role IN ('admin', 'organizer')
          AND status = 'active'
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Only event organizers or admins can transition event status';
    END IF;

    -- Forward-only transition validations
    IF v_current_status = 'draft' AND p_new_status = 'open' THEN
        -- Enforce rubric weights total exactly 100
        SELECT COALESCE(SUM(weight), 0) INTO v_total_rubric_weight
        FROM public.rubric_criteria
        WHERE event_id = p_event_id;

        IF v_total_rubric_weight != 100 THEN
            RAISE EXCEPTION 'Cannot open event: Rubric criteria weights must total exactly 100%% (current sum: %)', v_total_rubric_weight;
        END IF;

    ELSIF v_current_status = 'open' AND p_new_status = 'judging' THEN
        -- Valid transition
        NULL;

    ELSIF v_current_status = 'judging' AND p_new_status = 'review' THEN
        -- Valid transition
        NULL;

    ELSIF v_current_status = 'review' AND p_new_status = 'published' THEN
        -- Compute and anchor Merkle root across all judge chain heads and event chain
        -- (Defined in migration 3)
        EXECUTE 'SELECT public.compute_event_merkle_root($1)' INTO v_merkle_root USING p_event_id;
        
        UPDATE public.events
        SET anchored_merkle_root = v_merkle_root,
            anchored_at = now()
        WHERE id = p_event_id;

    ELSE
        RAISE EXCEPTION 'Invalid status transition from ''%'' to ''%''. Status transitions are strictly forward-only: draft -> open -> judging -> review -> published.',
            v_current_status, p_new_status;
    END IF;

    -- Apply status update
    UPDATE public.events
    SET status = p_new_status,
        updated_at = now()
    WHERE id = p_event_id;

    RETURN p_new_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. approve_organizer & reject_organizer: Institution Admin approvals
CREATE OR REPLACE FUNCTION public.approve_organizer(
    p_user_id UUID
) RETURNS VOID AS $$
DECLARE
    v_admin_id UUID;
    v_admin_institution_id UUID;
    v_user_institution_id UUID;
BEGIN
    v_admin_id := auth.uid();

    SELECT institution_id INTO v_admin_institution_id
    FROM public.profiles
    WHERE id = v_admin_id AND role IN ('institution_admin', 'platform_owner');

    IF v_admin_institution_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Caller must be an institution administrator';
    END IF;

    SELECT institution_id INTO v_user_institution_id
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_user_institution_id IS NULL OR v_user_institution_id != v_admin_institution_id THEN
        RAISE EXCEPTION 'Cannot approve user from another institution';
    END IF;

    UPDATE public.profiles
    SET organizer_approval_status = 'approved',
        updated_at = now()
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.reject_organizer(
    p_user_id UUID
) RETURNS VOID AS $$
DECLARE
    v_admin_id UUID;
    v_admin_institution_id UUID;
    v_user_institution_id UUID;
BEGIN
    v_admin_id := auth.uid();

    SELECT institution_id INTO v_admin_institution_id
    FROM public.profiles
    WHERE id = v_admin_id AND role IN ('institution_admin', 'platform_owner');

    IF v_admin_institution_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Caller must be an institution administrator';
    END IF;

    SELECT institution_id INTO v_user_institution_id
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_user_institution_id IS NULL OR v_user_institution_id != v_admin_institution_id THEN
        RAISE EXCEPTION 'Cannot reject user from another institution';
    END IF;

    UPDATE public.profiles
    SET organizer_approval_status = 'rejected',
        updated_at = now()
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. get_published_team_results: Security definer delivering masked participant data post-publish
CREATE OR REPLACE FUNCTION public.get_published_team_results(
    p_team_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_caller_id UUID;
    v_event_id UUID;
    v_event_status TEXT;
    v_is_member BOOLEAN;
    v_is_organizer BOOLEAN;
    v_results JSONB;
BEGIN
    v_caller_id := auth.uid();

    SELECT t.event_id, e.status INTO v_event_id, v_event_status
    FROM public.teams t
    JOIN public.events e ON e.id = t.event_id
    WHERE t.id = p_team_id;

    IF v_event_id IS NULL THEN
        RAISE EXCEPTION 'Team % not found', p_team_id;
    END IF;

    IF v_event_status != 'published' THEN
        RAISE EXCEPTION 'Results are not available: Event has not been published yet';
    END IF;

    -- Verify caller is a member of this team or an organizer
    SELECT EXISTS (
        SELECT 1 FROM public.team_members
        WHERE team_id = p_team_id AND user_id = v_caller_id
    ) INTO v_is_member;

    SELECT EXISTS (
        SELECT 1 FROM public.event_roles
        WHERE event_id = v_event_id
          AND user_id = v_caller_id
          AND role IN ('admin', 'organizer')
          AND status = 'active'
    ) INTO v_is_organizer;

    IF NOT v_is_member AND NOT v_is_organizer THEN
        RAISE EXCEPTION 'Access denied: You are not authorized to view results for this team';
    END IF;

    -- Return masked score records with judge aliases
    SELECT jsonb_build_object(
        'team_id', p_team_id,
        'event_id', v_event_id,
        'scores', COALESCE(jsonb_agg(
            jsonb_build_object(
                'criterion_id', s.criterion_id,
                'criterion_name', rc.name,
                'weight', rc.weight,
                'judge_alias', COALESCE(al.alias_label, 'Judge ' || substr(s.judge_id::text, 1, 4)),
                'score', s.score,
                'comment', s.comment,
                'version', s.version
            )
        ), '[]'::jsonb)
    ) INTO v_results
    FROM public.scores s
    JOIN public.rubric_criteria rc ON rc.id = s.criterion_id
    LEFT JOIN public.aliases al ON al.event_id = v_event_id AND al.user_id = s.judge_id AND al.entity_type = 'judge'
    WHERE s.team_id = p_team_id
      AND s.version = (
          SELECT MAX(s2.version)
          FROM public.scores s2
          WHERE s2.event_id = s.event_id
            AND s2.judge_id = s.judge_id
            AND s2.team_id = s.team_id
            AND s2.criterion_id = s.criterion_id
      );

    RETURN v_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ================================================================
-- 20261001000003_audit_chain_and_triggers.sql
-- ================================================================

-- Migration: 20261001000003_audit_chain_triggers.sql
-- Description: Immutable triggers, per-judge/event SHA-256 chain triggers with advisory locks, Merkle tree aggregator with odd-leaf rule, and sensitive audit triggers.

-- 1. Block UPDATE and DELETE on scores
CREATE OR REPLACE FUNCTION public.block_score_mutations()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Scores table is strictly append-only. Direct UPDATE and DELETE are prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_score_mutations ON public.scores;
CREATE TRIGGER trg_block_score_mutations
BEFORE UPDATE OR DELETE ON public.scores
FOR EACH ROW EXECUTE FUNCTION public.block_score_mutations();


-- 2. Block UPDATE and DELETE on audit_log
CREATE OR REPLACE FUNCTION public.block_audit_log_mutations()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit log is immutable. UPDATE and DELETE are strictly prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_audit_log_mutations ON public.audit_log;
CREATE TRIGGER trg_block_audit_log_mutations
BEFORE UPDATE OR DELETE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.block_audit_log_mutations();


-- 3. Serialized SHA-256 Hash Chain Trigger for scores (Per-Judge and Event)
CREATE OR REPLACE FUNCTION public.append_score_audit_block()
RETURNS TRIGGER AS $$
DECLARE
    v_prev_hash TEXT;
    v_block_index BIGINT;
    v_current_hash TEXT;
    v_payload JSONB;
    v_action TEXT;
    v_raw_str TEXT;
BEGIN
    -- Advisory lock per (event_id, judge_id); other judges proceed concurrently with zero contention
    PERFORM pg_advisory_xact_lock(hashtext(NEW.event_id::text || ':' || coalesce(NEW.judge_id::text, 'EVENT')));

    -- Determine latest block for this specific judge in this event
    SELECT block_index, current_hash
    INTO v_block_index, v_prev_hash
    FROM public.audit_log
    WHERE event_id = NEW.event_id
      AND judge_id IS NOT DISTINCT FROM NEW.judge_id
    ORDER BY block_index DESC
    LIMIT 1;

    IF v_block_index IS NULL THEN
        v_block_index := 0;
        v_prev_hash := 'GENESIS';
    ELSE
        v_block_index := v_block_index + 1;
    END IF;

    v_action := CASE WHEN NEW.version = 1 THEN 'score_inserted' ELSE 'score_corrected' END;

    -- Payload contains IDs, numeric values, and version ONLY; zero PII
    v_payload := jsonb_build_object(
        'score_id', NEW.id,
        'event_id', NEW.event_id,
        'institution_id', NEW.institution_id,
        'judge_id', NEW.judge_id,
        'team_id', NEW.team_id,
        'criterion_id', NEW.criterion_id,
        'score', NEW.score,
        'version', NEW.version,
        'edit_request_id', NEW.edit_request_id
    );

    -- Compute SHA-256 block hash
    v_raw_str := v_prev_hash || ':' || v_block_index::text || ':' || v_action || ':' || (v_payload)::text || ':' || NEW.created_at::text;
    v_current_hash := encode(digest(v_raw_str::bytea, 'sha256'), 'hex');

    -- Insert into immutable audit log
    INSERT INTO public.audit_log (
        event_id,
        institution_id,
        judge_id,
        block_index,
        prev_hash,
        current_hash,
        payload,
        action,
        created_at
    ) VALUES (
        NEW.event_id,
        NEW.institution_id,
        NEW.judge_id,
        v_block_index,
        v_prev_hash,
        v_current_hash,
        v_payload,
        v_action,
        NEW.created_at
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_append_score_audit_block ON public.scores;
CREATE TRIGGER trg_append_score_audit_block
AFTER INSERT ON public.scores
FOR EACH ROW EXECUTE FUNCTION public.append_score_audit_block();


-- 4. Generic Helper to Append Event-Level Audit Blocks
CREATE OR REPLACE FUNCTION public.append_generic_audit_block(
    p_event_id UUID,
    p_institution_id UUID,
    p_judge_id UUID,
    p_action TEXT,
    p_payload JSONB,
    p_created_at TIMESTAMPTZ DEFAULT now()
) RETURNS TEXT AS $$
DECLARE
    v_prev_hash TEXT;
    v_block_index BIGINT;
    v_current_hash TEXT;
    v_raw_str TEXT;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext(p_event_id::text || ':' || coalesce(p_judge_id::text, 'EVENT')));

    SELECT block_index, current_hash
    INTO v_block_index, v_prev_hash
    FROM public.audit_log
    WHERE event_id = p_event_id
      AND judge_id IS NOT DISTINCT FROM p_judge_id
    ORDER BY block_index DESC
    LIMIT 1;

    IF v_block_index IS NULL THEN
        v_block_index := 0;
        v_prev_hash := 'GENESIS';
    ELSE
        v_block_index := v_block_index + 1;
    END IF;

    v_raw_str := v_prev_hash || ':' || v_block_index::text || ':' || p_action || ':' || (p_payload)::text || ':' || p_created_at::text;
    v_current_hash := encode(digest(v_raw_str::bytea, 'sha256'), 'hex');

    INSERT INTO public.audit_log (
        event_id,
        institution_id,
        judge_id,
        block_index,
        prev_hash,
        current_hash,
        payload,
        action,
        created_at
    ) VALUES (
        p_event_id,
        p_institution_id,
        p_judge_id,
        v_block_index,
        v_prev_hash,
        v_current_hash,
        p_payload,
        p_action,
        p_created_at
    );

    RETURN v_current_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Sensitive Action Audit Triggers: conflicts, edit_requests, event_roles, events
CREATE OR REPLACE FUNCTION public.audit_conflict_declaration()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.append_generic_audit_block(
        NEW.event_id,
        NEW.institution_id,
        NEW.judge_id,
        'conflict_declared',
        jsonb_build_object(
            'conflict_id', NEW.id,
            'judge_id', NEW.judge_id,
            'team_id', NEW.team_id,
            'declared_by', NEW.declared_by
        ),
        NEW.created_at
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_conflict ON public.conflicts;
CREATE TRIGGER trg_audit_conflict
AFTER INSERT ON public.conflicts
FOR EACH ROW EXECUTE FUNCTION public.audit_conflict_declaration();


CREATE OR REPLACE FUNCTION public.audit_score_edit_approval()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status != 'approved' AND NEW.status = 'approved' THEN
        PERFORM public.append_generic_audit_block(
            NEW.event_id,
            NEW.institution_id,
            NEW.judge_id,
            'score_edit_approved',
            jsonb_build_object(
                'edit_request_id', NEW.id,
                'judge_id', NEW.judge_id,
                'team_id', NEW.team_id,
                'reviewed_by', NEW.reviewed_by
            ),
            COALESCE(NEW.reviewed_at, now())
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_edit_approval ON public.edit_requests;
CREATE TRIGGER trg_audit_edit_approval
AFTER UPDATE ON public.edit_requests
FOR EACH ROW EXECUTE FUNCTION public.audit_score_edit_approval();


CREATE OR REPLACE FUNCTION public.audit_role_assignment()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.append_generic_audit_block(
        NEW.event_id,
        NEW.institution_id,
        NULL, -- Event-level chain
        CASE WHEN TG_OP = 'INSERT' THEN 'role_assigned' ELSE 'role_updated' END,
        jsonb_build_object(
            'event_role_id', NEW.id,
            'user_id', NEW.user_id,
            'role', NEW.role,
            'status', NEW.status
        ),
        NEW.created_at
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_role_assignment ON public.event_roles;
CREATE TRIGGER trg_audit_role_assignment
AFTER INSERT OR UPDATE ON public.event_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_role_assignment();


CREATE OR REPLACE FUNCTION public.audit_event_publish()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status != 'published' AND NEW.status = 'published' THEN
        PERFORM public.append_generic_audit_block(
            NEW.id,
            NEW.institution_id,
            NULL, -- Event-level chain
            'event_published',
            jsonb_build_object(
                'event_id', NEW.id,
                'anchored_merkle_root', NEW.anchored_merkle_root,
                'anchored_at', NEW.anchored_at
            ),
            COALESCE(NEW.anchored_at, now())
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_event_publish ON public.events;
CREATE TRIGGER trg_audit_event_publish
AFTER UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.audit_event_publish();


-- 6. Immutability of anchored_merkle_root once set
CREATE OR REPLACE FUNCTION public.enforce_immutable_merkle_root()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.anchored_merkle_root IS NOT NULL AND NEW.anchored_merkle_root IS DISTINCT FROM OLD.anchored_merkle_root THEN
        RAISE EXCEPTION 'anchored_merkle_root is immutable once anchored at publish time';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_merkle_root ON public.events;
CREATE TRIGGER trg_immutable_merkle_root
BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.enforce_immutable_merkle_root();


-- 7. Chain Verification Functions (Judge Chain & Event Chain)
CREATE OR REPLACE FUNCTION public.verify_judge_chain(
    p_event_id UUID,
    p_judge_id UUID
) RETURNS TABLE (
    is_valid BOOLEAN,
    total_blocks BIGINT,
    broken_block_index BIGINT,
    error_reason TEXT
) AS $$
DECLARE
    r RECORD;
    v_expected_prev TEXT := 'GENESIS';
    v_expected_index BIGINT := 0;
    v_computed_hash TEXT;
    v_raw_str TEXT;
BEGIN
    FOR r IN
        SELECT block_index, prev_hash, current_hash, payload, action, created_at
        FROM public.audit_log
        WHERE event_id = p_event_id
          AND judge_id = p_judge_id
        ORDER BY block_index ASC
    LOOP
        -- Check sequence index
        IF r.block_index != v_expected_index THEN
            RETURN QUERY SELECT false, v_expected_index, r.block_index, 'Block sequence gap or out-of-order block';
            RETURN;
        END IF;

        -- Check prev_hash link
        IF r.prev_hash != v_expected_prev THEN
            RETURN QUERY SELECT false, v_expected_index, r.block_index, 'Broken prev_hash pointer';
            RETURN;
        END IF;

        -- Recompute SHA-256 hash
        v_raw_str := r.prev_hash || ':' || r.block_index::text || ':' || r.action || ':' || (r.payload)::text || ':' || r.created_at::text;
        v_computed_hash := encode(digest(v_raw_str::bytea, 'sha256'), 'hex');

        IF r.current_hash != v_computed_hash THEN
            RETURN QUERY SELECT false, v_expected_index, r.block_index, 'Hash mismatch: block data has been tampered with';
            RETURN;
        END IF;

        v_expected_prev := r.current_hash;
        v_expected_index := v_expected_index + 1;
    END LOOP;

    RETURN QUERY SELECT true, v_expected_index, NULL::BIGINT, 'Valid cryptographic chain';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.verify_event_chain(
    p_event_id UUID
) RETURNS TABLE (
    is_valid BOOLEAN,
    total_blocks BIGINT,
    broken_block_index BIGINT,
    error_reason TEXT
) AS $$
DECLARE
    r RECORD;
    v_expected_prev TEXT := 'GENESIS';
    v_expected_index BIGINT := 0;
    v_computed_hash TEXT;
    v_raw_str TEXT;
BEGIN
    FOR r IN
        SELECT block_index, prev_hash, current_hash, payload, action, created_at
        FROM public.audit_log
        WHERE event_id = p_event_id
          AND judge_id IS NULL
        ORDER BY block_index ASC
    LOOP
        IF r.block_index != v_expected_index THEN
            RETURN QUERY SELECT false, v_expected_index, r.block_index, 'Event chain block index gap';
            RETURN;
        END IF;

        IF r.prev_hash != v_expected_prev THEN
            RETURN QUERY SELECT false, v_expected_index, r.block_index, 'Event chain broken prev_hash pointer';
            RETURN;
        END IF;

        v_raw_str := r.prev_hash || ':' || r.block_index::text || ':' || r.action || ':' || (r.payload)::text || ':' || r.created_at::text;
        v_computed_hash := encode(digest(v_raw_str::bytea, 'sha256'), 'hex');

        IF r.current_hash != v_computed_hash THEN
            RETURN QUERY SELECT false, v_expected_index, r.block_index, 'Event chain hash mismatch';
            RETURN;
        END IF;

        v_expected_prev := r.current_hash;
        v_expected_index := v_expected_index + 1;
    END LOOP;

    RETURN QUERY SELECT true, v_expected_index, NULL::BIGINT, 'Valid event-level chain';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 8. Merkle Root Aggregation with Odd-Leaf Duplication Rule
CREATE OR REPLACE FUNCTION public.compute_event_merkle_root(
    p_event_id UUID
) RETURNS TEXT AS $$
DECLARE
    v_leaves TEXT[];
    v_next_level TEXT[];
    v_len INT;
    i INT;
    v_left TEXT;
    v_right TEXT;
BEGIN
    -- 1. Collect all judge chain heads and event-level chain head
    WITH chain_heads AS (
        SELECT DISTINCT ON (coalesce(judge_id::text, 'EVENT'))
            current_hash
        FROM public.audit_log
        WHERE event_id = p_event_id
        ORDER BY coalesce(judge_id::text, 'EVENT'), block_index DESC
    )
    SELECT array_agg(current_hash ORDER BY current_hash ASC)
    INTO v_leaves
    FROM chain_heads;

    IF v_leaves IS NULL OR array_length(v_leaves, 1) = 0 THEN
        -- If no audit blocks exist, hash of genesis
        RETURN encode(digest(('GENESIS_ROOT:' || p_event_id::text)::bytea, 'sha256'), 'hex');
    END IF;

    -- 2. Build Merkle tree iteratively using the Odd-Leaf rule
    WHILE array_length(v_leaves, 1) > 1 LOOP
        v_len := array_length(v_leaves, 1);
        v_next_level := ARRAY[]::TEXT[];

        -- Odd-leaf rule: duplicate last leaf if odd
        IF v_len % 2 = 1 THEN
            v_leaves := array_append(v_leaves, v_leaves[v_len]);
            v_len := v_len + 1;
        END IF;

        -- Pairwise hash: SHA256(left || right)
        FOR i IN 1..(v_len / 2) LOOP
            v_left := v_leaves[(i - 1) * 2 + 1];
            v_right := v_leaves[(i - 1) * 2 + 2];
            v_next_level := array_append(
                v_next_level,
                encode(digest((v_left || v_right)::bytea, 'sha256'), 'hex')
            );
        END LOOP;

        v_leaves := v_next_level;
    END LOOP;

    RETURN v_leaves[1];
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ================================================================
-- 20261001000004_rls_policies.sql
-- ================================================================

-- Migration: 20261001000004_rls_policies.sql
-- Description: Complete Row Level Security policies with (select auth.uid()) subqueries and organizer score gating.

-- Enable RLS on all 24 tables
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judge_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fairness_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autopsies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pairwise_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Grant permissions to Supabase authenticated and anon roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

-- Helper security-definer accessors to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.get_auth_user_role() RETURNS TEXT AS $$
    SELECT role FROM public.profiles WHERE id = (SELECT auth.uid());
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_auth_user_institution_id() RETURNS UUID AS $$
    SELECT institution_id FROM public.profiles WHERE id = (SELECT auth.uid());
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_event_organizer(p_event_id UUID) RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.event_roles
        WHERE event_id = p_event_id
          AND user_id = (SELECT auth.uid())
          AND role IN ('admin', 'organizer')
          AND status = 'active'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id UUID) RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.team_members
        WHERE team_id = p_team_id
          AND user_id = (SELECT auth.uid())
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_team_lead(p_team_id UUID) RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.team_members
        WHERE team_id = p_team_id
          AND user_id = (SELECT auth.uid())
          AND role = 'lead'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 1. institutions policies
CREATE POLICY "institutions_select_public" ON public.institutions
FOR SELECT TO authenticated USING (true);

CREATE POLICY "institutions_admin_manage" ON public.institutions
FOR ALL TO authenticated
USING (
    public.get_auth_user_role() = 'platform_owner'
    OR (public.get_auth_user_role() = 'institution_admin' AND public.get_auth_user_institution_id() = institutions.id)
);

-- 2. profiles policies
CREATE POLICY "profiles_select" ON public.profiles
FOR SELECT TO authenticated
USING (
    id = (SELECT auth.uid())
    OR public.get_auth_user_role() = 'platform_owner'
    OR (public.get_auth_user_role() = 'institution_admin' AND public.get_auth_user_institution_id() = profiles.institution_id)
);

CREATE POLICY "profiles_update_own" ON public.profiles
FOR UPDATE TO authenticated
USING (id = (SELECT auth.uid()))
WITH CHECK (id = (SELECT auth.uid()));

-- 3. events policies
CREATE POLICY "events_select" ON public.events
FOR SELECT TO authenticated
USING (
    status != 'draft'
    OR created_by = (SELECT auth.uid())
    OR public.is_event_organizer(id)
    OR public.get_auth_user_role() = 'platform_owner'
    OR (public.get_auth_user_role() = 'institution_admin' AND public.get_auth_user_institution_id() = events.institution_id)
);

CREATE POLICY "events_organizer_modify" ON public.events
FOR ALL TO authenticated
USING (
    created_by = (SELECT auth.uid())
    OR public.is_event_organizer(id)
    OR public.get_auth_user_role() = 'platform_owner'
    OR (public.get_auth_user_role() = 'institution_admin' AND public.get_auth_user_institution_id() = events.institution_id)
);

-- 4. invites policies
CREATE POLICY "invites_select" ON public.invites
FOR SELECT TO authenticated
USING (
    invited_by = (SELECT auth.uid())
    OR public.is_event_organizer(event_id)
);

CREATE POLICY "invites_manage" ON public.invites
FOR ALL TO authenticated
USING (
    public.is_event_organizer(event_id)
    OR public.get_auth_user_role() = 'platform_owner'
    OR (public.get_auth_user_role() = 'institution_admin' AND public.get_auth_user_institution_id() = invites.institution_id)
);

-- 5. event_roles policies
CREATE POLICY "event_roles_select" ON public.event_roles
FOR SELECT TO authenticated
USING (
    user_id = (SELECT auth.uid())
    OR public.is_event_organizer(event_id)
    OR public.get_auth_user_role() = 'platform_owner'
    OR (public.get_auth_user_role() = 'institution_admin' AND public.get_auth_user_institution_id() = event_roles.institution_id)
);

CREATE POLICY "event_roles_manage" ON public.event_roles
FOR ALL TO authenticated
USING (
    public.is_event_organizer(event_id)
    OR public.get_auth_user_role() = 'platform_owner'
    OR (public.get_auth_user_role() = 'institution_admin' AND public.get_auth_user_institution_id() = event_roles.institution_id)
);

-- 6. rubric_criteria policies
CREATE POLICY "rubric_criteria_select" ON public.rubric_criteria
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "rubric_criteria_manage" ON public.rubric_criteria
FOR ALL TO authenticated
USING (
    public.is_event_organizer(event_id)
);

-- 7. teams & team_members policies
CREATE POLICY "teams_select" ON public.teams
FOR SELECT TO authenticated USING (true);

CREATE POLICY "teams_manage" ON public.teams
FOR ALL TO authenticated
USING (
    created_by = (SELECT auth.uid())
    OR public.is_team_member(id)
    OR public.is_event_organizer(event_id)
);

CREATE POLICY "team_members_select" ON public.team_members
FOR SELECT TO authenticated USING (true);

CREATE POLICY "team_members_manage" ON public.team_members
FOR ALL TO authenticated
USING (
    user_id = (SELECT auth.uid())
    OR public.is_team_lead(team_id)
    OR public.is_event_organizer(event_id)
);

-- 8. submissions policies
CREATE POLICY "submissions_select" ON public.submissions
FOR SELECT TO authenticated
USING (
    public.is_team_member(team_id)
    OR EXISTS (
        SELECT 1 FROM public.judge_assignments ja
        WHERE ja.team_id = submissions.team_id AND ja.judge_id = (SELECT auth.uid())
    )
    OR public.is_event_organizer(event_id)
);

CREATE POLICY "submissions_modify" ON public.submissions
FOR ALL TO authenticated
USING (
    public.is_team_member(team_id)
);

-- 9. judge_assignments policies
CREATE POLICY "judge_assignments_select" ON public.judge_assignments
FOR SELECT TO authenticated
USING (
    judge_id = (SELECT auth.uid())
    OR public.is_event_organizer(event_id)
);

CREATE POLICY "judge_assignments_manage" ON public.judge_assignments
FOR ALL TO authenticated
USING (
    public.is_event_organizer(event_id)
);

-- 10. conflicts policies
CREATE POLICY "conflicts_select" ON public.conflicts
FOR SELECT TO authenticated
USING (
    judge_id = (SELECT auth.uid())
    OR declared_by = (SELECT auth.uid())
    OR public.is_event_organizer(event_id)
);

CREATE POLICY "conflicts_insert" ON public.conflicts
FOR INSERT TO authenticated
WITH CHECK (
    judge_id = (SELECT auth.uid())
    OR declared_by = (SELECT auth.uid())
    OR public.is_event_organizer(event_id)
);

CREATE POLICY "conflicts_delete" ON public.conflicts
FOR DELETE TO authenticated
USING (
    judge_id = (SELECT auth.uid())
    OR declared_by = (SELECT auth.uid())
    OR public.is_event_organizer(event_id)
);

-- 11. edit_requests policies
CREATE POLICY "edit_requests_select" ON public.edit_requests
FOR SELECT TO authenticated
USING (
    judge_id = (SELECT auth.uid())
    OR public.is_event_organizer(event_id)
);

CREATE POLICY "edit_requests_insert" ON public.edit_requests
FOR INSERT TO authenticated
WITH CHECK (
    judge_id = (SELECT auth.uid())
);

CREATE POLICY "edit_requests_update" ON public.edit_requests
FOR UPDATE TO authenticated
USING (
    public.is_event_organizer(event_id)
);

-- 12. SCORES POLICIES: Zero client write policies; SELECT gated by role and status
-- Direct INSERT, UPDATE, DELETE are completely blocked for clients (inserts go through submit_scores)
CREATE POLICY "scores_select_policy" ON public.scores
FOR SELECT TO authenticated
USING (
    -- Judges can see only their own evaluations
    judge_id = (SELECT auth.uid())
    -- Organizers can SELECT scores ONLY when event status is 'review' or 'published'
    OR (
        public.is_event_organizer(scores.event_id)
        AND EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = scores.event_id AND e.status IN ('review', 'published')
        )
    )
);

-- 13. AUDIT LOG: Zero client INSERT/UPDATE/DELETE; Organizers/Admins can read
CREATE POLICY "audit_log_select_organizer" ON public.audit_log
FOR SELECT TO authenticated
USING (
    public.is_event_organizer(event_id)
    OR public.get_auth_user_role() = 'platform_owner'
    OR (public.get_auth_user_role() = 'institution_admin' AND public.get_auth_user_institution_id() = audit_log.institution_id)
);

-- 14. fairness_reports policies
CREATE POLICY "fairness_reports_select" ON public.fairness_reports
FOR SELECT TO authenticated
USING (
    public.is_event_organizer(event_id)
);

-- 15. autopsies policies
CREATE POLICY "autopsies_select" ON public.autopsies
FOR SELECT TO authenticated
USING (
    public.is_event_organizer(event_id)
    OR (
        public.is_team_member(team_id)
        AND EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = autopsies.event_id AND e.status = 'published'
        )
    )
);

-- 16. review_requests policies
CREATE POLICY "review_requests_select" ON public.review_requests
FOR SELECT TO authenticated
USING (
    participant_id = (SELECT auth.uid())
    OR public.is_team_member(team_id)
    OR public.is_event_organizer(event_id)
);

CREATE POLICY "review_requests_insert" ON public.review_requests
FOR INSERT TO authenticated
WITH CHECK (
    participant_id = (SELECT auth.uid())
    AND public.is_team_member(team_id)
);

-- 17. aliases policies
CREATE POLICY "aliases_select" ON public.aliases
FOR SELECT TO authenticated USING (true);

-- 18. consents policies
CREATE POLICY "consents_own" ON public.consents
FOR ALL TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

-- 19. invoices & payments policies
CREATE POLICY "invoices_select" ON public.invoices
FOR SELECT TO authenticated
USING (
    public.is_event_organizer(event_id)
    OR public.get_auth_user_role() = 'platform_owner'
    OR (public.get_auth_user_role() = 'institution_admin' AND public.get_auth_user_institution_id() = invoices.institution_id)
);

CREATE POLICY "payments_select" ON public.payments
FOR SELECT TO authenticated
USING (
    payer_id = (SELECT auth.uid())
    OR public.is_event_organizer(event_id)
);

-- 20. pairwise_comparisons policies
CREATE POLICY "pairwise_select" ON public.pairwise_comparisons
FOR SELECT TO authenticated
USING (
    judge_id = (SELECT auth.uid())
    OR public.is_event_organizer(event_id)
);

-- 21. JOBS & NOTIFICATIONS: ZERO CLIENT POLICIES (Only service-role and security-definer workers have access)
-- Note: Having RLS enabled with NO policies implicitly denies all access to regular authenticated/anon clients!


-- ================================================================
-- 20261001000005_progress_view_and_jobs.sql
-- ================================================================

-- Migration: 20261001000005_progress_view_and_jobs.sql
-- Description: Latest scores view, rubric freeze trigger, and jury/participant mutual exclusion enforcement.

-- 1. v_latest_scores view: derives latest version per criterion append-only
CREATE OR REPLACE VIEW public.v_latest_scores AS
SELECT DISTINCT ON (event_id, judge_id, team_id, criterion_id)
    id,
    event_id,
    institution_id,
    judge_id,
    team_id,
    criterion_id,
    score,
    comment,
    version,
    edit_request_id,
    created_at
FROM public.scores
ORDER BY event_id, judge_id, team_id, criterion_id, version DESC;


-- 2. Rubric criteria freeze: blocks mutations when status is 'judging', 'review', or 'published'
CREATE OR REPLACE FUNCTION public.check_rubric_criteria_frozen()
RETURNS TRIGGER AS $$
DECLARE
    v_status TEXT;
    v_target_event_id UUID;
BEGIN
    v_target_event_id := COALESCE(NEW.event_id, OLD.event_id);
    SELECT status INTO v_status FROM public.events WHERE id = v_target_event_id;
    
    IF v_status IN ('judging', 'review', 'published') THEN
        RAISE EXCEPTION 'Rubric criteria are frozen once judging begins (current event status: %)', v_status;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_freeze_rubric ON public.rubric_criteria;
CREATE TRIGGER trg_freeze_rubric
BEFORE INSERT OR UPDATE OR DELETE ON public.rubric_criteria
FOR EACH ROW EXECUTE FUNCTION public.check_rubric_criteria_frozen();


-- 3. Mutual exclusion between jury and team member in the same event
CREATE OR REPLACE FUNCTION public.enforce_jury_participant_mutual_exclusion()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'team_members' THEN
        IF EXISTS (
            SELECT 1 FROM public.event_roles
            WHERE event_id = NEW.event_id
              AND user_id = NEW.user_id
              AND role = 'jury'
              AND status = 'active'
        ) THEN
            RAISE EXCEPTION 'Role Conflict: User % is already registered as a jury member for event % and cannot join a team', NEW.user_id, NEW.event_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'event_roles' THEN
        IF NEW.role = 'jury' AND NEW.status = 'active' THEN
            IF EXISTS (
                SELECT 1 FROM public.team_members
                WHERE event_id = NEW.event_id
                  AND user_id = NEW.user_id
            ) THEN
                RAISE EXCEPTION 'Role Conflict: User % is already a team participant in event % and cannot be assigned as jury', NEW.user_id, NEW.event_id;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_exclude_jury_from_teams ON public.team_members;
CREATE TRIGGER trg_exclude_jury_from_teams
BEFORE INSERT OR UPDATE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_jury_participant_mutual_exclusion();

DROP TRIGGER IF EXISTS trg_exclude_teams_from_jury ON public.event_roles;
CREATE TRIGGER trg_exclude_teams_from_jury
BEFORE INSERT OR UPDATE ON public.event_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_jury_participant_mutual_exclusion();


-- ================================================================
-- 20261001000006_upi_dynamic_qr_and_registrations.sql
-- ================================================================

-- Migration: 20261001000006_upi_dynamic_qr_and_registrations.sql
-- Description: Dynamic UPI QR code allocation, direct-to-organizer payments, and team join code verification.

-- 1. Add UPI configuration to public.events
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS registration_fee NUMERIC NOT NULL DEFAULT 0 CHECK (registration_fee >= 0),
ADD COLUMN IF NOT EXISTS upi_id TEXT,
ADD COLUMN IF NOT EXISTS upi_name TEXT,
ADD COLUMN IF NOT EXISTS upi_qr_url TEXT,
ADD COLUMN IF NOT EXISTS auto_verify_upi BOOLEAN NOT NULL DEFAULT false;

-- 2. Add payment and join code fields to public.teams
ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'pending_verification', 'verified', 'waived')),
ADD COLUMN IF NOT EXISTS utr_number TEXT,
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS join_code TEXT;

-- Index on utr_number for fast lookup and duplicate detection
CREATE INDEX IF NOT EXISTS idx_teams_utr_number ON public.teams (event_id, utr_number) WHERE utr_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_teams_payment_status ON public.teams (event_id, payment_status);

-- 3. Automatic join_code assignment trigger
-- When a team is verified or registration fee is 0, ensures join_code is set
CREATE OR REPLACE FUNCTION public.handle_team_join_code()
RETURNS TRIGGER AS $$
DECLARE
    v_event_fee NUMERIC;
BEGIN
    SELECT registration_fee INTO v_event_fee
    FROM public.events
    WHERE id = NEW.event_id;

    -- If event is free, automatically mark payment as verified
    IF v_event_fee = 0 OR v_event_fee IS NULL THEN
        NEW.payment_status := 'verified';
        NEW.status := 'approved';
    END IF;

    -- Set join_code if verified and not set yet
    IF NEW.payment_status IN ('verified', 'waived') AND (NEW.join_code IS NULL OR NEW.join_code = '') THEN
        NEW.join_code := NEW.team_code;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_team_join_code ON public.teams;
CREATE TRIGGER trg_team_join_code
BEFORE INSERT OR UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.handle_team_join_code();

-- 4. RLS updates: ensure participants can view and submit UTR for their own team
-- Organizers can update payment status and verify UTR
CREATE POLICY "Organizers can manage team payments" ON public.teams
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.event_roles
            WHERE event_id = public.teams.event_id
              AND user_id = auth.uid()
              AND role IN ('admin', 'organizer')
              AND status = 'active'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.event_roles
            WHERE event_id = public.teams.event_id
              AND user_id = auth.uid()
              AND role IN ('admin', 'organizer')
              AND status = 'active'
        )
    );

-- ================================================================
-- 20261001000007_event_code_flyer.sql
-- ================================================================

-- Migration: 20261001000007_event_code_flyer.sql
-- Description: Adds unique event_code for flyer marketing, brochure distribution, and simplified participant team onboarding.

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS event_code TEXT;

-- Auto-populate event_code for existing rows from uppercase slug if null
UPDATE public.events
SET event_code = UPPER(REGEXP_REPLACE(slug, '[^a-zA-Z0-9]', '', 'g'))
WHERE event_code IS NULL;

-- Create case-insensitive unique index on event_code
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_event_code ON public.events (UPPER(event_code));


-- ================================================================
-- 20261001000008_performance_and_scale_indexes.sql
-- ================================================================

-- Migration: 20261001000008_performance_and_scale_indexes.sql
-- Description: Targeted performance and scalability indexes for high-volume hackathon traffic.

CREATE INDEX IF NOT EXISTS idx_scores_judge_lookup 
ON public.scores (judge_id, event_id, team_id, criterion_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_teams_join_code 
ON public.teams (join_code) 
WHERE join_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_teams_created_by 
ON public.teams (created_by, created_at DESC) 
WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_event_blocks 
ON public.audit_log (event_id, block_index ASC);

CREATE INDEX IF NOT EXISTS idx_profiles_institution_org_status 
ON public.profiles (institution_id, organizer_approval_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_institution_created 
ON public.events (institution_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_edit_requests_event_judge 
ON public.edit_requests (event_id, judge_id, status);

CREATE INDEX IF NOT EXISTS idx_review_requests_event_status 
ON public.review_requests (event_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_teams_event_created 
ON public.teams (event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_submissions_event_team 
ON public.submissions (event_id, team_id);

