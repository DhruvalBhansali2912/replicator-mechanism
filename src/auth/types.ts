export interface ApiKeyRecord {
  id: string;
  apiKey: string;
  customerEmail: string;
  tokensBalance: number;
  tokensUsed: number;
  boundDeviceId: string | null;
  boundDeviceName: string | null;
  isFreeTrial: boolean;
  deviceBoundAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClaimedDeviceRecord {
  deviceId: string;
  firstEmail: string;
  firstApiKey: string;
  claimedAt: string;
}

export interface AuditLogRecord {
  id: string;
  apiKey: string;
  action: 'credit' | 'deduct' | 'bind_device' | 'reset_device';
  delta: number;
  balanceAfter: number;
  reason: string;
  timestamp: string;
}

export interface AuthDatabaseSchema {
  apiKeys: ApiKeyRecord[];
  claimedDevices: ClaimedDeviceRecord[];
  auditLogs: AuditLogRecord[];
}
