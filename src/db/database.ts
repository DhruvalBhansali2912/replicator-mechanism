import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { CONFIG } from '../config.js';

export interface DatabaseConfig {
  dbPath?: string;
  inMemory?: boolean;
}

export class AppDatabase {
  private db: DatabaseSync;
  private static instance: AppDatabase | null = null;
  private inTransaction = false;

  constructor(config: DatabaseConfig = {}) {
    if (config.inMemory) {
      this.db = new DatabaseSync(':memory:');
    } else {
      const storageDir = CONFIG.storageDir || path.resolve(process.cwd(), 'storage');
      fs.mkdirSync(storageDir, { recursive: true });
      const dbPath = config.dbPath || path.join(storageDir, 'app.db');
      this.db = new DatabaseSync(dbPath);
    }

    this.configurePragmas();
    this.initSchema();
  }

  public static getInstance(config?: DatabaseConfig): AppDatabase {
    if (!AppDatabase.instance || config?.inMemory) {
      const instance = new AppDatabase(config);
      if (!config?.inMemory) {
        AppDatabase.instance = instance;
      }
      return instance;
    }
    return AppDatabase.instance;
  }

  public static resetInstance(): void {
    if (AppDatabase.instance) {
      try {
        AppDatabase.instance.close();
      } catch {}
      AppDatabase.instance = null;
    }
  }

  private configurePragmas(): void {
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA synchronous = NORMAL;');
  }

  private initSchema(): void {
    const schemaSql = `
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user', -- 'user' | 'admin'
        status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'suspended'
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- API Tokens table
      CREATE TABLE IF NOT EXISTS api_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        prefix TEXT NOT NULL,
        name TEXT NOT NULL,
        revoked_at TEXT,
        last_used_at TEXT,
        expires_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Projects table
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        source_url TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Sections table
      CREATE TABLE IF NOT EXISTS sections (
        section_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        source_url TEXT NOT NULL,
        selector TEXT NOT NULL,
        tag_name TEXT NOT NULL,
        dom_representation TEXT,
        css_representation TEXT,
        asset_metadata TEXT,
        viewport_observations TEXT,
        visual_representation TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      -- Observations table
      CREATE TABLE IF NOT EXISTS observations (
        id TEXT PRIMARY KEY,
        section_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        viewport_width INTEGER NOT NULL,
        viewport_height INTEGER NOT NULL,
        bounding_box TEXT,
        computed_styles TEXT,
        is_visible INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        FOREIGN KEY (section_id) REFERENCES sections(section_id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      -- Viewports table
      CREATE TABLE IF NOT EXISTS viewports (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        device_scale_factor REAL NOT NULL DEFAULT 1.0,
        is_mobile INTEGER NOT NULL DEFAULT 0
      );

      -- Assets table
      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        section_id TEXT,
        original_url TEXT NOT NULL,
        local_path TEXT NOT NULL,
        asset_type TEXT NOT NULL, -- 'image' | 'font' | 'svg' | 'script' | 'stylesheet'
        mime_type TEXT,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (section_id) REFERENCES sections(section_id) ON DELETE SET NULL
      );

      -- Knowledge Base table
      CREATE TABLE IF NOT EXISTS knowledge_base (
        id TEXT PRIMARY KEY,
        archetype TEXT NOT NULL,
        selector_patterns TEXT NOT NULL,
        confidence_rules TEXT NOT NULL,
        version TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      -- Jobs table
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT,
        type TEXT NOT NULL, -- 'reconstruction' | 'analysis' | 'comparison' | 'optimization'
        status TEXT NOT NULL DEFAULT 'queued', -- 'queued' | 'processing' | 'waiting' | 'completed' | 'failed' | 'cancelled'
        priority INTEGER NOT NULL DEFAULT 0,
        estimated_tokens INTEGER NOT NULL DEFAULT 0,
        actual_tokens INTEGER NOT NULL DEFAULT 0,
        reservation_id TEXT,
        options_json TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
      );

      -- Job Steps table
      CREATE TABLE IF NOT EXISTS job_steps (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        step_name TEXT NOT NULL,
        worker_name TEXT NOT NULL,
        status TEXT NOT NULL, -- 'started' | 'completed' | 'failed' | 'skipped'
        tokens_consumed INTEGER NOT NULL DEFAULT 0,
        details_json TEXT,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
      );

      -- Token Reservations table
      CREATE TABLE IF NOT EXISTS token_reservations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        job_id TEXT,
        amount INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'settled' | 'refunded' | 'expired'
        expires_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Immutable Token Ledger table
      CREATE TABLE IF NOT EXISTS token_ledger (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT,
        job_id TEXT,
        operation TEXT NOT NULL,
        type TEXT NOT NULL, -- 'purchase' | 'grant' | 'reservation' | 'consumption' | 'refund' | 'expiration' | 'adjustment'
        amount INTEGER NOT NULL,
        balance_before INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'completed',
        metadata TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Usage reporting table
      CREATE TABLE IF NOT EXISTS usage (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT,
        job_id TEXT,
        operation TEXT NOT NULL,
        tokens_used INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Reconstructions table
      CREATE TABLE IF NOT EXISTS reconstructions (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        job_id TEXT NOT NULL,
        section_id TEXT,
        html_content TEXT,
        css_content TEXT,
        js_content TEXT,
        fidelity_score REAL NOT NULL DEFAULT 0,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
      );

      -- Exports table
      CREATE TABLE IF NOT EXISTS exports (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        job_id TEXT NOT NULL,
        format TEXT NOT NULL, -- 'zip' | 'html' | 'json'
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
      );

      -- Required Indexes
      CREATE INDEX IF NOT EXISTS idx_api_tokens_user_id ON api_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
      CREATE INDEX IF NOT EXISTS idx_sections_project_id ON sections(project_id);
      CREATE INDEX IF NOT EXISTS idx_observations_section_id ON observations(section_id);
      CREATE INDEX IF NOT EXISTS idx_observations_project_id ON observations(project_id);
      CREATE INDEX IF NOT EXISTS idx_assets_project_id ON assets(project_id);
      CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
      CREATE INDEX IF NOT EXISTS idx_jobs_project_id ON jobs(project_id);
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
      CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
      CREATE INDEX IF NOT EXISTS idx_job_steps_job_id ON job_steps(job_id);
      CREATE INDEX IF NOT EXISTS idx_token_reservations_user_id ON token_reservations(user_id);
      CREATE INDEX IF NOT EXISTS idx_token_reservations_job_id ON token_reservations(job_id);
      CREATE INDEX IF NOT EXISTS idx_token_reservations_status ON token_reservations(status);
      CREATE INDEX IF NOT EXISTS idx_token_ledger_user_id ON token_ledger(user_id);
      CREATE INDEX IF NOT EXISTS idx_token_ledger_project_id ON token_ledger(project_id);
      CREATE INDEX IF NOT EXISTS idx_token_ledger_job_id ON token_ledger(job_id);
      CREATE INDEX IF NOT EXISTS idx_token_ledger_created_at ON token_ledger(created_at);
      CREATE INDEX IF NOT EXISTS idx_token_ledger_type ON token_ledger(type);
      CREATE INDEX IF NOT EXISTS idx_usage_user_id ON usage(user_id);
      CREATE INDEX IF NOT EXISTS idx_usage_project_id ON usage(project_id);
      CREATE INDEX IF NOT EXISTS idx_usage_job_id ON usage(job_id);
      CREATE INDEX IF NOT EXISTS idx_usage_created_at ON usage(created_at);
      CREATE INDEX IF NOT EXISTS idx_reconstructions_project_id ON reconstructions(project_id);
      CREATE INDEX IF NOT EXISTS idx_reconstructions_job_id ON reconstructions(job_id);
      CREATE INDEX IF NOT EXISTS idx_exports_project_id ON exports(project_id);
      CREATE INDEX IF NOT EXISTS idx_exports_job_id ON exports(job_id);
    `;

    this.db.exec(schemaSql);

    // Schema migration: ensure project_id in reconstructions and exports allows NULL
    try {
      const recCols = this.db.prepare("PRAGMA table_info('reconstructions')").all() as any[];
      const prjCol = recCols.find((c: any) => c.name === 'project_id');
      if (prjCol && prjCol.notnull === 1) {
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS reconstructions_temp (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            job_id TEXT NOT NULL,
            section_id TEXT,
            html_content TEXT,
            css_content TEXT,
            js_content TEXT,
            fidelity_score REAL NOT NULL DEFAULT 0,
            metadata_json TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
            FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
          );
          INSERT INTO reconstructions_temp SELECT * FROM reconstructions;
          DROP TABLE reconstructions;
          ALTER TABLE reconstructions_temp RENAME TO reconstructions;
        `);
      }

      const expCols = this.db.prepare("PRAGMA table_info('exports')").all() as any[];
      const expPrjCol = expCols.find((c: any) => c.name === 'project_id');
      if (expPrjCol && expPrjCol.notnull === 1) {
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS exports_temp (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            job_id TEXT NOT NULL,
            format TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_size INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
            FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
          );
          INSERT INTO exports_temp SELECT * FROM exports;
          DROP TABLE exports;
          ALTER TABLE exports_temp RENAME TO exports;
        `);
      }
    } catch {}

    this.seedDefaultKnowledgeBase();
    this.seedDefaultViewports();
  }

  private seedDefaultKnowledgeBase(): void {
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM knowledge_base');
    const res = countStmt.get() as { count: number };
    if (res.count === 0) {
      const insertStmt = this.db.prepare(`
        INSERT INTO knowledge_base (id, archetype, selector_patterns, confidence_rules, version, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const defaults = [
        { id: 'kb_navbar', archetype: 'navbar', patterns: JSON.stringify(['header', 'nav', '[role="navigation"]', '.navbar', '.header']), rules: JSON.stringify({ position: 'top', minLinks: 2 }), version: '1.0.0' },
        { id: 'kb_hero', archetype: 'hero', patterns: JSON.stringify(['.hero', '#hero', 'section:first-of-type', '[data-section="hero"]']), rules: JSON.stringify({ hasH1: true, minHeight: 300 }), version: '1.0.0' },
        { id: 'kb_pricing', archetype: 'pricing', patterns: JSON.stringify(['.pricing', '#pricing', '[data-section="pricing"]', '.plans']), rules: JSON.stringify({ hasCurrency: true, minCards: 2 }), version: '1.0.0' },
        { id: 'kb_features', archetype: 'features', patterns: JSON.stringify(['.features', '#features', '.services', '.grid-features']), rules: JSON.stringify({ minCards: 3 }), version: '1.0.0' },
        { id: 'kb_testimonials', archetype: 'testimonials', patterns: JSON.stringify(['.testimonials', '#testimonials', '.reviews', '.quotes']), rules: JSON.stringify({ hasQuotes: true }), version: '1.0.0' },
        { id: 'kb_footer', archetype: 'footer', patterns: JSON.stringify(['footer', '#footer', '.footer', '[role="contentinfo"]']), rules: JSON.stringify({ position: 'bottom' }), version: '1.0.0' },
      ];
      const now = new Date().toISOString();
      for (const item of defaults) {
        insertStmt.run(item.id, item.archetype, item.patterns, item.rules, item.version, now);
      }
    }
  }

  private seedDefaultViewports(): void {
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM viewports');
    const res = countStmt.get() as { count: number };
    if (res.count === 0) {
      const insertStmt = this.db.prepare(`
        INSERT INTO viewports (id, name, width, height, device_scale_factor, is_mobile)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const defaults = [
        { id: 'vp_desktop', name: 'Desktop HD', width: 1440, height: 900, dsf: 1.0, isMobile: 0 },
        { id: 'vp_tablet', name: 'Tablet Portrait', width: 768, height: 1024, dsf: 2.0, isMobile: 1 },
        { id: 'vp_mobile', name: 'Mobile Standard', width: 390, height: 844, dsf: 3.0, isMobile: 1 },
      ];
      for (const vp of defaults) {
        insertStmt.run(vp.id, vp.name, vp.width, vp.height, vp.dsf, vp.isMobile);
      }
    }
  }

  public getRawDb(): DatabaseSync {
    return this.db;
  }

  public prepare(sql: string) {
    return this.db.prepare(sql);
  }

  public exec(sql: string): void {
    this.db.exec(sql);
  }

  public transaction<T>(callback: () => T): T {
    if (this.inTransaction) {
      return callback();
    }
    this.inTransaction = true;
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const result = callback();
      this.db.exec('COMMIT;');
      return result;
    } catch (err) {
      try {
        this.db.exec('ROLLBACK;');
      } catch {}
      throw err;
    } finally {
      this.inTransaction = false;
    }
  }

  public close(): void {
    this.db.close();
  }
}

export const getDb = (config?: DatabaseConfig): AppDatabase => AppDatabase.getInstance(config);
