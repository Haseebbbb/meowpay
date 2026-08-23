import CloseIcon from '@mui/icons-material/Close';
import PetsIcon from '@mui/icons-material/Pets';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';

import { type CatSummary, searchCats } from '../api/cats';
import { extractErrorMessage } from '../api/errors';
import { transfer } from '../api/transactions';
import { getInitials } from '../utils/initials';

const SEARCH_DEBOUNCE_MS = 300;

interface TransferModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function TransferModal({ open, onClose, onSuccess }: TransferModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatSummary[]>([]);
  const [selected, setSelected] = useState<CatSummary | null>(null);
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selected || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      searchCats(query.trim())
        .then(setResults)
        .catch(() => setResults([]));
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [query, selected]);

  function handleClose() {
    setQuery('');
    setResults([]);
    setSelected(null);
    setAmount('');
    setError(null);
    onClose();
  }

  async function handleSubmit() {
    if (!selected) {
      setError('Pick a recipient first.');
      return;
    }
    const amountNumber = Number(amount);
    if (!Number.isInteger(amountNumber) || amountNumber <= 0) {
      setError('Enter a whole number of treats greater than 0.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      // Fresh per attempt: a retry after a real failure is a new attempt, not
      // a resend of the last one.
      await transfer(selected.id, amountNumber, crypto.randomUUID());
      onSuccess();
      handleClose();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      slotProps={{ paper: { sx: { borderRadius: '18px', maxWidth: 400, width: '100%' } } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Send treats
        <IconButton onClick={handleClose} size="small" aria-label="Close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary">
              Search by name or email
            </Typography>
            {selected ? (
              <Box
                sx={{
                  bgcolor: 'background.default',
                  borderRadius: 2,
                  p: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
                    {getInitials(selected.name)}
                  </Avatar>
                  <Stack spacing={0}>
                    <Typography variant="body2">{selected.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {selected.email}
                    </Typography>
                  </Stack>
                </Stack>
                <IconButton size="small" onClick={() => setSelected(null)} aria-label="Change recipient">
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            ) : (
              <>
                <TextField
                  fullWidth
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Type at least 2 characters"
                />
                {results.length > 0 && (
                  <List sx={{ bgcolor: 'background.default', borderRadius: 2, py: 0 }}>
                    {results.map((cat) => (
                      <ListItemButton
                        key={cat.id}
                        onClick={() => {
                          setSelected(cat);
                          setQuery('');
                        }}
                        sx={{ borderRadius: 2 }}
                      >
                        <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32, mr: 1.5 }}>
                          {getInitials(cat.name)}
                        </Avatar>
                        <Stack spacing={0}>
                          <Typography variant="body2">{cat.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {cat.email}
                          </Typography>
                        </Stack>
                      </ListItemButton>
                    ))}
                  </List>
                )}
              </>
            )}
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary">
              Amount
            </Typography>
            <TextField
              fullWidth
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </Stack>

          {error && <Alert severity="error">{error}</Alert>}

          <Button
            fullWidth
            variant="contained"
            startIcon={<PetsIcon />}
            disabled={isSubmitting}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? 'Sending…' : 'Send treats'}
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
