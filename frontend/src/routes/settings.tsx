import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useWorkspaceSettings, type WorkspaceSettings } from "@/lib/workspace-settings";
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

// Every control here changes what the app does. "Regression alerts" and "Auto
// re-run on failure" used to sit alongside these and changed nothing at all —
// there is no mailer and no post-run hook behind them — so they were removed
// rather than left as switches that toggle a value nobody reads.
const automation: { key: keyof WorkspaceSettings; title: string; detail: string }[] = [
  {
    key: "adversarial",
    title: "Adversarial scenarios",
    detail: "Inject prompt-injection and jailbreak variants in every run.",
  },
];

function SettingsPage() {
  const { settings, update, persist } = useWorkspaceSettings();

  return (
    <AppLayout
      title="Settings"
      crumbs={[{ label: "Aegis", to: "/dashboard" }, { label: "Settings" }]}
    >
      <PageHeader
        title="Workspace settings"
        subtitle="Configure defaults for every evaluation run."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium">Organization</h2>
          <div className="space-y-2">
            <Label htmlFor="org">Workspace name</Label>
            <Input
              id="org"
              value={settings.workspaceName}
              onChange={(e) => update({ workspaceName: e.target.value })}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Shown in the sidebar. Settings are stored in this browser only — there are no accounts,
            so they do not follow you to another device.
          </p>
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-medium">Evaluation defaults</h2>
          <div className="space-y-2">
            <Label htmlFor="scenarios">Scenarios per run</Label>
            <Input
              id="scenarios"
              type="number"
              min={4}
              max={40}
              value={settings.scenariosPerRun}
              onChange={(e) => update({ scenariosPerRun: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">
              Applied to every run started from Aegis, rounded to a whole number per category.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="threshold">Critical score threshold</Label>
            <Input
              id="threshold"
              type="number"
              min={0}
              max={100}
              value={settings.criticalThreshold}
              onChange={(e) => update({ criticalThreshold: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">
              Scores below this read as Critical Risk; the reliability bands above it shift with it,
              everywhere in the app.
            </p>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="text-sm font-medium">Automation</h2>
          {automation.map(({ key, title, detail }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{detail}</p>
              </div>
              <Switch
                checked={Boolean(settings[key])}
                onCheckedChange={(checked) => update({ [key]: checked })}
              />
            </div>
          ))}
        </section>
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          variant="hero"
          onClick={() => {
            persist(settings);
            toast.success("Settings saved");
          }}
        >
          Save changes
        </Button>
      </div>
    </AppLayout>
  );
}
