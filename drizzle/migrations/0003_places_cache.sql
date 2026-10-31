CREATE TABLE public.places_cache (
  key text PRIMARY KEY,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.places_cache TO anon;
GRANT SELECT, INSERT, UPDATE ON public.places_cache TO authenticated;
GRANT ALL ON public.places_cache TO service_role;
ALTER TABLE public.places_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "places cache is readable by everyone" ON public.places_cache FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "places cache is insertable by everyone" ON public.places_cache FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "places cache is updatable by everyone" ON public.places_cache FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);