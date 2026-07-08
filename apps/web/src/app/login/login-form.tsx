"use client";

import * as React from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export interface LoginFormProps {
  nextPath: string | null;
  googleEnabled: boolean;
  /** A magic link failed to verify (expired or reused). */
  authError?: boolean;
}

function LoginForm({ nextPath, googleEnabled, authError = false }: LoginFormProps) {
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState<"idle" | "sending" | "sent" | "error">("idle");

  function callbackUrl(): string {
    const url = new URL("/auth/callback", window.location.origin);
    if (nextPath) url.searchParams.set("next", nextPath);
    return url.toString();
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl() },
    });
    setState(error ? "error" : "sent");
  }

  async function signInWithGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
  }

  if (state === "sent") {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
        <MailCheck className="mx-auto size-6 text-accent" aria-hidden />
        <h2 className="mt-3 text-base font-semibold text-foreground">Check your email</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-foreground-secondary">
          We sent a sign-in link to <span className="font-medium text-foreground">{email}</span>.
          It expires in an hour.
        </p>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="mt-4 cursor-pointer text-[0.8125rem] font-medium text-accent hover:underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
      {authError && (
        <p className="mb-4 rounded-md bg-destructive-soft px-3 py-2 text-[0.8125rem] text-destructive">
          That sign-in link didn&apos;t work — it may have expired. Request a new one.
        </p>
      )}
      <form onSubmit={sendMagicLink} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Email me a sign-in link"}
        </Button>
        {state === "error" && (
          <p className="text-[0.8125rem] text-destructive">
            Could not send the link. Check the address and try again.
          </p>
        )}
      </form>

      {googleEnabled && (
        <>
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-foreground-muted">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <Button
            type="button"
            variant="secondary"
            className={cn("w-full")}
            onClick={signInWithGoogle}
          >
            <GoogleMark />
            Continue with Google
          </Button>
        </>
      )}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.02.15 3.5 2.7.24.03c2.2-2.1 3.5-5.1 3.5-8.6Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2a7.2 7.2 0 0 1-6.8-5l-.14.01-3.7 2.85-.05.13A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.2 14.4a7.4 7.4 0 0 1 0-4.7l-.01-.16-3.7-2.9-.12.06a12 12 0 0 0 0 10.8l3.9-3Z"
      />
      <path
        fill="#EB4335"
        d="M12 4.6c2.3 0 3.8 1 4.7 1.8l3.4-3.3C18 1.2 15.2 0 12 0A12 12 0 0 0 1.3 6.6l3.9 3A7.2 7.2 0 0 1 12 4.6Z"
      />
    </svg>
  );
}

export { LoginForm };
