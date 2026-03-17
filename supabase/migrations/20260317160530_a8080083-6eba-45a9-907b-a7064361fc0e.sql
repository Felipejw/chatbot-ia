
CREATE POLICY "Authenticated users can update campaigns" 
  ON public.campaigns FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete campaigns" 
  ON public.campaigns FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert campaign contacts" 
  ON public.campaign_contacts FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update campaign contacts" 
  ON public.campaign_contacts FOR UPDATE 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete campaign contacts" 
  ON public.campaign_contacts FOR DELETE 
  USING (auth.uid() IS NOT NULL);
