import type { Metadata } from "next";
import { requireUser } from "@/lib/guards";
import { OnboardingFlow } from "./onboarding-flow";

export const metadata: Metadata = { title: "Create your workspace" };

export default async function OnboardingPage() {
  await requireUser();
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <OnboardingFlow />
    </main>
  );
}
