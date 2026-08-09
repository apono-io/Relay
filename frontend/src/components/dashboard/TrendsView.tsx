import { useState } from 'react';
import { Box, Stack, Tab, Tabs, alpha } from '@mui/material';
import type { DashboardSummary } from '@/types/dashboard';
import { Panel } from './Panel';
import { KpiRow } from './KpiRow';
import { FlowChart } from './FlowChart';
import { SpeedTrendChart } from './SpeedTrendChart';
import { OpenAgeChart } from './OpenAgeChart';
import { ReviewDepthChart } from './ReviewDepthChart';
import { WaitFlowChart, type WaitStat } from './WaitFlowChart';

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
    <Stack spacing={3}>
      <KpiRow summary={summary} />

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          alignItems: 'stretch',
        }}
      >
        <Panel
          title="Opened vs merged"
          caption="Weekly flow — a healthy team merges about as much as it opens."
        >
          <FlowChart points={summary.weeklyFlow} />
        </Panel>

        <Panel
          title="Time to merge"
          caption="How long a PR takes from opening to merge, week by week."
        >
          <SpeedTrendChart points={summary.weeklyFlow} />
        </Panel>

        <Panel
          title="Open PRs by age"
          caption="Everything waiting on someone right now — old PRs get harder to merge."
        >
          <OpenAgeChart prs={summary.stuckNow} />
        </Panel>

        <Panel
          title="Review depth"
          caption="Share of merged PRs approved without a single comment, and reverts."
        >
          <ReviewDepthChart points={summary.qualityTrend} />
        </Panel>
      </Box>

      <Panel
        title="Wait times — where the clock runs"
        caption={
          stat === 'median'
            ? 'How long a typical PR spends at each step of its journey.'
            : 'How long the slowest 10% of PRs spend at each step — the number we aim to cut.'
        }
        action={<StatTabs stat={stat} onChange={setStat} />}
      >
        <WaitFlowChart reviewerRounds={summary.reviewerWaitByRound} authorRounds={summary.authorWaitByRound} stat={stat} />
      </Panel>
    </Stack>
  );
}
