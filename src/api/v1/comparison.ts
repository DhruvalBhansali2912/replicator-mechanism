import { Router, Response } from 'express';
import { requireBearerAuth, V1AuthenticatedRequest } from '../../auth/v1-middleware.js';
import { VisualComparisonWorker } from '../../workers/index.js';
import { PricingService } from '../../tokens/pricing.js';
import { tokenService } from '../../tokens/token-service.js';

export const comparisonRouter = Router();

// Compare two screenshots
comparisonRouter.post('/', requireBearerAuth, async (req: V1AuthenticatedRequest, res: Response): Promise<void> => {
  const { baselineImage, targetImage, viewport } = req.body;

  if (!baselineImage || !targetImage) {
    res.status(400).json({
      error: 'INVALID_PAYLOAD',
      message: 'Both "baselineImage" and "targetImage" (base64 PNG strings) are required.',
    });
    return;
  }

  const cost = PricingService.getCost('visual_comparison');
  const balance = tokenService.getUserBalance(req.user!.id);
  if (balance.available_tokens < cost) {
    res.status(402).json({ error: 'INSUFFICIENT_TOKENS', message: `Visual comparison requires ${cost} token.` });
    return;
  }

  try {
    const cleanBase64 = (str: string) => str.replace(/^data:image\/\w+;base64,/, '');
    const buf1 = Buffer.from(cleanBase64(baselineImage), 'base64');
    const buf2 = Buffer.from(cleanBase64(targetImage), 'base64');

    const worker = new VisualComparisonWorker();
    const result = await worker.execute(buf1, buf2, viewport || 'desktop');

    const { reservationId } = tokenService.reserveTokens(req.user!.id, 'adhoc_comparison', 'visual_comparison', cost);
    tokenService.settleReservation(reservationId, cost, { operation: 'visual_comparison' });

    res.json({
      success: true,
      tokensUsed: cost,
      viewport: result.viewport,
      diffPixels: result.diffPixels,
      totalPixels: result.totalPixels,
      matchPercentage: result.matchPercentage,
      diffImage: result.diffImageBuffer ? `data:image/png;base64,${result.diffImageBuffer.toString('base64')}` : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'COMPARISON_FAILED', message: err.message });
  }
});
