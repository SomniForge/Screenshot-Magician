<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue';
import type { ImageOverlay, ImageOverlayTool } from '@/features/magician/types';

defineProps<{
  activeImageOverlay: ImageOverlay | null;
  activeImageOverlayHasMask: boolean;
  activeImageOverlayId: string | null;
  droppedImageSrc: string | null;
  imageMaskBrushSize: number;
  imageMaskBrushSoftness: number;
  imageMaskBrushStrength: number;
  imageOverlayTool: ImageOverlayTool;
  imageOverlays: ImageOverlay[];
  minimapSize: { width: number; height: number };
  minimapViewport: { left: number; top: number; width: number; height: number };
  projectStatusMessage: string;
  shouldHighlightFinishControls: boolean;
  shouldHighlightPolishControls: boolean;
  showImageMinimap: boolean;
  utilityPanelScrollRefSetter?: (element: Element | ComponentPublicInstance | null) => void;
  minimapRefSetter?: (element: Element | ComponentPublicInstance | null) => void;
  currentProjectName: string;
}>();

const emit = defineEmits<{
  (event: 'trigger-image-overlay-input'): void;
  (event: 'reset-image-view'): void;
  (event: 'recenter-image-from-minimap', mouseEvent: MouseEvent): void;
  (event: 'handle-image-layer-rail-wheel', wheelEvent: WheelEvent): void;
  (event: 'select-image-overlay', overlayId: string | null): void;
  (event: 'move-image-overlay', payload: { overlayId: string; direction: 'forward' | 'backward' }): void;
  (event: 'toggle-image-overlay-effects', overlayId: string): void;
  (event: 'toggle-image-overlay-visibility', overlayId: string): void;
  (event: 'toggle-image-overlay-lock', overlayId: string): void;
  (event: 'duplicate-image-overlay', overlayId: string): void;
  (event: 'remove-image-overlay', overlayId: string): void;
  (event: 'update:active-image-overlay-opacity', value: number): void;
  (event: 'reset-active-image-overlay-view'): void;
  (event: 'update:image-overlay-tool', value: ImageOverlayTool): void;
  (event: 'update:image-mask-brush-size', value: number): void;
  (event: 'update:image-mask-brush-softness', value: number): void;
  (event: 'update:image-mask-brush-strength', value: number): void;
  (event: 'reset-active-image-overlay-mask'): void;
}>();
</script>

<template>
  <v-sheet class="utility-panel-sheet fill-height d-flex flex-column pa-2" style="border-radius: 4px;">
    <div :ref="utilityPanelScrollRefSetter" class="utility-panel-scroll">
      <div :class="['project-status mb-3', { 'tutorial-control-highlight': shouldHighlightFinishControls }]">
        <div class="text-subtitle-2">Project</div>
        <div class="text-body-2">
          {{ currentProjectName || 'Unsaved session' }}
        </div>
        <div
          class="text-caption text-medium-emphasis project-status-message"
          :title="projectStatusMessage"
        >
          {{ projectStatusMessage }}
        </div>
      </div>
      <v-sheet
        v-if="showImageMinimap && droppedImageSrc"
        class="image-minimap mb-3"
        border
        rounded="lg"
      >
        <div class="image-minimap-header">
          <div>
            <div class="text-subtitle-2">Navigator</div>
            <div class="text-caption text-medium-emphasis">
              Click anywhere in the preview to recenter the screenshot.
            </div>
          </div>
          <v-btn
            size="x-small"
            variant="text"
            icon="mdi-fit-to-screen-outline"
            @click="emit('reset-image-view')"
          ></v-btn>
        </div>
        <div
          :ref="minimapRefSetter"
          class="image-minimap-frame"
          :style="{ width: `${minimapSize.width}px`, height: `${minimapSize.height}px` }"
          @click="emit('recenter-image-from-minimap', $event)"
        >
          <img
            :src="droppedImageSrc"
            alt="Navigator preview"
            class="image-minimap-preview"
          />
          <div
            class="image-minimap-viewport"
            :style="{
              left: `${minimapViewport.left}px`,
              top: `${minimapViewport.top}px`,
              width: `${minimapViewport.width}px`,
              height: `${minimapViewport.height}px`
            }"
          ></div>
        </div>
      </v-sheet>
      <div class="utility-panel-main">
        <div class="utility-panel-section-header d-flex align-center justify-space-between mb-2">
          <div class="text-subtitle-1">Image Layers</div>
          <v-btn
            size="small"
            variant="tonal"
            color="primary"
            prepend-icon="mdi-image-multiple-outline"
            :class="{ 'tutorial-control-highlight': shouldHighlightPolishControls }"
            @click="emit('trigger-image-overlay-input')"
          >
            Add Image
          </v-btn>
        </div>
        <div
          class="image-layer-scroll-region mb-3"
          @wheel="emit('handle-image-layer-rail-wheel', $event)"
        >
          <div class="chat-layer-list">
            <v-list density="compact" class="pa-0" bg-color="transparent">
              <v-list-item
                :active="activeImageOverlayId === null"
                rounded="lg"
                @click="emit('select-image-overlay', null)"
              >
                <template #prepend>
                  <v-icon icon="mdi-image-outline" size="small"></v-icon>
                </template>
                <v-list-item-title>Base Screenshot</v-list-item-title>
                <v-list-item-subtitle>
                  {{ droppedImageSrc ? 'Primary canvas image' : 'No screenshot loaded yet' }}
                </v-list-item-subtitle>
                <template #append>
                  <v-btn
                    icon="mdi-fit-to-screen-outline"
                    size="x-small"
                    variant="text"
                    :disabled="!droppedImageSrc"
                    @click.stop="emit('reset-image-view')"
                  ></v-btn>
                </template>
              </v-list-item>
              <v-list-item
                v-for="overlay in imageOverlays"
                :key="overlay.id"
                :active="overlay.id === activeImageOverlayId"
                class="image-layer-list-item"
                rounded="lg"
                @click="emit('select-image-overlay', overlay.id)"
              >
                <template #prepend>
                  <div class="image-layer-thumbnail-wrap">
                    <img
                      :src="overlay.src"
                      :alt="overlay.name"
                      class="image-layer-thumbnail"
                    />
                    <div v-if="overlay.isHidden" class="image-layer-thumbnail-badge">
                      <v-icon icon="mdi-eye-off-outline" size="x-small"></v-icon>
                    </div>
                  </div>
                </template>
                <div class="image-layer-item-main">
                  <div class="image-layer-item-name" :title="overlay.name">
                    {{ overlay.name }}
                  </div>
                  <div class="image-layer-item-meta">
                    Layer {{ imageOverlays.findIndex((item) => item.id === overlay.id) + 1 }} of {{ imageOverlays.length }} · {{ Math.round(overlay.opacity * 100) }}% opacity
                    <span>{{ overlay.acceptsEffects ? ' • Effects On' : ' • Effects Off' }}</span>
                    <span v-if="overlay.maskDataUrl"> • Masked</span>
                    <span v-if="overlay.isHidden"> • Hidden</span>
                    <span v-if="overlay.isLocked"> • Locked</span>
                  </div>
                  <div class="image-layer-item-actions">
                    <v-tooltip text="Move this layer higher in the stack" location="top">
                      <template #activator="{ props }">
                        <v-btn
                          v-bind="props"
                          icon="mdi-arrow-down-bold-outline"
                          size="x-small"
                          variant="text"
                          :disabled="imageOverlays.findIndex((item) => item.id === overlay.id) === imageOverlays.length - 1"
                          @click.stop="emit('move-image-overlay', { overlayId: overlay.id, direction: 'forward' })"
                        ></v-btn>
                      </template>
                    </v-tooltip>
                    <v-tooltip text="Move this layer lower in the stack" location="top">
                      <template #activator="{ props }">
                        <v-btn
                          v-bind="props"
                          icon="mdi-arrow-up-bold-outline"
                          size="x-small"
                          variant="text"
                          :disabled="imageOverlays.findIndex((item) => item.id === overlay.id) === 0"
                          @click.stop="emit('move-image-overlay', { overlayId: overlay.id, direction: 'backward' })"
                        ></v-btn>
                      </template>
                    </v-tooltip>
                    <v-tooltip :text="overlay.acceptsEffects ? 'Effects are enabled for this layer' : 'Effects are disabled for this layer'" location="top">
                      <template #activator="{ props }">
                        <v-btn
                          v-bind="props"
                          :icon="overlay.acceptsEffects ? 'mdi-image-filter-center-focus' : 'mdi-image-filter-center-focus-weak'"
                          size="x-small"
                          variant="text"
                          :color="overlay.acceptsEffects ? 'primary' : undefined"
                          @click.stop="emit('toggle-image-overlay-effects', overlay.id)"
                        ></v-btn>
                      </template>
                    </v-tooltip>
                    <v-tooltip :text="overlay.isHidden ? 'Show this layer' : 'Hide this layer'" location="top">
                      <template #activator="{ props }">
                        <v-btn
                          v-bind="props"
                          :icon="overlay.isHidden ? 'mdi-eye-outline' : 'mdi-eye-off-outline'"
                          size="x-small"
                          variant="text"
                          @click.stop="emit('toggle-image-overlay-visibility', overlay.id)"
                        ></v-btn>
                      </template>
                    </v-tooltip>
                    <v-tooltip :text="overlay.isLocked ? 'Unlock this layer for editing' : 'Lock this layer to prevent editing'" location="top">
                      <template #activator="{ props }">
                        <v-btn
                          v-bind="props"
                          :icon="overlay.isLocked ? 'mdi-lock-open-variant-outline' : 'mdi-lock-outline'"
                          size="x-small"
                          variant="text"
                          @click.stop="emit('toggle-image-overlay-lock', overlay.id)"
                        ></v-btn>
                      </template>
                    </v-tooltip>
                    <v-tooltip text="Duplicate this layer" location="top">
                      <template #activator="{ props }">
                        <v-btn
                          v-bind="props"
                          icon="mdi-content-copy"
                          size="x-small"
                          variant="text"
                          @click.stop="emit('duplicate-image-overlay', overlay.id)"
                        ></v-btn>
                      </template>
                    </v-tooltip>
                    <v-tooltip text="Delete this layer" location="top">
                      <template #activator="{ props }">
                        <v-btn
                          v-bind="props"
                          icon="mdi-delete-outline"
                          size="x-small"
                          variant="text"
                          color="error"
                          @click.stop="emit('remove-image-overlay', overlay.id)"
                        ></v-btn>
                      </template>
                    </v-tooltip>
                  </div>
                </div>
              </v-list-item>
            </v-list>
            <div v-if="imageOverlays.length === 0" class="text-caption text-medium-emphasis pa-2">
              Add PNG, JPG, WEBP, or any browser-supported image to stack props, decals, or cutouts over the screenshot.
            </div>
          </div>
        </div>
      </div>
      <v-sheet
        v-if="activeImageOverlay"
        class="censored-region-panel image-layer-detail-panel"
        border
        rounded="lg"
      >
        <div class="image-layer-detail-header mb-2">
          <div class="image-layer-detail-header-copy">
            <div class="text-subtitle-2">Selected Image Layer</div>
            <div class="text-caption text-medium-emphasis">
              Drag, resize with the mouse wheel, or use arrows and +/- while Image Drag is enabled.
            </div>
          </div>
          <div class="selected-image-layer-name" :title="activeImageOverlay.name">
            {{ activeImageOverlay.name }}
          </div>
        </div>
        <div class="text-caption text-medium-emphasis mb-1">Opacity</div>
        <v-slider
          :model-value="activeImageOverlay.opacity"
          min="0.05"
          max="1"
          step="0.01"
          hide-details
          color="primary"
          @update:model-value="emit('update:active-image-overlay-opacity', Number($event))"
        ></v-slider>
        <div class="d-flex align-center justify-space-between text-caption mb-2">
          <span>{{ Math.round(activeImageOverlay.opacity * 100) }}%</span>
          <v-btn
            size="x-small"
            variant="text"
            prepend-icon="mdi-fit-to-screen-outline"
            @click="emit('reset-active-image-overlay-view')"
          >
            Reset Layer
          </v-btn>
        </div>
        <div class="text-caption text-medium-emphasis image-mask-mode-copy mb-2">
          Move keeps drag and zoom active. Erase and Restore paint a non-destructive layer mask.
        </div>
        <v-btn-toggle
          :model-value="imageOverlayTool"
          color="primary"
          density="compact"
          divided
          mandatory
          class="image-mask-tool-toggle mb-3"
          @update:model-value="emit('update:image-overlay-tool', (($event as ImageOverlayTool) || 'move'))"
        >
          <v-btn value="move" size="small" prepend-icon="mdi-cursor-move" class="image-mask-tool-button">
            Move
          </v-btn>
          <v-btn value="erase" size="small" prepend-icon="mdi-eraser-variant" class="image-mask-tool-button">
            Erase
          </v-btn>
          <v-btn value="restore" size="small" prepend-icon="mdi-brush" class="image-mask-tool-button">
            Restore
          </v-btn>
        </v-btn-toggle>
        <div class="text-caption text-medium-emphasis mb-1">Brush Size</div>
        <v-slider
          :model-value="imageMaskBrushSize"
          min="8"
          max="640"
          step="1"
          hide-details
          color="primary"
          @update:model-value="emit('update:image-mask-brush-size', Number($event))"
        ></v-slider>
        <div class="image-mask-value-row text-caption mb-1">
          <span>{{ imageMaskBrushSize }} px</span>
        </div>
        <div class="text-caption text-medium-emphasis image-mask-helper-copy mb-2">
          Mouse wheel over the selected layer adjusts brush size.
        </div>
        <div class="text-caption text-medium-emphasis mb-1">Softness</div>
        <v-slider
          :model-value="imageMaskBrushSoftness"
          min="0"
          max="1"
          step="0.01"
          hide-details
          color="primary"
          @update:model-value="emit('update:image-mask-brush-softness', Number($event))"
        ></v-slider>
        <div class="image-mask-value-row text-caption mb-1">
          <span>{{ Math.round(imageMaskBrushSoftness * 100) }}%</span>
        </div>
        <div class="text-caption text-medium-emphasis image-mask-helper-copy mb-2">
          Softer edges create a smoother blend into the layer below.
        </div>
        <div class="text-caption text-medium-emphasis mb-1">Strength</div>
        <v-slider
          :model-value="imageMaskBrushStrength"
          min="0.05"
          max="1"
          step="0.01"
          hide-details
          color="primary"
          @update:model-value="emit('update:image-mask-brush-strength', Number($event))"
        ></v-slider>
        <div class="image-mask-action-row text-caption">
          <span>{{ Math.round(imageMaskBrushStrength * 100) }}%</span>
          <v-btn
            size="x-small"
            variant="text"
            prepend-icon="mdi-layers-remove-outline"
            :disabled="!activeImageOverlayHasMask"
            @click="emit('reset-active-image-overlay-mask')"
          >
            Clear Mask
          </v-btn>
        </div>
      </v-sheet>
    </div>
  </v-sheet>
</template>

<style scoped>
.utility-panel-sheet {
  background: #131213 !important;
  color: #f3f4f6 !important;
  min-height: 0;
  overflow: hidden;
  min-width: 0;
}

.utility-panel-sheet :deep(.text-medium-emphasis),
.utility-panel-sheet .text-medium-emphasis,
.utility-panel-sheet .text-caption,
.utility-panel-sheet .text-body-2 {
  color: rgba(243, 244, 246, 0.78) !important;
}

.utility-panel-sheet .text-subtitle-2,
.utility-panel-sheet .text-subtitle-1 {
  color: #f3f4f6 !important;
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

.image-mask-tool-toggle {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
}

.image-mask-tool-button {
  min-width: 0;
  letter-spacing: 0.02em;
}

.image-mask-tool-toggle :deep(.v-btn) {
  min-width: 0;
  padding-inline: 10px;
}

.image-mask-tool-toggle :deep(.v-btn__content) {
  justify-content: center;
  gap: 6px;
  width: 100%;
}

.image-mask-mode-copy {
  line-height: 1.45;
}

.image-mask-value-row,
.image-mask-action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.image-mask-value-row {
  min-height: 20px;
}

.image-mask-helper-copy {
  line-height: 1.35;
}

.image-layer-thumbnail-wrap {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.image-layer-thumbnail {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
  background:
    linear-gradient(45deg, rgba(255, 255, 255, 0.04) 25%, transparent 25%, transparent 75%, rgba(255, 255, 255, 0.04) 75%),
    linear-gradient(45deg, rgba(255, 255, 255, 0.04) 25%, transparent 25%, transparent 75%, rgba(255, 255, 255, 0.04) 75%);
  background-position: 0 0, 6px 6px;
  background-size: 12px 12px;
}

.image-layer-thumbnail-badge {
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(19, 18, 19, 0.9);
  color: #f3f4f6;
}

.image-layer-list-item {
  align-items: flex-start;
}

.image-layer-list-item :deep(.v-list-item__prepend) {
  align-self: flex-start;
  margin-top: 2px;
}

.image-layer-list-item :deep(.v-list-item__content) {
  min-width: 0;
}

.image-layer-item-main {
  min-width: 0;
  width: 100%;
}

.image-layer-item-name {
  font-size: 0.98rem;
  line-height: 1.25;
  color: #f3f4f6;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.image-layer-item-meta {
  margin-top: 2px;
  font-size: 0.76rem;
  line-height: 1.35;
  color: rgba(243, 244, 246, 0.72);
  white-space: normal;
  overflow-wrap: anywhere;
}

.image-layer-item-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 2px;
  margin-top: 6px;
  margin-right: -6px;
}

.utility-panel-main {
  display: block;
  min-height: 0;
}

.utility-panel-section-header {
  flex-shrink: 0;
}

.utility-panel-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
  margin-right: -4px;
  overscroll-behavior: contain;
}

.image-layer-scroll-region {
  min-height: 0;
  max-height: 220px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
  margin-right: -4px;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.image-layer-scroll-region::after {
  content: '';
  display: block;
  height: 4px;
}

.image-layer-detail-panel {
  margin-top: 12px;
}

.image-layer-detail-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.image-layer-detail-header-copy {
  min-width: 0;
  flex: 1 1 auto;
}

.selected-image-layer-name {
  max-width: 100%;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(var(--v-theme-primary), 0.14);
  color: #f3f4f6;
  font-size: 0.78rem;
  line-height: 1.2;
  text-align: left;
  white-space: normal;
  overflow-wrap: anywhere;
  align-self: flex-start;
}

.image-minimap {
  padding: 10px;
  background: rgba(255, 255, 255, 0.03);
}

.image-minimap-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.image-minimap-frame {
  position: relative;
  overflow: hidden;
  border-radius: 10px;
  cursor: crosshair;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  margin: 0 auto;
}

.image-minimap-preview {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
  opacity: 0.92;
}

.image-minimap-viewport {
  position: absolute;
  box-sizing: border-box;
  border: 2px solid rgba(66, 165, 245, 0.95);
  background: rgba(66, 165, 245, 0.16);
  box-shadow: 0 0 0 999px rgba(7, 10, 17, 0.18);
  border-radius: 6px;
  pointer-events: none;
}

.project-status {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.02);
}

.project-status-message {
  display: block;
  min-height: 1.35em;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
