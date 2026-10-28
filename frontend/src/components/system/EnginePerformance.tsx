import { useQuery } from '@apollo/client';
import { Alert, Box, Card, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { useTheme } from '@mui/material/styles';
import { ASSIGNMENT_PERFORMANCE_QUERY } from '@/graphql/system';
import type { AssignmentPerformance } from '@/types/system';
import { formatDuration, formatPct } from '@/lib/format';
import { Panel } from '@/components/dashboard/Panel';
import { chipToneColor } from '@/components/shared/pr-visuals';

export function EnginePerformance() {
  const theme = useTheme();
  const { data, loading, error } = useQuery<{
    assignmentPerformance: AssignmentPerformance;
  }>(ASSIGNMENT_PERFORMANCE_QUERY, { pollInterval: 60_000 });

  if (loading && !data) {
    return <Skeleton variant="rounded" height={320} />;
  }
  if (error) {
    return (
      <Alert severity="error">
        Could not load engine analytics: {error.message}
      </Alert>
    );
  }

  const performance = data?.assignmentPerformance;
  if (!performance) {
    return null;
  }

  if (performance.requested === 0) {
    return (
      <Card sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Nothing measured yet
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Engine analytics count only the reviews Relay requests on GitHub, while
          Actually assign is on.
        </Typography>
      </Card>
    );
  }

  const weekly = performance.weekly;

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
        }}
      >
        <Kpi
          label="Time to first review"
          value={formatDuration(performance.medianFirstReviewSeconds)}
          hint="Typical time from Relay's review request to the first review"
        />
        <Kpi
          label="Reviewed by the pick"
          value={formatPct(performance.pickReviewedRate)}
          hint={`${performance.reviewedByPick} of ${performance.reviewed} reviewed pull requests`}
        />
        <Kpi
          label="Reviews requested"
          value={String(performance.requested)}
          hint="Reviews Relay requested on GitHub while Actually assign was on"
        />
      </Box>

      <Panel title="Time to first review by week">
        <BarChart
          height={250}
          borderRadius={4}
          xAxis={[{ scaleType: 'band', data: weekly.map((point) => point.week) }]}
          yAxis={[{ valueFormatter: (value: number) => formatDuration(value) }]}
          series={[
            {
              data: weekly.map((point) => point.medianFirstReviewSeconds),
              label: 'Time to first review',
              color: chipToneColor(theme, 'blue'),
              valueFormatter: (value: number | null) => formatDuration(value),
            },
          ]}
          hideLegend
          margin={{ top: 20, right: 10, bottom: 24, left: 48 }}
        />
      </Panel>
    </Stack>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Tooltip title={hint} arrow placement="top">
      <Card sx={{ p: 2 }}>
        <Typography
          variant="caption"
          sx={{
            textTransform: 'uppercase',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: 'text.secondary',
          }}
        >
          {label}
        </Typography>
        <Typography
          variant="h4"
          sx={{ fontWeight: 700, mt: 0.5, fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </Typography>
      </Card>
    </Tooltip>
  );
}
