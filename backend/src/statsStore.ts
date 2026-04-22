import { promises as fs } from 'node:fs';
import path from 'node:path';

const ACTIVE_WINDOW_MS = 2 * 60 * 1000;
const STATS_FILE_PATH = path.resolve(process.cwd(), 'data', 'stats.json');

interface PersistedStats {
  visitorIds: string[];
  exporterVisitorIds: string[];
  totals: {
    visits: number;
    imagesExported: number;
  };
  updatedAt: string;
}

interface ActiveSession {
  visitorId: string;
  lastSeenAt: number;
  currentPath: string;
}

export interface StatsSummary {
  uniqueUsers: number;
  imagesExported: number;
  activeUsers: number;
  totalVisits: number;
  uniqueExporters: number;
  averageExportsPerUser: number;
  updatedAt: string;
}

const defaultPersistedStats = (): PersistedStats => ({
  visitorIds: [],
  exporterVisitorIds: [],
  totals: {
    visits: 0,
    imagesExported: 0
  },
  updatedAt: new Date().toISOString()
});

export class StatsStore {
  private readonly visitorIds = new Set<string>();
  private readonly exporterVisitorIds = new Set<string>();
  private readonly activeSessions = new Map<string, ActiveSession>();
  private visits = 0;
  private imagesExported = 0;
  private updatedAt = new Date().toISOString();
  private writeQueue = Promise.resolve();

  async initialize() {
    const persisted = await this.readPersistedStats();
    persisted.visitorIds.forEach((visitorId) => this.visitorIds.add(visitorId));
    persisted.exporterVisitorIds.forEach((visitorId) => this.exporterVisitorIds.add(visitorId));
    this.visits = persisted.totals.visits;
    this.imagesExported = persisted.totals.imagesExported;
    this.updatedAt = persisted.updatedAt;
  }

  registerSession(sessionId: string, visitorId: string, currentPath: string) {
    const normalizedPath = this.normalizePath(currentPath);

    if (!this.visitorIds.has(visitorId)) {
      this.visitorIds.add(visitorId);
    }

    this.visits += 1;
    this.activeSessions.set(sessionId, {
      visitorId,
      lastSeenAt: Date.now(),
      currentPath: normalizedPath
    });

    this.touch();
    this.schedulePersist();

    return this.getSummary();
  }

  recordActivity(sessionId: string, visitorId: string, currentPath: string) {
    const normalizedPath = this.normalizePath(currentPath);

    this.activeSessions.set(sessionId, {
      visitorId,
      lastSeenAt: Date.now(),
      currentPath: normalizedPath
    });

    if (!this.visitorIds.has(visitorId)) {
      this.visitorIds.add(visitorId);
      this.touch();
      this.schedulePersist();
    } else {
      this.pruneInactiveSessions();
    }

    return this.getSummary();
  }

  recordExport(visitorId: string) {
    if (!this.visitorIds.has(visitorId)) {
      this.visitorIds.add(visitorId);
    }

    this.imagesExported += 1;
    this.exporterVisitorIds.add(visitorId);
    this.touch();
    this.schedulePersist();

    return this.getSummary();
  }

  getSummary(): StatsSummary {
    this.pruneInactiveSessions();

    return {
      uniqueUsers: this.visitorIds.size,
      imagesExported: this.imagesExported,
      activeUsers: this.getActiveVisitorCount(),
      totalVisits: this.visits,
      uniqueExporters: this.exporterVisitorIds.size,
      averageExportsPerUser: this.visitorIds.size > 0
        ? Number((this.imagesExported / this.visitorIds.size).toFixed(1))
        : 0,
      updatedAt: this.updatedAt
    };
  }

  private getActiveVisitorCount() {
    return new Set(
      Array.from(this.activeSessions.values()).map((session) => session.visitorId)
    ).size;
  }

  private normalizePath(currentPath?: string) {
    if (!currentPath || typeof currentPath !== 'string') {
      return '/';
    }

    return currentPath.startsWith('/') ? currentPath : `/${currentPath}`;
  }

  private pruneInactiveSessions() {
    const now = Date.now();

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now - session.lastSeenAt > ACTIVE_WINDOW_MS) {
        this.activeSessions.delete(sessionId);
      }
    }
  }

  private touch() {
    this.updatedAt = new Date().toISOString();
  }

  private schedulePersist() {
    this.writeQueue = this.writeQueue
      .then(async () => {
        await fs.mkdir(path.dirname(STATS_FILE_PATH), { recursive: true });
        await fs.writeFile(
          STATS_FILE_PATH,
          JSON.stringify(
            {
              visitorIds: Array.from(this.visitorIds),
              exporterVisitorIds: Array.from(this.exporterVisitorIds),
              totals: {
                visits: this.visits,
                imagesExported: this.imagesExported
              },
              updatedAt: this.updatedAt
            },
            null,
            2
          ),
          'utf-8'
        );
      })
      .catch((error) => {
        console.error('Failed to persist stats store:', error);
      });
  }

  private async readPersistedStats() {
    try {
      const contents = await fs.readFile(STATS_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(contents) as Partial<PersistedStats>;

      return {
        visitorIds: Array.isArray(parsed.visitorIds) ? parsed.visitorIds : [],
        exporterVisitorIds: Array.isArray(parsed.exporterVisitorIds) ? parsed.exporterVisitorIds : [],
        totals: {
          visits: typeof parsed.totals?.visits === 'number' ? parsed.totals.visits : 0,
          imagesExported: typeof parsed.totals?.imagesExported === 'number' ? parsed.totals.imagesExported : 0
        },
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString()
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to read persisted stats store:', error);
      }

      return defaultPersistedStats();
    }
  }
}
