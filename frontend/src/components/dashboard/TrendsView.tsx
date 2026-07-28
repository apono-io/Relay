import { useState } from 'react';
import { Stack, Tab, Tabs, alpha } from '@mui/material';
import type { DashboardSummary } from '@/types/dashboard';
import { ZoneSection } from './ZoneSection';
import { WaitFlowChart, type WaitStat } from './WaitFlowChart';
import { WeeklyPhaseChart } from './WeeklyPhaseChart';

function StatTabs({ stat, onChange }: { stat: WaitStat; onChange: (value: WaitStat) => void }) {
  return (
    <Tabs
      value={stat}
      onChange={(_, value: WaitStat) => onChange(value)}
      sx={{
        minHeight: 34,
        bgcolor: (theme) => alpha(theme.palette.text.primary, 0.06),
        borderRadius: 2,
        p: '3px',
        '& .MuiTabs-indicator': { display: 'none' },
        '& .MuiTab-root': {
          minHeight: 28,
          py: 0,
          px: 1.5,
          borderRadius: 1.5,
          textTransform: 'none',
          color: 'text.secondary',
          transition: 'background-color 120ms, color 120ms',
        },
        '& .MuiTab-root.Mui-selected': {
          color: 'text.primary',
          bgcolor: 'background.paper',
          boxShadow: (theme) =>
            theme.palette.mode === 'dark' ? '0 1px 2px rgba(0,0,0,0.5)' : '0 1px 2px rgba(15,23,42,0.12)',
        },
      }}
    >
      <Tab label="Typical (median)" value="median" />
      <Tab label="Slowest 10% (p90)" value="p90" />
    </Tabs>
  );
}

export function TrendsView({ summary }: { summary: DashboardSummary }) {
  const [stat, setStat] = useState<WaitStat>('median');

  return (
    <Stack spacing={4}>
      <ZoneSection
        title="Wait times — where the clock runs"
        caption={
          stat === 'median'
            ? 'How long a typical PR spends at each step of its journey.'
            : 'How long the slowest 10% of PRs spend at each step — the number we aim to cut.'
        }
        action={<StatTabs stat={stat} onChange={setStat} />}
      >
        <WaitFlowChart reviewerRounds={summary.reviewerWaitByRound} authorRounds={summary.authorWaitByRound} stat={stat} />
      </ZoneSection>

      <ZoneSection
        title="Where the time goes, week by week"
        caption="Median hours per phase for PRs merged each week. Taller bars are slower weeks; Pickup is usually the lever."
      >
        <WeeklyPhaseChart points={summary.weeklyPhases} />
      </ZoneSection>
    </Stack>
  );
}
