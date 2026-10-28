CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile delete" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  phone text NOT NULL,
  relation text,
  priority int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own contacts" ON public.contacts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.enforce_contact_limit() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.contacts WHERE user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'You can save at most 5 trusted contacts';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER contacts_limit BEFORE INSERT ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.enforce_contact_limit();

CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL DEFAULT 'sos',
  status text NOT NULL DEFAULT 'active',
  is_test boolean NOT NULL DEFAULT false,
  sender_name text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  start_lat double precision,
  start_lng double precision,
  tracking_token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own alerts" ON public.alerts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.alert_locations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alert_id uuid NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy double precision,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.alert_locations TO authenticated;
GRANT ALL ON public.alert_locations TO service_role;
ALTER TABLE public.alert_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own alert locations" ON public.alert_locations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.alerts a WHERE a.id = alert_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.alerts a WHERE a.id = alert_id AND a.user_id = auth.uid() AND a.status = 'active'));
CREATE INDEX ON public.alert_locations (alert_id, recorded_at);

CREATE TABLE public.alert_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  responder_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.alert_responses TO authenticated;
GRANT ALL ON public.alert_responses TO service_role;
ALTER TABLE public.alert_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads responses" ON public.alert_responses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.alerts a WHERE a.id = alert_id AND a.user_id = auth.uid()));
CREATE POLICY "owner deletes responses" ON public.alert_responses FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.alerts a WHERE a.id = alert_id AND a.user_id = auth.uid()));

-- Public tracking: token-gated reads via security definer functions only
CREATE OR REPLACE FUNCTION public.get_tracking(_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.alerts; locs jsonb;
BEGIN
  SELECT * INTO a FROM public.alerts WHERE tracking_token = _token;
  IF NOT FOUND THEN RETURN jsonb_build_object('found', false); END IF;
  IF a.status <> 'active' OR a.expires_at < now() THEN
    RETURN jsonb_build_object('found', true, 'active', false, 'sender_name', a.sender_name, 'ended_at', a.ended_at);
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('lat', lat, 'lng', lng, 'accuracy', accuracy, 'recorded_at', recorded_at) ORDER BY recorded_at), '[]'::jsonb)
    INTO locs FROM (SELECT * FROM public.alert_locations WHERE alert_id = a.id ORDER BY recorded_at DESC LIMIT 500) l;
  RETURN jsonb_build_object('found', true, 'active', true, 'kind', a.kind, 'sender_name', a.sender_name,
    'started_at', a.started_at, 'expires_at', a.expires_at, 'start_lat', a.start_lat, 'start_lng', a.start_lng, 'locations', locs);
END $$;
GRANT EXECUTE ON FUNCTION public.get_tracking(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.respond_to_alert(_token text, _name text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.alerts;
BEGIN
  SELECT * INTO a FROM public.alerts WHERE tracking_token = _token AND status = 'active' AND expires_at > now();
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.alert_responses (alert_id, responder_name) VALUES (a.id, left(COALESCE(NULLIF(trim(_name),''),'A contact'), 60));
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.respond_to_alert(text, text) TO anon, authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.alert_responses;