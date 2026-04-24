<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useTestimonialModeration } from '@/composables/useTestimonialModeration';

const statusFilter = ref<'pending' | 'approved' | 'rejected' | 'all'>('pending');
const authTokenInput = ref('');
const moderatorLabelInput = ref('');
const actionMessage = ref('');
const actionTone = ref<'success' | 'error' | 'info'>('info');

const {
  activeModerationId,
  approvedTestimonials,
  clearModerationSession,
  fetchModerationQueue,
  isAuthenticated,
  isLoadingModerationQueue,
  moderationError,
  moderatorLabel,
  moderationQueue,
  moderationToken,
  pendingTestimonials,
  rejectedTestimonials,
  moderateTestimonial,
  setModeratorLabel,
  setModerationToken
} = useTestimonialModeration();

watch(moderationToken, (value) => {
  authTokenInput.value = value;
}, { immediate: true });

watch(moderatorLabel, (value) => {
  moderatorLabelInput.value = value;
}, { immediate: true });

const counts = computed(() => ({
  all: moderationQueue.value.length,
  approved: approvedTestimonials.value.length,
  pending: pendingTestimonials.value.length,
  rejected: rejectedTestimonials.value.length
}));

const filteredTestimonials = computed(() => {
  switch (statusFilter.value) {
    case 'approved':
      return approvedTestimonials.value;
    case 'pending':
      return pendingTestimonials.value;
    case 'rejected':
      return rejectedTestimonials.value;
    default:
      return moderationQueue.value;
  }
});

const formatDate = (value?: string) => {
  if (!value) return 'Not approved';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

const formatStatusLabel = (status: 'approved' | 'pending' | 'rejected') =>
  status.charAt(0).toUpperCase() + status.slice(1);

const getStatusColor = (status: 'approved' | 'pending' | 'rejected') => {
  switch (status) {
    case 'approved':
      return 'success';
    case 'rejected':
      return 'error';
    default:
      return 'warning';
  }
};

const unlockModeration = async () => {
  actionMessage.value = '';
  setModerationToken(authTokenInput.value);
  setModeratorLabel(moderatorLabelInput.value);

  try {
    await fetchModerationQueue();
    actionTone.value = 'success';
    actionMessage.value = 'Moderation queue loaded.';
  } catch {
    actionTone.value = 'error';
    actionMessage.value = '';
  }
};

const refreshQueue = async () => {
  actionMessage.value = '';

  try {
    await fetchModerationQueue();
  } catch {
    actionTone.value = 'error';
  }
};

const signOut = () => {
  clearModerationSession();
  authTokenInput.value = '';
  moderatorLabelInput.value = '';
  actionMessage.value = 'Moderation token cleared from this browser session.';
  actionTone.value = 'info';
};

const runModerationAction = async (
  testimonialId: string,
  action: 'approve' | 'reject'
) => {
  actionMessage.value = '';

  try {
    const updated = await moderateTestimonial(testimonialId, action);
    actionTone.value = 'success';
    actionMessage.value = `${updated.name}'s review was ${action === 'approve' ? 'approved' : 'rejected'}.`;
  } catch {
    actionTone.value = 'error';
  }
};
</script>

<template>
  <div class="moderation-view">
    <v-container class="moderation-shell py-10">
      <v-row class="mb-8" align="center">
        <v-col cols="12" md="8">
          <div class="text-overline moderation-eyebrow">Admin</div>
          <h1 class="text-h3 font-weight-bold mb-3">Testimonial Moderation</h1>
          <p class="text-body-1 moderation-lede mb-0">
            Review incoming testimonials, approve the good ones, and keep the public home page clean.
          </p>
        </v-col>
        <v-col cols="12" md="4" class="text-md-right">
          <v-btn
            variant="tonal"
            color="primary"
            prepend-icon="mdi-refresh"
            :disabled="!isAuthenticated"
            :loading="isLoadingModerationQueue"
            @click="refreshQueue"
          >
            Refresh Queue
          </v-btn>
        </v-col>
      </v-row>

      <v-row class="mb-6">
        <v-col cols="12">
          <v-card class="moderation-auth-card" rounded="lg">
            <v-card-item>
              <v-card-title class="d-flex align-center flex-wrap ga-3">
                <span>Moderation Access</span>
                <v-chip
                  :color="isAuthenticated ? 'success' : 'default'"
                  size="small"
                  variant="tonal"
                >
                  {{ isAuthenticated ? 'Unlocked' : 'Locked' }}
                </v-chip>
              </v-card-title>
              <v-card-subtitle>
                Uses the same backend token as the moderation API. The token is stored only for this browser session.
              </v-card-subtitle>
            </v-card-item>
            <v-card-text>
              <v-row align="center">
                <v-col cols="12" md="8">
                  <div class="moderation-auth-fields">
                    <v-text-field
                      v-model="moderatorLabelInput"
                      label="Moderator label"
                      variant="outlined"
                      density="comfortable"
                      autocomplete="off"
                      hide-details="auto"
                    />
                    <v-text-field
                      v-model="authTokenInput"
                      label="Moderation token"
                      type="password"
                      variant="outlined"
                      density="comfortable"
                      autocomplete="off"
                      hide-details="auto"
                      @keyup.enter="unlockModeration"
                    />
                  </div>
                </v-col>
                <v-col cols="12" md="4" class="d-flex ga-3 flex-wrap justify-md-end">
                  <v-btn
                    color="primary"
                    :loading="isLoadingModerationQueue"
                    @click="unlockModeration"
                  >
                    Unlock
                  </v-btn>
                  <v-btn
                    variant="text"
                    :disabled="!isAuthenticated"
                    @click="signOut"
                  >
                    Clear Token
                  </v-btn>
                </v-col>
              </v-row>

              <v-alert
                v-if="actionMessage"
                class="mt-4"
                :type="actionTone"
                variant="tonal"
                :text="actionMessage"
              />

              <v-alert
                v-if="moderationError"
                class="mt-4"
                type="error"
                variant="tonal"
                :text="moderationError"
              />
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-row class="mb-6">
        <v-col cols="12" md="3">
          <v-card class="summary-card" rounded="lg">
            <v-card-item>
              <v-card-subtitle>Pending</v-card-subtitle>
              <v-card-title class="text-h4">{{ counts.pending }}</v-card-title>
            </v-card-item>
          </v-card>
        </v-col>
        <v-col cols="12" md="3">
          <v-card class="summary-card" rounded="lg">
            <v-card-item>
              <v-card-subtitle>Approved</v-card-subtitle>
              <v-card-title class="text-h4">{{ counts.approved }}</v-card-title>
            </v-card-item>
          </v-card>
        </v-col>
        <v-col cols="12" md="3">
          <v-card class="summary-card" rounded="lg">
            <v-card-item>
              <v-card-subtitle>Rejected</v-card-subtitle>
              <v-card-title class="text-h4">{{ counts.rejected }}</v-card-title>
            </v-card-item>
          </v-card>
        </v-col>
        <v-col cols="12" md="3">
          <v-card class="summary-card" rounded="lg">
            <v-card-item>
              <v-card-subtitle>Total Queue</v-card-subtitle>
              <v-card-title class="text-h4">{{ counts.all }}</v-card-title>
            </v-card-item>
          </v-card>
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12">
          <div class="filter-row mb-4">
            <v-btn-toggle
              v-model="statusFilter"
              color="primary"
              mandatory
              divided
            >
              <v-btn value="pending">Pending</v-btn>
              <v-btn value="approved">Approved</v-btn>
              <v-btn value="rejected">Rejected</v-btn>
              <v-btn value="all">All</v-btn>
            </v-btn-toggle>
          </div>

          <v-card class="moderation-list-card" rounded="lg">
            <v-card-text v-if="!isAuthenticated" class="py-10 text-center moderation-empty-state">
              Enter the moderation token to load testimonials.
            </v-card-text>
            <v-card-text
              v-else-if="isLoadingModerationQueue && moderationQueue.length === 0"
              class="py-10 text-center moderation-empty-state"
            >
              Loading moderation queue...
            </v-card-text>
            <v-card-text
              v-else-if="filteredTestimonials.length === 0"
              class="py-10 text-center moderation-empty-state"
            >
              No testimonials in this filter right now.
            </v-card-text>
            <div v-else class="moderation-list">
              <article
                v-for="testimonial in filteredTestimonials"
                :key="testimonial.id"
                class="moderation-item"
              >
                <div class="moderation-item__top">
                  <div>
                    <div class="moderation-item__title">
                      <span class="text-h6">{{ testimonial.name }}</span>
                      <v-chip
                        :color="getStatusColor(testimonial.status)"
                        size="small"
                        variant="tonal"
                      >
                        {{ formatStatusLabel(testimonial.status) }}
                      </v-chip>
                    </div>
                    <div class="moderation-meta">
                      <span>Submitted {{ formatDate(testimonial.createdAt) }}</span>
                      <span>Visitor {{ testimonial.visitorId }}</span>
                      <span v-if="testimonial.approvedAt">Approved {{ formatDate(testimonial.approvedAt) }}</span>
                    </div>
                  </div>
                  <div class="moderation-stars" :aria-label="`${testimonial.rating} out of 5 stars`">
                    <v-icon
                      v-for="star in 5"
                      :key="`${testimonial.id}-${star}`"
                      :icon="star <= testimonial.rating ? 'mdi-star' : 'mdi-star-outline'"
                      size="18"
                    />
                  </div>
                </div>

                <p class="moderation-quote mb-4">“{{ testimonial.quote }}”</p>

                <div class="moderation-actions">
                  <v-btn
                    color="success"
                    prepend-icon="mdi-check"
                    :loading="activeModerationId === testimonial.id"
                    :disabled="activeModerationId === testimonial.id || testimonial.status === 'approved'"
                    @click="runModerationAction(testimonial.id, 'approve')"
                  >
                    Approve
                  </v-btn>
                  <v-btn
                    color="error"
                    variant="tonal"
                    prepend-icon="mdi-close"
                    :loading="activeModerationId === testimonial.id"
                    :disabled="activeModerationId === testimonial.id || testimonial.status === 'rejected'"
                    @click="runModerationAction(testimonial.id, 'reject')"
                  >
                    Reject
                  </v-btn>
                </div>

                <div
                  v-if="testimonial.moderationHistory.length > 0"
                  class="moderation-history"
                >
                  <div class="text-subtitle-2 moderation-history__title">Audit Trail</div>
                  <div
                    v-for="(event, index) in testimonial.moderationHistory"
                    :key="`${testimonial.id}-history-${index}`"
                    class="moderation-history__item"
                  >
                    <v-icon
                      :icon="event.action === 'approve' ? 'mdi-check-circle' : 'mdi-close-circle'"
                      :color="event.action === 'approve' ? 'success' : 'error'"
                      size="16"
                    />
                    <span>
                      {{ formatDate(event.actedAt) }}:
                      <strong>{{ event.actorLabel || 'Admin' }}</strong>
                      changed this review from {{ formatStatusLabel(event.fromStatus).toLowerCase() }}
                      to {{ formatStatusLabel(event.toStatus).toLowerCase() }}.
                    </span>
                  </div>
                </div>
              </article>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<style scoped>
.moderation-view {
  min-height: 100%;
  background:
    radial-gradient(circle at top left, rgba(66, 165, 245, 0.12), rgba(16, 18, 21, 0) 42%),
    radial-gradient(circle at top right, rgba(76, 175, 80, 0.1), rgba(16, 18, 21, 0) 38%),
    #101215;
  color: #f5f7fa;
  overflow-y: auto;
}

.moderation-shell {
  width: min(100%, 1220px);
}

.moderation-eyebrow {
  color: rgba(245, 247, 250, 0.66);
  letter-spacing: 0.08em;
}

.moderation-lede {
  color: rgba(245, 247, 250, 0.78);
  max-width: 760px;
}

.moderation-auth-card,
.summary-card,
.moderation-list-card {
  background:
    linear-gradient(160deg, rgba(66, 165, 245, 0.12), rgba(171, 71, 188, 0.05)),
    rgba(29, 32, 37, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #f5f7fa !important;
}

.moderation-auth-fields {
  display: grid;
  gap: 12px;
}

.filter-row {
  display: flex;
  justify-content: flex-end;
}

.moderation-empty-state {
  color: rgba(245, 247, 250, 0.72);
}

.moderation-list {
  display: flex;
  flex-direction: column;
}

.moderation-item {
  padding: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.moderation-item:last-child {
  border-bottom: 0;
}

.moderation-item__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.moderation-item__title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.moderation-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 8px;
  color: rgba(245, 247, 250, 0.64);
  font-size: 0.9rem;
}

.moderation-stars {
  display: inline-flex;
  gap: 4px;
  color: #ffca28;
}

.moderation-quote {
  line-height: 1.7;
  color: rgba(245, 247, 250, 0.92);
}

.moderation-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.moderation-history {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.moderation-history__title {
  margin-bottom: 10px;
}

.moderation-history__item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: rgba(245, 247, 250, 0.72);
  font-size: 0.92rem;
  line-height: 1.5;
}

.moderation-history__item + .moderation-history__item {
  margin-top: 8px;
}

.moderation-view :deep(.v-card-title),
.moderation-view :deep(.v-card-text),
.moderation-view :deep(.v-card-subtitle),
.moderation-view :deep(.v-btn) {
  letter-spacing: 0;
}

.moderation-view :deep(.v-card-subtitle),
.moderation-view :deep(.text-medium-emphasis) {
  color: rgba(245, 247, 250, 0.7) !important;
}

@media (max-width: 960px) {
  .filter-row {
    justify-content: flex-start;
  }
}

@media (max-width: 700px) {
  .moderation-item {
    padding: 18px;
  }

  .moderation-item__top {
    flex-direction: column;
  }

  .moderation-stars {
    align-self: flex-start;
  }
}
</style>
