import { Typography, useTheme } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import type { WeeklyQualityPoint } from '@/types/dashboard';
import { chipToneColor } from '@/components/shared/pr-visuals';

const toPct = (rate: number): number => Number((rate * 100).toFixed(1));

export function ReviewDepthChart({ points }: { points: WeeklyQualityPoint[] }) {
  const theme = useTheme();
  const recent = points.slice(-12);
  if (recent.length < 2) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
        Not enough merged weeks yet to draw a trend.
      </Typography>
    );
  }
  const pctFormatter = (value: number | null) => (value == null ? '—' : `${value}%`);
  return (
    <LineChart
      height={260}
      xAxis={[
        {
          scaleType: 'point',
          data: recent.map((point) => point.week.replace(/^\d{4}-/, '')),
          tickLabelStyle: { fontSize: 11 },
        },
      ]}
      yAxis={[
        { tickLabelStyle: { fontSize: 11 }, valueFormatter: pctFormatter, min: 0 },
      ]}
      series={[
        {
          label: 'Approved without comments',
          data: recent.map((point) => toPct(point.approvedWithZeroCommentsRate)),
          color: chipToneColor(theme, 'blue'),
          curve: 'monotoneX',
          showMark: false,
          valueFormatter: pctFormatter,
        },
        {
          label: 'Reverts',
          data: recent.map((point) => toPct(point.revertRate)),
          color: chipToneColor(theme, 'red'),
          curve: 'monotoneX',
          showMark: false,
          valueFormatter: pctFormatter,
        },
      ]}
      slotProps={{ legend: { position: { vertical: 'bottom' } } }}
      margin={{ left: 0, right: 8, top: 12 }}
    />
  );
}
