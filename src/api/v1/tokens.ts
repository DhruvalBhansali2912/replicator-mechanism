import { Router, Response } from 'express';
import { requireBearerAuth, V1AuthenticatedRequest } from '../../auth/v1-middleware.js';
import { tokenService } from '../../tokens/token-service.js';
import { PricingService } from '../../tokens/pricing.js';

export const tokensRouter = Router();

// Get user token balance summary
tokensRouter.get('/', requireBearerAuth, (req: V1AuthenticatedRequest, res: Response): void => {
  const balance = tokenService.getUserBalance(req.user!.id);
  res.json({
    success: true,
    current_balance: balance.current_balance,
    reserved_tokens: balance.reserved_tokens,
    available_tokens: balance.available_tokens,
  });
});

// Get centrally configured operation pricing
tokensRouter.get('/pricing', (_req, res: Response): void => {
  res.json({
    success: true,
    pricing: PricingService.getPricing(),
  });
});

// Get user immutable token ledger history
tokensRouter.get('/ledger', requireBearerAuth, (req: V1AuthenticatedRequest, res: Response): void => {
  const limit = parseInt((req.query.limit as string) || '50', 10);
  const entries = tokenService.getLedgerHistory(req.user!.id, limit);
  res.json({ success: true, ledger: entries });
});
