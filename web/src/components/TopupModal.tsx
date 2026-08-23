import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import { Alert, Box, Button, Dialog, DialogContent, DialogTitle, IconButton, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';

import { extractErrorMessage } from '../api/errors';
import { topup } from '../api/transactions';

interface TopupModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function TopupModal({ open, onClose, onSuccess }: TopupModalProps) {
  const [amount, setAmount] = useState('');
  // Decorative only — never read or sent anywhere.
  const [cardNumber, setCardNumber] = useState('');
  const [cvc, setCvc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setAmount('');
    setCardNumber('');
    setCvc('');
    setError(null);
    onClose();
  }

  async function handleSubmit() {
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
      await topup(amountNumber, crypto.randomUUID());
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
        Top up treats
        <IconButton onClick={handleClose} size="small" aria-label="Close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Box
            sx={{
              background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              color: '#fff',
              borderRadius: 3,
              p: 2,
            }}
          >
            <Typography variant="h6" sx={{ letterSpacing: 2, mb: 3 }}>
              •••• •••• •••• 1234
            </Typography>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography variant="caption">MEOW CAT</Typography>
              <Typography variant="caption">12/29</Typography>
            </Stack>
          </Box>

          <Stack direction="row" spacing={1.5}>
            <TextField
              fullWidth
              label="Card number"
              placeholder="•••• •••• •••• ••••"
              value={cardNumber}
              onChange={(event) => setCardNumber(event.target.value)}
            />
            <TextField
              sx={{ maxWidth: 100 }}
              label="CVC"
              placeholder="•••"
              value={cvc}
              onChange={(event) => setCvc(event.target.value)}
            />
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="body2" color="text.secondary">
              Treats to add
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
            startIcon={<AddIcon />}
            disabled={isSubmitting}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? 'Adding…' : 'Add treats'}
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
