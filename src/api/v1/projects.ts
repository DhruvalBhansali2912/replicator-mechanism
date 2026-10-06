import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../../db/database.js';
import { requireBearerAuth, V1AuthenticatedRequest } from '../../auth/v1-middleware.js';

export const projectsRouter = Router();

// List user projects
projectsRouter.get('/', requireBearerAuth, (req: V1AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT p.*, 
      (SELECT COUNT(*) FROM sections WHERE project_id = p.id) AS section_count,
      (SELECT COUNT(*) FROM reconstructions WHERE project_id = p.id) AS reconstruction_count
    FROM projects p
    WHERE p.user_id = ?
    ORDER BY p.updated_at DESC
  `);
  const projects = stmt.all(req.user!.id);
  res.json({ success: true, projects });
});

// Create project
projectsRouter.post('/', requireBearerAuth, (req: V1AuthenticatedRequest, res: Response): void => {
  const { name, description, sourceUrl } = req.body;
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'INVALID_PROJECT', message: 'Project "name" is required.' });
    return;
  }

  const db = getDb();
  const id = `prj_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO projects (id, user_id, name, description, source_url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user!.id, name.trim(), description || null, sourceUrl || null, now, now);

  res.status(201).json({
    success: true,
    project: {
      id,
      userId: req.user!.id,
      name: name.trim(),
      description,
      sourceUrl,
      createdAt: now,
      updatedAt: now,
    },
  });
});

// Get project by ID
projectsRouter.get('/:id', requireBearerAuth, (req: V1AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?');
  const project = stmt.get(req.params.id, req.user!.id);

  if (!project) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Project not found.' });
    return;
  }

  // Fetch sections
  const sections = db.prepare('SELECT * FROM sections WHERE project_id = ?').all(req.params.id);
  // Fetch reconstructions
  const reconstructions = db.prepare('SELECT id, fidelity_score, metadata_json, created_at FROM reconstructions WHERE project_id = ?').all(req.params.id);
  // Fetch token usage for this project
  const usage = db.prepare('SELECT operation, tokens_used, created_at FROM usage WHERE project_id = ?').all(req.params.id);

  res.json({
    success: true,
    project,
    sections,
    reconstructions,
    tokenUsage: usage,
  });
});

// Update project
projectsRouter.patch('/:id', requireBearerAuth, (req: V1AuthenticatedRequest, res: Response): void => {
  const { name, description, sourceUrl } = req.body;
  const db = getDb();

  const updates: string[] = [];
  const params: any[] = [];

  if (name) {
    updates.push('name = ?');
    params.push(name.trim());
  }
  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description);
  }
  if (sourceUrl !== undefined) {
    updates.push('source_url = ?');
    params.push(sourceUrl);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: 'NO_UPDATES', message: 'No fields to update.' });
    return;
  }

  updates.push("updated_at = datetime('now')");
  params.push(req.params.id, req.user!.id);

  const resDb = db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...params);
  if (resDb.changes === 0) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Project not found.' });
    return;
  }

  res.json({ success: true, message: 'Project updated.' });
});

// Delete project
projectsRouter.delete('/:id', requireBearerAuth, (req: V1AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const resDb = db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  if (resDb.changes === 0) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Project not found.' });
    return;
  }
  res.json({ success: true, message: 'Project deleted.' });
});
