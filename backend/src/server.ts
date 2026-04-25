import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { StatsStore } from './statsStore';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const statsStore = new StatsStore();
const moderationToken = process.env.TESTIMONIAL_MODERATION_TOKEN?.trim() || '';
const allowedOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const resolveCorsOrigin = (origin?: string) => {
  if (allowedOrigins.includes('*')) {
    return '*';
  }

  if (origin && allowedOrigins.includes(origin)) {
    return origin;
  }

  return allowedOrigins[0] ?? '*';
};

const logInfo = (message: string, details?: Record<string, unknown>) => {
  console.log(`[stats-backend] ${message}`, details ?? '');
};

const logWarn = (message: string, details?: Record<string, unknown>) => {
  console.warn(`[stats-backend] ${message}`, details ?? '');
};

const logError = (message: string, error: unknown, details?: Record<string, unknown>) => {
  console.error(`[stats-backend] ${message}`, details ?? '', error);
};

const getAdminTokenFromRequest = (req: Request) => {
  const headerValue = req.header('x-admin-token')?.trim();
  if (headerValue) return headerValue;

  const authorizationHeader = req.header('authorization')?.trim();
  if (!authorizationHeader) return '';

  const bearerMatch = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return bearerMatch?.[1]?.trim() || '';
};

const requireAdminToken = (req: Request, res: Response) => {
  if (!moderationToken) {
    logWarn('admin endpoint requested without configured token');
    res.status(503).json({ error: 'Admin access is not configured on this server.' });
    return false;
  }

  const requestToken = getAdminTokenFromRequest(req);
  if (!requestToken || requestToken !== moderationToken) {
    logWarn('admin endpoint rejected for invalid token', {
      path: req.originalUrl
    });
    res.status(401).json({ error: 'Invalid admin token.' });
    return false;
  }

  return true;
};

const requireModerationToken = requireAdminToken;

app.use(express.json());
app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    logInfo('request completed', {
      durationMs: Date.now() - startedAt,
      method: req.method,
      origin: req.headers.origin ?? 'unknown',
      path: req.originalUrl,
      statusCode: res.statusCode
    });
  });

  next();
});

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', resolveCorsOrigin(req.headers.origin));
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

app.get('/api', (_req: Request, res: Response) => {
  res.json({ message: 'Welcome to the API!' });
});

app.get('/api/stats/summary', (_req: Request, res: Response) => {
  logInfo('stats summary requested');
  res.json(statsStore.getSummary());
});

app.post('/api/stats/session/start', (req: Request, res: Response) => {
  const { sessionId, visitorId, path } = req.body ?? {};

  if (typeof sessionId !== 'string' || typeof visitorId !== 'string') {
    logWarn('session start rejected', { body: req.body ?? null });
    res.status(400).json({ error: 'sessionId and visitorId are required.' });
    return;
  }

  logInfo('session started', {
    path: typeof path === 'string' ? path : '/',
    sessionId,
    visitorId
  });
  res.json(statsStore.registerSession(sessionId, visitorId, typeof path === 'string' ? path : '/'));
});

app.post('/api/stats/activity', (req: Request, res: Response) => {
  const { sessionId, visitorId, path } = req.body ?? {};

  if (typeof sessionId !== 'string' || typeof visitorId !== 'string') {
    logWarn('activity heartbeat rejected', { body: req.body ?? null });
    res.status(400).json({ error: 'sessionId and visitorId are required.' });
    return;
  }

  logInfo('activity heartbeat received', {
    path: typeof path === 'string' ? path : '/',
    sessionId,
    visitorId
  });
  res.json(statsStore.recordActivity(sessionId, visitorId, typeof path === 'string' ? path : '/'));
});

app.post('/api/stats/export', (req: Request, res: Response) => {
  const { visitorId, method } = req.body ?? {};

  if (typeof visitorId !== 'string') {
    logWarn('export stat rejected', { body: req.body ?? null });
    res.status(400).json({ error: 'visitorId is required.' });
    return;
  }

  const exportMethod = method === 'download' || method === 'imgbb' ? method : 'unknown';

  logInfo('image export recorded', { method: exportMethod, visitorId });
  res.json(statsStore.recordExport(visitorId, exportMethod));
});

app.get('/api/admin/stats', (req: Request, res: Response) => {
  if (!requireAdminToken(req, res)) {
    return;
  }

  const range = typeof req.query.range === 'string' ? req.query.range : undefined;
  const bucket = typeof req.query.bucket === 'string' ? req.query.bucket : undefined;
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;

  logInfo('admin stats requested', { bucket, from, range, to });
  res.json(statsStore.getAdminStats({
    bucket: bucket === 'hour' || bucket === 'day' || bucket === 'week' || bucket === 'month' ? bucket : undefined,
    from,
    range: range === '24h' || range === '7d' || range === '30d' || range === '90d' || range === 'all' ? range : undefined,
    to
  }));
});

app.get('/api/testimonials', (_req: Request, res: Response) => {
  logInfo('testimonials requested');
  res.json(statsStore.listTestimonials());
});

app.get('/api/testimonials/moderation', (req: Request, res: Response) => {
  if (!requireModerationToken(req, res)) {
    return;
  }

  logInfo('testimonial moderation queue requested');
  res.json(statsStore.listTestimonialsForModeration());
});

app.post('/api/testimonials', (req: Request, res: Response) => {
  const {
    name,
    quote,
    rating,
    visitorId
  } = req.body ?? {};

  if (typeof name !== 'string' || typeof quote !== 'string' || typeof visitorId !== 'string') {
    logWarn('testimonial rejected for missing fields', { body: req.body ?? null });
    res.status(400).json({ error: 'name, quote, and visitorId are required.' });
    return;
  }

  try {
    const created = statsStore.addTestimonial({
      name,
      quote,
      rating: Number(rating),
      visitorId
    });
    logInfo('testimonial created', {
      name: created.name,
      rating: created.rating,
      status: created.status,
      testimonialId: created.id,
      visitorId
    });
    res.status(202).json({
      message: 'Thanks for the review. It has been submitted for approval.',
      testimonial: created
    });
  } catch (error) {
    logWarn('testimonial rejected', {
      name,
      rating: Number(rating),
      visitorId,
      reason: error instanceof Error ? error.message : 'unknown'
    });
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Unable to save testimonial.'
    });
  }
});

app.post('/api/testimonials/:testimonialId/moderate', (req: Request, res: Response) => {
  if (!requireModerationToken(req, res)) {
    return;
  }

  const testimonialId = req.params.testimonialId?.trim();
  const action = req.body?.action;
  const actorLabel = typeof req.body?.actorLabel === 'string' ? req.body.actorLabel.trim() : '';

  if (!testimonialId) {
    res.status(400).json({ error: 'testimonialId is required.' });
    return;
  }

  if (action !== 'approve' && action !== 'reject') {
    res.status(400).json({ error: 'action must be approve or reject.' });
    return;
  }

  try {
    const updated = statsStore.moderateTestimonial(testimonialId, action, actorLabel);
    logInfo('testimonial moderated', {
      action,
      actorLabel: actorLabel || 'Admin',
      status: updated.status,
      testimonialId
    });
    res.json(updated);
  } catch (error) {
    res.status(404).json({
      error: error instanceof Error ? error.message : 'Unable to moderate testimonial.'
    });
  }
});

statsStore.initialize().then(() => {
  app.listen(port, () => {
    logInfo('backend server started', {
      allowedOrigins,
      moderationEnabled: Boolean(moderationToken),
      port
    });
  });
}).catch((error) => {
  logError('backend failed to initialize', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logError('uncaught exception', error);
});

process.on('unhandledRejection', (reason) => {
  logError('unhandled rejection', reason);
});
