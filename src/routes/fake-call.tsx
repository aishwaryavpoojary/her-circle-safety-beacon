import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/fake-call")({
  head: () => ({ meta: [{ title: "fake call — Safe Her" }, { name: "description", content: "Safe Her fake call" }, { property: "og:title", content: "fake call — Safe Her" }, { property: "og:description", content: "Safe Her fake call" }] }),
  component: () => (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-bold capitalize">fake call</h1>
      <p className="mt-2 text-muted-foreground">This screen isn't built yet.</p>
    </div>
  ),
});
