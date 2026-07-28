import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Box, Card, Collapse, IconButton, Stack, Typography, alpha } from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import type { ReactNode, ReactElement } from 'react';
import type { PersonalPr } from '@/types/personal';
import {
  PrStateIcon,
  SoftChip,
  type ChipTone,
  type PrVisualState,
} from '@/components/shared/pr-visuals';
import { PrTimeline } from '@/components/shared/PrTimeline';

const WAITING_CHIPS: Record<
  PersonalPr['waitingOn'],
  { label: string; tone: ChipTone; icon: ReactElement }
> = {
  REVIEWER: { label: 'With reviewer', tone: 'teal', icon: <VisibilityOutlinedIcon /> },
  AUTHOR: { label: 'Your turn', tone: 'amber', icon: <EditRoundedIcon /> },
  CI: { label: 'CI running', tone: 'gray', icon: <AutorenewRoundedIcon /> },
  NONE: { label: 'Up to date', tone: 'green', icon: <CheckRoundedIcon /> },
};

export function prVisualState(pr: PersonalPr): PrVisualState {
  if (pr.mergedAt) return 'merged';
  if (pr.isDraft) return 'draft';
  return 'open';
}

export function ago(iso: string | null): string | null {
  if (!iso) return null;
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

export function WaitingChip({ pr, reverseAudience }: { pr: PersonalPr; reverseAudience?: boolean }) {
  if (pr.isDraft) {
    return <SoftChip label="Draft" tone="gray" icon={<EditNoteRoundedIcon />} />;
  }
  let chip = WAITING_CHIPS[pr.waitingOn];
  if (reverseAudience && pr.waitingOn === 'REVIEWER') {
    chip = { label: 'Your review', tone: 'amber', icon: <RateReviewOutlinedIcon /> };
  }
  if (reverseAudience && pr.waitingOn === 'AUTHOR') {
    chip = { label: 'With the author', tone: 'teal', icon: <EditRoundedIcon /> };
  }
  return <SoftChip label={chip.label} tone={chip.tone} icon={chip.icon} />;
}

export function PrRow({
  pr,
  meta,
  trailing,
  expanded,
  onToggle,
}: {
  pr: PersonalPr;
  meta?: ReactNode;
  trailing?: ReactNode;
  expanded: boolean;
  onToggle: () => void;
}) {
  const state = prVisualState(pr);
  return (
    <Box
      sx={{
        '&:not(:last-child)': {
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        },
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.75}
        onClick={onToggle}
        sx={{
          px: 2.5,
          py: 1.75,
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover': {
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.045),
          },
        }}
      >
        <PrStateIcon state={state} sx={{ flexShrink: 0 }} />
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {pr.title}
          </Typography>
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.75}
            sx={{ mt: 0.25, minWidth: 0, color: 'text.secondary' }}
          >
            <Typography variant="caption" noWrap component="div" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
              {meta ?? defaultMeta(pr)}
            </Typography>
          </Stack>
        </Box>
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ flexShrink: 0 }}>
          {trailing}
          <IconButton
            size="small"
            component="a"
            href={pr.url}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
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
      </Stack>
      <Collapse in={expanded} unmountOnExit>
        <Box
          sx={(theme) => ({
            px: 3,
            borderTop: `1px dashed ${theme.palette.divider}`,
            bgcolor: alpha(theme.palette.text.primary, 0.015),
          })}
        >
          <PrTimeline pr={pr} />
        </Box>
      </Collapse>
    </Box>
  );
}

function defaultMeta(pr: PersonalPr): string {
  const repo = pr.repo.includes('/') ? pr.repo.split('/')[1] : pr.repo;
  const opened = pr.openedAt ? ` · opened ${ago(pr.openedAt)}` : '';
  return `${repo} #${pr.number}${opened}`;
}

export function prMetaBase(pr: PersonalPr): string {
  const repo = pr.repo.includes('/') ? pr.repo.split('/')[1] : pr.repo;
  return `${repo} #${pr.number}`;
}

export function PrListCard({
  title,
  icon,
  count,
  caption,
  children,
  collapsible = false,
  defaultExpanded = true,
  expanded,
  onToggle,
}: {
  title: string;
  icon?: ReactNode;
  count?: number;
  caption?: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isControlled = expanded !== undefined;
  const open = !collapsible || (isControlled ? expanded : internalExpanded);
  const toggle = () => {
    if (isControlled) {
      onToggle?.();
    } else {
      setInternalExpanded((value) => !value);
    }
  };
  return (
    <Stack spacing={1.25}>
      <Box
        onClick={collapsible ? toggle : undefined}
        sx={collapsible ? { cursor: 'pointer', userSelect: 'none' } : undefined}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          {icon}
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {count !== undefined && (
            <Typography
              variant="caption"
              sx={(theme) => ({
                fontWeight: 700,
                px: 1,
                py: 0.1,
                borderRadius: 999,
                bgcolor: alpha(theme.palette.text.primary, 0.08),
                color: 'text.secondary',
              })}
            >
              {count}
            </Typography>
          )}
          {collapsible && (
            <ExpandMoreRoundedIcon
              sx={{
                fontSize: 20,
                color: 'text.secondary',
                transform: open ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s',
              }}
            />
          )}
        </Stack>
        {caption && (
          <Typography variant="body2" color="text.secondary">
            {caption}
          </Typography>
        )}
      </Box>
      <Collapse in={open} unmountOnExit={false}>
        <Card>{children}</Card>
      </Collapse>
    </Stack>
  );
}

export function EmptyRow({ text }: { text: string }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ px: 2.5, py: 3.5, textAlign: 'center' }}>
      {text}
    </Typography>
  );
}
