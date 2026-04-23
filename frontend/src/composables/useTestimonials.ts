import { computed, onMounted, ref } from 'vue';

export interface PublicTestimonial {
  createdAt: string;
  id: string;
  name: string;
  quote: string;
  rating: number;
}

interface SubmitTestimonialPayload {
  name: string;
  quote: string;
  rating: number;
}

const VISITOR_ID_STORAGE_KEY = 'magicianVisitorId';

const testimonials = ref<PublicTestimonial[]>([]);
const isLoadingTestimonials = ref(false);
const isSubmittingTestimonial = ref(false);
const hasTestimonialsError = ref(false);

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

const readErrorMessage = async (response: Response) => {
  try {
    const payload = await response.json() as { error?: string };
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error.trim();
    }
  } catch {
    // Ignore malformed JSON and fall back to generic errors.
  }

  return `Request failed with status ${response.status}.`;
};

const fetchTestimonials = async () => {
  isLoadingTestimonials.value = true;

  try {
    const response = await fetch(`${apiBaseUrl}/testimonials`);
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    testimonials.value = await response.json() as PublicTestimonial[];
    hasTestimonialsError.value = false;
  } catch (error) {
    hasTestimonialsError.value = true;
    console.error('Failed to load testimonials:', error);
  } finally {
    isLoadingTestimonials.value = false;
  }
};

const submitTestimonial = async (payload: SubmitTestimonialPayload) => {
  isSubmittingTestimonial.value = true;

  try {
    const response = await fetch(`${apiBaseUrl}/testimonials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...payload,
        visitorId: getVisitorId()
      })
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const createdTestimonial = await response.json() as PublicTestimonial;
    testimonials.value = [createdTestimonial, ...testimonials.value.filter((item) => item.id !== createdTestimonial.id)];
    hasTestimonialsError.value = false;
    return createdTestimonial;
  } finally {
    isSubmittingTestimonial.value = false;
  }
};

export const useTestimonials = () => {
  onMounted(() => {
    void fetchTestimonials();
  });

  return {
    fetchTestimonials,
    hasTestimonialsError: computed(() => hasTestimonialsError.value),
    isLoadingTestimonials: computed(() => isLoadingTestimonials.value),
    isSubmittingTestimonial: computed(() => isSubmittingTestimonial.value),
    submitTestimonial,
    testimonials: computed(() => testimonials.value)
  };
};
