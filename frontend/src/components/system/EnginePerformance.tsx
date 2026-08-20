import { useQuery } from '@apollo/client';
import {
  Alert,
  Box,
  Card,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { useTheme } from '@mui/material/styles';
import { ASSIGNMENT_PERFORMANCE_QUERY } from '@/graphql/system';
import type {
  AssignmentAreaPoint,
  AssignmentPerformance,
  AssignmentSpreadPoint,
} from '@/types/system';
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
        Could not load engine performance: {error.message}
      </Alert>
    );
  }

  const performance = data?.assignmentPerformance;
  if (!performance) {
    return null;
  }

  const { totals, weekly, byArea, spread } = performance;

  if (totals.recorded === 0) {
    return (
      <Card sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          No picks recorded yet
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          The sweep records a pick for every pull request that has no reviewer.
          Numbers appear here once it has run.
        </Typography>
      </Card>
    );
  }

  const green = chipToneColor(theme, 'green');
  const blue = chipToneColor(theme, 'blue');
  const purple = chipToneColor(theme, 'purple');
  const gray = chipToneColor(theme, 'gray');

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: '1fr',
            sm: '1fr 1fr',
            md: 'repeat(4, 1fr)',
          },
        }}
      >
        <Kpi
          label="Agreed with the team"
          value={formatPct(totals.agreementRate)}
          sub={`${totals.agreements} of ${totals.decided} decided`}
        />
        <Kpi
          label="Picks recorded"
          value={String(totals.recorded)}
          sub={`${totals.awaiting} still waiting on the team`}
        />
        <Kpi
          label="Found someone"
          value={formatPct(totals.coverageRate)}
          sub={`${totals.peoplePicked} different people picked`}
        />
        <Kpi
          label="Team decided after"
          value={formatDuration(totals.medianDecisionSeconds)}
          sub="typical time from pick to decision"
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        }}
      >
        <Panel
          title="Is it being used"
          caption="Picks the engine recorded each week, and how many became real assignments."
        >
          <BarChart
            height={250}
            borderRadius={4}
            xAxis={[{ scaleType: 'band', data: weekly.map((point) => point.week) }]}
            series={[
              {
                data: weekly.map((point) => point.recorded),
                label: 'Recorded',
                color: gray,
              },
              {
                data: weekly.map((point) => point.assigned),
                label: 'Assigned',
                color: blue,
              },
            ]}
            margin={{ top: 20, right: 10, bottom: 24, left: 40 }}
          />
        </Panel>

        <Panel
          title="Is it getting it right"
          caption="Share of decided picks where the team chose the same person."
        >
          <LineChart
            height={250}
            xAxis={[{ scaleType: 'point', data: weekly.map((point) => point.week) }]}
            yAxis={[
              {
                min: 0,
                max: 1,
                valueFormatter: (value: number) => formatPct(value),
              },
            ]}
            series={[
              {
                data: weekly.map((point) => point.agreementRate),
                label: 'Agreement',
                color: green,
                curve: 'monotoneX',
                showMark: false,
                area: true,
                valueFormatter: (value: number | null) => formatPct(value),
              },
            ]}
            margin={{ top: 20, right: 10, bottom: 24, left: 48 }}
          />
        </Panel>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        }}
      >
        <Panel
          title="Where it picks most"
          caption="Code areas the engine sees most often, and how often the team agreed there."
        >
          <Stack spacing={1.25} sx={{ pt: 1 }}>
            {byArea.map((point) => (
              <AreaBar
                key={point.area}
                point={point}
                max={Math.max(...byArea.map((entry) => entry.recorded))}
                color={blue}
              />
            ))}
          </Stack>
        </Panel>

        <Panel
          title="How picks spread"
          caption="Times each person came out as the pick. Flat is healthy; a spike means the pool is thin."
        >
          <Stack spacing={1.25} sx={{ pt: 1 }}>
            {spread.map((point) => (
              <SpreadBar
                key={point.displayName}
                point={point}
                max={Math.max(...spread.map((entry) => entry.picks))}
                color={purple}
              />
            ))}
          </Stack>
        </Panel>
      </Box>

      <Panel
        title="How assignments were triggered"
        caption="Relay only writes to GitHub when the live switch is on; everything else stays a test."
      >
        <Stack direction="row" spacing={4} sx={{ pt: 1, flexWrap: 'wrap' }}>
          <MiniStat label="Assigned in total" value={totals.assigned} />
          <MiniStat label="By the sweep" value={totals.autoAssigned} />
          <MiniStat label="By a person" value={totals.manualAssigned} />
          <MiniStat label="Written to GitHub" value={totals.liveAssigned} />
        </Stack>
      </Panel>
    </Stack>
  );
}

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
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
      <Typography variant="caption" color="text.secondary">
        {sub}
      </Typography>
    </Card>
  );
}

function AreaBar({
  point,
  max,
  color,
}: {
  point: AssignmentAreaPoint;
  max: number;
  color: string;
}) {
  const width = max > 0 ? (point.recorded / max) * 100 : 0;
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" spacing={1}>
        <Typography variant="caption" sx={{ fontWeight: 600 }} noWrap>
          {point.area}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
        >
          {point.recorded}
          {point.agreementRate !== null
            ? ` · ${formatPct(point.agreementRate)} agreed`
            : ''}
        </Typography>
      </Stack>
      <Tooltip
        title={`${point.recorded} picks, ${point.decided} decided`}
        arrow
        placement="top"
      >
        <Box
          sx={{
            mt: 0.5,
            height: 8,
            borderRadius: 999,
            bgcolor: (theme) => alpha(theme.palette.text.primary, 0.06),
          }}
        >
          <Box
            sx={{
              width: `${width}%`,
              height: '100%',
              borderRadius: 999,
              bgcolor: alpha(color, 0.55),
            }}
          />
        </Box>
      </Tooltip>
    </Box>
  );
}

function SpreadBar({
  point,
  max,
  color,
}: {
  point: AssignmentSpreadPoint;
  max: number;
  color: string;
}) {
  const width = max > 0 ? (point.picks / max) * 100 : 0;
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" spacing={1}>
        <Typography variant="caption" sx={{ fontWeight: 600 }} noWrap>
          {point.displayName}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
        >
          {point.picks}
        </Typography>
      </Stack>
      <Box
        sx={{
          mt: 0.5,
          height: 8,
          borderRadius: 999,
          bgcolor: (theme) => alpha(theme.palette.text.primary, 0.06),
        }}
      >
        <Box
          sx={{
            width: `${width}%`,
            height: '100%',
            borderRadius: 999,
            bgcolor: alpha(color, 0.55),
          }}
        />
      </Box>
    </Box>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <Box>
      <Typography
        variant="h6"
        sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}
