import { useApolloClient, useMutation, useQuery } from '@apollo/client';
import { Box, CircularProgress, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { formatDistanceToNow } from 'date-fns';
import { LAST_SYNCED_QUERY, SYNC_NOW_MUTATION } from '@/graphql/dashboard';

export function SyncStatus() {
  const client = useApolloClient();
  const { data } = useQuery<{ lastSyncedAt: string | null }>(LAST_SYNCED_QUERY, {
    pollInterval: 30000,
  });
  const [syncNow, { loading: syncing }] = useMutation(SYNC_NOW_MUTATION, {
    onCompleted: () => void client.refetchQueries({ include: 'active' }),
  });

  const lastSyncedAt = data?.lastSyncedAt ?? null;

  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Box
        sx={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          bgcolor: lastSyncedAt ? 'success.main' : 'text.disabled',
          boxShadow: (theme) =>
            lastSyncedAt ? `0 0 0 3px ${theme.palette.success.main}26` : 'none',
        }}
      />
      <Typography variant="caption" color="text.secondary" noWrap>
        {syncing
          ? 'Syncing with GitHub…'
          : lastSyncedAt
            ? `Synced ${formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}`
            : 'Not synced yet'}
      </Typography>
      <Tooltip title="Pull the latest activity from GitHub">
        <span>
          <IconButton size="small" onClick={() => syncNow()} disabled={syncing}>
            {syncing ? <CircularProgress size={16} /> : <RefreshIcon sx={{ fontSize: 17 }} />}
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
}
