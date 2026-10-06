import { Router, Response } from 'express';
import { requireBearerAuth, V1AuthenticatedRequest } from '../../auth/v1-middleware.js';
import { tokenService } from '../../tokens/token-service.js';

export const usageRouter = Router();

// Get usage history
usageRouter.get('/', requireBearerAuth, (req: V1AuthenticatedRequest, res: Response): void => {
  const limit = parseInt((req.query.limit as string) || '50', 10);
  const records = tokenService.getUsageHistory(req.user!.id, limit);

  const formatted = records.map((r) => ({
    id: r.id,
    operation: r.operation,
    tokens_used: r.tokens_used,
    date: r.created_at,
    project: r.project_id,
    job: r.job_id,
  }));

  const totalTokensUsed = formatted.reduce((sum, item) => sum + item.tokens_used, 0);

  res.json({
    success: true,
    total_tokens_used: totalTokensUsed,
    usage: formatted,
  });
});
