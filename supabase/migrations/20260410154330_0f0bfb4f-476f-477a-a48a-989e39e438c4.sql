
CREATE OR REPLACE FUNCTION public.increment_campaign_sent(campaign_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE campaigns 
  SET sent_count = COALESCE(sent_count, 0) + 1,
      updated_at = now()
  WHERE id = campaign_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_campaign_failed(campaign_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE campaigns 
  SET failed_count = COALESCE(failed_count, 0) + 1,
      updated_at = now()
  WHERE id = campaign_id;
END;
$$;
