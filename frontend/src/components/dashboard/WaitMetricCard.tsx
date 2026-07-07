import { Card, CardContent, Typography, Stack } from '@mui/material';
import type { WaitMetric } from '@/types/dashboard';

function formatSeconds(seconds: number | null): string {
  if (seconds === null || seconds === undefined) {
    return '—';
  }
  const hours = seconds / 3600;
  if (hours >= 1) {
    return `${hours.toFixed(1)}h`;
  }
  return `${Math.round(seconds / 60)}m`;
}

export function WaitMetricCard({ metric }: { metric: WaitMetric }) {
  return (
    <Card variant="outlined" sx={{ minWidth: 200 }}>
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary">
          {metric.label}
        </Typography>
        <Stack direction="row" spacing={3} sx={{ mt: 1 }}>
          <div>
            <Typography variant="h5">{formatSeconds(metric.medianSeconds)}</Typography>
            <Typography variant="caption" color="text.secondary">
              median
            </Typography>
          </div>
          <div>
            <Typography variant="h5">{formatSeconds(metric.p90Seconds)}</Typography>
            <Typography variant="caption" color="text.secondary">
              p90
            </Typography>
          </div>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          n={metric.sampleSize}
        </Typography>
      </CardContent>
    </Card>
  );
}
