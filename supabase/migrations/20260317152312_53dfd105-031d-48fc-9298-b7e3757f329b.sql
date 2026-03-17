
-- Add anti-ban columns to campaigns table
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS daily_limit integer DEFAULT 200;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS allowed_hours_start text DEFAULT '08:00';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS allowed_hours_end text DEFAULT '20:00';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS max_consecutive_failures integer DEFAULT 5;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS connection_id uuid REFERENCES public.connections(id) ON DELETE SET NULL;
