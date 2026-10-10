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
