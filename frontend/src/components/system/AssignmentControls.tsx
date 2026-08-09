import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import {
  Alert,
  Box,
  Card,
  Skeleton,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import {
  ASSIGNMENT_SETTINGS_QUERY,
  SET_ACTUALLY_ASSIGN,
} from '@/graphql/assignment';

export function AssignmentControls() {
  const { data, loading, refetch } = useQuery<{
    assignmentSettings: { actuallyAssign: boolean };
  }>(ASSIGNMENT_SETTINGS_QUERY);
  const [setActuallyAssign, mutationState] = useMutation(SET_ACTUALLY_ASSIGN);
  const [error, setError] = useState<string | null>(null);

  const enabled = data?.assignmentSettings.actuallyAssign ?? false;

  const toggle = async () => {
    setError(null);
    try {
      await setActuallyAssign({ variables: { enabled: !enabled } });
      await refetch();
    } catch (mutationError) {
      setError((mutationError as Error).message);
    }
  };

  if (loading && !data) {
    return <Skeleton variant="rounded" height={88} />;
  }

  return (
    <Card sx={{ p: 2.5 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Actually assign on GitHub
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {enabled
              ? 'On — Relay requests real reviewers on GitHub when someone triggers an assignment.'
              : 'Off — assignments are recorded and shown in Relay only, marked as “test”. Nobody’s real PR is touched.'}
          </Typography>
        </Box>
        <Switch
          checked={enabled}
          color="warning"
          onChange={() => void toggle()}
          disabled={mutationState.loading}
        />
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {error}
        </Alert>
      )}
    </Card>
  );
}
