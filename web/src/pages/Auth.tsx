import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PetsIcon from '@mui/icons-material/Pets';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Collapse,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { login, signup } from '../api/auth';
import { TOKEN_STORAGE_KEY } from '../api/client';
import { extractErrorMessage } from '../api/errors';

type Mode = 'login' | 'signup';

export function Auth() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleModeChange(_event: React.MouseEvent<HTMLElement>, next: Mode | null) {
    if (next) {
      setMode(next);
      setError(null);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = mode === 'signup' ? await signup(name, email, password) : await login(email, password);

      localStorage.setItem(TOKEN_STORAGE_KEY, result.token);
      navigate('/dashboard');
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 400, p: '28px' }}>
        <Stack spacing={0.5} sx={{ alignItems: 'center', mb: 3 }}>
          <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main', mb: 1 }}>
            <PetsIcon sx={{ color: '#fff' }} />
          </Avatar>
          <Typography variant="h5" sx={{ fontWeight: (theme) => theme.typography.fontWeightMedium }}>
            MeowPay
          </Typography>
          <Typography variant="body2" color="text.secondary">
            treats, transferred with care
          </Typography>
        </Stack>

        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={handleModeChange}
          fullWidth
          sx={{
            bgcolor: 'background.default',
            borderRadius: 999,
            p: 0.5,
            mb: 3,
            '& .MuiToggleButtonGroup-grouped': {
              border: 0,
              borderRadius: 999,
              textTransform: 'none',
              fontWeight: (theme) => theme.typography.fontWeightMedium,
              color: 'primary.dark',
            },
            '& .MuiToggleButtonGroup-grouped.Mui-selected': {
              bgcolor: 'primary.main',
              color: '#fff',
            },
            '& .MuiToggleButtonGroup-grouped.Mui-selected:hover': {
              bgcolor: 'primary.main',
            },
          }}
        >
          <ToggleButton value="login">Log in</ToggleButton>
          <ToggleButton value="signup">Sign up</ToggleButton>
        </ToggleButtonGroup>

        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <Collapse in={mode === 'signup'}>
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  Name
                </Typography>
                <TextField
                  fullWidth
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required={mode === 'signup'}
                />
              </Stack>
            </Collapse>

            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary">
                Email
              </Typography>
              <TextField
                fullWidth
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Stack>

            <Stack spacing={0.5}>
              <Typography variant="body2" color="text.secondary">
                Pawsword
              </Typography>
              <TextField
                fullWidth
                type="password"
                name="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </Stack>

            {error && <Alert severity="error">{error}</Alert>}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={isSubmitting}
              endIcon={<ArrowForwardIcon />}
              sx={{ mt: 1 }}
            >
              {mode === 'login' ? 'Log in' : 'Sign up'}
            </Button>
          </Stack>
        </Box>
      </Card>
    </Box>
  );
}
