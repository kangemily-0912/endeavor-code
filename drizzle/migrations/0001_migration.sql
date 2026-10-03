CREATE TABLE public.event_history (
  id text PRIMARY KEY,
  title text NOT NULL,
  source text NOT NULL,
  venue text,
  town text,
  start_iso text NOT NULL,
  price_gbp numeric,
  url text,
  tags text[] NOT NULL DEFAULT '{}',
  first_seen timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.event_history TO anon, authenticated;
GRANT ALL ON public.event_history TO service_role;
ALTER TABLE public.event_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read event history" ON public.event_history FOR SELECT TO anon, authenticated USING (true);