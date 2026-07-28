import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { Alert, Skeleton, Stack, Typography } from '@mui/material';
import { MY_PULL_REQUESTS_QUERY } from '@/graphql/personal';
import type { MyPullRequests } from '@/types/personal';
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
  DevAvatar,
  PrStateIcon,
  ReviewerAvatars,
} from '@/components/shared/pr-visuals';

type Section = 'open' | 'merged';

export function MyPrsView() {
  const { data, loading, error } = useQuery<{ myPullRequests: MyPullRequests }>(
    MY_PULL_REQUESTS_QUERY,
    { pollInterval: 30000 },
  );
  const [openSection, setOpenSection] = useState<Section | null>('open');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleSection = (section: Section) =>
    setOpenSection((current) => (current === section ? null : section));
  const toggleRow = (id: string) =>
    setExpandedId((current) => (current === id ? null : id));

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
              trailing={
                <>
                  <ReviewerAvatars logins={pr.requestedReviewers} />
                  <WaitingChip pr={pr} />
                </>
              }
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
            />
          ))
        )}
      </PrListCard>
    </Stack>
  );
}
