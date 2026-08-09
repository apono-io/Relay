import { useState } from 'react';
import { useMutation } from '@apollo/client';
import { Box, Divider, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import type { RelayAssignment } from '@/types/assignment';
import { RESET_ASSIGNMENT } from '@/graphql/assignment';
import { ReviewPair, SoftChip, chipToneColor } from './pr-visuals';

type WhyLine = { category: string | null; text: string; counted: boolean };

function capitalize(phrase: string): string {
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

function whyLines(assignment: RelayAssignment): WhyLine[] {
  const phrases = (assignment.reason ?? '')
    .split(' and ')
    .map((phrase) => phrase.trim())
    .filter(Boolean);
  const signals = assignment.signals;
  if (!signals) {
    return phrases.map((phrase) => ({
      category: null,
      text: capitalize(phrase),
      counted: true,
    }));
  }

  const areaLabel = assignment.area ?? 'this part of the code';
  const knowledge = phrases.find(
    (phrase) => phrase.startsWith('knows') || phrase.startsWith('worked'),
  );
  const open = signals.openReviewRequests;
  const recent = signals.reviewsLast14Days;
  return [
    {
      category: 'Familiarity',
      text: knowledge ?? `no recent work on ${areaLabel}`,
      counted: Boolean(knowledge),
    },
    {
      category: 'Availability',
      text:
        open === 0
          ? 'no open review requests right now'
          : `${open} open review request${open === 1 ? '' : 's'} right now`,
      counted: open === 0,
    },
    {
      category: 'Fairness',
      text:
        recent === 0
          ? 'no reviews in the last 14 days'
          : `${recent} review${recent === 1 ? '' : 's'} in the last 14 days`,
      counted: recent === 0,
    },
  ];
}

function WhyContent({ assignment }: { assignment: RelayAssignment }) {
  return (
    <Box sx={{ maxWidth: 320, px: 0.5, py: 0.75 }}>
      <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, fontSize: 12 }}>
        Why {assignment.login}?
      </Typography>
      {assignment.area && (
        <Typography variant="caption" sx={{ display: 'block', opacity: 0.7 }}>
          This pull request touches {assignment.area}.
        </Typography>
      )}
      <Stack spacing={0.75} sx={{ mt: 1 }}>
        {whyLines(assignment).map((line) => (
          <Stack
            key={line.category ?? line.text}
            direction="row"
            alignItems="flex-start"
            spacing={0.75}
          >
            {line.counted ? (
              <CheckCircleRoundedIcon
                sx={(theme) => ({
                  fontSize: 14,
                  flexShrink: 0,
                  mt: 0.25,
                  color: chipToneColor(theme, 'green'),
                })}
              />
            ) : (
              <RadioButtonUncheckedRoundedIcon
                sx={{ fontSize: 14, flexShrink: 0, mt: 0.25, opacity: 0.45 }}
              />
            )}
            <Typography variant="caption" sx={{ lineHeight: 1.4, opacity: line.counted ? 1 : 0.75 }}>
              {line.category && (
                <Box component="span" sx={{ fontWeight: 700 }}>
                  {line.category}:{' '}
                </Box>
              )}
              {line.text}
            </Typography>
          </Stack>
        ))}
      </Stack>
      <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.15)' }} />
      <Typography variant="caption" sx={{ display: 'block', opacity: 0.7, lineHeight: 1.4 }}>
        Relay weighs recent work on this code, current review load, and reviews
        done in the last 14 days. Everyone gets the same three checks.
      </Typography>
    </Box>
  );
}

export function RelayAssignmentPair({
  assignment,
  authorLogin,
}: {
  assignment: RelayAssignment;
  authorLogin: string;
}) {
  return (
    <ReviewPair
      reviewers={[{ login: assignment.login }]}
      authorLogin={authorLogin}
      shadow={assignment.shadow}
    />
  );
}

export function AssignmentControls({
  assignment,
  onChanged,
  onError,
}: {
  assignment: RelayAssignment;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [resetAssignment] = useMutation(RESET_ASSIGNMENT);
  const [resetting, setResetting] = useState(false);

  const onReset = (event: React.MouseEvent) => {
    event.stopPropagation();
    setResetting(true);
    void resetAssignment({
      variables: { repo: assignment.repo, number: assignment.number },
    })
      .then(() => onChanged())
      .catch((error: Error) => onError(error.message))
      .finally(() => setResetting(false));
  };

  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      {assignment.shadow && <SoftChip label="test" tone="gray" />}
      <Tooltip title={<WhyContent assignment={assignment} />}>
        <IconButton
          size="small"
          onClick={(event) => event.stopPropagation()}
          sx={{ color: 'text.secondary', p: 0.25 }}
        >
          <HelpOutlineRoundedIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Reset this assignment — Relay forgets the pick">
        <span>
          <IconButton
            size="small"
            disabled={resetting}
            onClick={onReset}
            sx={{ color: 'text.secondary', p: 0.25 }}
          >
            <RestartAltRoundedIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
}
