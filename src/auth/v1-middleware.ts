import { Request, Response, NextFunction } from 'express';
import { authService, UserRecord } from './auth-service.js';

export interface V1AuthenticatedRequest extends Request {
  user?: UserRecord;
  tokenId?: string;
  deviceId?: string;
  deviceName?: string;
}

// In-memory sliding window rate limiter
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitBucket>();

/**
 * Sliding window rate limiting middleware.
 * Configurable max requests per windowMs.
 */
export function createRateLimiter(maxRequests: number = 120, windowMs: number = 60000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = (req.headers['x-forwarded-for'] as string) || (req.socket?.remoteAddress) || '127.0.0.1';
    const now = Date.now();
    let bucket = rateLimitMap.get(key);

    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 1, resetAt: now + windowMs };
      rateLimitMap.set(key, bucket);
    } else {
      bucket.count++;
      if (bucket.count > maxRequests) {
        res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please slow down and try again shortly.',
          retryAfterMs: bucket.resetAt - now,
        });
        return;
      }
    }
    next();
  };
}

/**
 * Bearer Token authentication middleware for /api/v1.
 * Requires "Authorization: Bearer <TOKEN>"
 */
export function requireBearerAuth(
  req: V1AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authorization header with Bearer token is required (e.g. Authorization: Bearer rep_sec_...).',
    });
    return;
  }

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    res.status(401).json({
      error: 'INVALID_AUTH_FORMAT',
      message: 'Format must be "Bearer <TOKEN>".',
    });
    return;
  }

  const token = parts[1];
  const authResult = authService.verifyToken(token);

  if (!authResult) {
    res.status(401).json({
      error: 'INVALID_OR_REVOKED_TOKEN',
      message: 'The provided API token is invalid, expired, or has been revoked.',
    });
    return;
  }

  req.user = authResult.user;
  req.tokenId = authResult.tokenId;
  req.deviceId = (req.headers['x-device-id'] as string) || 'UNKNOWN_DEVICE';
  req.deviceName = (req.headers['x-device-name'] as string) || 'Client Application';

  next();
}

/**
 * Ensures authenticated user has administrative privileges.
 */
export function requireAdmin(
  req: V1AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Administrator privilege is required for this endpoint.',
    });
    return;
  }
  next();
}
