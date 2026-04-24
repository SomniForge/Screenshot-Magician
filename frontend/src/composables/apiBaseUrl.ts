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

export const apiBaseUrl = getApiBaseUrl();
