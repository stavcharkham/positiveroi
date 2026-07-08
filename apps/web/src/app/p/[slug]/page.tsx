import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCachedPublicWorkspace, getPublicImpactData } from "./public-data";
import { PublicImpactView } from "./public-impact-view";

/**
 * The public impact page. Resolves ONLY through getPublicWorkspace — an
 * unknown or unpublished slug is a plain 404 with no enumeration signal.
 * ISR keeps it cheap and fresh enough for a proof page.
 */

export const revalidate = 300;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const workspace = await getCachedPublicWorkspace(slug);
  if (!workspace) return { title: "Not found" };
  return {
    title: `${workspace.name} impact`,
    description: `Hours ${workspace.name}'s builders saved with AI tools, counted with the Undercount methodology.`,
  };
}

export default async function PublicImpactPage({ params }: PageProps) {
  const { slug } = await params;
  const workspace = await getCachedPublicWorkspace(slug);
  if (!workspace) notFound();

  const data = await getPublicImpactData(workspace);

  return (
    <main className="min-h-dvh bg-background">
      <PublicImpactView data={data} config={workspace.public_config} />
    </main>
  );
}
