
-- Add replied_at to campaign_contacts
ALTER TABLE public.campaign_contacts ADD COLUMN IF NOT EXISTS replied_at timestamptz;

-- Add replied_count to campaigns
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS replied_count integer DEFAULT 0;

-- Add anti-ban columns to campaigns
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS warmup_enabled boolean DEFAULT false;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS warmup_daily_increment integer DEFAULT 50;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS long_pause_every integer DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS long_pause_minutes integer DEFAULT 10;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS shuffle_contacts boolean DEFAULT false;

-- Helper function to increment replied count
CREATE OR REPLACE FUNCTION public.increment_campaign_replied(campaign_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE campaigns 
  SET replied_count = COALESCE(replied_count, 0) + 1
  WHERE id = campaign_id;
END;
$$;
