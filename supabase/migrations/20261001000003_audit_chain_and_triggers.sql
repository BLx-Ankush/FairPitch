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
