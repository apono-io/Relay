import { useQuery } from '@apollo/client';
import {
  Alert,
  Box,
  Card,
  Link,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { formatDistanceToNow } from 'date-fns';
import { ASSIGNMENT_COMPARISON_QUERY } from '@/graphql/system';
import type {
  AssignmentComparison,
  PickSignals,
  SuggestionOutcomeRow,
} from '@/types/system';
import { SoftChip } from '@/components/shared/pr-visuals';

function signalLines(signals: PickSignals, area: string | null): string[] {
  const areaLabel = area ?? 'Whole repo';
  return [
    signals.areaRank === null
      ? `${areaLabel}: no recent activity`
      : `${areaLabel}: #${signals.areaRank} of ${signals.areaPool}`,
    `Open requests: ${signals.openReviewRequests}`,
    `Reviews (14d): ${signals.reviewsLast14Days}`,
  ];
}

function outcomeChip(row: SuggestionOutcomeRow) {
  if (!row.resolvedAt) {
    return <SoftChip label="Waiting" tone="gray" />;
  }
  if (row.matched === true) {
    return <SoftChip label="Agreed" tone="green" />;
  }
  if (row.matched === false) {
    return <SoftChip label="Different" tone="amber" />;
  }
  return <SoftChip label="Closed unreviewed" tone="gray" />;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 110 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

export function AssignmentQuietPhase() {
  const { data, loading, error } = useQuery<{
    assignmentComparison: AssignmentComparison;
  }>(ASSIGNMENT_COMPARISON_QUERY, { pollInterval: 60_000 });

  const comparison = data?.assignmentComparison;

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
          Assignment engine · quiet phase
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Relay records the reviewer it would pick for every PR opened in the last week
          that has no reviewer, and writes nothing to GitHub. Compare its picks with
          what the team actually did before turning assignment on.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error">Could not load the comparison: {error.message}</Alert>
      )}

      {loading && !comparison ? (
        <Skeleton variant="rounded" height={220} />
      ) : comparison ? (
        <>
          <Stack direction="row" spacing={4} flexWrap="wrap" useFlexGap>
            <Stat label="Picks recorded" value={String(comparison.recorded)} />
            <Stat label="Decided by the team" value={String(comparison.decided)} />
            <Stat
              label="Relay agreed"
              value={
                comparison.agreementRate === null
                  ? '—'
                  : `${Math.round(comparison.agreementRate * 100)}%`
              }
            />
            <Stat label="Still waiting" value={String(comparison.awaiting)} />
          </Stack>

          <Card>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Pull request</TableCell>
                  <TableCell>Relay would pick</TableCell>
                  <TableCell>What happened</TableCell>
                  <TableCell sx={{ width: 150 }}>Outcome</TableCell>
                  <TableCell align="right" sx={{ width: 130 }}>
                    Recorded
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {comparison.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell sx={{ maxWidth: 320 }}>
                      <Link
                        href={row.prUrl}
                        target="_blank"
                        rel="noreferrer"
                        underline="hover"
                        color="inherit"
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          display: 'block',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        #{row.prNumber} {row.prTitle}
                      </Link>
                      <Typography variant="caption" color="text.secondary">
                        {row.area ?? 'No mapped area'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: 200 }}>
                      <Tooltip
                        title={`Shown to developers as: “${row.reason}”`}
                        placement="top-start"
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {row.suggestedName}
                        </Typography>
                      </Tooltip>
                      {row.signals &&
                        signalLines(row.signals, row.area).map((line) => (
                          <Typography
                            key={line}
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: 'block',
                              lineHeight: 1.6,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {line}
                          </Typography>
                        ))}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {row.actualNames.length > 0 ? row.actualNames.join(', ') : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>{outcomeChip(row)}</TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="text.secondary">
                        {formatDistanceToNow(new Date(row.generatedAt), {
                          addSuffix: true,
                        })}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
                {comparison.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ py: 2, textAlign: 'center' }}
                      >
                        No picks recorded yet — the next sweep runs within a few
                        minutes of a reviewer-less PR appearing.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      ) : null}
    </Stack>
  );
}
