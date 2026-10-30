ALTER TABLE public.notification_deliveries ADD COLUMN IF NOT EXISTS contact_phone text;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_deliveries TO authenticated;
GRANT ALL ON public.notification_deliveries TO service_role;