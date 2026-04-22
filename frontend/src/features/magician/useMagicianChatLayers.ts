import { computed, type ComputedRef, type Ref } from 'vue';
import type { AnalyticsParams } from '@/composables/useAnalytics';
import { colorMappings } from './chatColors';
import { DEFAULT_CHAT_LINE_WIDTH } from './constants';
import { CensorType, type CensoredRegion, type CensoredRegionSummary, type ChatOverlay } from './types';

interface SelectedTextState {
  lineIndex: number;
  startOffset: number;
  endOffset: number;
  text: string;
}

interface UseMagicianChatLayersOptions {
  activeChatOverlay: ComputedRef<ChatOverlay | null>;
  activeChatOverlayId: Ref<string | null>;
  characterName: Ref<string>;
  chatLineWidth: Ref<number>;
  chatOverlays: Ref<ChatOverlay[]>;
  chatlogText: Ref<string>;
  createDefaultChatTransform: () => ChatOverlay['transform'];
  createOverlayId: () => string;
  getAnalyticsContext: () => Record<string, unknown>;
  getChatOverlayName: (rawText: string, overlayIndex: number) => string;
  nextTick: () => Promise<void>;
  onLockedActiveOverlay?: (overlayId: string) => void;
  renderKey: Ref<number>;
  selectedText: SelectedTextState;
  showColorDialog: Ref<boolean>;
  trackEvent: (eventName: string, payload?: AnalyticsParams) => void;
}

const TIMESTAMP_PREFIX_PATTERN = /^\[\d{2}:\d{2}:\d{2}\]\s*/;

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export const useMagicianChatLayers = (options: UseMagicianChatLayersOptions) => {
  const {
    activeChatOverlay,
    activeChatOverlayId,
    characterName,
    chatLineWidth,
    chatOverlays,
    chatlogText,
    createDefaultChatTransform,
    createOverlayId,
    getAnalyticsContext,
    getChatOverlayName,
    nextTick,
    onLockedActiveOverlay,
    renderKey,
    selectedText,
    showColorDialog,
    trackEvent
  } = options;

  const stripTimestampPrefix = (line: string) =>
    line.replace(TIMESTAMP_PREFIX_PATTERN, '');

  const getTimestampPrefixLength = (line: string) => {
    const timestampMatch = line.match(TIMESTAMP_PREFIX_PATTERN);
    return timestampMatch ? timestampMatch[0].length : 0;
  };

  const parseChatText = (rawText: string) => {
    const lines = rawText.split('\n').filter((line) => line.trim() !== '');

    return lines.map((line, index) => ({
      id: index,
      text: stripTimestampPrefix(line)
    }));
  };

  const getDisplayedLineText = (line: string) => stripTimestampPrefix(line);

  const getDisplayedSelectionRange = (line: string, rawStartOffset: number, rawEndOffset: number) => {
    const displayedLine = getDisplayedLineText(line);
    const strippedLength = getTimestampPrefixLength(line);

    return {
      displayedLine,
      startOffset: Math.max(0, rawStartOffset - strippedLength),
      endOffset: Math.max(0, rawEndOffset - strippedLength)
    };
  };

  const clearSelection = () => {
    selectedText.lineIndex = -1;
    selectedText.startOffset = 0;
    selectedText.endOffset = 0;
    selectedText.text = '';
  };

  const clearChatlog = () => {
    chatlogText.value = '';
    clearSelection();
  };

  const getAutomaticLineColors = (text: string) => {
    const colors = Array(text.length).fill('rgb(255, 255, 255)');

    const cellphonePattern = colorMappings.find((mapping) =>
      mapping.checkPlayerName && mapping.pattern.test(text)
    );

    if (cellphonePattern && characterName.value) {
      const color = text.startsWith(characterName.value)
        ? 'rgb(255, 255, 255)'
        : cellphonePattern.color;
      return colors.fill(color);
    }

    const fullLinePattern = colorMappings.find((mapping) =>
      mapping.fullLine && !mapping.checkPlayerName && mapping.pattern.test(text)
    );

    if (fullLinePattern) {
      return colors.fill(fullLinePattern.color);
    }

    const splitPattern = colorMappings.find((mapping) =>
      mapping.splitPattern && mapping.pattern.test(text)
    );

    if (splitPattern?.splitPattern && splitPattern.markerColor) {
      colors.fill(splitPattern.color);
      const flags = splitPattern.splitPattern.flags.includes('g')
        ? splitPattern.splitPattern.flags
        : `${splitPattern.splitPattern.flags}g`;
      const regex = new RegExp(splitPattern.splitPattern.source, flags);

      for (const match of text.matchAll(regex)) {
        const matchText = match[0];
        const matchIndex = match.index ?? 0;
        for (let index = matchIndex; index < matchIndex + matchText.length; index++) {
          colors[index] = splitPattern.markerColor;
        }
      }

      return colors;
    }

    for (const mapping of colorMappings) {
      if (mapping.pattern.test(text)) {
        return colors.fill(mapping.color);
      }
    }

    return colors;
  };

  const getStyledCharacters = (overlay: ChatOverlay, lineIndex: number, text: string) => {
    const colors = getAutomaticLineColors(text);
    const censorTypes = Array<CensorType | undefined>(text.length).fill(undefined);

    overlay.manualColorRegions.forEach((region) => {
      if (region.lineIndex !== lineIndex) return;

      for (let index = Math.max(0, region.startOffset); index < Math.min(text.length, region.endOffset); index++) {
        colors[index] = region.color;
      }
    });

    overlay.censoredRegions.forEach((region) => {
      if (region.lineIndex !== lineIndex) return;

      for (let index = Math.max(0, region.startOffset); index < Math.min(text.length, region.endOffset); index++) {
        censorTypes[index] = region.type;
      }
    });

    return text.split('').map((character, index) => ({
      character,
      color: colors[index] || 'rgb(255, 255, 255)',
      censorType: censorTypes[index]
    }));
  };

  const collapseStyledCharacters = (
    characters: Array<{ character: string; color: string; censorType?: CensorType }>
  ) => {
    if (characters.length === 0) return [];

    const runs: Array<{ text: string; color: string; censorType?: CensorType }> = [];
    let currentRun = { ...characters[0], text: characters[0].character };

    for (let index = 1; index < characters.length; index++) {
      const currentCharacter = characters[index];

      if (
        currentCharacter.color === currentRun.color &&
        currentCharacter.censorType === currentRun.censorType
      ) {
        currentRun.text += currentCharacter.character;
      } else {
        runs.push({
          text: currentRun.text,
          color: currentRun.color,
          censorType: currentRun.censorType
        });
        currentRun = { ...currentCharacter, text: currentCharacter.character };
      }
    }

    runs.push({
      text: currentRun.text,
      color: currentRun.color,
      censorType: currentRun.censorType
    });

    return runs;
  };

  const buildStyledLineHtml = (overlay: ChatOverlay, lineIndex: number, text: string) =>
    collapseStyledCharacters(getStyledCharacters(overlay, lineIndex, text))
      .map((run) => {
        const classNames = [];
        if (run.censorType === CensorType.Invisible) classNames.push('censored-invisible');
        if (run.censorType === CensorType.BlackBar) classNames.push('censored-blackbar');
        if (run.censorType === CensorType.Blur) classNames.push('censored-blur');

        const classAttribute = classNames.length > 0 ? ` class="${classNames.join(' ')}"` : '';
        const styleParts = [`color: ${run.color}`];

        if (run.censorType === CensorType.Invisible || run.censorType === CensorType.BlackBar) {
          styleParts.push('color: transparent');
        }

        const styleAttribute = ` style="${styleParts.join('; ')}"`;
        return `<span${classAttribute}${styleAttribute}>${escapeHtml(run.text)}</span>`;
      })
      .join('');

  const syncEditorFromActiveOverlay = () => {
    if (!activeChatOverlay.value) {
      chatlogText.value = '';
      chatLineWidth.value = DEFAULT_CHAT_LINE_WIDTH;
      return;
    }

    chatlogText.value = activeChatOverlay.value.rawText;
    chatLineWidth.value = activeChatOverlay.value.lineWidth;
  };

  const selectChatOverlay = (overlayId: string | null) => {
    activeChatOverlayId.value = overlayId;
    syncEditorFromActiveOverlay();
    clearSelection();
  };

  const startNewChatLayer = () => {
    activeChatOverlayId.value = null;
    chatlogText.value = '';
    chatLineWidth.value = DEFAULT_CHAT_LINE_WIDTH;
    clearSelection();
  };

  const removeChatOverlay = (overlayId: string) => {
    const overlayIndex = chatOverlays.value.findIndex((overlay) => overlay.id === overlayId);
    if (overlayIndex === -1) return;

    chatOverlays.value.splice(overlayIndex, 1);

    if (activeChatOverlayId.value === overlayId) {
      const nextOverlay = chatOverlays.value[Math.max(0, overlayIndex - 1)] ?? chatOverlays.value[0] ?? null;
      selectChatOverlay(nextOverlay?.id ?? null);
    }

    renderKey.value++;
  };

  const duplicateChatOverlay = (
    cloneChatOverlay: (overlay: Partial<ChatOverlay>, index: number) => ChatOverlay,
    overlayId: string
  ) => {
    const sourceOverlay = chatOverlays.value.find((overlay) => overlay.id === overlayId);
    if (!sourceOverlay) return;

    const overlayIndex = chatOverlays.value.length;
    const duplicatedOverlay = cloneChatOverlay({
      ...sourceOverlay,
      id: createOverlayId(),
      name: `${sourceOverlay.name} Copy`,
      transform: {
        ...sourceOverlay.transform,
        x: sourceOverlay.transform.x + 16,
        y: sourceOverlay.transform.y + 16
      }
    }, overlayIndex);

    chatOverlays.value.push(duplicatedOverlay);
    selectChatOverlay(duplicatedOverlay.id);
    renderKey.value++;
  };

  const toggleChatOverlayVisibility = (overlayId: string) => {
    const overlay = chatOverlays.value.find((item) => item.id === overlayId);
    if (!overlay) return;

    overlay.isHidden = !overlay.isHidden;

    if (overlay.isHidden && activeChatOverlayId.value === overlayId) {
      syncEditorFromActiveOverlay();
    }

    renderKey.value++;
  };

  const toggleChatOverlayLock = (overlayId: string) => {
    const overlay = chatOverlays.value.find((item) => item.id === overlayId);
    if (!overlay) return;

    overlay.isLocked = !overlay.isLocked;

    if (overlay.isLocked && activeChatOverlayId.value === overlayId) {
      onLockedActiveOverlay?.(overlayId);
    }

    renderKey.value++;
  };

  const reparseChatOverlays = () => {
    chatOverlays.value.forEach((overlay, index) => {
      overlay.parsedLines = parseChatText(overlay.rawText);
      overlay.name = getChatOverlayName(overlay.rawText, index);
    });
    renderKey.value++;
  };

  const parseChatlog = () => {
    const rawText = chatlogText.value;
    const parsedLines = parseChatText(rawText);
    const isEditingExistingOverlay = Boolean(activeChatOverlay.value);

    if (parsedLines.length === 0) {
      if (activeChatOverlay.value) {
        activeChatOverlay.value.rawText = rawText;
        activeChatOverlay.value.parsedLines = [];
        activeChatOverlay.value.name = getChatOverlayName(rawText, chatOverlays.value.indexOf(activeChatOverlay.value));
        activeChatOverlay.value.lineWidth = chatLineWidth.value;
      }
      renderKey.value++;
      return;
    }

    if (activeChatOverlay.value) {
      activeChatOverlay.value.rawText = rawText;
      activeChatOverlay.value.parsedLines = parsedLines;
      activeChatOverlay.value.lineWidth = chatLineWidth.value;
      activeChatOverlay.value.name = getChatOverlayName(rawText, chatOverlays.value.indexOf(activeChatOverlay.value));
    } else {
      const overlayIndex = chatOverlays.value.length;
      const newOverlay: ChatOverlay = {
        id: createOverlayId(),
        name: getChatOverlayName(rawText, overlayIndex),
        rawText,
        parsedLines,
        transform: createDefaultChatTransform(),
        censoredRegions: [],
        manualColorRegions: [],
        lineWidth: chatLineWidth.value,
        isHidden: false,
        isLocked: false
      };

      chatOverlays.value.push(newOverlay);
      activeChatOverlayId.value = newOverlay.id;
    }

    trackEvent('parse_chatlog', {
      mode: isEditingExistingOverlay ? 'update' : 'create',
      parsed_lines_count: parsedLines.length,
      raw_characters_count: rawText.length,
      ...getAnalyticsContext()
    });

    renderKey.value++;
  };

  const getCensorTypeLabel = (type: CensorType) => {
    switch (type) {
      case CensorType.Invisible:
        return 'Invisible';
      case CensorType.BlackBar:
        return 'Black Bar';
      case CensorType.Blur:
        return 'Blur';
      default:
        return 'None';
    }
  };

  const buildRegionId = (region: CensoredRegion) =>
    `${region.lineIndex}:${region.startOffset}:${region.endOffset}`;

  const getLineTextForRegion = (overlay: ChatOverlay, lineIndex: number) => {
    const rawLines = overlay.rawText.split('\n');
    return getDisplayedLineText(rawLines[lineIndex] ?? '');
  };

  const getRegionPreviewText = (overlay: ChatOverlay, region: CensoredRegion) => {
    const lineText = getLineTextForRegion(overlay, region.lineIndex);
    const start = Math.max(0, Math.min(lineText.length, region.startOffset));
    const end = Math.max(start, Math.min(lineText.length, region.endOffset));

    return lineText.slice(start, end).trim() || '(Whitespace selection)';
  };

  const activeCensoredRegionSummaries = computed<CensoredRegionSummary[]>(() => {
    if (!activeChatOverlay.value) return [];

    return [...activeChatOverlay.value.censoredRegions]
      .sort((a, b) =>
        a.lineIndex - b.lineIndex ||
        a.startOffset - b.startOffset ||
        a.endOffset - b.endOffset
      )
      .map((region) => {
        const lineText = getLineTextForRegion(activeChatOverlay.value!, region.lineIndex);
        return {
          ...region,
          id: buildRegionId(region),
          label: `Line ${region.lineIndex + 1} · ${getCensorTypeLabel(region.type)}`,
          preview: getRegionPreviewText(activeChatOverlay.value!, region),
          lineText
        };
      });
  });

  const isRegionSelected = (region: CensoredRegion) =>
    selectedText.lineIndex === region.lineIndex &&
    selectedText.startOffset === region.startOffset &&
    selectedText.endOffset === region.endOffset;

  const removeCensoredRegion = (region: CensoredRegion) => {
    if (!activeChatOverlay.value) return;

    const regionIndex = activeChatOverlay.value.censoredRegions.findIndex((candidate) =>
      candidate.lineIndex === region.lineIndex &&
      candidate.startOffset === region.startOffset &&
      candidate.endOffset === region.endOffset
    );

    if (regionIndex === -1) return;

    activeChatOverlay.value.censoredRegions.splice(regionIndex, 1);

    if (isRegionSelected(region)) {
      clearSelection();
    }

    renderKey.value++;
  };

  const getChatlogTextareaElement = () =>
    document.querySelector('.chatlog-textarea textarea') as HTMLTextAreaElement | null;

  const focusCensoredRegion = async (region: CensoredRegion) => {
    if (!activeChatOverlay.value) return;

    if (activeChatOverlay.value.rawText !== chatlogText.value) {
      syncEditorFromActiveOverlay();
    }

    await nextTick();

    const textarea = getChatlogTextareaElement();
    if (!textarea) return;

    const rawLines = textarea.value.split('\n');
    const lineText = rawLines[region.lineIndex] ?? '';
    const timestampPrefixLength = getTimestampPrefixLength(lineText);
    const displayedLine = getDisplayedLineText(lineText);
    const safeStartOffset = Math.max(0, Math.min(displayedLine.length, region.startOffset));
    const safeEndOffset = Math.max(safeStartOffset, Math.min(displayedLine.length, region.endOffset));
    const lineStartOffset = rawLines
      .slice(0, region.lineIndex)
      .reduce((total, line) => total + line.length + 1, 0);
    const selectionStart = lineStartOffset + timestampPrefixLength + safeStartOffset;
    const selectionEnd = lineStartOffset + timestampPrefixLength + safeEndOffset;

    textarea.focus();
    textarea.setSelectionRange(selectionStart, selectionEnd);

    selectedText.lineIndex = region.lineIndex;
    selectedText.startOffset = safeStartOffset;
    selectedText.endOffset = safeEndOffset;
    selectedText.text = getRegionPreviewText(activeChatOverlay.value, region);
  };

  const getSelectedCensorRegionIndex = () => {
    if (selectedText.lineIndex === -1 || !activeChatOverlay.value) return;
    return activeChatOverlay.value.censoredRegions.findIndex(
      (region) => region.lineIndex === selectedText.lineIndex &&
        region.startOffset === selectedText.startOffset &&
        region.endOffset === selectedText.endOffset
    );
  };

  const applyCensorType = (type: CensorType) => {
    if (selectedText.lineIndex === -1 || !activeChatOverlay.value || type === CensorType.None) return;

    const existingIndex = getSelectedCensorRegionIndex();

    if (existingIndex === undefined || existingIndex === -1) {
      activeChatOverlay.value.censoredRegions.push({
        lineIndex: selectedText.lineIndex,
        startOffset: selectedText.startOffset,
        endOffset: selectedText.endOffset,
        type
      });
    } else {
      activeChatOverlay.value.censoredRegions[existingIndex].type = type;
    }

    trackEvent('apply_censor', {
      censor_type: type,
      selection_length: Math.max(0, selectedText.endOffset - selectedText.startOffset),
      line_index: selectedText.lineIndex,
      ...getAnalyticsContext()
    });

    renderKey.value++;
  };

  const clearCensorType = () => {
    if (selectedText.lineIndex === -1 || !activeChatOverlay.value) return;

    const existingIndex = getSelectedCensorRegionIndex();
    if (existingIndex === undefined || existingIndex === -1) return;

    activeChatOverlay.value.censoredRegions.splice(existingIndex, 1);
    trackEvent('remove_censor', {
      selection_length: Math.max(0, selectedText.endOffset - selectedText.startOffset),
      line_index: selectedText.lineIndex,
      ...getAnalyticsContext()
    });
    renderKey.value++;
  };

  const openColorDialog = () => {
    if (selectedText.lineIndex === -1 || !activeChatOverlay.value) return;
    showColorDialog.value = true;
  };

  const applyManualColorOverride = (color: string) => {
    if (selectedText.lineIndex === -1 || !activeChatOverlay.value) return;

    const existingIndex = activeChatOverlay.value.manualColorRegions.findIndex((region) =>
      region.lineIndex === selectedText.lineIndex &&
      region.startOffset === selectedText.startOffset &&
      region.endOffset === selectedText.endOffset
    );

    if (existingIndex === -1) {
      activeChatOverlay.value.manualColorRegions.push({
        lineIndex: selectedText.lineIndex,
        startOffset: selectedText.startOffset,
        endOffset: selectedText.endOffset,
        color
      });
    } else {
      activeChatOverlay.value.manualColorRegions[existingIndex].color = color;
    }

    showColorDialog.value = false;
    renderKey.value++;
  };

  const removeManualColorOverride = () => {
    if (selectedText.lineIndex === -1 || !activeChatOverlay.value) return;

    activeChatOverlay.value.manualColorRegions = activeChatOverlay.value.manualColorRegions.filter((region) =>
      !(
        region.lineIndex === selectedText.lineIndex &&
        region.startOffset < selectedText.endOffset &&
        region.endOffset > selectedText.startOffset
      )
    );

    showColorDialog.value = false;
    renderKey.value++;
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();

    if (!selection || selection.toString().trim() === '') {
      selectedText.lineIndex = -1;
      return;
    }

    try {
      const textarea = getChatlogTextareaElement();
      if (!textarea) return;

      const selectedValue = selection.toString().trim();
      const fullText = textarea.value;
      const lines = fullText.split('\n');

      let currentPos = 0;
      for (let i = 0; i < lines.length; i++) {
        const lineLength = lines[i].length + 1;
        const lineStart = currentPos;
        const lineEnd = currentPos + lineLength;

        const selectionStart = textarea.selectionStart;
        if (selectionStart >= lineStart && selectionStart < lineEnd) {
          const rawStartOffset = selectionStart - lineStart;
          const rawEndOffset = textarea.selectionEnd - lineStart;
          const displayedSelection = getDisplayedSelectionRange(lines[i], rawStartOffset, rawEndOffset);

          selectedText.lineIndex = i;
          selectedText.startOffset = Math.min(displayedSelection.startOffset, displayedSelection.displayedLine.length);
          selectedText.endOffset = Math.min(displayedSelection.endOffset, displayedSelection.displayedLine.length);
          selectedText.text = selectedValue;
          break;
        }

        currentPos += lineLength;
      }
    } catch (error) {
      console.error('Error handling text selection:', error);
    }
  };

  return {
    activeCensoredRegionSummaries,
    applyCensorType,
    applyManualColorOverride,
    buildStyledLineHtml,
    clearCensorType,
    clearChatlog,
    collapseStyledCharacters,
    duplicateChatOverlay,
    focusCensoredRegion,
    getCensorTypeLabel,
    getDisplayedLineText,
    getDisplayedSelectionRange,
    getStyledCharacters,
    handleTextSelection,
    isRegionSelected,
    openColorDialog,
    parseChatText,
    parseChatlog,
    removeCensoredRegion,
    removeChatOverlay,
    removeManualColorOverride,
    reparseChatOverlays,
    selectChatOverlay,
    startNewChatLayer,
    syncEditorFromActiveOverlay,
    toggleChatOverlayLock,
    toggleChatOverlayVisibility
  };
};
