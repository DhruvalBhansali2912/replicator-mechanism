import { Router, Response } from 'express';
import { requireBearerAuth, V1AuthenticatedRequest } from '../../auth/v1-middleware.js';
import { jobQueue } from '../../queue/job-queue.js';

export const reconstructionRouter = Router();

// Enqueue asynchronous reconstruction job
reconstructionRouter.post('/', requireBearerAuth, async (req: V1AuthenticatedRequest, res: Response): Promise<void> => {
  const { url, projectId, htmlSnapshot, clientStylesheets, clientScreenshot, options, limits } = req.body;

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'INVALID_URL', message: 'Field "url" is required and must be a valid string.' });
    return;
  }

  try {
    const jobRes = await jobQueue.enqueueJob({
      userId: req.user!.id,
      projectId: projectId || null,
      type: 'reconstruction',
      url,
      htmlSnapshot,
      clientStylesheets,
      clientScreenshot,
      options,
      limits,
    });

    res.status(202).json({
      job_id: jobRes.jobId,
      status: jobRes.status,
      estimated_tokens: jobRes.estimatedTokens,
      status_url: `/api/v1/jobs/${jobRes.jobId}`,
    });
  } catch (err: any) {
    if (err.message && err.message.includes('INSUFFICIENT_TOKENS')) {
      res.status(402).json({ error: 'INSUFFICIENT_TOKENS', message: err.message });
      return;
    }
    res.status(400).json({ error: 'JOB_CREATION_FAILED', message: err.message });
  }
});
