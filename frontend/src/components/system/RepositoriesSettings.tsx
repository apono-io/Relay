import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import {
  Alert,
  Box,
  Button,
  Card,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import BookOutlinedIcon from '@mui/icons-material/BookOutlined';
import { formatDistanceToNow } from 'date-fns';
import { ADD_REPO, REPOS_QUERY } from '@/graphql/system';
import type { WatchedRepo } from '@/types/system';

export function RepositoriesSettings() {
  const { data, loading, error, refetch } = useQuery<{ repos: WatchedRepo[] }>(REPOS_QUERY);
  const [name, setName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addRepo, addState] = useMutation(ADD_REPO);

  const repos = data?.repos ?? [];

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    setAddError(null);
    try {
      await addRepo({ variables: { name: trimmed } });
      setName('');
      await refetch();
    } catch (mutationError) {
      setAddError((mutationError as Error).message);
    }
  };

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" alignItems="flex-end" justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
            Repositories
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Relay watches these repositories. Adding one verifies GitHub access first, then
            pulls its history in the background.
          </Typography>
        </Box>
      </Stack>

      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <TextField
          size="small"
          placeholder="owner/name — for example apono-io/Relay"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void submit();
            }
          }}
          sx={{ width: 340 }}
        />
        <Button
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={() => void submit()}
          disabled={addState.loading || name.trim().length === 0}
          sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          {addState.loading ? 'Checking…' : 'Add repository'}
        </Button>
      </Stack>

      {addError && <Alert severity="error">{addError}</Alert>}
      {error && <Alert severity="error">Could not load repositories: {error.message}</Alert>}

      {loading && repos.length === 0 ? (
        <Skeleton variant="rounded" height={120} />
      ) : (
        <Card>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Repository</TableCell>
                <TableCell align="right">Watching since</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {repos.map((repo) => (
                <TableRow key={repo.id}>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <BookOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {repo.name}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" color="text.secondary">
                      {formatDistanceToNow(new Date(repo.createdAt), { addSuffix: true })}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
              {repos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                      No repositories yet — add the first one above.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </Stack>
  );
}
