import type { Metadata } from "next";
import { headers } from "next/headers";
import { requireMember } from "@/lib/guards";
import { getPublicImpactData } from "@/app/p/[slug]/public-data";
import { PublicConfigForm } from "./public-config-form";

export const metadata: Metadata = { title: "Public page" };

export default async function PublicSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { workspace } = await requireMember(slug, "admin");

  // Same aggregates the live page uses — the preview IS the page.
  const data = await getPublicImpactData(workspace);

  return (
    <PublicConfigForm
      slug={slug}
      origin={await requestOrigin()}
      initial={{
        enabled: workspace.public_enabled,
        publicSlug: workspace.public_slug ?? workspace.slug,
        showTools: workspace.public_config.show_tools,
        showBuilders: workspace.public_config.show_builders,
        showMoney: workspace.public_config.show_money,
      }}
      data={data}
    />
  );
}

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
