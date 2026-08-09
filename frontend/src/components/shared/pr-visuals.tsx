import {
  Avatar,
  AvatarGroup,
  Box,
  Chip,
  Stack,
  SvgIcon,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ArrowRightAltRoundedIcon from '@mui/icons-material/ArrowRightAltRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import type { SvgIconProps, Theme } from '@mui/material';
import type { ReactNode } from 'react';

const OCTICON_PULL_REQUEST =
  'M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z';

const OCTICON_MERGE =
  'M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z';

export type PrVisualState = 'open' | 'draft' | 'merged';

export type ChipTone = 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'gray';

const TONE_COLORS: Record<Exclude<ChipTone, 'gray'>, { dark: string; light: string }> = {
  green: { dark: '#3fb950', light: '#1a7f37' },
  amber: { dark: '#d29922', light: '#9a6700' },
  red: { dark: '#f85149', light: '#cf222e' },
  blue: { dark: '#58a6ff', light: '#0969da' },
  purple: { dark: '#a371f7', light: '#8250df' },
};

export function chipToneColor(theme: Theme, tone: ChipTone): string {
  if (tone === 'gray') return theme.palette.text.secondary;
  return TONE_COLORS[tone][theme.palette.mode === 'dark' ? 'dark' : 'light'];
}

export function prStateColor(theme: Theme, state: PrVisualState): string {
  if (state === 'merged') return chipToneColor(theme, 'purple');
  if (state === 'draft') return theme.palette.text.secondary;
  return chipToneColor(theme, 'green');
}

export function PrStateIcon({
  state,
  ...props
}: { state: PrVisualState } & SvgIconProps) {
  return (
    <SvgIcon
      viewBox="0 0 16 16"
      {...props}
      sx={[
        (theme) => ({ color: prStateColor(theme, state), fontSize: 16 }),
        ...(Array.isArray(props.sx) ? props.sx : [props.sx]),
      ]}
    >
      <path d={state === 'merged' ? OCTICON_MERGE : OCTICON_PULL_REQUEST} />
    </SvgIcon>
  );
}

export function DevAvatar({ login, size = 20 }: { login: string; size?: number }) {
  return (
    <Tooltip title={login}>
      <Avatar
        src={`https://github.com/${login}.png?size=64`}
        alt={login}
        sx={{ width: size, height: size, fontSize: size * 0.45, fontWeight: 700 }}
      >
        {login.slice(0, 1).toUpperCase()}
      </Avatar>
    </Tooltip>
  );
}

export function ReviewerAvatars({ logins, size = 22 }: { logins: string[]; size?: number }) {
  if (logins.length === 0) return null;
  return (
    <AvatarGroup
      max={3}
      sx={{
        '& .MuiAvatar-root': {
          width: size,
          height: size,
          fontSize: size * 0.42,
          borderWidth: 1.5,
        },
      }}
    >
      {logins.map((login) => (
        <Avatar key={login} src={`https://github.com/${login}.png?size=64`} alt={login}>
          {login.slice(0, 1).toUpperCase()}
        </Avatar>
      ))}
    </AvatarGroup>
  );
}

function PairPerson({
  login,
  name,
  extra,
}: {
  login: string;
  name?: string;
  extra?: { count: number; title: string };
}) {
  return (
    <Stack alignItems="center" spacing={0.4} sx={{ width: 76, minWidth: 0, flexShrink: 0 }}>
      <Box sx={{ position: 'relative' }}>
        <DevAvatar login={login} size={26} />
        {extra && extra.count > 0 && (
          <Tooltip title={extra.title}>
            <Avatar
              sx={(theme) => {
                const color = chipToneColor(theme, 'blue');
                return {
                  position: 'absolute',
                  top: -7,
                  right: -14,
                  width: 19,
                  height: 19,
                  fontSize: 9,
                  fontWeight: 800,
                  bgcolor: color,
                  color: theme.palette.getContrastText(color),
                  border: `2px solid ${theme.palette.background.paper}`,
                };
              }}
            >
              +{extra.count}
            </Avatar>
          </Tooltip>
        )}
      </Box>
      <Typography
        variant="caption"
        noWrap
        sx={{ fontWeight: 600, fontSize: 10.5, lineHeight: 1.2, maxWidth: '100%' }}
      >
        {name ?? login}
      </Typography>
    </Stack>
  );
}

export type ReviewPairPerson = { login: string; name?: string };

export function ReviewPair({
  reviewers,
  authorLogin,
  shadow = false,
  children,
}: {
  reviewers: ReviewPairPerson[];
  authorLogin: string;
  shadow?: boolean;
  children?: ReactNode;
}) {
  const [first, ...rest] = reviewers;
  if (!first) return null;
  const reviewerNames = reviewers.map((r) => r.name ?? r.login).join(', ');
  return (
    <Stack direction="row" alignItems="center" spacing={0.9} sx={{ flexShrink: 0 }}>
      <PairPerson
        login={first.login}
        name={first.name}
        extra={
          rest.length > 0
            ? {
                count: rest.length,
                title: rest.map((r) => r.name ?? r.login).join(', '),
              }
            : undefined
        }
      />
      <Tooltip title={`${reviewerNames} reviews ${authorLogin}`}>
        <Stack
          alignItems="center"
          spacing={0.5}
          sx={(theme) => ({
            flexShrink: 0,
            color: chipToneColor(theme, shadow ? 'gray' : 'blue'),
          })}
        >
          <SearchRoundedIcon sx={{ fontSize: 17 }} />
          <ArrowRightAltRoundedIcon sx={{ fontSize: 15 }} />
        </Stack>
      </Tooltip>
      <PairPerson login={authorLogin} />
      {children}
    </Stack>
  );
}

export function ApprovedChip() {
  return <SoftChip label="Approved" tone="green" icon={<CheckCircleRoundedIcon />} />;
}

export function SoftChip({
  label,
  tone = 'gray',
  icon,
  pulse = false,
}: {
  label: string;
  tone?: ChipTone;
  icon?: React.ReactElement;
  pulse?: boolean;
}) {
  return (
    <Chip
      size="small"
      label={label}
      icon={icon}
      sx={(theme) => {
        const color = chipToneColor(theme, tone);
        return {
          height: 24,
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 600,
          color,
          bgcolor: alpha(color, theme.palette.mode === 'dark' ? 0.13 : 0.09),
          '& .MuiChip-label': { px: 1, pl: icon ? 0.75 : 1 },
          '& .MuiChip-icon': { color, fontSize: 14, ml: 1, mr: -0.25 },
          ...(pulse && {
            '@keyframes relayChipPulse': {
              '0%': { boxShadow: `0 0 0 0 ${alpha(color, 0.4)}` },
              '70%': { boxShadow: `0 0 0 6px ${alpha(color, 0)}` },
              '100%': { boxShadow: `0 0 0 0 ${alpha(color, 0)}` },
            },
            animation: 'relayChipPulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }),
        };
      }}
    />
  );
}
