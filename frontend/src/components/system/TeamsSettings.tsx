import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  type TextFieldProps,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { PEOPLE_QUERY } from '@/graphql/people';
import {
  CREATE_TEAM,
  DELETE_TEAM,
  SET_TEAM_MEMBERS,
  TEAMS_QUERY,
  UPDATE_TEAM,
} from '@/graphql/system';
import type { Person } from '@/types/people';
import type { Team } from '@/types/system';

const NO_LEAD = '';

function personLabel(person: Person): string {
  const name = person.displayName || person.email;
  return person.active ? name : `${name} (inactive)`;
}

export function TeamsSettings() {
  const teamsQuery = useQuery<{ teams: Team[] }>(TEAMS_QUERY);
  const peopleQuery = useQuery<{ people: Person[] }>(PEOPLE_QUERY);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createTeam, createState] = useMutation(CREATE_TEAM);
  const [updateTeam] = useMutation(UPDATE_TEAM);
  const [deleteTeam] = useMutation(DELETE_TEAM);
  const [setTeamMembers] = useMutation<{
    setTeamMembers: { team: Team; movedPersonIds: string[] };
  }>(SET_TEAM_MEMBERS);

  const teams = teamsQuery.data?.teams ?? [];
  // Everyone, inactive included, so an edit never drops an inactive member or lead it
  // cannot see; only active people can be newly picked.
  const allPeople = useMemo(
    () =>
      [...(peopleQuery.data?.people ?? [])].sort((a, b) =>
        personLabel(a).localeCompare(personLabel(b)),
      ),
    [peopleQuery.data],
  );
  const personById = useMemo(
    () => new Map(allPeople.map((person) => [person.id, person])),
    [allPeople],
  );

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    setNotice(null);
    try {
      await action();
      await teamsQuery.refetch();
    } catch (mutationError) {
      setError((mutationError as Error).message);
    }
  };

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    void run(async () => {
      await createTeam({ variables: { name: trimmed } });
      setName('');
    });
  };

  const update = (team: Team, input: Partial<Pick<Team, 'name' | 'leadPersonId' | 'leadThreshold'>>) =>
    void run(() => updateTeam({ variables: { id: team.id, input } }));

  const setMembers = (team: Team, personIds: string[]) =>
    void run(async () => {
      const { data } = await setTeamMembers({ variables: { teamId: team.id, personIds } });
      const moved = (data?.setTeamMembers.movedPersonIds ?? [])
        .map((id) => personById.get(id))
        .filter((person): person is Person => Boolean(person))
        .map(personLabel);
      if (moved.length > 0) {
        setNotice(`Moved ${moved.join(', ')} from their previous team.`);
      }
    });

  const remove = (team: Team) => {
    if (window.confirm(`Delete the ${team.name} team? Its members stay in Relay, without a team.`)) {
      void run(() => deleteTeam({ variables: { id: team.id } }));
    }
  };

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
          Teams
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <Box component="code" sx={{ fontFamily: 'monospace', fontSize: '0.92em' }}>
            @relay team
          </Box>{' '}
          picks a reviewer from the pull request author&apos;s team. The lead is asked only when
          every other member already has the threshold of open reviews or more.
        </Typography>
      </Box>

      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <TextField
          size="small"
          placeholder="Team name — for example Platform"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              create();
            }
          }}
          sx={{ width: 340 }}
        />
        <Button
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={create}
          disabled={createState.loading || name.trim().length === 0}
          sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          Create team
        </Button>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}
      {notice && <Alert severity="info">{notice}</Alert>}
      {teamsQuery.error && (
        <Alert severity="error">Could not load teams: {teamsQuery.error.message}</Alert>
      )}

      {teamsQuery.loading && teams.length === 0 ? (
        <Skeleton variant="rounded" height={120} />
      ) : (
        <Card>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Team</TableCell>
                <TableCell>Lead</TableCell>
                <TableCell>Lead threshold</TableCell>
                <TableCell>Members</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {teams.map((team) => (
                <TableRow key={team.id} sx={{ verticalAlign: 'top' }}>
                  <TableCell sx={{ minWidth: 160 }}>
                    <TextField
                      size="small"
                      defaultValue={team.name}
                      onBlur={(event) => {
                        const next = event.target.value.trim();
                        if (next && next !== team.name) {
                          update(team, { name: next });
                        }
                      }}
                      inputProps={{ 'aria-label': 'Team name' }}
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 180 }}>
                    <Select
                      size="small"
                      value={team.leadPersonId ?? NO_LEAD}
                      displayEmpty
                      onChange={(event) =>
                        update(team, { leadPersonId: event.target.value || null })
                      }
                      sx={{ minWidth: 170, fontSize: 13 }}
                      inputProps={{ 'aria-label': 'Team lead' }}
                    >
                      <MenuItem value={NO_LEAD} sx={{ fontSize: 13 }}>
                        No lead
                      </MenuItem>
                      {allPeople
                        .filter((person) => person.active || person.id === team.leadPersonId)
                        .map((person) => (
                          <MenuItem
                            key={person.id}
                            value={person.id}
                            disabled={!person.active}
                            sx={{ fontSize: 13 }}
                          >
                            {personLabel(person)}
                          </MenuItem>
                        ))}
                    </Select>
                  </TableCell>
                  <TableCell sx={{ width: 140 }}>
                    <Tooltip title="Open reviews every other member needs before the lead is asked">
                      <TextField
                        size="small"
                        type="number"
                        defaultValue={team.leadThreshold}
                        onBlur={(event) => {
                          const next = Number(event.target.value);
                          if (next !== team.leadThreshold) {
                            update(team, { leadThreshold: next });
                          }
                        }}
                        inputProps={{ min: 1, max: 20, 'aria-label': 'Lead threshold' }}
                        sx={{ width: 90 }}
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell sx={{ minWidth: 280 }}>
                    <Autocomplete
                      multiple
                      size="small"
                      options={allPeople.filter(
                        (person) =>
                          person.id !== team.leadPersonId &&
                          (person.active || team.memberIds.includes(person.id)),
                      )}
                      getOptionDisabled={(person) => !person.active}
                      value={team.memberIds
                        .map((id) => personById.get(id))
                        .filter((person): person is Person => Boolean(person))}
                      getOptionLabel={personLabel}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      onChange={(_event, value) =>
                        setMembers(
                          team,
                          value.map((person) => person.id),
                        )
                      }
                      renderTags={(value, getTagProps) =>
                        value.map((person, index) => {
                          const { key, ...tagProps } = getTagProps({ index });
                          return (
                            <Chip key={key} size="small" label={personLabel(person)} {...tagProps} />
                          );
                        })
                      }
                      renderInput={(params) => (
                        // MUI's Autocomplete params and TextField props disagree on the ref type.
                        <TextField {...(params as TextFieldProps)} placeholder="Add members" />
                      )}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Delete team">
                      <IconButton size="small" onClick={() => remove(team)} aria-label="Delete team">
                        <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {teams.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                      No teams yet — create the first one above.
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
