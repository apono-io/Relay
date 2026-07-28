import { Box, Stack, Typography } from '@mui/material';
import { SyncStatus } from '@/components/shared/SyncStatus';

export function StatusStrip({ title }: { title: string }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      flexWrap="wrap"
      useFlexGap
      spacing={1.5}
      sx={{ pb: 2.5, borderBottom: (theme) => `1px solid ${theme.palette.divider}` }}
    >
      <Typography variant="h5">{title}</Typography>
      <Box sx={{ flexGrow: 1 }} />
      <SyncStatus />
    </Stack>
  );
}
