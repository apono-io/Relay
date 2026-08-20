import { Box, Stack, Tooltip, Typography, alpha } from '@mui/material';

const LEVELS = 5;

const DESCRIPTIONS: Record<number, string> = {
  1: 'Low sensitivity — routine change',
  2: 'Normal sensitivity',
  3: 'Elevated sensitivity',
  4: 'High sensitivity — worth a careful read',
  5: 'Critical sensitivity — the most careful read',
};

export function SensitivityDots({
  sensitivity,
  area,
}: {
  sensitivity: number;
  area?: string | null;
}) {
  if (!sensitivity) {
    return (
      <Typography variant="caption" color="text.disabled">
        —
      </Typography>
    );
  }

  const level = Math.max(1, Math.min(LEVELS, Math.round(sensitivity)));
  const where = area ? `${area} · ` : '';
  const title = `${where}${DESCRIPTIONS[level] ?? DESCRIPTIONS[2]}`;

  return (
    <Tooltip title={title} arrow placement="top">
      <Stack
        direction="row"
        spacing={0.4}
        alignItems="center"
        sx={{ cursor: 'default' }}
        aria-label={title}
      >
        {Array.from({ length: LEVELS }, (_, index) => {
          const filled = index < level;
          return (
            <Box
              key={index}
              sx={{
                width: 6,
                height: 6,
                flexShrink: 0,
                boxSizing: 'border-box',
                borderRadius: '50%',
                bgcolor: (theme) =>
                  filled
                    ? alpha(theme.palette.text.primary, 0.55)
                    : 'transparent',
                border: (theme) =>
                  filled
                    ? '1px solid transparent'
                    : `1px solid ${theme.palette.divider}`,
              }}
            />
          );
        })}
      </Stack>
    </Tooltip>
  );
}
