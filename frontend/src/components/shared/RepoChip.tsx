import { Box, Tooltip, alpha } from '@mui/material';

function shortRepo(repo: string): string {
  return repo.includes('/') ? repo.split('/')[1] : repo;
}

export function RepoChip({ repo }: { repo: string }) {
  return (
    <Tooltip title={repo} arrow placement="top">
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          flexShrink: 0,
          maxWidth: 150,
          px: 0.75,
          py: 0.125,
          borderRadius: 1,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.02em',
          lineHeight: 1.5,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          color: 'text.secondary',
          bgcolor: (theme) => alpha(theme.palette.text.primary, 0.06),
          border: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        {shortRepo(repo)}
      </Box>
    </Tooltip>
  );
}
