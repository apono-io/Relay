import { Box, Card, Stack, Typography, useTheme } from '@mui/material';
import { SparkLineChart } from '@mui/x-charts/SparkLineChart';
import type { DashboardSummary } from '@/types/dashboard';
import { formatDuration } from '@/lib/format';
import { chipToneColor } from '@/components/shared/pr-visuals';

function KpiCard({
  label,
  value,
  sub,
  spark,
}: {
  label: string;
  value: string;
  sub: string;
  spark?: number[];
}) {
  const theme = useTheme();
  return (
    <Card sx={{ p: 2.25, flex: '1 1 200px', minWidth: 0, position: 'relative', overflow: 'hidden' }}>
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'text.secondary',
        }}
      >
        {label}
      </Typography>
      <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.02em', mt: 0.75, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
        {sub}
      </Typography>
      {spark && spark.some((v) => v > 0) && (
        <Box sx={{ position: 'absolute', right: 12, bottom: 10, width: 96, opacity: 0.9 }}>
          <SparkLineChart
            data={spark}
            height={36}
            area
            color={chipToneColor(theme, 'purple')}
            sx={{ '& .MuiAreaElement-root': { opacity: 0.18 } }}
          />
        </Box>
      )}
    </Card>
  );
}

export function KpiRow({ summary }: { summary: DashboardSummary }) {
  const pickup = summary.reviewerWaitByRound.find((metric) => metric.label.includes('round 1'));
  const flow = summary.weeklyFlow;
  const thisWeek = flow.length > 0 ? flow[flow.length - 1] : null;
  const lastWeek = flow.length > 1 ? flow[flow.length - 2] : null;

  return (
    <Stack direction="row" spacing={2.5} useFlexGap flexWrap="wrap">
      <KpiCard
        label="Time to merge"
        value={formatDuration(summary.cycleTime.medianSeconds)}
        sub={`typical PR · slowest 10%: ${formatDuration(summary.cycleTime.p90Seconds)}`}
      />
      <KpiCard
        label="Review pickup"
        value={formatDuration(pickup?.medianSeconds)}
        sub={`until the first review starts · slowest 10%: ${formatDuration(pickup?.p90Seconds)}`}
      />
      <KpiCard
        label="Merged this week"
        value={thisWeek ? String(thisWeek.merged) : '—'}
        sub={lastWeek ? `${lastWeek.merged} all of last week` : 'no data yet'}
        spark={flow.map((point) => point.merged)}
      />
      <KpiCard
        label="Waiting right now"
        value={String(summary.waitingCount)}
        sub="open PRs waiting on someone"
      />
    </Stack>
  );
}
