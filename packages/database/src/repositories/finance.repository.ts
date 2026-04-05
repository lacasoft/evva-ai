import type { CreditCard, BankAccount, Transaction, SavingsGoal, TransactionType } from '@evva/core';
import { generateId } from '@evva/core';
import { query, queryOne } from '../client.js';

// ============================================================
// Credit Cards
// ============================================================

export async function createCreditCard(params: {
  userId: string;
  name: string;
  lastFourDigits: string;
  brand?: string;
  creditLimit?: number;
  cutOffDay: number;
  paymentDueDay: number;
  annualRate?: number;
}): Promise<CreditCard> {
  const id = generateId();
  const row = await queryOne(
    `INSERT INTO credit_cards (id, user_id, name, last_four_digits, brand, credit_limit, cut_off_day, payment_due_day, annual_rate)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [id, params.userId, params.name, params.lastFourDigits, params.brand ?? null,
     params.creditLimit ?? null, params.cutOffDay, params.paymentDueDay, params.annualRate ?? null],
  );
  if (!row) throw new Error('Failed to create credit card');
  return mapToCreditCard(row);
}

export async function getUserCreditCards(userId: string): Promise<CreditCard[]> {
  const rows = await query(
    'SELECT * FROM credit_cards WHERE user_id = $1 AND is_active = true ORDER BY name',
    [userId],
  );
  return rows.map(mapToCreditCard);
}

export async function updateCreditCardBalance(id: string, userId: string, balance: number): Promise<void> {
  await query(
    'UPDATE credit_cards SET current_balance = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
    [balance, id, userId],
  );
}

// ============================================================
// Bank Accounts
// ============================================================

export async function createBankAccount(params: {
  userId: string;
  name: string;
  lastFourDigits?: string;
  currentBalance?: number;
}): Promise<BankAccount> {
  const id = generateId();
  const row = await queryOne(
    `INSERT INTO bank_accounts (id, user_id, name, last_four_digits, current_balance)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, params.userId, params.name, params.lastFourDigits ?? null, params.currentBalance ?? 0],
  );
  if (!row) throw new Error('Failed to create bank account');
  return mapToBankAccount(row);
}

export async function getUserBankAccounts(userId: string): Promise<BankAccount[]> {
  const rows = await query(
    'SELECT * FROM bank_accounts WHERE user_id = $1 AND is_active = true ORDER BY name',
    [userId],
  );
  return rows.map(mapToBankAccount);
}

// ============================================================
// Transactions
// ============================================================

export async function createTransaction(params: {
  userId: string;
  type: TransactionType;
  amount: number;
  currency?: string;
  description: string;
  category: string;
  paymentMethod?: string;
  creditCardId?: string;
  bankAccountId?: string;
  isRecurring?: boolean;
  recurringDay?: number;
  date?: Date;
}): Promise<Transaction> {
  const id = generateId();
  const row = await queryOne(
    `INSERT INTO transactions (id, user_id, type, amount, currency, description, category, payment_method, credit_card_id, bank_account_id, is_recurring, recurring_day, date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [id, params.userId, params.type, params.amount, params.currency ?? 'MXN',
     params.description, params.category, params.paymentMethod ?? null,
     params.creditCardId ?? null, params.bankAccountId ?? null,
     params.isRecurring ?? false, params.recurringDay ?? null,
     params.date?.toISOString() ?? new Date().toISOString()],
  );
  if (!row) throw new Error('Failed to create transaction');
  return mapToTransaction(row);
}

export async function getTransactions(userId: string, params?: {
  type?: TransactionType;
  fromDate?: Date;
  toDate?: Date;
  category?: string;
  limit?: number;
}): Promise<Transaction[]> {
  const conditions = ['user_id = $1'];
  const values: unknown[] = [userId];
  let paramIndex = 2;

  if (params?.type) {
    conditions.push(`type = $${paramIndex++}`);
    values.push(params.type);
  }
  if (params?.fromDate) {
    conditions.push(`date >= $${paramIndex++}`);
    values.push(params.fromDate.toISOString());
  }
  if (params?.toDate) {
    conditions.push(`date <= $${paramIndex++}`);
    values.push(params.toDate.toISOString());
  }
  if (params?.category) {
    conditions.push(`category = $${paramIndex++}`);
    values.push(params.category);
  }

  const limit = params?.limit ?? 50;
  const rows = await query(
    `SELECT * FROM transactions WHERE ${conditions.join(' AND ')} ORDER BY date DESC LIMIT $${paramIndex}`,
    [...values, limit],
  );
  return rows.map(mapToTransaction);
}

export async function getMonthSummary(userId: string, year: number, month: number): Promise<{
  totalIncome: number;
  totalExpense: number;
  balance: number;
  byCategory: Array<{ category: string; total: number }>;
}> {
  const fromDate = new Date(year, month - 1, 1);
  const toDate = new Date(year, month, 0, 23, 59, 59);

  const summaryRows = await query(
    `SELECT type, SUM(amount) as total FROM transactions
     WHERE user_id = $1 AND date >= $2 AND date <= $3
     GROUP BY type`,
    [userId, fromDate.toISOString(), toDate.toISOString()],
  );

  const categoryRows = await query(
    `SELECT category, SUM(amount) as total FROM transactions
     WHERE user_id = $1 AND date >= $2 AND date <= $3 AND type = 'expense'
     GROUP BY category ORDER BY total DESC`,
    [userId, fromDate.toISOString(), toDate.toISOString()],
  );

  const totalIncome = Number(summaryRows.find(r => r.type === 'income')?.total ?? 0);
  const totalExpense = Number(summaryRows.find(r => r.type === 'expense')?.total ?? 0);

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    byCategory: categoryRows.map(r => ({ category: r.category as string, total: Number(r.total) })),
  };
}

// ============================================================
// Savings Goals
// ============================================================

export async function createSavingsGoal(params: {
  userId: string;
  name: string;
  targetAmount: number;
  targetDate?: Date;
}): Promise<SavingsGoal> {
  const id = generateId();
  const row = await queryOne(
    `INSERT INTO savings_goals (id, user_id, name, target_amount, target_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, params.userId, params.name, params.targetAmount, params.targetDate?.toISOString() ?? null],
  );
  if (!row) throw new Error('Failed to create savings goal');
  return mapToSavingsGoal(row);
}

export async function getUserSavingsGoals(userId: string): Promise<SavingsGoal[]> {
  const rows = await query(
    'SELECT * FROM savings_goals WHERE user_id = $1 AND is_completed = false ORDER BY created_at DESC',
    [userId],
  );
  return rows.map(mapToSavingsGoal);
}

export async function updateSavingsGoal(id: string, userId: string, amount: number): Promise<void> {
  await query(
    `UPDATE savings_goals SET current_amount = current_amount + $1, updated_at = NOW(),
     is_completed = (current_amount + $1 >= target_amount)
     WHERE id = $2 AND user_id = $3`,
    [amount, id, userId],
  );
}

// ============================================================
// Mappers
// ============================================================

function mapToCreditCard(d: Record<string, unknown>): CreditCard {
  return {
    id: d.id as string, userId: d.user_id as string, name: d.name as string,
    lastFourDigits: d.last_four_digits as string, brand: d.brand as string | undefined,
    creditLimit: d.credit_limit ? Number(d.credit_limit) : undefined,
    currentBalance: Number(d.current_balance), cutOffDay: d.cut_off_day as number,
    paymentDueDay: d.payment_due_day as number, annualRate: d.annual_rate ? Number(d.annual_rate) : undefined,
    isActive: d.is_active as boolean, createdAt: new Date(d.created_at as string), updatedAt: new Date(d.updated_at as string),
  };
}

function mapToBankAccount(d: Record<string, unknown>): BankAccount {
  return {
    id: d.id as string, userId: d.user_id as string, name: d.name as string,
    lastFourDigits: d.last_four_digits as string | undefined,
    currentBalance: Number(d.current_balance), isActive: d.is_active as boolean,
    createdAt: new Date(d.created_at as string), updatedAt: new Date(d.updated_at as string),
  };
}

function mapToTransaction(d: Record<string, unknown>): Transaction {
  return {
    id: d.id as string, userId: d.user_id as string, type: d.type as TransactionType,
    amount: Number(d.amount), currency: d.currency as string, description: d.description as string,
    category: d.category as Transaction['category'], paymentMethod: d.payment_method as Transaction['paymentMethod'],
    creditCardId: d.credit_card_id as string | undefined, bankAccountId: d.bank_account_id as string | undefined,
    isRecurring: d.is_recurring as boolean, recurringDay: d.recurring_day as number | undefined,
    date: new Date(d.date as string), createdAt: new Date(d.created_at as string), updatedAt: new Date(d.updated_at as string),
  };
}

function mapToSavingsGoal(d: Record<string, unknown>): SavingsGoal {
  return {
    id: d.id as string, userId: d.user_id as string, name: d.name as string,
    targetAmount: Number(d.target_amount), currentAmount: Number(d.current_amount),
    targetDate: d.target_date ? new Date(d.target_date as string) : undefined,
    isCompleted: d.is_completed as boolean,
    createdAt: new Date(d.created_at as string), updatedAt: new Date(d.updated_at as string),
  };
}
