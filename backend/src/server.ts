import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { StatsStore } from './statsStore';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const statsStore = new StatsStore();
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
  res.header('Access-Control-Allow-Headers', 'Content-Type');
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
  const { visitorId } = req.body ?? {};

  if (typeof visitorId !== 'string') {
    logWarn('export stat rejected', { body: req.body ?? null });
    res.status(400).json({ error: 'visitorId is required.' });
    return;
  }

  logInfo('image export recorded', { visitorId });
  res.json(statsStore.recordExport(visitorId));
});

app.get('/api/testimonials', (_req: Request, res: Response) => {
  logInfo('testimonials requested');
  res.json(statsStore.listTestimonials());
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
      testimonialId: created.id,
      visitorId
    });
    res.status(201).json(created);
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

statsStore.initialize().then(() => {
  app.listen(port, () => {
    logInfo('backend server started', {
      allowedOrigins,
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
