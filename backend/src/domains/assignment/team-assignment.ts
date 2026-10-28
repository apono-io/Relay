import { TeamView } from '@/domains/teams/teams.service';
import { AssignmentEngine, RankInput, RankResult } from './assignment-engine';

export type TeamPick = { result: RankResult; leadFallback: boolean };

// Picks inside one team. The engine ranks the other members as usual; the lead is asked
// only when every other member it could pick already has `leadThreshold` or more open
// reviews. The engine is the eligibility oracle, so "free" and "lead available" count
// only people it could actually pick, and the author is never picked.
export function pickWithinTeam(input: RankInput, team: TeamView): TeamPick {
  const members = new Set(team.memberIds);
  const others = input.candidates.filter(
    (candidate) =>
      members.has(candidate.personId) &&
      candidate.personId !== team.leadPersonId &&
      candidate.personId !== input.authorPersonId,
  );
  const othersRanked = AssignmentEngine.rank({ ...input, candidates: others });
  const free = othersRanked.ranked.filter(
    (entry) => entry.signals.openReviewRequests < team.leadThreshold,
  );
  if (free.length > 0) {
    return { result: othersRanked, leadFallback: false };
  }

  const lead = input.candidates.find(
    (candidate) =>
      candidate.personId === team.leadPersonId &&
      candidate.personId !== input.authorPersonId,
  );
  if (lead) {
    const leadRanked = AssignmentEngine.rank({ ...input, candidates: [lead] });
    if (leadRanked.picks.length > 0) {
      return { result: leadRanked, leadFallback: true };
    }
  }
  return { result: othersRanked, leadFallback: false };
}
