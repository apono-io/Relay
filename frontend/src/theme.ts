import { createTheme, alpha, type Theme } from '@mui/material/styles';

export type ColorMode = 'light' | 'dark';

export const CHART_PALETTE = ['#3b82f6', '#f59e0b', '#f43f5e', '#10b981', '#06b6d4', '#64748b'];

const shared = {
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700, letterSpacing: '-0.01em' },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { textTransform: 'none' as const, fontWeight: 600 },
  },
};

const palettes = {
  dark: {
    mode: 'dark' as const,
    primary: { main: '#3b82f6' },
    secondary: { main: '#06b6d4' },
    success: { main: '#10b981' },
    warning: { main: '#f59e0b' },
    error: { main: '#ef4444' },
    background: { default: '#0d1117', paper: '#161b22' },
    text: { primary: '#e6edf3', secondary: '#9198a1' },
    divider: 'rgba(145,152,161,0.16)',
  },
  light: {
    mode: 'light' as const,
    primary: { main: '#2563eb' },
    secondary: { main: '#0891b2' },
    success: { main: '#059669' },
    warning: { main: '#d97706' },
    error: { main: '#dc2626' },
    background: { default: '#f6f8fa', paper: '#ffffff' },
    text: { primary: '#1f2328', secondary: '#59636e' },
    divider: 'rgba(31,35,40,0.12)',
  },
};

export function createAppTheme(mode: ColorMode): Theme {
  const isDark = mode === 'dark';
  return createTheme({
    ...shared,
    palette: palettes[mode],
    components: {
      MuiCssBaseline: {
        styleOverrides: { body: { colorScheme: mode } },
      },
      MuiCard: {
        defaultProps: { variant: 'outlined', elevation: 0 },
        styleOverrides: {
          root: {
            borderRadius: 16,
            backgroundImage: 'none',
            boxShadow: isDark ? '0 1px 2px rgba(0,0,0,0.4)' : '0 1px 3px rgba(15,23,42,0.06)',
          },
        },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0, color: 'transparent' },
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.background.paper,
            borderBottom: `1px solid ${theme.palette.divider}`,
            backdropFilter: 'saturate(180%) blur(6px)',
          }),
        },
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 600 } },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: ({ theme }) => ({
            backgroundColor: theme.palette.background.default,
            borderRight: `1px solid ${theme.palette.divider}`,
            backgroundImage: 'none',
          }),
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            '& .MuiListItemText-primary': { fontWeight: 600, fontSize: 14 },
            '&.Mui-selected': {
              backgroundColor: alpha(theme.palette.primary.main, 0.14),
              '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.2) },
            },
          }),
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderColor: theme.palette.divider,
            fontVariantNumeric: 'tabular-nums',
          }),
          head: ({ theme }) => ({
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.02em',
            color: theme.palette.text.secondary,
          }),
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: ({ theme }) => ({
            '&.MuiTableRow-hover:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.05),
            },
            '&:last-child td': { borderBottom: 'none' },
          }),
        },
      },
      MuiLink: {
        styleOverrides: {
          root: { fontVariantNumeric: 'tabular-nums' },
        },
      },
    },
  });
}
