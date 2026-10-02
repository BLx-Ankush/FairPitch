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
