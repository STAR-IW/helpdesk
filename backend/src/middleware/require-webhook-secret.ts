import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../env.js';

export function requireWebhookSecret(req: Request, res: Response, next: NextFunction) {
  const provided = req.header('X-Webhook-Secret');

  if (!provided || !secretsMatch(provided, env.INBOUND_EMAIL_WEBHOOK_SECRET)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

function secretsMatch(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  return providedBuf.length === expectedBuf.length && timingSafeEqual(providedBuf, expectedBuf);
}
