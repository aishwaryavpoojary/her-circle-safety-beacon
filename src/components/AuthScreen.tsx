import { useState } from "react";
import { Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/lib/app-state";

export function AuthScreen() {
  const { setGuest, online } = useApp();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { display_name: name } },
        });
        if (error) throw error;
        if (!data.session) setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 p-6">
      <div className="text-center">
        <div className="sos-button mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full">
          <Shield className="h-9 w-9" />
        </div>
        <h1 className="text-4xl font-bold">Safe Her</h1>
        <p className="mt-2 text-muted-foreground">Help, one tap away.</p>
      </div>
      {sent ? (
        <div className="rounded-2xl bg-card p-6 text-center">
          <h2 className="text-xl font-semibold">Check your email</h2>
          <p className="mt-2 text-muted-foreground">We sent a confirmation link to {email}. Open it to finish signing up.</p>
          <Button variant="ghost" className="mt-4" onClick={() => { setSent(false); setMode("in"); }}>Back to sign in</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4 rounded-3xl bg-card p-6">
          {mode === "up" && (
            <div className="space-y-2">
              <Label htmlFor="name">Your name (shown in alerts)</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} className="h-12" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw">Password</Label>
            <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" />
          </div>
          <Button type="submit" size="lg" className="h-14 w-full rounded-2xl text-lg" disabled={busy || !online}>
            {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
          </Button>
          {!online && <p className="text-center text-sm text-warning">You're offline. Continue without an account to use Safe Her now.</p>}
          <button type="button" className="w-full text-sm text-muted-foreground underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
          </button>
        </form>
      )}
      <div className="space-y-2">
        <Button variant="secondary" size="lg" className="h-14 w-full rounded-2xl" onClick={() => setGuest(true)}>
          Continue without account
        </Button>
        <p className="text-center text-xs text-muted-foreground">Guest mode keeps everything on this phone. Live tracking links need an account.</p>
      </div>
    </div>
  );
}
