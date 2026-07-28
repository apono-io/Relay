export type WaitMetric = {
  label: string;
  medianSeconds: number | null;
  p90Seconds: number | null;
  sampleSize: number;
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
  roundNumber: number;
  openedAt: string | null;
  readyAt: string | null;
  firstReviewAt: string | null;
  approvedAt: string | null;
};

export type DashboardSummary = {
  reviewerWaitByRound: WaitMetric[];
  authorWaitByRound: WaitMetric[];
  waitingCount: number;
  lastSyncedAt: string | null;
  weeklyPhases: WeeklyPhasePoint[];
  stuckNow: StuckPr[];
};
