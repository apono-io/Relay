import { useMutation, useQuery } from '@apollo/client';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  alpha,
} from '@mui/material';
import { useState } from 'react';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import GitHubIcon from '@mui/icons-material/GitHub';
import { AppShell, VIEW_TITLES } from '@/components/layout/AppShell';
import { StatusStrip } from '@/components/dashboard/StatusStrip';
import { SettingsTabs, resolveSettingsTab } from '@/components/shared/SettingsTabs';
import { useAuth } from '@/context/AuthContext';
import { useColorMode } from '@/context/ColorModeContext';
import { START_GITHUB_LINK } from '@/graphql/auth';
import { MY_SETTINGS_QUERY, SET_MY_ASSIGNMENT_MODE } from '@/graphql/assignment';
import type { AssignmentMode } from '@/types/assignment';
import { IDENTITY_LINK, SETTINGS_WRITE_OWN } from '@/lib/permissions';

const MODE_OPTIONS: { value: AssignmentMode; label: string; caption: string }[] = [
  {
    value: 'off',
    label: 'Off',
    caption: 'Relay suggests reviewers in the app but never assigns for you.',
  },
  {
    value: 'hybrid',
    label: 'Hybrid',
    caption: 'You stay in control — Relay assigns only when you press Assign reviewer.',
  },
  {
    value: 'auto',
    label: 'Auto',
    caption:
      'Hands-free — if your PR still has no reviewer after a short grace window, Relay assigns its pick.',
  },
];

function SettingsSection({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <Card sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {caption}
          </Typography>
        </Box>
        {children}
      </Stack>
    </Card>
  );
}

function LinkOutcome() {
  const [params] = useSearchParams();
  const link = params.get('link');
  if (!link) {
    return null;
  }
  if (link === 'failed') {
    return <Alert severity="error">{params.get('reason') ?? 'Linking the GitHub account did not work.'}</Alert>;
  }
  return <Alert severity="success">Linked the GitHub account {link}.</Alert>;
}

function ProfileSection() {
  const { user } = useAuth();
  if (!user) {
    return null;
  }
  const initials = user.email.slice(0, 2).toUpperCase();
  return (
    <SettingsSection title="Profile" caption="Your account as Relay sees it.">
      <Stack direction="row" alignItems="center" spacing={2}>
        <Avatar
          src={user.picture ?? undefined}
          sx={{
            width: 44,
            height: 44,
            fontSize: 16,
            fontWeight: 700,
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.16),
            color: 'primary.main',
          }}
        >
          {initials}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {user.name ?? user.email.split('@')[0]}
            </Typography>
            <Chip size="small" label={user.role} variant="outlined" />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {user.email}
          </Typography>
        </Box>
      </Stack>
    </SettingsSection>
  );
}

function AppearanceSection() {
  const { mode, toggle } = useColorMode();
  return (
    <SettingsSection title="Appearance" caption="Pick the theme Relay uses on this device.">
      <ToggleButtonGroup
        exclusive
        size="small"
        value={mode}
        onChange={(_event, next) => {
          if (next && next !== mode) {
            toggle();
          }
        }}
      >
        <ToggleButton value="light" sx={{ px: 2, gap: 0.75 }}>
          <LightModeOutlinedIcon sx={{ fontSize: 16 }} />
          Light
        </ToggleButton>
        <ToggleButton value="dark" sx={{ px: 2, gap: 0.75 }}>
          <DarkModeOutlinedIcon sx={{ fontSize: 16 }} />
          Dark
        </ToggleButton>
      </ToggleButtonGroup>
    </SettingsSection>
  );
}

function AssignmentSection() {
  const { data, loading, refetch } = useQuery<{ mySettings: { assignmentMode: AssignmentMode } }>(
    MY_SETTINGS_QUERY,
  );
  const [setMode, mutationState] = useMutation(SET_MY_ASSIGNMENT_MODE);
  const [error, setError] = useState<string | null>(null);
  const mode = data?.mySettings.assignmentMode ?? 'off';

  const choose = async (next: AssignmentMode) => {
    if (next === mode) {
      return;
    }
    setError(null);
    try {
      await setMode({ variables: { mode: next } });
      await refetch();
    } catch (mutationError) {
      setError((mutationError as Error).message);
    }
  };

  return (
    <SettingsSection
      title="Reviewer assignment"
      caption="How much Relay does for your own pull requests when nobody is assigned."
    >
      <Stack spacing={1.5} alignItems="flex-start">
        {error && <Alert severity="error">{error}</Alert>}
        {loading && !data ? null : (
          <ToggleButtonGroup
            exclusive
            size="small"
            value={mode}
            onChange={(_event, next: AssignmentMode | null) => {
              if (next) {
                void choose(next);
              }
            }}
            disabled={mutationState.loading}
          >
            {MODE_OPTIONS.map((option) => (
              <ToggleButton key={option.value} value={option.value} sx={{ px: 2 }}>
                {option.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        )}
        <Typography variant="body2" color="text.secondary">
          {MODE_OPTIONS.find((option) => option.value === mode)?.caption}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Suggestions are always generated either way, and Relay only ever touches a pull
          request that has no requested reviewer.
        </Typography>
      </Stack>
    </SettingsSection>
  );
}

function GithubSection() {
  const [startGithubLink, linkState] = useMutation<{ startGithubLink: string }>(START_GITHUB_LINK);
  const [error, setError] = useState<string | null>(null);

  const linkOwnAccount = async () => {
    try {
      const result = await startGithubLink();
      const url = result.data?.startGithubLink;
      if (url) {
        window.location.href = url;
      }
    } catch (linkError) {
      setError((linkError as Error).message);
    }
  };

  return (
    <SettingsSection
      title="GitHub account"
      caption="Link your GitHub account so Relay can match your pull requests and reviews to you."
    >
      <Stack spacing={1.5} alignItems="flex-start">
        <LinkOutcome />
        {error && <Alert severity="error">{error}</Alert>}
        <Button
          variant="outlined"
          startIcon={<GitHubIcon />}
          onClick={() => void linkOwnAccount()}
          disabled={linkState.loading}
        >
          Link my GitHub account
        </Button>
      </Stack>
    </SettingsSection>
  );
}

export function SettingsPage() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();

  const tabs = [
    { value: 'profile', label: 'Profile' },
    ...(can(SETTINGS_WRITE_OWN) ? [{ value: 'assignment', label: 'Assignment' }] : []),
    { value: 'appearance', label: 'Appearance' },
    ...(can(IDENTITY_LINK) ? [{ value: 'github', label: 'GitHub' }] : []),
  ];
  const fallback = params.get('link') ? 'github' : 'profile';
  const tab = resolveSettingsTab(tabs, params.get('tab'), fallback);

  return (
    <AppShell view="settings">
      <Stack spacing={{ xs: 3, md: 4 }}>
        <StatusStrip title={VIEW_TITLES.settings} />
        <Stack spacing={3}>
          <SettingsTabs
            tabs={tabs}
            value={tab}
            onChange={(next) => setParams({ tab: next }, { replace: true })}
          />
          {tab === 'profile' && <ProfileSection />}
          {tab === 'assignment' && <AssignmentSection />}
          {tab === 'appearance' && <AppearanceSection />}
          {tab === 'github' && <GithubSection />}
        </Stack>
      </Stack>
    </AppShell>
  );
}
