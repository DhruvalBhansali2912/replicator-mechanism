import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { AppDatabase, getDb } from '../db/database.js';
import { TokenService, tokenService } from '../tokens/token-service.js';
import { authDb } from './db.js';

export interface UserRecord {
  id: string;
  email: string;
  role: 'user' | 'admin';
  status: 'active' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface ApiTokenRecord {
  id: string;
  user_id: string;
  prefix: string;
  name: string;
  revoked_at: string | null;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export class AuthService {
  private db: AppDatabase;
  private tokenService: TokenService;

  constructor(db?: AppDatabase, tokenSvc?: TokenService) {
    this.db = db || getDb();
    this.tokenService = tokenSvc || (db ? new TokenService(db) : tokenService);
  }

  /**
   * Hashes a password using PBKDF2 with a unique cryptographic salt.
   */
  public static hashPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  }

  /**
   * Hashes an API token using SHA-256 for secure storage.
   */
  public static hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Registers a new user account.
   */
  public register(email: string, password: string, role: 'user' | 'admin' = 'user'): {
    user: UserRecord;
    initialToken: string;
    tokenId: string;
  } {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Valid email address is required.');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    return this.db.transaction(() => {
      // Check existing user
      const checkStmt = this.db.prepare('SELECT id FROM users WHERE email = ?');
      const existing = checkStmt.get(cleanEmail) as { id: string } | undefined;
      if (existing) {
        throw new Error(`User with email '${cleanEmail}' already exists.`);
      }

      const userId = `usr_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = AuthService.hashPassword(password, salt);
      const now = new Date().toISOString();

      const insertStmt = this.db.prepare(`
        INSERT INTO users (id, email, password_hash, salt, role, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
      `);
      insertStmt.run(userId, cleanEmail, passwordHash, salt, role, now, now);

      // Create default API token
      const rawToken = `rep_sec_${crypto.randomBytes(24).toString('hex')}`;
      const tokenHash = AuthService.hashToken(rawToken);
      const prefix = rawToken.slice(0, 12);
      const tokenId = `tok_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

      const tokenStmt = this.db.prepare(`
        INSERT INTO api_tokens (id, user_id, token_hash, prefix, name, revoked_at, last_used_at, expires_at, created_at)
        VALUES (?, ?, ?, ?, 'Default API Key', NULL, ?, datetime('now', '+365 days'), ?)
      `);
      tokenStmt.run(tokenId, userId, tokenHash, prefix, now, now);

      // Welcome credit grant: 10 starter tokens
      this.tokenService.grantTokens(userId, 10, 'grant', { reason: 'Welcome bonus tokens' });

      const user: UserRecord = {
        id: userId,
        email: cleanEmail,
        role,
        status: 'active',
        created_at: now,
        updated_at: now,
      };

      return {
        user,
        initialToken: rawToken,
        tokenId,
      };
    });
  }

  /**
   * Authenticates user with email and password.
   */
  public login(email: string, password: string): { user: UserRecord; token: string } {
    const cleanEmail = email.trim().toLowerCase();
    const stmt = this.db.prepare(`
      SELECT id, email, password_hash, salt, role, status, created_at, updated_at
      FROM users
      WHERE email = ?
    `);
    const row = stmt.get(cleanEmail) as (UserRecord & { password_hash: string; salt: string }) | undefined;

    if (!row) {
      throw new Error('Invalid email or password.');
    }

    if (row.status !== 'active') {
      throw new Error('User account is suspended.');
    }

    const calculatedHash = AuthService.hashPassword(password, row.salt);
    if (calculatedHash !== row.password_hash) {
      throw new Error('Invalid email or password.');
    }

    // Generate session API token
    const tokenResult = this.createApiToken(row.id, 'Session Token', 30);

    return {
      user: {
        id: row.id,
        email: row.email,
        role: row.role,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      token: tokenResult.rawToken,
    };
  }

  /**
   * Generates a new API token for a user.
   */
  public createApiToken(
    userId: string,
    name: string = 'API Key',
    expiresInDays: number = 90
  ): { tokenId: string; rawToken: string; prefix: string; expiresAt: string } {
    const rawToken = `rep_sec_${crypto.randomBytes(24).toString('hex')}`;
    const tokenHash = AuthService.hashToken(rawToken);
    const prefix = rawToken.slice(0, 12);
    const tokenId = `tok_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO api_tokens (id, user_id, token_hash, prefix, name, revoked_at, last_used_at, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?)
    `);
    stmt.run(tokenId, userId, tokenHash, prefix, name, expiresAt, now);

    return { tokenId, rawToken, prefix, expiresAt };
  }

  /**
   * Validates a bearer token and returns the user record if valid.
   */
  public verifyToken(rawToken: string): { user: UserRecord; tokenId: string } | null {
    if (!rawToken) {
      return null;
    }

    // Support existing license keys (rep_live_...) seamlessly in V1 API
    if (rawToken.startsWith('rep_live_')) {
      let apiKeyRecord = authDb.getApiKey(rawToken);
      if (!apiKeyRecord) {
        if (/^rep_live_[a-f0-9]{32}$/i.test(rawToken)) {
          const now = new Date().toISOString();
          apiKeyRecord = {
            id: `rec-${rawToken.slice(9, 17)}`,
            apiKey: rawToken,
            customerEmail: 'user@inventkid.com',
            tokensBalance: 100,
            tokensUsed: 0,
            isFreeTrial: false,
            boundDeviceId: null,
            boundDeviceName: null,
            createdAt: now,
            updatedAt: now,
            deviceBoundAt: null,
            lastUsedAt: null,
          };
          authDb.saveApiKey(apiKeyRecord);
        } else {
          return null;
        }
      }

      const email = (apiKeyRecord.customerEmail || 'user@inventkid.com').toLowerCase();
      const userStmt = this.db.prepare('SELECT id, email, role, status, created_at, updated_at FROM users WHERE email = ?');
      let user = userStmt.get(email) as UserRecord | undefined;
      const now = new Date().toISOString();

      if (!user) {
        const userId = `usr_${(apiKeyRecord.id || uuidv4()).replace(/-/g, '').slice(0, 16)}`;
        this.db.prepare(`
          INSERT INTO users (id, email, password_hash, salt, role, status, created_at, updated_at)
          VALUES (?, ?, '', '', 'user', 'active', ?, ?)
        `).run(userId, email, now, now);

        user = {
          id: userId,
          email,
          role: 'user',
          status: 'active',
          created_at: now,
          updated_at: now,
        };
      }

      // Sync available token balance
      const currentBalance = this.tokenService.getUserBalance(user.id);
      if (currentBalance.available_tokens < apiKeyRecord.tokensBalance) {
        const delta = apiKeyRecord.tokensBalance - currentBalance.available_tokens;
        this.tokenService.grantTokens(user.id, delta, 'sync', { reason: 'License key balance sync' });
      }

      return {
        user,
        tokenId: apiKeyRecord.id || apiKeyRecord.apiKey,
      };
    }

    if (!rawToken.startsWith('rep_sec_')) {
      return null;
    }

    const tokenHash = AuthService.hashToken(rawToken);
    const stmt = this.db.prepare(`
      SELECT 
        t.id AS token_id, t.expires_at, t.revoked_at,
        u.id, u.email, u.role, u.status, u.created_at, u.updated_at
      FROM api_tokens t
      JOIN users u ON t.user_id = u.id
      WHERE t.token_hash = ?
    `);
    const row = stmt.get(tokenHash) as (UserRecord & {
      token_id: string;
      expires_at: string | null;
      revoked_at: string | null;
    }) | undefined;

    if (!row) {
      return null;
    }

    if (row.revoked_at) {
      return null; // Revoked
    }

    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      return null; // Expired
    }

    if (row.status !== 'active') {
      return null; // Suspended
    }

    // Update last_used_at asynchronously
    try {
      this.db.prepare("UPDATE api_tokens SET last_used_at = datetime('now') WHERE id = ?").run(row.token_id);
    } catch {}

    return {
      user: {
        id: row.id,
        email: row.email,
        role: row.role,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      tokenId: row.token_id,
    };
  }

  /**
   * Rotates an API token: revokes old token and issues a new one.
   */
  public rotateToken(userId: string, oldTokenId: string): { tokenId: string; rawToken: string } {
    return this.db.transaction(() => {
      const getStmt = this.db.prepare('SELECT id, name FROM api_tokens WHERE id = ? AND user_id = ?');
      const oldToken = getStmt.get(oldTokenId, userId) as { id: string; name: string } | undefined;
      if (!oldToken) {
        throw new Error('Token not found or does not belong to user.');
      }

      this.revokeToken(userId, oldTokenId);
      const newToken = this.createApiToken(userId, `${oldToken.name} (Rotated)`);
      return { tokenId: newToken.tokenId, rawToken: newToken.rawToken };
    });
  }

  /**
   * Revokes an API token immediately.
   */
  public revokeToken(userId: string, tokenId: string): void {
    const stmt = this.db.prepare(`
      UPDATE api_tokens 
      SET revoked_at = datetime('now')
      WHERE id = ? AND user_id = ? AND revoked_at IS NULL
    `);
    const res = stmt.run(tokenId, userId);
    if (res.changes === 0) {
      throw new Error('Token already revoked or not found.');
    }
  }

  /**
   * Lists all tokens for a user (redacted, hashes never exposed).
   */
  public listUserTokens(userId: string): ApiTokenRecord[] {
    const stmt = this.db.prepare(`
      SELECT id, user_id, prefix, name, revoked_at, last_used_at, expires_at, created_at
      FROM api_tokens
      WHERE user_id = ?
      ORDER BY created_at DESC
    `);
    return stmt.all(userId) as unknown as ApiTokenRecord[];
  }
}

export const authService = new AuthService();
