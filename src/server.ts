import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { CONFIG } from './config.js';
import { PageExtractor } from './crawler/page-extractor.js';
import { ZipPackager } from './packager/zip-packager.js';
import { ExtractionOptions, JobState } from './types.js';
import { MASTER_ARCHETYPES } from './classifier/archetypes.js';
import { keyService } from './auth/key-service.js';
import {
  requireApiKeyAndDevice,
  requireMasterSecret,
  AuthenticatedRequest,
} from './auth/middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createServer(): express.Application {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // In-memory jobs registry
  const jobs = new Map<string, JobState>();

  // Ensure storage directories exist
  fs.mkdirSync(CONFIG.storageDir, { recursive: true });
  fs.mkdirSync(CONFIG.jobsDir, { recursive: true });

  // Web Dashboard Static Assets
  const publicDir = path.resolve(__dirname, '../public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response): void => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // --- AUTH & TOKEN API ---

  // Credit or issue API key (called by WooCommerce upon order completion)
  app.post('/api/keys/credit', requireMasterSecret, (req: Request, res: Response): void => {
    try {
      const { email, tokens, orderId, isFreeTrial } = req.body;
      if (!email || tokens === undefined) {
        res.status(400).json({ success: false, error: 'MISSING_FIELDS', message: 'Fields "email" and "tokens" are required.' });
        return;
      }
      const result = keyService.creditKey({
        email,
        tokens: Number(tokens),
        orderId,
        isFreeTrial: Boolean(isFreeTrial),
      });
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Verify key & bind device (called by Chrome Extension on install or verification)
  app.post('/api/keys/verify', (req: Request, res: Response): void => {
    const apiKey = (req.body.apiKey || req.headers['x-api-key']) as string;
    const deviceId = (req.body.deviceId || req.headers['x-device-id']) as string;
    const deviceName = (req.body.deviceName || req.headers['x-device-name']) as string;

    const result = keyService.verifyAndBindDevice(apiKey, deviceId, deviceName);
    if (!result.valid) {
      res.status(403).json({ success: false, ...result });
      return;
    }
    res.json({ success: true, ...result });
  });

  // Get key details and remaining balance (called by Chrome Extension)
  app.get('/api/keys/balance', requireApiKeyAndDevice, (req: AuthenticatedRequest, res: Response): void => {
    const keyRecord = req.apiKeyRecord!;
    res.json({
      success: true,
      apiKey: keyRecord.apiKey,
      customerEmail: keyRecord.customerEmail,
      balance: keyRecord.tokensBalance,
      tokensUsed: keyRecord.tokensUsed,
      isFreeTrial: keyRecord.isFreeTrial,
      boundDeviceId: keyRecord.boundDeviceId,
      boundDeviceName: keyRecord.boundDeviceName,
    });
  });

  // Reset device binding (called by WooCommerce My Account or Admin via Master Secret)
  app.post('/api/keys/reset-device', requireMasterSecret, (req: Request, res: Response): void => {
    try {
      const { emailOrKey, reason } = req.body;
      if (!emailOrKey) {
        res.status(400).json({ success: false, error: 'MISSING_FIELD', message: 'Field "emailOrKey" is required.' });
        return;
      }
      keyService.resetDevice(emailOrKey, reason);
      res.json({ success: true, message: 'Device binding reset successfully.' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 1. Submit URL for extraction
  app.post('/api/extract', requireApiKeyAndDevice, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { url, options = {} } = req.body;

    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'Field "url" is required and must be a valid URL string.' });
      return;
    }

    try {
      new URL(url);
    } catch {
      res.status(400).json({ error: `Invalid URL format: "${url}". Please include http:// or https://` });
      return;
    }

    const jobId = uuidv4().slice(0, 8);
    const jobState: JobState = {
      id: jobId,
      url,
      apiKey: req.apiKeyRecord?.apiKey,
      options: {
        url,
        renameClasses: options.renameClasses !== false,
        purgeCss: options.purgeCss !== false,
        deminify: options.deminify !== false,
        localizeAssets: options.localizeAssets !== false,
        rewriteLinks: options.rewriteLinks !== false,
        mobile: !!options.mobile,
        ...options,
      },
      status: 'queued',
      progress: 0,
      currentStep: 'Job queued...',
      createdAt: new Date().toISOString(),
      sections: [],
    };

    jobs.set(jobId, jobState);

    // Start background processing
    processJob(jobState, jobs).catch((err) => {
      console.error(`Error processing job ${jobId}:`, err);
      jobState.status = 'failed';
      jobState.error = err.message || 'Extraction failed';
    });

    res.status(202).json({
      success: true,
      jobId,
      message: 'Extraction job started',
      statusUrl: `/api/jobs/${jobId}`,
      previewUrl: `/api/jobs/${jobId}/preview`,
      downloadUrl: `/api/jobs/${jobId}/download`,
      tokensBalance: req.apiKeyRecord ? req.apiKeyRecord.tokensBalance : undefined,
    });
  });

  // 2. List all jobs
  app.get('/api/jobs', (_req: Request, res: Response): void => {
    const jobList = Array.from(jobs.values()).map((j) => ({
      id: j.id,
      url: j.url,
      status: j.status,
      progress: j.progress,
      currentStep: j.currentStep,
      sectionCount: j.sections.length,
      createdAt: j.createdAt,
      completedAt: j.completedAt,
    }));
    res.json({ jobs: jobList });
  });

  // 3. Get job status & details
  app.get('/api/jobs/:id', (req: Request, res: Response): void => {
    const job = jobs.get(req.params.id);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    res.json(job);
  });

  // 4. Preview full page offline
  app.use('/api/jobs/:id/preview', (req: Request, res: Response, next) => {
    const jobDir = path.join(CONFIG.jobsDir, req.params.id, 'full-page');
    if (!fs.existsSync(jobDir)) {
      res.status(404).json({ error: 'Preview not ready or job not found' });
      return;
    }
    express.static(jobDir)(req, res, next);
  });

  // Apple-compatible Global Header and Search API fallbacks for preview mode
  app.get('/api-www/global-elements/global-header/v1/flyouts*', (_req: Request, res: Response): void => {
    const flyoutSample = path.join(CONFIG.jobsDir, '05d7c143', 'full-page', 'assets', 'flyouts.json');
    if (fs.existsSync(flyoutSample)) {
      res.setHeader('Content-Type', 'application/json');
      fs.createReadStream(flyoutSample).pipe(res);
    } else {
      res.json({});
    }
  });

  app.get('/search-services/suggestions/defaultlinks/*', (_req: Request, res: Response): void => {
    const searchSample = path.join(CONFIG.jobsDir, '05d7c143', 'full-page', 'assets', 'search-defaultlinks.json');
    if (fs.existsSync(searchSample)) {
      res.setHeader('Content-Type', 'application/json');
      fs.createReadStream(searchSample).pipe(res);
    } else {
      res.json({ results: [] });
    }
  });

  app.get('/search-services/suggestions/*', (_req: Request, res: Response): void => {
    res.json({ results: [] });
  });

  app.get('/us/shop/bag/*', (_req: Request, res: Response): void => {
    res.json({ count: 0, items: [] });
  });

  // 5. Full page screenshot
  app.get('/api/jobs/:id/screenshot', (req: Request, res: Response): void => {
    const screenshotFile = path.join(CONFIG.jobsDir, req.params.id, 'full-page', 'full-page.png');
    if (!fs.existsSync(screenshotFile)) {
      res.status(404).json({ error: 'Screenshot not found' });
      return;
    }
    res.setHeader('Content-Type', 'image/png');
    fs.createReadStream(screenshotFile).pipe(res);
  });

  // 6. Download ZIP archive
  app.get('/api/jobs/:id/download', (req: Request, res: Response): void => {
    const zipFile = path.join(CONFIG.jobsDir, req.params.id, 'site-package.zip');
    if (!fs.existsSync(zipFile)) {
      res.status(404).json({ error: 'Zip package not ready or job not found' });
      return;
    }
    res.download(zipFile, `extracted-site-${req.params.id}.zip`);
  });

  // 7. Get section details and code
  app.get('/api/jobs/:id/sections/:sectionId', (req: Request, res: Response): void => {
    const { id, sectionId } = req.params;
    const job = jobs.get(id);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const sectionMeta = job.sections.find((s) => s.id === sectionId);
    if (!sectionMeta) {
      res.status(404).json({ error: `Section ${sectionId} not found` });
      return;
    }

    const secDir = path.join(CONFIG.jobsDir, id, 'sections', `${sectionMeta.id}-${sectionMeta.archetype}`);
    if (!fs.existsSync(secDir)) {
      res.status(404).json({ error: 'Section files not found' });
      return;
    }

    const html = fs.existsSync(path.join(secDir, 'section.html'))
      ? fs.readFileSync(path.join(secDir, 'section.html'), 'utf8')
      : '';
    const css = fs.existsSync(path.join(secDir, 'section.css'))
      ? fs.readFileSync(path.join(secDir, 'section.css'), 'utf8')
      : '';
    const minCss = fs.existsSync(path.join(secDir, 'section.min.css'))
      ? fs.readFileSync(path.join(secDir, 'section.min.css'), 'utf8')
      : '';
    const js = fs.existsSync(path.join(secDir, 'section.js'))
      ? fs.readFileSync(path.join(secDir, 'section.js'), 'utf8')
      : '';
    const metadata = fs.existsSync(path.join(secDir, 'metadata.json'))
      ? JSON.parse(fs.readFileSync(path.join(secDir, 'metadata.json'), 'utf8'))
      : sectionMeta;

    res.json({
      meta: metadata,
      html,
      css,
      minifiedCss: minCss,
      js,
      previewUrl: `/api/jobs/${id}/sections/${sectionId}/preview`,
      screenshotUrl: `/api/jobs/${id}/sections/${sectionId}/screenshot`,
    });
  });

  // 8. Preview standalone section
  app.get('/api/jobs/:id/sections/:sectionId/preview', (req: Request, res: Response): void => {
    const { id, sectionId } = req.params;
    const job = jobs.get(id);
    if (!job) {
      res.status(404).send('Job not found');
      return;
    }

    const sectionMeta = job.sections.find((s) => s.id === sectionId);
    if (!sectionMeta) {
      res.status(404).send('Section not found');
      return;
    }

    const previewFile = path.join(
      CONFIG.jobsDir,
      id,
      'sections',
      `${sectionMeta.id}-${sectionMeta.archetype}`,
      'preview.html'
    );
    if (!fs.existsSync(previewFile)) {
      res.status(404).send('Preview file not found');
      return;
    }

    res.setHeader('Content-Type', 'text/html');
    fs.createReadStream(previewFile).pipe(res);
  });

  // 9. Section screenshot
  app.get('/api/jobs/:id/sections/:sectionId/screenshot', (req: Request, res: Response): void => {
    const { id, sectionId } = req.params;
    const job = jobs.get(id);
    if (!job) {
      res.status(404).send('Job not found');
      return;
    }

    const sectionMeta = job.sections.find((s) => s.id === sectionId);
    if (!sectionMeta) {
      res.status(404).send('Section not found');
      return;
    }

    const screenshotFile = path.join(
      CONFIG.jobsDir,
      id,
      'sections',
      `${sectionMeta.id}-${sectionMeta.archetype}`,
      'screenshot.png'
    );
    if (!fs.existsSync(screenshotFile)) {
      res.status(404).send('Screenshot not found');
      return;
    }

    res.setHeader('Content-Type', 'image/png');
    fs.createReadStream(screenshotFile).pipe(res);
  });

  // 10. Master Archetypes Reference
  app.get('/api/archetypes', (_req: Request, res: Response): void => {
    res.json({
      archetypes: MASTER_ARCHETYPES.map((a) => ({
        name: a.archetype,
        title: a.title,
        description: a.description,
        keywords: a.keywords,
        positionBias: a.positionBias,
      })),
    });
  });

  return app;
}

async function processJob(job: JobState, jobs: Map<string, JobState>): Promise<void> {
  const extractor = new PageExtractor();
  const packager = new ZipPackager();

  try {
    job.status = 'crawling';
    const result = await extractor.extract(job.url, job.options, (step, progress) => {
      job.currentStep = step;
      job.progress = progress;
    });

    job.status = 'packaging';
    job.currentStep = 'Packaging files and building archive...';
    job.progress = 90;

    const { zipPath, sectionsMeta } = await packager.packageJob(job.id, job.url, job.options, result);

    job.sections = sectionsMeta;
    job.packageZipPath = zipPath;
    job.fullPageScreenshot = `/api/jobs/${job.id}/screenshot`;
    job.status = 'completed';
    job.progress = 100;
    job.currentStep = 'Extraction completed successfully';
    job.completedAt = new Date().toISOString();

    // Deduct 1 token upon successful extraction if an API key is associated
    if (job.apiKey) {
      try {
        const remaining = keyService.deductToken(job.apiKey, job.id);
        console.log(`[Token] Deducted 1 token for job ${job.id}. Remaining balance: ${remaining}`);
      } catch (tokenErr: any) {
        console.error(`[Token] Failed to deduct token for job ${job.id}:`, tokenErr.message);
      }
    }
    job.stats = {
      originalHtmlBytes: Buffer.byteLength(result.originalHtml, 'utf8'),
      transformedHtmlBytes: Buffer.byteLength(result.transformedHtml, 'utf8'),
      originalCssBytes: Buffer.byteLength(result.originalCss, 'utf8'),
      purgedCssBytes: Buffer.byteLength(result.transformedCss, 'utf8'),
      minifiedCssBytes: Buffer.byteLength(result.minifiedCss, 'utf8'),
      assetCount: result.assetCount,
      sectionCount: result.sections.length,
    };
  } catch (err: any) {
    console.error(`Job ${job.id} failed:`, err);
    job.status = 'failed';
    job.error = err.message || 'Unknown extraction error';
    job.currentStep = `Failed: ${job.error}`;
  }
}
