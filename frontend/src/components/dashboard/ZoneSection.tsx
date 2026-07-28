import { useState } from 'react';
import { Box, Collapse, Stack, Typography, alpha } from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import type { ReactNode } from 'react';

export function ZoneSection({
  title,
  caption,
  count,
  action,
  collapsible = false,
  defaultExpanded = true,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  caption?: string;
  count?: number;
  action?: ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  children: ReactNode;
}) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isControlled = expanded !== undefined;
  const open = !collapsible || (isControlled ? expanded : internalExpanded);
  const toggle = () => {
    if (isControlled) {
      onToggle?.();
    } else {
      setInternalExpanded((value) => !value);
    }
  };
  return (
    <Box component="section">
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2} sx={{ mb: 1.5 }}>
        <Box
          onClick={collapsible ? toggle : undefined}
          sx={collapsible ? { cursor: 'pointer', userSelect: 'none' } : undefined}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="subtitle1">{title}</Typography>
            {count !== undefined && count > 0 && (
              <Typography
                variant="caption"
                sx={(theme) => ({
                  fontWeight: 700,
                  px: 1,
                  py: 0.1,
                  borderRadius: 999,
                  bgcolor: alpha(theme.palette.text.primary, 0.08),
                  color: 'text.secondary',
                })}
              >
                {count}
              </Typography>
            )}
            {collapsible && (
              <ExpandMoreRoundedIcon
                sx={{
                  fontSize: 20,
                  color: 'text.secondary',
                  transform: open ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s',
                }}
              />
            )}
          </Stack>
          {caption && (
            <Typography variant="body2" color="text.secondary">
              {caption}
            </Typography>
          )}
        </Box>
        {action}
      </Stack>
      <Collapse in={open} unmountOnExit={false}>
        {children}
      </Collapse>
    </Box>
  );
}
