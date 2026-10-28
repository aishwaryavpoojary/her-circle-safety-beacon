import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/trip")({
  head: () => ({ meta: [{ title: "trip — Safe Her" }, { name: "description", content: "Safe Her trip" }, { property: "og:title", content: "trip — Safe Her" }, { property: "og:description", content: "Safe Her trip" }] }),
  component: () => (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-bold capitalize">trip</h1>
      <p className="mt-2 text-muted-foreground">This screen isn't built yet.</p>
    </div>
  ),
});
