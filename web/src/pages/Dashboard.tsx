import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlined';
import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import LogoutIcon from '@mui/icons-material/Logout';
import PetsIcon from '@mui/icons-material/Pets';
import SendIcon from '@mui/icons-material/Send';
import SettingsIcon from '@mui/icons-material/Settings';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getMe, type MeResult } from '../api/cats';
import { TOKEN_STORAGE_KEY } from '../api/client';
import { extractErrorMessage } from '../api/errors';
import { listTransactions, type TransactionView } from '../api/transactions';
import { TopupModal } from '../components/TopupModal';
import { TransferModal } from '../components/TransferModal';
import { getInitials } from '../utils/initials';

function transactionIcon(direction: TransactionView['direction']) {
  if (direction === 'sent') return <ArrowUpwardIcon fontSize="small" sx={{ color: '#fff' }} />;
  if (direction === 'received') return <ArrowDownwardIcon fontSize="small" sx={{ color: '#fff' }} />;
  return <AddCircleOutlineIcon fontSize="small" sx={{ color: '#fff' }} />;
}

function transactionLabel(direction: TransactionView['direction']) {
  if (direction === 'sent') return 'Sent';
  if (direction === 'received') return 'Received';
  return 'Top up';
}

export function Dashboard() {
  const navigate = useNavigate();

  const [me, setMe] = useState<MeResult | null>(null);
  const [transactions, setTransactions] = useState<TransactionView[]>([]);
  const [balanceVisible, setBalanceVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isTopupOpen, setIsTopupOpen] = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [meResult, transactionsResult] = await Promise.all([getMe(), listTransactions()]);
      setMe(meResult);
      setTransactions(transactionsResult);
      setLoadError(null);
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        navigate('/');
        return;
      }
      setLoadError(extractErrorMessage(error, "Couldn't load your data. Try refreshing."));
    }
  }, [navigate]);

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_STORAGE_KEY)) {
      navigate('/');
      return;
    }
    void loadData();
  }, [loadData, navigate]);

  async function handleRefresh() {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  }

  function handleLogout() {
    // Frontend-only: JWTs are stateless and there's no server-side session to
    // invalidate, so "logging out" is just discarding the local token.
    setSettingsAnchor(null);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    navigate('/');
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
      <Card sx={{ width: '100%', maxWidth: 420, p: '22px' }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Avatar sx={{ bgcolor: 'primary.main' }}>{me ? getInitials(me.name) : '..'}</Avatar>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <PetsIcon fontSize="small" sx={{ color: 'primary.main' }} />
              <Typography variant="body1">Hi, {me?.name ?? '...'}</Typography>
            </Stack>
          </Stack>
          <IconButton
            aria-label="Settings"
            onClick={(event) => setSettingsAnchor(event.currentTarget)}
          >
            <SettingsIcon />
          </IconButton>
          <Menu anchorEl={settingsAnchor} open={Boolean(settingsAnchor)} onClose={() => setSettingsAnchor(null)}>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Log out
            </MenuItem>
          </Menu>
        </Stack>

        {loadError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {loadError}
          </Alert>
        )}

        <Card variant="outlined" sx={{ textAlign: 'center', py: 2, mb: 2, borderColor: 'transparent' }}>
          <Typography variant="body2" color="text.secondary">
            Treat balance
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: (theme) => theme.typography.fontWeightMedium, my: 1 }}>
            {balanceVisible ? (me?.balance ?? 0) : '•••••'}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'center' }}>
            <Button size="small" onClick={() => setBalanceVisible((visible) => !visible)}>
              {balanceVisible ? 'Hide' : 'Show'}
            </Button>
            <Button size="small" onClick={() => void handleRefresh()} disabled={isRefreshing}>
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
          </Stack>
        </Card>

        <Stack direction="row" spacing={1.5} sx={{ mb: 3 }}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<SendIcon />}
            onClick={() => setIsTransferOpen(true)}
          >
            Send
          </Button>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setIsTopupOpen(true)}
          >
            Top up
          </Button>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Recent transactions
        </Typography>
        <Stack spacing={1}>
          {transactions.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              No transactions yet.
            </Typography>
          )}
          {transactions.map((transaction) => {
            const isPositive = transaction.direction !== 'sent';
            return (
              <Card
                key={transaction.id}
                variant="outlined"
                sx={{
                  borderColor: 'transparent',
                  p: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  <Avatar
                    sx={{
                      width: 32,
                      height: 32,
                      bgcolor: isPositive ? 'success.main' : 'error.main',
                    }}
                  >
                    {transactionIcon(transaction.direction)}
                  </Avatar>
                  <Typography variant="body2">{transactionLabel(transaction.direction)}</Typography>
                </Stack>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: (theme) => theme.typography.fontWeightMedium,
                    color: isPositive ? 'success.main' : 'error.main',
                  }}
                >
                  {isPositive ? '+' : '-'}
                  {transaction.amount}
                </Typography>
              </Card>
            );
          })}
        </Stack>
      </Card>

      <TransferModal open={isTransferOpen} onClose={() => setIsTransferOpen(false)} onSuccess={loadData} />
      <TopupModal open={isTopupOpen} onClose={() => setIsTopupOpen(false)} onSuccess={loadData} />
    </Box>
  );
}
