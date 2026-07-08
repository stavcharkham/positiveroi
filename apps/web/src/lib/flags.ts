/**
 * Deployment flavor. The ONLY file that reads NEXT_PUBLIC_DEPLOYMENT.
 * Anything not explicitly "hosted" is treated as self-hosted — the safe
 * default for open-source installs that never set the variable.
 */

export function isHosted(): boolean {
  return process.env.NEXT_PUBLIC_DEPLOYMENT === "hosted";
}

export function isSelfHosted(): boolean {
  return !isHosted();
}
