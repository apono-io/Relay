import { Box, Stack, Tooltip, Typography } from '@mui/material';
import type { WaitMetric } from '@/types/dashboard';
import { formatDuration } from '@/lib/format';

export type WaitStat = 'median' | 'p90';

const REVIEWER_COLOR = 'primary.main';
const AUTHOR_COLOR = '#64748b';
const MIN_INLINE_FRACTION = 0.08;

type Owner = 'reviewer' | 'author';

type Segment = {
  key: string;
  caption: string;
  owner: Owner;
  seconds: number;
  sampleSize: number;
};

function roundOf(metric: WaitMetric): number {
  const match = metric.label.match(/round (\d+)/);
  return match ? Number(match[1]) : 1;
}

function value(metric: WaitMetric, stat: WaitStat): number | null {
  return stat === 'median' ? metric.medianSeconds : metric.p90Seconds;
}

function buildSegments(reviewerRounds: WaitMetric[], authorRounds: WaitMetric[], stat: WaitStat): Segment[] {
  const reviewerByRound = new Map(reviewerRounds.map((m) => [roundOf(m), m]));
  const authorByRound = new Map(authorRounds.map((m) => [roundOf(m), m]));
  const maxRound = Math.max(0, ...reviewerByRound.keys(), ...authorByRound.keys());

  const segments: Segment[] = [];
  for (let round = 1; round <= maxRound; round += 1) {
    const reviewer = reviewerByRound.get(round);
    const reviewerSeconds = reviewer ? value(reviewer, stat) : null;
    if (reviewer && reviewerSeconds != null && reviewerSeconds > 0) {
      segments.push({
        key: `reviewer-${round}`,
        caption: round === 1 ? 'waiting for a reviewer' : 'waiting for re-review',
        owner: 'reviewer',
        seconds: reviewerSeconds,
        sampleSize: reviewer.sampleSize,
      });
    }
    const author = authorByRound.get(round);
    const authorSeconds = author ? value(author, stat) : null;
    if (author && authorSeconds != null && authorSeconds > 0) {
      segments.push({
        key: `author-${round}`,
        caption: 'back with the author',
        owner: 'author',
        seconds: authorSeconds,
        sampleSize: author.sampleSize,
      });
    }
  }
  return segments;
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.75}>
      <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: color }} />
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}

export function WaitFlowChart({
  reviewerRounds,
  authorRounds,
  stat,
}: {
  reviewerRounds: WaitMetric[];
  authorRounds: WaitMetric[];
  stat: WaitStat;
}) {
  const segments = buildSegments(reviewerRounds, authorRounds, stat);
  const total = segments.reduce((sum, s) => sum + s.seconds, 0);
  const statLabel = stat === 'median' ? 'median' : 'p90';

  if (segments.length === 0 || total === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Not enough review activity yet to show the wait breakdown.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ pt: 1.5, pb: 0.5 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          Opened
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          Merged
        </Typography>
      </Stack>

      <Stack direction="row" sx={{ height: 40, gap: '3px' }}>
        {segments.map((s) => {
          const fraction = s.seconds / total;
          const color = s.owner === 'reviewer' ? REVIEWER_COLOR : AUTHOR_COLOR;
          return (
            <Tooltip
              key={s.key}
              title={`${s.caption}: ${formatDuration(s.seconds)} — ${statLabel} over ${s.sampleSize} PRs`}
            >
              <Box
                sx={{
                  flex: `${s.seconds} 1 0`,
                  minWidth: 4,
                  bgcolor: color,
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  cursor: 'default',
                }}
              >
                {fraction >= MIN_INLINE_FRACTION && (
                  <Typography
                    sx={{ color: '#fff', fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                  >
                    {formatDuration(s.seconds)}
                  </Typography>
                )}
              </Box>
            </Tooltip>
          );
        })}
      </Stack>

      <Stack direction="row" sx={{ mt: 0.75, gap: '3px' }}>
        {segments.map((s) => {
          const fraction = s.seconds / total;
          return (
            <Stack key={s.key} sx={{ flex: `${s.seconds} 1 0`, minWidth: 4, px: 0.25 }} alignItems="center" spacing={0.25}>
              {fraction < MIN_INLINE_FRACTION && (
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
                  {formatDuration(s.seconds)}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" align="center" sx={{ lineHeight: 1.25 }}>
                {s.caption}
              </Typography>
            </Stack>
          );
        })}
      </Stack>

      <Stack direction="row" spacing={2.5} sx={{ mt: 2 }}>
        <LegendSwatch color={REVIEWER_COLOR} label="ball with reviewer" />
        <LegendSwatch color={AUTHOR_COLOR} label="ball with author" />
      </Stack>
    </Box>
  );
}
