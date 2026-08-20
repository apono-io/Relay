import type { ReviewRound } from './personal';

export type WaitMetric = {
  label: string;
  medianSeconds: number | null;
  p90Seconds: number | null;
  sampleSize: number;
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
  reviewerLogins: string[];
  roundNumber: number;
  openedAt: string | null;
  readyAt: string | null;
  firstReviewAt: string | null;
  approvedAt: string | null;
  area: string | null;
  sensitivity: number;
  reviewRounds: ReviewRound[];
};

export type WeeklyFlowPoint = {
  week: string;
  weekStart: string;
  opened: number;
  merged: number;
  cycleP50Seconds: number | null;
  cycleP90Seconds: number | null;
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
  waitingCount: number;
  lastSyncedAt: string | null;
  weeklyFlow: WeeklyFlowPoint[];
  qualityTrend: WeeklyQualityPoint[];
  stuckNow: StuckPr[];
};
