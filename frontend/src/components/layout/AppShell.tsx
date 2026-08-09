import { useApolloClient } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
  IconButton,
  Tooltip,
  Avatar,
  alpha,
  useTheme,
} from '@mui/material';
import type { ReactNode } from 'react';
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeIcon from '@mui/icons-material/LightModeOutlined';
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { useColorMode } from '@/context/ColorModeContext';
import { useAuth } from '@/context/AuthContext';
import { PERSON_WRITE } from '@/lib/permissions';
import { PrStateIcon } from '@/components/shared/pr-visuals';
import { sidebarTokens, type SidebarTokens } from '@/theme';

const DRAWER_WIDTH = 224;

export type View =
  | 'dashboard'
  | 'analytics'
  | 'my-prs'
  | 'my-reviews'
  | 'settings'
  | 'system';

export const VIEW_TITLES: Record<View, string> = {
  dashboard: 'Dashboard',
  analytics: 'Analytics',
  'my-prs': 'My PRs',
  'my-reviews': 'My Reviews',
  settings: 'Settings',
  system: 'System settings',
};

type NavItem = { key: View; label: string; icon: ReactNode; path: string; permission?: string };

const NAV_GROUPS: { label?: string; items: NavItem[] }[] = [
  {
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: <SpaceDashboardOutlinedIcon />, path: '/' },
      { key: 'analytics', label: 'Analytics', icon: <InsightsOutlinedIcon />, path: '/analytics' },
    ],
  },
  {
    label: 'For you',
    items: [
      { key: 'my-prs', label: 'My PRs', icon: <AccountTreeOutlinedIcon />, path: '/my-prs' },
      { key: 'my-reviews', label: 'My Reviews', icon: <RateReviewOutlinedIcon />, path: '/my-reviews' },
    ],
  },
];

const SETTINGS_ITEMS: NavItem[] = [
  { key: 'settings', label: 'Settings', icon: <SettingsOutlinedIcon />, path: '/settings' },
  {
    key: 'system',
    label: 'System settings',
    icon: <AdminPanelSettingsOutlinedIcon />,
    path: '/settings/system',
    permission: PERSON_WRITE,
  },
];

function ModeToggle({ tokens }: { tokens: SidebarTokens }) {
  const { mode, toggle } = useColorMode();
  return (
    <Tooltip title={mode === 'dark' ? 'Switch to light' : 'Switch to dark'}>
      <IconButton onClick={toggle} size="small" sx={{ color: tokens.text, '&:hover': { color: tokens.textHover } }}>
        {mode === 'dark' ? <LightModeIcon sx={{ fontSize: 17 }} /> : <DarkModeIcon sx={{ fontSize: 17 }} />}
      </IconButton>
    </Tooltip>
  );
}

function LogoutButton({ tokens }: { tokens: SidebarTokens }) {
  const { setToken } = useAuth();
  const client = useApolloClient();

  const logout = () => {
    setToken(null);
    void client.clearStore();
  };

  return (
    <Tooltip title="Log out">
      <IconButton onClick={logout} size="small" sx={{ color: tokens.text, '&:hover': { color: tokens.textHover } }}>
        <LogoutOutlinedIcon sx={{ fontSize: 17 }} />
      </IconButton>
    </Tooltip>
  );
}

function accountEmail(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.email === 'string' ? json.email : null;
  } catch {
    return null;
  }
}

function AccountFooter({ tokens }: { tokens: SidebarTokens }) {
  const { token, user } = useAuth();
  const email = user?.email ?? accountEmail(token) ?? 'dev@apono.io';
  const initials = email.slice(0, 2).toUpperCase();
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.25}
      sx={{ px: 2, py: 1.5, borderTop: `1px solid ${tokens.divider}` }}
    >
      <Avatar
        sx={{
          width: 28,
          height: 28,
          fontSize: 11,
          fontWeight: 700,
          bgcolor: alpha('#7aa7ff', 0.2),
          color: tokens.selectedText,
        }}
      >
        {initials}
      </Avatar>
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3, fontSize: 13, color: tokens.textHover }} noWrap>
          {email.split('@')[0]}
        </Typography>
        <Typography variant="caption" noWrap sx={{ display: 'block', lineHeight: 1.3, fontSize: 11, color: tokens.text }}>
          {user ? `${email} · ${user.role}` : email}
        </Typography>
      </Box>
      <ModeToggle tokens={tokens} />
      <LogoutButton tokens={tokens} />
    </Stack>
  );
}

function NavList({
  items,
  view,
  tokens,
}: {
  items: NavItem[];
  view: View;
  tokens: SidebarTokens;
}) {
  const navigate = useNavigate();
  return (
    <List sx={{ px: 1.25, py: 0 }} disablePadding>
      {items.map((item) => {
        const selected = view === item.key;
        return (
          <ListItemButton
            key={item.key}
            selected={selected}
            onClick={() => navigate(item.path)}
            disableRipple
            sx={{
              borderRadius: 1.5,
              minHeight: 32,
              mb: 0.25,
              px: 1.25,
              color: selected ? tokens.selectedText : tokens.text,
              '&.Mui-selected': {
                bgcolor: tokens.selectedBg,
                '&:hover': { bgcolor: tokens.selectedHoverBg },
              },
              '&:hover': { bgcolor: tokens.hoverBg, color: tokens.textHover },
              '& .MuiListItemText-primary': {
                fontSize: 13,
                fontWeight: selected ? 600 : 500,
                color: 'inherit',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 28, color: 'inherit', '& svg': { fontSize: 17 } }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        );
      })}
    </List>
  );
}

function SideMenu({ view }: { view: View }) {
  const { can } = useAuth();
  const theme = useTheme();
  const tokens = sidebarTokens(theme.palette.mode);

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || can(item.permission)),
  })).filter((group) => group.items.length > 0);

  const settingsItems = SETTINGS_ITEMS.filter(
    (item) => !item.permission || can(item.permission),
  );

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
      }}
    >
      <Stack sx={{ height: '100%' }}>
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 2.25, pt: 2.5, pb: 2 }}>
          <Box
            sx={{
              width: 26,
              height: 26,
              borderRadius: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#0969da',
              boxShadow: '0 2px 8px rgba(9,105,218,0.35)',
            }}
          >
            <PrStateIcon state="open" sx={{ color: '#fff', fontSize: 14 }} />
          </Box>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: 16, color: tokens.title }}
          >
            Relay
          </Typography>
        </Stack>

        <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
          {groups.map((group, groupIndex) => (
            <Box key={group.label ?? `group-${groupIndex}`} sx={{ mb: 0.75 }}>
              {group.label && (
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    px: 2.5,
                    pt: 1.75,
                    pb: 0.5,
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: tokens.groupLabel,
                  }}
                >
                  {group.label}
                </Typography>
              )}
              <NavList items={group.items} view={view} tokens={tokens} />
            </Box>
          ))}
        </Box>

        <Box sx={{ pb: 0.75, pt: 0.75, borderTop: `1px solid ${tokens.divider}` }}>
          <NavList items={settingsItems} view={view} tokens={tokens} />
        </Box>

        <AccountFooter tokens={tokens} />
      </Stack>
    </Drawer>
  );
}

export function AppShell({ view, children }: { view: View; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <SideMenu view={view} />
      <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
        <Box
          sx={{
            maxWidth: 1160,
            mx: 'auto',
            py: { xs: 4, md: 4.5 },
            px: { xs: 2.5, md: 5 },
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
