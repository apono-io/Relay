import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { Alert, Box, Skeleton, Stack } from '@mui/material';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import { MY_REVIEWS_QUERY } from '@/graphql/personal';
import type { MyReviews } from '@/types/personal';
import {
  EmptyRow,
  PrListCard,
  PrRow,
  WaitingChip,
  ago,
  prMetaBase,
} from './PrListCard';
import { NoLinkedIdentity } from './NoLinkedIdentity';
import { DevAvatar } from '@/components/shared/pr-visuals';

export function MyReviewsView() {
  const { data, loading, error } = useQuery<{ myReviews: MyReviews }>(MY_REVIEWS_QUERY, {
    pollInterval: 30000,
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
        title="Waiting on your review"
        icon={<RateReviewOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
        count={result.waiting.length}
        caption="Open, non-draft pull requests where your review is requested — oldest first."
      >
        {result.waiting.length === 0 ? (
          <EmptyRow text="No pull requests are waiting on your review. Inbox zero." />
        ) : (
          result.waiting.map((pr) => (
            <PrRow
              key={pr.id}
              pr={pr}
              expanded={expandedId === pr.id}
              onToggle={() => setExpandedId((current) => (current === pr.id ? null : pr.id))}
              meta={
                <>
                  <Box component="span">{prMetaBase(pr)} · by</Box>
                  <DevAvatar login={pr.authorLogin} size={16} />
                  <Box component="span">
                    {pr.authorLogin}
                    {pr.openedAt ? ` · opened ${ago(pr.openedAt)}` : ''}
                  </Box>
                </>
              }
              trailing={<WaitingChip pr={pr} reverseAudience />}
            />
          ))
        )}
      </PrListCard>
    </Stack>
  );
}
