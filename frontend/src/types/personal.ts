export type ReviewRound = {
  sequence: number;
  outcome: 'changes_requested' | 'approved' | 'commented';
  at: string;
  actorLogin: string | null;
};

export type PersonalPr = {
  id: string;
  repo: string;
  number: number;
  title: string;
  url: string;
  state: string;
  isDraft: boolean;
  authorLogin: string;
  waitingOn: 'REVIEWER' | 'AUTHOR' | 'CI' | 'NONE';
  requestedReviewers: string[];
  reviewerLogins: string[];
  openedAt: string | null;
  readyAt: string | null;
  firstReviewAt: string | null;
  approvedAt: string | null;
  mergedAt: string | null;
  checkState: 'PENDING' | 'PASSING' | 'FAILING' | null;
  area: string | null;
  sensitivity: number;
  reviewRounds: ReviewRound[];
};

export type MyPullRequests = {
  logins: string[];
  open: PersonalPr[];
  recentlyMerged: PersonalPr[];
};

export type MyReviews = {
  logins: string[];
  open: PersonalPr[];
  recentlyMerged: PersonalPr[];
};
