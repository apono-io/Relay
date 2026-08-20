import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  Collapse,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import MergeTypeRoundedIcon from '@mui/icons-material/MergeTypeRounded';
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNew';
import type { SvgIconProps } from '@mui/material';
import type { ComponentType } from 'react';
import type { PersonalPr } from '@/types/personal';
import { chipToneColor, type ChipTone } from '@/components/shared/pr-visuals';
import { RepoChip } from '@/components/shared/RepoChip';
import { SensitivityDots } from '@/components/shared/SensitivityDots';
import { PrTimeline } from '@/components/shared/PrTimeline';
import { ago } from './PrListCard';
import type { MyTurnItem, TurnAction } from './my-turn';

const ACTION_STYLE: Record<
  TurnAction,
  { tone: ChipTone; Icon: ComponentType<SvgIconProps>; cta: string }
> = {
  ready_to_merge: {
    tone: 'green',
    Icon: MergeTypeRoundedIcon,
    cta: 'Merge on GitHub',
  },
  needs_reviewer: {
    tone: 'blue',
    Icon: PersonAddAltRoundedIcon,
    cta: 'Assign reviewer',
  },
  fix_ci: { tone: 'amber', Icon: ErrorOutlineRoundedIcon, cta: 'Open checks' },
  address_feedback: {
    tone: 'amber',
    Icon: EditRoundedIcon,
    cta: 'Open on GitHub',
  },
};

export function MyTurnChecklist({
  items,
  totalOpen,
  assigningId,
  onAssign,
}: {
  items: MyTurnItem[];
  totalOpen: number;
  assigningId: string | null;
  onAssign: (pr: PersonalPr) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const done = totalOpen - items.length;

  return (
    <Stack spacing={1.5}>
      <ChecklistHeader remaining={items.length} done={done} total={totalOpen} />
      {items.length === 0 ? (
        <AllClear total={totalOpen} />
      ) : (
        <Card sx={{ overflow: 'hidden' }}>
          {items.map((item, index) => (
            <TurnRow
              key={item.pr.id}
              item={item}
              position={index + 1}
              last={index === items.length - 1}
              expanded={expandedId === item.pr.id}
              onToggle={() =>
                setExpandedId((current) =>
                  current === item.pr.id ? null : item.pr.id,
                )
              }
              assigning={assigningId === item.pr.id}
              onAssign={onAssign}
            />
          ))}
        </Card>
      )}
    </Stack>
  );
}

function ChecklistHeader({
  remaining,
  done,
  total,
}: {
  remaining: number;
  done: number;
  total: number;
}) {
  const pct = total === 0 ? 100 : Math.round((done / total) * 100);
  return (
    <Stack spacing={1}>
      <Stack direction="row" alignItems="baseline" spacing={1}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {remaining === 0
            ? 'Nothing needs you'
            : `${remaining} ${remaining === 1 ? 'thing needs' : 'things need'} you`}
        </Typography>
        {total > 0 ? (
          <Typography variant="body2" color="text.secondary">
            out of {total} open
          </Typography>
        ) : null}
      </Stack>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={(theme) => ({
          height: 6,
          borderRadius: 999,
          bgcolor: alpha(theme.palette.text.primary, 0.07),
          '& .MuiLinearProgress-bar': {
            borderRadius: 999,
            backgroundColor: chipToneColor(theme, 'green'),
          },
        })}
      />
    </Stack>
  );
}

function AllClear({ total }: { total: number }) {
  return (
    <Card
      sx={(theme) => ({
        p: 4,
        textAlign: 'center',
        borderColor: alpha(chipToneColor(theme, 'green'), 0.4),
        bgcolor: alpha(chipToneColor(theme, 'green'), 0.05),
      })}
    >
      <CheckCircleRoundedIcon
        sx={(theme) => ({ fontSize: 34, color: chipToneColor(theme, 'green') })}
      />
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 1 }}>
        You are clear
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {total === 0
          ? 'No open pull requests of yours.'
          : 'Every open pull request of yours is with someone else.'}
      </Typography>
    </Card>
  );
}

function TurnRow({
  item,
  position,
  last,
  expanded,
  onToggle,
  assigning,
  onAssign,
}: {
  item: MyTurnItem;
  position: number;
  last: boolean;
  expanded: boolean;
  onToggle: () => void;
  assigning: boolean;
  onAssign: (pr: PersonalPr) => void;
}) {
  const { pr, action, headline, detail } = item;
  const { tone, Icon, cta } = ACTION_STYLE[action];

  return (
    <Box
      sx={{
        borderBottom: last ? 0 : '1px solid',
        borderColor: 'divider',
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
          transition: 'background-color 0.15s',
          '&:hover': {
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.045),
          },
        }}
      >
        <Box
          sx={(theme) => ({
            width: 30,
            height: 30,
            borderRadius: '50%',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: chipToneColor(theme, tone),
            bgcolor: alpha(chipToneColor(theme, tone), 0.13),
            '& svg': { fontSize: 17 },
          })}
        >
          <Icon />
        </Box>

        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <Typography
              variant="body2"
              sx={(theme) => ({
                fontWeight: 700,
                color: chipToneColor(theme, tone),
                flexShrink: 0,
              })}
            >
              {headline}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              · {detail}
            </Typography>
          </Stack>
          <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }} noWrap>
            {pr.title}
          </Typography>
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.75}
            sx={{ mt: 0.5 }}
          >
            <RepoChip repo={pr.repo} />
            <Typography variant="caption" color="text.secondary" noWrap>
              #{pr.number}
              {pr.openedAt ? ` · opened ${ago(pr.openedAt)}` : ''}
            </Typography>
          </Stack>
        </Box>

        <Box sx={{ width: 52, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
          <SensitivityDots sensitivity={pr.sensitivity} area={pr.area} />
        </Box>

        <Box sx={{ width: 168, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
          {action === 'needs_reviewer' ? (
            <Button
              size="small"
              variant="contained"
              disableElevation
              startIcon={<PersonAddAltRoundedIcon sx={{ fontSize: 15 }} />}
              disabled={assigning}
              onClick={(event) => {
                event.stopPropagation();
                onAssign(pr);
              }}
              sx={{ whiteSpace: 'nowrap', py: 0.4, fontSize: 12.5 }}
            >
              {assigning ? 'Picking…' : cta}
            </Button>
          ) : (
            <Button
              size="small"
              variant="outlined"
              component="a"
              href={pr.url}
              target="_blank"
              rel="noreferrer"
              endIcon={<OpenInNewRoundedIcon sx={{ fontSize: 14 }} />}
              onClick={(event) => event.stopPropagation()}
              sx={{ whiteSpace: 'nowrap', py: 0.4, fontSize: 12.5 }}
            >
              {cta}
            </Button>
          )}
        </Box>

        <Tooltip title={`Step ${position}`} arrow placement="left">
          <ExpandMoreRoundedIcon
            sx={{
              fontSize: 18,
              color: 'text.disabled',
              flexShrink: 0,
              transform: expanded ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
            }}
          />
        </Tooltip>
      </Stack>

      <Collapse in={expanded} unmountOnExit>
        <Box
          sx={{
            px: 3,
            borderTop: '1px dashed',
            borderColor: 'divider',
            bgcolor: (theme) => alpha(theme.palette.text.primary, 0.015),
          }}
        >
          <PrTimeline pr={pr} />
        </Box>
      </Collapse>
    </Box>
  );
}
