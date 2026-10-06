import { Router, Response } from 'express';
import { requireBearerAuth, V1AuthenticatedRequest } from '../../auth/v1-middleware.js';
import { OptimizationWorker, DEFAULT_LIMITS } from '../../workers/index.js';
import { PricingService } from '../../tokens/pricing.js';
import { tokenService } from '../../tokens/token-service.js';

export const optimizationRouter = Router();

// Run optimization iteration
optimizationRouter.post('/', requireBearerAuth, async (req: V1AuthenticatedRequest, res: Response): Promise<void> => {
  const { html, css, iteration, limits } = req.body;

  if (!html || !css) {
    res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'Fields "html" and "css" are required.' });
    return;
  }

  const iter = iteration || 1;
  const cost = PricingService.getCost('optimization_iteration');
  const balance = tokenService.getUserBalance(req.user!.id);
  if (balance.available_tokens < cost) {
    res.status(402).json({ error: 'INSUFFICIENT_TOKENS', message: `Optimization requires ${cost} token.` });
    return;
  }

  try {
    const worker = new OptimizationWorker();
    const result = await worker.executeIteration(
      html,
      css,
      iter,
      balance.available_tokens,
      { ...DEFAULT_LIMITS, ...limits }
    );

    if (result.tokenLimitReached) {
      res.status(402).json({
        error: 'TOKEN_LIMIT_REACHED',
        message: 'Token budget reached or max iterations exceeded. Please add tokens or resume.',
      });
      return;
    }

    const { reservationId } = tokenService.reserveTokens(req.user!.id, 'adhoc_optimization', 'optimization_iteration', cost);
    tokenService.settleReservation(reservationId, cost, { operation: 'optimization_iteration', iteration: iter });

    res.json({
      success: true,
      tokensUsed: cost,
      iteration: result.iteration,
      improvements: result.improvementsApplied,
      optimizedHtml: result.optimizedHtml,
      optimizedCss: result.optimizedCss,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'OPTIMIZATION_FAILED', message: err.message });
  }
});
