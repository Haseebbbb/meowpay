import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { DashboardPage } from './pages/DashboardPage';
import { HomePage } from './pages/HomePage';
import { theme } from './theme';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
