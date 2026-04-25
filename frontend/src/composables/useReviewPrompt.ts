import { computed, ref } from 'vue';

const REVIEW_PROMPT_METRICS_STORAGE_KEY = 'magicianReviewPromptMetrics';
const REVIEW_PROMPT_DISABLED_STORAGE_KEY = 'magicianReviewPromptDisabled';
const REVIEW_PROMPT_COOLDOWN_MS = 10 * 24 * 60 * 60 * 1000;
const FOLLOW_UP_EXPORT_DELTA = 4;
const FOLLOW_UP_PROJECT_SAVE_DELTA = 2;
const FOLLOW_UP_SESSION_DELTA = 3;

interface ReviewPromptMetrics {
  exportCount: number;
  lastPromptExportCount: number;
  lastPromptProjectSaveCount: number;
  lastPromptSessionCount: number;
  lastPromptedAt: string | null;
  projectSaveCount: number;
  promptCount: number;
  sessionCount: number;
  updatedAt: string;
}

const defaultMetrics = (): ReviewPromptMetrics => ({
  exportCount: 0,
  lastPromptExportCount: 0,
  lastPromptProjectSaveCount: 0,
  lastPromptSessionCount: 0,
  lastPromptedAt: null,
  projectSaveCount: 0,
  promptCount: 0,
  sessionCount: 0,
  updatedAt: new Date().toISOString()
});

const isDisabled = ref(false);
const metrics = ref<ReviewPromptMetrics>(defaultMetrics());
const shouldShowReviewPrompt = ref(false);

const readStoredMetrics = () => {
  if (typeof window === 'undefined') return defaultMetrics();

  try {
    const storedValue = window.localStorage.getItem(REVIEW_PROMPT_METRICS_STORAGE_KEY);
    if (!storedValue) return defaultMetrics();

    const parsed = JSON.parse(storedValue) as Partial<ReviewPromptMetrics>;
    return {
      exportCount: typeof parsed.exportCount === 'number' ? parsed.exportCount : 0,
      lastPromptExportCount: typeof parsed.lastPromptExportCount === 'number' ? parsed.lastPromptExportCount : 0,
      lastPromptProjectSaveCount: typeof parsed.lastPromptProjectSaveCount === 'number' ? parsed.lastPromptProjectSaveCount : 0,
      lastPromptSessionCount: typeof parsed.lastPromptSessionCount === 'number' ? parsed.lastPromptSessionCount : 0,
      lastPromptedAt: typeof parsed.lastPromptedAt === 'string' ? parsed.lastPromptedAt : null,
      projectSaveCount: typeof parsed.projectSaveCount === 'number' ? parsed.projectSaveCount : 0,
      promptCount: typeof parsed.promptCount === 'number' ? parsed.promptCount : 0,
      sessionCount: typeof parsed.sessionCount === 'number' ? parsed.sessionCount : 0,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString()
    };
  } catch {
    return defaultMetrics();
  }
};

const persistMetrics = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(REVIEW_PROMPT_METRICS_STORAGE_KEY, JSON.stringify(metrics.value));
};

const hasInitialUsageForPrompt = () => {
  const { exportCount, projectSaveCount, sessionCount } = metrics.value;

  return exportCount >= 3
    || projectSaveCount >= 2
    || (exportCount >= 2 && projectSaveCount >= 1)
    || (sessionCount >= 4 && exportCount >= 1);
};

const isPromptCooldownOver = () => {
  if (!metrics.value.lastPromptedAt) return true;

  const lastPromptTime = Date.parse(metrics.value.lastPromptedAt);
  if (Number.isNaN(lastPromptTime)) return true;

  return Date.now() - lastPromptTime >= REVIEW_PROMPT_COOLDOWN_MS;
};

const hasFollowUpUsageForPrompt = () => {
  const exportDelta = metrics.value.exportCount - metrics.value.lastPromptExportCount;
  const projectSaveDelta = metrics.value.projectSaveCount - metrics.value.lastPromptProjectSaveCount;
  const sessionDelta = metrics.value.sessionCount - metrics.value.lastPromptSessionCount;

  return exportDelta >= FOLLOW_UP_EXPORT_DELTA
    || projectSaveDelta >= FOLLOW_UP_PROJECT_SAVE_DELTA
    || (sessionDelta >= FOLLOW_UP_SESSION_DELTA && exportDelta >= 1)
    || (exportDelta >= 2 && projectSaveDelta >= 1);
};

const markPromptShown = () => {
  metrics.value = {
    ...metrics.value,
    lastPromptExportCount: metrics.value.exportCount,
    lastPromptProjectSaveCount: metrics.value.projectSaveCount,
    lastPromptSessionCount: metrics.value.sessionCount,
    lastPromptedAt: new Date().toISOString(),
    promptCount: metrics.value.promptCount + 1,
    updatedAt: new Date().toISOString()
  };
  persistMetrics();
};

const maybeShowReviewPrompt = () => {
  if (isDisabled.value || shouldShowReviewPrompt.value || !hasInitialUsageForPrompt()) return;
  if (metrics.value.promptCount > 0 && (!isPromptCooldownOver() || !hasFollowUpUsageForPrompt())) return;

  shouldShowReviewPrompt.value = true;
  markPromptShown();
};

const incrementMetric = (key: 'exportCount' | 'projectSaveCount' | 'sessionCount') => {
  if (typeof window === 'undefined' || isDisabled.value) return;

  metrics.value = {
    ...metrics.value,
    [key]: metrics.value[key] + 1,
    updatedAt: new Date().toISOString()
  };
  persistMetrics();
  maybeShowReviewPrompt();
};

const snoozeReviewPrompt = () => {
  shouldShowReviewPrompt.value = false;
};

const disableReviewPrompt = () => {
  shouldShowReviewPrompt.value = false;
  isDisabled.value = true;

  if (typeof window === 'undefined') return;
  window.localStorage.setItem(REVIEW_PROMPT_DISABLED_STORAGE_KEY, 'true');
};

const initializeReviewPromptTracking = () => {
  if (typeof window === 'undefined') return;

  metrics.value = readStoredMetrics();
  isDisabled.value = window.localStorage.getItem(REVIEW_PROMPT_DISABLED_STORAGE_KEY) === 'true';
  incrementMetric('sessionCount');
};

const recordReviewPromptExport = () => {
  incrementMetric('exportCount');
};

const recordReviewPromptProjectSave = () => {
  incrementMetric('projectSaveCount');
};

export const useReviewPrompt = () => ({
  disableReviewPrompt,
  initializeReviewPromptTracking,
  recordReviewPromptExport,
  recordReviewPromptProjectSave,
  reviewPromptMetrics: computed(() => metrics.value),
  shouldShowReviewPrompt,
  snoozeReviewPrompt
});
