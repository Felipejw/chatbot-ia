-- Add campaign_id to conversations
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_campaign_id ON public.conversations USING btree (campaign_id);

-- Add campaign_id to follow_ups
ALTER TABLE public.follow_ups ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_follow_ups_campaign_id ON public.follow_ups USING btree (campaign_id);