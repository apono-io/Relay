import { Typography, useTheme } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { format } from 'date-fns';
import type { WeeklyFlowPoint } from '@/types/dashboard';
import { formatDuration } from '@/lib/format';
import { chipToneColor } from '@/components/shared/pr-visuals';

const toHours = (seconds: number | null): number | null =>
  seconds === null || seconds === undefined ? null : Number((seconds / 3600).toFixed(2));

export function SpeedTrendChart({ points }: { points: WeeklyFlowPoint[] }) {
  const theme = useTheme();
  if (points.every((point) => point.cycleP50Seconds == null)) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
        No merged pull requests in this window yet.
      </Typography>
    );
  }
  const hoursFormatter = (value: number | null) =>
    value == null ? '—' : formatDuration(value * 3600);
  return (
    <LineChart
      height={260}
      xAxis={[
        {
          scaleType: 'point',
          data: points.map((point) => format(new Date(point.weekStart), 'MMM d')),
          tickLabelStyle: { fontSize: 11 },
        },
      ]}
      yAxis={[{ tickLabelStyle: { fontSize: 11 }, valueFormatter: hoursFormatter }]}
      series={[
        {
          label: 'Typical (median)',
          data: points.map((point) => toHours(point.cycleP50Seconds)),
          color: theme.palette.primary.main,
          curve: 'monotoneX',
          showMark: false,
          area: true,
          connectNulls: true,
          valueFormatter: hoursFormatter,
        },
        {
          label: 'Slowest 10% (p90)',
          data: points.map((point) => toHours(point.cycleP90Seconds)),
          color: chipToneColor(theme, 'gray'),
          curve: 'monotoneX',
          showMark: false,
          connectNulls: true,
          valueFormatter: hoursFormatter,
        },
      ]}
      slotProps={{ legend: { position: { vertical: 'bottom' } } }}
      sx={{ '& .MuiAreaElement-root': { opacity: 0.12 } }}
      margin={{ left: 0, right: 8, top: 12 }}
    />
  );
}
