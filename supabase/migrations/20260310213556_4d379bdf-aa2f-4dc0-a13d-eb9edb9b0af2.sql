
-- Follow-ups table for automated follow-up messages
CREATE TABLE public.follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.connections(id) ON DELETE SET NULL,
  flow_id UUID REFERENCES public.chatbot_flows(id) ON DELETE SET NULL,
  step INTEGER NOT NULL DEFAULT 1,
  max_steps INTEGER NOT NULL DEFAULT 3,
  interval_minutes INTEGER NOT NULL DEFAULT 60,
  mode TEXT NOT NULL DEFAULT 'ai',
  status TEXT NOT NULL DEFAULT 'pending',
  message_content TEXT,
  follow_up_prompt TEXT,
  fixed_messages JSONB DEFAULT '[]'::jsonb,
  final_action TEXT DEFAULT 'none',
  transfer_queue_id UUID REFERENCES public.queues(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_follow_ups_status_scheduled ON public.follow_ups(status, scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_follow_ups_conversation ON public.follow_ups(conversation_id);

-- RLS
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view follow ups"
ON public.follow_ups FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage follow ups"
ON public.follow_ups FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.follow_ups;
