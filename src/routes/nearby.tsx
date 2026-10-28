import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/nearby")({
  head: () => ({ meta: [{ title: "nearby — Safe Her" }, { name: "description", content: "Safe Her nearby" }, { property: "og:title", content: "nearby — Safe Her" }, { property: "og:description", content: "Safe Her nearby" }] }),
  component: () => (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-bold capitalize">nearby</h1>
      <p className="mt-2 text-muted-foreground">This screen isn't built yet.</p>
    </div>
  ),
});
