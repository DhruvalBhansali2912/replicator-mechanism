import { v4 as uuidv4 } from 'uuid';
import { AppDatabase, getDb } from '../db/database.js';

export interface TokenBalanceSummary {
  userId: string;
  current_balance: number;
  reserved_tokens: number;
  available_tokens: number;
}

export interface LedgerEntry {
  id: string;
  user_id: string;
  project_id: string | null;
  job_id: string | null;
  operation: string;
  type: 'purchase' | 'grant' | 'reservation' | 'consumption' | 'refund' | 'expiration' | 'adjustment';
  amount: number;
  balance_before: number;
  balance_after: number;
  status: string;
  metadata: string | null;
  created_at: string;
}

export interface UsageRecord {
  id: string;
  user_id: string;
  project_id: string | null;
  job_id: string | null;
  operation: string;
  tokens_used: number;
  created_at: string;
}

export class TokenService {
  private db: AppDatabase;

  constructor(db?: AppDatabase) {
    this.db = db || getDb();
  }

  /**
   * Retrieves server-authoritative token summary for a user.
   * current_balance: net settled balance (grants + refunds + adjustments - consumptions)
   * reserved_tokens: sum of active pending reservations
   * available_tokens: current_balance - reserved_tokens
   */
  public getUserBalance(userId: string): TokenBalanceSummary {
    const rawDb = this.db.getRawDb();

    // 1. Calculate current settled balance from immutable ledger
    // Grants, purchases, adjustments add; consumptions subtract.
    const balanceStmt = rawDb.prepare(`
      SELECT 
        COALESCE(SUM(
          CASE 
            WHEN type IN ('purchase', 'grant', 'adjustment') THEN amount
            WHEN type = 'consumption' THEN -amount
            ELSE 0
          END
        ), 0) AS current_balance
      FROM token_ledger
      WHERE user_id = ? AND status = 'completed'
    `);
    const balanceRow = balanceStmt.get(userId) as { current_balance: number };
    const current_balance = Math.max(0, Number(balanceRow?.current_balance || 0));

    // 2. Calculate pending reservations
    const reservedStmt = rawDb.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS reserved_tokens
      FROM token_reservations
      WHERE user_id = ? AND status = 'pending'
    `);
    const reservedRow = reservedStmt.get(userId) as { reserved_tokens: number };
    const reserved_tokens = Math.max(0, Number(reservedRow?.reserved_tokens || 0));

    const available_tokens = Math.max(0, current_balance - reserved_tokens);

    return {
      userId,
      current_balance,
      reserved_tokens,
      available_tokens,
    };
  }

  /**
   * Grants or purchases tokens for a user.
   * Records an immutable entry in token_ledger.
   */
  public grantTokens(
    userId: string,
    amount: number,
    operation: string = 'grant',
    metadata?: Record<string, any>
  ): { ledgerId: string; newBalance: number } {
    if (amount <= 0) {
      throw new Error('Token grant amount must be greater than zero.');
    }

    return this.db.transaction(() => {
      const summary = this.getUserBalance(userId);
      const balanceBefore = summary.current_balance;
      const balanceAfter = balanceBefore + amount;
      const now = new Date().toISOString();
      const ledgerId = `tx_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

      const stmt = this.db.prepare(`
        INSERT INTO token_ledger (
          id, user_id, project_id, job_id, operation, type, amount, balance_before, balance_after, status, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        ledgerId,
        userId,
        metadata?.projectId || null,
        metadata?.jobId || null,
        operation,
        'grant',
        amount,
        balanceBefore,
        balanceAfter,
        'completed',
        metadata ? JSON.stringify(metadata) : null,
        now
      );

      return { ledgerId, newBalance: balanceAfter };
    });
  }

  /**
   * Reserves tokens for an operation before job execution.
   * Atomically verifies available balance and creates pending reservation.
   */
  public reserveTokens(
    userId: string,
    jobId: string,
    operation: string,
    estimatedCost: number,
    projectId?: string | null,
    metadata?: Record<string, any>
  ): { reservationId: string; reservedAmount: number; availableTokensAfter: number } {
    if (estimatedCost <= 0) {
      throw new Error('Estimated reservation cost must be greater than zero.');
    }

    return this.db.transaction(() => {
      // Check existing reservation for this job to prevent duplicate reservations
      const existingStmt = this.db.prepare(`
        SELECT id FROM token_reservations WHERE job_id = ? AND status = 'pending'
      `);
      const existing = existingStmt.get(jobId) as { id: string } | undefined;
      if (existing) {
        throw new Error(`Active token reservation already exists for job ${jobId}`);
      }

      const summary = this.getUserBalance(userId);
      if (summary.available_tokens < estimatedCost) {
        throw new Error(
          `INSUFFICIENT_TOKENS: Operation '${operation}' requires ${estimatedCost} tokens, but user only has ${summary.available_tokens} available (${summary.current_balance} total, ${summary.reserved_tokens} reserved).`
        );
      }

      const now = new Date().toISOString();
      const reservationId = `res_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
      const ledgerId = `tx_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

      // 1. Insert into token_reservations
      const resStmt = this.db.prepare(`
        INSERT INTO token_reservations (id, user_id, job_id, amount, status, expires_at, created_at)
        VALUES (?, ?, ?, ?, 'pending', datetime('now', '+2 hours'), ?)
      `);
      resStmt.run(reservationId, userId, jobId, estimatedCost, now);

      // 2. Record reservation in immutable ledger
      const ledgerStmt = this.db.prepare(`
        INSERT INTO token_ledger (
          id, user_id, project_id, job_id, operation, type, amount, balance_before, balance_after, status, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, 'reservation', ?, ?, ?, 'completed', ?, ?)
      `);
      ledgerStmt.run(
        ledgerId,
        userId,
        projectId || null,
        jobId,
        operation,
        estimatedCost,
        summary.current_balance,
        summary.current_balance, // balance unchanged until settled, but reservation limits available
        JSON.stringify({ ...metadata, reservationId }),
        now
      );

      return {
        reservationId,
        reservedAmount: estimatedCost,
        availableTokensAfter: summary.available_tokens - estimatedCost,
      };
    });
  }

  /**
   * Settles a token reservation after operation execution.
   * Deducts actual tokens used, refunds unused reservation, and records usage.
   */
  public settleReservation(
    reservationId: string,
    actualUsage: number,
    metadata?: Record<string, any>
  ): {
    settled: boolean;
    actualUsage: number;
    refundedAmount: number;
    finalBalance: number;
  } {
    return this.db.transaction(() => {
      const resStmt = this.db.prepare(`
        SELECT id, user_id, job_id, amount, status, created_at
        FROM token_reservations
        WHERE id = ?
      `);
      const reservation = resStmt.get(reservationId) as {
        id: string;
        user_id: string;
        job_id: string;
        amount: number;
        status: string;
      } | undefined;

      if (!reservation) {
        throw new Error(`Token reservation ${reservationId} not found.`);
      }

      if (reservation.status !== 'pending') {
        throw new Error(`Token reservation ${reservationId} is already ${reservation.status}.`);
      }

      const userId = reservation.user_id;
      const reservedAmount = reservation.amount;
      const consumedAmount = Math.max(0, actualUsage);
      const refundedAmount = Math.max(0, reservedAmount - consumedAmount);
      const now = new Date().toISOString();

      const summary = this.getUserBalance(userId);
      const balanceBefore = summary.current_balance;
      const balanceAfter = Math.max(0, balanceBefore - consumedAmount);

      // 1. Mark reservation as settled
      const updateResStmt = this.db.prepare(`
        UPDATE token_reservations SET status = 'settled' WHERE id = ?
      `);
      updateResStmt.run(reservationId);

      // 2. Record consumption in immutable ledger
      if (consumedAmount > 0) {
        const consumeTxId = `tx_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
        const consumeStmt = this.db.prepare(`
          INSERT INTO token_ledger (
            id, user_id, project_id, job_id, operation, type, amount, balance_before, balance_after, status, metadata, created_at
          ) VALUES (?, ?, ?, ?, ?, 'consumption', ?, ?, ?, 'completed', ?, ?)
        `);
        consumeStmt.run(
          consumeTxId,
          userId,
          metadata?.projectId || null,
          reservation.job_id,
          metadata?.operation || 'reconstruction',
          consumedAmount,
          balanceBefore,
          balanceAfter,
          JSON.stringify({ ...metadata, reservationId }),
          now
        );

        // 3. Record in usage table
        const usageId = `usg_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
        const usageStmt = this.db.prepare(`
          INSERT INTO usage (id, user_id, project_id, job_id, operation, tokens_used, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        usageStmt.run(
          usageId,
          userId,
          metadata?.projectId || null,
          reservation.job_id,
          metadata?.operation || 'reconstruction',
          consumedAmount,
          now
        );
      }

      // 4. Record refund transaction in ledger if tokens were unreserved
      if (refundedAmount > 0) {
        const refundTxId = `tx_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
        const refundStmt = this.db.prepare(`
          INSERT INTO token_ledger (
            id, user_id, project_id, job_id, operation, type, amount, balance_before, balance_after, status, metadata, created_at
          ) VALUES (?, ?, ?, ?, ?, 'refund', ?, ?, ?, 'completed', ?, ?)
        `);
        refundStmt.run(
          refundTxId,
          userId,
          metadata?.projectId || null,
          reservation.job_id,
          metadata?.operation || 'reconstruction_refund',
          refundedAmount,
          balanceAfter,
          balanceAfter,
          JSON.stringify({ ...metadata, reservationId, refundedUnused: refundedAmount }),
          now
        );
      }

      return {
        settled: true,
        actualUsage: consumedAmount,
        refundedAmount,
        finalBalance: balanceAfter,
      };
    });
  }

  /**
   * Releases/cancels a reservation without deducting tokens (e.g. on early failure or cancellation).
   */
  public releaseReservation(reservationId: string, reason: string = 'job_cancelled'): void {
    this.db.transaction(() => {
      const resStmt = this.db.prepare(`
        SELECT id, user_id, job_id, amount, status FROM token_reservations WHERE id = ?
      `);
      const reservation = resStmt.get(reservationId) as {
        id: string;
        user_id: string;
        job_id: string;
        amount: number;
        status: string;
      } | undefined;

      if (!reservation || reservation.status !== 'pending') {
        return;
      }

      // Update reservation status to refunded
      const updateStmt = this.db.prepare(`UPDATE token_reservations SET status = 'refunded' WHERE id = ?`);
      updateStmt.run(reservationId);

      // Record compensating transaction in immutable ledger
      const summary = this.getUserBalance(reservation.user_id);
      const refundTxId = `tx_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
      const ledgerStmt = this.db.prepare(`
        INSERT INTO token_ledger (
          id, user_id, project_id, job_id, operation, type, amount, balance_before, balance_after, status, metadata, created_at
        ) VALUES (?, ?, ?, ?, 'reservation_release', 'refund', ?, ?, ?, 'completed', ?, datetime('now'))
      `);
      ledgerStmt.run(
        refundTxId,
        reservation.user_id,
        null,
        reservation.job_id,
        reservation.amount,
        summary.current_balance,
        summary.current_balance,
        JSON.stringify({ reason, reservationId })
      );
    });
  }

  /**
   * Queries immutable ledger history for a user.
   */
  public getLedgerHistory(userId: string, limit: number = 50): LedgerEntry[] {
    const stmt = this.db.prepare(`
      SELECT id, user_id, project_id, job_id, operation, type, amount, balance_before, balance_after, status, metadata, created_at
      FROM token_ledger
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(userId, limit) as unknown as LedgerEntry[];
  }

  /**
   * Queries usage records for reporting and billing.
   */
  public getUsageHistory(userId: string, limit: number = 50): UsageRecord[] {
    const stmt = this.db.prepare(`
      SELECT id, user_id, project_id, job_id, operation, tokens_used, created_at
      FROM usage
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(userId, limit) as unknown as UsageRecord[];
  }
}

export const tokenService = new TokenService();
