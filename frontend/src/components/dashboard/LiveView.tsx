import { useState } from 'react';
import {
  Box,
  Card,
  Collapse,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  alpha,
} from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import PersonSearchRoundedIcon from '@mui/icons-material/PersonSearchRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import type { DashboardSummary, StuckPr } from '@/types/dashboard';
import { formatDuration } from '@/lib/format';
import { ZoneSection } from './ZoneSection';
import {
  DevAvatar,
  PrStateIcon,
  ReviewerAvatars,
  SoftChip,
  chipToneColor,
} from '@/components/shared/pr-visuals';
import { PrTimeline } from '@/components/shared/PrTimeline';

const STALL_THRESHOLD_SECONDS = 7 * 86400;
const LONG_WAIT_SECONDS = 3 * 86400;

function shortRepo(repo: string): string {
  return repo.includes('/') ? repo.split('/')[1] : repo;
}

function waitingBucket(pr: StuckPr): number {
  if (pr.waitingOn === 'reviewer') {
    return pr.requestedReviewers.length === 0 ? 0 : 1;
  }
  return pr.waitingOn === 'author' ? 2 : 3;
}

function WaitingOnCell({ pr }: { pr: StuckPr }) {
  if (pr.waitingOn === 'reviewer') {
    if (pr.requestedReviewers.length === 0) {
      return (
        <SoftChip
          label="Needs a reviewer"
          tone="amber"
          icon={<PersonSearchRoundedIcon />}
        />
      );
    }
    return (
      <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
        <ReviewerAvatars logins={pr.requestedReviewers} />
        <Typography variant="body2" noWrap>
          {pr.requestedReviewers.join(', ')}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
          to review
        </Typography>
      </Stack>
    );
  }
  if (pr.waitingOn === 'ci') {
    return <SoftChip label="CI checks" tone="gray" icon={<AutorenewRoundedIcon />} />;
  }
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
      <DevAvatar login={pr.authorLogin} size={22} />
      <Typography variant="body2" noWrap>
        {pr.authorLogin}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
        to update
      </Typography>
    </Stack>
  );
}

function WaitCell({ pr }: { pr: StuckPr }) {
  return (
    <Typography
      variant="body2"
      sx={(theme) => ({
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
        color:
          pr.waitingSeconds > LONG_WAIT_SECONDS
            ? chipToneColor(theme, 'amber')
            : 'text.secondary',
      })}
    >
      {formatDuration(pr.waitingSeconds)}
    </Typography>
  );
}

function PrRow({
  pr,
  expanded,
  onToggle,
}: {
  pr: StuckPr;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow
        hover
        onClick={onToggle}
        sx={{ cursor: 'pointer', '& td': expanded ? { border: 0 } : undefined }}
      >
        <TableCell>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
            <PrStateIcon state="open" sx={{ flexShrink: 0 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                {pr.title}
              </Typography>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.25 }}>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {shortRepo(pr.repo)} #{pr.number} · by
                </Typography>
                <DevAvatar login={pr.authorLogin} size={15} />
                <Typography variant="caption" color="text.secondary" noWrap>
                  {pr.authorLogin}
                </Typography>
              </Stack>
            </Box>
          </Stack>
        </TableCell>
        <TableCell>
          <WaitingOnCell pr={pr} />
        </TableCell>
        <TableCell align="right">
          <WaitCell pr={pr} />
        </TableCell>
        <TableCell align="right">
          <Stack direction="row" alignItems="center" spacing={0.25} justifyContent="flex-end">
            <IconButton
              size="small"
              component="a"
              href={pr.url}
              target="_blank"
              rel="noreferrer"
              onClick={(event: React.MouseEvent) => event.stopPropagation()}
              sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
            >
              <OpenInNewRoundedIcon sx={{ fontSize: 15 }} />
            </IconButton>
            <ExpandMoreRoundedIcon
              sx={{
                fontSize: 18,
                color: 'text.disabled',
                transform: expanded ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s',
              }}
            />
          </Stack>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={4} sx={{ p: 0, border: expanded ? undefined : 0 }}>
          <Collapse in={expanded} unmountOnExit>
            <Box
              sx={(theme) => ({
                px: 3,
                borderTop: `1px dashed ${theme.palette.divider}`,
                bgcolor: alpha(theme.palette.text.primary, 0.015),
              })}
            >
              <PrTimeline pr={{ ...pr, mergedAt: null }} />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

function PrTable({
  items,
  expandedKey,
  onToggleRow,
}: {
  items: StuckPr[];
  expandedKey: string | null;
  onToggleRow: (key: string) => void;
}) {
  return (
    <Card>
      <Table
        size="small"
        sx={{
          tableLayout: 'fixed',
          '& td, & th': { px: 2.5, py: 1.5, borderColor: 'divider' },
          '& tbody tr:last-child td': { border: 0 },
          '& thead th': {
            bgcolor: (theme) => alpha(theme.palette.text.primary, 0.02),
            color: 'text.secondary',
            textTransform: 'uppercase',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
          },
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell>Pull request</TableCell>
            <TableCell sx={{ width: 260 }}>Waiting on</TableCell>
            <TableCell align="right" sx={{ width: 80 }}>
              For
            </TableCell>
            <TableCell sx={{ width: 84 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((pr) => {
            const key = `${pr.repo}#${pr.number}`;
            return (
              <PrRow
                key={key}
                pr={pr}
                expanded={expandedKey === key}
                onToggle={() => onToggleRow(key)}
              />
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

type Section = 'needs-reviewer' | 'in-progress' | 'stalled';

export function LiveView({ summary }: { summary: DashboardSummary }) {
  const [openSection, setOpenSection] = useState<Section | null>('needs-reviewer');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const toggleSection = (section: Section) =>
    setOpenSection((current) => (current === section ? null : section));
  const toggleRow = (key: string) =>
    setExpandedRow((current) => (current === key ? null : key));

  const active = summary.stuckNow.filter((pr) => pr.waitingSeconds <= STALL_THRESHOLD_SECONDS);
  const stalled = summary.stuckNow.filter((pr) => pr.waitingSeconds > STALL_THRESHOLD_SECONDS);

  const byWait = (a: StuckPr, b: StuckPr) => b.waitingSeconds - a.waitingSeconds;
  const needsReviewer = active
    .filter((pr) => pr.waitingOn === 'reviewer' && pr.requestedReviewers.length === 0)
    .sort(byWait);
  const inProgress = active
    .filter((pr) => pr.waitingOn !== 'reviewer' || pr.requestedReviewers.length > 0)
    .sort((a, b) => {
      const bucket = waitingBucket(a) - waitingBucket(b);
      return bucket !== 0 ? bucket : byWait(a, b);
    });

  return (
    <Stack spacing={4}>
      <ZoneSection
        title="Needs a reviewer"
        count={needsReviewer.length}
        caption="Nobody is assigned yet — these move only when someone picks them up."
        collapsible
        expanded={openSection === 'needs-reviewer'}
        onToggle={() => toggleSection('needs-reviewer')}
      >
        {needsReviewer.length === 0 ? (
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <Stack spacing={1} alignItems="center">
              <CheckCircleRoundedIcon
                sx={(theme) => ({ color: chipToneColor(theme, 'green'), fontSize: 28 })}
              />
              <Typography variant="body2" color="text.secondary">
                All caught up — every open pull request has a reviewer.
              </Typography>
            </Stack>
          </Card>
        ) : (
          <PrTable items={needsReviewer} expandedKey={expandedRow} onToggleRow={toggleRow} />
        )}
      </ZoneSection>

      {inProgress.length > 0 && (
        <ZoneSection
          title="In progress"
          count={inProgress.length}
          caption="Review is underway — a reviewer, the author, or CI has the ball."
          collapsible
          expanded={openSection === 'in-progress'}
          onToggle={() => toggleSection('in-progress')}
        >
          <PrTable items={inProgress} expandedKey={expandedRow} onToggleRow={toggleRow} />
        </ZoneSection>
      )}

      {stalled.length > 0 && (
        <ZoneSection
          title="Stalled over a week"
          count={stalled.length}
          caption="Waiting longer than 7 days — probably needs a decision, not a reviewer."
          collapsible
          expanded={openSection === 'stalled'}
          onToggle={() => toggleSection('stalled')}
        >
          <PrTable items={stalled} expandedKey={expandedRow} onToggleRow={toggleRow} />
        </ZoneSection>
      )}
    </Stack>
  );
}
