import { Candidate, RankInput } from './assignment-engine';
import { pickWithinTeam } from './team-assignment';
import { TeamView } from '@/domains/teams/teams.service';

// Built with an assertion so the helper fits Candidate with or without the newer
// per-person assignment switch; "not pickable" uses fields every version has.
function person(
  personId: string,
  overrides: Partial<Candidate> = {},
): Candidate {
  return {
    personId,
    displayName: personId,
    logins: [personId],
    active: true,
    assignmentEnabled: true,
    masteryByArea: {},
    openReviewRequests: 0,
    activeRelayPicks: 0,
    reviewsLast14Days: 0,
    ...overrides,
  } as Candidate;
}

function input(candidates: Candidate[], authorPersonId = 'author'): RankInput {
  return {
    authorPersonId,
    authorLogin: authorPersonId,
    requestedReviewers: [],
    area: { area: null, risk: 2 },
    candidates,
  };
}

const TEAM: TeamView = {
  id: 't1',
  name: 'Platform',
  leadPersonId: 'lead',
  leadThreshold: 2,
  memberIds: ['m1', 'm2'],
};

describe('pickWithinTeam', () => {
  it('picks among members while one of them is free', () => {
    const { result, leadFallback } = pickWithinTeam(
      input([
        person('m1', { openReviewRequests: 3 }),
        person('m2', { openReviewRequests: 1 }),
        person('lead'),
        person('outsider'),
      ]),
      TEAM,
    );
    expect(leadFallback).toBe(false);
    expect(result.picks[0].personId).toBe('m2');
    expect(result.ranked.map((entry) => entry.personId).sort()).toEqual([
      'm1',
      'm2',
    ]);
  });

  it('asks the lead when every other member is at the threshold', () => {
    const { result, leadFallback } = pickWithinTeam(
      input([
        person('m1', { openReviewRequests: 2 }),
        person('m2', { openReviewRequests: 4 }),
        person('lead', { openReviewRequests: 5 }),
      ]),
      TEAM,
    );
    expect(leadFallback).toBe(true);
    expect(result.picks.map((entry) => entry.personId)).toEqual(['lead']);
  });

  it('asks the lead when no other member can be picked', () => {
    const { result, leadFallback } = pickWithinTeam(
      input([
        person('m1', { assignmentMode: 'off' }),
        person('m2', { active: false }),
        person('lead'),
      ]),
      TEAM,
    );
    expect(leadFallback).toBe(true);
    expect(result.picks[0].personId).toBe('lead');
  });

  it('never asks the author even when they lead the team', () => {
    const { result, leadFallback } = pickWithinTeam(
      input(
        [
          person('m1', { openReviewRequests: 3 }),
          person('m2', { openReviewRequests: 2 }),
          person('lead'),
        ],
        'lead',
      ),
      TEAM,
    );
    expect(leadFallback).toBe(false);
    expect(result.picks[0].personId).toBe('m2');
  });

  it('falls back to the members when the lead cannot be picked', () => {
    const { result, leadFallback } = pickWithinTeam(
      input([
        person('m1', { openReviewRequests: 2 }),
        person('m2', { openReviewRequests: 3 }),
        person('lead', { assignmentMode: 'off' }),
      ]),
      TEAM,
    );
    expect(leadFallback).toBe(false);
    expect(result.picks[0].personId).toBe('m1');
  });

  it('returns no picks when nobody on the team can be picked', () => {
    const { result } = pickWithinTeam(
      input([
        person('m1', { active: false }),
        person('lead', { active: false }),
        person('outsider'),
      ]),
      TEAM,
    );
    expect(result.picks).toEqual([]);
  });
});
