import { getAllTickets, FINAL_STATUSES } from './ticket.service.js';
import type { ProcessedTicket, EpicSummary } from '../../shared/types.js';

const BUG_TYPES = new Set(['bug', 'defect']);
const BLOCKED_STATUSES = new Set(['blocked']);

/**
 * Group tickets by parent_key and compute epic summaries with risk scores.
 */
export function getEpicSummaries(): EpicSummary[] {
  const allTickets = getAllTickets();

  // Group by parent key
  const epicMap = new Map<string, { summary: string; tickets: ProcessedTicket[] }>();

  for (const ticket of allTickets) {
    if (!ticket.parent_key) continue;
    if (!epicMap.has(ticket.parent_key)) {
      epicMap.set(ticket.parent_key, {
        summary: ticket.parent_summary || ticket.parent_key,
        tickets: [],
      });
    }
    epicMap.get(ticket.parent_key)!.tickets.push(ticket);
  }

  const summaries: EpicSummary[] = [];

  for (const [key, { summary, tickets }] of epicMap) {
    if (tickets.length === 0) continue;

    const resolved = tickets.filter(t => FINAL_STATUSES.includes(t.status));
    const totalSP = tickets.reduce((s, t) => s + (t.story_points ?? 0), 0);
    const resolvedSP = resolved.reduce((s, t) => s + (t.story_points ?? 0), 0);
    const progressPct = tickets.length > 0 ? Math.round((resolved.length / tickets.length) * 100) / 100 : 0;

    // Avg cycle time across resolved tickets with hours
    const ticketsWithHours = resolved.filter(t => t.eng_hours);
    const avgCycleTime = ticketsWithHours.length > 0
      ? Math.round((ticketsWithHours.reduce((s, t) => s + t.eng_hours!, 0) / ticketsWithHours.length) * 10) / 10
      : null;

    // Risk score computation
    const { riskScore, riskFactors } = computeRisk(tickets, resolved, avgCycleTime, progressPct);
    const riskLevel = riskScore <= 0.3 ? 'low' : riskScore <= 0.6 ? 'medium' : 'high';

    summaries.push({
      key,
      summary,
      totalTickets: tickets.length,
      resolvedTickets: resolved.length,
      totalSP: Math.round(totalSP * 10) / 10,
      resolvedSP: Math.round(resolvedSP * 10) / 10,
      progressPct,
      avgCycleTime,
      riskScore: Math.round(riskScore * 100) / 100,
      riskLevel,
      riskFactors,
      childTickets: tickets,
    });
  }

  // Sort by risk score descending (highest risk first)
  summaries.sort((a, b) => b.riskScore - a.riskScore);
  return summaries;
}

/**
 * Get detailed epic information for a specific epic key.
 */
export function getEpicDetail(epicKey: string): EpicSummary | null {
  const all = getEpicSummaries();
  return all.find(e => e.key === epicKey) ?? null;
}

/**
 * Compute risk score and human-readable risk factors.
 *
 * riskScore = weighted sum of:
 *   - (1 - progressPct) * 0.3     // low progress = higher risk
 *   - overdueRatio * 0.3          // tickets past average cycle time
 *   - blockedRatio * 0.2          // tickets currently blocked
 *   - bugRatio * 0.1              // bugs in the epic
 *   - reopenRatio * 0.1           // tickets that cycled back (approximated by non-final status after being resolved)
 */
function computeRisk(
  allTickets: ProcessedTicket[],
  resolved: ProcessedTicket[],
  avgCycleTime: number | null,
  progressPct: number,
): { riskScore: number; riskFactors: string[] } {
  const factors: string[] = [];
  const total = allTickets.length;
  if (total === 0) return { riskScore: 0, riskFactors: [] };

  // 1. Progress factor
  const progressFactor = (1 - progressPct) * 0.3;
  if (progressPct < 0.5) {
    const inProgress = total - resolved.length;
    factors.push(`Only ${Math.round(progressPct * 100)}% complete with ${inProgress} of ${total} tickets still open`);
  }

  // 2. Overdue factor — tickets with eng_hours > 2x avg cycle time
  let overdueFactor = 0;
  if (avgCycleTime && avgCycleTime > 0) {
    const overdue = allTickets.filter(t => t.eng_hours != null && t.eng_hours > avgCycleTime * 2 && !FINAL_STATUSES.includes(t.status));
    const overdueRatio = overdue.length / total;
    overdueFactor = overdueRatio * 0.3;
    if (overdue.length > 0) {
      factors.push(`${overdue.length} ticket${overdue.length > 1 ? 's have' : ' has'} exceeded 2x the average cycle time`);
    }
  }

  // 3. Blocked factor
  const blocked = allTickets.filter(t => BLOCKED_STATUSES.has(t.status.toLowerCase()));
  const blockedRatio = blocked.length / total;
  const blockedFactor = blockedRatio * 0.2;
  if (blocked.length > 0) {
    factors.push(`${blocked.length} ticket${blocked.length > 1 ? 's are' : ' is'} currently blocked`);
  }

  // 4. Bug factor
  const bugs = allTickets.filter(t => BUG_TYPES.has((t.issue_type ?? '').toLowerCase()));
  const bugRatio = bugs.length / total;
  const bugFactor = bugRatio * 0.1;
  if (bugRatio > 0.2) {
    factors.push(`Bug ratio (${Math.round(bugRatio * 100)}%) is above healthy threshold`);
  }

  // 5. Reopen factor (approximated: tickets that have been resolved but are back to non-final)
  // We can detect this by checking tickets with resolved date but not in final status
  const reopened = allTickets.filter(t => t.resolved && !FINAL_STATUSES.includes(t.status));
  const reopenRatio = reopened.length / total;
  const reopenFactor = reopenRatio * 0.1;
  if (reopened.length > 0) {
    factors.push(`${reopened.length} ticket${reopened.length > 1 ? 's have' : ' has'} been reopened after resolution`);
  }

  const riskScore = Math.min(1, progressFactor + overdueFactor + blockedFactor + bugFactor + reopenFactor);
  return { riskScore, riskFactors: factors };
}
