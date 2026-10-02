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
