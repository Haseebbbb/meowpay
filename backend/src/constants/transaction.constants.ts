export const TRANSACTION_TYPE = {
  TOPUP: 'TOPUP',
  TRANSFER: 'TRANSFER',
} as const;

export const TRANSACTION_DIRECTION = {
  INCOMING: 'incoming',
  OUTGOING: 'outgoing',
} as const;

export const TRANSACTION_STATUS = {
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

// The API-facing direction returned by GET /transactions — distinct from
// TRANSACTION_DIRECTION, which is the DB column (incoming/outgoing only).
export const TRANSACTION_VIEW_DIRECTION = {
  SENT: 'sent',
  RECEIVED: 'received',
  TOPUP: 'topup',
} as const;
