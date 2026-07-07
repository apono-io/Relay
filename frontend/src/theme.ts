import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#4f46e5' },
    background: { default: '#f7f7fb' },
  },
  typography: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
});
