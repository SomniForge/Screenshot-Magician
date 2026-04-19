<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { requestAdSenseSlot } from '@/composables/useAdSense';

const props = defineProps<{
  title?: string;
  description?: string;
  compact?: boolean;
  adSlot?: string;
}>();

const adsenseElement = ref<HTMLElement | null>(null);
const adError = ref<string | null>(null);

const adsenseClientId = (import.meta.env.VITE_ADSENSE_CLIENT_ID || '').trim();
const resolvedAdSlot = computed(() => (props.adSlot || import.meta.env.VITE_ADSENSE_HOME_RAIL_SLOT || '').trim());
const isConfigured = computed(() => Boolean(adsenseClientId && resolvedAdSlot.value));
const isDevelopment = import.meta.env.DEV;

const initializeAd = async () => {
  if (!isConfigured.value || !adsenseElement.value) {
    return;
  }

  try {
    await requestAdSenseSlot(adsenseElement.value, adsenseClientId);
    adError.value = null;
  } catch (error) {
    console.error('AdSense initialization failed:', error);
    adError.value = 'Unable to load ad right now.';
  }
};

onMounted(() => {
  void initializeAd();
});

watch(resolvedAdSlot, () => {
  if (adsenseElement.value) {
    adsenseElement.value.dataset.adRequestStatus = '';
  }
  void initializeAd();
});
</script>

<template>
  <v-sheet :class="['ad-slot', { 'ad-slot-compact': compact }]" class="pa-6" rounded="xl" border>
    <div class="d-flex align-center justify-space-between flex-wrap ga-3" :class="{ 'mb-3': !compact }">
      <div class="ad-slot-copy">
        <div class="text-overline">Reserved Ad Space</div>
        <div :class="compact ? 'text-subtitle-1' : 'text-h6'">{{ title || 'Sponsor Slot' }}</div>
      </div>
      <v-chip size="small" variant="outlined">Home Page Only</v-chip>
    </div>

    <div class="text-body-2 text-medium-emphasis" :class="{ 'mb-4': !compact, 'mb-3 mt-2': compact }">
      {{ description || 'Ads here will help offset hosting costs. You can disable them for free anytime in Settings.' }}
    </div>

    <div
      v-if="!isConfigured || adError"
      :class="['ad-slot-placeholder', { 'ad-slot-placeholder-compact': compact }]"
    >
      {{ adError || (isDevelopment ? 'Set VITE_ADSENSE_CLIENT_ID and VITE_ADSENSE_HOME_RAIL_SLOT to enable this ad slot.' : 'Ad space reserved') }}
    </div>

    <div
      v-else
      :class="['ad-slot-placeholder', 'ad-slot-live', { 'ad-slot-placeholder-compact': compact }]"
    >
      <ins
        ref="adsenseElement"
        class="adsbygoogle"
        style="display:block"
        data-full-width-responsive="true"
        data-ad-format="auto"
        :data-ad-client="adsenseClientId"
        :data-ad-slot="resolvedAdSlot"
      ></ins>
    </div>
  </v-sheet>
</template>

<style scoped>
.ad-slot {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.08) !important;
}

.ad-slot-copy {
  min-width: 0;
}

.ad-slot-compact {
  padding-top: 18px !important;
  padding-bottom: 18px !important;
}

.ad-slot-placeholder {
  min-height: 120px;
  border-radius: 16px;
  border: 1px dashed rgba(255, 255, 255, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.55);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.05));
}

.ad-slot-placeholder-compact {
  min-height: 72px;
}

.ad-slot-live {
  display: block;
  padding: 10px;
}

.ad-slot-live ins {
  min-height: 72px;
}
</style>
