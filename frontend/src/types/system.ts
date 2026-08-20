export type WatchedRepo = {
  id: string;
  name: string;
  createdAt: string;
};

export type AreaRule = {
  id: string;
  repo: string;
  pattern: string;
  area: string;
  risk: number;
};

export type PickSignals = {
  areaRank: number | null;
  areaPool: number;
  openReviewRequests: number;
  reviewsLast14Days: number;
};

export type SuggestionOutcomeRow = {
  id: string;
  repo: string;
  prNumber: number;
  prTitle: string;
  prUrl: string;
  area: string | null;
  suggestedName: string;
  suggestedLogin: string;
  reason: string;
  signals: PickSignals | null;
  actualNames: string[];
  matched: boolean | null;
  generatedAt: string;
  resolvedAt: string | null;
};

export type AssignmentComparison = {
  recorded: number;
  awaiting: number;
  decided: number;
  agreements: number;
  agreementRate: number | null;
  rows: SuggestionOutcomeRow[];
};

export type AssignmentTotals = {
  recorded: number;
  decided: number;
  agreements: number;
  awaiting: number;
  assigned: number;
  autoAssigned: number;
  manualAssigned: number;
  liveAssigned: number;
  peoplePicked: number;
  agreementRate: number | null;
  coverageRate: number | null;
  medianDecisionSeconds: number | null;
};

export type AssignmentWeekPoint = {
  week: string;
  weekStart: string;
  recorded: number;
  decided: number;
  agreements: number;
  assigned: number;
  agreementRate: number | null;
};

export type AssignmentAreaPoint = {
  area: string;
  recorded: number;
  decided: number;
  agreements: number;
  agreementRate: number | null;
};

export type AssignmentSpreadPoint = {
  displayName: string;
  picks: number;
};

export type AssignmentPerformance = {
  totals: AssignmentTotals;
  weekly: AssignmentWeekPoint[];
  byArea: AssignmentAreaPoint[];
  spread: AssignmentSpreadPoint[];
};
