import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../db/database.js';
import { requireBearerAuth, V1AuthenticatedRequest } from '../../auth/v1-middleware.js';
import { synthesisEngine } from '../../synthesis/engine.js';
import { tokenService } from '../../tokens/token-service.js';
import { PricingService } from '../../tokens/pricing.js';

export const sectionsRouter = Router();

// List sections for a project
sectionsRouter.get('/', requireBearerAuth, (req: V1AuthenticatedRequest, res: Response): void => {
  const projectId = req.query.projectId as string;
  if (!projectId) {
    res.status(400).json({ error: 'MISSING_PROJECT_ID', message: 'Query parameter "projectId" is required.' });
    return;
  }

  const db = getDb();
  // Ensure user owns project
  const prj = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(projectId, req.user!.id);
  if (!prj) {
    res.status(404).json({ error: 'PROJECT_NOT_FOUND', message: 'Project not found.' });
    return;
  }

  const sections = db.prepare(`
    SELECT section_id, project_id, source_url, selector, tag_name, created_at
    FROM sections WHERE project_id = ? ORDER BY created_at ASC
  `).all(projectId);

  res.json({ success: true, sections });
});

// Create/Store selected section
sectionsRouter.post('/', requireBearerAuth, (req: V1AuthenticatedRequest, res: Response): void => {
  const {
    projectId,
    sourceUrl,
    selector,
    tagName,
    domRepresentation,
    cssRepresentation,
    assetMetadata,
    viewportObservations,
    visualRepresentation,
  } = req.body;

  if (!projectId || !sourceUrl || !selector || !tagName) {
    res.status(400).json({
      error: 'MISSING_REQUIRED_FIELDS',
      message: 'Fields "projectId", "sourceUrl", "selector", and "tagName" are required.',
    });
    return;
  }

  const db = getDb();
  const prj = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(projectId, req.user!.id);
  if (!prj) {
    res.status(404).json({ error: 'PROJECT_NOT_FOUND', message: 'Project not found.' });
    return;
  }

  const sectionId = `sec_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO sections (
      section_id, project_id, source_url, selector, tag_name, dom_representation,
      css_representation, asset_metadata, viewport_observations, visual_representation, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sectionId,
    projectId,
    sourceUrl,
    selector,
    tagName,
    domRepresentation || null,
    cssRepresentation || null,
    assetMetadata ? JSON.stringify(assetMetadata) : null,
    viewportObservations ? JSON.stringify(viewportObservations) : null,
    visualRepresentation || null,
    now
  );

  res.status(201).json({
    success: true,
    section: {
      sectionId,
      projectId,
      sourceUrl,
      selector,
      tagName,
      createdAt: now,
    },
  });
});

// Get specific section details
sectionsRouter.get('/:id', requireBearerAuth, (req: V1AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT s.* 
    FROM sections s
    JOIN projects p ON s.project_id = p.id
    WHERE s.section_id = ? AND p.user_id = ?
  `);
  const section = stmt.get(req.params.id, req.user!.id) as any;

  if (!section) {
    res.status(404).json({ error: 'SECTION_NOT_FOUND', message: 'Section not found.' });
    return;
  }

  // Parse JSON payloads if present
  if (section.asset_metadata) {
    try { section.asset_metadata = JSON.parse(section.asset_metadata); } catch {}
  }
  if (section.viewport_observations) {
    try { section.viewport_observations = JSON.parse(section.viewport_observations); } catch {}
  }

  res.json({ success: true, section });
});

// Delete section
sectionsRouter.delete('/:id', requireBearerAuth, (req: V1AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const section = db.prepare(`
    SELECT s.section_id
    FROM sections s
    JOIN projects p ON s.project_id = p.id
    WHERE s.section_id = ? AND p.user_id = ?
  `).get(req.params.id, req.user!.id);

  if (!section) {
    res.status(404).json({ error: 'SECTION_NOT_FOUND', message: 'Section not found.' });
    return;
  }

  db.prepare('DELETE FROM sections WHERE section_id = ?').run(req.params.id);
  res.json({ success: true, message: 'Section deleted.' });
});

// Ground-Up Section Synthesis & Quality Scoring (Fidelity >= 90 required)
sectionsRouter.post('/synthesize', requireBearerAuth, (req: V1AuthenticatedRequest, res: Response): void => {
  const { html, sourceUrl, cssContext, selector } = req.body;

  if (!html || typeof html !== 'string') {
    res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'Field "html" is required.' });
    return;
  }

  const cost = PricingService.getCost('analyze_section');
  const balance = tokenService.getUserBalance(req.user!.id);
  if (balance.available_tokens < cost) {
    res.status(402).json({ error: 'INSUFFICIENT_TOKENS', message: `Section synthesis requires ${cost} token.` });
    return;
  }

  try {
    const synthesized = synthesisEngine.synthesizeSection(
      html,
      sourceUrl || 'https://example.com',
      cssContext || '',
      selector || 'section'
    );

    // If score is below 90, do NOT deduct tokens and report failure
    if (!synthesized.scoring.passed) {
      res.status(422).json({
        success: false,
        error: 'QUALITY_THRESHOLD_NOT_MET',
        message: `Quality score ${synthesized.scoring.totalScore}% is below the strict threshold of 90%. No tokens were deducted.`,
        scoring: synthesized.scoring,
      });
      return;
    }

    // Atomically settle token deduction for successful synthesis
    const { reservationId } = tokenService.reserveTokens(req.user!.id, 'adhoc_synthesis', 'analyze_section', cost);
    tokenService.settleReservation(reservationId, cost, { operation: 'analyze_section', archetype: synthesized.archetype });

    res.json({
      success: true,
      sectionId: synthesized.sectionId,
      archetype: synthesized.archetype,
      tokensUsed: cost,
      scoring: synthesized.scoring,
      code: {
        html: synthesized.html,
        css: synthesized.css,
        js: synthesized.js,
      },
      interactiveFeatures: synthesized.interactiveFeatures,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'SYNTHESIS_FAILED', message: err.message });
  }
});
