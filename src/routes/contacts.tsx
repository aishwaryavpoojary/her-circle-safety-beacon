import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Phone, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/lib/app-state";
import { MAX_CONTACTS, type Contact } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/contacts")({
  head: () => ({
    meta: [
      { title: "Trusted contacts — Safe Her" },
      { name: "description", content: "Choose up to 5 trusted people who receive your SOS alerts and live location." },
      { property: "og:title", content: "Trusted contacts — Safe Her" },
      { property: "og:description", content: "Up to 5 people who receive your SOS alerts." },
    ],
  }),
  component: Contacts,
});

type Draft = { id?: string; name: string; phone: string; relation: string; priority: number };

function Contacts() {
  const { contacts, contactsLoading, saveContact, deleteContact, session } = useApp();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const open = (c?: Contact) =>
    setDraft(c ? { ...c, relation: c.relation ?? "" } : { name: "", phone: "", relation: "", priority: contacts.length + 1 });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    if (!/^\+?[\d\s()-]{6,20}$/.test(draft.phone)) return void toast.error("Enter a valid phone number with country code, e.g. +91 98765 43210");
    setBusy(true);
    try {
      await saveContact({ ...draft, name: draft.name.trim(), relation: draft.relation.trim() || null });
      setDraft(null);
      toast.success("Contact saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trusted contacts</h1>
          <p className="text-sm text-muted-foreground">{contacts.length}/{MAX_CONTACTS} · {session ? "synced & saved on this phone" : "saved on this phone"}</p>
        </div>
        <Button onClick={() => open()} disabled={contacts.length >= MAX_CONTACTS} className="h-12 rounded-2xl">
          <Plus className="mr-1 h-5 w-5" /> Add
        </Button>
      </header>

      {contactsLoading && contacts.length === 0 ? (
        <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : contacts.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-10 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">No trusted contacts yet</p>
          <p className="text-sm text-muted-foreground">Add the people who should get your SOS.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-card p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent font-display text-lg font-bold">{c.priority}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{c.name}</p>
                <p className="truncate text-sm text-muted-foreground">{c.phone}{c.relation ? ` · ${c.relation}` : ""}</p>
              </div>
              <a href={`tel:${c.phone}`} aria-label={`Call ${c.name}`} className="rounded-full p-3 text-success"><Phone className="h-5 w-5" /></a>
              <button aria-label="Edit" onClick={() => open(c)} className="rounded-full p-3 text-muted-foreground"><Pencil className="h-5 w-5" /></button>
              <button
                aria-label="Delete"
                className="rounded-full p-3 text-destructive"
                onClick={async () => {
                  if (!confirm(`Remove ${c.name}?`)) return;
                  try { await deleteContact(c.id); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                }}
              ><Trash2 className="h-5 w-5" /></button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">Contacts only receive a message when you send an SOS or share a trip — that link is their invitation to see your location.</p>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{draft?.id ? "Edit contact" : "New contact"}</DialogTitle></DialogHeader>
          {draft && (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="cn">Name</Label><Input id="cn" required maxLength={60} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-12" /></div>
              <div className="space-y-2"><Label htmlFor="cp">Phone (with country code)</Label><Input id="cp" type="tel" required placeholder="+91 98765 43210" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className="h-12" /></div>
              <div className="space-y-2"><Label htmlFor="cr">Relation</Label><Input id="cr" maxLength={30} placeholder="Sister, friend…" value={draft.relation} onChange={(e) => setDraft({ ...draft, relation: e.target.value })} className="h-12" /></div>
              <div className="space-y-2"><Label htmlFor="cpr">Priority (1 = first)</Label><Input id="cpr" type="number" min={1} max={5} value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) || 1 })} className="h-12" /></div>
              <Button type="submit" className="h-12 w-full rounded-2xl" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
