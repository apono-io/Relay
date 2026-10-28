import { startOfWeek, format } from 'date-fns';
import {
  AssignmentPerformance,
  AssignmentWeekPoint,
} from './models/assignment-performance.model';

export type PerformanceRow = {
  shadow: boolean | null;
  requestedAt: Date;
  requestedLogin: string;
  firstReviewAt: Date | null;
  reviews: { login: string; at: Date }[];
};

type Measured = {
  requestedAt: Date;
  firstReviewSeconds: number | null;
  reviewedByPick: boolean;
};

export function buildPerformance(
  rows: PerformanceRow[],
  weeks: number,
): AssignmentPerformance {
  // A test-mode pick (shadow) never reached GitHub, so it says nothing about the wait.
  const measured = rows.filter((row) => row.shadow === false).map(measure);
  const reviewed = measured.filter((row) => row.firstReviewSeconds !== null);
  const reviewedByPick = reviewed.filter((row) => row.reviewedByPick).length;

  return {
    requested: measured.length,
    reviewed: reviewed.length,
    reviewedByPick,
    pickReviewedRate:
      reviewed.length > 0 ? reviewedByPick / reviewed.length : null,
    medianFirstReviewSeconds: medianFirstReview(measured),
    weekly: buildWeekly(measured, weeks),
  };
}

function measure(row: PerformanceRow): Measured {
  const requested = row.requestedAt.getTime();
  const firstReview = row.firstReviewAt?.getTime() ?? null;
  const login = row.requestedLogin.toLowerCase();
  return {
    requestedAt: row.requestedAt,
    firstReviewSeconds:
      firstReview !== null && firstReview >= requested
        ? (firstReview - requested) / 1000
        : null,
    reviewedByPick: row.reviews.some(
      (review) =>
        review.login.toLowerCase() === login &&
        review.at.getTime() >= requested,
    ),
  };
}

function buildWeekly(rows: Measured[], weeks: number): AssignmentWeekPoint[] {
  const buckets = new Map<string, Measured[]>();
  for (const row of rows) {
    const key = weekKey(row.requestedAt);
    const existing = buckets.get(key);
    if (existing) {
      existing.push(row);
    } else {
      buckets.set(key, [row]);
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-weeks)
    .map(([key, bucket]) => ({
      week: format(new Date(key), 'MMM d'),
      weekStart: key,
      requested: bucket.length,
      medianFirstReviewSeconds: medianFirstReview(bucket),
    }));
}

function weekKey(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

function medianFirstReview(rows: Measured[]): number | null {
  const sorted = rows
    .map((row) => row.firstReviewSeconds)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  if (sorted.length === 0) {
    return null;
  }
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}
