import { Card, CardContent, Typography } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import type { WeeklyQualityPoint } from '@/types/dashboard';

const toPct = (rate: number): number => Number((rate * 100).toFixed(1));

export function QualityTrendChart({ points }: { points: WeeklyQualityPoint[] }) {
  const weeks = points.map((p) => p.week);
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          Quality guardrails by week
        </Typography>
        {weeks.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No merged PRs yet.
          </Typography>
        ) : (
          <LineChart
            height={280}
            xAxis={[{ scaleType: 'point', data: weeks }]}
            yAxis={[{ label: '%' }]}
            series={[
              { label: 'Zero-comment approvals', data: points.map((p) => toPct(p.approvedWithZeroCommentsRate)) },
              { label: 'Reverts', data: points.map((p) => toPct(p.revertRate)) },
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}
