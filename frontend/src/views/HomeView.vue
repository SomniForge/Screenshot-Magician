<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import AdSlot from '@/components/AdSlot.vue';
import { useAdPreferences } from '@/composables/useAdPreferences';
import { useLiveStatsSummary } from '@/composables/useLiveStats';
import { useTestimonials } from '@/composables/useTestimonials';

const features = [
  {
    icon: 'mdi-clock-fast',
    title: 'Save Hours',
    description: 'What takes minutes in Photoshop takes 30 seconds here. No more complex layers or tools.'
  },
  {
    icon: 'mdi-message-text',
    title: 'Instant Chat Styling',
    description: 'Automatic GTA World chat color detection and formatting. No more manual color picking.'
  },
  {
    icon: 'mdi-gesture',
    title: 'One-Click Actions',
    description: 'Censoring, positioning, and scaling with simple clicks and drags. No more masking or complex tools.'
  },
  {
    icon: 'mdi-export',
    title: 'Quick Export',
    description: 'Export perfect screenshots in seconds. No more saving multiple files or format conversions.'
  }
];

const timeComparison = [
  {
    action: 'Import & Position',
    photoshop: '3-5 min',
    magician: '10 sec'
  },
  {
    action: 'Format Chat',
    photoshop: '5-10 min',
    magician: '5 sec'
  },
  {
    action: 'Censor Content',
    photoshop: '2-3 min',
    magician: '5 sec'
  },
  {
    action: 'Export',
    photoshop: '1-2 min',
    magician: '2 sec'
  }
];

const reviewForm = reactive({
  name: '',
  quote: '',
  rating: 5
});

const reviewAlertTone = ref<'success' | 'error' | 'info'>('success');
const reviewAlertText = ref('');

const { showAds } = useAdPreferences();
const { summary, hasSummaryError, lastSummaryRefreshAt } = useLiveStatsSummary();
const {
  hasTestimonialsError,
  isLoadingTestimonials,
  isSubmittingTestimonial,
  submitTestimonial,
  testimonials
} = useTestimonials();

const liveStatCards = [
  {
    title: 'All-Time Unique Users',
    value: () => summary.value.uniqueUsers,
    icon: 'mdi-account-group',
    tone: 'primary',
    caption: 'Unique browser visitors seen by the app'
  },
  {
    title: 'Images Exported',
    value: () => summary.value.imagesExported,
    icon: 'mdi-image-multiple',
    tone: 'success',
    caption: 'Successful PNG exports recorded from the editor'
  },
  {
    title: 'Active Right Now',
    value: () => summary.value.activeUsers,
    icon: 'mdi-access-point',
    tone: 'info',
    caption: 'Visitors active within the last two minutes'
  },
  {
    title: 'Unique Exporters',
    value: () => summary.value.uniqueExporters,
    icon: 'mdi-tray-arrow-up',
    tone: 'warning',
    caption: 'Visitors who have exported at least one image'
  }
];

const interestingStatCards = [
  {
    title: 'Total Visits',
    value: () => summary.value.totalVisits,
    detail: 'Every tracked app session start'
  },
  {
    title: 'Avg Exports / User',
    value: () => summary.value.averageExportsPerUser,
    detail: 'Images exported divided by unique users'
  }
];

const testimonialCards = computed(() => testimonials.value.slice(0, 6));
const featuredTestimonial = computed(() => testimonialCards.value[0] ?? null);

const averageReviewRating = computed(() => {
  if (testimonials.value.length === 0) return 0;

  const total = testimonials.value.reduce((sum, testimonial) => sum + testimonial.rating, 0);
  return Number((total / testimonials.value.length).toFixed(1));
});

const canSubmitReview = computed(() =>
  reviewForm.name.trim().length >= 2
  && reviewForm.quote.trim().length >= 20
  && reviewForm.rating >= 1
  && reviewForm.rating <= 5
);

const formatRelativeDate = (isoString: string) => {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return 'Recently';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
};

const getTestimonialInitials = (name: string) => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase() ?? '')
  .join('') || '?';

const trustStripItems = computed(() => [
  {
    icon: 'mdi-star-circle-outline',
    label: 'Average Review',
    value: testimonialCards.value.length > 0 ? `${averageReviewRating.value.toFixed(1)}/5` : 'New'
  },
  {
    icon: 'mdi-comment-quote-outline',
    label: 'Community Reviews',
    value: testimonials.value.length > 0 ? testimonials.value.length.toLocaleString() : 'Be first'
  },
  {
    icon: 'mdi-image-multiple-outline',
    label: 'Images Exported',
    value: summary.value.imagesExported.toLocaleString()
  }
]);

const submitReview = async () => {
  if (!canSubmitReview.value) {
    reviewAlertTone.value = 'info';
    reviewAlertText.value = 'Add your username and a short review so others know what helped.';
    return;
  }

  try {
    await submitTestimonial({
      name: reviewForm.name.trim(),
      quote: reviewForm.quote.trim(),
      rating: reviewForm.rating
    });

    reviewForm.name = '';
    reviewForm.quote = '';
    reviewForm.rating = 5;
    reviewAlertTone.value = 'success';
    reviewAlertText.value = 'Thanks for the review. It is now live on the home page.';
  } catch (error) {
    reviewAlertTone.value = 'error';
    reviewAlertText.value = error instanceof Error
      ? error.message
      : 'We could not save your review right now.';
  }
};
</script>

<template>
  <div class="home-container">
    <section class="hero-section">
      <v-container class="home-shell home-shell--hero pt-16 pb-8">
        <v-row align="center" justify="center">
          <v-col cols="12" class="text-center hero-copy-column">
            <h1 class="text-h2 font-weight-bold mb-6">
              Screenshot
              <span class="gradient-text">Magician</span>
            </h1>
            <p class="text-h6 text-medium-emphasis mb-4">
              Transform your screenshots into perfect compositions with our powerful editing suite.
              Designed specifically for GTA World.
            </p>
            <p class="text-h5 gradient-text mb-8">
              Replace Photoshop. Save Time. Get Better Results.
            </p>
            <div class="hero-actions">
              <router-link to="/ssmag" style="text-decoration: none;">
                <v-btn
                  size="x-large"
                  color="primary"
                  class="px-8 text-uppercase"
                >
                  Get Started
                  <v-icon end icon="mdi-arrow-right" class="ml-2"></v-icon>
                </v-btn>
              </router-link>
              <a href="#reviews" style="text-decoration: none;">
                <v-btn
                  size="x-large"
                  variant="tonal"
                  class="px-8 text-uppercase"
                >
                  Leave a Review
                  <v-icon end icon="mdi-star-outline" class="ml-2"></v-icon>
                </v-btn>
              </a>
            </div>
            <div class="hero-scroll-cue mt-8">
              <a href="#social-proof" class="hero-scroll-link">
                <span>See reviews and stats</span>
                <v-icon icon="mdi-chevron-down"></v-icon>
              </a>
            </div>
          </v-col>
        </v-row>
      </v-container>
    </section>

    <section id="social-proof" class="trust-strip-section">
      <v-container class="home-shell home-shell--wide pt-0 pb-10">
        <v-row class="mb-6">
          <v-col cols="12">
            <div class="trust-strip">
              <div
                v-for="item in trustStripItems"
                :key="item.label"
                class="trust-strip-item"
              >
                <v-avatar size="42" variant="tonal" color="primary">
                  <v-icon :icon="item.icon"></v-icon>
                </v-avatar>
                <div>
                  <div class="text-overline trust-strip-label">{{ item.label }}</div>
                  <div class="text-h6 trust-strip-value">{{ item.value }}</div>
                </div>
              </div>
            </div>
          </v-col>
        </v-row>

        <v-row v-if="featuredTestimonial" class="mb-2">
          <v-col cols="12">
            <v-card class="featured-testimonial-card" rounded="xl">
              <v-card-item>
                <template #prepend>
                  <v-avatar class="testimonial-avatar" size="48">
                    {{ getTestimonialInitials(featuredTestimonial.name) }}
                  </v-avatar>
                </template>
                <v-card-title class="d-flex align-center flex-wrap ga-2">
                  <span>What users are saying</span>
                  <span class="text-body-2 text-medium-emphasis">
                    {{ averageReviewRating.toFixed(1) }}/5 average rating
                  </span>
                </v-card-title>
                <v-card-subtitle>
                  Featured review from {{ featuredTestimonial.name }}
                </v-card-subtitle>
                <template #append>
                  <v-btn variant="text" color="primary" href="#reviews">
                    Read More Reviews
                  </v-btn>
                </template>
              </v-card-item>
              <v-card-text>
                <div class="testimonial-stars mb-3" :aria-label="`${featuredTestimonial.rating} out of 5 stars`">
                  <v-icon
                    v-for="star in 5"
                    :key="`featured-${star}`"
                    :icon="star <= featuredTestimonial.rating ? 'mdi-star' : 'mdi-star-outline'"
                    size="18"
                  ></v-icon>
                </div>
                <p class="featured-testimonial-quote mb-0">“{{ featuredTestimonial.quote }}”</p>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </section>

    <section class="features-section">
      <v-container class="home-shell home-shell--wide pt-6 pb-14">
        <v-row>
          <v-col cols="12" class="text-center mb-12">
            <h2 class="text-h4 font-weight-bold mb-3">Why Switch?</h2>
            <p class="text-medium-emphasis">Everything you need, nothing you don't</p>
          </v-col>
        </v-row>
        <v-row>
          <v-col
            v-for="feature in features"
            :key="feature.title"
            cols="12"
            sm="6"
            md="3"
          >
            <v-hover v-slot="{ isHovering, props }">
              <v-card
                v-bind="props"
                :elevation="isHovering ? 8 : 2"
                :class="['feature-card', { 'on-hover': isHovering }]"
                height="220"
              >
                <v-card-item>
                  <v-icon
                    :icon="feature.icon"
                    size="48"
                    class="mb-4 gradient-icon"
                  ></v-icon>
                  <v-card-title class="text-h6 mb-2">{{ feature.title }}</v-card-title>
                  <v-card-text class="text-medium-emphasis">
                    {{ feature.description }}
                  </v-card-text>
                </v-card-item>
              </v-card>
            </v-hover>
          </v-col>
        </v-row>
      </v-container>
    </section>

    <section id="reviews" class="reviews-section">
      <v-container class="py-14">
        <v-row align="end" class="mb-6">
          <v-col cols="12" md="7">
            <h2 class="text-h4 font-weight-bold mb-3">Community Reviews</h2>
            <p class="text-medium-emphasis mb-0">
              Quick testimonials from people actually using Screenshot Magician for forum-ready screenshots.
            </p>
          </v-col>
          <v-col cols="12" md="5" class="text-md-right">
            <div class="review-summary-chip">
              <v-icon icon="mdi-star" class="mr-2"></v-icon>
              <span v-if="testimonialCards.length > 0">
                {{ averageReviewRating.toFixed(1) }}/5 from {{ testimonials.length }} review{{ testimonials.length === 1 ? '' : 's' }}
              </span>
              <span v-else>
                Be the first to leave a review
              </span>
            </div>
          </v-col>
        </v-row>

        <v-row class="ga-md-0 ga-6">
          <v-col cols="12" md="7">
            <div v-if="isLoadingTestimonials" class="text-medium-emphasis">
              Loading reviews...
            </div>
            <v-row v-else-if="testimonialCards.length > 0">
              <v-col
                v-for="testimonial in testimonialCards"
                :key="testimonial.id"
                cols="12"
                md="6"
              >
                <v-card class="testimonial-card" rounded="xl" height="100%">
                  <v-card-item>
                    <template #prepend>
                      <v-avatar class="testimonial-avatar" size="44">
                        {{ getTestimonialInitials(testimonial.name) }}
                      </v-avatar>
                    </template>
                    <v-card-title>{{ testimonial.name }}</v-card-title>
                    <template #append>
                      <div class="testimonial-date text-caption text-medium-emphasis">
                        {{ formatRelativeDate(testimonial.createdAt) }}
                      </div>
                    </template>
                  </v-card-item>
                  <v-card-text>
                    <div class="testimonial-stars mb-3" :aria-label="`${testimonial.rating} out of 5 stars`">
                      <v-icon
                        v-for="star in 5"
                        :key="`${testimonial.id}-${star}`"
                        :icon="star <= testimonial.rating ? 'mdi-star' : 'mdi-star-outline'"
                        size="18"
                      ></v-icon>
                    </div>
                    <p class="testimonial-quote mb-0">“{{ testimonial.quote }}”</p>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
            <v-card v-else class="testimonial-empty-card" rounded="xl">
              <v-card-text class="text-medium-emphasis">
                No testimonials yet. Leave the first review and help new users feel confident trying the editor.
              </v-card-text>
            </v-card>

            <v-alert
              v-if="hasTestimonialsError"
              class="mt-4"
              type="warning"
              variant="tonal"
              title="Reviews unavailable"
              text="The testimonial feed needs the backend running to load and accept reviews."
            />
          </v-col>

          <v-col cols="12" md="5">
            <v-card class="review-form-card" rounded="xl">
              <v-card-item>
                <v-card-title class="text-h5">Leave a Quick Review</v-card-title>
                <v-card-subtitle>
                  A short note here goes live on the home page and helps other people decide to try it.
                </v-card-subtitle>
              </v-card-item>
              <v-card-text>
                <v-text-field
                  v-model="reviewForm.name"
                  label="Username"
                  variant="outlined"
                  density="comfortable"
                  maxlength="40"
                  counter
                ></v-text-field>
                <div class="text-subtitle-2 mb-2">Rating</div>
                <v-rating
                  v-model="reviewForm.rating"
                  color="amber"
                  active-color="amber"
                  hover
                  density="comfortable"
                  length="5"
                  class="mb-4"
                ></v-rating>
                <v-textarea
                  v-model="reviewForm.quote"
                  label="What made Screenshot Magician useful for you?"
                  variant="outlined"
                  rows="5"
                  auto-grow
                  maxlength="280"
                  counter
                ></v-textarea>
                <div class="text-caption text-medium-emphasis">
                  Keep it short, specific, and useful. Public reviews are shown on the home page.
                </div>
                <v-alert
                  v-if="reviewAlertText"
                  class="mt-4"
                  :type="reviewAlertTone"
                  variant="tonal"
                  :text="reviewAlertText"
                />
              </v-card-text>
              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn
                  color="primary"
                  size="large"
                  :loading="isSubmittingTestimonial"
                  :disabled="!canSubmitReview || isSubmittingTestimonial"
                  @click="submitReview"
                >
                  Submit Review
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </section>

    <section class="stats-section">
      <v-container class="py-14">
        <v-row align="end" class="mb-6">
          <v-col cols="12" md="8">
            <h2 class="text-h4 font-weight-bold mb-3">Live Community Tracker</h2>
            <p class="text-medium-emphasis mb-0">
              Real usage pulled from the app backend and refreshed automatically.
            </p>
          </v-col>
          <v-col cols="12" md="4" class="text-md-right">
            <span class="stats-updated text-medium-emphasis">
              Updated {{ new Date(lastSummaryRefreshAt).toLocaleTimeString() }}
            </span>
          </v-col>
        </v-row>

        <v-row class="mb-6">
          <v-col
            v-for="stat in liveStatCards"
            :key="stat.title"
            cols="12"
            sm="6"
            md="3"
          >
            <v-card class="stats-card" rounded="xl">
              <v-card-item>
                <template #prepend>
                  <v-avatar :color="stat.tone" variant="tonal" size="44">
                    <v-icon :icon="stat.icon" />
                  </v-avatar>
                </template>
                <v-card-subtitle>{{ stat.title }}</v-card-subtitle>
                <v-card-title class="text-h4 mt-2">{{ stat.value().toLocaleString() }}</v-card-title>
                <v-card-text class="text-medium-emphasis">
                  {{ stat.caption }}
                </v-card-text>
              </v-card-item>
            </v-card>
          </v-col>
        </v-row>

        <v-row>
          <v-col
            v-for="stat in interestingStatCards"
            :key="stat.title"
            cols="12"
            md="6"
          >
            <v-card class="stats-card stats-card--compact" rounded="xl">
              <v-card-item>
                <v-card-subtitle>{{ stat.title }}</v-card-subtitle>
                <v-card-title class="text-h4 mt-2">{{ stat.value().toLocaleString() }}</v-card-title>
                <v-card-text class="text-medium-emphasis">
                  {{ stat.detail }}
                </v-card-text>
              </v-card-item>
            </v-card>
          </v-col>
        </v-row>

        <v-alert
          v-if="hasSummaryError"
          class="mt-6"
          type="warning"
          variant="tonal"
          title="Tracker offline"
          text="The live tracker needs the backend running to populate these numbers."
        />
      </v-container>
    </section>

    <section class="comparison-section">
      <v-container class="py-14">
        <v-row>
          <v-col cols="12" class="text-center mb-12">
            <h2 class="text-h4 font-weight-bold mb-3">Time Saved</h2>
            <p class="text-medium-emphasis">Complete your edits in seconds, not minutes</p>
          </v-col>
        </v-row>
        <v-row justify="center">
          <v-col cols="12" md="8">
            <v-table class="comparison-table">
              <thead>
                <tr>
                  <th class="text-left">Action</th>
                  <th class="text-center">Photoshop</th>
                  <th class="text-center">Screenshot Magician</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in timeComparison" :key="item.action">
                  <td>{{ item.action }}</td>
                  <td class="text-center photoshop-time">{{ item.photoshop }}</td>
                  <td class="text-center magician-time">{{ item.magician }}</td>
                </tr>
                <tr class="total-row">
                  <td class="text-left font-weight-bold">Total Time</td>
                  <td class="text-center photoshop-time">11-20 min</td>
                  <td class="text-center magician-time">22 sec</td>
                </tr>
              </tbody>
            </v-table>
          </v-col>
        </v-row>
      </v-container>
    </section>

    <section v-if="showAds" class="support-section">
      <v-container class="pt-0 pb-10">
        <v-row justify="center">
          <v-col cols="12" lg="10">
            <div class="text-center mb-4">
              <div class="text-overline">Support Screenshot Magician</div>
              <div class="text-h5 font-weight-bold mb-2">A small sponsor slot can help cover hosting costs</div>
              <p class="text-medium-emphasis mb-0">
                We keep this near the bottom so it supports the project without getting in the way of discovery.
              </p>
            </div>
            <AdSlot
              compact
              title="Support the project"
              description="A future ad here can help cover hosting costs. If you'd rather not see ads, you can disable them for free in Settings."
            />
          </v-col>
        </v-row>
      </v-container>
    </section>
  </div>
</template>

<style scoped>
.home-container {
  --home-bg: #121313;
  --home-surface: #1e1e1e;
  --home-text: #f5f7fa;
  --home-muted: rgba(245, 247, 250, 0.72);
  --home-border: rgba(255, 255, 255, 0.08);
  --home-border-strong: rgba(255, 255, 255, 0.14);
  --home-accent-a: #42a5f5;
  --home-accent-b: #ab47bc;
  background-color: #121313;
  min-height: 100%;
  height: 100%;
  overflow-y: auto;
  position: relative;
  color: var(--home-text);
}

.hero-section {
  position: relative;
  overflow: hidden;
}

.home-shell {
  width: min(100%, 1180px);
  margin: 0 auto;
}

.home-shell--hero {
  width: min(100%, 1040px);
}

.home-shell--wide {
  width: min(100%, 1320px);
}

.hero-copy-column {
  max-width: 920px;
  margin: 0 auto;
}

.hero-section::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(
    circle at center,
    rgba(66, 66, 66, 0.1) 0%,
    rgba(18, 19, 19, 0) 50%
  );
  animation: rotate 30s linear infinite;
}

.hero-actions {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px;
}

.hero-scroll-cue {
  display: flex;
  justify-content: center;
}

.hero-scroll-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--home-muted);
  text-decoration: none;
  transition: color 0.2s ease;
}

.hero-scroll-link:hover {
  color: var(--home-text);
}

.trust-strip-section {
  position: relative;
  z-index: 1;
}

.trust-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.trust-strip-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  border-radius: 20px;
  border: 1px solid var(--home-border);
  background:
    linear-gradient(160deg, rgba(66, 165, 245, 0.1), rgba(171, 71, 188, 0.05)),
    rgba(255, 255, 255, 0.02);
}

.trust-strip-label {
  letter-spacing: 0.08em;
  color: var(--home-muted);
}

.trust-strip-value {
  line-height: 1.1;
}

.featured-testimonial-card {
  background:
    linear-gradient(125deg, rgba(66, 165, 245, 0.14), rgba(171, 71, 188, 0.08)),
    var(--home-surface);
  border: 1px solid var(--home-border);
  color: var(--home-text) !important;
}

.featured-testimonial-quote {
  font-size: 1rem;
  line-height: 1.75;
}

.gradient-text {
  background: linear-gradient(45deg, var(--home-accent-a), var(--home-accent-b));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  display: inline-block;
}

.gradient-icon {
  background: linear-gradient(45deg, var(--home-accent-a), var(--home-accent-b));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.feature-card {
  transition: all 0.3s ease;
  background-color: var(--home-surface);
  border: 1px solid var(--home-border);
  color: var(--home-text) !important;
}

.reviews-section {
  background:
    radial-gradient(circle at top left, rgba(66, 165, 245, 0.1), rgba(18, 19, 19, 0) 42%),
    radial-gradient(circle at bottom right, rgba(171, 71, 188, 0.12), rgba(18, 19, 19, 0) 38%);
}

.support-section {
  border-top: 1px solid var(--home-border);
}

.review-summary-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 18px;
  border: 1px solid var(--home-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
}

.testimonial-card,
.review-form-card,
.testimonial-empty-card,
.stats-card {
  background:
    linear-gradient(160deg, rgba(66, 165, 245, 0.12), rgba(171, 71, 188, 0.06)),
    var(--home-surface);
  border: 1px solid var(--home-border);
  color: var(--home-text) !important;
}

.review-form-card {
  position: sticky;
  top: 24px;
}

.testimonial-empty-card {
  background:
    linear-gradient(160deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01)),
    var(--home-surface);
}

.testimonial-avatar {
  background: linear-gradient(135deg, rgba(66, 165, 245, 0.9), rgba(171, 71, 188, 0.85));
  color: white;
  font-weight: 700;
}

.testimonial-stars {
  display: inline-flex;
  gap: 4px;
  color: #ffca28;
}

.testimonial-quote {
  font-size: 0.98rem;
  line-height: 1.7;
}

.testimonial-date {
  white-space: nowrap;
}

.stats-card {
  height: 100%;
}

.stats-card--compact {
  background:
    linear-gradient(160deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01)),
    var(--home-surface);
}

.stats-updated {
  display: inline-block;
  padding-top: 8px;
}

.feature-card.on-hover {
  transform: translateY(-5px);
  border-color: var(--home-border-strong);
}

.comparison-table {
  background-color: var(--home-surface) !important;
  border: 1px solid var(--home-border);
  border-radius: 8px;
  color: var(--home-text) !important;
}

.photoshop-time {
  color: #ff5252 !important;
}

.magician-time {
  color: #4caf50 !important;
}

.total-row {
  border-top: 2px solid var(--home-border-strong);
}

.total-row td {
  padding-top: 16px !important;
}

.home-container :deep(.text-medium-emphasis) {
  color: var(--home-muted) !important;
}

.home-container :deep(.v-card-title),
.home-container :deep(.v-card-text),
.home-container :deep(.v-table),
.home-container :deep(.v-table th),
.home-container :deep(.v-table td) {
  color: var(--home-text) !important;
}

.home-container :deep(.v-table thead th) {
  font-weight: 700;
}

.home-container :deep(.v-table tbody tr:not(:last-child) td) {
  border-bottom-color: var(--home-border) !important;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 960px) {
  .review-form-card {
    position: static;
  }

  .trust-strip {
    grid-template-columns: 1fr;
  }

  .home-shell,
  .home-shell--hero,
  .home-shell--wide {
    width: 100%;
  }
}

@media (max-width: 600px) {
  .text-h2 {
    font-size: 2.5rem !important;
  }

  .text-h6 {
    font-size: 1rem !important;
  }

  .hero-actions {
    width: 100%;
  }

  .hero-actions :deep(.v-btn) {
    width: 100%;
  }
}
</style>
