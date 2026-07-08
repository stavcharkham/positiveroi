import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { landingPath, safeNextPath } from "@/lib/landing";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(next ?? (await landingPath(supabase)));

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex size-11 items-center justify-center rounded-lg bg-accent-soft">
            <svg
              viewBox="0 0 24 24"
              className="size-5 text-accent"
              fill="currentColor"
              aria-hidden
            >
              <path d="M13 2 4.5 13.5h5L10 22l8.5-11.5h-5L13 2Z" />
            </svg>
          </div>
          <h1 className="numeral mt-4 text-3xl text-foreground">PositiveROI</h1>
          <p className="mt-1.5 text-sm text-foreground-secondary">
            Proof of what your AI tools are worth.
          </p>
        </div>
        <LoginForm
          nextPath={next}
          googleEnabled={process.env.NEXT_PUBLIC_AUTH_GOOGLE === "true"}
          authError={params.error === "auth"}
        />
      </div>
    </main>
  );
}
