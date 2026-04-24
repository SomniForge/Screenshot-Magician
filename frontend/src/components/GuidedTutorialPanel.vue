<script setup lang="ts">
import type { TutorialStep } from '@/features/magician/types';

defineProps<{
  currentStep: TutorialStep;
  stepIndex: number;
  steps: TutorialStep[];
  isCurrentStepComplete: boolean;
  dontShowTutorialAgain: boolean;
  shouldHighlightActionButton: boolean;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'back'): void;
  (event: 'next'): void;
  (event: 'run-action'): void;
  (event: 'update:step-index', value: number): void;
  (event: 'update:dont-show-tutorial-again', value: boolean): void;
}>();
</script>

<template>
  <v-slide-y-reverse-transition>
    <div class="guided-tutorial-panel">
      <div class="guided-tutorial-header">
        <div class="tutorial-icon-wrap">
          <v-icon :icon="currentStep.icon" size="28"></v-icon>
        </div>
        <div class="guided-tutorial-title">
          <div class="text-subtitle-1">{{ currentStep.title }}</div>
          <div class="text-caption text-medium-emphasis">
            Step {{ stepIndex + 1 }} / {{ steps.length }}
          </div>
        </div>
        <v-chip
          size="small"
          :color="isCurrentStepComplete ? 'success' : 'primary'"
          variant="tonal"
        >
          {{ isCurrentStepComplete ? 'Tried' : 'Try it' }}
        </v-chip>
      </div>

      <div class="text-body-2 guided-tutorial-copy">
        {{ currentStep.description }}
      </div>

      <v-sheet class="guided-tutorial-task" border rounded="lg">
        <div class="text-caption text-medium-emphasis mb-1">Your move</div>
        <div class="text-body-2">{{ currentStep.task }}</div>
        <div class="text-caption text-medium-emphasis mt-2">
          {{ currentStep.completionHint }}
        </div>
      </v-sheet>

      <div class="tutorial-progress">
        <button
          v-for="(step, index) in steps"
          :key="`${step.title}-dot`"
          type="button"
          :class="['tutorial-progress-dot', { 'is-active': stepIndex === index }]"
          :aria-label="`Go to tutorial step ${index + 1}`"
          @click="emit('update:step-index', index)"
        ></button>
      </div>

      <div class="guided-tutorial-actions">
        <v-checkbox
          :model-value="dontShowTutorialAgain"
          label="Don't show this again"
          density="compact"
          hide-details
          @update:model-value="emit('update:dont-show-tutorial-again', Boolean($event))"
        ></v-checkbox>
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="emit('close')">
          Skip
        </v-btn>
        <v-btn
          variant="text"
          :disabled="stepIndex === 0"
          @click="emit('back')"
        >
          Back
        </v-btn>
        <v-btn
          v-if="currentStep.actionLabel"
          variant="tonal"
          color="primary"
          :class="{ 'tutorial-control-highlight': shouldHighlightActionButton }"
          @click="emit('run-action')"
        >
          {{ currentStep.actionLabel }}
        </v-btn>
        <v-btn color="primary" @click="emit('next')">
          {{ stepIndex === steps.length - 1 ? 'Finish' : 'Next' }}
        </v-btn>
      </div>
    </div>
  </v-slide-y-reverse-transition>
</template>

<style scoped>
.guided-tutorial-panel {
  position: fixed;
  left: 50%;
  bottom: 20px;
  z-index: 2200;
  width: min(720px, calc(100vw - 32px));
  max-height: min(560px, calc(100vh - 40px));
  overflow-y: auto;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid rgba(125, 211, 252, 0.42);
  background: rgba(18, 24, 38, 0.96);
  color: #f8fafc;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.42);
  transform: translateX(-50%);
}

.guided-tutorial-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.guided-tutorial-title {
  min-width: 0;
  flex: 1;
}

.guided-tutorial-copy {
  margin-top: 12px;
  color: rgba(248, 250, 252, 0.86);
}

.guided-tutorial-task {
  margin-top: 14px;
  padding: 12px;
  background: rgba(248, 250, 252, 0.08) !important;
  color: #f8fafc !important;
  border-color: rgba(148, 163, 184, 0.34) !important;
}

.guided-tutorial-panel .text-medium-emphasis,
.guided-tutorial-panel :deep(.text-medium-emphasis) {
  color: rgba(226, 232, 240, 0.76) !important;
}

.guided-tutorial-task .text-body-2 {
  color: #f8fafc !important;
}

.guided-tutorial-task .text-caption {
  color: rgba(226, 232, 240, 0.72) !important;
}

.guided-tutorial-actions :deep(.v-label) {
  color: #f8fafc !important;
}

.guided-tutorial-actions :deep(.v-btn--disabled) {
  color: rgba(226, 232, 240, 0.42) !important;
}

.tutorial-icon-wrap {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(125, 211, 252, 0.13);
  color: #7dd3fc;
}

.tutorial-progress {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
}

.tutorial-progress-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  border: 0;
  background: rgba(255, 255, 255, 0.18);
  cursor: pointer;
  transition: transform 0.2s ease, background-color 0.2s ease;
}

.tutorial-progress-dot.is-active {
  background: #7dd3fc;
  transform: scale(1.2);
}

.guided-tutorial-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 14px;
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
