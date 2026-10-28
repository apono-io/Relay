import { Navigate, useSearchParams } from 'react-router-dom';
import { Skeleton, Stack } from '@mui/material';
import { AppShell, VIEW_TITLES } from '@/components/layout/AppShell';
import { StatusStrip } from '@/components/dashboard/StatusStrip';
import { PeopleSettings } from '@/components/people/PeopleSettings';
import { RepositoriesSettings } from '@/components/system/RepositoriesSettings';
import { AreaRulesSettings } from '@/components/system/AreaRulesSettings';
import { TeamsSettings } from '@/components/system/TeamsSettings';
import { AssignmentQuietPhase } from '@/components/system/AssignmentQuietPhase';
import { EnginePerformance } from '@/components/system/EnginePerformance';
import { AssignmentControls } from '@/components/system/AssignmentControls';
import { TeamLeadThreshold } from '@/components/system/TeamLeadThreshold';
import { SettingsTabs, resolveSettingsTab } from '@/components/shared/SettingsTabs';
import { useAuth } from '@/context/AuthContext';
import { PERSON_WRITE, SETTINGS_ADMIN } from '@/lib/permissions';

export function SystemSettingsPage() {
  const { user, can } = useAuth();
  const [params, setParams] = useSearchParams();

  if (user && !can(PERSON_WRITE)) {
    return <Navigate to="/" replace />;
  }

  const tabs = [
    { value: 'people', label: 'People' },
    ...(can(SETTINGS_ADMIN)
      ? [
          { value: 'repositories', label: 'Repositories' },
          { value: 'areas', label: 'Code areas' },
          { value: 'teams', label: 'Teams' },
          { value: 'engine', label: 'Engine settings' },
          { value: 'engine-analytics', label: 'Engine analytics' },
        ]
      : []),
  ];
  const tab = resolveSettingsTab(tabs, params.get('tab'), 'people');

  return (
    <AppShell view="system">
      <Stack spacing={{ xs: 3, md: 4 }}>
        <StatusStrip title={VIEW_TITLES.system} />
        {user ? (
          <Stack spacing={3}>
            <SettingsTabs
              tabs={tabs}
              value={tab}
              onChange={(next) => setParams({ tab: next }, { replace: true })}
            />
            {tab === 'people' && <PeopleSettings />}
            {tab === 'repositories' && <RepositoriesSettings />}
            {tab === 'areas' && <AreaRulesSettings />}
            {tab === 'teams' && <TeamsSettings />}
            {tab === 'engine' && (
              <Stack spacing={3}>
                <AssignmentControls />
                <TeamLeadThreshold />
              </Stack>
            )}
            {tab === 'engine-analytics' && (
              <Stack spacing={3}>
                <EnginePerformance />
                <AssignmentQuietPhase />
              </Stack>
            )}
          </Stack>
        ) : (
          <Skeleton variant="rounded" height={360} />
        )}
      </Stack>
    </AppShell>
  );
}
