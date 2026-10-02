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
