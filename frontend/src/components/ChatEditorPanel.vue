<script setup lang="ts">
import { computed } from 'vue';
import { CensorType, type ChatOverlay, type CensoredRegionSummary } from '@/features/magician/types';

const props = defineProps<{
  activeChatOverlay: ChatOverlay | null;
  activeChatOverlayId: string | null;
  activeCensoredRegionSummaries: CensoredRegionSummary[];
  chatOverlays: ChatOverlay[];
  chatlogText: string;
  isRegionSelected: (region: CensoredRegionSummary) => boolean;
  shouldHighlightCensorControls: boolean;
  shouldHighlightParseControls: boolean;
}>();

interface CensoredLinePreviewSegment {
  id: string;
  isCensored: boolean;
  text: string;
  type?: CensorType;
}

interface CensoredLinePreview {
  focusRegion: CensoredRegionSummary;
  id: string;
  label: string;
  segments: CensoredLinePreviewSegment[];
}

const getCensorPreviewClass = (type?: CensorType) => ({
  'chat-censor-preview__segment--blur': type === CensorType.Blur,
  'chat-censor-preview__segment--blackbar': type === CensorType.BlackBar,
  'chat-censor-preview__segment--invisible': type === CensorType.Invisible
});

const censoredLinePreviews = computed<CensoredLinePreview[]>(() => {
  const regionsByLine = new Map<number, CensoredRegionSummary[]>();

  props.activeCensoredRegionSummaries.forEach((region) => {
    const regions = regionsByLine.get(region.lineIndex) ?? [];
    regions.push(region);
    regionsByLine.set(region.lineIndex, regions);
  });

  return Array.from(regionsByLine.entries())
    .sort(([lineA], [lineB]) => lineA - lineB)
    .map(([lineIndex, regions]) => {
      const sortedRegions = [...regions].sort((a, b) => a.startOffset - b.startOffset || a.endOffset - b.endOffset);
      const lineText = sortedRegions[0]?.lineText ?? '';
      const segments: CensoredLinePreviewSegment[] = [];
      let cursor = 0;

      sortedRegions.forEach((region, regionIndex) => {
        const start = Math.max(cursor, Math.min(lineText.length, region.startOffset));
        const end = Math.max(start, Math.min(lineText.length, region.endOffset));

        if (start > cursor) {
          segments.push({
            id: `${lineIndex}-plain-${regionIndex}`,
            isCensored: false,
            text: lineText.slice(cursor, start)
          });
        }

        segments.push({
          id: `${lineIndex}-censored-${regionIndex}`,
          isCensored: true,
          text: lineText.slice(start, end) || ' ',
          type: region.type
        });
        cursor = end;
      });

      if (cursor < lineText.length) {
        segments.push({
          id: `${lineIndex}-plain-end`,
          isCensored: false,
          text: lineText.slice(cursor)
        });
      }

      return {
        focusRegion: sortedRegions[0],
        id: `line-${lineIndex}`,
        label: `Line ${lineIndex + 1}`,
        segments
      };
    });
});

const emit = defineEmits<{
  (event: 'update:chatlogText', value: string): void;
  (event: 'start-new-chat-layer'): void;
  (event: 'select-chat-overlay', overlayId: string): void;
  (event: 'toggle-chat-overlay-visibility', overlayId: string): void;
  (event: 'toggle-chat-overlay-lock', overlayId: string): void;
  (event: 'duplicate-chat-overlay', overlayId: string): void;
  (event: 'remove-chat-overlay', overlayId: string): void;
  (event: 'parse-chatlog'): void;
  (event: 'clear-chatlog'): void;
  (event: 'handle-text-selection'): void;
  (event: 'focus-censored-region', region: CensoredRegionSummary): void;
  (event: 'remove-censored-region', region: CensoredRegionSummary): void;
}>();
</script>

<template>
  <v-sheet class="chatlog-panel-sheet fill-height d-flex flex-column pa-2" style="border-radius: 4px;">
    <div class="d-flex align-center justify-space-between mb-2">
      <div class="text-subtitle-1">Chat Layers</div>
      <v-btn
        size="small"
        variant="tonal"
        color="primary"
        prepend-icon="mdi-plus"
        @click="emit('start-new-chat-layer')"
      >
        New Chat
      </v-btn>
    </div>
    <div class="chat-layer-list mb-3">
      <v-list density="compact" class="pa-0" bg-color="transparent">
        <v-list-item
          v-for="overlay in chatOverlays"
          :key="overlay.id"
          :active="overlay.id === activeChatOverlayId"
          rounded="lg"
          @click="emit('select-chat-overlay', overlay.id)"
        >
          <template #prepend>
            <v-icon :icon="overlay.isHidden ? 'mdi-message-off-outline' : 'mdi-message-text-outline'" size="small"></v-icon>
          </template>
          <v-list-item-title>{{ overlay.name }}</v-list-item-title>
          <v-list-item-subtitle>
            {{ overlay.parsedLines.length }} lines
            <span v-if="overlay.isHidden"> • Hidden</span>
            <span v-if="overlay.isLocked"> • Locked</span>
          </v-list-item-subtitle>
          <template #append>
            <div class="d-flex align-center ga-1">
              <v-btn
                :icon="overlay.isHidden ? 'mdi-eye-outline' : 'mdi-eye-off-outline'"
                size="x-small"
                variant="text"
                @click.stop="emit('toggle-chat-overlay-visibility', overlay.id)"
              ></v-btn>
              <v-btn
                :icon="overlay.isLocked ? 'mdi-lock-open-variant-outline' : 'mdi-lock-outline'"
                size="x-small"
                variant="text"
                @click.stop="emit('toggle-chat-overlay-lock', overlay.id)"
              ></v-btn>
              <v-btn
                icon="mdi-content-copy"
                size="x-small"
                variant="text"
                @click.stop="emit('duplicate-chat-overlay', overlay.id)"
              ></v-btn>
              <v-btn
                icon="mdi-delete-outline"
                size="x-small"
                variant="text"
                color="error"
                @click.stop="emit('remove-chat-overlay', overlay.id)"
              ></v-btn>
            </div>
          </template>
        </v-list-item>
      </v-list>
      <div v-if="chatOverlays.length === 0" class="text-caption text-medium-emphasis pa-2">
        Parse a chatlog to create your first movable chat layer.
      </div>
    </div>
    <div class="d-flex align-center justify-space-between mb-1">
      <div class="text-subtitle-2">
        {{ activeChatOverlay ? 'Edit Selected Chat' : 'New Chat Draft' }}
      </div>
      <v-chip size="small" variant="outlined">
        {{ activeChatOverlay ? 'Selected' : 'Unparsed' }}
      </v-chip>
    </div>
    <div class="chat-editor-body flex-grow-1 d-flex flex-column">
      <v-textarea
        :model-value="chatlogText"
        :placeholder="activeChatOverlay
          ? 'Edit the selected chat layer, then hit Parse or Ctrl+Enter to update it.'
          : 'Paste a new chatlog here, then hit Parse or Ctrl+Enter to add it as a new layer.'"
        :class="['chatlog-textarea mb-1', { 'tutorial-control-highlight': shouldHighlightParseControls || shouldHighlightCensorControls }]"
        density="compact"
        variant="outlined"
        hide-details
        no-resize
        @update:model-value="emit('update:chatlogText', String($event))"
        @keyup.ctrl.enter="emit('parse-chatlog')"
        @mouseup="emit('handle-text-selection')"
        @select="emit('handle-text-selection')"
        @keyup="emit('handle-text-selection')"
      ></v-textarea>
      <div
        v-if="censoredLinePreviews.length > 0"
        class="chat-censor-preview mt-2"
        aria-label="Active censor highlights in the selected chat"
      >
        <div class="chat-censor-preview__header">
          <span>Active censor map</span>
          <v-chip size="x-small" variant="tonal">
            {{ activeCensoredRegionSummaries.length }}
          </v-chip>
        </div>
        <div class="chat-censor-preview__lines">
          <button
            v-for="line in censoredLinePreviews"
            :key="line.id"
            class="chat-censor-preview__line"
            type="button"
            @click="emit('focus-censored-region', line.focusRegion)"
          >
            <span class="chat-censor-preview__line-label">{{ line.label }}</span>
            <span class="chat-censor-preview__text">
              <span
                v-for="segment in line.segments"
                :key="segment.id"
                :class="[
                  'chat-censor-preview__segment',
                  {
                    'chat-censor-preview__segment--censored': segment.isCensored
                  },
                  getCensorPreviewClass(segment.type)
                ]"
              >{{ segment.text }}</span>
            </span>
          </button>
        </div>
      </div>
    </div>
    <v-sheet
      v-if="activeChatOverlay"
      :class="['censored-region-panel mb-2', { 'tutorial-control-highlight': shouldHighlightCensorControls }]"
      border
      rounded="lg"
    >
      <div class="d-flex align-center justify-space-between mb-2">
        <div>
          <div class="text-subtitle-2">Censored Selections</div>
          <div class="text-caption text-medium-emphasis">
            Review what is hidden and remove any item directly from this list.
          </div>
        </div>
        <v-chip size="small" variant="tonal">
          {{ activeCensoredRegionSummaries.length }}
        </v-chip>
      </div>

      <div v-if="activeCensoredRegionSummaries.length === 0" class="text-caption text-medium-emphasis">
        No censoring has been applied to this chat yet. Select text above to add one.
      </div>

      <v-list
        v-else
        density="compact"
        class="censored-region-list pa-0"
        bg-color="transparent"
      >
        <v-list-item
          v-for="region in activeCensoredRegionSummaries"
          :key="region.id"
          class="censored-region-item"
          :active="isRegionSelected(region)"
          rounded="lg"
          @click="emit('focus-censored-region', region)"
        >
          <v-list-item-title class="text-body-2">
            {{ region.preview }}
          </v-list-item-title>
          <v-list-item-subtitle>
            {{ region.label }}
          </v-list-item-subtitle>
          <template #append>
            <div class="d-flex align-center ga-1">
              <v-btn
                icon="mdi-crosshairs"
                size="x-small"
                variant="text"
                @click.stop="emit('focus-censored-region', region)"
              ></v-btn>
              <v-btn
                icon="mdi-close-circle-outline"
                size="x-small"
                variant="text"
                color="error"
                @click.stop="emit('remove-censored-region', region)"
              ></v-btn>
            </div>
          </template>
        </v-list-item>
      </v-list>
    </v-sheet>
    <div class="mt-auto pt-1">
      <v-row no-gutters>
        <v-col class="pe-1">
          <v-btn
            color="grey-darken-3"
            block
            density="compact"
            @click="emit('clear-chatlog')"
          >
            Clear
          </v-btn>
        </v-col>
        <v-col class="ps-1">
          <v-btn
            color="grey-darken-3"
            block
            density="compact"
            :class="{ 'tutorial-control-highlight': shouldHighlightParseControls }"
            @click="emit('parse-chatlog')"
          >
            {{ activeChatOverlay ? 'Update' : 'Parse' }}
          </v-btn>
        </v-col>
      </v-row>
    </div>
  </v-sheet>
</template>

<style scoped>
.chatlog-panel-sheet {
  background: #131213 !important;
  color: #f3f4f6 !important;
  min-height: 0;
  overflow: hidden;
}

.chatlog-panel-sheet :deep(.text-medium-emphasis),
.chatlog-panel-sheet .text-medium-emphasis,
.chatlog-panel-sheet .text-caption,
.chatlog-panel-sheet .text-body-2 {
  color: rgba(243, 244, 246, 0.78) !important;
}

.chatlog-panel-sheet .text-subtitle-2,
.chatlog-panel-sheet .text-subtitle-1 {
  color: #f3f4f6 !important;
}

.chatlog-textarea {
  flex: 1 1 auto;
  min-height: 160px;
  user-select: text !important;
}

.chat-editor-body {
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 2px;
}

:deep(.chatlog-textarea textarea) {
  user-select: text !important;
  cursor: text;
  height: 100% !important;
  max-height: none !important;
}

.chat-censor-preview {
  flex: 0 0 auto;
  padding: 8px;
  border: 1px solid rgba(255, 202, 40, 0.22);
  border-radius: 10px;
  background:
    linear-gradient(135deg, rgba(255, 202, 40, 0.08), rgba(125, 211, 252, 0.04)),
    rgba(255, 255, 255, 0.025);
}

.chat-censor-preview__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 7px;
  color: rgba(243, 244, 246, 0.84);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.chat-censor-preview__lines {
  display: grid;
  gap: 6px;
  max-height: 112px;
  overflow-y: auto;
  padding-right: 2px;
}

.chat-censor-preview__line {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
  width: 100%;
  padding: 7px 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.18);
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.chat-censor-preview__line:hover {
  border-color: rgba(125, 211, 252, 0.32);
  background: rgba(125, 211, 252, 0.08);
}

.chat-censor-preview__line-label {
  color: rgba(243, 244, 246, 0.58);
  font-size: 0.72rem;
  white-space: nowrap;
}

.chat-censor-preview__text {
  min-width: 0;
  color: rgba(243, 244, 246, 0.82);
  font-family: Consolas, 'Liberation Mono', monospace;
  font-size: 0.78rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.chat-censor-preview__segment--censored {
  position: relative;
  display: inline;
  border-radius: 4px;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
  padding: 1px 3px;
  outline: 1px solid rgba(255, 202, 40, 0.38);
  background: rgba(255, 202, 40, 0.18);
}

.chat-censor-preview__segment--blackbar {
  color: transparent;
  background: #050506;
  outline-color: rgba(255, 255, 255, 0.28);
}

.chat-censor-preview__segment--blur {
  color: rgba(243, 244, 246, 0.7);
  filter: blur(1.8px);
  text-shadow: 0 0 6px rgba(243, 244, 246, 0.9);
}

.chat-censor-preview__segment--invisible {
  color: transparent;
  background:
    repeating-linear-gradient(
      135deg,
      rgba(255, 202, 40, 0.2) 0,
      rgba(255, 202, 40, 0.2) 4px,
      rgba(255, 202, 40, 0.05) 4px,
      rgba(255, 202, 40, 0.05) 8px
    );
}

.censored-region-panel {
  padding: 10px;
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.08) !important;
}

.censored-region-panel .text-subtitle-2,
.censored-region-panel .text-body-2 {
  color: #f3f4f6 !important;
}

.censored-region-panel .text-caption,
.censored-region-panel .text-medium-emphasis,
.censored-region-panel :deep(.text-medium-emphasis) {
  color: rgba(243, 244, 246, 0.78) !important;
}

.censored-region-list {
  max-height: 200px;
  overflow-y: auto;
  padding-right: 4px;
}

.censored-region-item {
  margin-bottom: 6px;
}

.tutorial-control-highlight {
  outline: 2px solid #7dd3fc;
  outline-offset: 3px;
  animation: tutorialControlPulse 1.2s ease-in-out infinite;
}

@keyframes tutorialControlPulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(125, 211, 252, 0.42);
  }

  50% {
    box-shadow: 0 0 0 8px rgba(125, 211, 252, 0.14);
  }
}
</style>
