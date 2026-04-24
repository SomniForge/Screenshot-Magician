<script setup lang="ts">
import type { ChatOverlay, CensoredRegionSummary } from '@/features/magician/types';

defineProps<{
  activeChatOverlay: ChatOverlay | null;
  activeChatOverlayId: string | null;
  activeCensoredRegionSummaries: CensoredRegionSummary[];
  chatOverlays: ChatOverlay[];
  chatlogText: string;
  isRegionSelected: (region: CensoredRegionSummary) => boolean;
  shouldHighlightCensorControls: boolean;
  shouldHighlightParseControls: boolean;
}>();

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
    <div class="flex-grow-1 d-flex flex-column" style="overflow-y: hidden;">
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
  height: 100%;
  user-select: text !important;
}

:deep(.chatlog-textarea textarea) {
  user-select: text !important;
  cursor: text;
  height: 100% !important;
  max-height: none !important;
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
