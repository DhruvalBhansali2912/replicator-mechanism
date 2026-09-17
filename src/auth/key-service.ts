import crypto from 'crypto';
import { authDb } from './db.js';
import { ApiKeyRecord } from './types.js';

export class KeyService {
  /**
   * Credits tokens to an API key or creates a new key if the email has none.
   */
  public creditKey(params: {
    email: string;
    tokens: number;
    orderId?: string | number;
    isFreeTrial?: boolean;
  }): { apiKey: string; balance: number; isNew: boolean; customerEmail: string } {
    const { email, tokens, orderId, isFreeTrial = false } = params;
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('INVALID_EMAIL: A valid customer email is required.');
    }

    if (typeof tokens !== 'number' || tokens <= 0) {
      throw new Error('INVALID_TOKENS: Token amount must be greater than zero.');
    }

    let record = authDb.getApiKeyByEmail(cleanEmail);
    const now = new Date().toISOString();

    if (record) {
      // If user tries to claim a second free trial on the same account
      if (isFreeTrial && record.isFreeTrial) {
        throw new Error('TRIAL_ALREADY_CLAIMED: This customer account has already claimed their free trial tokens.');
      }

      record.tokensBalance += tokens;
      record.updatedAt = now;
      authDb.saveApiKey(record);

      authDb.logAudit({
        id: crypto.randomUUID(),
        apiKey: record.apiKey,
        action: 'credit',
        delta: tokens,
        balanceAfter: record.tokensBalance,
        reason: orderId ? `Order #${orderId} completed` : 'Token credit top-up',
        timestamp: now,
      });

      return {
        apiKey: record.apiKey,
        balance: record.tokensBalance,
        isNew: false,
        customerEmail: record.customerEmail,
      };
    }

    // Generate brand new API key
    const newApiKey = `rep_live_${crypto.randomBytes(16).toString('hex')}`;
    const newRecord: ApiKeyRecord = {
      id: crypto.randomUUID(),
      apiKey: newApiKey,
      customerEmail: cleanEmail,
      tokensBalance: tokens,
      tokensUsed: 0,
      boundDeviceId: null,
      boundDeviceName: null,
      isFreeTrial: !!isFreeTrial,
      deviceBoundAt: null,
      lastUsedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    authDb.saveApiKey(newRecord);

    authDb.logAudit({
      id: crypto.randomUUID(),
      apiKey: newApiKey,
      action: 'credit',
      delta: tokens,
      balanceAfter: tokens,
      reason: orderId ? `Initial key creation from Order #${orderId}` : 'Initial key issuance',
      timestamp: now,
    });

    return {
      apiKey: newApiKey,
      balance: tokens,
      isNew: true,
      customerEmail: cleanEmail,
    };
  }

  /**
   * Verifies the API key and handles first-time hardware device binding.
   * Also protects against free trial abuse across burner emails on the same device.
   */
  public verifyAndBindDevice(
    apiKey: string,
    deviceId: string,
    deviceName?: string
  ): {
    valid: boolean;
    error?: string;
    message?: string;
    apiKey?: string;
    balance?: number;
    email?: string;
    isFreeTrial?: boolean;
    boundDeviceId?: string | null;
  } {
    if (!apiKey || !deviceId) {
      return {
        valid: false,
        error: 'MISSING_CREDENTIALS',
        message: 'Both X-API-Key and X-Device-Id are required.',
      };
    }

    const record = authDb.getApiKey(apiKey.trim());
    if (!record) {
      return {
        valid: false,
        error: 'INVALID_API_KEY',
        message: 'The provided API key does not exist or has been revoked.',
      };
    }

    const now = new Date().toISOString();

    // 1. If key is not yet bound to any device, attempt binding
    if (!record.boundDeviceId) {
      // Anti-abuse check: if this is a free trial key, verify that this device has not claimed a free trial before
      if (record.isFreeTrial) {
        const claimed = authDb.getClaimedDevice(deviceId);
        if (claimed && claimed.firstApiKey !== record.apiKey) {
          return {
            valid: false,
            error: 'TRIAL_ALREADY_USED_ON_DEVICE',
            message:
              'This device/browser has already activated a free trial. Please purchase tokens on inventkid.com to continue.',
          };
        }

        // Register this device as having used a free trial
        authDb.registerClaimedDevice({
          deviceId,
          firstEmail: record.customerEmail,
          firstApiKey: record.apiKey,
          claimedAt: now,
        });
      }

      // Bind key to device
      record.boundDeviceId = deviceId;
      record.boundDeviceName = deviceName || 'Chrome Browser';
      record.deviceBoundAt = now;
      record.updatedAt = now;
      authDb.saveApiKey(record);

      authDb.logAudit({
        id: crypto.randomUUID(),
        apiKey: record.apiKey,
        action: 'bind_device',
        delta: 0,
        balanceAfter: record.tokensBalance,
        reason: `Bound to device ${deviceId} (${record.boundDeviceName})`,
        timestamp: now,
      });
    } else if (record.boundDeviceId !== deviceId) {
      // Key was previously bound to another device.
      // Auto-transfer device binding to current device upon explicit license activation.
      const oldDevice = record.boundDeviceId;
      record.boundDeviceId = deviceId;
      record.boundDeviceName = deviceName || 'Chrome Browser';
      record.deviceBoundAt = now;
      record.updatedAt = now;
      authDb.saveApiKey(record);

      authDb.logAudit({
        id: crypto.randomUUID(),
        apiKey: record.apiKey,
        action: 'bind_device',
        delta: 0,
        balanceAfter: record.tokensBalance,
        reason: `Transferred device binding from ${oldDevice} to ${deviceId} (${record.boundDeviceName})`,
        timestamp: now,
      });
    }

    return {
      valid: true,
      apiKey: record.apiKey,
      balance: record.tokensBalance,
      email: record.customerEmail,
      isFreeTrial: record.isFreeTrial,
      boundDeviceId: record.boundDeviceId,
    };
  }

  /**
   * Atomically decrements 1 token upon successful extraction.
   */
  public deductToken(apiKey: string, jobId: string): number {
    const record = authDb.getApiKey(apiKey.trim());
    if (!record) {
      throw new Error('INVALID_API_KEY: Key not found.');
    }

    if (record.tokensBalance < 1) {
      throw new Error('INSUFFICIENT_TOKENS: You have 0 tokens remaining. Please purchase more tokens on inventkid.com.');
    }

    record.tokensBalance -= 1;
    record.tokensUsed += 1;
    record.lastUsedAt = new Date().toISOString();
    record.updatedAt = record.lastUsedAt;

    authDb.saveApiKey(record);

    authDb.logAudit({
      id: crypto.randomUUID(),
      apiKey: record.apiKey,
      action: 'deduct',
      delta: -1,
      balanceAfter: record.tokensBalance,
      reason: `Page extraction completed for job ${jobId}`,
      timestamp: record.lastUsedAt,
    });

    return record.tokensBalance;
  }

  /**
   * Resets device binding for a user (allowing migration to a new computer/browser).
   */
  public resetDevice(emailOrKey: string, reason = 'User requested device reset'): boolean {
    const clean = emailOrKey.trim();
    const record = clean.startsWith('rep_live_')
      ? authDb.getApiKey(clean)
      : authDb.getApiKeyByEmail(clean);

    if (!record) {
      throw new Error('KEY_NOT_FOUND: No matching API key found.');
    }

    record.boundDeviceId = null;
    record.boundDeviceName = null;
    record.deviceBoundAt = null;
    record.updatedAt = new Date().toISOString();

    authDb.saveApiKey(record);

    authDb.logAudit({
      id: crypto.randomUUID(),
      apiKey: record.apiKey,
      action: 'reset_device',
      delta: 0,
      balanceAfter: record.tokensBalance,
      reason,
      timestamp: record.updatedAt,
    });

    return true;
  }

  /**
   * Retrieves key details and current balance.
   */
  public getKeyDetails(apiKey: string): ApiKeyRecord | undefined {
    return authDb.getApiKey(apiKey.trim());
  }
}

export const keyService = new KeyService();
