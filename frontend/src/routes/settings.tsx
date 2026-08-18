import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppLayout } from "@/components/aegis/AppLayout";
import { PageHeader } from "@/components/aegis/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Workspace settings · Aegis" },
      {
        name: "description",
        content:
          "Manage your Aegis workspace: organization details, evaluation defaults, alert thresholds and API access.",
      },
      { property: "og:title", content: "Workspace settings · Aegis" },
      {
        property: "og:description",
        content: "Organization details, evaluation defaults and alerting for your Aegis workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <AppLayout
      title="Settings"
      crumbs={[{ label: "Aegis", to: "/dashboard" }, { label: "Settings" }]}
    >
      <PageHeader title="Workspace settings" subtitle="Configure defaults for every evaluation run." />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium">Organization</h2>
          <div className="space-y-2">
            <Label htmlFor="org">Workspace name</Label>
            <Input id="org" defaultValue="Aegis Labs" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Alert email</Label>
            <Input id="email" type="email" defaultValue="reliability@aegis.dev" />
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium">Evaluation defaults</h2>
          <div className="space-y-2">
            <Label htmlFor="scenarios">Scenarios per run</Label>
            <Input id="scenarios" type="number" defaultValue={50} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="threshold">Critical score threshold</Label>
            <Input id="threshold" type="number" defaultValue={65} />
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="text-sm font-medium">Automation</h2>
          {[
            ["Adversarial scenarios", "Inject prompt-injection and jailbreak variants in every run."],
            ["Regression alerts", "Notify when reliability drops more than 5 points."],
            ["Auto re-run on failure", "Re-run failed scenarios once to filter out flakiness."],
          ].map(([title, detail]) => (
            <div key={title} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{detail}</p>
              </div>
              <Switch defaultChecked />
            </div>
          ))}
        </section>
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="hero" onClick={() => toast.success("Settings saved")}>
          Save changes
        </Button>
      </div>
    </AppLayout>
  );
}
