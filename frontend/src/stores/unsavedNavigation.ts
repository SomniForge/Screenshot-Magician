import { defineStore } from 'pinia';

const UNSAVED_NAVIGATION_MESSAGE = 'You have unsaved work that will be lost if you leave this page. Are you sure you want to continue?';

export const useUnsavedNavigationStore = defineStore('unsavedNavigation', {
  state: () => ({
    isEditorMounted: false,
    hasUnsavedChanges: false
  }),
  getters: {
    shouldWarnBeforeLeaving: (state) => state.isEditorMounted && state.hasUnsavedChanges
  },
  actions: {
    setEditorMounted(isMounted: boolean) {
      this.isEditorMounted = isMounted;
    },
    setHasUnsavedChanges(hasUnsavedChanges: boolean) {
      this.hasUnsavedChanges = hasUnsavedChanges;
    },
    reset() {
      this.isEditorMounted = false;
      this.hasUnsavedChanges = false;
    },
    confirmNavigation() {
      if (typeof window === 'undefined' || !this.shouldWarnBeforeLeaving) {
        return true;
      }

      return window.confirm(UNSAVED_NAVIGATION_MESSAGE);
    },
    getBeforeUnloadMessage() {
      return UNSAVED_NAVIGATION_MESSAGE;
    }
  }
});
