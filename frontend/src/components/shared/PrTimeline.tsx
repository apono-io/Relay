import { Box, Stack, Typography, alpha } from '@mui/material';
import { format } from 'date-fns';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import type { SvgIconProps } from '@mui/material';
import type { ComponentType } from 'react';
import { PrStateIcon, chipToneColor } from './pr-visuals';

export type TimelinePr = {
  openedAt: string | null;
  readyAt: string | null;
  firstReviewAt: string | null;
  approvedAt: string | null;
  mergedAt: string | null;
  isDraft?: boolean;
};

type Stage = {
  label: string;
  waitingText: string;
  at: Date | null;
  Icon: ComponentType<SvgIconProps>;
  merged?: boolean;
};

type StageStatus = 'done' | 'current' | 'future' | 'skipped';

const NODE_SIZE = 22;
const MARKER_HEIGHT = 18;

function toDate(iso: string | null): Date | null {
  return iso ? new Date(iso) : null;
}

function OpenedIcon(props: SvgIconProps) {
  return <PrStateIcon state="open" {...props} sx={{ color: 'inherit' }} />;
}

function MergedIcon(props: SvgIconProps) {
  return <PrStateIcon state="merged" {...props} sx={{ color: 'inherit' }} />;
}

function buildStages(pr: TimelinePr): Stage[] {
  const opened = toDate(pr.openedAt);
  const ready = toDate(pr.readyAt) ?? (pr.isDraft ? null : opened);
  return [
    { label: 'Opened', waitingText: '', at: opened, Icon: OpenedIcon },
    {
      label: 'Ready for review',
      waitingText: 'still in draft',
      at: ready,
      Icon: VisibilityOutlinedIcon,
    },
    {
      label: 'First review',
      waitingText: 'waiting for a reviewer',
      at: toDate(pr.firstReviewAt),
      Icon: RateReviewOutlinedIcon,
    },
    {
      label: 'Approved',
      waitingText: 'review in progress',
      at: toDate(pr.approvedAt),
      Icon: CheckRoundedIcon,
    },
    {
      label: 'Merged',
      waitingText: 'ready to merge',
      at: toDate(pr.mergedAt),
      Icon: MergedIcon,
      merged: true,
    },
  ];
}

function StageNode({ stage, status }: { stage: Stage; status: StageStatus }) {
  const { Icon } = stage;
  return (
    <Stack alignItems="center" spacing={0.75} sx={{ minWidth: 96, flexShrink: 0 }}>
      <Typography
        variant="caption"
        sx={(theme) => ({
          height: MARKER_HEIGHT,
          lineHeight: `${MARKER_HEIGHT}px`,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: chipToneColor(theme, 'blue'),
          visibility: status === 'current' ? 'visible' : 'hidden',
        })}
      >
        ▾ current stage
      </Typography>
      <Box
        sx={(theme) => {
          const doneColor = chipToneColor(theme, stage.merged ? 'purple' : 'green');
          const currentColor = chipToneColor(theme, 'blue');
          const palette = {
            done: {
              color: doneColor,
              border: `1.5px solid ${alpha(doneColor, 0.9)}`,
              bgcolor: alpha(doneColor, 0.12),
              boxShadow: 'none',
            },
            current: {
              color: currentColor,
              border: `1.5px solid ${alpha(currentColor, 0.9)}`,
              bgcolor: alpha(currentColor, 0.12),
              boxShadow: `0 0 0 3px ${alpha(currentColor, 0.15)}`,
            },
            future: {
              color: theme.palette.text.disabled,
              border: `1.5px dashed ${theme.palette.divider}`,
              bgcolor: 'transparent',
              boxShadow: 'none',
            },
            skipped: {
              color: theme.palette.text.disabled,
              border: `1.5px dashed ${theme.palette.divider}`,
              bgcolor: 'transparent',
              boxShadow: 'none',
            },
          }[status];
          return {
            width: NODE_SIZE,
            height: NODE_SIZE,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            ...palette,
            '& svg': { fontSize: 12 },
          };
        }}
      >
        <Icon />
      </Box>
      <Box sx={{ textAlign: 'center' }}>
        <Typography
          variant="caption"
          sx={(theme) => ({
            display: 'block',
            fontWeight: 600,
            lineHeight: 1.3,
            fontSize: 11,
            color:
              status === 'current'
                ? chipToneColor(theme, 'blue')
                : status === 'done'
                  ? 'text.primary'
                  : 'text.disabled',
          })}
        >
          {status === 'current' ? stage.waitingText : stage.label}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            lineHeight: 1.3,
            fontSize: 11,
            color: 'text.secondary',
          }}
        >
          {status === 'done' && stage.at ? format(stage.at, 'MMM d, HH:mm') : null}
          {status === 'skipped' ? 'skipped' : null}
        </Typography>
      </Box>
    </Stack>
  );
}

function Connector({ done }: { done: boolean }) {
  return (
    <Box
      sx={(theme) => ({
        flexGrow: 1,
        minWidth: 28,
        mt: `${MARKER_HEIGHT + 6 + NODE_SIZE / 2}px`,
        borderTop: done
          ? `2px solid ${alpha(chipToneColor(theme, 'green'), 0.55)}`
          : `2px dashed ${theme.palette.divider}`,
      })}
    />
  );
}

export function PrTimeline({ pr }: { pr: TimelinePr }) {
  const stages = buildStages(pr);
  const isMerged = pr.mergedAt != null;
  const firstPending = stages.findIndex((stage) => stage.at == null);
  const currentIndex = isMerged
    ? stages.length
    : firstPending === -1
      ? stages.length
      : firstPending;

  const statusOf = (stage: Stage, index: number): StageStatus => {
    if (stage.at != null) return 'done';
    if (isMerged) return 'skipped';
    return index === currentIndex ? 'current' : 'future';
  };

  return (
    <Stack
      direction="row"
      alignItems="flex-start"
      sx={{ px: 1, py: 1.5, overflowX: 'auto' }}
    >
      {stages.map((stage, index) => {
        const next = stages[index + 1];
        return (
          <Box key={stage.label} sx={{ display: 'contents' }}>
            <StageNode stage={stage} status={statusOf(stage, index)} />
            {next && <Connector done={stage.at != null && next.at != null} />}
          </Box>
        );
      })}
    </Stack>
  );
}
