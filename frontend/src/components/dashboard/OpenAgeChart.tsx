import { Box, Stack, Typography, alpha, useTheme } from '@mui/material';
import type { StuckPr } from '@/types/dashboard';
import { chipToneColor, type ChipTone } from '@/components/shared/pr-visuals';

const DAY = 86400;

const BUCKETS: { label: string; maxSeconds: number; tone: ChipTone }[] = [
  { label: 'Under 1 day', maxSeconds: DAY, tone: 'green' },
  { label: '1–3 days', maxSeconds: 3 * DAY, tone: 'green' },
  { label: '3–7 days', maxSeconds: 7 * DAY, tone: 'amber' },
  { label: '1–2 weeks', maxSeconds: 14 * DAY, tone: 'amber' },
  { label: 'Over 2 weeks', maxSeconds: Number.POSITIVE_INFINITY, tone: 'red' },
];

export function OpenAgeChart({ prs }: { prs: StuckPr[] }) {
  const theme = useTheme();
  const now = Date.now();
  const counts = BUCKETS.map(() => 0);
  for (const pr of prs) {
    if (!pr.openedAt) {
      continue;
    }
    const age = (now - new Date(pr.openedAt).getTime()) / 1000;
    const index = BUCKETS.findIndex((bucket) => age < bucket.maxSeconds);
    counts[index === -1 ? BUCKETS.length - 1 : index] += 1;
  }
  const max = Math.max(1, ...counts);

  if (prs.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
        Nothing is waiting right now.
      </Typography>
    );
  }

  return (
    <Stack spacing={1.25} sx={{ py: 1 }}>
      {BUCKETS.map((bucket, index) => {
        const color = chipToneColor(theme, bucket.tone);
        const count = counts[index];
        return (
          <Stack key={bucket.label} direction="row" alignItems="center" spacing={1.5}>
            <Typography
              variant="caption"
              sx={{ width: 96, flexShrink: 0, color: 'text.secondary', textAlign: 'right' }}
            >
              {bucket.label}
            </Typography>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Box
                sx={{
                  height: 20,
                  width: `${Math.max(count > 0 ? 4 : 0, (count / max) * 100)}%`,
                  borderRadius: 1,
                  bgcolor: alpha(color, count > 0 ? 0.55 : 0),
                  transition: 'width 0.3s',
                }}
              />
            </Box>
            <Typography
              variant="caption"
              sx={{
                width: 24,
                flexShrink: 0,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: count > 0 ? 'text.primary' : 'text.disabled',
              }}
            >
              {count}
            </Typography>
          </Stack>
        );
      })}
      <Typography variant="caption" color="text.secondary" sx={{ pt: 0.5 }}>
        {prs.length} open {prs.length === 1 ? 'PR is' : 'PRs are'} waiting on someone right now
      </Typography>
    </Stack>
  );
}
