import { Router, Response } from 'express';
import { requireBearerAuth, V1AuthenticatedRequest } from '../../auth/v1-middleware.js';
import { ChromiumRenderWorker } from '../../workers/index.js';
import { PricingService } from '../../tokens/pricing.js';
import { tokenService } from '../../tokens/token-service.js';

export const capturesRouter = Router();

// Capture multi-viewport screenshots
capturesRouter.post('/', requireBearerAuth, async (req: V1AuthenticatedRequest, res: Response): Promise<void> => {
  const { url, html, viewports } = req.body;
  if (!url && !html) {
    res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'Either "url" or "html" is required.' });
    return;
  }

  const vpList = viewports || [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844, isMobile: true },
  ];

  const cost = PricingService.getCost('capture_viewport') * vpList.length;
  const balance = tokenService.getUserBalance(req.user!.id);
  if (balance.available_tokens < cost) {
    res.status(402).json({ error: 'INSUFFICIENT_TOKENS', message: `Viewport capture requires ${cost} tokens.` });
    return;
  }

  try {
    const worker = new ChromiumRenderWorker();
    const renderRes = await worker.execute(url || html, !!html, vpList);

    const { reservationId } = tokenService.reserveTokens(req.user!.id, 'adhoc_capture', 'capture_viewport', cost);
    tokenService.settleReservation(reservationId, cost, { operation: 'capture_viewport', viewportsCount: vpList.length });

    const screenshotsBase64: Record<string, string> = {};
    for (const [name, buf] of Object.entries(renderRes.screenshots)) {
      screenshotsBase64[name] = `data:image/png;base64,${buf.toString('base64')}`;
    }

    res.json({
      success: true,
      tokensUsed: cost,
      screenshots: screenshotsBase64,
      fullPageScreenshot: `data:image/png;base64,${renderRes.fullPageScreenshot.toString('base64')}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'CAPTURE_FAILED', message: err.message });
  }
});
