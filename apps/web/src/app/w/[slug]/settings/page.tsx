import type { Metadata } from "next";
import { requireMember } from "@/lib/guards";
import { isHosted } from "@/lib/flags";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GeneralForm } from "./general-form";

export const metadata: Metadata = { title: "Settings" };

export default async function GeneralSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { workspace } = await requireMember(slug, "admin");

  return (
    <div className="space-y-8">
      <GeneralForm
        slug={slug}
        initial={{
          name: workspace.name,
          hourlyRateDollars: workspace.hourly_rate_cents / 100,
          currency: workspace.currency.trim(),
          timezone: workspace.timezone,
        }}
      />
      {isHosted() && <PlanCard />}
    </div>
  );
}

function PlanCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan</CardTitle>
        <CardDescription>
          Free while in beta. Every feature is included.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <Button asChild variant="secondary" size="sm">
          <a href="mailto:stavchark@gmail.com?subject=PositiveROI%20upgrade">
            Contact to upgrade
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
