import { Router, Response } from 'express';
import { requireBearerAuth, V1AuthenticatedRequest } from '../../auth/v1-middleware.js';
import { jobQueue } from '../../queue/job-queue.js';

export const jobsRouter = Router();

// List user jobs
jobsRouter.get('/', requireBearerAuth, (req: V1AuthenticatedRequest, res: Response): void => {
  const limit = parseInt((req.query.limit as string) || '20', 10);
  const jobs = jobQueue.listJobs(req.user!.id, limit);
  res.json({ success: true, jobs });
});

// Get job status by ID
jobsRouter.get('/:id', requireBearerAuth, (req: V1AuthenticatedRequest, res: Response): void => {
  const job = jobQueue.getJob(req.params.id, req.user!.id);
  if (!job) {
    res.status(404).json({ error: 'JOB_NOT_FOUND', message: 'Job not found.' });
    return;
  }
  res.json({
    job_id: job.id,
    status: job.status,
    type: job.type,
    estimated_tokens: job.estimatedTokens,
    actual_tokens: job.actualTokens,
    error_message: job.errorMessage,
    created_at: job.createdAt,
    completed_at: job.completedAt,
    steps: job.steps,
    reconstruction: job.reconstruction,
    result_url: job.status === 'completed' ? `/api/v1/results/${job.id}` : null,
    preview_url: job.status === 'completed' ? `/api/jobs/${job.id}/preview` : null,
    download_url: job.status === 'completed' ? `/api/jobs/${job.id}/download` : null,
  });
});

// Cancel job
jobsRouter.post('/:id/cancel', requireBearerAuth, (req: V1AuthenticatedRequest, res: Response): void => {
  try {
    jobQueue.cancelJob(req.params.id, req.user!.id);
    res.json({ success: true, message: 'Job cancelled successfully. Reserved tokens have been released.' });
  } catch (err: any) {
    res.status(400).json({ error: 'CANCEL_FAILED', message: err.message });
  }
});

// Resume paused job (TOKEN_LIMIT_REACHED)
jobsRouter.post('/:id/resume', requireBearerAuth, (req: V1AuthenticatedRequest, res: Response): void => {
  const additionalTokens = Number(req.body.additionalTokens || 5);
  try {
    jobQueue.resumeJob(req.params.id, req.user!.id, additionalTokens);
    res.json({
      success: true,
      message: `Job resumed with ${additionalTokens} additional tokens reserved.`,
      status: 'queued',
    });
  } catch (err: any) {
    res.status(400).json({ error: 'RESUME_FAILED', message: err.message });
  }
});
