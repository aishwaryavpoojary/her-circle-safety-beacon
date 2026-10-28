import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { kvGet, kvSet } from "@/lib/db";
import { buildEmergencyMessage, detectPlatform, randomToken, smsUri } from "@/lib/geo";
import { DEFAULT_SETTINGS, MAX_CONTACTS, type Contact, type Settings } from "@/lib/settings";
import { getPosition, watchAdaptive, type Fix } from "@/services/location";
import { flushQueue, pushPoint } from "@/services/offlineQueue";
import { vibrate } from "@/services/ringtone";
import { sendSosSms } from "@/server/sos.functions";
import { triggerManager, type TriggerSource } from "@/triggers/TriggerManager";
import { shakeTrigger } from "@/triggers/shake";

export type ActiveSession = {
  kind: "sos" | "trip";
  alertId: string | null; // null = offline / guest (no server record)
  token: string | null;
  startedAt: number;
  endsAt: number | null; // trips only
  isTest: boolean;
  notified: string[];
  channel: "server" | "sms-app" | "test";
  message: string;
  smsLink: string | null;
};

type Responder = { id: string; name: string; at: string };

type Ctx = {
  ready: boolean;
  session: Session | null;
  guest: boolean;
  setGuest: (v: boolean) => void;
  online: boolean;
  settings: Settings;
  updateSettings: (p: Partial<Settings>) => void;
  contacts: Contact[];
  contactsLoading: boolean;
  saveContact: (c: Omit<Contact, "id"> & { id?: string }) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
  countdown: { source: TriggerSource; remaining: number } | null;
  startCountdown: (source: TriggerSource) => void;
  cancelCountdown: () => void;
  active: ActiveSession | null;
  triggering: boolean;
  lastFix: Fix | null;
  responders: Responder[];
  startTrip: (contactIds: string[], minutes: number) => Promise<void>;
  endActive: (opts: { sendAllClear: boolean }) => Promise<void>;
  trackingUrl: (token: string) => string;
  signOut: () => Promise<void>;
};

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
};

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [guest, setGuestState] = useState(false);
  const [online, setOnline] = useState(true);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [countdown, setCountdown] = useState<Ctx["countdown"]>(null);
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [lastFix, setLastFix] = useState<Fix | null>(null);
  const [responders, setResponders] = useState<Responder[]>([]);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // ---- bootstrap
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => {
      setOnline(true);
      void flushQueue();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    (async () => {
      const [s, g, a, f] = await Promise.all([
        kvGet<Settings>("settings"),
        kvGet<boolean>("guest"),
        kvGet<ActiveSession>("active"),
        kvGet<Fix>("lastFix"),
      ]);
      if (s) setSettings({ ...DEFAULT_SETTINGS, ...s, fakeCaller: { ...DEFAULT_SETTINGS.fakeCaller, ...s.fakeCaller } });
      if (g) setGuestState(true);
      if (a && (!a.endsAt || a.endsAt > Date.now())) setActive(a);
      if (f) setLastFix(f);
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setReady(true);
      void flushQueue();
    })();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      sub.subscription.unsubscribe();
    };
  }, []);

  const setGuest = (v: boolean) => {
    setGuestState(v);
    void kvSet("guest", v);
  };

  const updateSettings = useCallback((p: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...p };
      void kvSet("settings", next);
      return next;
    });
  }, []);

  // ---- contacts (server when signed in, IndexedDB mirror always)
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!ready) return;
    let cancel = false;
    (async () => {
      setContactsLoading(true);
      const local = (await kvGet<Contact[]>(userId ? `contacts:${userId}` : "contacts:guest")) ?? [];
      if (!cancel) setContacts(local);
      if (userId && navigator.onLine) {
        const { data, error } = await supabase.from("contacts").select("id,name,phone,relation,priority").order("priority");
        if (!error && data && !cancel) {
          setContacts(data);
          await kvSet(`contacts:${userId}`, data);
        }
        const { data: prof } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
        if (prof?.display_name && !settingsRef.current.displayName) updateSettings({ displayName: prof.display_name });
      }
      if (!cancel) setContactsLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [ready, userId, updateSettings]);

  const persistContacts = async (list: Contact[]) => {
    setContacts(list);
    await kvSet(userId ? `contacts:${userId}` : "contacts:guest", list);
  };

  const saveContact: Ctx["saveContact"] = async (c) => {
    if (!c.id && contacts.length >= MAX_CONTACTS) throw new Error(`You can save at most ${MAX_CONTACTS} contacts`);
    if (userId) {
      if (!navigator.onLine) throw new Error("Connect to the internet to change contacts");
      const row = { name: c.name, phone: c.phone, relation: c.relation, priority: c.priority };
      const res = c.id
        ? await supabase.from("contacts").update(row).eq("id", c.id).select("id,name,phone,relation,priority").single()
        : await supabase.from("contacts").insert(row).select("id,name,phone,relation,priority").single();
      if (res.error) throw new Error(res.error.message);
      const next = c.id ? contacts.map((x) => (x.id === c.id ? res.data : x)) : [...contacts, res.data];
      await persistContacts(next.sort((a, b) => a.priority - b.priority));
    } else {
      const item: Contact = { ...c, id: c.id ?? crypto.randomUUID() } as Contact;
      const next = c.id ? contacts.map((x) => (x.id === c.id ? item : x)) : [...contacts, item];
      await persistContacts(next.sort((a, b) => a.priority - b.priority));
    }
  };

  const deleteContact = async (id: string) => {
    if (userId) {
      if (!navigator.onLine) throw new Error("Connect to the internet to change contacts");
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw new Error(error.message);
    }
    await persistContacts(contacts.filter((c) => c.id !== id));
  };

  const trackingUrl = (token: string) => `${window.location.origin}/track/${token}`;

  const saveActive = (a: ActiveSession | null) => {
    setActive(a);
    void kvSet("active", a);
  };

  // ---- SOS trigger
  const contactsRef = useRef(contacts);
  contactsRef.current = contacts;
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const triggerSos = useCallback(async () => {
    setTriggering(true);
    const s = settingsRef.current;
    const list = contactsRef.current;
    const isTest = s.testMode;
    try {
      const { fix } = await getPosition(6000);
      if (fix) setLastFix(fix);
      const ageMin = fix ? (Date.now() - fix.at) / 60000 : undefined;
      const sess = sessionRef.current;
      let alertId: string | null = null;
      let token: string | null = null;

      if (sess && navigator.onLine) {
        token = randomToken();
        const { data, error } = await supabase
          .from("alerts")
          .insert({
            kind: "sos",
            tracking_token: token,
            is_test: isTest,
            sender_name: s.displayName || sess.user.email?.split("@")[0] || "Safe Her user",
            start_lat: fix?.lat ?? null,
            start_lng: fix?.lng ?? null,
          })
          .select("id")
          .single();
        if (!error && data) {
          alertId = data.id;
          if (fix)
            void pushPoint({ alert_id: alertId, lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, recorded_at: new Date(fix.at).toISOString() });
        } else token = null;
      }

      const message = buildEmergencyMessage({
        lat: fix?.lat,
        lng: fix?.lng,
        at: new Date(),
        ageMinutes: ageMin,
        trackingUrl: token ? trackingUrl(token) : undefined,
      });
      const link = list.length ? smsUri(list.map((c) => c.phone), message, detectPlatform()) : null;

      const base: ActiveSession = {
        kind: "sos",
        alertId,
        token,
        startedAt: Date.now(),
        endsAt: null,
        isTest,
        notified: [],
        channel: "sms-app",
        message,
        smsLink: link,
      };

      if (alertId && list.length) {
        try {
          const r = await withTimeout(sendSosSms({ data: { alertId, type: "sos", appUrl: window.location.origin } }), 5000);
          saveActive({ ...base, channel: r.test ? "test" : "server", notified: r.recipients });
          toast.success(r.test ? "Test SOS: no real messages sent" : `SOS sent to ${r.sent} contact(s)`);
          return;
        } catch (e) {
          console.warn("Server SMS failed, using SMS app", e);
        }
      }
      // Fallback: phone SMS composer (works offline)
      if (isTest) {
        saveActive({ ...base, channel: "test", notified: list.map((c) => c.name) });
        toast.message("Test SOS: the SMS app was not opened");
      } else {
        saveActive({ ...base, notified: list.map((c) => c.name) });
        if (link) window.location.href = link;
        else toast.error("Add trusted contacts so SOS can reach someone");
      }
    } finally {
      setTriggering(false);
    }
  }, []);

  // countdown
  const startCountdown = useCallback((source: TriggerSource) => {
    setCountdown((c) => c ?? { source, remaining: 5 });
  }, []);
  const cancelCountdown = () => setCountdown(null);
  useEffect(() => {
    if (!countdown) return;
    vibrate(200);
    if (countdown.remaining <= 0) {
      setCountdown(null);
      vibrate([400, 100, 400]);
      void triggerSos();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c ? { ...c, remaining: c.remaining - 1 } : null)), 1000);
    return () => clearTimeout(t);
  }, [countdown, triggerSos]);

  // trigger manager wiring
  useEffect(() => triggerManager.onTrigger((src) => startCountdown(src)), [startCountdown]);
  useEffect(() => {
    if (settings.shakeEnabled) triggerManager.registerTrigger(shakeTrigger(settings.shakeSensitivity));
    else triggerManager.unregisterTrigger("shake");
    return () => triggerManager.unregisterTrigger("shake");
  }, [settings.shakeEnabled, settings.shakeSensitivity]);

  // ---- live location while active
  useEffect(() => {
    if (!active) return;
    const alertId = active.alertId;
    const stop = watchAdaptive(
      (f) => {
        setLastFix(f);
        if (alertId) void pushPoint({ alert_id: alertId, lat: f.lat, lng: f.lng, accuracy: f.accuracy, recorded_at: new Date(f.at).toISOString() });
      },
      (msg) => console.warn("watch error", msg),
    );
    let expiry: ReturnType<typeof setTimeout> | undefined;
    if (active.endsAt) expiry = setTimeout(() => void endActiveRef.current({ sendAllClear: false }), Math.max(0, active.endsAt - Date.now()));
    return () => {
      stop();
      if (expiry) clearTimeout(expiry);
    };
  }, [active?.alertId, active?.startedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // responders ("I'm responding") via realtime
  useEffect(() => {
    const alertId = active?.alertId;
    setResponders([]);
    if (!alertId) return;
    void supabase
      .from("alert_responses")
      .select("id,responder_name,created_at")
      .eq("alert_id", alertId)
      .then(({ data }) => data && setResponders(data.map((r) => ({ id: r.id, name: r.responder_name ?? "A contact", at: r.created_at }))));
    const ch = supabase
      .channel(`responses-${alertId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alert_responses", filter: `alert_id=eq.${alertId}` }, (p) => {
        const r = p.new as { id: string; responder_name: string | null; created_at: string };
        setResponders((prev) => [...prev, { id: r.id, name: r.responder_name ?? "A contact", at: r.created_at }]);
        vibrate([100, 50, 100]);
        toast.success(`${r.responder_name ?? "A contact"} is responding`);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [active?.alertId]);

  const startTrip: Ctx["startTrip"] = async (contactIds, minutes) => {
    const sess = session;
    if (!sess) throw new Error("Sign in to share a live trip link");
    if (!navigator.onLine) throw new Error("You need internet to start a trip share");
    const { fix } = await getPosition(6000);
    const token = randomToken();
    const endsAt = Date.now() + minutes * 60000;
    const { data, error } = await supabase
      .from("alerts")
      .insert({
        kind: "trip",
        tracking_token: token,
        is_test: settings.testMode,
        sender_name: settings.displayName || sess.user.email?.split("@")[0] || "Safe Her user",
        start_lat: fix?.lat ?? null,
        start_lng: fix?.lng ?? null,
        expires_at: new Date(Math.min(endsAt, Date.now() + 86400000)).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    if (fix) void pushPoint({ alert_id: data.id, lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, recorded_at: new Date(fix.at).toISOString() });
    const chosen = contacts.filter((c) => contactIds.includes(c.id));
    const message = `I'm sharing my trip with you. Follow live: ${trackingUrl(token)} - Safe Her`;
    const link = smsUri(chosen.map((c) => c.phone), message, detectPlatform());
    const base: ActiveSession = { kind: "trip", alertId: data.id, token, startedAt: Date.now(), endsAt, isTest: settings.testMode, notified: chosen.map((c) => c.name), channel: "server", message, smsLink: link };
    try {
      const r = await withTimeout(sendSosSms({ data: { alertId: data.id, type: "trip", appUrl: window.location.origin, contactIds } }), 5000);
      saveActive({ ...base, channel: r.test ? "test" : "server" });
      toast.success(r.test ? "Test trip: no real messages sent" : "Trip link sent");
    } catch {
      saveActive({ ...base, channel: settings.testMode ? "test" : "sms-app" });
      if (!settings.testMode) window.location.href = link;
    }
  };

  const endActive: Ctx["endActive"] = async ({ sendAllClear }) => {
    const a = active;
    if (!a) return;
    saveActive(null);
    if (a.alertId && navigator.onLine) {
      await flushQueue();
      await supabase.from("alerts").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", a.alertId);
    }
    if (!sendAllClear || a.kind !== "sos") return;
    if (a.alertId && navigator.onLine) {
      try {
        const r = await withTimeout(sendSosSms({ data: { alertId: a.alertId, type: "allclear", appUrl: window.location.origin } }), 5000);
        toast.success(r.test ? "Test: all-clear not sent" : "All-clear sent to your contacts");
        return;
      } catch {
        /* fall through */
      }
    }
    if (a.isTest) return void toast.message("Test: all-clear not sent");
    const list = contactsRef.current;
    if (list.length) window.location.href = smsUri(list.map((c) => c.phone), "I'm safe now. Thank you. - Safe Her", detectPlatform());
  };
  const endActiveRef = useRef(endActive);
  endActiveRef.current = endActive;

  const signOut = async () => {
    await supabase.auth.signOut();
    setGuest(false);
  };

  const value = useMemo<Ctx>(
    () => ({
      ready, session, guest, setGuest, online, settings, updateSettings, contacts, contactsLoading,
      saveContact, deleteContact, countdown, startCountdown, cancelCountdown, active, triggering,
      lastFix, responders, startTrip, endActive, trackingUrl, signOut,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, session, guest, online, settings, contacts, contactsLoading, countdown, active, triggering, lastFix, responders],
  );
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
