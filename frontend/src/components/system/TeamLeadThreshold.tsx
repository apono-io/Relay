import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { Alert, Box, Card, Skeleton, Stack, TextField, Typography } from '@mui/material';
import { ASSIGNMENT_SETTINGS_QUERY, SET_TEAM_LEAD_THRESHOLD } from '@/graphql/assignment';

// One threshold for every team; the Teams tab sets names, leads and members.
export function TeamLeadThreshold() {
  const { data, loading, refetch } = useQuery<{
    assignmentSettings: { teamLeadThreshold: number };
  }>(ASSIGNMENT_SETTINGS_QUERY);
  const [setTeamLeadThreshold, mutationState] = useMutation(SET_TEAM_LEAD_THRESHOLD);
  const [error, setError] = useState<string | null>(null);

  const threshold = data?.assignmentSettings.teamLeadThreshold ?? 2;

  const save = async (input: HTMLInputElement) => {
    const next = Number(input.value);
    if (next === threshold) {
      return;
    }
    setError(null);
    try {
      await setTeamLeadThreshold({ variables: { value: next } });
      await refetch();
    } catch (mutationError) {
      setError((mutationError as Error).message);
      // A refused value goes back to the saved one instead of staying in the box.
      input.value = String(threshold);
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
            Team lead threshold
          </Typography>
          <Typography variant="body2" color="text.secondary">
            With{' '}
            <Box component="code" sx={{ fontFamily: 'monospace', fontSize: '0.92em' }}>
              @relay team
            </Box>
            , Relay asks the team lead only when every other member already has this many open
            reviews or more. Applies to every team.
          </Typography>
        </Box>
        <TextField
          key={threshold}
          size="small"
          type="number"
          defaultValue={threshold}
          disabled={mutationState.loading}
          onBlur={(event) => void save(event.target as HTMLInputElement)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              (event.target as HTMLInputElement).blur();
            }
          }}
          inputProps={{ min: 1, max: 20, 'aria-label': 'Team lead threshold' }}
          sx={{ width: 90, flexShrink: 0 }}
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
