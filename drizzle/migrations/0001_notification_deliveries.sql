CREATE TABLE public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL,
  contact_name text,
  kind text NOT NULL DEFAULT 'sos',
  status text NOT NULL DEFAULT 'sending',
  error text,
  attempts integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alert_id, contact_id, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_deliveries TO authenticated;
GRANT ALL ON public.notification_deliveries TO service_role;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own deliveries" ON public.notification_deliveries FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.alerts a WHERE a.id = alert_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.alerts a WHERE a.id = alert_id AND a.user_id = auth.uid()));