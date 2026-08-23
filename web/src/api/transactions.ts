import { apiClient } from './client';

export type TransactionViewDirection = 'sent' | 'received' | 'topup';

export interface TransactionView {
  id: string;
  type: 'TOPUP' | 'TRANSFER';
  direction: TransactionViewDirection;
  amount: number;
  counterpartyCatId: string | null;
  status: 'completed' | 'failed';
  createdAt: string;
}

export interface MoneyMovementResult {
  transactionId: string;
  newBalance: number;
}

export async function listTransactions(): Promise<TransactionView[]> {
  const response = await apiClient.get<TransactionView[]>('/transactions');
  return response.data;
}

export async function topup(amount: number, idempotencyKey: string): Promise<MoneyMovementResult> {
  const response = await apiClient.post<MoneyMovementResult>('/topups', { amount, idempotencyKey });
  return response.data;
}

export async function transfer(toCatId: string, amount: number, idempotencyKey: string): Promise<MoneyMovementResult> {
  const response = await apiClient.post<MoneyMovementResult>('/transfers', { toCatId, amount, idempotencyKey });
  return response.data;
}
