import { Box, Tab, Tabs } from '@mui/material';

export type SettingsTab = { value: string; label: string };

export function SettingsTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: SettingsTab[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Tabs
        value={value}
        onChange={(_event, next: string) => onChange(next)}
        sx={{
          minHeight: 40,
          '& .MuiTab-root': {
            minHeight: 40,
            px: 1.75,
            fontSize: 13.5,
            fontWeight: 600,
            textTransform: 'none',
            letterSpacing: 0,
          },
        }}
      >
        {tabs.map((tab) => (
          <Tab key={tab.value} value={tab.value} label={tab.label} disableRipple />
        ))}
      </Tabs>
    </Box>
  );
}

export function resolveSettingsTab(
  tabs: SettingsTab[],
  requested: string | null,
  fallback: string,
): string {
  const valid = new Set(tabs.map((tab) => tab.value));
  if (requested && valid.has(requested)) {
    return requested;
  }
  return valid.has(fallback) ? fallback : tabs[0]?.value ?? '';
}
