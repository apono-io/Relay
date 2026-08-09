export type ReviewRow = {
  actorLogin: string;
  occurredAt: Date;
  prId: string;
  repo: string;
  filePaths: string[];
};

export function requestedReviewerLoad(
  openPrs: { requestedReviewers: string[] }[],
): Map<string, number> {
  const load = new Map<string, number>();
  for (const pr of openPrs) {
    for (const login of pr.requestedReviewers) {
      const key = login.toLowerCase();
      load.set(key, (load.get(key) ?? 0) + 1);
    }
  }
  return load;
}

export function relayPickLoad(assignedLogins: string[]): Map<string, number> {
  const load = new Map<string, number>();
  for (const login of assignedLogins) {
    const key = login.toLowerCase();
    load.set(key, (load.get(key) ?? 0) + 1);
  }
  return load;
}

export function dedupeReviewsPerPr(reviews: ReviewRow[]): ReviewRow[] {
  const latestByKey = new Map<string, ReviewRow>();
  for (const review of reviews) {
    const key = `${review.actorLogin.toLowerCase()}:${review.prId}`;
    const current = latestByKey.get(key);
    if (!current || review.occurredAt > current.occurredAt) {
      latestByKey.set(key, review);
    }
  }
  return Array.from(latestByKey.values());
}

export function recentReviewCounts(
  dedupedReviews: ReviewRow[],
  cutoff: Date,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const review of dedupedReviews) {
    if (review.occurredAt < cutoff) {
      continue;
    }
    const login = review.actorLogin.toLowerCase();
    counts.set(login, (counts.get(login) ?? 0) + 1);
  }
  return counts;
}
