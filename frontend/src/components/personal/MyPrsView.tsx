import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Alert, Button, Skeleton, Snackbar, Stack, Typography } from '@mui/material';
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded';
import { MY_PULL_REQUESTS_QUERY } from '@/graphql/personal';
import { ASSIGN_REVIEWER, RELAY_ASSIGNMENTS_QUERY } from '@/graphql/assignment';
import type { MyPullRequests, PersonalPr } from '@/types/personal';
import type { RelayAssignment } from '@/types/assignment';
import {
  EmptyRow,
  PrListCard,
  PrRow,
  WaitingChip,
  ago,
  prMetaBase,
} from './PrListCard';
import { NoLinkedIdentity } from './NoLinkedIdentity';
import {
  ApprovedChip,
  DevAvatar,
  PrStateIcon,
  ReviewPair,
} from '@/components/shared/pr-visuals';
import {
  AssignmentControls,
  RelayAssignmentPair,
} from '@/components/shared/RelayAssignmentPair';

type Section = 'open' | 'merged';

export function MyPrsView() {
  const { data, loading, error } = useQuery<{ myPullRequests: MyPullRequests }>(
    MY_PULL_REQUESTS_QUERY,
    { pollInterval: 30000 },
  );
  const assignmentsQuery = useQuery<{ relayAssignments: RelayAssignment[] }>(
    RELAY_ASSIGNMENTS_QUERY,
    { pollInterval: 60_000 },
  );
  const assignments = useMemo(
    () =>
      new Map(
        (assignmentsQuery.data?.relayAssignments ?? []).map((assignment) => [
          `${assignment.repo}#${assignment.number}`,
          assignment,
        ]),
      ),
    [assignmentsQuery.data],
  );
  const [assignReviewer] = useMutation(ASSIGN_REVIEWER);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<Section | null>('open');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleSection = (section: Section) =>
    setOpenSection((current) => (current === section ? null : section));
  const toggleRow = (id: string) =>
    setExpandedId((current) => (current === id ? null : id));

  const onAssign = (pr: PersonalPr) => {
    setAssigningId(pr.id);
    setAssignError(null);
    void assignReviewer({ variables: { repo: pr.repo, number: pr.number } })
      .then(() => assignmentsQuery.refetch())
      .catch((mutationError: Error) => setAssignError(mutationError.message))
      .finally(() => setAssigningId(null));
  };

  const openCells = (pr: PersonalPr): { reviewer?: ReactNode; status?: ReactNode } => {
    if (pr.approvedAt && !pr.mergedAt) {
      return {
        reviewer:
          pr.reviewerLogins.length > 0 ? (
            <ReviewPair
              reviewers={pr.reviewerLogins.map((login) => ({ login }))}
              authorLogin={pr.authorLogin}
            />
          ) : undefined,
        status: <ApprovedChip />,
      };
    }
    const reviewers =
      pr.requestedReviewers.length > 0 ? pr.requestedReviewers : pr.reviewerLogins;
    if (reviewers.length > 0) {
      return {
        reviewer: (
          <ReviewPair
            reviewers={reviewers.map((login) => ({ login }))}
            authorLogin={pr.authorLogin}
          />
        ),
        status: <WaitingChip pr={pr} />,
      };
    }
    const assignment = assignments.get(`${pr.repo}#${pr.number}`);
    if (assignment) {
      return {
        reviewer: (
          <RelayAssignmentPair assignment={assignment} authorLogin={pr.authorLogin} />
        ),
        status: (
          <AssignmentControls
            assignment={assignment}
            onChanged={() => void assignmentsQuery.refetch()}
            onError={setAssignError}
          />
        ),
      };
    }
    if (!pr.isDraft && !pr.mergedAt && pr.waitingOn === 'REVIEWER') {
      return {
        reviewer: (
          <Button
            size="small"
            variant="outlined"
            color="primary"
            startIcon={<PersonAddAltRoundedIcon sx={{ fontSize: 15 }} />}
            disabled={assigningId === pr.id}
            onClick={(event) => {
              event.stopPropagation();
              onAssign(pr);
            }}
            sx={{ whiteSpace: 'nowrap', py: 0.25, fontSize: 12.5 }}
          >
            {assigningId === pr.id ? 'Picking…' : 'Assign reviewer'}
          </Button>
        ),
      };
    }
    return { status: <WaitingChip pr={pr} /> };
  };

  if (loading && !data) {
    return (
      <Stack spacing={3}>
        <Skeleton variant="rounded" height={220} />
        <Skeleton variant="rounded" height={160} />
      </Stack>
    );
  }

  if (error) {
    return <Alert severity="error">Could not load your pull requests: {error.message}</Alert>;
  }

  const result = data?.myPullRequests;
  if (!result) return null;

  if (result.logins.length === 0) {
    return <NoLinkedIdentity />;
  }

  return (
    <Stack spacing={4}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="body2" color="text.secondary">
          Authored by
        </Typography>
        {result.logins.map((login) => (
          <Stack key={login} direction="row" alignItems="center" spacing={0.75}>
            <DevAvatar login={login} size={22} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {login}
            </Typography>
          </Stack>
        ))}
      </Stack>

      <PrListCard
        title="Open"
        icon={<PrStateIcon state="open" />}
        count={result.open.length}
        caption="Where each of your pull requests is waiting."
        collapsible
        expanded={openSection === 'open'}
        onToggle={() => toggleSection('open')}
      >
        {result.open.length === 0 ? (
          <EmptyRow text="No open pull requests right now. Enjoy the calm." />
        ) : (
          result.open.map((pr) => (
            <PrRow
              key={pr.id}
              pr={pr}
              expanded={expandedId === pr.id}
              onToggle={() => toggleRow(pr.id)}
              {...openCells(pr)}
            />
          ))
        )}
      </PrListCard>

      <PrListCard
        title="Recently merged"
        icon={<PrStateIcon state="merged" />}
        count={result.recentlyMerged.length}
        caption="Merged in the last 14 days."
        collapsible
        expanded={openSection === 'merged'}
        onToggle={() => toggleSection('merged')}
      >
        {result.recentlyMerged.length === 0 ? (
          <EmptyRow text="Nothing merged in the last two weeks." />
        ) : (
          result.recentlyMerged.map((pr) => (
            <PrRow
              key={pr.id}
              pr={pr}
              expanded={expandedId === pr.id}
              onToggle={() => toggleRow(pr.id)}
              meta={`${prMetaBase(pr)}${pr.mergedAt ? ` · merged ${ago(pr.mergedAt)}` : ''}`}
              reviewer={
                pr.reviewerLogins.length > 0 ? (
                  <ReviewPair
                    reviewers={pr.reviewerLogins.map((login) => ({ login }))}
                    authorLogin={pr.authorLogin}
                  />
                ) : undefined
              }
            />
          ))
        )}
      </PrListCard>

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
