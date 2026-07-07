import { Box, Button, Stack, Typography } from '@mui/material';

export function LoginPage() {
  const apiUrl = import.meta.env.DEV ? (import.meta.env.VITE_API_URL || 'http://localhost:3000') : '/apn';

  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <Stack spacing={3} alignItems="center">
        <Typography variant="h3">Relay</Typography>
        <Typography color="text.secondary">Shorten how long a PR waits to merge.</Typography>
        <Button variant="contained" size="large" href={`${apiUrl}/auth/google`}>
          Sign in with Google
        </Button>
      </Stack>
    </Box>
  );
}
