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

export type DashboardSummary = {
  reviewerWaitByRound: WaitMetric[];
  authorWaitByRound: WaitMetric[];
  cycleTime: WaitMetric;
  prCount: number;
  slaMisses: number;
  quality: QualityGuardrail;
};
