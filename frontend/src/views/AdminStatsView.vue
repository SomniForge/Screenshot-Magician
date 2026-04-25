<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { type AdminStatsBucket, type AdminStatsEvent, type AdminStatsRange, useAdminStats } from '@/composables/useAdminStats';

const range = ref<AdminStatsRange>('30d');
const bucket = ref<AdminStatsBucket | 'auto'>('auto');
const tokenInput = ref('');
const actionMessage = ref('');
const actionTone = ref<'success' | 'error' | 'info'>('info');

const {
  adminToken,
  clearAdminStatsSession,
  fetchAdminStats,
  isAuthenticated,
  isLoadingStats,
  setAdminToken,
  stats,
  statsError
} = useAdminStats();

watch(adminToken, (value) => {
  tokenInput.value = value;
}, { immediate: true });

const loadStats = async () => {
  actionMessage.value = '';
  setAdminToken(tokenInput.value);

  try {
    await fetchAdminStats({
      bucket: bucket.value === 'auto' ? undefined : bucket.value,
      range: range.value
    });
    actionTone.value = 'success';
    actionMessage.value = 'Statistics loaded.';
  } catch {
    actionTone.value = 'error';
  }
};

const refreshStats = async () => {
  actionMessage.value = '';

  try {
    await fetchAdminStats({
      bucket: bucket.value === 'auto' ? undefined : bucket.value,
      range: range.value
    });
  } catch {
    actionTone.value = 'error';
  }
};

const signOut = () => {
  clearAdminStatsSession();
  tokenInput.value = '';
  actionTone.value = 'info';
  actionMessage.value = 'Admin token cleared from this browser session.';
};

watch([range, bucket], () => {
  if (isAuthenticated.value && stats.value) {
    void refreshStats();
  }
});

const formatNumber = (value: number) => new Intl.NumberFormat().format(value);

const formatDate = (value?: string | null) => {
  if (!value) return 'Not available yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

const maxTimelineValue = computed(() => Math.max(
  1,
  ...(stats.value?.timeline.map((item) => Math.max(item.visits, item.exports, item.activity)) ?? [1])
));

const exportTotal = computed(() => Math.max(1, stats.value?.exports.total ?? 0));
const downloadShare = computed(() => ((stats.value?.exports.byMethod.download ?? 0) / exportTotal.value) * 100);
const imgbbShare = computed(() => ((stats.value?.exports.byMethod.imgbb ?? 0) / exportTotal.value) * 100);
const unknownShare = computed(() => ((stats.value?.exports.byMethod.unknown ?? 0) / exportTotal.value) * 100);
const exportPieStyle = computed(() => ({
  background: `conic-gradient(#64d2ff 0 ${downloadShare.value}%, #82e6a8 ${downloadShare.value}% ${downloadShare.value + imgbbShare.value}%, #ffcc66 ${downloadShare.value + imgbbShare.value}% ${downloadShare.value + imgbbShare.value + unknownShare.value}%, rgba(255,255,255,0.1) 0)`
}));

const testimonialTotal = computed(() => Math.max(1, stats.value?.testimonials.total ?? 0));
const testimonialPieStyle = computed(() => {
  const approved = ((stats.value?.testimonials.byStatus.approved ?? 0) / testimonialTotal.value) * 100;
  const pending = ((stats.value?.testimonials.byStatus.pending ?? 0) / testimonialTotal.value) * 100;
  const rejected = ((stats.value?.testimonials.byStatus.rejected ?? 0) / testimonialTotal.value) * 100;

  return {
    background: `conic-gradient(#82e6a8 0 ${approved}%, #ffcc66 ${approved}% ${approved + pending}%, #ff7676 ${approved + pending}% ${approved + pending + rejected}%, rgba(255,255,255,0.1) 0)`
  };
});

const getEventLabel = (event: AdminStatsEvent) => {
  if (event.type === 'export') {
    return `Exported via ${event.exportMethod ?? 'unknown'}`;
  }

  if (event.type === 'session_start') {
    return `Session start on ${event.path ?? '/'}`;
  }

  return `Activity on ${event.path ?? '/'}`;
};
</script>

<template>
  <div class="stats-view">
    <v-container class="stats-shell py-10">
      <v-row class="mb-8" align="center">
        <v-col cols="12" md="8">
          <div class="stats-eyebrow">Admin Intelligence</div>
          <h1 class="stats-title mb-3">Statistics Suite</h1>
          <p class="stats-lede mb-0">
            See traffic, exports, upload method split, active sessions, testimonial health, paths, and raw event history from the stats backend.
          </p>
        </v-col>
        <v-col cols="12" md="4" class="text-md-right">
          <v-btn
            color="primary"
            variant="tonal"
            prepend-icon="mdi-refresh"
            :disabled="!isAuthenticated"
            :loading="isLoadingStats"
            @click="refreshStats"
          >
            Refresh Stats
          </v-btn>
        </v-col>
      </v-row>

      <v-card class="stats-card mb-6" rounded="xl">
        <v-card-item>
          <v-card-title class="d-flex align-center flex-wrap ga-3">
            <span>Admin Access</span>
            <v-chip :color="isAuthenticated ? 'success' : 'default'" size="small" variant="tonal">
              {{ isAuthenticated ? 'Unlocked' : 'Locked' }}
            </v-chip>
          </v-card-title>
          <v-card-subtitle>
            Uses the same backend admin token as testimonial moderation. Stored only in this browser session.
          </v-card-subtitle>
        </v-card-item>
        <v-card-text>
          <v-row align="center">
            <v-col cols="12" md="5">
              <v-text-field
                v-model="tokenInput"
                label="Admin token"
                type="password"
                variant="outlined"
                density="comfortable"
                autocomplete="off"
                hide-details="auto"
                @keyup.enter="loadStats"
              />
            </v-col>
            <v-col cols="12" sm="6" md="2">
              <v-select
                v-model="range"
                label="Timeframe"
                variant="outlined"
                density="comfortable"
                hide-details="auto"
                :items="[
                  { title: 'Last 24 hours', value: '24h' },
                  { title: 'Last 7 days', value: '7d' },
                  { title: 'Last 30 days', value: '30d' },
                  { title: 'Last 90 days', value: '90d' },
                  { title: 'All time', value: 'all' }
                ]"
              />
            </v-col>
            <v-col cols="12" sm="6" md="2">
              <v-select
                v-model="bucket"
                label="Chart bucket"
                variant="outlined"
                density="comfortable"
                hide-details="auto"
                :items="[
                  { title: 'Auto', value: 'auto' },
                  { title: 'Hourly', value: 'hour' },
                  { title: 'Daily', value: 'day' },
                  { title: 'Weekly', value: 'week' },
                  { title: 'Monthly', value: 'month' }
                ]"
              />
            </v-col>
            <v-col cols="12" md="3" class="d-flex justify-md-end ga-3 flex-wrap">
              <v-btn color="primary" :loading="isLoadingStats" @click="loadStats">
                Load Dashboard
              </v-btn>
              <v-btn variant="text" :disabled="!isAuthenticated" @click="signOut">
                Clear Token
              </v-btn>
            </v-col>
          </v-row>

          <v-alert v-if="actionMessage" class="mt-4" :type="actionTone" variant="tonal" :text="actionMessage" />
          <v-alert v-if="statsError" class="mt-4" type="error" variant="tonal" :text="statsError" />
        </v-card-text>
      </v-card>

      <v-card v-if="!stats" class="stats-card stats-empty" rounded="xl">
        <v-card-text class="py-12 text-center">
          Enter the admin token and load the dashboard to inspect backend data.
        </v-card-text>
      </v-card>

      <template v-else>
        <v-alert
          v-if="stats.dataQuality.note"
          class="mb-6"
          type="info"
          variant="tonal"
          :text="stats.dataQuality.note"
        />

        <div class="stats-meta mb-6">
          <span>{{ stats.window.label }}</span>
          <span>Bucketed by {{ stats.window.bucketSize }}</span>
          <span>Generated {{ formatDate(stats.generatedAt) }}</span>
          <span>Event log since {{ formatDate(stats.dataQuality.eventLogStartedAt) }}</span>
        </div>

        <v-row class="mb-6">
          <v-col cols="12" sm="6" lg="3">
            <v-card class="metric-card" rounded="xl">
              <div class="metric-label">Unique users</div>
              <div class="metric-value">{{ formatNumber(stats.totals.uniqueUsers) }}</div>
              <div class="metric-note">{{ formatNumber(stats.totals.activeUsers) }} active right now</div>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" lg="3">
            <v-card class="metric-card" rounded="xl">
              <div class="metric-label">Visits</div>
              <div class="metric-value">{{ formatNumber(stats.totals.totalVisits) }}</div>
              <div class="metric-note">{{ formatNumber(stats.sessions.activityHeartbeats) }} activity heartbeats</div>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" lg="3">
            <v-card class="metric-card" rounded="xl">
              <div class="metric-label">Exports</div>
              <div class="metric-value">{{ formatNumber(stats.totals.imagesExported) }}</div>
              <div class="metric-note">{{ stats.totals.averageExportsPerUser }} per user</div>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" lg="3">
            <v-card class="metric-card" rounded="xl">
              <div class="metric-label">Export conversion</div>
              <div class="metric-value">{{ stats.totals.exportConversionRate }}%</div>
              <div class="metric-note">{{ formatNumber(stats.totals.uniqueExporters) }} unique exporters</div>
            </v-card>
          </v-col>
        </v-row>

        <v-row class="mb-6">
          <v-col cols="12" lg="8">
            <v-card class="stats-card" rounded="xl">
              <v-card-item>
                <v-card-title>Traffic and Export Timeline</v-card-title>
                <v-card-subtitle>Visits, total exports, and activity grouped by the selected timeframe.</v-card-subtitle>
              </v-card-item>
              <v-card-text>
                <div class="timeline-chart">
                  <div v-for="point in stats.timeline" :key="point.date" class="timeline-column">
                    <div class="timeline-bars">
                      <span class="bar bar-visits" :style="{ height: `${Math.max(4, (point.visits / maxTimelineValue) * 100)}%` }" />
                      <span class="bar bar-exports" :style="{ height: `${Math.max(4, (point.exports / maxTimelineValue) * 100)}%` }" />
                      <span class="bar bar-activity" :style="{ height: `${Math.max(4, (point.activity / maxTimelineValue) * 100)}%` }" />
                    </div>
                    <span class="timeline-label">{{ point.label }}</span>
                  </div>
                </div>
                <div class="chart-legend mt-4">
                  <span><i class="legend-dot visits" />Visits</span>
                  <span><i class="legend-dot exports" />Exports</span>
                  <span><i class="legend-dot activity" />Activity</span>
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" lg="4">
            <v-card class="stats-card h-100" rounded="xl">
              <v-card-item>
                <v-card-title>Export Method Split</v-card-title>
                <v-card-subtitle>Local machine save vs ImgBB upload.</v-card-subtitle>
              </v-card-item>
              <v-card-text>
                <div class="donut-wrap">
                  <div class="donut" :style="exportPieStyle">
                    <div class="donut-hole">{{ formatNumber(stats.exports.total) }}</div>
                  </div>
                </div>
                <div class="breakdown-list mt-5">
                  <div><span><i class="legend-dot downloads" />Saved to machine</span><strong>{{ formatNumber(stats.exports.byMethod.download) }}</strong></div>
                  <div><span><i class="legend-dot imgbb" />Uploaded to ImgBB</span><strong>{{ formatNumber(stats.exports.byMethod.imgbb) }}</strong></div>
                  <div><span><i class="legend-dot unknown" />Unknown or legacy</span><strong>{{ formatNumber(stats.exports.byMethod.unknown) }}</strong></div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <v-row class="mb-6">
          <v-col cols="12" md="6">
            <v-card class="stats-card h-100" rounded="xl">
              <v-card-item>
                <v-card-title>Top Paths</v-card-title>
                <v-card-subtitle>Where sessions and activity are happening.</v-card-subtitle>
              </v-card-item>
              <v-card-text>
                <div v-if="stats.sessions.topPaths.length === 0" class="quiet-copy">No path data in this timeframe.</div>
                <div v-else class="rank-list">
                  <div v-for="path in stats.sessions.topPaths" :key="path.label" class="rank-row">
                    <span>{{ path.label }}</span>
                    <div class="rank-meter"><i :style="{ width: `${Math.max(6, (path.value / Math.max(1, stats.sessions.topPaths[0].value)) * 100)}%` }" /></div>
                    <strong>{{ formatNumber(path.value) }}</strong>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="6">
            <v-card class="stats-card h-100" rounded="xl">
              <v-card-item>
                <v-card-title>Testimonials</v-card-title>
                <v-card-subtitle>Submission volume, status mix, and rating signal.</v-card-subtitle>
              </v-card-item>
              <v-card-text>
                <div class="testimonial-grid">
                  <div class="donut small" :style="testimonialPieStyle">
                    <div class="donut-hole">{{ formatNumber(stats.testimonials.total) }}</div>
                  </div>
                  <div class="breakdown-list">
                    <div><span><i class="legend-dot imgbb" />Approved</span><strong>{{ formatNumber(stats.testimonials.byStatus.approved) }}</strong></div>
                    <div><span><i class="legend-dot unknown" />Pending</span><strong>{{ formatNumber(stats.testimonials.byStatus.pending) }}</strong></div>
                    <div><span><i class="legend-dot rejected" />Rejected</span><strong>{{ formatNumber(stats.testimonials.byStatus.rejected) }}</strong></div>
                    <div><span>Submitted in window</span><strong>{{ formatNumber(stats.testimonials.submittedInWindow) }}</strong></div>
                    <div><span>Average rating in window</span><strong>{{ stats.testimonials.averageRating || 'N/A' }}</strong></div>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" lg="5">
            <v-card class="stats-card h-100" rounded="xl">
              <v-card-item>
                <v-card-title>Active Sessions</v-card-title>
                <v-card-subtitle>Visitors seen in the last couple minutes.</v-card-subtitle>
              </v-card-item>
              <v-card-text>
                <div v-if="stats.activeSessions.length === 0" class="quiet-copy">No active sessions right now.</div>
                <div v-else class="event-list compact">
                  <div v-for="session in stats.activeSessions" :key="`${session.visitorId}-${session.lastSeenAt}`" class="event-row">
                    <strong>{{ session.currentPath }}</strong>
                    <span>{{ session.visitorId }}</span>
                    <small>{{ formatDate(session.lastSeenAt) }}</small>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" lg="7">
            <v-card class="stats-card h-100" rounded="xl">
              <v-card-item>
                <v-card-title>Recent Events</v-card-title>
                <v-card-subtitle>Latest tracked backend events for the selected timeframe.</v-card-subtitle>
              </v-card-item>
              <v-card-text>
                <div v-if="stats.recentEvents.length === 0" class="quiet-copy">No recent events in this timeframe.</div>
                <div v-else class="event-list">
                  <div v-for="event in stats.recentEvents" :key="event.id" class="event-row">
                    <strong>{{ getEventLabel(event) }}</strong>
                    <span>{{ event.visitorId }}</span>
                    <small>{{ formatDate(event.occurredAt) }}</small>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </template>
    </v-container>
  </div>
</template>

<style scoped>
.stats-view {
  height: 100%;
  min-height: 100%;
  background:
    radial-gradient(circle at 8% 12%, rgba(100, 210, 255, 0.18), transparent 30%),
    radial-gradient(circle at 92% 0%, rgba(130, 230, 168, 0.14), transparent 28%),
    linear-gradient(135deg, #0b1016 0%, #121b22 48%, #15120d 100%);
  color: #f7fbff;
  overflow-y: auto;
  overflow-x: hidden;
}

.stats-shell {
  width: min(100%, 1280px);
}

.stats-eyebrow {
  color: #82e6a8;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.stats-title {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: clamp(2.4rem, 6vw, 4.8rem);
  line-height: 0.95;
}

.stats-lede {
  color: rgba(247, 251, 255, 0.76);
  max-width: 820px;
}

.stats-card,
.metric-card {
  background: linear-gradient(155deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.045));
  border: 1px solid rgba(255, 255, 255, 0.11);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
  color: #f7fbff !important;
}

.metric-card {
  padding: 22px;
  min-height: 150px;
}

.metric-label,
.metric-note,
.stats-meta,
.quiet-copy {
  color: rgba(247, 251, 255, 0.68);
}

.metric-label {
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.metric-value {
  margin-top: 16px;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: clamp(2rem, 5vw, 3.4rem);
  line-height: 1;
}

.metric-note {
  margin-top: 12px;
}

.stats-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.stats-meta span {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
}

.timeline-chart {
  display: grid;
  grid-auto-columns: minmax(42px, 1fr);
  grid-auto-flow: column;
  gap: 10px;
  min-height: 260px;
  overflow-x: auto;
  padding-bottom: 8px;
}

.timeline-column {
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 10px;
  min-width: 42px;
}

.timeline-bars {
  display: flex;
  align-items: end;
  justify-content: center;
  gap: 4px;
  height: 220px;
  padding: 10px 6px 0;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.045);
}

.bar {
  width: 8px;
  border-radius: 999px 999px 0 0;
  transition: height 180ms ease;
}

.bar-visits,
.legend-dot.visits {
  background: #64d2ff;
}

.bar-exports,
.legend-dot.exports,
.legend-dot.downloads {
  background: #ffcc66;
}

.bar-activity,
.legend-dot.activity {
  background: #f58cff;
}

.timeline-label {
  color: rgba(247, 251, 255, 0.62);
  font-size: 0.72rem;
  text-align: center;
  white-space: nowrap;
}

.chart-legend,
.breakdown-list div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.chart-legend {
  justify-content: flex-start;
  flex-wrap: wrap;
  color: rgba(247, 251, 255, 0.72);
}

.chart-legend span,
.breakdown-list span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.legend-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 999px;
}

.legend-dot.imgbb {
  background: #82e6a8;
}

.legend-dot.unknown {
  background: #ffcc66;
}

.legend-dot.rejected {
  background: #ff7676;
}

.donut-wrap,
.testimonial-grid {
  display: grid;
  place-items: center;
}

.donut {
  display: grid;
  place-items: center;
  width: 210px;
  height: 210px;
  border-radius: 50%;
  box-shadow: inset 0 0 22px rgba(255, 255, 255, 0.12);
}

.donut.small {
  width: 160px;
  height: 160px;
}

.donut-hole {
  display: grid;
  place-items: center;
  width: 58%;
  height: 58%;
  border-radius: 50%;
  background: #111820;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 1.8rem;
  font-weight: 800;
}

.breakdown-list {
  display: grid;
  gap: 12px;
  width: 100%;
}

.rank-list,
.event-list {
  display: grid;
  gap: 12px;
}

.rank-row {
  display: grid;
  grid-template-columns: minmax(110px, 1fr) minmax(120px, 2fr) auto;
  align-items: center;
  gap: 12px;
}

.rank-meter {
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
}

.rank-meter i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #64d2ff, #82e6a8);
}

.testimonial-grid {
  grid-template-columns: 180px 1fr;
  gap: 24px;
}

.event-row {
  display: grid;
  grid-template-columns: 1.35fr 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.event-row:last-child {
  border-bottom: 0;
}

.event-row span,
.event-row small {
  color: rgba(247, 251, 255, 0.64);
  overflow-wrap: anywhere;
}

.event-list.compact .event-row {
  grid-template-columns: 1fr;
}

.stats-view :deep(.v-card-title),
.stats-view :deep(.v-card-text),
.stats-view :deep(.v-card-subtitle),
.stats-view :deep(.v-btn) {
  letter-spacing: 0;
}

.stats-view :deep(.v-card-subtitle),
.stats-view :deep(.text-medium-emphasis) {
  color: rgba(247, 251, 255, 0.68) !important;
}

@media (max-width: 820px) {
  .testimonial-grid,
  .event-row,
  .rank-row {
    grid-template-columns: 1fr;
  }

  .rank-meter {
    width: 100%;
  }
}
</style>
