import { Request, Response, NextFunction } from 'express';
import { CONFIG } from '../config.js';
import { keyService } from './key-service.js';
import { ApiKeyRecord } from './types.js';

export interface AuthenticatedRequest extends Request {
  apiKeyRecord?: ApiKeyRecord;
}

/**
 * Middleware ensuring request carries a valid Master Secret (used by WooCommerce).
 */
export function requireMasterSecret(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const masterSecretHeader = req.headers['x-master-secret'];

  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (typeof masterSecretHeader === 'string') {
    token = masterSecretHeader.trim();
  }

  if (!token || token !== CONFIG.masterSecret) {
    res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Invalid or missing Master Secret Authorization token.',
    });
    return;
  }

  next();
}

/**
 * Middleware ensuring request carries valid X-API-Key and X-Device-Id headers (used by Chrome Extension).
 */
export function requireApiKeyAndDevice(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const apiKey = (req.headers['x-api-key'] || req.query.apiKey) as string | undefined;
  const deviceId = (req.headers['x-device-id'] || req.query.deviceId) as string | undefined;
  const deviceName = req.headers['x-device-name'] as string | undefined;

  // For testing or backward compatibility in direct dashboard use, if no key provided and dashboard bypass is enabled
  if (!apiKey && req.path === '/api/extract' && req.headers['x-dashboard-request'] === 'true') {
    next();
    return;
  }

  if (!apiKey || !deviceId) {
    res.status(401).json({
      success: false,
      error: 'MISSING_CREDENTIALS',
      message: 'Both X-API-Key and X-Device-Id headers are required to authenticate.',
    });
    return;
  }

  const verifyResult = keyService.verifyAndBindDevice(apiKey, deviceId, deviceName);

  if (!verifyResult.valid) {
    res.status(403).json({
      success: false,
      error: verifyResult.error,
      message: verifyResult.message,
    });
    return;
  }

  const details = keyService.getKeyDetails(apiKey);
  if (!details) {
    res.status(403).json({
      success: false,
      error: 'KEY_NOT_FOUND',
      message: 'API key not found.',
    });
    return;
  }

  if (req.path === '/api/extract' && details.tokensBalance < 1) {
    res.status(402).json({
      success: false,
      error: 'INSUFFICIENT_TOKENS',
      message: 'You have 0 tokens remaining. Please purchase more tokens on inventkid.com.',
      balance: 0,
    });
    return;
  }

  req.apiKeyRecord = details;
  next();
}
