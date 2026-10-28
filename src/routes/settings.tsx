import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "settings — Safe Her" }, { name: "description", content: "Safe Her settings" }, { property: "og:title", content: "settings — Safe Her" }, { property: "og:description", content: "Safe Her settings" }] }),
  component: () => (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-bold capitalize">settings</h1>
      <p className="mt-2 text-muted-foreground">This screen isn't built yet.</p>
    </div>
  ),
});
