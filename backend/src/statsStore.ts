import { promises as fs } from 'node:fs';
import path from 'node:path';

const ACTIVE_WINDOW_MS = 2 * 60 * 1000;
const TESTIMONIAL_SUBMISSION_COOLDOWN_MS = 12 * 60 * 60 * 1000;
const STATS_FILE_PATH = path.resolve(process.cwd(), 'data', 'stats.json');
const TESTIMONIALS_FILE_PATH = path.resolve(process.cwd(), 'data', 'testimonials.json');

type StatsEventType = 'session_start' | 'activity' | 'export';
type ExportMethod = 'download' | 'imgbb' | 'unknown';
type StatsRangePreset = '24h' | '7d' | '30d' | '90d' | 'all';
type StatsBucketSize = 'hour' | 'day' | 'week' | 'month';

interface StoredStatsEvent {
  exportMethod?: ExportMethod;
  id: string;
  occurredAt: string;
  path?: string;
  sessionId?: string;
  type: StatsEventType;
  visitorId: string;
}

interface PersistedStats {
  visitorIds: string[];
  exporterVisitorIds: string[];
  totals: {
    visits: number;
    imagesExported: number;
  };
  events?: StoredStatsEvent[];
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

interface StoredModerationEvent {
  action: 'approve' | 'reject';
  actedAt: string;
  actorLabel: string;
  fromStatus: 'approved' | 'pending' | 'rejected';
  toStatus: 'approved' | 'pending' | 'rejected';
}

interface StoredTestimonial {
  approvedAt?: string;
  createdAt: string;
  id: string;
  moderationHistory: StoredModerationEvent[];
  name: string;
  quote: string;
  rating: number;
  status: 'approved' | 'pending' | 'rejected';
  visitorId: string;
}

export interface PublicTestimonial {
  approvedAt?: string;
  createdAt: string;
  id: string;
  name: string;
  quote: string;
  rating: number;
}

export interface ModerationTestimonial extends PublicTestimonial {
  moderationHistory: StoredModerationEvent[];
  status: 'approved' | 'pending' | 'rejected';
  visitorId: string;
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

export interface AdminStatsQuery {
  bucket?: StatsBucketSize;
  from?: string;
  range?: StatsRangePreset;
  to?: string;
}

interface TimeWindow {
  from?: Date;
  label: string;
  range: StatsRangePreset | 'custom';
  to: Date;
}

const defaultPersistedStats = (): PersistedStats => ({
  visitorIds: [],
  exporterVisitorIds: [],
  totals: {
    visits: 0,
    imagesExported: 0
  },
  events: [],
  updatedAt: new Date().toISOString()
});

const defaultPersistedTestimonials = (): PersistedTestimonials => ({
  submissions: []
});

const isExportMethod = (value: unknown): value is ExportMethod =>
  value === 'download' || value === 'imgbb' || value === 'unknown';

const isStatsEventType = (value: unknown): value is StatsEventType =>
  value === 'session_start' || value === 'activity' || value === 'export';

const parseDate = (value?: string) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export class StatsStore {
  private readonly visitorIds = new Set<string>();
  private readonly exporterVisitorIds = new Set<string>();
  private readonly activeSessions = new Map<string, ActiveSession>();
  private readonly events: StoredStatsEvent[] = [];
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
    this.events.splice(0, this.events.length, ...(persisted.events ?? []));
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

    this.recordEvent({
      path: normalizedPath,
      sessionId,
      type: 'session_start',
      visitorId
    });

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
    }

    this.recordEvent({
      path: normalizedPath,
      sessionId,
      type: 'activity',
      visitorId
    });

    return this.getSummary();
  }

  recordExport(visitorId: string, exportMethod: ExportMethod = 'unknown') {
    if (!this.visitorIds.has(visitorId)) {
      this.visitorIds.add(visitorId);
    }

    this.imagesExported += 1;
    this.exporterVisitorIds.add(visitorId);
    this.recordEvent({
      exportMethod,
      type: 'export',
      visitorId
    });

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

  getAdminStats(query: AdminStatsQuery = {}) {
    this.pruneInactiveSessions();

    const window = this.resolveWindow(query);
    const bucketSize = query.bucket ?? this.getDefaultBucketSize(window);
    const filteredEvents = this.getEventsInWindow(window);
    const sessionEvents = filteredEvents.filter((event) => event.type === 'session_start');
    const activityEvents = filteredEvents.filter((event) => event.type === 'activity');
    const exportEvents = filteredEvents.filter((event) => event.type === 'export');
    const isAllTimeWindow = window.range === 'all';
    const legacyVisitDelta = isAllTimeWindow ? Math.max(0, this.visits - sessionEvents.length) : 0;
    const legacyExportDelta = isAllTimeWindow ? Math.max(0, this.imagesExported - exportEvents.length) : 0;
    const legacyStatsIncluded = legacyVisitDelta > 0 || legacyExportDelta > 0;

    const visitorsInWindow = new Set(filteredEvents.map((event) => event.visitorId));
    const exportersInWindow = new Set(exportEvents.map((event) => event.visitorId));
    const exportMethods = this.countBy(exportEvents, (event) => event.exportMethod ?? 'unknown');
    exportMethods.unknown = (exportMethods.unknown ?? 0) + legacyExportDelta;
    const topPaths = this.toBreakdown(this.countBy(
      [...sessionEvents, ...activityEvents].filter((event) => event.path),
      (event) => event.path ?? '/'
    ), 10);
    const timeline = this.buildTimeline(filteredEvents, window, bucketSize);
    const testimonialStats = this.getTestimonialStats(window);
    const totalVisits = isAllTimeWindow ? this.visits : sessionEvents.length;
    const totalExports = isAllTimeWindow ? this.imagesExported : exportEvents.length;
    const uniqueUsers = isAllTimeWindow ? this.visitorIds.size : visitorsInWindow.size;
    const uniqueExporters = isAllTimeWindow ? this.exporterVisitorIds.size : exportersInWindow.size;

    return {
      generatedAt: new Date().toISOString(),
      updatedAt: this.updatedAt,
      window: {
        bucketSize,
        from: window.from?.toISOString() ?? null,
        label: window.label,
        range: window.range,
        to: window.to.toISOString()
      },
      totals: {
        activeUsers: this.getActiveVisitorCount(),
        averageExportsPerUser: uniqueUsers > 0 ? Number((totalExports / uniqueUsers).toFixed(2)) : 0,
        eventsTracked: filteredEvents.length,
        exportConversionRate: uniqueUsers > 0 ? Number(((uniqueExporters / uniqueUsers) * 100).toFixed(1)) : 0,
        imagesExported: totalExports,
        totalVisits,
        uniqueExporters,
        uniqueUsers
      },
      exports: {
        byMethod: {
          download: exportMethods.download ?? 0,
          imgbb: exportMethods.imgbb ?? 0,
          unknown: exportMethods.unknown ?? 0
        },
        total: totalExports
      },
      sessions: {
        totalStarts: totalVisits,
        activityHeartbeats: activityEvents.length,
        topPaths
      },
      testimonials: testimonialStats,
      activeSessions: Array.from(this.activeSessions.values()).map((session) => ({
        currentPath: session.currentPath,
        lastSeenAt: new Date(session.lastSeenAt).toISOString(),
        visitorId: session.visitorId
      })),
      timeline,
      recentEvents: filteredEvents
        .slice()
        .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
        .slice(0, 50),
      dataQuality: {
        eventLogStartedAt: this.events[0]?.occurredAt ?? null,
        legacyStatsIncluded,
        note: legacyStatsIncluded
          ? 'This stats file includes counters from before event-level tracking, so all-time totals include legacy data but charts only show event-level history.'
          : ''
      }
    };
  }

  listTestimonials(): PublicTestimonial[] {
    return [...this.testimonials]
      .filter((testimonial) => testimonial.status === 'approved')
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 12)
      .map((testimonial) => this.toPublicTestimonial(testimonial));
  }

  listTestimonialsForModeration(): ModerationTestimonial[] {
    return [...this.testimonials]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map((testimonial) => this.toModerationTestimonial(testimonial));
  }

  addTestimonial(input: {
    name: string;
    quote: string;
    rating: number;
    visitorId: string;
  }): ModerationTestimonial {
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
      approvedAt: undefined,
      createdAt: new Date().toISOString(),
      id: this.createId(),
      moderationHistory: [],
      name,
      quote,
      rating,
      status: 'pending',
      visitorId
    };

    this.testimonials.unshift(createdTestimonial);
    this.schedulePersistTestimonials();

    return this.toModerationTestimonial(createdTestimonial);
  }

  moderateTestimonial(testimonialId: string, action: 'approve' | 'reject', actorLabel = 'Admin') {
    const testimonial = this.testimonials.find((item) => item.id === testimonialId);
    if (!testimonial) {
      throw new Error('That testimonial could not be found.');
    }

    const actedAt = new Date().toISOString();
    const fromStatus = testimonial.status;
    const toStatus = action === 'approve' ? 'approved' : 'rejected';

    testimonial.moderationHistory.unshift({
      action,
      actedAt,
      actorLabel: actorLabel.trim() || 'Admin',
      fromStatus,
      toStatus
    });
    testimonial.status = toStatus;
    testimonial.approvedAt = action === 'approve' ? actedAt : undefined;
    this.schedulePersistTestimonials();

    return this.toModerationTestimonial(testimonial);
  }

  private recordEvent(input: Omit<StoredStatsEvent, 'id' | 'occurredAt'>) {
    this.events.push({
      ...input,
      id: this.createId(),
      occurredAt: new Date().toISOString()
    });
    this.touch();
    this.schedulePersist();
  }

  private getEventsInWindow(window: TimeWindow) {
    const fromTime = window.from?.getTime() ?? Number.NEGATIVE_INFINITY;
    const toTime = window.to.getTime();

    return this.events.filter((event) => {
      const occurredAt = Date.parse(event.occurredAt);
      return occurredAt >= fromTime && occurredAt <= toTime;
    });
  }

  private resolveWindow(query: AdminStatsQuery): TimeWindow {
    const now = new Date();
    const to = parseDate(query.to) ?? now;
    const customFrom = parseDate(query.from);
    if (customFrom) {
      return {
        from: customFrom,
        label: 'Custom range',
        range: 'custom',
        to
      };
    }

    switch (query.range) {
      case '24h':
        return { from: new Date(to.getTime() - 24 * 60 * 60 * 1000), label: 'Last 24 hours', range: '24h', to };
      case '7d':
        return { from: new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000), label: 'Last 7 days', range: '7d', to };
      case '90d':
        return { from: new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000), label: 'Last 90 days', range: '90d', to };
      case 'all':
        return { from: undefined, label: 'All time', range: 'all', to };
      case '30d':
      default:
        return { from: new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000), label: 'Last 30 days', range: '30d', to };
    }
  }

  private getDefaultBucketSize(window: TimeWindow): StatsBucketSize {
    if (!window.from) return 'month';
    const durationMs = window.to.getTime() - window.from.getTime();
    if (durationMs <= 36 * 60 * 60 * 1000) return 'hour';
    if (durationMs <= 45 * 24 * 60 * 60 * 1000) return 'day';
    if (durationMs <= 120 * 24 * 60 * 60 * 1000) return 'week';
    return 'month';
  }

  private buildTimeline(events: StoredStatsEvent[], window: TimeWindow, bucketSize: StatsBucketSize) {
    const buckets = new Map<string, {
      activity: number;
      date: string;
      downloads: number;
      exports: number;
      imgbb: number;
      label: string;
      visits: number;
    }>();

    const firstEventDate = events
      .map((event) => Date.parse(event.occurredAt))
      .filter((value) => !Number.isNaN(value))
      .sort((a, b) => a - b)[0];
    const start = window.from ?? (firstEventDate ? new Date(firstEventDate) : window.to);
    let cursor = this.floorDate(start, bucketSize);
    const end = this.floorDate(window.to, bucketSize);

    while (cursor.getTime() <= end.getTime()) {
      const key = this.getBucketKey(cursor, bucketSize);
      buckets.set(key, {
        activity: 0,
        date: cursor.toISOString(),
        downloads: 0,
        exports: 0,
        imgbb: 0,
        label: this.formatBucketLabel(cursor, bucketSize),
        visits: 0
      });
      cursor = this.addBucket(cursor, bucketSize);
    }

    events.forEach((event) => {
      const date = new Date(event.occurredAt);
      const key = this.getBucketKey(date, bucketSize);
      const bucket = buckets.get(key);
      if (!bucket) return;

      if (event.type === 'session_start') {
        bucket.visits += 1;
      }

      if (event.type === 'activity') {
        bucket.activity += 1;
      }

      if (event.type === 'export') {
        bucket.exports += 1;
        if (event.exportMethod === 'download') bucket.downloads += 1;
        if (event.exportMethod === 'imgbb') bucket.imgbb += 1;
      }
    });

    return Array.from(buckets.values());
  }

  private getTestimonialStats(window: TimeWindow) {
    const testimonialsInWindow = this.testimonials.filter((testimonial) => this.isIsoDateInWindow(testimonial.createdAt, window));
    const approvedInWindow = this.testimonials.filter((testimonial) => testimonial.approvedAt && this.isIsoDateInWindow(testimonial.approvedAt, window));
    const ratings = testimonialsInWindow.map((testimonial) => testimonial.rating);

    return {
      averageRating: ratings.length > 0
        ? Number((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(2))
        : 0,
      byStatus: {
        approved: this.testimonials.filter((testimonial) => testimonial.status === 'approved').length,
        pending: this.testimonials.filter((testimonial) => testimonial.status === 'pending').length,
        rejected: this.testimonials.filter((testimonial) => testimonial.status === 'rejected').length
      },
      submittedInWindow: testimonialsInWindow.length,
      approvedInWindow: approvedInWindow.length,
      total: this.testimonials.length
    };
  }

  private isIsoDateInWindow(value: string, window: TimeWindow) {
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) return false;
    const from = window.from?.getTime() ?? Number.NEGATIVE_INFINITY;
    return timestamp >= from && timestamp <= window.to.getTime();
  }

  private countBy<T>(items: T[], getKey: (item: T) => string) {
    return items.reduce<Record<string, number>>((counts, item) => {
      const key = getKey(item);
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {});
  }

  private toBreakdown(counts: Record<string, number>, limit: number) {
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  }

  private floorDate(date: Date, bucketSize: StatsBucketSize) {
    const next = new Date(date);
    next.setMilliseconds(0);
    next.setSeconds(0);

    if (bucketSize === 'hour') {
      next.setMinutes(0);
      return next;
    }

    next.setMinutes(0);
    next.setHours(0);

    if (bucketSize === 'week') {
      next.setDate(next.getDate() - next.getDay());
    }

    if (bucketSize === 'month') {
      next.setDate(1);
    }

    return next;
  }

  private addBucket(date: Date, bucketSize: StatsBucketSize) {
    const next = new Date(date);
    if (bucketSize === 'hour') next.setHours(next.getHours() + 1);
    if (bucketSize === 'day') next.setDate(next.getDate() + 1);
    if (bucketSize === 'week') next.setDate(next.getDate() + 7);
    if (bucketSize === 'month') next.setMonth(next.getMonth() + 1);
    return next;
  }

  private getBucketKey(date: Date, bucketSize: StatsBucketSize) {
    return this.floorDate(date, bucketSize).toISOString();
  }

  private formatBucketLabel(date: Date, bucketSize: StatsBucketSize) {
    if (bucketSize === 'hour') {
      return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        month: 'short',
        day: 'numeric'
      }).format(date);
    }

    if (bucketSize === 'month') {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        year: '2-digit'
      }).format(date);
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(date);
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
              events: this.events,
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
      approvedAt: testimonial.approvedAt,
      createdAt: testimonial.createdAt,
      id: testimonial.id,
      name: testimonial.name,
      quote: testimonial.quote,
      rating: testimonial.rating
    };
  }

  private toModerationTestimonial(testimonial: StoredTestimonial): ModerationTestimonial {
    return {
      ...this.toPublicTestimonial(testimonial),
      moderationHistory: [...testimonial.moderationHistory],
      status: testimonial.status,
      visitorId: testimonial.visitorId
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
        visitorIds: Array.isArray(parsed.visitorIds) ? parsed.visitorIds.filter((item) => typeof item === 'string') : [],
        exporterVisitorIds: Array.isArray(parsed.exporterVisitorIds) ? parsed.exporterVisitorIds.filter((item) => typeof item === 'string') : [],
        totals: {
          visits: typeof parsed.totals?.visits === 'number' ? parsed.totals.visits : 0,
          imagesExported: typeof parsed.totals?.imagesExported === 'number' ? parsed.totals.imagesExported : 0
        },
        events: Array.isArray(parsed.events)
          ? parsed.events.filter((event): event is StoredStatsEvent =>
            typeof event?.id === 'string'
            && typeof event?.occurredAt === 'string'
            && typeof event?.visitorId === 'string'
            && isStatsEventType(event.type)
          ).map((event) => ({
            ...event,
            exportMethod: isExportMethod(event.exportMethod) ? event.exportMethod : undefined,
            path: typeof event.path === 'string' ? event.path : undefined,
            sessionId: typeof event.sessionId === 'string' ? event.sessionId : undefined
          }))
          : [],
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
            .map((item) => ({
              ...item,
              approvedAt: typeof item.approvedAt === 'string' ? item.approvedAt : undefined,
              moderationHistory: Array.isArray(item.moderationHistory)
                ? item.moderationHistory.filter((event): event is StoredModerationEvent =>
                  typeof event?.action === 'string'
                  && (event.action === 'approve' || event.action === 'reject')
                  && typeof event?.actedAt === 'string'
                  && typeof event?.actorLabel === 'string'
                  && typeof event?.fromStatus === 'string'
                  && (event.fromStatus === 'pending' || event.fromStatus === 'approved' || event.fromStatus === 'rejected')
                  && typeof event?.toStatus === 'string'
                  && (event.toStatus === 'pending' || event.toStatus === 'approved' || event.toStatus === 'rejected')
                )
                : [],
              status: item.status === 'pending' || item.status === 'rejected' || item.status === 'approved'
                ? item.status
                : 'approved'
            }))
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
