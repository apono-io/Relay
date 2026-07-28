import { Avatar, AvatarGroup, Chip, SvgIcon, Tooltip, alpha } from '@mui/material';
import type { SvgIconProps, Theme } from '@mui/material';

const OCTICON_PULL_REQUEST =
  'M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z';

const OCTICON_MERGE =
  'M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z';

export type PrVisualState = 'open' | 'draft' | 'merged';

export type ChipTone = 'green' | 'amber' | 'red' | 'blue' | 'teal' | 'purple' | 'gray';

const TONE_COLORS: Record<Exclude<ChipTone, 'gray'>, { dark: string; light: string }> = {
  green: { dark: '#3fb950', light: '#1a7f37' },
  amber: { dark: '#d29922', light: '#9a6700' },
  red: { dark: '#f85149', light: '#cf222e' },
  blue: { dark: '#58a6ff', light: '#0969da' },
  teal: { dark: '#39c5cf', light: '#1b7c83' },
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

export function SoftChip({
  label,
  tone = 'gray',
  icon,
}: {
  label: string;
  tone?: ChipTone;
  icon?: React.ReactElement;
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
        };
      }}
    />
  );
}
