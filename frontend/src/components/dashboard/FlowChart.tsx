import { Typography, useTheme } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { format } from 'date-fns';
import type { WeeklyFlowPoint } from '@/types/dashboard';
import { chipToneColor } from '@/components/shared/pr-visuals';

export function FlowChart({ points }: { points: WeeklyFlowPoint[] }) {
  const theme = useTheme();
  if (points.every((point) => point.opened === 0 && point.merged === 0)) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
        No pull requests in this window yet.
      </Typography>
    );
  }
  return (
    <BarChart
      height={260}
      borderRadius={4}
      xAxis={[
        {
          scaleType: 'band',
          data: points.map((point) => format(new Date(point.weekStart), 'MMM d')),
          tickLabelStyle: { fontSize: 11 },
        },
      ]}
      yAxis={[{ tickLabelStyle: { fontSize: 11 } }]}
      series={[
        {
          label: 'Opened',
          data: points.map((point) => point.opened),
          color: chipToneColor(theme, 'green'),
        },
        {
          label: 'Merged',
          data: points.map((point) => point.merged),
          color: chipToneColor(theme, 'purple'),
        },
      ]}
      slotProps={{ legend: { position: { vertical: 'bottom' } } }}
      margin={{ left: 0, right: 8, top: 12 }}
    />
  );
}
