import { useQuery } from '@apollo/client';
import { Stack, Typography, Alert, Skeleton, Card } from '@mui/material';
import { DASHBOARD_QUERY } from '@/graphql/dashboard';
import type { DashboardSummary } from '@/types/dashboard';
import { AppShell, VIEW_TITLES } from '@/components/layout/AppShell';
import { StatusStrip } from '@/components/dashboard/StatusStrip';
import { LiveView } from '@/components/dashboard/LiveView';
import { TrendsView } from '@/components/dashboard/TrendsView';
import { MyPrsView } from '@/components/personal/MyPrsView';
import { MyReviewsView } from '@/components/personal/MyReviewsView';

type View = 'dashboard' | 'analytics' | 'my-prs' | 'my-reviews';

function LoadingState() {
  return (
    <Stack spacing={3}>
      <Skeleton variant="rounded" height={56} />
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={120} sx={{ flex: '1 1 210px' }} />
        ))}
      </Stack>
      <Skeleton variant="rounded" height={320} />
    </Stack>
  );
}

function PersonalView({ view }: { view: 'my-prs' | 'my-reviews' }) {
  return view === 'my-prs' ? <MyPrsView /> : <MyReviewsView />;
}

export function DashboardPage({ view }: { view: View }) {
  const isPersonal = view === 'my-prs' || view === 'my-reviews';
  const { data, loading, error } = useQuery<{ dashboard: DashboardSummary }>(DASHBOARD_QUERY, {
    pollInterval: 15000,
    skip: isPersonal,
  });
  const dashboard = data?.dashboard;

  return (
    <AppShell view={view}>
      {isPersonal ? (
        <Stack spacing={{ xs: 3, md: 4 }}>
          <StatusStrip title={VIEW_TITLES[view]} />
          <PersonalView view={view} />
        </Stack>
      ) : (
        <>
          {loading && <LoadingState />}

          {error && (
            <Alert severity="info">Dashboard data is not available yet. Run the backfill and reload.</Alert>
          )}

          {dashboard && (
            <Stack spacing={{ xs: 3, md: 4 }}>
              <StatusStrip title={VIEW_TITLES[view]} />
              {view === 'dashboard' ? <LiveView summary={dashboard} /> : <TrendsView summary={dashboard} />}
            </Stack>
          )}

          {!loading && !error && !dashboard && (
            <Card sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No data yet — run the backfill to populate the dashboard.
              </Typography>
            </Card>
          )}
        </>
      )}
    </AppShell>
  );
}
