import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { Alert, Skeleton, Stack } from '@mui/material';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import { MY_REVIEWS_QUERY } from '@/graphql/personal';
import type { MyReviews, PersonalPr } from '@/types/personal';
import {
  EmptyRow,
  PrListCard,
  PrRow,
  WaitingChip,
  ago,
  prMetaBase,
} from './PrListCard';
import { NoLinkedIdentity } from './NoLinkedIdentity';
import { PrStateIcon, ReviewPair } from '@/components/shared/pr-visuals';

type Section = 'open' | 'merged';

function reviewers(pr: PersonalPr): string[] {
  return pr.requestedReviewers.length > 0 ? pr.requestedReviewers : pr.reviewerLogins;
}

export function MyReviewsView() {
  const { data, loading, error } = useQuery<{ myReviews: MyReviews }>(MY_REVIEWS_QUERY, {
    pollInterval: 30000,
  });
  const [openSection, setOpenSection] = useState<Section | null>('open');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleSection = (section: Section) =>
    setOpenSection((current) => (current === section ? null : section));
  const toggleRow = (id: string) =>
    setExpandedId((current) => (current === id ? null : id));

  if (loading && !data) {
    return <Skeleton variant="rounded" height={220} />;
  }

  if (error) {
    return <Alert severity="error">Could not load your review queue: {error.message}</Alert>;
  }

  const result = data?.myReviews;
  if (!result) return null;

  if (result.logins.length === 0) {
    return <NoLinkedIdentity />;
  }

  return (
    <Stack spacing={4}>
      <PrListCard
        title="Reviewing"
        icon={<RateReviewOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
        count={result.open.length}
        caption="Open pull requests where you're the reviewer — requested or already reviewing."
        collapsible
        expanded={openSection === 'open'}
        onToggle={() => toggleSection('open')}
      >
        {result.open.length === 0 ? (
          <EmptyRow text="No pull requests are waiting on your review. Inbox zero." />
        ) : (
          result.open.map((pr) => (
            <PrRow
              key={pr.id}
              pr={pr}
              expanded={expandedId === pr.id}
              onToggle={() => toggleRow(pr.id)}
              reviewer={
                <ReviewPair
                  reviewers={reviewers(pr).map((login) => ({ login }))}
                  authorLogin={pr.authorLogin}
                />
              }
              status={<WaitingChip pr={pr} reverseAudience />}
            />
          ))
        )}
      </PrListCard>

      <PrListCard
        title="Recently merged"
        icon={<PrStateIcon state="merged" />}
        count={result.recentlyMerged.length}
        caption="Pull requests you reviewed that merged in the last 14 days."
        collapsible
        expanded={openSection === 'merged'}
        onToggle={() => toggleSection('merged')}
      >
        {result.recentlyMerged.length === 0 ? (
          <EmptyRow text="Nothing you reviewed merged in the last two weeks." />
        ) : (
          result.recentlyMerged.map((pr) => (
            <PrRow
              key={pr.id}
              pr={pr}
              expanded={expandedId === pr.id}
              onToggle={() => toggleRow(pr.id)}
              meta={`${prMetaBase(pr)}${pr.mergedAt ? ` · merged ${ago(pr.mergedAt)}` : ''}`}
              reviewer={
                reviewers(pr).length > 0 ? (
                  <ReviewPair
                    reviewers={reviewers(pr).map((login) => ({ login }))}
                    authorLogin={pr.authorLogin}
                  />
                ) : undefined
              }
            />
          ))
        )}
      </PrListCard>
    </Stack>
  );
}
