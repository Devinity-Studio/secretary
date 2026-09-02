/** Shared types for MyDesk */

export type AccountType =
  | 'cash'
  | 'bank'
  | 'credit'
  | 'savings'
  | 'ewallet'
  | 'investment'
  | 'other';

export type TransactionType = 'income' | 'expense' | 'transfer';

export type GoalType = 'savings' | 'habit' | 'quantity' | 'general';

export type MeasurementType = 'cumulative' | 'count_days' | 'streak';

export type GoalStatus =
  | 'active'
  | 'achieved_early'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'failed';

export interface Account {
  id: string;
  ownerId: string;
  name: string;
  accountType: AccountType;
  isShared: boolean;
  currency: string;
  currentBalance: number;
  creditLimit?: number | null;
  targetBalance?: number | null;
  color?: string | null;
  icon?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  title: string;
  note?: string | null;
  amount: number;
  currency: string;
  accountId: string;
  transferAccountId?: string | null;
  transferGroupId?: string | null;
  category?: string | null;
  transactionDate: string;
  goalId?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Goal {
  id: string;
  ownerId: string;
  title: string;
  description?: string | null;
  goalType: GoalType;
  status: GoalStatus;
  measurementType: MeasurementType;
  targetValue: number;
  currentValue: number;
  unit: string;
  totalDays?: number | null;
  minSuccessDays?: number | null;
  startDate: string;
  endDate: string;
  continueAfterAchieved: boolean;
  achievedAt?: string | null;
  isShared: boolean;
  color?: string | null;
  icon?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface GoalContribution {
  id: string;
  goalId: string;
  userId: string;
  amount: number;
  contributionDate: string;
  isSuccess: boolean;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface UserProfile {
  id: string;
  email?: string | null;
  displayName?: string | null;
  isGuest: boolean;
}
