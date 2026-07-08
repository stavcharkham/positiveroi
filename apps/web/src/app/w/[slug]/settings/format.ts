/**
 * Display formatting for settings lists. Pages format on the server and pass
 * plain strings to client panels — no hydration drift from clocks.
 */

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/** "just now", "14m ago", "3h ago", "6d ago", then the date. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const ms = now.getTime() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return formatDate(iso);
}

/** "expires in 9 days", "expires today". */
export function expiresIn(iso: string, now: Date = new Date()): string {
  const days = Math.ceil(
    (new Date(iso).getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (days <= 0) return "expires today";
  if (days === 1) return "expires tomorrow";
  return `expires in ${days} days`;
}
