import type { Ref } from 'vue';
import Cookies from 'js-cookie';
import { DEFAULT_CHAT_LINE_WIDTH, EDITOR_STATE_STORAGE_KEY } from './constants';
import { loadEditorSessionRecord, saveEditorSessionRecord } from './storage';
import type { ChatOverlay, ChatTransform, EditorStateSnapshot, PersistedEditorSession } from './types';

interface UseMagicianSessionPersistenceOptions {
  applyEditorSnapshot: (snapshot: Partial<EditorStateSnapshot>) => void;
  createDefaultChatTransform: () => ChatTransform;
  createOverlayId: () => string;
  currentProjectId: Ref<string | null>;
  currentProjectName: Ref<string>;
  getChatOverlayName: (rawText: string, overlayIndex: number) => string;
  parseChatText: (rawText: string) => ChatOverlay['parsedLines'];
  reportError: (message: string, error?: unknown) => void;
  toSerializableSnapshot: (snapshot: EditorStateSnapshot) => EditorStateSnapshot;
}

export const useMagicianSessionPersistence = (options: UseMagicianSessionPersistenceOptions) => {
  const {
    applyEditorSnapshot,
    createDefaultChatTransform,
    createOverlayId,
    currentProjectId,
    currentProjectName,
    getChatOverlayName,
    parseChatText,
    reportError,
    toSerializableSnapshot
  } = options;

  const saveEditorState = async (snapshot: EditorStateSnapshot) => {
    if (typeof window === 'undefined') return;

    const state: PersistedEditorSession = {
      snapshot: toSerializableSnapshot(snapshot),
      currentProjectId: currentProjectId.value,
      currentProjectName: currentProjectName.value
    };

    try {
      await saveEditorSessionRecord(state);
      window.localStorage.removeItem(EDITOR_STATE_STORAGE_KEY);
      Cookies.remove('editorState');
    } catch (error) {
      reportError('Session recovery could not be updated in this browser.', error);
    }
  };

  const applyPersistedEditorState = async (
    parsedState: Partial<PersistedEditorSession & EditorStateSnapshot>,
    persistSnapshot: (snapshot?: EditorStateSnapshot) => Promise<void>
  ) => {
    const state = parsedState.snapshot ?? parsedState;

    if (!Array.isArray(state.chatOverlays) && state.chatlogText) {
      const migratedOverlay: ChatOverlay = {
        id: createOverlayId(),
        name: getChatOverlayName(state.chatlogText, 0),
        rawText: state.chatlogText,
        parsedLines: parseChatText(state.chatlogText),
        transform: {
          ...createDefaultChatTransform(),
          ...(state.chatTransform || {})
        },
        censoredRegions: Array.isArray(state.censoredRegions) ? state.censoredRegions : [],
        manualColorRegions: [],
        lineWidth: state.chatLineWidth || DEFAULT_CHAT_LINE_WIDTH,
        isHidden: false,
        isLocked: false
      };

      applyEditorSnapshot({
        ...state,
        chatOverlays: [migratedOverlay],
        activeChatOverlayId: migratedOverlay.id
      });
      currentProjectId.value = typeof parsedState.currentProjectId === 'string' ? parsedState.currentProjectId : null;
      currentProjectName.value = typeof parsedState.currentProjectName === 'string' ? parsedState.currentProjectName : '';
      await persistSnapshot();
      return;
    }

    applyEditorSnapshot(state);
    currentProjectId.value = typeof parsedState.currentProjectId === 'string' ? parsedState.currentProjectId : null;
    currentProjectName.value = typeof parsedState.currentProjectName === 'string' ? parsedState.currentProjectName : '';
    await persistSnapshot();
  };

  const loadEditorState = async (persistSnapshot: (snapshot?: EditorStateSnapshot) => Promise<void>) => {
    if (typeof window === 'undefined') return;

    try {
      const savedRecord = await loadEditorSessionRecord();
      if (savedRecord?.state) {
        await applyPersistedEditorState(savedRecord.state, persistSnapshot);
        return;
      }
    } catch (error) {
      reportError('We could not restore your previous session from this browser.', error);
    }

    const legacySavedState = window.localStorage.getItem(EDITOR_STATE_STORAGE_KEY) || Cookies.get('editorState');
    if (!legacySavedState) return;

    try {
      const parsedState = JSON.parse(legacySavedState) as Partial<PersistedEditorSession & EditorStateSnapshot>;
      await applyPersistedEditorState(parsedState, persistSnapshot);
      window.localStorage.removeItem(EDITOR_STATE_STORAGE_KEY);
      Cookies.remove('editorState');
    } catch (error) {
      reportError('A saved editor session was found, but it could not be restored.', error);
    }
  };

  return {
    loadEditorState,
    saveEditorState
  };
};
