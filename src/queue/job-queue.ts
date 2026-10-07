import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
import { AppDatabase, getDb } from '../db/database.js';
import { tokenService, TokenService } from '../tokens/token-service.js';
import { authDb } from '../auth/db.js';
import { PricingService } from '../tokens/pricing.js';
import { CONFIG } from '../config.js';
import {
  DOMAnalysisWorker,
  CSSAnalysisWorker,
  AssetAnalysisWorker,
  VisualSegmentationWorker,
  ReconstructionWorker,
  ChromiumRenderWorker,
  VisualComparisonWorker,
  OptimizationWorker,
  OptimizationLimits,
  DEFAULT_LIMITS,
} from '../workers/index.js';
import { ZipPackager } from '../packager/zip-packager.js';

export interface CreateJobInput {
  userId: string;
  projectId?: string | null;
  type?: 'reconstruction' | 'analysis' | 'comparison' | 'optimization';
  url: string;
  htmlSnapshot?: string;
  clientStylesheets?: string[];
  clientScreenshot?: string;
  options?: Record<string, any>;
  tokenBudget?: number;
  limits?: Partial<OptimizationLimits>;
}

export interface JobRecord {
  id: string;
  user_id: string;
  project_id: string | null;
  type: string;
  status: 'queued' | 'processing' | 'waiting' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  estimated_tokens: number;
  actual_tokens: number;
  reservation_id: string | null;
  options_json: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export class JobQueue {
  private db: AppDatabase;
  private tokenSvc: TokenService;
  private cancelledJobs = new Set<string>();

  constructor(db?: AppDatabase, tokenSvc?: TokenService) {
    this.db = db || getDb();
    this.tokenSvc = tokenSvc || tokenService;
  }

  /**
   * Enqueues an asynchronous job and atomically reserves tokens.
   */
  public async enqueueJob(input: CreateJobInput): Promise<{ jobId: string; status: string; estimatedTokens: number }> {
    const jobId = `job_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    const now = new Date().toISOString();
    const type = input.type || 'reconstruction';

    // 1. Calculate estimated token cost
    const userBalance = this.tokenSvc.getUserBalance(input.userId);
    const isExtensionRequest = !!(input.htmlSnapshot || input.options?.htmlSnapshot || input.options?.sectionSelector || input.options?.sectionHtml);
    const standardCost = isExtensionRequest ? 1 : PricingService.estimateReconstructionCost({
      viewportsCount: 3,
      sectionsCount: 4,
      optimizeIterations: input.limits?.maxIterations || 1,
    });
    const estimatedCost = input.tokenBudget || standardCost;

    // 2. Reserve tokens atomically
    const { reservationId } = this.tokenSvc.reserveTokens(
      input.userId,
      jobId,
      type,
      estimatedCost,
      input.projectId,
      { url: input.url }
    );

    // 3. Create job row in database
    const jobOptions = {
      url: input.url,
      htmlSnapshot: input.htmlSnapshot,
      clientStylesheets: input.clientStylesheets,
      clientScreenshot: input.clientScreenshot,
      limits: { ...DEFAULT_LIMITS, ...input.limits },
      ...input.options,
    };

    const insertStmt = this.db.prepare(`
      INSERT INTO jobs (
        id, user_id, project_id, type, status, priority, estimated_tokens, actual_tokens,
        reservation_id, options_json, error_message, created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, 'queued', 0, ?, 0, ?, ?, NULL, ?, ?, NULL)
    `);
    insertStmt.run(
      jobId,
      input.userId,
      input.projectId || null,
      type,
      estimatedCost,
      reservationId,
      JSON.stringify(jobOptions),
      now,
      now
    );

    // 4. Asynchronously start pipeline execution without blocking API response
    setImmediate(() => {
      this.executeJobPipeline(jobId).catch((err) => {
        console.error(`[JobQueue] Fatal pipeline error for ${jobId}:`, err);
      });
    });

    return {
      jobId,
      status: 'queued',
      estimatedTokens: estimatedCost,
    };
  }

  /**
   * Retrieves full job status, logs, and token accounting.
   */
  public getJob(jobId: string, userId?: string): any {
    let sql = 'SELECT * FROM jobs WHERE id = ?';
    const params: any[] = [jobId];
    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }
    const stmt = this.db.prepare(sql);
    const job = stmt.get(...params) as JobRecord | undefined;
    if (!job) return null;

    // Fetch job steps
    const stepsStmt = this.db.prepare(`
      SELECT step_name, worker_name, status, tokens_consumed, details_json, started_at, finished_at
      FROM job_steps WHERE job_id = ? ORDER BY started_at ASC
    `);
    const steps = stepsStmt.all(jobId);

    // Fetch reconstruction if available
    const recStmt = this.db.prepare(`
      SELECT fidelity_score, metadata_json, created_at
      FROM reconstructions WHERE job_id = ? ORDER BY created_at DESC LIMIT 1
    `);
    const reconstruction = recStmt.get(jobId) as any;

    return {
      id: job.id,
      userId: job.user_id,
      projectId: job.project_id,
      type: job.type,
      status: job.status,
      estimatedTokens: job.estimated_tokens,
      actualTokens: job.actual_tokens,
      errorMessage: job.error_message,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      completedAt: job.completed_at,
      steps,
      reconstruction: reconstruction
        ? {
            fidelityScore: reconstruction.fidelity_score,
            metadata: reconstruction.metadata_json ? JSON.parse(reconstruction.metadata_json) : null,
          }
        : null,
    };
  }

  /**
   * Cancels a queued or running job and returns reserved tokens.
   */
  public cancelJob(jobId: string, userId: string): boolean {
    return this.db.transaction(() => {
      const stmt = this.db.prepare('SELECT id, reservation_id, status FROM jobs WHERE id = ? AND user_id = ?');
      const job = stmt.get(jobId, userId) as JobRecord | undefined;
      if (!job) {
        throw new Error('Job not found.');
      }
      if (['completed', 'failed', 'cancelled'].includes(job.status)) {
        throw new Error(`Job cannot be cancelled in state: ${job.status}`);
      }

      this.cancelledJobs.add(jobId);

      this.db.prepare("UPDATE jobs SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(jobId);

      if (job.reservation_id) {
        this.tokenSvc.releaseReservation(job.reservation_id, 'user_cancelled');
      }

      return true;
    });
  }

  /**
   * Resumes a paused job that reached TOKEN_LIMIT_REACHED.
   */
  public resumeJob(jobId: string, userId: string, additionalTokens: number): boolean {
    const job = this.db.prepare('SELECT * FROM jobs WHERE id = ? AND user_id = ?').get(jobId, userId) as JobRecord | undefined;
    if (!job) throw new Error('Job not found.');
    if (job.status !== 'waiting') throw new Error(`Job is not in waiting state (current: ${job.status}).`);

    // Reserve additional tokens
    this.tokenSvc.reserveTokens(userId, jobId, job.type, additionalTokens, job.project_id);

    // Update job state
    this.db.prepare(`
      UPDATE jobs 
      SET status = 'queued', estimated_tokens = estimated_tokens + ?, error_message = NULL, updated_at = datetime('now')
      WHERE id = ?
    `).run(additionalTokens, jobId);

    setImmediate(() => {
      this.executeJobPipeline(jobId).catch(console.error);
    });

    return true;
  }

  /**
   * Lists jobs for a user.
   */
  public listJobs(userId: string, limit: number = 20): any[] {
    const stmt = this.db.prepare(`
      SELECT id, project_id, type, status, estimated_tokens, actual_tokens, created_at, completed_at
      FROM jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
    `);
    return stmt.all(userId, limit);
  }

  /**
   * Orchestrates the 8-worker deterministic pipeline:
   * 1. DOMAnalysisWorker
   * 2. CSSAnalysisWorker
   * 3. AssetAnalysisWorker
   * 4. VisualSegmentationWorker
   * 5. ReconstructionWorker
   * 6. ChromiumRenderWorker
   * 7. VisualComparisonWorker
   * 8. OptimizationWorker (with Cost Control & TOKEN_LIMIT_REACHED check)
   */
  private async executeJobPipeline(jobId: string): Promise<void> {
    const jobStmt = this.db.prepare('SELECT * FROM jobs WHERE id = ?');
    const job = jobStmt.get(jobId) as JobRecord | undefined;
    if (!job || this.cancelledJobs.has(jobId)) return;

    let totalTokensUsed = 0;
    const options = JSON.parse(job.options_json || '{}');
    const limits: OptimizationLimits = options.limits || DEFAULT_LIMITS;
    const url = options.url || 'https://example.com';
    const reservationId = job.reservation_id;

    const setStep = (name: string, worker: string, status: string, tokens: number = 0, details?: any) => {
      const stepId = `step_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
      const now = new Date().toISOString();
      this.db.prepare(`
        INSERT INTO job_steps (id, job_id, step_name, worker_name, status, tokens_consumed, details_json, started_at, finished_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(stepId, jobId, name, worker, status, tokens, details ? JSON.stringify(details) : null, now, status === 'completed' ? now : null);
    };

    try {
      // Mark job processing
      this.db.prepare("UPDATE jobs SET status = 'processing', updated_at = datetime('now') WHERE id = ?").run(jobId);

      // --- STAGE 1: Chromium Live Baseline Rendering & Multi-Viewport Baselines ---
      setStep('Chromium Baseline Render', ChromiumRenderWorker.workerName, 'started');
      const renderWorker = new ChromiumRenderWorker();
      let baselineScreenshots: Record<string, Buffer> = {};
      let initialHtml = options.htmlSnapshot || '';
      let initialCss = (options.clientStylesheets || []).join('\n');

      if (!initialHtml) {
        const renderRes = await renderWorker.execute(url, false, [
          { name: 'desktop', width: 1440, height: 900 },
          { name: 'tablet', width: 768, height: 1024, isMobile: true },
          { name: 'mobile', width: 390, height: 844, isMobile: true },
        ]);
        baselineScreenshots = renderRes.screenshots;
        initialHtml = renderRes.renderedHtml;
      }

      // Universal External Stylesheet Harvesting Fallback:
      // If client stylesheets were missing or blocked by CORS in the browser,
      // harvest and fetch all <link rel="stylesheet"> and <style> tags from initialHtml.
      if (initialCss.trim().length < 200 && initialHtml) {
        try {
          const $snap = cheerio.load(initialHtml);
          const externalHrefs: string[] = [];
          $snap('link[rel="stylesheet"]').each((_, el) => {
            const href = $snap(el).attr('href');
            if (href && !href.startsWith('chrome-extension://')) {
              try {
                externalHrefs.push(new URL(href, url).href);
              } catch {}
            }
          });

          const inlineStyles: string[] = [];
          $snap('style').each((_, el) => {
            const content = $snap(el).html();
            if (content && content.trim().length > 0) {
              inlineStyles.push(content.trim());
            }
          });

          if (externalHrefs.length > 0 || inlineStyles.length > 0) {
            const fetchedSheets = await Promise.all(
              externalHrefs.map(async (href) => {
                try {
                  const resp = await fetch(href, {
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                      'Referer': url,
                    },
                    signal: AbortSignal.timeout(3000),
                  });
                  if (resp.ok) {
                    return await resp.text();
                  }
                } catch {}
                return '';
              })
            );
            const validSheets = [...inlineStyles, ...fetchedSheets.filter((s) => s && s.trim().length > 0)];
            if (validSheets.length > 0) {
              initialCss = (initialCss ? initialCss + '\n' : '') + validSheets.join('\n');
            }
          }
        } catch (err) {
          console.warn('[JobQueue] Error harvesting external stylesheets:', err);
        }
      }
      totalTokensUsed += PricingService.getCost('capture_viewport') * 3;
      setStep('Chromium Baseline Render', ChromiumRenderWorker.workerName, 'completed', PricingService.getCost('capture_viewport') * 3);

      if (this.cancelledJobs.has(jobId)) return;

      // --- STAGE 2: DOM Analysis ---
      setStep('DOM Tree Analysis', DOMAnalysisWorker.workerName, 'started');
      const domWorker = new DOMAnalysisWorker();
      const domRes = await domWorker.execute(initialHtml);
      totalTokensUsed += PricingService.getCost('analyze_section');
      setStep('DOM Tree Analysis', DOMAnalysisWorker.workerName, 'completed', PricingService.getCost('analyze_section'), {
        totalNodes: domRes.totalNodes,
        maxDepth: domRes.maxDepth,
      });

      // --- STAGE 3: CSS Analysis ---
      setStep('CSS Stylesheet Analysis', CSSAnalysisWorker.workerName, 'started');
      const cssWorker = new CSSAnalysisWorker();
      const cssRes = await cssWorker.execute(initialCss);
      setStep('CSS Stylesheet Analysis', CSSAnalysisWorker.workerName, 'completed', 0, {
        totalRules: cssRes.totalRules,
        mediaQueries: cssRes.mediaQueriesCount,
      });

      // --- STAGE 4: Asset Analysis ---
      setStep('Asset Discovery & Cataloging', AssetAnalysisWorker.workerName, 'started');
      const assetWorker = new AssetAnalysisWorker();
      const assetRes = await assetWorker.execute(initialHtml, initialCss, url);
      totalTokensUsed += PricingService.getCost('asset_analysis');
      setStep('Asset Discovery & Cataloging', AssetAnalysisWorker.workerName, 'completed', PricingService.getCost('asset_analysis'), {
        totalAssets: assetRes.totalAssets,
        images: assetRes.imageCount,
        fonts: assetRes.fontCount,
      });

      // --- STAGE 5: Visual Segmentation & Section Archetypes ---
      setStep('Visual Section Segmentation', VisualSegmentationWorker.workerName, 'started');
      const segWorker = new VisualSegmentationWorker();
      let segRes = await segWorker.execute(domRes.cleanedHtml);

      // Section Isolation: If options.sectionSelector or options.sectionHtml is provided, isolate target section
      let targetSectionHtml = options.sectionHtml;
      if (options.htmlSnapshot && options.htmlSnapshot.length > 50) {
        try {
          const $snap = cheerio.load(options.htmlSnapshot);
          const defaultSelector = options.targetArchetype === 'navbar'
            ? 'header, nav, [role="banner"], [role="navigation"]'
            : options.targetArchetype === 'hero'
            ? '[class*="hero"], [class*="banner"], main > section:first-of-type, [role="main"] > section:first-of-type, main > div:first-of-type, [role="main"] > div:first-of-type, body > section:first-of-type, section:first-of-type'
            : 'section';
          const effectiveSelector = options.sectionSelector || defaultSelector;
          const snapTarget = $snap(effectiveSelector).first();
          if (snapTarget.length > 0) {
            const snapMenus = snapTarget.find('[role="menu"], [data-baseweb="menu"], [class*="menu"], [class*="dropdown"], [class*="submenu"]').length;
            const $cur = cheerio.load(targetSectionHtml || '');
            const curMenus = $cur('[role="menu"], [data-baseweb="menu"], [class*="menu"], [class*="dropdown"], [class*="submenu"]').length;
            if (snapMenus > curMenus) {
              targetSectionHtml = $snap.html(snapTarget) || targetSectionHtml;
            }
          }
        } catch {}
      }

      if (targetSectionHtml) {
        segRes = {
          totalSections: 1,
          sections: [
            {
              id: `sec_${uuidv4().replace(/-/g, '').slice(0, 16)}`,
              index: 0,
              selector: options.sectionSelector || 'section',
              tagName: options.targetArchetype === 'navbar' ? 'nav' : 'section',
              archetype: (options.targetArchetype as any) || 'generic-section',
              confidence: 1.0,
              html: targetSectionHtml,
              rect: { x: 0, y: 0, width: 1440, height: 600 },
            },
          ],
        };
      } else if (options.sectionSelector) {
        const $ = cheerio.load(domRes.cleanedHtml);
        const match = $(options.sectionSelector).first();
        if (match.length > 0) {
          const matchedHtml = $.html(match);
          const tag = (match[0] as any).tagName ? (match[0] as any).tagName.toLowerCase() : 'section';
          segRes = {
            totalSections: 1,
            sections: [
              {
                id: `sec_${uuidv4().replace(/-/g, '').slice(0, 16)}`,
                index: 0,
                selector: options.sectionSelector,
                tagName: tag,
                archetype: (options.targetArchetype as any) || 'generic-section',
                confidence: 1.0,
                html: matchedHtml,
                rect: { x: 0, y: 0, width: 1440, height: 600 },
              },
            ],
          };
        }
      }

      totalTokensUsed += PricingService.getCost('visual_segmentation');
      setStep('Visual Section Segmentation', VisualSegmentationWorker.workerName, 'completed', PricingService.getCost('visual_segmentation'), {
        sectionsDetected: segRes.totalSections,
        isSectionIsolated: !!(options.sectionSelector || options.sectionHtml),
      });

      // Save sections to database if projectId is given
      if (job.project_id) {
        for (const sec of segRes.sections) {
          try {
            this.db.prepare(`
              INSERT OR REPLACE INTO sections (
                section_id, project_id, source_url, selector, tag_name, dom_representation,
                css_representation, asset_metadata, viewport_observations, visual_representation, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `).run(
              sec.id,
              job.project_id,
              url,
              sec.selector,
              sec.tagName,
              sec.html,
              null,
              null,
              null,
              null
            );
          } catch {}
        }
      }

      // --- STAGE 6: Deterministic Reconstruction ---
      setStep('Deterministic Code Reconstruction', ReconstructionWorker.workerName, 'started');
      const recWorker = new ReconstructionWorker();
      const recRes = await recWorker.execute(
        domRes.cleanedHtml,
        initialCss || cssRes.cleanCss,
        '',
        segRes.sections,
        url,
        options.targetArchetype,
        options.htmlSnapshot,
        options.recordedInteractions
      );
      totalTokensUsed += PricingService.getCost('reconstruction');
      setStep('Deterministic Code Reconstruction', ReconstructionWorker.workerName, 'completed', PricingService.getCost('reconstruction'), {
        sectionsCount: recRes.sections.length,
        averageScore: recRes.averageScore,
      });

      // --- STAGE 7: Chromium Verification Render of Reconstructed Code ---
      setStep('Reconstructed Chromium Verification', ChromiumRenderWorker.workerName, 'started');
      const reconstructedRender = await renderWorker.execute(recRes.fullHtml, true, [
        { name: 'desktop', width: 1440, height: 900 },
      ]);
      setStep('Reconstructed Chromium Verification', ChromiumRenderWorker.workerName, 'completed');

      // --- STAGE 8: Visual Comparison & Difference Map ---
      setStep('Visual Difference Analysis', VisualComparisonWorker.workerName, 'started');
      const diffWorker = new VisualComparisonWorker();
      let fidelityScore = recRes.averageScore;
      if (!options.sectionSelector && !options.sectionHtml && baselineScreenshots['desktop'] && reconstructedRender.screenshots['desktop']) {
        const diffRes = await diffWorker.execute(
          baselineScreenshots['desktop'],
          reconstructedRender.screenshots['desktop'],
          'desktop'
        );
        fidelityScore = Math.max(recRes.averageScore, diffRes.matchPercentage);
      }
      totalTokensUsed += PricingService.getCost('visual_comparison');
      setStep('Visual Difference Analysis', VisualComparisonWorker.workerName, 'completed', PricingService.getCost('visual_comparison'), {
        fidelityScore,
        astQualityScore: recRes.averageScore,
      });

      // Strict Quality Gate: Score below 90 is NOT accepted, 0 tokens settled
      if (fidelityScore < 90 || !recRes.passed) {
        throw new Error(`QUALITY_THRESHOLD_NOT_MET: Quality score ${fidelityScore}% is below the strict threshold of 90%.`);
      }

      // --- STAGE 9: Iterative Optimization & Cost Control Loop ---
      setStep('Cost-Controlled Optimization Loop', OptimizationWorker.workerName, 'started');
      const optWorker = new OptimizationWorker();
      let optimizedHtml = recRes.fullHtml;
      let optimizedCss = recRes.fullCss;

      for (let iter = 1; iter <= limits.maxIterations; iter++) {
        // Check cost control budget
        const isExtensionRequest = !!(options.htmlSnapshot || options.sectionSelector || options.sectionHtml);
        const remainingBudget = isExtensionRequest ? 100 : job.estimated_tokens - totalTokensUsed;
        const optRes = await optWorker.executeIteration(optimizedHtml, optimizedCss, iter, remainingBudget, limits);

        if (optRes.tokenLimitReached) {
          // Pause job and set TOKEN_LIMIT_REACHED
          this.db.prepare(`
            UPDATE jobs 
            SET status = 'waiting', actual_tokens = ?, error_message = 'TOKEN_LIMIT_REACHED', updated_at = datetime('now')
            WHERE id = ?
          `).run(totalTokensUsed, jobId);

          setStep('Optimization Loop Paused', OptimizationWorker.workerName, 'started', 0, {
            reason: 'TOKEN_LIMIT_REACHED',
            iteration: iter,
          });
          return; // Allow user to resume later
        }

        totalTokensUsed += optRes.tokensConsumed;
        optimizedHtml = optRes.optimizedHtml;
        optimizedCss = optRes.optimizedCss;
      }
      setStep('Cost-Controlled Optimization Loop', OptimizationWorker.workerName, 'completed', limits.maxIterations);

      // --- STAGE 10: Persist Results & Package ---
      const recId = `rec_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
      this.db.prepare(`
        INSERT INTO reconstructions (
          id, project_id, job_id, section_id, html_content, css_content, js_content, fidelity_score, metadata_json, created_at
        ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        recId,
        job.project_id || null,
        jobId,
        optimizedHtml,
        optimizedCss,
        recRes.fullJs,
        fidelityScore,
        JSON.stringify({
          sections: recRes.sections.map((s) => ({ id: s.id, archetype: s.archetype })),
          tokensUsed: totalTokensUsed,
        })
      );

      // Package into ZIP and save
      const storageJobsDir = CONFIG.jobsDir || path.resolve(process.cwd(), 'storage', 'jobs');
      const jobFolder = path.join(storageJobsDir, jobId);
      fs.mkdirSync(jobFolder, { recursive: true });
      fs.writeFileSync(path.join(jobFolder, 'reconstruction.html'), optimizedHtml, 'utf8');
      fs.writeFileSync(path.join(jobFolder, 'reconstruction.css'), optimizedCss, 'utf8');

      // Write full-page preview files for instant previewing
      const fullPageDir = path.join(jobFolder, 'full-page');
      fs.mkdirSync(fullPageDir, { recursive: true });
      fs.writeFileSync(path.join(fullPageDir, 'index.html'), optimizedHtml, 'utf8');
      fs.writeFileSync(path.join(fullPageDir, 'style.css'), optimizedCss, 'utf8');
      fs.writeFileSync(path.join(fullPageDir, 'script.js'), recRes.fullJs || '', 'utf8');

      const completedNow = new Date().toISOString();
      const expiresAt = new Date(Date.now() + CONFIG.jobRetentionHours * 60 * 60 * 1000).toISOString();
      fs.writeFileSync(
        path.join(jobFolder, 'job.json'),
        JSON.stringify({
          id: jobId,
          url,
          options,
          status: 'completed',
          sectionCount: recRes.sections.length,
          fidelityScore,
          completedAt: completedNow,
          expiresAt,
        }, null, 2),
        'utf8'
      );

      // Create site-package.zip containing clean ground-up synthesized code
      const zipPath = path.join(jobFolder, 'site-package.zip');
      await new Promise<void>((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        output.on('close', () => resolve());
        archive.on('error', (err: any) => reject(err));
        archive.pipe(output);
        archive.append(optimizedHtml, { name: 'index.html' });
        archive.append(optimizedCss, { name: 'style.css' });
        if (recRes.fullJs) archive.append(recRes.fullJs, { name: 'script.js' });
        archive.finalize();
      }).catch((e) => console.warn('Failed to build site-package.zip:', e));

      // Export record
      const exportId = `exp_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
      this.db.prepare(`
        INSERT INTO exports (id, project_id, job_id, format, file_path, file_size, created_at)
        VALUES (?, ?, ?, 'html', ?, ?, datetime('now'))
      `).run(exportId, job.project_id || null, jobId, path.join(jobFolder, 'reconstruction.html'), Buffer.byteLength(optimizedHtml));

      // --- STAGE 11: Settle Token Reservation ---
      if (reservationId) {
        const isExt = !!(options.htmlSnapshot || options.sectionSelector || options.sectionHtml);
        const tokensToSettle = isExt ? 1 : Math.min(totalTokensUsed, job.estimated_tokens);
        this.tokenSvc.settleReservation(reservationId, tokensToSettle, {
          projectId: job.project_id,
          operation: 'reconstruction',
          fidelityScore,
        });
      }

      // Sync remaining balance back to authDb (auth.json) if user is bound to an ApiKey
      try {
        const userRow = this.db.prepare('SELECT email FROM users WHERE id = ?').get(job.user_id) as any;
        if (userRow?.email) {
          const keyRecord = authDb.getApiKeyByEmail(userRow.email);
          if (keyRecord) {
            const currentBal = this.tokenSvc.getUserBalance(job.user_id);
            keyRecord.tokensBalance = currentBal.available_tokens;
            keyRecord.tokensUsed += totalTokensUsed;
            keyRecord.updatedAt = completedNow;
            authDb.saveApiKey(keyRecord);
          }
        }
      } catch (syncErr: any) {
        console.warn('Failed to sync balance to authDb:', syncErr.message);
      }

      // Mark Job Completed
      const isExtJob = !!(options.htmlSnapshot || options.sectionSelector || options.sectionHtml);
      const finalTokens = isExtJob ? 1 : totalTokensUsed;
      this.db.prepare(`
        UPDATE jobs 
        SET status = 'completed', actual_tokens = ?, updated_at = ?, completed_at = ?
        WHERE id = ?
      `).run(finalTokens, completedNow, completedNow, jobId);

      console.log(`[JobQueue] Successfully completed job ${jobId} (Tokens reserved: ${job.estimated_tokens}, used: ${finalTokens})`);
    } catch (err: any) {
      console.error(`[JobQueue] Job ${jobId} failed:`, err);
      // Mark job failed
      this.db.prepare(`
        UPDATE jobs 
        SET status = 'failed', error_message = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(err.message || 'Pipeline execution failed', jobId);

      // Settle reservation with 0 usage or release so user is not unfairly penalized
      if (reservationId) {
        try {
          this.tokenSvc.releaseReservation(reservationId, 'job_execution_failed');
        } catch {}
      }
    }
  }
}

export const jobQueue = new JobQueue();
