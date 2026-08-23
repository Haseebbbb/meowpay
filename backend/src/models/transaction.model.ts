import type {
  TRANSACTION_DIRECTION,
  TRANSACTION_STATUS,
  TRANSACTION_TYPE,
  TRANSACTION_VIEW_DIRECTION,
} from '../constants/transaction.constants';

export type TransactionType = (typeof TRANSACTION_TYPE)[keyof typeof TRANSACTION_TYPE];
export type TransactionDirection = (typeof TRANSACTION_DIRECTION)[keyof typeof TRANSACTION_DIRECTION];
export type TransactionStatus = (typeof TRANSACTION_STATUS)[keyof typeof TRANSACTION_STATUS];

// API-facing direction, collapsing type+direction into the one field a
// frontend actually wants — no need to cross-reference `type` itself.
export type TransactionViewDirection = (typeof TRANSACTION_VIEW_DIRECTION)[keyof typeof TRANSACTION_VIEW_DIRECTION];

// Matches the `transactions` ledger table: one row per affected cat. A
// TRANSFER writes two sibling rows (outgoing for the sender, incoming for the
// receiver) sharing one idempotency_key; a TOPUP writes a single incoming row.
export interface Transaction {
  id: string;
  type: TransactionType;
  cat_id: string;
  direction: TransactionDirection;
  counterparty_cat_id: string | null;
  amount: number;
  status: TransactionStatus;
  idempotency_key: string;
  created_at: Date;
  updated_at: Date;
}

export interface NewTransaction {
  type: TransactionType;
  cat_id: string;
  direction: TransactionDirection;
  counterparty_cat_id: string | null;
  amount: number;
  status: TransactionStatus;
  idempotency_key: string;
}

export interface TransactionView {
  id: string;
  type: TransactionType;
  direction: TransactionViewDirection;
  amount: number;
  counterpartyCatId: string | null;
  status: TransactionStatus;
  createdAt: Date;
}

export interface TopupInput {
  amount: number;
  idempotencyKey: string;
}

export interface TransferInput {
  toCatId: string;
  amount: number;
  idempotencyKey: string;
}

export interface MoneyMovementResult {
  transactionId: string;
  newBalance: number;
  /** True when this call replayed an already-processed idempotency key rather than moving money again. */
  replayed: boolean;
}
