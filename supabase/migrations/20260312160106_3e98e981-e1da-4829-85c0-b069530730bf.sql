
-- Drop existing policies that use {authenticated} role
DROP POLICY IF EXISTS "Authenticated users can manage follow ups" ON public.follow_ups;
DROP POLICY IF EXISTS "Authenticated users can view follow ups" ON public.follow_ups;

-- Recreate with {public} role (same pattern as all other tables)
CREATE POLICY "Authenticated users can manage follow ups"
  ON public.follow_ups FOR ALL TO public
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Service role full access (for Edge Functions)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'follow_ups' AND policyname = 'Service role full access follow ups'
  ) THEN
    CREATE POLICY "Service role full access follow ups"
      ON public.follow_ups FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
