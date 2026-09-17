import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config.js';
import { ApiKeyRecord, ClaimedDeviceRecord, AuditLogRecord, AuthDatabaseSchema } from './types.js';

export class AuthDatabase {
  private dbPath: string;
  private data: AuthDatabaseSchema;

  constructor() {
    this.dbPath = path.join(CONFIG.storageDir, 'auth.json');
    this.data = this.load();
  }

  private load(): AuthDatabaseSchema {
    if (!fs.existsSync(CONFIG.storageDir)) {
      fs.mkdirSync(CONFIG.storageDir, { recursive: true });
    }

    if (fs.existsSync(this.dbPath)) {
      try {
        const raw = fs.readFileSync(this.dbPath, 'utf8');
        const parsed = JSON.parse(raw);
        return {
          apiKeys: Array.isArray(parsed.apiKeys) ? parsed.apiKeys : [],
          claimedDevices: Array.isArray(parsed.claimedDevices) ? parsed.claimedDevices : [],
          auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
        };
      } catch (err) {
        console.error('Failed to parse auth.json, initializing empty db:', err);
      }
    }

    const initial: AuthDatabaseSchema = {
      apiKeys: [],
      claimedDevices: [],
      auditLogs: [],
    };
    this.save(initial);
    return initial;
  }

  private save(dataToSave?: AuthDatabaseSchema): void {
    const data = dataToSave || this.data;
    const tempPath = `${this.dbPath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, this.dbPath);
  }

  public getApiKey(key: string): ApiKeyRecord | undefined {
    return this.data.apiKeys.find((k) => k.apiKey === key);
  }

  public getApiKeyByEmail(email: string): ApiKeyRecord | undefined {
    const norm = email.trim().toLowerCase();
    return this.data.apiKeys.find((k) => k.customerEmail.toLowerCase() === norm);
  }

  public getClaimedDevice(deviceId: string): ClaimedDeviceRecord | undefined {
    return this.data.claimedDevices.find((d) => d.deviceId === deviceId);
  }

  public saveApiKey(record: ApiKeyRecord): void {
    const idx = this.data.apiKeys.findIndex((k) => k.id === record.id);
    if (idx >= 0) {
      this.data.apiKeys[idx] = record;
    } else {
      this.data.apiKeys.push(record);
    }
    this.save();
  }

  public registerClaimedDevice(record: ClaimedDeviceRecord): void {
    const idx = this.data.claimedDevices.findIndex((d) => d.deviceId === record.deviceId);
    if (idx < 0) {
      this.data.claimedDevices.push(record);
      this.save();
    }
  }

  public logAudit(log: AuditLogRecord): void {
    this.data.auditLogs.push(log);
    // Keep max 10,000 audit entries
    if (this.data.auditLogs.length > 10000) {
      this.data.auditLogs = this.data.auditLogs.slice(-5000);
    }
    this.save();
  }

  public getAllKeys(): ApiKeyRecord[] {
    return [...this.data.apiKeys];
  }

  public getAuditLogs(): AuditLogRecord[] {
    return [...this.data.auditLogs];
  }
}

export const authDb = new AuthDatabase();
