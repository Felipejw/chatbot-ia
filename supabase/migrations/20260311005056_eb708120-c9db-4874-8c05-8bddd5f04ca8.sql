ALTER TABLE public.follow_ups 
ADD COLUMN IF NOT EXISTS media_url text,
ADD COLUMN IF NOT EXISTS media_type text DEFAULT 'none';