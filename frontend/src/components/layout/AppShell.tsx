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
} from '@mui/material';
import type { ReactNode } from 'react';
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeIcon from '@mui/icons-material/LightModeOutlined';
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { useColorMode } from '@/context/ColorModeContext';
import { useAuth } from '@/context/AuthContext';
import { PERSON_WRITE } from '@/lib/permissions';
import { PrStateIcon } from '@/components/shared/pr-visuals';

const DRAWER_WIDTH = 236;

export type View = 'dashboard' | 'analytics' | 'my-prs' | 'my-reviews' | 'people';

export const VIEW_TITLES: Record<View, string> = {
  dashboard: 'Dashboard',
  analytics: 'Analytics',
  'my-prs': 'My PRs',
  'my-reviews': 'My Reviews',
  people: 'People',
};

type NavItem = { key: View; label: string; icon: ReactNode; path: string; permission?: string };

const NAV_GROUPS: { label?: string; items: NavItem[] }[] = [
  {
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: <SpaceDashboardOutlinedIcon fontSize="small" />, path: '/' },
      { key: 'analytics', label: 'Analytics', icon: <InsightsOutlinedIcon fontSize="small" />, path: '/analytics' },
    ],
  },
  {
    label: 'For you',
    items: [
      { key: 'my-prs', label: 'My PRs', icon: <AccountTreeOutlinedIcon fontSize="small" />, path: '/my-prs' },
      { key: 'my-reviews', label: 'My Reviews', icon: <RateReviewOutlinedIcon fontSize="small" />, path: '/my-reviews' },
    ],
  },
  {
    label: 'Admin',
    items: [
      {
        key: 'people',
        label: 'People',
        icon: <GroupsOutlinedIcon fontSize="small" />,
        path: '/people',
        permission: PERSON_WRITE,
      },
    ],
  },
];

function ModeToggle() {
  const { mode, toggle } = useColorMode();
  return (
    <Tooltip title={mode === 'dark' ? 'Switch to light' : 'Switch to dark'}>
      <IconButton onClick={toggle} color="inherit" size="small">
        {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}

function LogoutButton() {
  const { setToken } = useAuth();
  const client = useApolloClient();

  const logout = () => {
    setToken(null);
    void client.clearStore();
  };

  return (
    <Tooltip title="Log out">
      <IconButton onClick={logout} color="inherit" size="small">
        <LogoutOutlinedIcon fontSize="small" />
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

function AccountFooter() {
  const { token, user } = useAuth();
  const email = user?.email ?? accountEmail(token) ?? 'dev@apono.io';
  const initials = email.slice(0, 2).toUpperCase();
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.25}
      sx={{ px: 2, py: 1.5, borderTop: (theme) => `1px solid ${theme.palette.divider}` }}
    >
      <Avatar
        sx={{
          width: 30,
          height: 30,
          fontSize: 12,
          fontWeight: 700,
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.16),
          color: 'primary.main',
        }}
      >
        {initials}
      </Avatar>
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }} noWrap>
          {email.split('@')[0]}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', lineHeight: 1.3 }}>
          {user ? `${email} · ${user.role}` : email}
        </Typography>
      </Box>
      <ModeToggle />
      <LogoutButton />
    </Stack>
  );
}

function SideMenu({ view }: { view: View }) {
  const navigate = useNavigate();
  const { can } = useAuth();

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || can(item.permission)),
  })).filter((group) => group.items.length > 0);

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
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 2.5, pt: 2.75, pb: 2.25 }}>
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
              boxShadow: '0 2px 8px rgba(59,130,246,0.35)',
            }}
          >
            <PrStateIcon state="open" sx={{ color: '#fff', fontSize: 15 }} />
          </Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: 17 }}>
            Relay
          </Typography>
        </Stack>

        <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
          {groups.map((group, groupIndex) => (
            <Box key={group.label ?? `group-${groupIndex}`} sx={{ mb: 1 }}>
              {group.label && (
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    px: 3,
                    pt: 1.5,
                    pb: 0.5,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                  }}
                >
                  {group.label}
                </Typography>
              )}
              <List sx={{ px: 1.5, py: 0 }} disablePadding>
                {group.items.map((item) => {
                  const selected = view === item.key;
                  return (
                    <ListItemButton
                      key={item.key}
                      selected={selected}
                      onClick={() => navigate(item.path)}
                      sx={{
                        borderRadius: 2,
                        minHeight: 36,
                        mb: 0.25,
                        px: 1.5,
                        color: selected ? 'primary.main' : 'text.secondary',
                        '&.Mui-selected': {
                          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                          '&:hover': {
                            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.16),
                          },
                        },
                        '&:hover': {
                          bgcolor: (theme) => alpha(theme.palette.text.primary, 0.045),
                        },
                        '& .MuiListItemText-primary': {
                          color: selected ? 'primary.main' : 'text.secondary',
                          fontWeight: 600,
                        },
                        '&:hover .MuiListItemText-primary': {
                          color: selected ? 'primary.main' : 'text.primary',
                        },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 30, color: 'inherit' }}>{item.icon}</ListItemIcon>
                      <ListItemText primary={item.label} />
                    </ListItemButton>
                  );
                })}
              </List>
            </Box>
          ))}
        </Box>

        <AccountFooter />
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
