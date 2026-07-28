import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Alert,
} from '@mui/material';
import { ROLES } from '@/lib/permissions';
import type { Person } from '@/types/people';

export type PersonDraft = {
  email: string;
  displayName: string;
  githubLogin: string;
  team: string;
  role: string;
};

const EMPTY: PersonDraft = { email: '', displayName: '', githubLogin: '', team: '', role: 'developer' };

function draftFrom(person: Person | null, presetLogin: string): PersonDraft {
  if (!person) {
    return { ...EMPTY, githubLogin: presetLogin };
  }
  return {
    email: person.email,
    displayName: person.displayName ?? '',
    githubLogin: person.githubLogin ?? '',
    team: person.team ?? '',
    role: person.role,
  };
}

type Props = {
  open: boolean;
  person: Person | null;
  presetLogin?: string;
  error?: string | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (draft: PersonDraft) => void;
};

export function PersonFormDialog({
  open,
  person,
  presetLogin = '',
  error,
  saving,
  onClose,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<PersonDraft>(() => draftFrom(person, presetLogin));

  useEffect(() => {
    if (open) {
      setDraft(draftFrom(person, presetLogin));
    }
  }, [open, person, presetLogin]);

  const set = (field: keyof PersonDraft) => (event: { target: { value: string } }) =>
    setDraft((current) => ({ ...current, [field]: event.target.value }));

  const emailLooksValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email.trim());

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{person ? 'Edit person' : 'Add person'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Work email"
            value={draft.email}
            onChange={set('email')}
            error={draft.email.length > 0 && !emailLooksValid}
            helperText="The address this person signs in with"
            fullWidth
            autoFocus={!person}
          />
          <TextField label="Name" value={draft.displayName} onChange={set('displayName')} fullWidth />
          <TextField
            label="GitHub login"
            value={draft.githubLogin}
            onChange={set('githubLogin')}
            helperText="Typed in here, this counts as confirmed and a later guess will not replace it"
            fullWidth
          />
          <TextField label="Team" value={draft.team} onChange={set('team')} fullWidth />
          <TextField label="Role" value={draft.role} onChange={set('role')} select fullWidth>
            {ROLES.map((role) => (
              <MenuItem key={role} value={role}>
                {role}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={() => onSave(draft)}
          variant="contained"
          disabled={!emailLooksValid || saving}
        >
          {person ? 'Save' : 'Add person'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
