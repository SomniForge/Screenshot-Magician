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

app.use(express.json());
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
  res.json(statsStore.getSummary());
});

app.post('/api/stats/session/start', (req: Request, res: Response) => {
  const { sessionId, visitorId, path } = req.body ?? {};

  if (typeof sessionId !== 'string' || typeof visitorId !== 'string') {
    res.status(400).json({ error: 'sessionId and visitorId are required.' });
    return;
  }

  res.json(statsStore.registerSession(sessionId, visitorId, typeof path === 'string' ? path : '/'));
});

app.post('/api/stats/activity', (req: Request, res: Response) => {
  const { sessionId, visitorId, path } = req.body ?? {};

  if (typeof sessionId !== 'string' || typeof visitorId !== 'string') {
    res.status(400).json({ error: 'sessionId and visitorId are required.' });
    return;
  }

  res.json(statsStore.recordActivity(sessionId, visitorId, typeof path === 'string' ? path : '/'));
});

app.post('/api/stats/export', (req: Request, res: Response) => {
  const { visitorId } = req.body ?? {};

  if (typeof visitorId !== 'string') {
    res.status(400).json({ error: 'visitorId is required.' });
    return;
  }

  res.json(statsStore.recordExport(visitorId));
});

statsStore.initialize().then(() => {
  app.listen(port, () => {
    console.log(`Backend server running at http://localhost:${port}`);
  });
});
