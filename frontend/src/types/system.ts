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

export type AssignmentWeekPoint = {
  week: string;
  weekStart: string;
  requested: number;
  medianFirstReviewSeconds: number | null;
};

export type AssignmentPerformance = {
  requested: number;
  reviewed: number;
  reviewedByPick: number;
  pickReviewedRate: number | null;
  medianFirstReviewSeconds: number | null;
  weekly: AssignmentWeekPoint[];
};

export type Team = {
  id: string;
  name: string;
  leadPersonId: string | null;
  memberIds: string[];
};
