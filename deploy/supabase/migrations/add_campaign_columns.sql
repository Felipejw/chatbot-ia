-- ============================================
-- Migration: Adicionar colunas faltantes em campaigns e campaign_contacts
-- Compatível com VPS existentes (IF NOT EXISTS)
-- ============================================

-- Novas colunas em campaigns
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS replied_count integer DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS flow_id uuid REFERENCES public.chatbot_flows(id) ON DELETE SET NULL;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS connection_id uuid REFERENCES public.connections(id) ON DELETE SET NULL;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS daily_limit integer DEFAULT 200;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS allowed_hours_start text DEFAULT '08:00';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS allowed_hours_end text DEFAULT '20:00';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS max_consecutive_failures integer DEFAULT 5;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS warmup_enabled boolean DEFAULT false;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS warmup_daily_increment integer DEFAULT 50;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS long_pause_every integer DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS long_pause_minutes integer DEFAULT 10;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS shuffle_contacts boolean DEFAULT false;

-- Nova coluna em campaign_contacts
ALTER TABLE public.campaign_contacts ADD COLUMN IF NOT EXISTS replied_at timestamp with time zone;

-- Função increment_campaign_replied (se não existir)
CREATE OR REPLACE FUNCTION public.increment_campaign_replied(campaign_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE campaigns 
  SET replied_count = COALESCE(replied_count, 0) + 1
  WHERE id = campaign_id;
END;
$$;

-- Políticas RLS granulares para campaigns (IF NOT EXISTS via DO block)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'campaigns' AND policyname = 'Authenticated users can create campaigns') THEN
    CREATE POLICY "Authenticated users can create campaigns" ON public.campaigns FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'campaigns' AND policyname = 'Authenticated users can update campaigns') THEN
    CREATE POLICY "Authenticated users can update campaigns" ON public.campaigns FOR UPDATE USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'campaigns' AND policyname = 'Authenticated users can delete campaigns') THEN
    CREATE POLICY "Authenticated users can delete campaigns" ON public.campaigns FOR DELETE USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Políticas RLS granulares para campaign_contacts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'campaign_contacts' AND policyname = 'Authenticated users can insert campaign contacts') THEN
    CREATE POLICY "Authenticated users can insert campaign contacts" ON public.campaign_contacts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'campaign_contacts' AND policyname = 'Authenticated users can update campaign contacts') THEN
    CREATE POLICY "Authenticated users can update campaign contacts" ON public.campaign_contacts FOR UPDATE USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'campaign_contacts' AND policyname = 'Authenticated users can delete campaign contacts') THEN
    CREATE POLICY "Authenticated users can delete campaign contacts" ON public.campaign_contacts FOR DELETE USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_campaigns_connection_id ON public.campaigns USING btree (connection_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_flow_id ON public.campaigns USING btree (flow_id);

-- Vínculo campanha-conversa e campanha-follow_up
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_campaign_id ON public.conversations USING btree (campaign_id);

ALTER TABLE public.follow_ups ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_follow_ups_campaign_id ON public.follow_ups USING btree (campaign_id);
