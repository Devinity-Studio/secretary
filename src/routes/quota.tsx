import { createFileRoute } from "@tanstack/react-router";
import { QuotaCard } from "@/components/quota-card";

export const Route = createFileRoute("/quota")({
  component: QuotaPage,
});

function QuotaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">AI Usage</h1>
        <p className="mt-1 text-sm text-muted">
          ติดตามการใช้ Grok API / xAI quota
        </p>
      </div>
      <QuotaCard />
    </div>
  );
}
