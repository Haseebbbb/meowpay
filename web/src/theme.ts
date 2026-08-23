import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#378ADD',
      dark: '#0C447C',
    },
    background: {
      default: '#E6F1FB',
      paper: '#FFFFFF',
    },
  },
  shape: {
    borderRadius: 16,
  },
  typography: {
    fontWeightMedium: 500,
    // MUI resolves the 'bold' sx/variant shorthand through this token — pinning
    // it to the same weight as medium is what actually keeps 700 out of the
    // theme, rather than just not setting it anywhere ourselves.
    fontWeightBold: 500,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
        },
      },
    },
  },
});

export default theme;
