import { event } from 'vue-gtag';

type AnalyticsValue = string | number | boolean | null | undefined;
type AnalyticsParams = Record<string, AnalyticsValue>;

const normalizeAnalyticsParams = (params?: AnalyticsParams) =>
  Object.fromEntries(
    Object.entries(params || {}).filter(([, value]) => value !== undefined)
  );

export const useAnalytics = () => {
  const trackEvent = (name: string, params?: AnalyticsParams) => {
    if (typeof window === 'undefined') return;

    try {
      event(name, normalizeAnalyticsParams(params));
    } catch (error) {
      console.error(`Analytics event failed: ${name}`, error);
    }
  };

  return {
    trackEvent
  };
};
