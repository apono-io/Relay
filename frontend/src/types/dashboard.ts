export type WaitMetric = {
  label: string;
  medianSeconds: number | null;
  p90Seconds: number | null;
  sampleSize: number;
};

export type QualityGuardrail = {
  approvedWithZeroCommentsRate: number;
  revertRate: number;
};

export type WeeklyPhasePoint = {
  week: string;
  codingSeconds: number | null;
  pickupSeconds: number | null;
  reworkSeconds: number | null;
  mergeSeconds: number | null;
  prCount: number;
};

export type StuckPr = {
  repo: string;
  number: number;
  title: string;
  url: string;
  authorLogin: string;
  waitingOn: string;
  waitingSeconds: number;
  requestedReviewers: string[];
  slaBreached: boolean;
};

export type ReviewerLoad = {
  login: string;
  reviewCount: number;
};

export type WeeklyQualityPoint = {
  week: string;
  approvedWithZeroCommentsRate: number;
  revertRate: number;
  prCount: number;
};

export type DashboardSummary = {
  reviewerWaitByRound: WaitMetric[];
  authorWaitByRound: WaitMetric[];
  cycleTime: WaitMetric;
  prCount: number;
  slaMisses: number;
  quality: QualityGuardrail;
  weeklyPhases: WeeklyPhasePoint[];
  stuckNow: StuckPr[];
  fairness: ReviewerLoad[];
  qualityTrend: WeeklyQualityPoint[];
};
