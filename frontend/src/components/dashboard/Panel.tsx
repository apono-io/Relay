import { Box, Card, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export function Panel({
  title,
  caption,
  action,
  children,
}: {
  title: string;
  caption?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <Stack
        direction="row"
        alignItems="flex-start"
        spacing={2}
        sx={{ px: 2.5, pt: 2, pb: 1 }}
      >
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {caption && (
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5, mt: 0.25 }}>
              {caption}
            </Typography>
          )}
        </Box>
        {action}
      </Stack>
      <Box sx={{ px: 2.5, pb: 2, flexGrow: 1, minWidth: 0 }}>{children}</Box>
    </Card>
  );
}
