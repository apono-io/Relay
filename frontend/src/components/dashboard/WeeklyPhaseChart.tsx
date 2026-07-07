import { Card, CardContent, Typography } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import type { WeeklyPhasePoint } from '@/types/dashboard';

const toHours = (seconds: number | null): number | null =>
  seconds === null || seconds === undefined ? null : Number((seconds / 3600).toFixed(2));

export function WeeklyPhaseChart({ points }: { points: WeeklyPhasePoint[] }) {
  const weeks = points.map((p) => p.week);
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Median phase time by week
        </Typography>
        {weeks.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No merged PRs yet.
          </Typography>
        ) : (
          <BarChart
            height={320}
            xAxis={[{ scaleType: 'band', data: weeks }]}
            yAxis={[{ label: 'hours' }]}
            series={[
              { label: 'Coding', stack: 'phase', data: points.map((p) => toHours(p.codingSeconds)) },
              { label: 'Pickup', stack: 'phase', data: points.map((p) => toHours(p.pickupSeconds)) },
              { label: 'Rework', stack: 'phase', data: points.map((p) => toHours(p.reworkSeconds)) },
              { label: 'Merge', stack: 'phase', data: points.map((p) => toHours(p.mergeSeconds)) },
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}
