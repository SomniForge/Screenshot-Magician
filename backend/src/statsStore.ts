import { promises as fs } from 'node:fs';
import path from 'node:path';

const ACTIVE_WINDOW_MS = 2 * 60 * 1000;
const TESTIMONIAL_SUBMISSION_COOLDOWN_MS = 12 * 60 * 60 * 1000;
const STATS_FILE_PATH = path.resolve(process.cwd(), 'data', 'stats.json');
const TESTIMONIALS_FILE_PATH = path.resolve(process.cwd(), 'data', 'testimonials.json');

interface PersistedStats {
  visitorIds: string[];
  exporterVisitorIds: string[];
  totals: {
    visits: number;
    imagesExported: number;
  };
  updatedAt: string;
}

interface PersistedTestimonials {
  submissions: StoredTestimonial[];
}

interface ActiveSession {
  visitorId: string;
  lastSeenAt: number;
  currentPath: string;
}

interface StoredTestimonial {
  createdAt: string;
  id: string;
  name: string;
  quote: string;
  rating: number;
  visitorId: string;
}

export interface PublicTestimonial {
  createdAt: string;
  id: string;
  name: string;
  quote: string;
  rating: number;
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

const defaultPersistedTestimonials = (): PersistedTestimonials => ({
  submissions: []
});

export class StatsStore {
  private readonly visitorIds = new Set<string>();
  private readonly exporterVisitorIds = new Set<string>();
  private readonly activeSessions = new Map<string, ActiveSession>();
  private visits = 0;
  private imagesExported = 0;
  private updatedAt = new Date().toISOString();
  private writeQueue = Promise.resolve();
  private readonly testimonials: StoredTestimonial[] = [];

  async initialize() {
    const persisted = await this.readPersistedStats();
    const persistedTestimonials = await this.readPersistedTestimonials();
    persisted.visitorIds.forEach((visitorId) => this.visitorIds.add(visitorId));
    persisted.exporterVisitorIds.forEach((visitorId) => this.exporterVisitorIds.add(visitorId));
    this.visits = persisted.totals.visits;
    this.imagesExported = persisted.totals.imagesExported;
    this.updatedAt = persisted.updatedAt;
    this.testimonials.splice(0, this.testimonials.length, ...persistedTestimonials.submissions);
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

  listTestimonials(): PublicTestimonial[] {
    return [...this.testimonials]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 12)
      .map((testimonial) => this.toPublicTestimonial(testimonial));
  }

  addTestimonial(input: {
    name: string;
    quote: string;
    rating: number;
    visitorId: string;
  }): PublicTestimonial {
    const visitorId = input.visitorId.trim();
    const name = input.name.trim();
    const quote = input.quote.trim();
    const rating = Number(input.rating);

    if (!visitorId) {
      throw new Error('visitorId is required.');
    }

    if (name.length < 2 || name.length > 40) {
      throw new Error('Username must be between 2 and 40 characters.');
    }

    if (quote.length < 20 || quote.length > 280) {
      throw new Error('Review text must be between 20 and 280 characters.');
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5 stars.');
    }

    const normalizedQuote = quote.toLowerCase();
    const normalizedName = name.toLowerCase();

    if (this.testimonials.some((testimonial) =>
      testimonial.visitorId === visitorId
      && testimonial.quote.trim().toLowerCase() === normalizedQuote
    )) {
      throw new Error('That review was already submitted.');
    }

    const lastSubmission = [...this.testimonials]
      .filter((testimonial) => testimonial.visitorId === visitorId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];

    if (lastSubmission) {
      const elapsed = Date.now() - Date.parse(lastSubmission.createdAt);
      if (elapsed < TESTIMONIAL_SUBMISSION_COOLDOWN_MS) {
        throw new Error('Please wait a bit before submitting another review.');
      }
    }

    if (this.testimonials.some((testimonial) =>
      testimonial.name.trim().toLowerCase() === normalizedName
      && testimonial.quote.trim().toLowerCase() === normalizedQuote
    )) {
      throw new Error('That review is already on file.');
    }

    const createdTestimonial: StoredTestimonial = {
      createdAt: new Date().toISOString(),
      id: this.createId(),
      name,
      quote,
      rating,
      visitorId
    };

    this.testimonials.unshift(createdTestimonial);
    this.schedulePersistTestimonials();

    return this.toPublicTestimonial(createdTestimonial);
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

  private schedulePersistTestimonials() {
    this.writeQueue = this.writeQueue
      .then(async () => {
        await fs.mkdir(path.dirname(TESTIMONIALS_FILE_PATH), { recursive: true });
        await fs.writeFile(
          TESTIMONIALS_FILE_PATH,
          JSON.stringify(
            {
              submissions: this.testimonials
            },
            null,
            2
          ),
          'utf-8'
        );
      })
      .catch((error) => {
        console.error('Failed to persist testimonials store:', error);
      });
  }

  private toPublicTestimonial(testimonial: StoredTestimonial): PublicTestimonial {
    return {
      createdAt: testimonial.createdAt,
      id: testimonial.id,
      name: testimonial.name,
      quote: testimonial.quote,
      rating: testimonial.rating
    };
  }

  private createId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

  private async readPersistedTestimonials() {
    try {
      const contents = await fs.readFile(TESTIMONIALS_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(contents) as Partial<PersistedTestimonials>;

      return {
        submissions: Array.isArray(parsed.submissions)
          ? parsed.submissions
            .filter((item): item is StoredTestimonial =>
              typeof item?.id === 'string'
              && typeof item?.name === 'string'
              && typeof item?.quote === 'string'
              && typeof item?.rating === 'number'
              && typeof item?.visitorId === 'string'
              && typeof item?.createdAt === 'string'
            )
          : []
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to read persisted testimonials store:', error);
      }

      return defaultPersistedTestimonials();
    }
  }
}
