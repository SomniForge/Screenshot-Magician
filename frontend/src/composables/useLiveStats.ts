import { onMounted, onUnmounted, ref } from 'vue';

export interface LiveStatsSummary {
  uniqueUsers: number;
  imagesExported: number;
  activeUsers: number;
  totalVisits: number;
  uniqueExporters: number;
  averageExportsPerUser: number;
  updatedAt: string;
}

const VISITOR_ID_STORAGE_KEY = 'magicianVisitorId';
const SESSION_ID_STORAGE_KEY = 'magicianSessionId';
const DEFAULT_SUMMARY: LiveStatsSummary = {
  uniqueUsers: 0,
  imagesExported: 0,
  activeUsers: 0,
  totalVisits: 0,
  uniqueExporters: 0,
  averageExportsPerUser: 0,
  updatedAt: new Date(0).toISOString()
};
const HEARTBEAT_INTERVAL_MS = 30_000;
const SUMMARY_POLL_INTERVAL_MS = 15_000;

let trackingInitialized = false;
let heartbeatTimer: number | null = null;

const summary = ref<LiveStatsSummary>({ ...DEFAULT_SUMMARY });
const isLoadingSummary = ref(false);
const hasSummaryError = ref(false);
const lastSummaryRefreshAt = ref(new Date(0).toISOString());

const getApiBaseUrl = () => {
  const configuredBaseUrl = import.meta.env.VITE_STATS_API_BASE_URL?.trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return 'http://localhost:3000/api';
  }

  return '/api';
};

const apiBaseUrl = getApiBaseUrl();

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getVisitorId = () => {
  const storedVisitorId = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY);
  if (storedVisitorId) {
    return storedVisitorId;
  }

  const nextVisitorId = createId();
  window.localStorage.setItem(VISITOR_ID_STORAGE_KEY, nextVisitorId);
  return nextVisitorId;
};

const getSessionId = () => {
  const storedSessionId = window.sessionStorage.getItem(SESSION_ID_STORAGE_KEY);
  if (storedSessionId) {
    return storedSessionId;
  }

  const nextSessionId = createId();
  window.sessionStorage.setItem(SESSION_ID_STORAGE_KEY, nextSessionId);
  return nextSessionId;
};

const postJson = async <T>(path: string, payload: Record<string, unknown>) => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    keepalive: true
  });

  if (!response.ok) {
    throw new Error(`Stats request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
};

const fetchSummary = async () => {
  isLoadingSummary.value = true;

  try {
    const response = await fetch(`${apiBaseUrl}/stats/summary`);
    if (!response.ok) {
      throw new Error(`Stats summary failed: ${response.status}`);
    }

    summary.value = await response.json() as LiveStatsSummary;
    lastSummaryRefreshAt.value = new Date().toISOString();
    hasSummaryError.value = false;
  } catch (error) {
    hasSummaryError.value = true;
    console.error('Failed to load live stats summary:', error);
  } finally {
    isLoadingSummary.value = false;
  }
};

const sendHeartbeat = async () => {
  if (typeof window === 'undefined') return;

  try {
    await postJson<LiveStatsSummary>('/stats/activity', {
      sessionId: getSessionId(),
      visitorId: getVisitorId(),
      path: window.location.pathname
    });
  } catch (error) {
    console.error('Failed to send live stats heartbeat:', error);
  }
};

export const initializeLiveStatsTracking = async () => {
  if (trackingInitialized || typeof window === 'undefined') {
    return;
  }

  trackingInitialized = true;

  try {
    await postJson<LiveStatsSummary>('/stats/session/start', {
      sessionId: getSessionId(),
      visitorId: getVisitorId(),
      path: window.location.pathname
    });
  } catch (error) {
    console.error('Failed to register live stats session:', error);
  }

  heartbeatTimer = window.setInterval(() => {
    void sendHeartbeat();
  }, HEARTBEAT_INTERVAL_MS);

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleWindowFocus);
};

const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    void sendHeartbeat();
  }
};

const handleWindowFocus = () => {
  void sendHeartbeat();
};

export const recordImageExport = async (method: 'download' | 'imgbb' = 'download') => {
  if (typeof window === 'undefined') return;

  try {
    await postJson<LiveStatsSummary>('/stats/export', {
      method,
      visitorId: getVisitorId()
    });
  } catch (error) {
    console.error('Failed to record exported image stats:', error);
  }
};

export const useLiveStatsSummary = () => {
  let summaryTimer: number | null = null;

  onMounted(() => {
    void fetchSummary();
    summaryTimer = window.setInterval(() => {
      void fetchSummary();
    }, SUMMARY_POLL_INTERVAL_MS);
  });

  onUnmounted(() => {
    if (summaryTimer !== null) {
      window.clearInterval(summaryTimer);
    }
  });

  return {
    summary,
    isLoadingSummary,
    hasSummaryError,
    lastSummaryRefreshAt,
    refreshSummary: fetchSummary
  };
};

export const disposeLiveStatsTracking = () => {
  if (typeof window === 'undefined') return;

  if (heartbeatTimer !== null) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('focus', handleWindowFocus);
  trackingInitialized = false;
};
