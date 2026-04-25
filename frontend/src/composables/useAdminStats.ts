import { computed, onMounted, ref } from 'vue';
import { apiBaseUrl } from '@/composables/apiBaseUrl';

export type AdminStatsRange = '24h' | '7d' | '30d' | '90d' | 'all';
export type AdminStatsBucket = 'hour' | 'day' | 'week' | 'month';

export interface AdminStatsBreakdownItem {
  label: string;
  value: number;
}

export interface AdminStatsTimelineItem {
  activity: number;
  date: string;
  downloads: number;
  exports: number;
  imgbb: number;
  label: string;
  visits: number;
}

export interface AdminStatsEvent {
  exportMethod?: 'download' | 'imgbb' | 'unknown';
  id: string;
  occurredAt: string;
  path?: string;
  sessionId?: string;
  type: 'session_start' | 'activity' | 'export';
  visitorId: string;
}

export interface AdminStatsResponse {
  activeSessions: Array<{
    currentPath: string;
    lastSeenAt: string;
    visitorId: string;
  }>;
  dataQuality: {
    eventLogStartedAt: string | null;
    legacyStatsIncluded: boolean;
    note: string;
  };
  exports: {
    byMethod: {
      download: number;
      imgbb: number;
      unknown: number;
    };
    total: number;
  };
  generatedAt: string;
  recentEvents: AdminStatsEvent[];
  sessions: {
    activityHeartbeats: number;
    topPaths: AdminStatsBreakdownItem[];
    totalStarts: number;
  };
  testimonials: {
    approvedInWindow: number;
    averageRating: number;
    byStatus: {
      approved: number;
      pending: number;
      rejected: number;
    };
    submittedInWindow: number;
    total: number;
  };
  timeline: AdminStatsTimelineItem[];
  totals: {
    activeUsers: number;
    averageExportsPerUser: number;
    eventsTracked: number;
    exportConversionRate: number;
    imagesExported: number;
    totalVisits: number;
    uniqueExporters: number;
    uniqueUsers: number;
  };
  updatedAt: string;
  window: {
    bucketSize: AdminStatsBucket;
    from: string | null;
    label: string;
    range: AdminStatsRange | 'custom';
    to: string;
  };
}

const ADMIN_STATS_TOKEN_STORAGE_KEY = 'magicianAdminStatsToken';

const adminToken = ref('');
const stats = ref<AdminStatsResponse | null>(null);
const statsError = ref('');
const isLoadingStats = ref(false);

const readErrorMessage = async (response: Response) => {
  try {
    const payload = await response.json() as { error?: string };
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error.trim();
    }
  } catch {
    // The backend normally returns JSON, but this keeps auth failures readable behind proxies too.
  }

  return `Request failed with status ${response.status}.`;
};

const persistAdminToken = (token: string) => {
  if (typeof window === 'undefined') return;

  if (token) {
    window.sessionStorage.setItem(ADMIN_STATS_TOKEN_STORAGE_KEY, token);
    return;
  }

  window.sessionStorage.removeItem(ADMIN_STATS_TOKEN_STORAGE_KEY);
};

const setAdminToken = (token: string) => {
  adminToken.value = token.trim();
  persistAdminToken(adminToken.value);
};

const clearAdminStatsSession = () => {
  stats.value = null;
  statsError.value = '';
  setAdminToken('');
};

const fetchAdminStats = async (options: {
  bucket?: AdminStatsBucket;
  from?: string;
  range?: AdminStatsRange;
  to?: string;
} = {}) => {
  if (!adminToken.value) {
    stats.value = null;
    statsError.value = 'Enter the admin token to load statistics.';
    return;
  }

  isLoadingStats.value = true;
  statsError.value = '';

  try {
    const query = new URLSearchParams();
    if (options.range) query.set('range', options.range);
    if (options.bucket) query.set('bucket', options.bucket);
    if (options.from) query.set('from', options.from);
    if (options.to) query.set('to', options.to);

    const response = await fetch(`${apiBaseUrl}/admin/stats?${query.toString()}`, {
      headers: {
        'x-admin-token': adminToken.value
      }
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    stats.value = await response.json() as AdminStatsResponse;
  } catch (error) {
    stats.value = null;
    statsError.value = error instanceof Error ? error.message : 'Could not load admin statistics.';
    throw error;
  } finally {
    isLoadingStats.value = false;
  }
};

export const useAdminStats = () => {
  onMounted(() => {
    if (typeof window === 'undefined') return;

    const storedToken = window.sessionStorage.getItem(ADMIN_STATS_TOKEN_STORAGE_KEY)?.trim() || '';
    if (!storedToken) return;

    adminToken.value = storedToken;
  });

  return {
    adminToken,
    clearAdminStatsSession,
    fetchAdminStats,
    isAuthenticated: computed(() => Boolean(adminToken.value)),
    isLoadingStats: computed(() => isLoadingStats.value),
    setAdminToken,
    stats: computed(() => stats.value),
    statsError: computed(() => statsError.value)
  };
};
