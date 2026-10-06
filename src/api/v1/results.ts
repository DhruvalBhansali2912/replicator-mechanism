import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getDb } from '../../db/database.js';
import { requireBearerAuth, V1AuthenticatedRequest } from '../../auth/v1-middleware.js';
import { CONFIG } from '../../config.js';

export const resultsRouter = Router();

// Get generated result for a job
resultsRouter.get('/:jobId', requireBearerAuth, (req: V1AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const job = db.prepare('SELECT id, user_id, status FROM jobs WHERE id = ?').get(req.params.jobId) as any;
  if (!job || job.user_id !== req.user!.id) {
    res.status(404).json({ error: 'RESULT_NOT_FOUND', message: 'Job not found or access denied.' });
    return;
  }

  const rec = db.prepare('SELECT * FROM reconstructions WHERE job_id = ? ORDER BY created_at DESC LIMIT 1').get(req.params.jobId) as any;
  if (!rec) {
    res.status(404).json({ error: 'RESULT_NOT_FOUND', message: 'Reconstruction result is not available yet.' });
    return;
  }

  const steps = db.prepare('SELECT step_name, worker_name, status, tokens_consumed, details_json, started_at FROM job_steps WHERE job_id = ?').all(req.params.jobId);
  const metadata = rec.metadata_json ? JSON.parse(rec.metadata_json) : {};

  res.json({
    success: true,
    job_id: req.params.jobId,
    accuracy_metrics: {
      fidelity_score: rec.fidelity_score,
      passed: rec.fidelity_score >= 80,
    },
    code: {
      html: rec.html_content,
      css: rec.css_content,
      javascript: rec.js_content,
    },
    sections: metadata.sections || [],
    optimization_history: steps.filter((s: any) => s.worker_name === 'OptimizationWorker').map((s: any) => ({
      step: s.step_name,
      status: s.status,
      details: s.details_json ? JSON.parse(s.details_json) : null,
    })),
    download_url: `/api/v1/results/${req.params.jobId}/download`,
    preview_url: `/api/jobs/${req.params.jobId}/preview`,
  });
});

// Download exported result package
resultsRouter.get('/:jobId/download', requireBearerAuth, (req: V1AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const job = db.prepare('SELECT id, user_id FROM jobs WHERE id = ?').get(req.params.jobId) as any;
  if (!job || job.user_id !== req.user!.id) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Job result not found.' });
    return;
  }

  const storageJobsDir = CONFIG.jobsDir || path.resolve(process.cwd(), 'storage', 'jobs');
  const htmlFile = path.join(storageJobsDir, req.params.jobId, 'reconstruction.html');

  if (!fs.existsSync(htmlFile)) {
    res.status(404).json({ error: 'FILE_NOT_FOUND', message: 'Result file not generated on disk.' });
    return;
  }

  res.download(htmlFile, `reconstructed-${req.params.jobId}.html`);
});
