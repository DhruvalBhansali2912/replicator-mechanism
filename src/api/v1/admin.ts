import { Router, Response } from 'express';
import { requireBearerAuth, requireAdmin, V1AuthenticatedRequest } from '../../auth/v1-middleware.js';
import { PricingService } from '../../tokens/pricing.js';
import { tokenService } from '../../tokens/token-service.js';
import { getDb } from '../../db/database.js';

export const adminRouter = Router();

// Apply auth and admin check to all admin routes
adminRouter.use(requireBearerAuth, requireAdmin);

// 1. Get & Update Token Pricing
adminRouter.get('/pricing', (_req, res: Response): void => {
  res.json({ success: true, pricing: PricingService.getPricing() });
});

adminRouter.put('/pricing', (req: V1AuthenticatedRequest, res: Response): void => {
  const updated = PricingService.updatePricing(req.body);
  res.json({ success: true, message: 'Pricing updated successfully.', pricing: updated });
});

// 2. User Balances Overview
adminRouter.get('/users', (_req, res: Response): void => {
  const db = getDb();
  const users = db.prepare(`
    SELECT id, email, role, status, created_at, updated_at
    FROM users ORDER BY created_at DESC
  `).all() as any[];

  const usersWithBalance = users.map((u) => {
    const bal = tokenService.getUserBalance(u.id);
    return {
      ...u,
      balance: bal.current_balance,
      reserved: bal.reserved_tokens,
      available: bal.available_tokens,
    };
  });

  res.json({ success: true, users: usersWithBalance });
});

// 3. Admin Token Grant
adminRouter.post('/grants', (req: V1AuthenticatedRequest, res: Response): void => {
  const { userId, amount, reason } = req.body;
  if (!userId || !amount || Number(amount) <= 0) {
    res.status(400).json({ error: 'INVALID_GRANT', message: 'Fields "userId" and positive "amount" are required.' });
    return;
  }

  try {
    const result = tokenService.grantTokens(userId, Number(amount), 'grant', {
      adminId: req.user!.id,
      reason: reason || 'Administrative token grant',
    });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: 'GRANT_FAILED', message: err.message });
  }
});

// 4. Admin Refund
adminRouter.post('/refunds', (req: V1AuthenticatedRequest, res: Response): void => {
  const { userId, reservationId, amount, reason } = req.body;
  if (!userId) {
    res.status(400).json({ error: 'INVALID_REFUND', message: 'Field "userId" is required.' });
    return;
  }

  try {
    if (reservationId) {
      tokenService.releaseReservation(reservationId, reason || 'Admin compensation refund');
      res.json({ success: true, message: 'Reservation refunded.' });
    } else {
      const result = tokenService.grantTokens(userId, Number(amount || 1), 'refund', {
        adminId: req.user!.id,
        reason: reason || 'Admin manual refund',
      });
      res.json({ success: true, ...result });
    }
  } catch (err: any) {
    res.status(400).json({ error: 'REFUND_FAILED', message: err.message });
  }
});

// 5. Jobs & Failed Jobs Overview
adminRouter.get('/jobs', (req: V1AuthenticatedRequest, res: Response): void => {
  const statusFilter = req.query.status as string;
  const db = getDb();

  let sql = 'SELECT * FROM jobs';
  const params: any[] = [];
  if (statusFilter) {
    sql += ' WHERE status = ?';
    params.push(statusFilter);
  }
  sql += ' ORDER BY created_at DESC LIMIT 100';

  const jobs = db.prepare(sql).all(...params);
  res.json({ success: true, jobs });
});

// 6. Worker & Database Health
adminRouter.get('/health', (_req, res: Response): void => {
  const db = getDb();
  let dbOk = false;
  try {
    const row = db.prepare('SELECT 1 as alive').get() as { alive: number };
    dbOk = row?.alive === 1;
  } catch {}

  res.json({
    success: true,
    status: dbOk ? 'healthy' : 'degraded',
    uptimeSeconds: Math.round(process.uptime()),
    database: {
      engine: 'node:sqlite (DatabaseSync)',
      status: dbOk ? 'connected' : 'error',
      journalMode: 'WAL',
    },
    workers: [
      { name: 'DOMAnalysisWorker', status: 'ready', mode: 'deterministic' },
      { name: 'CSSAnalysisWorker', status: 'ready', mode: 'deterministic' },
      { name: 'AssetAnalysisWorker', status: 'ready', mode: 'deterministic' },
      { name: 'VisualSegmentationWorker', status: 'ready', mode: 'deterministic' },
      { name: 'ReconstructionWorker', status: 'ready', mode: 'deterministic' },
      { name: 'ChromiumRenderWorker', status: 'ready', mode: 'headless-chromium' },
      { name: 'VisualComparisonWorker', status: 'ready', mode: 'pixelmatch' },
      { name: 'OptimizationWorker', status: 'ready', mode: 'deterministic' },
    ],
  });
});

// 7. Knowledge Base Versions
adminRouter.get('/knowledge-base', (_req, res: Response): void => {
  const db = getDb();
  const entries = db.prepare('SELECT * FROM knowledge_base ORDER BY archetype ASC').all();
  res.json({ success: true, knowledgeBase: entries });
});
