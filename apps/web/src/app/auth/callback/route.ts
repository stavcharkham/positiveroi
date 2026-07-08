import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { landingPath, safeNextPath } from "@/lib/landing";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth callback for both flows: OAuth/PKCE (`code`) and email OTP links
 * (`token_hash` + `type`). Success lands on ?next= when it is a safe
 * relative path, otherwise on the user's workspace (or /onboarding).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(url.searchParams.get("next"));

  const supabase = await createClient();

  let authed = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authed = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    authed = !error;
  }

  if (!authed) {
    return NextResponse.redirect(new URL("/login?error=auth", url.origin));
  }

  const dest = next ?? (await landingPath(supabase));
  return NextResponse.redirect(new URL(dest, url.origin));
}
