/**
 * Config-driven status coloring helpers.
 * Classify statuses by category (done/blocked/default) using configured status lists.
 */

export function getStatusColor(
  status: string,
  doneStatuses: string[],
  blockedStatuses: string[],
): string {
  const lower = status.toLowerCase();
  if (doneStatuses.some(s => s.toLowerCase() === lower))
    return 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30';
  if (blockedStatuses.some(s => s.toLowerCase() === lower))
    return 'bg-rose-500/15 text-rose-300 ring-rose-400/30';
  return 'bg-sky-500/15 text-sky-300 ring-sky-400/30';
}

export function getStatusDotColor(
  status: string,
  doneStatuses: string[],
  blockedStatuses: string[],
): string {
  const lower = status.toLowerCase();
  if (doneStatuses.some(s => s.toLowerCase() === lower)) return 'bg-emerald-400';
  if (blockedStatuses.some(s => s.toLowerCase() === lower)) return 'bg-rose-400';
  return 'bg-sky-400';
}
