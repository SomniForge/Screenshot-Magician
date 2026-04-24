<script setup lang="ts">
import type { ShortcutGroup } from '@/features/magician/types';

defineProps<{
  modelValue: boolean;
  shortcutGroups: ShortcutGroup[];
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
}>();

const closeDialog = () => emit('update:modelValue', false);
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="760" @update:model-value="emit('update:modelValue', Boolean($event))">
    <v-card class="shortcuts-card">
      <v-card-title class="d-flex align-center justify-space-between">
        <div>
          <div class="text-h6">Keyboard Shortcuts</div>
          <div class="text-body-2 text-medium-emphasis">
            Faster editing, right where you already work.
          </div>
        </div>
        <v-btn icon="mdi-close" variant="text" @click="closeDialog"></v-btn>
      </v-card-title>
      <v-card-text>
        <div class="shortcuts-grid">
          <v-sheet
            v-for="group in shortcutGroups"
            :key="group.title"
            class="shortcuts-group"
            border
            rounded="xl"
          >
            <div class="text-subtitle-1 mb-3">{{ group.title }}</div>
            <div
              v-for="shortcut in group.items"
              :key="`${group.title}-${shortcut.label}`"
              class="shortcut-row"
            >
              <div class="text-body-2">{{ shortcut.label }}</div>
              <div class="shortcut-keys">
                <template v-for="(keyPart, index) in shortcut.keys" :key="`${shortcut.label}-${keyPart}-${index}`">
                  <span class="shortcut-key">{{ keyPart }}</span>
                  <span v-if="index < shortcut.keys.length - 1" class="shortcut-plus">+</span>
                </template>
              </div>
            </div>
          </v-sheet>
        </div>
      </v-card-text>
      <v-card-actions>
        <div class="text-caption text-medium-emphasis px-4">
          Arrow nudging and +/- zoom affect whichever drag mode is currently active.
        </div>
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="closeDialog">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.shortcuts-card {
  overflow: hidden;
}

.shortcuts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.shortcuts-group {
  padding: 18px;
  background: rgba(255, 255, 255, 0.03);
}

.shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.shortcut-row:first-of-type {
  border-top: 0;
  padding-top: 0;
}

.shortcut-keys {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.shortcut-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  min-height: 28px;
  padding: 4px 10px;
  border-radius: 10px;
  border: 1px solid rgba(var(--v-theme-primary), 0.28);
  background: rgba(var(--v-theme-primary), 0.1);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.shortcut-plus {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.55);
}
</style>
