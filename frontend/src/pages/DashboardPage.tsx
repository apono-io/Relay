import { useQuery } from '@apollo/client';
import { AppBar, Box, Container, Stack, Toolbar, Typography, Alert, CircularProgress, Chip } from '@mui/material';
import { DASHBOARD_QUERY } from '@/graphql/dashboard';
import type { DashboardSummary } from '@/types/dashboard';
import { WaitMetricCard } from '@/components/dashboard/WaitMetricCard';
import { WeeklyPhaseChart } from '@/components/dashboard/WeeklyPhaseChart';
import { StuckNowList } from '@/components/dashboard/StuckNowList';
import { FairnessChart } from '@/components/dashboard/FairnessChart';
import { QualityTrendChart } from '@/components/dashboard/QualityTrendChart';

function ZoneHeading({ children }: { children: string }) {
  return (
    <Typography variant="subtitle1" gutterBottom>
      {children}
    </Typography>
  );
}

export function DashboardPage() {
  const { data, loading, error } = useQuery<{ dashboard: DashboardSummary }>(DASHBOARD_QUERY, {
    pollInterval: 60000,
  });

  const dashboard = data?.dashboard;

  return (
    <Box>
      <AppBar position="static" color="default" elevation={0}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Relay
          </Typography>
        </Toolbar>
      </AppBar>
      <Container sx={{ py: 4 }}>
        <Stack direction="row" alignItems="baseline" spacing={2} sx={{ mb: 2 }}>
          <Typography variant="h5">Team dashboard</Typography>
          {dashboard && (
            <>
              <Chip size="small" label={`${dashboard.prCount} PRs`} />
              <Chip
                size="small"
                color={dashboard.slaMisses > 0 ? 'warning' : 'default'}
                label={`${dashboard.slaMisses} SLA misses`}
              />
            </>
          )}
        </Stack>

        {loading && <CircularProgress />}
        {error && (
          <Alert severity="info">
            Dashboard data is not available yet. Implement the metrics aggregation (spec task 11) and run backfill.
          </Alert>
        )}

        {dashboard && (
          <Stack spacing={3}>
            <div>
              <ZoneHeading>Reviewer wait (per round)</ZoneHeading>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                {dashboard.reviewerWaitByRound.map((m) => (
                  <WaitMetricCard key={m.label} metric={m} />
                ))}
              </Stack>
            </div>
            <div>
              <ZoneHeading>Author wait (per round)</ZoneHeading>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                {dashboard.authorWaitByRound.map((m) => (
                  <WaitMetricCard key={m.label} metric={m} />
                ))}
              </Stack>
            </div>
            <div>
              <ZoneHeading>Cycle time</ZoneHeading>
              <WaitMetricCard metric={dashboard.cycleTime} />
            </div>

            <WeeklyPhaseChart points={dashboard.weeklyPhases} />
            <StuckNowList items={dashboard.stuckNow} />
            <FairnessChart loads={dashboard.fairness} />
            <QualityTrendChart points={dashboard.qualityTrend} />
          </Stack>
        )}
      </Container>
    </Box>
  );
}
