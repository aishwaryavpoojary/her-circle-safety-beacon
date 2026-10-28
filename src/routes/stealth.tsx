import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/stealth")({
  head: () => ({ meta: [{ title: "stealth — Safe Her" }, { name: "description", content: "Safe Her stealth" }, { property: "og:title", content: "stealth — Safe Her" }, { property: "og:description", content: "Safe Her stealth" }] }),
  component: () => (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-bold capitalize">stealth</h1>
      <p className="mt-2 text-muted-foreground">This screen isn't built yet.</p>
    </div>
  ),
});
