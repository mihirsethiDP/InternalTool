import { supabase } from './supabase';

// Contribution scoring — points earned when an admin approves a submission.
// Append-only ledger (contribution_events); awards are idempotent via a
// unique(submission_id, reason) constraint, so re-approval never double-pays.

export const POINTS = { approved: 10, flow_bonus: 5 } as const;

// Award the base points for an approved submission. Safe to call more than once.
export async function awardApproval(uploaderId: string | null | undefined, submissionId: string) {
  if (!uploaderId) return;
  await supabase.from('contribution_events').upsert(
    { user_id: uploaderId, submission_id: submissionId, points: POINTS.approved, reason: 'approved' },
    { onConflict: 'submission_id,reason', ignoreDuplicates: true },
  );
}

// Bonus when the approval produced at least one diagnostic flow.
export async function awardFlowBonus(uploaderId: string | null | undefined, submissionId: string) {
  if (!uploaderId) return;
  await supabase.from('contribution_events').upsert(
    { user_id: uploaderId, submission_id: submissionId, points: POINTS.flow_bonus, reason: 'flow_bonus' },
    { onConflict: 'submission_id,reason', ignoreDuplicates: true },
  );
}

export interface ContributionScore { points: number; approvals: number; bonuses: number }

// One person's running score (their own uploads).
export async function fetchMyScore(userId: string | null | undefined): Promise<ContributionScore> {
  const empty = { points: 0, approvals: 0, bonuses: 0 };
  if (!userId) return empty;
  const { data } = await supabase
    .from('contribution_events')
    .select('points, reason')
    .eq('user_id', userId);
  return (data ?? []).reduce((acc: ContributionScore, e: any) => {
    acc.points += e.points ?? 0;
    if (e.reason === 'approved') acc.approvals += 1;
    if (e.reason === 'flow_bonus') acc.bonuses += 1;
    return acc;
  }, { ...empty });
}

export interface LeaderRow { user_id: string; full_name: string | null; email: string | null; total_points: number; approvals: number }

export async function fetchLeaderboard(): Promise<LeaderRow[]> {
  const { data, error } = await supabase.rpc('contribution_leaderboard');
  if (error) { console.warn('leaderboard failed', error.message); return []; }
  return (data ?? []) as LeaderRow[];
}
