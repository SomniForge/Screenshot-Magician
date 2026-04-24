import { computed, reactive, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CHAT_LINE_WIDTH } from '../constants';
import { CensorType, type ChatOverlay } from '../types';
import { useMagicianChatLayers } from '../useMagicianChatLayers';

const createOverlay = (overrides: Partial<ChatOverlay> = {}): ChatOverlay => ({
  id: 'overlay-1',
  name: 'Chatlog 1',
  rawText: '',
  parsedLines: [],
  transform: { x: 0, y: 0, scale: 1 },
  censoredRegions: [],
  manualColorRegions: [],
  lineWidth: DEFAULT_CHAT_LINE_WIDTH,
  isHidden: false,
  isLocked: false,
  ...overrides
});

const createHarness = (initialOverlays: ChatOverlay[] = []) => {
  const activeChatOverlayId = ref<string | null>(initialOverlays[0]?.id ?? null);
  const chatOverlays = ref<ChatOverlay[]>(initialOverlays);
  const selectedText = reactive({
    lineIndex: -1,
    startOffset: 0,
    endOffset: 0,
    text: ''
  });
  const trackEvent = vi.fn();

  const layers = useMagicianChatLayers({
    activeChatOverlay: computed(() =>
      chatOverlays.value.find((overlay) => overlay.id === activeChatOverlayId.value) ?? null
    ),
    activeChatOverlayId,
    characterName: ref('Avery Stone'),
    chatLineWidth: ref(DEFAULT_CHAT_LINE_WIDTH),
    chatOverlays,
    chatlogText: ref(''),
    createDefaultChatTransform: () => ({ x: 24, y: 32, scale: 1 }),
    createOverlayId: () => `overlay-${chatOverlays.value.length + 1}`,
    getAnalyticsContext: () => ({ source: 'unit-test' }),
    getChatOverlayName: (_rawText, overlayIndex) => `Chatlog ${overlayIndex + 1}`,
    nextTick: () => Promise.resolve(),
    renderKey: ref(0),
    selectedText,
    showColorDialog: ref(false),
    trackEvent
  });

  return {
    activeChatOverlayId,
    chatOverlays,
    layers,
    selectedText,
    trackEvent
  };
};

describe('useMagicianChatLayers', () => {
  it('parses non-empty chat lines and strips GTA timestamp prefixes', () => {
    const { layers } = createHarness();

    expect(layers.parseChatText('[22:14:03] Avery Stone says: Hello\n\n* waves')).toEqual([
      { id: 0, text: 'Avery Stone says: Hello' },
      { id: 1, text: '* waves' }
    ]);
  });

  it('translates raw textarea offsets into displayed offsets when timestamps are hidden', () => {
    const { layers } = createHarness();

    expect(layers.getDisplayedSelectionRange('[01:02:03] Hello world', 11, 16)).toEqual({
      displayedLine: 'Hello world',
      startOffset: 0,
      endOffset: 5
    });
  });

  it('creates and selects a new overlay when parsing editor text', () => {
    const chatlogText = ref('[12:00:00] Avery Stone says: Test line\n[12:00:01] * nods');
    const activeChatOverlayId = ref<string | null>(null);
    const chatOverlays = ref<ChatOverlay[]>([]);
    const trackEvent = vi.fn();

    const layers = useMagicianChatLayers({
      activeChatOverlay: computed(() =>
        chatOverlays.value.find((overlay) => overlay.id === activeChatOverlayId.value) ?? null
      ),
      activeChatOverlayId,
      characterName: ref('Avery Stone'),
      chatLineWidth: ref(420),
      chatOverlays,
      chatlogText,
      createDefaultChatTransform: () => ({ x: 24, y: 32, scale: 1 }),
      createOverlayId: () => 'overlay-new',
      getAnalyticsContext: () => ({ source: 'unit-test' }),
      getChatOverlayName: (_rawText, overlayIndex) => `Chatlog ${overlayIndex + 1}`,
      nextTick: () => Promise.resolve(),
      renderKey: ref(0),
      selectedText: reactive({ lineIndex: -1, startOffset: 0, endOffset: 0, text: '' }),
      showColorDialog: ref(false),
      trackEvent
    });

    layers.parseChatlog();

    expect(chatOverlays.value).toEqual([
      expect.objectContaining({
        id: 'overlay-new',
        lineWidth: 420,
        name: 'Chatlog 1',
        parsedLines: [
          { id: 0, text: 'Avery Stone says: Test line' },
          { id: 1, text: '* nods' }
        ],
        transform: { x: 24, y: 32, scale: 1 }
      })
    ]);
    expect(activeChatOverlayId.value).toBe('overlay-new');
    expect(trackEvent).toHaveBeenCalledWith('parse_chatlog', expect.objectContaining({
      mode: 'create',
      parsed_lines_count: 2,
      source: 'unit-test'
    }));
  });

  it('escapes rendered chat HTML and applies manual colors plus censor classes', () => {
    const overlay = createOverlay({
      rawText: 'Avery Stone says: <secret>',
      parsedLines: [{ id: 0, text: 'Avery Stone says: <secret>' }],
      manualColorRegions: [{ lineIndex: 0, startOffset: 18, endOffset: 26, color: 'rgb(255, 0, 0)' }],
      censoredRegions: [{ lineIndex: 0, startOffset: 18, endOffset: 26, type: CensorType.BlackBar }]
    });
    const { layers } = createHarness([overlay]);

    const html = layers.buildStyledLineHtml(overlay, 0, overlay.parsedLines[0].text);

    expect(html).toContain('&lt;secret&gt;');
    expect(html).toContain('class="censored-blackbar"');
    expect(html).toContain('color: rgb(255, 0, 0); color: transparent');
    expect(html).not.toContain('<secret>');
  });

  it('summarizes censored regions using displayed text instead of raw timestamp text', () => {
    const overlay = createOverlay({
      rawText: '[07:30:11] Avery Stone says: secret plan',
      parsedLines: [{ id: 0, text: 'Avery Stone says: secret plan' }],
      censoredRegions: [{ lineIndex: 0, startOffset: 18, endOffset: 24, type: CensorType.Blur }]
    });
    const { layers } = createHarness([overlay]);

    expect(layers.activeCensoredRegionSummaries.value).toEqual([
      expect.objectContaining({
        id: '0:18:24',
        label: 'Line 1 · Blur',
        lineText: 'Avery Stone says: secret plan',
        preview: 'secret'
      })
    ]);
  });
});
