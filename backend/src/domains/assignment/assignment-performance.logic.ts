import { startOfWeek, format } from 'date-fns';
import {
  AssignmentAreaPoint,
  AssignmentPerformance,
  AssignmentSpreadPoint,
  AssignmentTotals,
  AssignmentWeekPoint,
} from './models/assignment-performance.model';

export type PerformanceRow = {
  generatedAt: Date;
  resolvedAt: Date | null;
  matched: boolean | null;
  assignedAt: Date | null;
  assignedTrigger: string | null;
  shadow: boolean | null;
  area: string | null;
  pickedName: string | null;
};

const WHOLE_REPO = 'Whole repo';
const MAX_AREAS = 8;
const MAX_SPREAD = 12;

export function buildPerformance(
  rows: PerformanceRow[],
  weeks: number,
): AssignmentPerformance {
  return {
    totals: buildTotals(rows),
    weekly: buildWeekly(rows, weeks),
    byArea: buildByArea(rows),
    spread: buildSpread(rows),
  };
}

function buildTotals(rows: PerformanceRow[]): AssignmentTotals {
  const decidedRows = rows.filter((row) => row.matched !== null);
  const agreements = decidedRows.filter((row) => row.matched === true).length;
  const assignedRows = rows.filter((row) => row.assignedAt !== null);
  const latencies = decidedRows
    .filter((row) => row.resolvedAt !== null)
    .map(
      (row) => (row.resolvedAt as Date).getTime() - row.generatedAt.getTime(),
    )
    .filter((value) => value >= 0)
    .sort((a, b) => a - b);

  return {
    recorded: rows.length,
    decided: decidedRows.length,
    agreements,
    awaiting: rows.filter((row) => row.resolvedAt === null).length,
    assigned: assignedRows.length,
    autoAssigned: assignedRows.filter((row) => row.assignedTrigger === 'auto')
      .length,
    manualAssigned: assignedRows.filter(
      (row) => row.assignedTrigger === 'manual',
    ).length,
    liveAssigned: assignedRows.filter((row) => row.shadow === false).length,
    peoplePicked: new Set(
      rows
        .map((row) => row.pickedName)
        .filter((name): name is string => !!name),
    ).size,
    agreementRate: ratio(agreements, decidedRows.length),
    coverageRate: ratio(
      rows.filter((row) => row.pickedName !== null).length,
      rows.length,
    ),
    medianDecisionSeconds: median(latencies),
  };
}

function buildWeekly(
  rows: PerformanceRow[],
  weeks: number,
): AssignmentWeekPoint[] {
  const buckets = new Map<string, PerformanceRow[]>();
  for (const row of rows) {
    const key = weekKey(row.generatedAt);
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
    .map(([key, bucket]) => {
      const decided = bucket.filter((row) => row.matched !== null);
      const agreements = decided.filter((row) => row.matched === true).length;
      return {
        week: format(new Date(key), 'MMM d'),
        weekStart: key,
        recorded: bucket.length,
        decided: decided.length,
        agreements,
        assigned: bucket.filter((row) => row.assignedAt !== null).length,
        agreementRate: ratio(agreements, decided.length),
      };
    });
}

function buildByArea(rows: PerformanceRow[]): AssignmentAreaPoint[] {
  const buckets = new Map<string, PerformanceRow[]>();
  for (const row of rows) {
    const key = row.area ?? WHOLE_REPO;
    const existing = buckets.get(key);
    if (existing) {
      existing.push(row);
    } else {
      buckets.set(key, [row]);
    }
  }

  return Array.from(buckets.entries())
    .map(([area, bucket]) => {
      const decided = bucket.filter((row) => row.matched !== null);
      const agreements = decided.filter((row) => row.matched === true).length;
      return {
        area,
        recorded: bucket.length,
        decided: decided.length,
        agreements,
        agreementRate: ratio(agreements, decided.length),
      };
    })
    .sort((a, b) => b.recorded - a.recorded || (a.area < b.area ? -1 : 1))
    .slice(0, MAX_AREAS);
}

function buildSpread(rows: PerformanceRow[]): AssignmentSpreadPoint[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.pickedName) {
      continue;
    }
    counts.set(row.pickedName, (counts.get(row.pickedName) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([displayName, picks]) => ({ displayName, picks }))
    .sort(
      (a, b) => b.picks - a.picks || (a.displayName < b.displayName ? -1 : 1),
    )
    .slice(0, MAX_SPREAD);
}

function weekKey(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

function ratio(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) {
    return null;
  }
  const middle = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
  return value / 1000;
}
