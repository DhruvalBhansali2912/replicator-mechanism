import { Router, Response } from 'express';
import { requireBearerAuth, V1AuthenticatedRequest } from '../../auth/v1-middleware.js';
import { DOMAnalysisWorker, CSSAnalysisWorker, AssetAnalysisWorker, VisualSegmentationWorker } from '../../workers/index.js';
import { PricingService } from '../../tokens/pricing.js';
import { tokenService } from '../../tokens/token-service.js';

export const analyzeRouter = Router();

// Analyze DOM
analyzeRouter.post('/dom', requireBearerAuth, async (req: V1AuthenticatedRequest, res: Response): Promise<void> => {
  const { html } = req.body;
  if (!html || typeof html !== 'string') {
    res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'Field "html" is required.' });
    return;
  }

  const cost = PricingService.getCost('analyze_section');
  const balance = tokenService.getUserBalance(req.user!.id);
  if (balance.available_tokens < cost) {
    res.status(402).json({ error: 'INSUFFICIENT_TOKENS', message: `Analysis requires ${cost} token.` });
    return;
  }

  try {
    const worker = new DOMAnalysisWorker();
    const result = await worker.execute(html);

    // Atomically consume token
    const { reservationId } = tokenService.reserveTokens(req.user!.id, 'adhoc_dom', 'analyze_section', cost);
    tokenService.settleReservation(reservationId, cost, { operation: 'analyze_section' });

    res.json({
      success: true,
      tokensUsed: cost,
      analysis: result,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'ANALYSIS_FAILED', message: err.message });
  }
});

// Analyze CSS
analyzeRouter.post('/css', requireBearerAuth, async (req: V1AuthenticatedRequest, res: Response): Promise<void> => {
  const { css } = req.body;
  if (!css || typeof css !== 'string') {
    res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'Field "css" is required.' });
    return;
  }

  try {
    const worker = new CSSAnalysisWorker();
    const result = await worker.execute(css);
    res.json({
      success: true,
      analysis: result,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'ANALYSIS_FAILED', message: err.message });
  }
});

// Analyze Assets
analyzeRouter.post('/assets', requireBearerAuth, async (req: V1AuthenticatedRequest, res: Response): Promise<void> => {
  const { html, css, baseUrl } = req.body;
  if (!html || !baseUrl) {
    res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'Fields "html" and "baseUrl" are required.' });
    return;
  }

  const cost = PricingService.getCost('asset_analysis');
  const balance = tokenService.getUserBalance(req.user!.id);
  if (balance.available_tokens < cost) {
    res.status(402).json({ error: 'INSUFFICIENT_TOKENS', message: `Asset analysis requires ${cost} token.` });
    return;
  }

  try {
    const worker = new AssetAnalysisWorker();
    const result = await worker.execute(html, css || '', baseUrl);

    const { reservationId } = tokenService.reserveTokens(req.user!.id, 'adhoc_assets', 'asset_analysis', cost);
    tokenService.settleReservation(reservationId, cost, { operation: 'asset_analysis' });

    res.json({
      success: true,
      tokensUsed: cost,
      analysis: result,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'ANALYSIS_FAILED', message: err.message });
  }
});

// Visual Segmentation
analyzeRouter.post('/segmentation', requireBearerAuth, async (req: V1AuthenticatedRequest, res: Response): Promise<void> => {
  const { html } = req.body;
  if (!html || typeof html !== 'string') {
    res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'Field "html" is required.' });
    return;
  }

  const cost = PricingService.getCost('visual_segmentation');
  const balance = tokenService.getUserBalance(req.user!.id);
  if (balance.available_tokens < cost) {
    res.status(402).json({ error: 'INSUFFICIENT_TOKENS', message: `Visual segmentation requires ${cost} tokens.` });
    return;
  }

  try {
    const worker = new VisualSegmentationWorker();
    const result = await worker.execute(html);

    const { reservationId } = tokenService.reserveTokens(req.user!.id, 'adhoc_segmentation', 'visual_segmentation', cost);
    tokenService.settleReservation(reservationId, cost, { operation: 'visual_segmentation' });

    res.json({
      success: true,
      tokensUsed: cost,
      segmentation: result,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'SEGMENTATION_FAILED', message: err.message });
  }
});
