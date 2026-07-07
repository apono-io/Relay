import { useQuery } from '@apollo/client';
import { AppBar, Box, Container, Stack, Toolbar, Typography, Alert, CircularProgress } from '@mui/material';
import { DASHBOARD_QUERY } from '@/graphql/dashboard';
import type { DashboardSummary } from '@/types/dashboard';
import { WaitMetricCard } from '@/components/dashboard/WaitMetricCard';

export function DashboardPage() {
  const { data, loading, error } = useQuery<{ dashboard: DashboardSummary }>(DASHBOARD_QUERY, {
    pollInterval: 60000,
  });

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
        <Typography variant="h5" gutterBottom>
          Team dashboard
        </Typography>

        {loading && <CircularProgress />}
        {error && (
          <Alert severity="info">
            Dashboard data is not available yet. Implement the metrics aggregation (spec task 11) and run backfill.
          </Alert>
        )}

        {data?.dashboard && (
          <Stack spacing={3}>
            <div>
              <Typography variant="subtitle1" gutterBottom>
                Reviewer wait (per round)
              </Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                {data.dashboard.reviewerWaitByRound.map((m) => (
                  <WaitMetricCard key={m.label} metric={m} />
                ))}
              </Stack>
            </div>
            <div>
              <Typography variant="subtitle1" gutterBottom>
                Author wait (per round)
              </Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                {data.dashboard.authorWaitByRound.map((m) => (
                  <WaitMetricCard key={m.label} metric={m} />
                ))}
              </Stack>
            </div>
            <div>
              <Typography variant="subtitle1" gutterBottom>
                Cycle time
              </Typography>
              <WaitMetricCard metric={data.dashboard.cycleTime} />
            </div>
          </Stack>
        )}
      </Container>
    </Box>
  );
}
