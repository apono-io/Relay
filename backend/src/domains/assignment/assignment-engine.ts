export type AssignmentMode = 'off' | 'hybrid' | 'auto';

export type AreaRuleLike = { pattern: string; area: string; risk: number };

export type AreaMatch = { area: string | null; risk: number };

export type Candidate = {
  personId: string;
  displayName: string;
  logins: string[];
  active: boolean;
  assignmentMode?: AssignmentMode | null;
  masteryByArea: Record<string, number>;
  openReviewRequests: number;
  activeRelayPicks: number;
  reviewsLast14Days: number;
};

export type EngineWeights = {
  mastery: number;
  availability: number;
  fairness: number;
};

export type EngineConfig = {
  weights: EngineWeights;
  twoReviewerRiskThreshold: number;
  knowledgeSpread: boolean;
};

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  weights: { mastery: 0.5, availability: 0.3, fairness: 0.2 },
  twoReviewerRiskThreshold: 5,
  knowledgeSpread: false,
};

export const DEFAULT_RISK = 2;

export const MASTERY_WINDOW_DAYS = 183;
const MASTERY_HALF_LIFE_DAYS = 60;
const RISK_WEIGHT_STEP = 0.15;
const DAY_MS = 24 * 60 * 60 * 1000;

export type RankInput = {
  authorPersonId: string | null;
  authorLogin: string;
  requestedReviewers: string[];
  area: AreaMatch;
  candidates: Candidate[];
  config?: EngineConfig;
};

export type CandidateSignals = {
  areaRank: number | null;
  areaPool: number;
  openReviewRequests: number;
  reviewsLast14Days: number;
};

export type RankedCandidate = {
  personId: string;
  displayName: string;
  login: string;
  reason: string;
  signals: CandidateSignals;
};

export type RankResult = {
  ranked: RankedCandidate[];
  picks: RankedCandidate[];
  requiredReviewers: number;
};

export type MasteryActivity = {
  login: string;
  repo: string;
  filePaths: string[];
  occurredAt: Date;
};

type ScoredCandidate = {
  candidate: Candidate;
  masteryRaw: number;
  masteryNorm: number;
  availabilityNorm: number;
  fairnessNorm: number;
  score: number;
};

const globRegexCache = new Map<string, RegExp>();

function globToRegex(pattern: string): RegExp {
  const cached = globRegexCache.get(pattern);
  if (cached) {
    return cached;
  }
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*+/g, (stars) => (stars.length > 1 ? '.*' : '[^/]*'));
  const regex = new RegExp(`^${escaped}$`);
  globRegexCache.set(pattern, regex);
  return regex;
}

export class AssignmentEngine {
  static matchesPattern(pattern: string, path: string): boolean {
    return globToRegex(pattern).test(path);
  }

  static matchAreas(filePaths: string[], rules: AreaRuleLike[]): string[] {
    const areas = new Set<string>();
    for (const rule of rules) {
      const regex = globToRegex(rule.pattern);
      if (filePaths.some((path) => regex.test(path))) {
        areas.add(rule.area);
      }
    }
    return Array.from(areas).sort();
  }

  static classify(filePaths: string[], rules: AreaRuleLike[]): AreaMatch {
    let best: AreaRuleLike | null = null;
    for (const rule of rules) {
      const regex = globToRegex(rule.pattern);
      if (!filePaths.some((path) => regex.test(path))) {
        continue;
      }
      if (!best || this.beatsRule(rule, best)) {
        best = rule;
      }
    }
    return best
      ? { area: best.area, risk: best.risk }
      : { area: null, risk: DEFAULT_RISK };
  }

  private static beatsRule(rule: AreaRuleLike, best: AreaRuleLike): boolean {
    if (rule.risk !== best.risk) {
      return rule.risk > best.risk;
    }
    if (rule.pattern.length !== best.pattern.length) {
      return rule.pattern.length > best.pattern.length;
    }
    return rule.pattern < best.pattern;
  }

  static recencyWeight(occurredAt: Date, now: Date): number {
    const ageDays = (now.getTime() - occurredAt.getTime()) / DAY_MS;
    if (ageDays < 0) {
      return 1;
    }
    if (ageDays > MASTERY_WINDOW_DAYS) {
      return 0;
    }
    return Math.pow(0.5, ageDays / MASTERY_HALF_LIFE_DAYS);
  }

  static buildMastery(
    activities: MasteryActivity[],
    rulesByRepo: Record<string, AreaRuleLike[]>,
    now: Date,
  ): Map<string, Record<string, number>> {
    const mastery = new Map<string, Record<string, number>>();
    for (const activity of activities) {
      const weight = this.recencyWeight(activity.occurredAt, now);
      if (weight === 0) {
        continue;
      }
      const rules = rulesByRepo[activity.repo] ?? [];
      const areas = this.matchAreas(activity.filePaths, rules);
      if (areas.length === 0) {
        continue;
      }
      const key = activity.login.toLowerCase();
      const byArea = mastery.get(key) ?? {};
      for (const area of areas) {
        byArea[area] = (byArea[area] ?? 0) + weight;
      }
      mastery.set(key, byArea);
    }
    return mastery;
  }

  static effectiveWeights(base: EngineWeights, risk: number): EngineWeights {
    const shift = (risk - DEFAULT_RISK) * RISK_WEIGHT_STEP;
    const mastery = Math.max(0, base.mastery + shift);
    const availability = Math.max(0, base.availability - shift / 2);
    const fairness = Math.max(0, base.fairness - shift / 2);
    const total = mastery + availability + fairness;
    if (total === 0) {
      return { mastery: 1 / 3, availability: 1 / 3, fairness: 1 / 3 };
    }
    return {
      mastery: mastery / total,
      availability: availability / total,
      fairness: fairness / total,
    };
  }

  static rank(input: RankInput): RankResult {
    const config = input.config ?? DEFAULT_ENGINE_CONFIG;
    const requested = new Set(
      input.requestedReviewers.map((login) => login.toLowerCase()),
    );
    const authorLogin = input.authorLogin.toLowerCase();

    const eligible = input.candidates.filter((candidate) => {
      if (!candidate.active) {
        return false;
      }
      if (candidate.assignmentMode === 'off') {
        return false;
      }
      const logins = candidate.logins.map((login) => login.toLowerCase());
      if (logins.length === 0) {
        return false;
      }
      if (logins.some((login) => requested.has(login))) {
        return false;
      }
      if (logins.includes(authorLogin)) {
        return false;
      }
      if (input.authorPersonId && candidate.personId === input.authorPersonId) {
        return false;
      }
      return true;
    });

    if (eligible.length === 0) {
      return { ranked: [], picks: [], requiredReviewers: 1 };
    }

    const weights = this.effectiveWeights(config.weights, input.area.risk);
    const masteryRawOf = (candidate: Candidate): number => {
      if (input.area.area) {
        return candidate.masteryByArea[input.area.area] ?? 0;
      }
      return Object.values(candidate.masteryByArea).reduce(
        (sum, value) => sum + value,
        0,
      );
    };

    const masteryValues = eligible.map(masteryRawOf);
    const maxMastery = Math.max(...masteryValues);
    const openValues = eligible.map((c) => c.openReviewRequests);
    const minOpen = Math.min(...openValues);
    const maxOpen = Math.max(...openValues);
    const recentValues = eligible.map((c) => c.reviewsLast14Days);
    const minRecent = Math.min(...recentValues);
    const maxRecent = Math.max(...recentValues);

    const scored: ScoredCandidate[] = eligible.map((candidate, index) => {
      const masteryRaw = masteryValues[index];
      const masteryNorm = maxMastery > 0 ? masteryRaw / maxMastery : 0;
      const availabilityNorm =
        maxOpen === minOpen
          ? 1
          : (maxOpen - candidate.openReviewRequests) / (maxOpen - minOpen);
      const fairnessNorm =
        maxRecent === minRecent
          ? 1
          : (maxRecent - candidate.reviewsLast14Days) / (maxRecent - minRecent);
      const weighted =
        weights.mastery * masteryNorm +
        weights.availability * availabilityNorm +
        weights.fairness * fairnessNorm;
      return {
        candidate,
        masteryRaw,
        masteryNorm,
        availabilityNorm,
        fairnessNorm,
        score: weighted / (1 + candidate.activeRelayPicks),
      };
    });

    scored.sort(
      (a, b) =>
        b.score - a.score ||
        a.candidate.displayName.localeCompare(b.candidate.displayName) ||
        a.candidate.personId.localeCompare(b.candidate.personId),
    );

    if (
      config.knowledgeSpread &&
      input.area.risk <= DEFAULT_RISK &&
      scored.length > 1 &&
      maxMastery > 0 &&
      scored[0].masteryRaw === maxMastery &&
      scored[1].masteryRaw > 0
    ) {
      [scored[0], scored[1]] = [scored[1], scored[0]];
    }

    const masteryOrder = [...masteryValues].sort((a, b) => b - a);
    const areaPool = masteryValues.filter((value) => value > 0).length;
    const ranked = scored.map((entry) => ({
      personId: entry.candidate.personId,
      displayName: entry.candidate.displayName,
      login: entry.candidate.logins[0],
      reason: this.reasonFor(entry, input.area.area),
      signals: {
        areaRank:
          entry.masteryRaw > 0
            ? masteryOrder.indexOf(entry.masteryRaw) + 1
            : null,
        areaPool,
        openReviewRequests: entry.candidate.openReviewRequests,
        reviewsLast14Days: entry.candidate.reviewsLast14Days,
      },
    }));

    const requiredReviewers =
      input.area.risk >= config.twoReviewerRiskThreshold ? 2 : 1;
    return {
      ranked,
      picks: ranked.slice(0, Math.min(requiredReviewers, ranked.length)),
      requiredReviewers,
    };
  }

  private static reasonFor(
    entry: ScoredCandidate,
    area: string | null,
  ): string {
    const areaLabel = area ?? 'this part of the code';
    const phrases: string[] = [];
    if (entry.masteryRaw > 0 && entry.masteryNorm >= 0.5) {
      phrases.push(`worked on ${areaLabel} recently`);
    }
    if (entry.candidate.openReviewRequests === 0) {
      phrases.push('has no open reviews');
    }
    if (phrases.length < 2 && entry.candidate.reviewsLast14Days === 0) {
      phrases.push('has not reviewed lately');
    }
    if (phrases.length === 0) {
      phrases.push('is available to review');
    }
    return phrases.slice(0, 2).join(' and ');
  }
}
