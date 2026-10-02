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
