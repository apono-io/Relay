import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import {
  Alert,
  Box,
  Button,
  Card,
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
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import {
  ADD_AREA_RULE,
  AREA_RULES_QUERY,
  DELETE_AREA_RULE,
  REPOS_QUERY,
  UPDATE_AREA_RULE,
} from '@/graphql/system';
import type { AreaRule, WatchedRepo } from '@/types/system';

const RISK_LABELS: Record<number, string> = {
  1: '1 · Low',
  2: '2 · Normal',
  3: '3 · Elevated',
  4: '4 · High',
  5: '5 · Critical',
};

function RiskSelect({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (risk: number) => void;
  disabled?: boolean;
}) {
  return (
    <Select
      size="small"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
      sx={{ minWidth: 130, fontSize: 13 }}
    >
      {[1, 2, 3, 4, 5].map((risk) => (
        <MenuItem key={risk} value={risk} sx={{ fontSize: 13 }}>
          {RISK_LABELS[risk]}
        </MenuItem>
      ))}
    </Select>
  );
}

export function AreaRulesSettings() {
  const reposQuery = useQuery<{ repos: WatchedRepo[] }>(REPOS_QUERY);
  const repos = useMemo(() => reposQuery.data?.repos ?? [], [reposQuery.data]);
  const [selected, setSelected] = useState<string | null>(null);
  const repo = selected ?? repos[0]?.name ?? null;

  const rulesQuery = useQuery<{ areaRules: AreaRule[] }>(AREA_RULES_QUERY, {
    variables: { repo },
    skip: !repo,
  });
  const rules = rulesQuery.data?.areaRules ?? [];

  const [mutationError, setMutationError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ pattern: '', area: '', risk: 2 });

  const refetch = () => void rulesQuery.refetch();
  const [addRule, addState] = useMutation(ADD_AREA_RULE, { onCompleted: refetch });
  const [updateRule] = useMutation(UPDATE_AREA_RULE);
  const [deleteRule] = useMutation(DELETE_AREA_RULE, { onCompleted: refetch });

  const run = async (action: () => Promise<unknown>) => {
    setMutationError(null);
    try {
      await action();
    } catch (error) {
      setMutationError((error as Error).message);
    }
  };

  const submitDraft = () =>
    run(async () => {
      await addRule({
        variables: { input: { repo, pattern: draft.pattern.trim(), area: draft.area.trim(), risk: draft.risk } },
      });
      setDraft({ pattern: '', area: '', risk: 2 });
    });

  const patchRule = (id: string, input: { pattern?: string; area?: string; risk?: number }) =>
    run(() => updateRule({ variables: { id, input } }));

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" alignItems="flex-end" justifyContent="space-between" spacing={2} flexWrap="wrap" useFlexGap>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
            Code areas
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Folders mapped to areas, each with a private sensitivity level. The assignment
            engine reads this — developers never see it.
          </Typography>
        </Box>
        {repos.length > 1 && repo && (
          <Select
            size="small"
            value={repo}
            onChange={(event) => setSelected(event.target.value)}
            sx={{ minWidth: 220, fontSize: 13 }}
          >
            {repos.map((watched) => (
              <MenuItem key={watched.id} value={watched.name} sx={{ fontSize: 13 }}>
                {watched.name}
              </MenuItem>
            ))}
          </Select>
        )}
      </Stack>

      {mutationError && <Alert severity="error">{mutationError}</Alert>}
      {rulesQuery.error && (
        <Alert severity="error">Could not load area rules: {rulesQuery.error.message}</Alert>
      )}

      {!repo ? (
        <Alert severity="info">Add a repository first — its areas appear here automatically.</Alert>
      ) : rulesQuery.loading && rules.length === 0 ? (
        <Skeleton variant="rounded" height={200} />
      ) : (
        <Card>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Folder pattern</TableCell>
                <TableCell>Area</TableCell>
                <TableCell sx={{ width: 160 }}>Sensitivity</TableCell>
                <TableCell sx={{ width: 56 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <TextField
                      size="small"
                      variant="standard"
                      defaultValue={rule.pattern}
                      slotProps={{ input: { disableUnderline: true, sx: { fontSize: 13, fontFamily: 'ui-monospace, monospace' } } }}
                      onBlur={(event) => {
                        const next = event.target.value.trim();
                        if (next && next !== rule.pattern) {
                          void patchRule(rule.id, { pattern: next });
                        }
                      }}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      variant="standard"
                      defaultValue={rule.area}
                      slotProps={{ input: { disableUnderline: true, sx: { fontSize: 13 } } }}
                      onBlur={(event) => {
                        const next = event.target.value.trim();
                        if (next && next !== rule.area) {
                          void patchRule(rule.id, { area: next });
                        }
                      }}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <RiskSelect value={rule.risk} onChange={(risk) => void patchRule(rule.id, { risk })} />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Delete rule">
                      <IconButton size="small" onClick={() => void run(() => deleteRule({ variables: { id: rule.id } }))}>
                        <DeleteOutlineRoundedIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell>
                  <TextField
                    size="small"
                    placeholder="backend/src/core/auth/**"
                    value={draft.pattern}
                    onChange={(event) => setDraft({ ...draft, pattern: event.target.value })}
                    slotProps={{ input: { sx: { fontSize: 13, fontFamily: 'ui-monospace, monospace' } } }}
                    fullWidth
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    placeholder="Auth"
                    value={draft.area}
                    onChange={(event) => setDraft({ ...draft, area: event.target.value })}
                    slotProps={{ input: { sx: { fontSize: 13 } } }}
                    fullWidth
                  />
                </TableCell>
                <TableCell>
                  <RiskSelect value={draft.risk} onChange={(risk) => setDraft({ ...draft, risk })} />
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    startIcon={<AddRoundedIcon />}
                    onClick={() => void submitDraft()}
                    disabled={addState.loading || !draft.pattern.trim() || !draft.area.trim()}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    Add
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      )}
    </Stack>
  );
}
