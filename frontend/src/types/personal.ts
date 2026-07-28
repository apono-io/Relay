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
  openedAt: string | null;
  readyAt: string | null;
  firstReviewAt: string | null;
  approvedAt: string | null;
  mergedAt: string | null;
};

export type MyPullRequests = {
  logins: string[];
  open: PersonalPr[];
  recentlyMerged: PersonalPr[];
};

export type MyReviews = {
  logins: string[];
  waiting: PersonalPr[];
};
