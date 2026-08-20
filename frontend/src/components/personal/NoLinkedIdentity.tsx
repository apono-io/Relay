import { Card, Stack, Typography } from '@mui/material';
import LinkOffOutlinedIcon from '@mui/icons-material/LinkOffOutlined';
import { useAuth } from '@/context/AuthContext';
import { PERSON_WRITE } from '@/lib/permissions';

export function NoLinkedIdentity() {
  const { can } = useAuth();
  const hint = can(PERSON_WRITE)
    ? 'Add your GitHub username under System settings, People and this view will light up.'
    : 'Ask an admin to add your GitHub username under System settings, People and this view will light up.';
  return (
    <Card sx={{ p: 5, textAlign: 'center' }}>
      <Stack spacing={1.5} alignItems="center">
        <LinkOffOutlinedIcon color="disabled" sx={{ fontSize: 40 }} />
        <Typography variant="h6">Relay does not know your GitHub username yet</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 440 }}>
          Your account is not linked to any GitHub identity, so Relay cannot match pull requests to
          you. {hint}
        </Typography>
      </Stack>
    </Card>
  );
}
