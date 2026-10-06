import { Router, Request, Response } from 'express';
import { authService } from '../../auth/auth-service.js';
import { requireBearerAuth, V1AuthenticatedRequest } from '../../auth/v1-middleware.js';

export const authRouter = Router();

// Register new user
authRouter.post('/register', (req: Request, res: Response): void => {
  try {
    const { email, password } = req.body;
    const result = authService.register(email, password);
    res.status(201).json({
      success: true,
      user: result.user,
      initialToken: result.initialToken,
      tokenId: result.tokenId,
      message: 'Account created with 10 complimentary starter tokens.',
    });
  } catch (err: any) {
    res.status(400).json({ error: 'REGISTRATION_FAILED', message: err.message });
  }
});

// Login user
authRouter.post('/login', (req: Request, res: Response): void => {
  try {
    const { email, password } = req.body;
    const result = authService.login(email, password);
    res.json({
      success: true,
      user: result.user,
      token: result.token,
    });
  } catch (err: any) {
    res.status(401).json({ error: 'AUTHENTICATION_FAILED', message: err.message });
  }
});

// Get current user profile
authRouter.get('/me', requireBearerAuth, (req: V1AuthenticatedRequest, res: Response): void => {
  res.json({ success: true, user: req.user });
});

// Create new API Token
authRouter.post('/tokens', requireBearerAuth, (req: V1AuthenticatedRequest, res: Response): void => {
  try {
    const { name, expiresInDays } = req.body;
    const result = authService.createApiToken(req.user!.id, name || 'API Key', expiresInDays || 90);
    res.status(201).json({
      success: true,
      tokenId: result.tokenId,
      token: result.rawToken,
      prefix: result.prefix,
      expiresAt: result.expiresAt,
      message: 'Make sure to copy your API token now. You will not be able to see it again.',
    });
  } catch (err: any) {
    res.status(400).json({ error: 'TOKEN_CREATION_FAILED', message: err.message });
  }
});

// List API Tokens (redacted)
authRouter.get('/tokens', requireBearerAuth, (req: V1AuthenticatedRequest, res: Response): void => {
  const tokens = authService.listUserTokens(req.user!.id);
  res.json({ success: true, tokens });
});

// Rotate API Token
authRouter.post('/tokens/:id/rotate', requireBearerAuth, (req: V1AuthenticatedRequest, res: Response): void => {
  try {
    const result = authService.rotateToken(req.user!.id, req.params.id);
    res.json({
      success: true,
      tokenId: result.tokenId,
      token: result.rawToken,
      message: 'Token successfully rotated. The previous token has been revoked.',
    });
  } catch (err: any) {
    res.status(400).json({ error: 'TOKEN_ROTATION_FAILED', message: err.message });
  }
});

// Revoke API Token
authRouter.delete('/tokens/:id', requireBearerAuth, (req: V1AuthenticatedRequest, res: Response): void => {
  try {
    authService.revokeToken(req.user!.id, req.params.id);
    res.json({ success: true, message: 'Token successfully revoked.' });
  } catch (err: any) {
    res.status(400).json({ error: 'TOKEN_REVOCATION_FAILED', message: err.message });
  }
});
