import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import {
  Alert,
  Box,
  Button,
  Card,
  IconButton,
  Snackbar,
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
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import type { DashboardSummary, StuckPr } from '@/types/dashboard';
import type { RelayAssignment } from '@/types/assignment';
import { ASSIGN_REVIEWER, RELAY_ASSIGNMENTS_QUERY } from '@/graphql/assignment';
import { formatDuration } from '@/lib/format';
import { ZoneSection } from './ZoneSection';
import {
  ApprovedChip,
  DevAvatar,
  PrStateIcon,
  ReviewPair,
  SoftChip,
  chipToneColor,
} from '@/components/shared/pr-visuals';
import {
  AssignmentControls,
  RelayAssignmentPair,
} from '@/components/shared/RelayAssignmentPair';
import { PrTimeline } from '@/components/shared/PrTimeline';
import { RepoChip } from '@/components/shared/RepoChip';
import { SensitivityDots } from '@/components/shared/SensitivityDots';

export function prKey(pr: { repo: string; number: number }): string {
  return `${pr.repo}#${pr.number}`;
}

const STALL_THRESHOLD_SECONDS = 7 * 86400;
const LONG_WAIT_SECONDS = 3 * 86400;

function waitingBucket(pr: StuckPr): number {
  if (pr.waitingOn === 'reviewer') {
    return pr.requestedReviewers.length === 0 ? 0 : 1;
  }
  return pr.waitingOn === 'author' ? 2 : 3;
}

function WaitingSlots({ who, status }: { who?: React.ReactNode; status?: React.ReactNode }) {
  if (!who || !status) {
    return (
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="center"
        sx={{ width: 340, maxWidth: '100%', mx: 'auto' }}
      >
        {who ?? status}
      </Stack>
    );
  }
  return (
    <Stack direction="row" alignItems="center" sx={{ width: 340, maxWidth: '100%', mx: 'auto' }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="center"
        sx={{ minWidth: 210, flexShrink: 0 }}
      >
        {who}
      </Stack>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="center"
        sx={{ flexGrow: 1, flexShrink: 0, minWidth: 0 }}
      >
        {status}
      </Stack>
    </Stack>
  );
}

function StatusCaption({ text }: { text: string }) {
  return (
    <Typography variant="caption" color="text.secondary" noWrap>
      {text}
    </Typography>
  );
}

function WaitingOnCell({
  pr,
  assignment,
  onAssign,
  assigning,
  onAssignmentsChanged,
  onAssignmentError,
}: {
  pr: StuckPr;
  assignment?: RelayAssignment;
  onAssign: (pr: StuckPr) => void;
  assigning: boolean;
  onAssignmentsChanged: () => void;
  onAssignmentError: (message: string) => void;
}) {
  if (pr.approvedAt) {
    return (
      <WaitingSlots
        who={
          pr.reviewerLogins.length > 0 ? (
            <ReviewPair
              reviewers={pr.reviewerLogins.map((login) => ({ login }))}
              authorLogin={pr.authorLogin}
            />
          ) : undefined
        }
        status={<ApprovedChip />}
      />
    );
  }

  if (pr.waitingOn === 'ci') {
    return (
      <WaitingSlots
        status={<SoftChip label="CI checks" tone="gray" icon={<AutorenewRoundedIcon />} />}
      />
    );
  }

  const reviewers =
    pr.requestedReviewers.length > 0 ? pr.requestedReviewers : pr.reviewerLogins;
  if (reviewers.length > 0) {
    return (
      <WaitingSlots
        who={
          <ReviewPair
            reviewers={reviewers.map((login) => ({ login }))}
            authorLogin={pr.authorLogin}
          />
        }
        status={
          <StatusCaption
            text={
              pr.waitingOn === 'reviewer'
                ? reviewers.length > 1
                  ? "reviewers' turn"
                  : `${reviewers[0]}'s turn`
                : `${pr.authorLogin}'s turn`
            }
          />
        }
      />
    );
  }

  if (assignment) {
    return (
      <WaitingSlots
        who={<RelayAssignmentPair assignment={assignment} authorLogin={pr.authorLogin} />}
        status={
          <AssignmentControls
            assignment={assignment}
            onChanged={onAssignmentsChanged}
            onError={onAssignmentError}
          />
        }
      />
    );
  }

  if (pr.waitingOn === 'reviewer') {
    return (
      <WaitingSlots
        who={
          <Button
            size="small"
            variant="outlined"
            color="primary"
            startIcon={<PersonAddAltRoundedIcon sx={{ fontSize: 15 }} />}
            disabled={assigning}
            onClick={(event) => {
              event.stopPropagation();
              onAssign(pr);
            }}
            sx={{ whiteSpace: 'nowrap', py: 0.25, fontSize: 12.5 }}
          >
            {assigning ? 'Picking…' : 'Assign reviewer'}
          </Button>
        }
      />
    );
  }

  return (
    <WaitingSlots
      who={
        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
          <DevAvatar login={pr.authorLogin} size={22} />
          <Typography variant="body2" noWrap>
            {pr.authorLogin}
          </Typography>
        </Stack>
      }
      status={<StatusCaption text={`${pr.authorLogin}'s turn`} />}
    />
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

type AssignProps = {
  assignments: Map<string, RelayAssignment>;
  onAssign: (pr: StuckPr) => void;
  assigningKey: string | null;
  onAssignmentsChanged: () => void;
  onAssignmentError: (message: string) => void;
};

function PrRow({
  pr,
  expanded,
  onToggle,
  assign,
}: {
  pr: StuckPr;
  expanded: boolean;
  onToggle: () => void;
  assign: AssignProps;
}) {
  return (
    <>
      <TableRow
        hover
        onClick={onToggle}
        sx={{ cursor: 'pointer', '& td': expanded ? { borderBottom: 0 } : undefined }}
      >
        <TableCell>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
            <PrStateIcon state="open" sx={{ flexShrink: 0 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                {pr.title}
              </Typography>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.4 }}>
                <RepoChip repo={pr.repo} />
                <Typography variant="caption" color="text.secondary" noWrap>
                  #{pr.number} · by
                </Typography>
                <DevAvatar login={pr.authorLogin} size={15} />
                <Typography variant="caption" color="text.secondary" noWrap>
                  {pr.authorLogin}
                </Typography>
              </Stack>
            </Box>
          </Stack>
        </TableCell>
        <TableCell align="center">
          <SensitivityDots sensitivity={pr.sensitivity} area={pr.area} />
        </TableCell>
        <TableCell>
          <Box sx={{ height: 44, display: 'flex', alignItems: 'center' }}>
            <WaitingOnCell
              pr={pr}
              assignment={assign.assignments.get(prKey(pr))}
              onAssign={assign.onAssign}
              assigning={assign.assigningKey === prKey(pr)}
              onAssignmentsChanged={assign.onAssignmentsChanged}
              onAssignmentError={assign.onAssignmentError}
            />
          </Box>
        </TableCell>
        <TableCell align="center">
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
      {expanded && (
        <TableRow>
          <TableCell colSpan={5} className="relay-detail-cell">
            <Box
              sx={(theme) => ({
                px: 3,
                borderTop: `1px dashed ${theme.palette.divider}`,
                bgcolor: alpha(theme.palette.text.primary, 0.015),
              })}
            >
              <PrTimeline pr={{ ...pr, mergedAt: null }} />
            </Box>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function PrTable({
  items,
  expandedKey,
  onToggleRow,
  assign,
}: {
  items: StuckPr[];
  expandedKey: string | null;
  onToggleRow: (key: string) => void;
  assign: AssignProps;
}) {
  return (
    <Card>
      <Table
        size="small"
        sx={{
          tableLayout: 'fixed',
          '& td, & th': { px: 2.5, py: 1.25, borderColor: 'divider' },
          '& td.relay-detail-cell': { p: 0 },
          '& tbody tr:last-child td': { borderBottom: 0 },
          '& thead th': {
            py: 1,
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
            <TableCell align="center" sx={{ width: 76 }}>
              Sensitivity
            </TableCell>
            <TableCell align="center" sx={{ width: 400 }}>
              Waiting on
            </TableCell>
            <TableCell align="center" sx={{ width: 80 }}>
              For
            </TableCell>
            <TableCell sx={{ width: 84 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((pr) => {
            const key = prKey(pr);
            return (
              <PrRow
                key={key}
                pr={pr}
                expanded={expandedKey === key}
                onToggle={() => onToggleRow(key)}
                assign={assign}
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
  const [assigningKey, setAssigningKey] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [justAssigned, setJustAssigned] = useState<Set<string>>(new Set());

  const assignmentsQuery = useQuery<{ relayAssignments: RelayAssignment[] }>(
    RELAY_ASSIGNMENTS_QUERY,
    { pollInterval: 60_000 },
  );
  const assignments = useMemo(
    () =>
      new Map(
        (assignmentsQuery.data?.relayAssignments ?? []).map((assignment) => [
          prKey(assignment),
          assignment,
        ]),
      ),
    [assignmentsQuery.data],
  );
  const [assignReviewer] = useMutation(ASSIGN_REVIEWER);

  const onAssign = (pr: StuckPr) => {
    const key = prKey(pr);
    setAssigningKey(key);
    setAssignError(null);
    void assignReviewer({ variables: { repo: pr.repo, number: pr.number } })
      .then(() => {
        setJustAssigned((current) => new Set(current).add(key));
        return assignmentsQuery.refetch();
      })
      .catch((error: Error) => setAssignError(error.message))
      .finally(() => setAssigningKey(null));
  };
  const assign: AssignProps = {
    assignments,
    onAssign,
    assigningKey,
    onAssignmentsChanged: () => void assignmentsQuery.refetch(),
    onAssignmentError: setAssignError,
  };

  const toggleSection = (section: Section) =>
    setOpenSection((current) => (current === section ? null : section));
  const toggleRow = (key: string) =>
    setExpandedRow((current) => (current === key ? null : key));

  const active = summary.stuckNow.filter((pr) => pr.waitingSeconds <= STALL_THRESHOLD_SECONDS);
  const stalled = summary.stuckNow.filter((pr) => pr.waitingSeconds > STALL_THRESHOLD_SECONDS);

  const byWait = (a: StuckPr, b: StuckPr) => b.waitingSeconds - a.waitingSeconds;
  const hasReviewer = (pr: StuckPr) =>
    pr.requestedReviewers.length > 0 ||
    pr.reviewerLogins.length > 0 ||
    (assignments.has(prKey(pr)) && !justAssigned.has(prKey(pr)));
  const needsReviewer = active
    .filter((pr) => pr.waitingOn === 'reviewer' && !hasReviewer(pr))
    .sort(byWait);
  const inProgress = active
    .filter((pr) => pr.waitingOn !== 'reviewer' || hasReviewer(pr))
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
                All caught up — nothing from the last week is waiting for a
                reviewer in the repositories Relay watches.
              </Typography>
            </Stack>
          </Card>
        ) : (
          <PrTable
            items={needsReviewer}
            expandedKey={expandedRow}
            onToggleRow={toggleRow}
            assign={assign}
          />
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
          <PrTable
            items={inProgress}
            expandedKey={expandedRow}
            onToggleRow={toggleRow}
            assign={assign}
          />
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
          <PrTable
            items={stalled}
            expandedKey={expandedRow}
            onToggleRow={toggleRow}
            assign={assign}
          />
        </ZoneSection>
      )}

      <Snackbar
        open={assignError !== null}
        autoHideDuration={6000}
        onClose={() => setAssignError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" variant="filled" onClose={() => setAssignError(null)}>
          {assignError}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
