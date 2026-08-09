import { createTheme, alpha, type Theme } from '@mui/material/styles';

export type ColorMode = 'light' | 'dark';

export type SidebarTokens = {
  bg: string;
  border: string;
  text: string;
  textHover: string;
  hoverBg: string;
  selectedBg: string;
  selectedHoverBg: string;
  selectedText: string;
  groupLabel: string;
  divider: string;
  title: string;
};

export function sidebarTokens(mode: ColorMode): SidebarTokens {
  if (mode === 'dark') {
    return {
      bg: '#0b0f16',
      border: 'rgba(148,163,184,0.12)',
      text: '#8f99a8',
      textHover: '#e2e8f0',
      hoverBg: 'rgba(148,163,184,0.08)',
      selectedBg: 'rgba(96,165,250,0.14)',
      selectedHoverBg: 'rgba(96,165,250,0.2)',
      selectedText: '#8ab7ff',
      groupLabel: '#5c6675',
      divider: 'rgba(148,163,184,0.1)',
      title: '#f1f5f9',
    };
  }
  return {
    bg: '#1c2534',
    border: 'rgba(15,23,42,0.18)',
    text: 'rgba(203,213,225,0.72)',
    textHover: '#f1f5f9',
    hoverBg: 'rgba(148,163,184,0.12)',
    selectedBg: 'rgba(122,167,255,0.18)',
    selectedHoverBg: 'rgba(122,167,255,0.26)',
    selectedText: '#a8c7ff',
    groupLabel: 'rgba(148,163,184,0.6)',
    divider: 'rgba(255,255,255,0.08)',
    title: '#f8fafc',
  };
}

const shared = {
  shape: { borderRadius: 10 },
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
    primary: { main: '#4493f8' },
    secondary: { main: '#8b949e' },
    success: { main: '#3fb950' },
    warning: { main: '#d29922' },
    error: { main: '#f85149' },
    background: { default: '#0d1117', paper: '#151b23' },
    text: { primary: '#e6edf3', secondary: '#98a1ab', disabled: '#5c6675' },
    divider: 'rgba(148,163,184,0.14)',
    action: {
      hover: 'rgba(148,163,184,0.07)',
      selected: 'rgba(148,163,184,0.12)',
    },
  },
  light: {
    mode: 'light' as const,
    primary: { main: '#0969da' },
    secondary: { main: '#59636e' },
    success: { main: '#1a7f37' },
    warning: { main: '#9a6700' },
    error: { main: '#cf222e' },
    background: { default: '#f6f8fa', paper: '#ffffff' },
    text: { primary: '#1f2328', secondary: '#59636e', disabled: '#8c959f' },
    divider: 'rgba(31,35,40,0.12)',
    action: {
      hover: 'rgba(31,35,40,0.045)',
      selected: 'rgba(31,35,40,0.08)',
    },
  },
};

export function createAppTheme(mode: ColorMode): Theme {
  const isDark = mode === 'dark';
  const sidebar = sidebarTokens(mode);
  return createTheme({
    ...shared,
    palette: palettes[mode],
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { colorScheme: mode },
          '*::-webkit-scrollbar': { width: 10, height: 10 },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor: isDark ? 'rgba(148,163,184,0.25)' : 'rgba(31,35,40,0.2)',
            borderRadius: 8,
            border: '2px solid transparent',
            backgroundClip: 'content-box',
          },
        },
      },
      MuiCard: {
        defaultProps: { variant: 'outlined', elevation: 0 },
        styleOverrides: {
          root: {
            borderRadius: 12,
            backgroundImage: 'none',
            borderColor: isDark ? 'rgba(148,163,184,0.14)' : 'rgba(31,35,40,0.12)',
            boxShadow: isDark ? 'none' : '0 1px 2px rgba(16,24,40,0.04)',
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 8 },
          outlined: ({ theme }) => ({
            borderColor: theme.palette.divider,
            '&:hover': {
              borderColor: alpha(theme.palette.primary.main, 0.5),
              backgroundColor: alpha(theme.palette.primary.main, 0.05),
            },
          }),
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
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            fontSize: 12,
            fontWeight: 500,
            backgroundColor: isDark ? '#2d3644' : '#1f2937',
            paddingInline: 10,
            paddingBlock: 5,
            borderRadius: 6,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: sidebar.bg,
            borderRight: `1px solid ${sidebar.border}`,
            backgroundImage: 'none',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { backgroundImage: 'none', borderRadius: 14 },
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
