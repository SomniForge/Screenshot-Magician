import { computed, onMounted, ref } from 'vue';
import { apiBaseUrl } from '@/composables/apiBaseUrl';

export interface ModerationTestimonial {
  approvedAt?: string;
  createdAt: string;
  id: string;
  moderationHistory: ModerationEvent[];
  name: string;
  quote: string;
  rating: number;
  status: 'approved' | 'pending' | 'rejected';
  visitorId: string;
}

type ModerationAction = 'approve' | 'reject';

const MODERATION_TOKEN_STORAGE_KEY = 'magicianModerationToken';
const MODERATOR_LABEL_STORAGE_KEY = 'magicianModeratorLabel';

export interface ModerationEvent {
  action: 'approve' | 'reject';
  actedAt: string;
  actorLabel: string;
  fromStatus: 'approved' | 'pending' | 'rejected';
  toStatus: 'approved' | 'pending' | 'rejected';
}

const moderationToken = ref('');
const moderatorLabel = ref('');
const moderationQueue = ref<ModerationTestimonial[]>([]);
const isLoadingModerationQueue = ref(false);
const activeModerationId = ref('');
const moderationError = ref('');

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

const persistModerationToken = (token: string) => {
  if (typeof window === 'undefined') return;

  if (token) {
    window.sessionStorage.setItem(MODERATION_TOKEN_STORAGE_KEY, token);
    return;
  }

  window.sessionStorage.removeItem(MODERATION_TOKEN_STORAGE_KEY);
};

const setModerationToken = (token: string) => {
  moderationToken.value = token.trim();
  persistModerationToken(moderationToken.value);
};

const setModeratorLabel = (label: string) => {
  moderatorLabel.value = label.trim();

  if (typeof window === 'undefined') return;

  if (moderatorLabel.value) {
    window.sessionStorage.setItem(MODERATOR_LABEL_STORAGE_KEY, moderatorLabel.value);
    return;
  }

  window.sessionStorage.removeItem(MODERATOR_LABEL_STORAGE_KEY);
};

const clearModerationSession = () => {
  moderationQueue.value = [];
  moderationError.value = '';
  setModerationToken('');
  setModeratorLabel('');
};

const getAdminHeaders = () => {
  if (!moderationToken.value) {
    throw new Error('Enter the moderation token to continue.');
  }

  return {
    'Content-Type': 'application/json',
    'x-admin-token': moderationToken.value
  };
};

const fetchModerationQueue = async () => {
  if (!moderationToken.value) {
    moderationQueue.value = [];
    moderationError.value = 'Enter the moderation token to load the moderation queue.';
    return;
  }

  isLoadingModerationQueue.value = true;
  moderationError.value = '';

  try {
    const response = await fetch(`${apiBaseUrl}/testimonials/moderation`, {
      headers: {
        'x-admin-token': moderationToken.value
      }
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    moderationQueue.value = await response.json() as ModerationTestimonial[];
  } catch (error) {
    moderationQueue.value = [];
    moderationError.value = error instanceof Error
      ? error.message
      : 'Could not load the moderation queue.';
    throw error;
  } finally {
    isLoadingModerationQueue.value = false;
  }
};

const moderateTestimonial = async (testimonialId: string, action: ModerationAction) => {
  activeModerationId.value = testimonialId;
  moderationError.value = '';

  try {
    const response = await fetch(`${apiBaseUrl}/testimonials/${testimonialId}/moderate`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({
        action,
        actorLabel: moderatorLabel.value
      })
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const updated = await response.json() as ModerationTestimonial;
    moderationQueue.value = moderationQueue.value.map((testimonial) =>
      testimonial.id === updated.id ? updated : testimonial
    );
    return updated;
  } catch (error) {
    moderationError.value = error instanceof Error
      ? error.message
      : 'Could not update that testimonial.';
    throw error;
  } finally {
    activeModerationId.value = '';
  }
};

export const useTestimonialModeration = () => {
  onMounted(() => {
    if (typeof window === 'undefined') return;

    const storedToken = window.sessionStorage.getItem(MODERATION_TOKEN_STORAGE_KEY)?.trim() || '';
    const storedModeratorLabel = window.sessionStorage.getItem(MODERATOR_LABEL_STORAGE_KEY)?.trim() || '';
    moderatorLabel.value = storedModeratorLabel;
    if (!storedToken) return;

    moderationToken.value = storedToken;
    void fetchModerationQueue().catch(() => {
      // Keep the page mounted and let the view surface the error state.
    });
  });

  return {
    activeModerationId: computed(() => activeModerationId.value),
    approvedTestimonials: computed(() => moderationQueue.value.filter((item) => item.status === 'approved')),
    clearModerationSession,
    fetchModerationQueue,
    isAuthenticated: computed(() => Boolean(moderationToken.value)),
    isLoadingModerationQueue: computed(() => isLoadingModerationQueue.value),
    moderationError: computed(() => moderationError.value),
    moderationQueue: computed(() => moderationQueue.value),
    moderatorLabel,
    moderationToken,
    pendingTestimonials: computed(() => moderationQueue.value.filter((item) => item.status === 'pending')),
    rejectedTestimonials: computed(() => moderationQueue.value.filter((item) => item.status === 'rejected')),
    moderateTestimonial,
    setModeratorLabel,
    setModerationToken
  };
};
