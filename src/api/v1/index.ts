import { Router } from 'express';
import { createRateLimiter } from '../../auth/v1-middleware.js';
import { authRouter } from './auth.js';
import { projectsRouter } from './projects.js';
import { sectionsRouter } from './sections.js';
import { analyzeRouter } from './analyze.js';
import { capturesRouter } from './captures.js';
import { reconstructionRouter } from './reconstruction.js';
import { comparisonRouter } from './comparison.js';
import { optimizationRouter } from './optimization.js';
import { jobsRouter } from './jobs.js';
import { tokensRouter } from './tokens.js';
import { usageRouter } from './usage.js';
import { resultsRouter } from './results.js';
import { adminRouter } from './admin.js';

export const v1ApiRouter = Router();

// Apply rate limiting across /api/v1
v1ApiRouter.use(createRateLimiter(200, 60000));

// Mount Versioned Sub-routers
v1ApiRouter.use('/auth', authRouter);
v1ApiRouter.use('/projects', projectsRouter);
v1ApiRouter.use('/sections', sectionsRouter);
v1ApiRouter.use('/analyze', analyzeRouter);
v1ApiRouter.use('/captures', capturesRouter);
v1ApiRouter.use('/reconstruction', reconstructionRouter);
v1ApiRouter.use('/comparison', comparisonRouter);
v1ApiRouter.use('/optimization', optimizationRouter);
v1ApiRouter.use('/jobs', jobsRouter);
v1ApiRouter.use('/tokens', tokensRouter);
v1ApiRouter.use('/usage', usageRouter);
v1ApiRouter.use('/results', resultsRouter);
v1ApiRouter.use('/admin', adminRouter);
