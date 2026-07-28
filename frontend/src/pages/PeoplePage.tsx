import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  Skeleton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import GitHubIcon from '@mui/icons-material/GitHub';
import { AppShell } from '@/components/layout/AppShell';
import { IdentityChips } from '@/components/people/IdentityChips';
import { PersonFormDialog, PersonDraft } from '@/components/people/PersonFormDialog';
import { DevAvatar, SoftChip } from '@/components/shared/pr-visuals';
import { SyncStatus } from '@/components/shared/SyncStatus';
import {
  CREATE_PERSON,
  PEOPLE_QUERY,
  ROSTER_HEALTH_QUERY,
  SET_PERSON_ACTIVE,
  UPDATE_PERSON,
} from '@/graphql/people';
import { START_GITHUB_LINK } from '@/graphql/auth';
import { useAuth } from '@/context/AuthContext';
import { IDENTITY_LINK, PERSON_READ, PERSON_WRITE } from '@/lib/permissions';
import type { Person, RosterHealth } from '@/types/people';

function trimmedOrUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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

export function PeoplePage() {
  const { can } = useAuth();
  const canWrite = can(PERSON_WRITE);
  const canRead = can(PERSON_READ);

  const people = useQuery<{ people: Person[] }>(PEOPLE_QUERY);
  const health = useQuery<{ rosterHealth: RosterHealth }>(ROSTER_HEALTH_QUERY);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [presetLogin, setPresetLogin] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  const refetchAll = () => {
    void people.refetch();
    void health.refetch();
  };

  const [createPerson, createState] = useMutation(CREATE_PERSON, { onCompleted: refetchAll });
  const [updatePerson, updateState] = useMutation(UPDATE_PERSON, { onCompleted: refetchAll });
  const [setPersonActive] = useMutation(SET_PERSON_ACTIVE, { onCompleted: refetchAll });
  const [startGithubLink, linkState] = useMutation<{ startGithubLink: string }>(START_GITHUB_LINK);

  const openAdd = (login = '') => {
    setEditing(null);
    setPresetLogin(login);
    setSaveError(null);
    setDialogOpen(true);
  };

  const openEdit = (person: Person) => {
    setEditing(person);
    setPresetLogin('');
    setSaveError(null);
    setDialogOpen(true);
  };

  const save = async (draft: PersonDraft) => {
    const input = {
      email: draft.email.trim(),
      displayName: trimmedOrUndefined(draft.displayName),
      githubLogin: trimmedOrUndefined(draft.githubLogin),
      team: trimmedOrUndefined(draft.team),
      role: draft.role,
    };
    try {
      if (editing) {
        await updatePerson({ variables: { id: editing.id, input } });
      } else {
        await createPerson({ variables: { input } });
      }
      setDialogOpen(false);
    } catch (error) {
      setSaveError((error as Error).message);
    }
  };

  const linkOwnAccount = async () => {
    try {
      const result = await startGithubLink();
      const url = result.data?.startGithubLink;
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      setSaveError((error as Error).message);
    }
  };

  const roster = people.data?.people ?? [];
  const unmapped = health.data?.rosterHealth?.unmappedLogins ?? [];
  const loading = people.loading && roster.length === 0;

  return (
    <AppShell view="people">
      <Stack spacing={{ xs: 3, md: 4 }}>
        <Stack direction="row" alignItems="flex-end" justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
              People
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {roster.length} {roster.length === 1 ? 'person' : 'people'} on the roster
            </Typography>
          </Box>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <SyncStatus />
            {can(IDENTITY_LINK) && (
              <Button
                variant="outlined"
                startIcon={<GitHubIcon />}
                onClick={() => void linkOwnAccount()}
                disabled={linkState.loading}
              >
                Link my GitHub account
              </Button>
            )}
            {canWrite && (
              <Button variant="contained" startIcon={<PersonAddAltOutlinedIcon />} onClick={() => openAdd()}>
                Add person
              </Button>
            )}
          </Stack>
        </Stack>

        <LinkOutcome />
        {saveError && <Alert severity="error">{saveError}</Alert>}

        {people.error && (
          <Alert severity="error">Could not load the roster: {people.error.message}</Alert>
        )}

        {canRead && health.error && (
          <Alert severity="warning">Could not load the roster health report: {health.error.message}</Alert>
        )}

        {loading && <Skeleton variant="rounded" height={360} />}

        {!loading && !people.error && (
          <Card sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Person</TableCell>
                  <TableCell>GitHub</TableCell>
                  <TableCell>Team</TableCell>
                  <TableCell>Role</TableCell>
                  {canWrite && <TableCell align="right">Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {unmapped.map((login) => (
                  <TableRow
                    key={`unmapped-${login}`}
                    sx={{ bgcolor: (theme) => alpha(theme.palette.warning.main, 0.05) }}
                  >
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1.25}>
                        <DevAvatar login={login} size={28} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                            {login}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                            GitHub author without a person
                          </Typography>
                        </Box>
                        <SoftChip label="Needs Apono email" tone="amber" />
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={login} variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        —
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        —
                      </Typography>
                    </TableCell>
                    {canWrite && (
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<PersonAddAltOutlinedIcon />}
                          onClick={() => openAdd(login)}
                          sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                        >
                          Add person
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {roster.map((person) => (
                  <TableRow key={person.id} sx={{ opacity: person.active ? 1 : 0.5 }}>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1.25}>
                        <Avatar
                          sx={{
                            width: 28,
                            height: 28,
                            fontSize: 11,
                            fontWeight: 700,
                            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.16),
                            color: 'primary.main',
                          }}
                        >
                          {person.email.slice(0, 2).toUpperCase()}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                            {person.displayName ?? person.email.split('@')[0]}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                            {person.email}
                          </Typography>
                        </Box>
                        {!person.active && <Chip size="small" label="Inactive" variant="outlined" />}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <IdentityChips identities={person.identities} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {person.team ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={person.role} variant="outlined" />
                    </TableCell>
                    {canWrite && (
                      <TableCell align="right">
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => openEdit(person)}>
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={person.active ? 'Active — click to disable' : 'Disabled — click to enable'}>
                          <Switch
                            size="small"
                            checked={person.active}
                            onChange={() =>
                              void setPersonActive({ variables: { id: person.id, active: !person.active } })
                            }
                          />
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {roster.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={canWrite ? 5 : 4}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                        Nobody on the roster yet — run <code>yarn seed-people</code> in the backend to read the
                        team from commit history.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        )}
      </Stack>

      <PersonFormDialog
        open={dialogOpen}
        person={editing}
        presetLogin={presetLogin}
        error={saveError}
        saving={createState.loading || updateState.loading}
        onClose={() => setDialogOpen(false)}
        onSave={(draft) => void save(draft)}
      />
    </AppShell>
  );
}
