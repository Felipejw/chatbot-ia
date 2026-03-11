ALTER TABLE public.follow_ups 
ADD COLUMN IF NOT EXISTS allowed_hours_start text DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS allowed_hours_end text DEFAULT '20:00',
ADD COLUMN IF NOT EXISTS allowed_days text[] DEFAULT '{mon,tue,wed,thu,fri}'::text[],
ADD COLUMN IF NOT EXISTS follow_up_model text DEFAULT 'google/gemini-2.5-flash',
ADD COLUMN IF NOT EXISTS follow_up_temperature numeric DEFAULT 0.8,
ADD COLUMN IF NOT EXISTS closing_message text,
ADD COLUMN IF NOT EXISTS step_intervals jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS stop_on_human_assign boolean DEFAULT true;