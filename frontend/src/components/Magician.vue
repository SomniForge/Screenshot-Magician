// src/components/Magician.vue

<script setup lang="ts">
import { ref, computed, reactive, shallowRef, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { type ComponentPublicInstance, type CSSProperties } from 'vue';
import { useDisplay, useTheme } from 'vuetify';
import Cookies from 'js-cookie';
import { createEditorThemeDefinition, editorThemeFamilies, editorThemePresets } from '@/plugins/vuetify';
import { useAdPreferences } from '@/composables/useAdPreferences';
import { useAnalytics } from '@/composables/useAnalytics';
import { useUnsavedNavigationStore } from '@/stores/unsavedNavigation';

defineOptions({
  name: 'ScreenshotMagicianEditor'
});

const chatlogText = ref('');
const unsavedNavigationStore = useUnsavedNavigationStore();
const droppedImageSrc = ref<string | null>(null); // To store the image data URL
const imageElementRef = ref<HTMLImageElement | null>(null);
const imageOverlayInputRef = ref<HTMLInputElement | null>(null);
const isDraggingOverDropZone = ref(false); // Renamed from isDragging for clarity
const dropZoneWidth = ref<number | null>(800); // Default width
const dropZoneHeight = ref<number | null>(600); // Default height
const fileInputRef = ref<HTMLInputElement | null>(null); // Ref for the file input element
const chatFileInputRef = ref<HTMLInputElement | null>(null); // New ref for chat file input
const projectFileInputRef = ref<HTMLInputElement | null>(null);
const showNewSessionDialog = ref(false); // Control dialog visibility

// --- Resizable Chat Panel State ---
const chatPanelRef = ref<HTMLElement | null>(null);
const parentRowRef = ref<HTMLElement | null>(null);
const utilityPanelScrollRef = ref<HTMLElement | null>(null);
const utilityPanelWidth = ref(352);
const isResizingChatPanel = ref(false);
const resizeStartX = ref(0);
const initialChatPanelBasis = ref(25); // Default basis is 25%
const chatPanelFlexBasis = ref('25%'); // Default width as string with %
const mainContentFlexBasis = ref('75%'); // Default width for main content

// --- Parsed Chat State ---
interface ParsedLine {
  id: number;
  text: string;
  color?: string;
}

interface ChatTransform {
  x: number;
  y: number;
  scale: number;
}

interface ImageOverlay {
  id: string;
  name: string;
  src: string;
  sourceWidth: number;
  sourceHeight: number;
  maskDataUrl: string | null;
  transform: ChatTransform;
  opacity: number;
  acceptsEffects: boolean;
  isHidden: boolean;
  isLocked: boolean;
}

// Censor types enum
enum CensorType {
  None = 'none',
  Invisible = 'invisible',
  BlackBar = 'blackbar',
  Blur = 'blur'
}

// Interface for censored regions
interface CensoredRegion {
  lineIndex: number;
  startOffset: number;
  endOffset: number;
  type: CensorType;
}

interface CensoredRegionSummary extends CensoredRegion {
  id: string;
  label: string;
  preview: string;
  lineText: string;
}

interface ManualColorRegion {
  lineIndex: number;
  startOffset: number;
  endOffset: number;
  color: string;
}

interface ChatOverlay {
  id: string;
  name: string;
  rawText: string;
  parsedLines: ParsedLine[];
  transform: ChatTransform;
  censoredRegions: CensoredRegion[];
  manualColorRegions: ManualColorRegion[];
  lineWidth: number;
  isHidden: boolean;
  isLocked: boolean;
}

interface EditorStateSnapshot {
  characterName: string;
  chatlogText: string;
  droppedImageSrc: string | null;
  dropZoneWidth: number;
  dropZoneHeight: number;
  imageTransform: ChatTransform;
  imageOverlays: ImageOverlay[];
  activeImageOverlayId: string | null;
  imageEffects: ImageEffectLayer[];
  chatOverlays: ChatOverlay[];
  activeChatOverlayId: string | null;
  isImageDraggingEnabled: boolean;
  isChatDraggingEnabled: boolean;
  showBlackBars: boolean;
  selectedText: {
    lineIndex: number;
    startOffset: number;
    endOffset: number;
    text: string;
  };
  stripTimestamps?: boolean;
  chatLineWidth: number;
  chatTransform?: ChatTransform;
  censoredRegions?: CensoredRegion[];
}

interface ProjectRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  snapshot: EditorStateSnapshot;
}

interface SaveProjectOptions {
  forceNewProject?: boolean;
  autosave?: boolean;
  refreshProjectList?: boolean;
}

interface PortableProjectFile {
  format: 'ssmag-project';
  version: 1;
  exportedAt: string;
  project: {
    name: string;
    createdAt: string;
    updatedAt: string;
    snapshot: EditorStateSnapshot;
  };
}

interface PersistedEditorSession {
  snapshot: EditorStateSnapshot;
  currentProjectId: string | null;
  currentProjectName: string;
}

interface ImageEffectLayer {
  presetId: string;
  opacity: number;
  seed: number;
  amount?: number;
}

interface ImageEffectPreset {
  id: string;
  name: string;
  description: string;
  blendMode: GlobalCompositeOperation;
  defaultOpacity: number;
  supportsSeed: boolean;
  supportsOpacity?: boolean;
  kind?: 'overlay' | 'scene';
  supportsAmount?: boolean;
  amountLabel?: string;
  defaultAmount?: number;
  amountMin?: number;
  amountMax?: number;
  amountStep?: number;
}

interface TutorialStep {
  title: string;
  icon: string;
  description: string;
}

interface ShortcutGroup {
  title: string;
  items: Array<{
    label: string;
    keys: string[];
  }>;
}

interface EditorThemePalette {
  background: string;
  surface: string;
  surfaceVariant: string;
  primary: string;
  secondary: string;
}

interface SavedEditorTheme {
  id: string;
  name: string;
  colors: EditorThemePalette;
  createdAt: string;
}

interface BuiltInThemeOption {
  id: string;
  name: string;
  description: string;
  lightPreview: string[];
  darkPreview: string[];
}

interface PendingEditorAction {
  type: 'new-session' | 'load-project';
  projectId?: string;
}

interface EditorHistoryEntry {
  signature: string;
  snapshot: EditorStateSnapshot;
  currentProjectId: string | null;
  currentProjectName: string;
}

interface ImageEffectPreviewEntry {
  effect: ImageEffectLayer;
  preset: ImageEffectPreset;
  dataUrl: string;
}

interface GuideBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

interface SmartGuideLine {
  kind: 'alignment' | 'spacing';
  orientation: 'vertical' | 'horizontal';
  position: number;
  start: number;
  end: number;
}

interface SmartGuideLabel {
  text: string;
  x: number;
  y: number;
}

interface AxisSnap {
  delta: number;
  target: number;
}

interface SpacingSnap {
  delta: number;
  gap: number;
  before: GuideBounds;
  after: GuideBounds;
}

type ImageOverlayTool = 'move' | 'erase' | 'restore';

type TemplateRefElement = Element | ComponentPublicInstance | null;

const DEFAULT_CHAT_LINE_WIDTH = 640;
const HISTORY_LIMIT = 50;
const HISTORY_COMMIT_DELAY_MS = 250;
const PROJECT_AUTOSAVE_DELAY_MS = 1200;
const DEFAULT_IMAGE_MASK_BRUSH_SIZE = 180;
const DEFAULT_IMAGE_MASK_BRUSH_SOFTNESS = 0.72;
const DEFAULT_IMAGE_MASK_BRUSH_STRENGTH = 0.78;
const MIN_IMAGE_MASK_BRUSH_SIZE = 8;
const MAX_IMAGE_MASK_BRUSH_SIZE = 640;
const DEFAULT_SELECTED_TEXT = {
  lineIndex: -1,
  startOffset: 0,
  endOffset: 0,
  text: ''
};
const PROJECTS_DB_NAME = 'screenshot-magician-projects';
const PROJECTS_STORE_NAME = 'projects';
const PROJECTS_DB_VERSION = 1;
const TUTORIAL_DISMISSED_COOKIE = 'magicianTutorialDismissed';
const CUSTOM_THEMES_STORAGE_KEY = 'magicianCustomThemes';
const ACTIVE_THEME_STORAGE_KEY = 'magicianActiveTheme';
const EDITOR_STATE_STORAGE_KEY = 'magicianEditorState';
const SHOW_NAVIGATOR_STORAGE_KEY = 'magicianShowNavigator';
const SMART_GUIDES_ENABLED_STORAGE_KEY = 'magicianSmartGuidesEnabled';
const SMART_GUIDE_STRENGTH_STORAGE_KEY = 'magicianSmartGuideStrength';

const chatOverlays = ref<ChatOverlay[]>([]);
const activeChatOverlayId = ref<string | null>(null);
const imageOverlays = ref<ImageOverlay[]>([]);
const activeImageOverlayId = ref<string | null>(null);
const activeChatOverlay = computed(() =>
  chatOverlays.value.find((overlay) => overlay.id === activeChatOverlayId.value) ?? null
);
const activeImageOverlay = computed(() =>
  imageOverlays.value.find((overlay) => overlay.id === activeImageOverlayId.value) ?? null
);

const projectRecords = ref<Array<Pick<ProjectRecord, 'id' | 'name' | 'createdAt' | 'updatedAt'>>>([]);
const currentProjectId = ref<string | null>(null);
const currentProjectName = ref('');
const autosaveState = ref<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
const showUnsavedChangesDialog = ref(false);
const pendingEditorAction = ref<PendingEditorAction | null>(null);
const lastSavedSnapshotSignature = ref('');
const historyEntries = ref<EditorHistoryEntry[]>([]);
const historyIndex = ref(-1);
const showProjectsDialog = ref(false);
const showSaveProjectDialog = ref(false);
const showDeleteProjectDialog = ref(false);
const showEffectsDialog = ref(false);
const showSettingsDialog = ref(false);
const showKeyboardShortcutsDialog = ref(false);
const showTutorialDialog = ref(false);
const showNavigator = ref(true);
const smartGuidesEnabled = ref(true);
const smartGuideStrength = ref(6);
const isQBypassHeld = ref(false);
const isGuideBypassActive = ref(false);
const pendingProjectName = ref('');
const pendingProjectDelete = ref<{ id: string; name: string } | null>(null);
const isProjectsLoading = ref(false);
const showColorDialog = ref(false);
const customColorHex = ref('#ffffff');
const customColorSwatches = ref<string[]>([]);
const imageEffects = ref<ImageEffectLayer[]>([]);
const dontShowTutorialAgain = ref(false);
const tutorialStepIndex = ref(0);
const customEditorThemes = ref<SavedEditorTheme[]>([]);
const themeDraftName = ref('');
const themeSharePayload = ref('');
const themeImportPayload = ref('');
const activeEditorThemeId = ref('default-light');
const themeDraftColors = reactive<EditorThemePalette>({
  background: '#f4f5f7',
  surface: '#ffffff',
  surfaceVariant: '#edf1f5',
  primary: '#42a5f5',
  secondary: '#7e57c2'
});
const vuetifyTheme = useTheme();
const { width: viewportWidth } = useDisplay();
const { showAds, setShowAds } = useAdPreferences();
const { trackEvent } = useAnalytics();
const isApplyingHistoryState = ref(false);
let historyCommitTimer: ReturnType<typeof setTimeout> | null = null;
let projectAutosaveTimer: ReturnType<typeof setTimeout> | null = null;
let editorStatePersistTimer: ReturnType<typeof setTimeout> | null = null;
let dropzoneScaleAnimationFrame: number | null = null;
let windowResizeHandler: (() => void) | null = null;
const imageOverlaySourceImageCache = new Map<string, HTMLImageElement>();
const imageOverlaySourceImageLoadCache = new Map<string, Promise<HTMLImageElement>>();
const imageOverlayMaskCanvasMap = new Map<string, HTMLCanvasElement>();
const imageOverlayMaskSerializeTimers = new Map<string, ReturnType<typeof setTimeout>>();

// --- Image Manipulation State ---
const isImageDraggingEnabled = ref(false);
const imageTransform = reactive({ x: 0, y: 0, scale: 1 });
const isPanning = ref(false);
const panStart = reactive({ x: 0, y: 0 });
const panStartImagePos = reactive({ x: 0, y: 0 });
const activeImageDragTarget = ref<'base' | 'overlay'>('base');
const imageOverlayElementMap = new Map<string, HTMLElement>();
const pendingImageDragPosition = reactive({ x: 0, y: 0 });
let imageDragAnimationFrame: number | null = null;
const imageOverlayTool = ref<ImageOverlayTool>('move');
const imageMaskBrushSize = ref(DEFAULT_IMAGE_MASK_BRUSH_SIZE);
const imageMaskBrushSoftness = ref(DEFAULT_IMAGE_MASK_BRUSH_SOFTNESS);
const imageMaskBrushStrength = ref(DEFAULT_IMAGE_MASK_BRUSH_STRENGTH);
const isImageMaskPainting = ref(false);
const activeImageMaskOverlayId = ref<string | null>(null);
const imageMaskPaintLastPoint = reactive({ x: 0, y: 0 });
const imageMaskBrushPreview = reactive({
  visible: false,
  x: 0,
  y: 0,
  diameter: DEFAULT_IMAGE_MASK_BRUSH_SIZE
});

// --- Chat Manipulation State ---
const isChatDraggingEnabled = ref(false);
const isChatPanning = ref(false);
const chatPanStart = reactive({ x: 0, y: 0 });
const chatPanStartPos = reactive({ x: 0, y: 0 });
const chatOverlayElementMap = new Map<string, HTMLElement>();
const pendingChatDragPosition = reactive({ x: 0, y: 0 });
let chatDragAnimationFrame: number | null = null;
const smartGuideLines = ref<SmartGuideLine[]>([]);
const smartGuideLabels = ref<SmartGuideLabel[]>([]);
let activeCanvasDragCleanup: (() => void) | null = null;

// --- Scale Adjustment for Drop Zone Visibility ---
const contentAreaRef = ref<HTMLElement | null>(null); // Reference to content area div
const dropZoneRef = ref<HTMLElement | null>(null);
const dropzoneScale = ref(1); // Scale factor for the dropzone to fit screen
const isScaledDown = ref(false); // Flag to track if the dropzone is scaled down
const minimapRef = ref<HTMLElement | null>(null);

// Add to the script setup section near the other state variables
const chatLineWidth = ref(DEFAULT_CHAT_LINE_WIDTH);

// Calculate necessary scale factor to fit dropzone in available viewport
const calculateDropzoneScale = () => {
  if (!contentAreaRef.value || !dropZoneWidth.value || !dropZoneHeight.value) return;
  
  // Get the available space in the content area (accounting for padding)
  const availableWidth = contentAreaRef.value.clientWidth - 24; // Adjust padding for better fit
  const availableHeight = contentAreaRef.value.clientHeight - 24;
  
  // First check if the dropzone would fit at 100% scale
  if (dropZoneWidth.value <= availableWidth && dropZoneHeight.value <= availableHeight) {
    // It fits without scaling
    dropzoneScale.value = 1;
    isScaledDown.value = false;
    return;
  }
  
  // Calculate scale needed for width and height
  const scaleX = availableWidth / dropZoneWidth.value;
  const scaleY = availableHeight / dropZoneHeight.value;
  
  // Use the smallest scale to ensure it fits in both dimensions while maintaining aspect ratio
  const newScale = Math.min(scaleX, scaleY);
  
  // Check if this would create awkward space
  const scaledWidth = dropZoneWidth.value * newScale;
  const scaledHeight = dropZoneHeight.value * newScale;
  
  // Calculate usage percentages
  const widthUsagePercent = (scaledWidth / availableWidth) * 100;
  const heightUsagePercent = (scaledHeight / availableHeight) * 100;
  
  // If we're using less than 75% of either dimension, see if we can optimize
  if (widthUsagePercent < 85 && heightUsagePercent < 85) {
    // Try to find a better scale that maximizes space usage
    const optimalScale = Math.min(
      availableWidth * 0.95 / dropZoneWidth.value,
      availableHeight * 0.95 / dropZoneHeight.value
    );
    
    if (optimalScale > newScale) {
      // We can use more space while keeping aspect ratio
      dropzoneScale.value = optimalScale;
      isScaledDown.value = true;
      return;
    }
  }
  
  // Only update if there's a significant change to avoid unnecessary renders
  if (Math.abs(newScale - dropzoneScale.value) > 0.01) {
    dropzoneScale.value = newScale;
    isScaledDown.value = newScale < 0.98; // Consider it scaled down if below 98% of original size
  }
};

const scheduleDropzoneScaleCalculation = () => {
  if (typeof window === 'undefined') return;

  if (dropzoneScaleAnimationFrame !== null) {
    window.cancelAnimationFrame(dropzoneScaleAnimationFrame);
  }

  dropzoneScaleAnimationFrame = window.requestAnimationFrame(() => {
    dropzoneScaleAnimationFrame = null;
    calculateDropzoneScale();
  });
};

// Add watchers to recalculate scale when dimensions change
watch([dropZoneWidth, dropZoneHeight, chatPanelFlexBasis], () => {
  // Recalculate scale whenever dropzone dimensions or chat panel width changes
  scheduleDropzoneScaleCalculation();
}, { immediate: true });

// Add a scale indicator to show when the content is scaled down
const scaleIndicator = computed(() => {
  if (!isScaledDown.value) return null;
  
  const scale = Math.round(dropzoneScale.value * 100);
  return `${scale}%`;
});

// Color mapping interface
interface ColorMapping {
  pattern: RegExp;
  color: string;
  splitPattern?: RegExp;
  markerColor?: string;
  fullLine?: boolean;
  checkPlayerName?: boolean;  // New flag
}

interface SwatchEntry {
  color: string;
  label: string;
}

const tutorialSteps: TutorialStep[] = [
  {
    title: 'Start With A Screenshot',
    icon: 'mdi-image-plus-outline',
    description: 'Drop or click to load your screenshot into the canvas. Then add as many extra image layers as you want for props, logos, cutouts, or decals.'
  },
  {
    title: 'Add Chat Layers',
    icon: 'mdi-message-plus-outline',
    description: 'Paste or import a chatlog, then hit Parse to turn it into a movable chat layer. You can create and stack multiple chat layers.'
  },
  {
    title: 'Position And Style',
    icon: 'mdi-cursor-move',
    description: 'Use the drag controls to move or zoom the screenshot and chats. Select text in the chat editor to apply censoring or color overrides.'
  },
  {
    title: 'Polish With Effects',
    icon: 'mdi-image-filter-center-focus',
    description: 'Open Effects to add film grain, vignette, scanlines, and other finishing layers on top of the image for extra mood.'
  },
  {
    title: 'Save Your Work',
    icon: 'mdi-content-save-outline',
    description: 'Use Save Project to keep your session locally, or Save Image to export the final screenshot when everything looks right.'
  }
];

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'Project',
    items: [
      { label: 'Open keyboard shortcuts', keys: ['?'] },
      { label: 'Save project', keys: ['Ctrl', 'S'] },
      { label: 'Undo', keys: ['Ctrl', 'Z'] },
      { label: 'Redo', keys: ['Ctrl', 'Y'] },
      { label: 'Redo alternative', keys: ['Ctrl', 'Shift', 'Z'] }
    ]
  },
  {
    title: 'Canvas',
    items: [
      { label: 'Nudge active image layer', keys: ['Arrow Keys'] },
      { label: 'Large nudge active image layer', keys: ['Shift', 'Arrow Keys'] },
      { label: 'Zoom active image layer', keys: ['+', '/ -'] }
    ]
  },
  {
    title: 'Chat Layer',
    items: [
      { label: 'Update or create selected chat', keys: ['Ctrl', 'Enter'] },
      { label: 'Nudge active chat layer', keys: ['Arrow Keys'] },
      { label: 'Large nudge active chat layer', keys: ['Shift', 'Arrow Keys'] },
      { label: 'Zoom active chat layer', keys: ['+', '/ -'] },
      { label: 'Clear selected censor or color formatting', keys: ['Delete'] }
    ]
  },
  {
    title: 'Guides',
    items: [
      { label: 'Snap to canvas and layer alignment guides', keys: ['Drag'] },
      { label: 'Show equal spacing guides between nearby objects', keys: ['Drag'] }
    ]
  }
];

const builtInThemeDescriptions: Record<string, string> = {
  default: 'The familiar Screenshot Magician look, now with a dark companion.',
  steel: 'Cool blue-gray tones with a crisp studio feel.',
  ember: 'Warm editorial tones with orange highlights.',
  aurora: 'Sharper neon accents for a vivid control room vibe.',
  dracula: 'Moody purple-forward contrast inspired by the Dracula palette.',
  solarized: 'Balanced classic tones inspired by Solarized light and dark.',
  nord: 'Muted arctic colors with a calm, technical feel.'
};

const builtInThemeOptions: BuiltInThemeOption[] = Object.entries(editorThemeFamilies).map(([familyId, family]) => ({
  id: familyId,
  name: family.name,
  description: builtInThemeDescriptions[familyId] || `${family.name} in light and dark variants.`,
  lightPreview: [family.light.background, family.light.surface, family.light.primary, family.light.secondary],
  darkPreview: [family.dark.background, family.dark.surface, family.dark.primary, family.dark.secondary]
}));

const IMAGE_EFFECT_PRESETS: ImageEffectPreset[] = [
  {
    id: 'film-grain',
    name: 'Film Grain',
    description: 'Adds fine monochrome grain for a gritty, cinematic finish.',
    blendMode: 'overlay',
    defaultOpacity: 0.32,
    supportsSeed: true
  },
  {
    id: 'inverse',
    name: 'Inverse',
    description: 'Inverts the screenshot colors so dark tones become light and vice versa.',
    blendMode: 'difference',
    defaultOpacity: 1,
    supportsSeed: false,
    supportsOpacity: false
  },
  {
    id: 'darken',
    name: 'Darken',
    description: 'Pushes a smoky dark wash over the frame without crushing every highlight.',
    blendMode: 'darken',
    defaultOpacity: 0.42,
    supportsSeed: true
  },
  {
    id: 'dust-scratches',
    name: 'Dust & Scratches',
    description: 'Layers specks and hairline scratches for an aged-photo look.',
    blendMode: 'screen',
    defaultOpacity: 0.24,
    supportsSeed: true
  },
  {
    id: 'vignette',
    name: 'Vignette',
    description: 'Darkens the edges to push attention toward the center.',
    blendMode: 'multiply',
    defaultOpacity: 0.48,
    supportsSeed: false
  },
  {
    id: 'scanlines',
    name: 'Scanlines',
    description: 'Adds subtle horizontal lines for a harsh broadcast feel.',
    blendMode: 'multiply',
    defaultOpacity: 0.22,
    supportsSeed: false
  },
  {
    id: 'vhs',
    name: 'VHS',
    description: 'Adds tracking noise, chroma drift, scanlines, and tape grime for a lo-fi cassette look.',
    blendMode: 'overlay',
    defaultOpacity: 0.42,
    supportsSeed: true
  },
  {
    id: 'cctv',
    name: 'CCTV',
    description: 'Pushes the frame into high-contrast surveillance monochrome with scanlines, noise, and adjustable lens curvature.',
    blendMode: 'source-over',
    defaultOpacity: 1,
    supportsSeed: true,
    kind: 'scene',
    supportsAmount: true,
    amountLabel: 'Lens Curve',
    defaultAmount: 0.34,
    amountMin: 0,
    amountMax: 1,
    amountStep: 0.01
  }
];

const imageEffectPresetMap = new Map(IMAGE_EFFECT_PRESETS.map((preset) => [preset.id, preset]));

// Replace first/last name with single character name
const characterName = ref('');

// Watch character name changes and save to cookie
watch(characterName, (newValue) => {
  Cookies.set('characterName', newValue, { expires: 365 }); // Save for 1 year
});

// Update color mappings to handle all GTA World patterns
const colorMappings: ColorMapping[] = [
  // Radio messages - top priority
  { 
    pattern: /^\*\* \[S: .+? \| CH: .+?\]/i, 
    color: 'rgb(214, 207, 140)',
    fullLine: true
  },
  
  // Add cellphone pattern with higher priority
  { 
    pattern: /\(cellphone\)/i,
    color: 'rgb(251, 247, 36)',
    fullLine: true,
    checkPlayerName: true  // New flag to check if it's the player's message
  },
  
  // Basic chat patterns
  { pattern: /says:|shouts:/i, color: 'rgb(241, 241, 241)' },
  { pattern: /\(Car\)/i, color: 'rgb(251, 247, 36)' },
  { pattern: /^\*/, color: 'rgb(194, 163, 218)' },
  { pattern: /\bwhispers\b/i, color: 'rgb(237, 168, 65)' },
  { pattern: /\bYou paid\b|\bpaid you\b|\byou gave\b|\bgave you\b|\bYou received\b/i, color: 'rgb(86, 214, 75)' },
  { pattern: /g\)/i, color: 'rgb(255, 255, 0)' },
  { pattern: /\[low\]:|\[lower\]:/i, color: 'rgb(150, 149, 149)' },

  // New patterns from the provided code
  { 
    pattern: /\[!]/, 
    color: 'rgb(255, 255, 255)', 
    splitPattern: /(\[!])/, 
    markerColor: 'rgb(255, 0, 195)'
  },
  { pattern: /\[INFO]:/, color: 'rgb(255, 255, 255)', splitPattern: /(\[INFO]:)/, markerColor: 'rgb(27, 124, 222)' },
  { pattern: /\[ALERT]/, color: 'rgb(255, 255, 255)', splitPattern: /(\[ALERT])/, markerColor: 'rgb(27, 124, 222)' },
  { pattern: /\[GYM]/, color: 'rgb(255, 255, 255)', splitPattern: /(\[GYM])/, markerColor: 'rgb(22, 106, 189)' },
  { pattern: /\[advertisement]/i, color: 'rgb(127, 239, 43)' },
  { pattern: /\(\( \(PM/i, color: 'rgb(239, 227, 0)' },
  { pattern: /\(\( \(/i, color: 'rgb(139, 138, 138)' },
  { pattern: /\[megaphone]/i, color: 'rgb(241, 213, 3)' },
  { pattern: /\[microphone]/i, color: 'rgb(246, 218, 3)' },
  { pattern: /\[intercom]/i, color: 'rgb(26, 131, 232)' },
  
  // Character kill pattern
  { pattern: /\[Character kill]/, color: 'rgb(240, 0, 0)', splitPattern: /(\[Character kill])/, markerColor: 'rgb(56, 150, 243)' },
  
  // Money patterns
  { 
    pattern: /\[\$.*g\)/, 
    color: 'rgb(255, 255, 0)',
    splitPattern: /(\[\$[^\]]*\])/,
    markerColor: 'rgb(86, 214, 75)'
  },
  { 
    pattern: /\(\$.*g\)/, 
    color: 'rgb(255, 255, 0)',
    splitPattern: /(\(\$[^\)]*\))/,
    markerColor: 'rgb(86, 214, 75)'
  },
  
  // Phone number pattern
  { 
    pattern: / PH: .*g\)/, 
    color: 'rgb(255, 255, 0)',
    splitPattern: /( PH: .*)/,
    markerColor: 'rgb(86, 214, 75)'
  }
];

const defaultSwatchUsageMap = new Map<string, string[]>([
  ['rgb(255, 255, 255)', ['Standard chat text', 'Info and alert body text']],
  ['rgb(0, 0, 0)', ['Black bars and dark masking accents']],
  ['rgb(214, 207, 140)', ['Radio messages']],
  ['rgb(251, 247, 36)', ['Cellphone text', 'Car chat', 'Government chat / g)']],
  ['rgb(241, 241, 241)', ['Normal speech and shouting']],
  ['rgb(194, 163, 218)', ['Roleplay action lines']],
  ['rgb(237, 168, 65)', ['Whispers']],
  ['rgb(86, 214, 75)', ['Money received / paid', 'Payment and phone markers']],
  ['rgb(150, 149, 149)', ['Low or lower chat']],
  ['rgb(255, 0, 195)', ['[!] markers']],
  ['rgb(27, 124, 222)', ['[INFO] and [ALERT] markers']],
  ['rgb(22, 106, 189)', ['[GYM] markers']],
  ['rgb(127, 239, 43)', ['Advertisements']],
  ['rgb(239, 227, 0)', ['Private messages']],
  ['rgb(139, 138, 138)', ['Out of character chat']],
  ['rgb(241, 213, 3)', ['Megaphone']],
  ['rgb(246, 218, 3)', ['Microphone']],
  ['rgb(26, 131, 232)', ['Intercom']],
  ['rgb(240, 0, 0)', ['Character kill text']],
  ['rgb(56, 150, 243)', ['Character kill marker']]
]);

const formatSwatchLabel = (color: string, fallbackLabel = 'Custom swatch') => {
  const uses = defaultSwatchUsageMap.get(color);
  return uses && uses.length > 0 ? uses.join(' / ') : `${fallbackLabel} (${color})`;
};

const defaultColorSwatches = computed<SwatchEntry[]>(() => {
  const swatches = new Set<string>([
    'rgb(255, 255, 255)',
    'rgb(0, 0, 0)'
  ]);

  colorMappings.forEach((mapping) => {
    swatches.add(mapping.color);
    if (mapping.markerColor) {
      swatches.add(mapping.markerColor);
    }
  });

  return Array.from(swatches).map((color) => ({
    color,
    label: formatSwatchLabel(color, 'Default swatch')
  }));
});

const saveCustomColorSwatches = () => {
  Cookies.set('customColorSwatches', JSON.stringify(customColorSwatches.value), { expires: 365 });
};

const loadCustomColorSwatches = () => {
  const savedSwatches = Cookies.get('customColorSwatches');
  if (!savedSwatches) return;

  try {
    const parsedSwatches = JSON.parse(savedSwatches);
    if (Array.isArray(parsedSwatches)) {
      customColorSwatches.value = parsedSwatches.filter((color) => typeof color === 'string');
    }
  } catch (error) {
    console.error('Error loading custom color swatches:', error);
  }
};

const loadHtmlImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 64)}`));
    image.src = src;
  });

const loadOverlaySourceImage = (src: string) => {
  const cachedImage = imageOverlaySourceImageCache.get(src);
  if (cachedImage) {
    return Promise.resolve(cachedImage);
  }

  const inflightRequest = imageOverlaySourceImageLoadCache.get(src);
  if (inflightRequest) {
    return inflightRequest;
  }

  const request = loadHtmlImage(src)
    .then((image) => {
      imageOverlaySourceImageCache.set(src, image);
      imageOverlaySourceImageLoadCache.delete(src);
      return image;
    })
    .catch((error) => {
      imageOverlaySourceImageLoadCache.delete(src);
      throw error;
    });

  imageOverlaySourceImageLoadCache.set(src, request);
  return request;
};

const hideImageMaskBrushPreview = () => {
  imageMaskBrushPreview.visible = false;
};

const resolveTemplateElement = (target: TemplateRefElement | HTMLElement | null) => {
  if (target instanceof HTMLElement) {
    return target;
  }

  if (target && '$el' in target) {
    const rootElement = target.$el;
    return rootElement instanceof HTMLElement ? rootElement : null;
  }

  return null;
};

const syncImageOverlayIntrinsicSize = (overlay: ImageOverlay, width: number, height: number) => {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));

  if (overlay.sourceWidth === safeWidth && overlay.sourceHeight === safeHeight) {
    return;
  }

  overlay.sourceWidth = safeWidth;
  overlay.sourceHeight = safeHeight;
};

const createImageOverlayMaskCanvas = (width: number, height: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  return canvas;
};

const ensureImageOverlayMaskCanvas = (overlay: ImageOverlay, fallbackWidth?: number, fallbackHeight?: number) => {
  const width = overlay.sourceWidth || fallbackWidth || 1;
  const height = overlay.sourceHeight || fallbackHeight || 1;
  const existingCanvas = imageOverlayMaskCanvasMap.get(overlay.id);

  if (existingCanvas && existingCanvas.width === width && existingCanvas.height === height) {
    return existingCanvas;
  }

  const maskCanvas = createImageOverlayMaskCanvas(width, height);
  imageOverlayMaskCanvasMap.set(overlay.id, maskCanvas);
  return maskCanvas;
};

const hydrateImageOverlayMaskCanvas = async (overlay: ImageOverlay) => {
  if (!overlay.maskDataUrl) {
    return null;
  }

  const maskCanvas = ensureImageOverlayMaskCanvas(overlay);
  const ctx = maskCanvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

  try {
    const maskImage = await loadHtmlImage(overlay.maskDataUrl);
    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    ctx.drawImage(maskImage, 0, 0, maskCanvas.width, maskCanvas.height);
    return maskCanvas;
  } catch (error) {
    console.error('Error hydrating image overlay mask:', error);
    return null;
  }
};

const renderImageOverlayCanvas = async (overlayId: string) => {
  const overlay = imageOverlays.value.find((item) => item.id === overlayId);
  const element = imageOverlayElementMap.get(overlayId);
  if (!overlay || !(element instanceof HTMLCanvasElement)) {
    return;
  }

  try {
    const sourceImage = await loadOverlaySourceImage(overlay.src);
    syncImageOverlayIntrinsicSize(overlay, sourceImage.naturalWidth, sourceImage.naturalHeight);

    if (element.width !== overlay.sourceWidth || element.height !== overlay.sourceHeight) {
      element.width = overlay.sourceWidth;
      element.height = overlay.sourceHeight;
    }

    const ctx = element.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, element.width, element.height);
    ctx.drawImage(sourceImage, 0, 0, element.width, element.height);

    const maskCanvas = imageOverlayMaskCanvasMap.get(overlay.id)
      ?? (overlay.maskDataUrl ? await hydrateImageOverlayMaskCanvas(overlay) : null);

    if (maskCanvas) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(maskCanvas, 0, 0, element.width, element.height);
      ctx.restore();
    }
  } catch (error) {
    console.error('Error rendering image overlay canvas:', error);
  }
};

const renderImageOverlayCanvasImmediate = (
  overlay: ImageOverlay,
  element: HTMLCanvasElement,
  sourceImage: HTMLImageElement,
  maskCanvas: HTMLCanvasElement | null
) => {
  syncImageOverlayIntrinsicSize(overlay, sourceImage.naturalWidth, sourceImage.naturalHeight);

  if (element.width !== overlay.sourceWidth || element.height !== overlay.sourceHeight) {
    element.width = overlay.sourceWidth;
    element.height = overlay.sourceHeight;
  }

  const ctx = element.getContext('2d');
  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, element.width, element.height);
  ctx.drawImage(sourceImage, 0, 0, element.width, element.height);

  if (maskCanvas) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskCanvas, 0, 0, element.width, element.height);
    ctx.restore();
  }
};

const renderAllImageOverlayCanvases = () => {
  imageOverlays.value.forEach((overlay) => {
    void renderImageOverlayCanvas(overlay.id);
  });
};

const serializeImageOverlayMask = (overlayId: string) => {
  const overlay = imageOverlays.value.find((item) => item.id === overlayId);
  const maskCanvas = imageOverlayMaskCanvasMap.get(overlayId);
  if (!overlay || !maskCanvas) {
    return;
  }

  overlay.maskDataUrl = maskCanvas.toDataURL('image/png');
};

const scheduleImageOverlayMaskSerialization = (overlayId: string, immediate = false) => {
  const existingTimer = imageOverlayMaskSerializeTimers.get(overlayId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    imageOverlayMaskSerializeTimers.delete(overlayId);
  }

  if (immediate) {
    serializeImageOverlayMask(overlayId);
    return;
  }

  const timer = setTimeout(() => {
    imageOverlayMaskSerializeTimers.delete(overlayId);
    serializeImageOverlayMask(overlayId);
  }, 350);

  imageOverlayMaskSerializeTimers.set(overlayId, timer);
};

const clearImageOverlayMaskRuntimeState = (overlayId: string) => {
  const serializeTimer = imageOverlayMaskSerializeTimers.get(overlayId);
  if (serializeTimer) {
    clearTimeout(serializeTimer);
    imageOverlayMaskSerializeTimers.delete(overlayId);
  }

  imageOverlayMaskCanvasMap.delete(overlayId);
};

const clearImageOverlayRuntimeState = (overlayId: string) => {
  clearImageOverlayMaskRuntimeState(overlayId);
  imageOverlayElementMap.delete(overlayId);
};

const syncImageOverlayRuntimeState = () => {
  const liveOverlayIds = new Set(imageOverlays.value.map((overlay) => overlay.id));

  Array.from(imageOverlayMaskCanvasMap.keys()).forEach((overlayId) => {
    if (!liveOverlayIds.has(overlayId)) {
      clearImageOverlayRuntimeState(overlayId);
    }
  });

  Array.from(imageOverlayMaskSerializeTimers.keys()).forEach((overlayId) => {
    if (!liveOverlayIds.has(overlayId)) {
      clearImageOverlayRuntimeState(overlayId);
    }
  });
};

const getImageOverlayCanvasPoint = (element: HTMLCanvasElement, clientX: number, clientY: number) => {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const x = ((clientX - rect.left) / rect.width) * element.width;
  const y = ((clientY - rect.top) / rect.height) * element.height;

  if (x < 0 || y < 0 || x > element.width || y > element.height) {
    return null;
  }

  const dropZoneElement = resolveTemplateElement(dropZoneRef.value);
  const dropRect = dropZoneElement?.getBoundingClientRect();
  const interactionScale = getCanvasInteractionScale();

  return {
    x,
    y,
    zoneX: dropRect ? (clientX - dropRect.left) / interactionScale : 0,
    zoneY: dropRect ? (clientY - dropRect.top) / interactionScale : 0
  };
};

const handleImageLayerRailWheel = (event: WheelEvent) => {
  const utilityScrollElement = utilityPanelScrollRef.value;
  if (!utilityScrollElement) {
    return;
  }

  const deltaY = event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? event.deltaY * 16
    : event.deltaY;

  if (deltaY === 0) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  utilityScrollElement.scrollTop += deltaY;
};

const updateImageMaskBrushPreview = (overlay: ImageOverlay, zoneX: number, zoneY: number) => {
  imageMaskBrushPreview.visible = true;
  imageMaskBrushPreview.x = zoneX;
  imageMaskBrushPreview.y = zoneY;
  imageMaskBrushPreview.diameter = imageMaskBrushSize.value * overlay.transform.scale;
};

const stampImageOverlayMaskBrush = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  softness: number,
  strength: number,
  tool: Exclude<ImageOverlayTool, 'move'>
) => {
  const innerRadius = radius * (1 - clampImageMaskBrushSoftness(softness));
  const gradient = ctx.createRadialGradient(x, y, innerRadius, x, y, radius);
  gradient.addColorStop(0, `rgba(255, 255, 255, ${clampImageMaskBrushStrength(strength)})`);
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.save();
  ctx.globalCompositeOperation = tool === 'erase' ? 'destination-out' : 'source-over';
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const paintImageOverlayMaskSegment = (
  overlay: ImageOverlay,
  maskCanvas: HTMLCanvasElement,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
) => {
  const ctx = maskCanvas.getContext('2d');
  if (!ctx || imageOverlayTool.value === 'move') {
    return;
  }

  const radius = Math.max(1, imageMaskBrushSize.value / 2);
  const distance = Math.hypot(toX - fromX, toY - fromY);
  const step = Math.max(1, radius * 0.35);
  const stampCount = Math.max(1, Math.ceil(distance / step));

  for (let index = 0; index <= stampCount; index += 1) {
    const progress = stampCount === 0 ? 1 : index / stampCount;
    stampImageOverlayMaskBrush(
      ctx,
      fromX + ((toX - fromX) * progress),
      fromY + ((toY - fromY) * progress),
      radius,
      imageMaskBrushSoftness.value,
      imageMaskBrushStrength.value,
      imageOverlayTool.value
    );
  }

  const element = imageOverlayElementMap.get(overlay.id);
  const sourceImage = imageOverlaySourceImageCache.get(overlay.src);
  if (element instanceof HTMLCanvasElement && sourceImage) {
    renderImageOverlayCanvasImmediate(overlay, element, sourceImage, maskCanvas);
  } else {
    void renderImageOverlayCanvas(overlay.id);
  }
  scheduleImageOverlayMaskSerialization(overlay.id);
};

const finishImageOverlayMaskPainting = () => {
  if (activeImageMaskOverlayId.value) {
    scheduleImageOverlayMaskSerialization(activeImageMaskOverlayId.value, true);
  }

  isImageMaskPainting.value = false;
  activeImageMaskOverlayId.value = null;
  hideImageMaskBrushPreview();
};

// Computed style for the drop zone
const dropZoneStyle = computed(() => {
  // Calculate scale if needed
  const scale = isScaledDown.value ? dropzoneScale.value : 1;
  const baseCursor = isImageOverlayBrushActive.value ? 'default' : (isImageDraggingEnabled.value ? (isPanning.value ? 'grabbing' : 'grab') : 'default');
  
  return {
    width: dropZoneWidth.value ? `${dropZoneWidth.value}px` : '800px', 
    height: dropZoneHeight.value ? `${dropZoneHeight.value}px` : '600px',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: `translate(-50%, -50%) scale(${scale})`,
    transformOrigin: 'center center',
    overflow: 'hidden',
    cursor: baseCursor,
    transition: 'transform 0.2s ease',
    border: isScaledDown.value ? '2px solid #42a5f5' : 'none'
  };
});

// Aspect ratio container style - use the paddingTop technique to maintain ratio
const aspectRatioContainerStyle = computed(() => {
  const aspectRatio = dropZoneWidth.value && dropZoneHeight.value
    ? dropZoneHeight.value / dropZoneWidth.value
    : 0.5625; // Default 16:9 aspect ratio
    
  return {
    paddingTop: `${aspectRatio * 100}%`,
    width: '100%',
    position: 'relative' as const,
    maxHeight: 'calc(100% - 16px)',
    margin: '8px 0'
  };
});

const imageStyle = computed(() => {
  const liveTransform = activeImageDragTarget.value === 'base' && isPanning.value
    ? pendingImageDragPosition
    : imageTransform;

  return {
    maxWidth: 'none', // Allow image to be larger than container for zoom
    maxHeight: 'none',
    position: 'absolute', // Position relative to the drop zone sheet
    top: '0', // Start at top-left before transform
    left: '0',
    transformOrigin: 'center center', // Zoom from the center
    transform: `translate(${liveTransform.x}px, ${liveTransform.y}px) scale(${imageTransform.scale})`,
    cursor: isImageDraggingEnabled.value ? (isPanning.value ? 'grabbing' : 'grab') : 'default',
    transition: isPanning.value ? 'none' : 'transform 0.1s ease-out' // Smooth transition only when not panning
  };
});

const imageFitDimensions = computed(() => {
  const zoneWidth = dropZoneWidth.value || 800;
  const zoneHeight = dropZoneHeight.value || 600;
  const naturalWidth = imageElementRef.value?.naturalWidth || zoneWidth;
  const naturalHeight = imageElementRef.value?.naturalHeight || zoneHeight;

  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return {
      width: zoneWidth,
      height: zoneHeight,
      offsetX: 0,
      offsetY: 0
    };
  }

  const zoneAspect = zoneWidth / zoneHeight;
  const imageAspect = naturalWidth / naturalHeight;

  const width = imageAspect > zoneAspect ? zoneWidth : zoneHeight * imageAspect;
  const height = imageAspect > zoneAspect ? zoneWidth / imageAspect : zoneHeight;

  return {
    width,
    height,
    offsetX: (zoneWidth - width) / 2,
    offsetY: (zoneHeight - height) / 2
  };
});

const minimapSize = computed(() => {
  const maxWidth = 180;
  const maxHeight = 120;
  const { width, height } = imageFitDimensions.value;

  if (width <= 0 || height <= 0) {
    return { width: maxWidth, height: maxHeight };
  }

  const scale = Math.min(maxWidth / width, maxHeight / height);
  return {
    width: width * scale,
    height: height * scale
  };
});

const getLiveBaseImageTransform = () => (
  activeImageDragTarget.value === 'base' && isPanning.value
    ? pendingImageDragPosition
    : imageTransform
);

const getBaseImageViewportBounds = () => {
  const zoneWidth = dropZoneWidth.value || 800;
  const zoneHeight = dropZoneHeight.value || 600;
  const { width, height, offsetX, offsetY } = imageFitDimensions.value;
  const liveImageTransform = getLiveBaseImageTransform();
  const scale = imageTransform.scale || 1;

  if (width <= 0 || height <= 0) {
    return {
      width,
      height,
      left: 0,
      top: 0,
      right: 0,
      bottom: 0
    };
  }

  if (typeof DOMMatrixReadOnly === 'undefined' || typeof DOMPoint === 'undefined') {
    const centerX = zoneWidth / 2;
    const centerY = zoneHeight / 2;
    const visibleLeft = ((((0 - liveImageTransform.x - centerX) / scale) + centerX) - offsetX);
    const visibleTop = ((((0 - liveImageTransform.y - centerY) / scale) + centerY) - offsetY);
    const visibleRight = ((((zoneWidth - liveImageTransform.x - centerX) / scale) + centerX) - offsetX);
    const visibleBottom = ((((zoneHeight - liveImageTransform.y - centerY) / scale) + centerY) - offsetY);

    return {
      width,
      height,
      left: Math.max(0, Math.min(width, visibleLeft)),
      top: Math.max(0, Math.min(height, visibleTop)),
      right: Math.max(0, Math.min(width, visibleRight)),
      bottom: Math.max(0, Math.min(height, visibleBottom))
    };
  }

  const centerX = zoneWidth / 2;
  const centerY = zoneHeight / 2;
  const cssTransform = `translate(${liveImageTransform.x}px, ${liveImageTransform.y}px) scale(${scale})`;
  const localTransform = new DOMMatrixReadOnly(cssTransform);
  const fullTransform = new DOMMatrixReadOnly()
    .translate(centerX, centerY)
    .multiply(localTransform)
    .translate(-centerX, -centerY);
  const inverseTransform = fullTransform.inverse();
  const zoneCorners = [
    new DOMPoint(0, 0),
    new DOMPoint(zoneWidth, 0),
    new DOMPoint(zoneWidth, zoneHeight),
    new DOMPoint(0, zoneHeight)
  ].map((point) => point.matrixTransform(inverseTransform));

  const localLeft = Math.min(...zoneCorners.map((point) => point.x));
  const localTop = Math.min(...zoneCorners.map((point) => point.y));
  const localRight = Math.max(...zoneCorners.map((point) => point.x));
  const localBottom = Math.max(...zoneCorners.map((point) => point.y));

  return {
    width,
    height,
    left: Math.max(0, Math.min(width, localLeft - offsetX)),
    top: Math.max(0, Math.min(height, localTop - offsetY)),
    right: Math.max(0, Math.min(width, localRight - offsetX)),
    bottom: Math.max(0, Math.min(height, localBottom - offsetY))
  };
};

const minimapViewport = computed(() => {
  const { width, height, left, top, right, bottom } = getBaseImageViewportBounds();

  const minimapScaleX = minimapSize.value.width / width;
  const minimapScaleY = minimapSize.value.height / height;

  return {
    left: left * minimapScaleX,
    top: top * minimapScaleY,
    width: (right - left) * minimapScaleX,
    height: (bottom - top) * minimapScaleY
  };
});

const showImageMinimap = computed(() =>
  showNavigator.value
  && Boolean(droppedImageSrc.value)
  && (
    imageTransform.scale > 1
    || (activeImageDragTarget.value === 'base' && isPanning.value
      ? pendingImageDragPosition.x !== 0 || pendingImageDragPosition.y !== 0
      : imageTransform.x !== 0 || imageTransform.y !== 0)
  )
);

const createOverlayId = () =>
  `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createImageOverlayId = () =>
  `image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createProjectId = () =>
  `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createDefaultChatTransform = (): ChatTransform => ({
  x: 0,
  y: 0,
  scale: 1
});

const getImageOverlayName = (name: string, index: number) => {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return `Image ${index + 1}`;
  }

  return trimmedName.length > 32 ? `${trimmedName.slice(0, 32)}...` : trimmedName;
};

const clampImageOverlayOpacity = (opacity: number) =>
  Math.min(1, Math.max(0.05, opacity));

const getInitialImageOverlayPlacement = (width: number, height: number, overlayIndex: number) => {
  const zoneWidth = dropZoneWidth.value || 800;
  const zoneHeight = dropZoneHeight.value || 600;

  if (width <= 0 || height <= 0) {
    return {
      x: 24 * overlayIndex,
      y: 24 * overlayIndex,
      scale: 1
    };
  }

  const maxScale = Math.min(zoneWidth / width, zoneHeight / height, 1);
  const safeScale = Number.isFinite(maxScale) && maxScale > 0 ? maxScale : 1;
  const scaledWidth = width * safeScale;
  const scaledHeight = height * safeScale;

  return {
    x: Math.round((zoneWidth - scaledWidth) / 2),
    y: Math.round((zoneHeight - scaledHeight) / 2),
    scale: safeScale
  };
};

const cloneImageOverlay = (overlay: Partial<ImageOverlay>, index: number): ImageOverlay => ({
  id: overlay.id || createImageOverlayId(),
  name: getImageOverlayName(overlay.name || '', index),
  src: overlay.src || '',
  sourceWidth: typeof overlay.sourceWidth === 'number' && overlay.sourceWidth > 0 ? overlay.sourceWidth : 0,
  sourceHeight: typeof overlay.sourceHeight === 'number' && overlay.sourceHeight > 0 ? overlay.sourceHeight : 0,
  maskDataUrl: typeof overlay.maskDataUrl === 'string' && overlay.maskDataUrl.length > 0 ? overlay.maskDataUrl : null,
  transform: {
    ...createDefaultChatTransform(),
    ...(overlay.transform || {})
  },
  opacity: typeof overlay.opacity === 'number' ? clampImageOverlayOpacity(overlay.opacity) : 1,
  acceptsEffects: overlay.acceptsEffects ?? true,
  isHidden: overlay.isHidden ?? false,
  isLocked: overlay.isLocked ?? false
});

const selectImageOverlay = (overlayId: string | null) => {
  if (overlayId !== activeImageMaskOverlayId.value && activeImageMaskOverlayId.value) {
    finishImageOverlayMaskPainting();
  }

  activeImageOverlayId.value = overlayId;
  activeImageDragTarget.value = overlayId ? 'overlay' : 'base';
  hideImageMaskBrushPreview();

  if (overlayId) {
    void renderImageOverlayCanvas(overlayId);
  }
};

const isImageOverlayBrushActive = computed(() =>
  Boolean(activeImageOverlay.value) && imageOverlayTool.value !== 'move'
);

const activeImageOverlayHasMask = computed(() => {
  const overlay = activeImageOverlay.value;
  if (!overlay) return false;

  return Boolean(overlay.maskDataUrl) || imageOverlayMaskCanvasMap.has(overlay.id);
});

const shouldPrioritizeActiveImageOverlayInteraction = computed(() =>
  Boolean(activeImageOverlay.value)
  && (
    isImageOverlayBrushActive.value
    || (isImageDraggingEnabled.value && activeImageDragTarget.value === 'overlay')
  )
);

const imageMaskBrushPreviewStyle = computed(() => ({
  width: `${imageMaskBrushPreview.diameter}px`,
  height: `${imageMaskBrushPreview.diameter}px`,
  left: `${imageMaskBrushPreview.x}px`,
  top: `${imageMaskBrushPreview.y}px`
}));

const clampImageMaskBrushSize = (size: number) =>
  Math.min(MAX_IMAGE_MASK_BRUSH_SIZE, Math.max(MIN_IMAGE_MASK_BRUSH_SIZE, Math.round(size)));

const clampImageMaskBrushSoftness = (softness: number) =>
  Math.min(1, Math.max(0, softness));

const clampImageMaskBrushStrength = (strength: number) =>
  Math.min(1, Math.max(0.05, strength));

const setImageOverlayTool = (tool: ImageOverlayTool) => {
  imageOverlayTool.value = tool;

  if (tool === 'move') {
    if (activeImageOverlay.value) {
      isImageDraggingEnabled.value = true;
      isChatDraggingEnabled.value = false;
    }
    hideImageMaskBrushPreview();
    return;
  }

  isImageDraggingEnabled.value = false;
  if (isPanning.value) {
    handleImageMouseUpOrLeave();
  }
};

const createImageEffectSeed = () => Math.floor(Math.random() * 2147483647);

const getImageEffectPreset = (presetId: string) => imageEffectPresetMap.get(presetId) ?? null;

const cloneImageEffectLayer = (effect: Partial<ImageEffectLayer>): ImageEffectLayer => {
  const preset = getImageEffectPreset(effect.presetId || '');
  return {
    presetId: preset?.id || IMAGE_EFFECT_PRESETS[0].id,
    opacity: typeof effect.opacity === 'number' ? Math.min(1, Math.max(0.05, effect.opacity)) : (preset?.defaultOpacity ?? 0.3),
    seed: typeof effect.seed === 'number' ? effect.seed : createImageEffectSeed(),
    amount: typeof effect.amount === 'number'
      ? Math.min(preset?.amountMax ?? 1, Math.max(preset?.amountMin ?? 0, effect.amount))
      : (preset?.defaultAmount ?? 0.35)
  };
};

const createImageEffectLayer = (presetId: string): ImageEffectLayer => {
  const preset = getImageEffectPreset(presetId);
  return cloneImageEffectLayer({
    presetId,
    opacity: preset?.defaultOpacity ?? 0.3,
    seed: createImageEffectSeed()
  });
};

const getImageEffectLayer = (presetId: string) =>
  imageEffects.value.find((effect) => effect.presetId === presetId) ?? null;

const isImageEffectActive = (presetId: string) =>
  imageEffects.value.some((effect) => effect.presetId === presetId);

const toggleImageEffect = (presetId: string) => {
  const existingIndex = imageEffects.value.findIndex((effect) => effect.presetId === presetId);
  if (existingIndex >= 0) {
    imageEffects.value.splice(existingIndex, 1);
    trackEvent('toggle_image_effect', {
      effect_id: presetId,
      enabled: false,
      ...getAnalyticsContext()
    });
    return;
  }

  imageEffects.value.push(createImageEffectLayer(presetId));
  trackEvent('toggle_image_effect', {
    effect_id: presetId,
    enabled: true,
    ...getAnalyticsContext()
  });
};

const setImageEffectOpacity = (presetId: string, opacity: number) => {
  const layer = getImageEffectLayer(presetId);
  if (!layer) return;
  layer.opacity = Math.min(1, Math.max(0.05, opacity));
};

const setImageEffectAmount = (presetId: string, amount: number) => {
  const layer = getImageEffectLayer(presetId);
  const preset = getImageEffectPreset(presetId);
  if (!layer || !preset) return;

  const min = preset.amountMin ?? 0;
  const max = preset.amountMax ?? 1;
  layer.amount = Math.min(max, Math.max(min, amount));
};

const rerollImageEffect = (presetId: string) => {
  const layer = getImageEffectLayer(presetId);
  if (!layer) return;
  layer.seed = createImageEffectSeed();
};

const clearImageEffects = () => {
  imageEffects.value = [];
};

const createSeededRandom = (seed: number) => {
  let currentSeed = seed >>> 0;

  return () => {
    currentSeed += 0x6D2B79F5;
    let t = currentSeed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const getImageEffectAmount = (effect: ImageEffectLayer, preset: ImageEffectPreset) =>
  Math.min(preset.amountMax ?? 1, Math.max(preset.amountMin ?? 0, effect.amount ?? preset.defaultAmount ?? 0.35));

const applyCctvSceneEffect = (
  sourceCanvas: HTMLCanvasElement,
  effect: ImageEffectLayer,
  preset: ImageEffectPreset
) => {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  if (width <= 0 || height <= 0) return sourceCanvas;

  const workingCanvas = document.createElement('canvas');
  workingCanvas.width = width;
  workingCanvas.height = height;
  const workingCtx = workingCanvas.getContext('2d');
  if (!workingCtx) return sourceCanvas;

  const toneCanvas = document.createElement('canvas');
  toneCanvas.width = width;
  toneCanvas.height = height;
  const toneCtx = toneCanvas.getContext('2d', { willReadFrequently: true });
  if (!toneCtx) return sourceCanvas;

  toneCtx.filter = 'grayscale(1) contrast(1.22) brightness(0.9) blur(0.35px)';
  toneCtx.drawImage(sourceCanvas, 0, 0, width, height);
  toneCtx.filter = 'none';

  const sourceImageData = toneCtx.getImageData(0, 0, width, height);
  const outputImageData = toneCtx.createImageData(width, height);
  const sourceData = sourceImageData.data;
  const outputData = outputImageData.data;
  const amount = getImageEffectAmount(effect, preset);
  const easedAmount = amount * amount;
  const distortionStrength = easedAmount * 0.12;
  const zoom = 1 - (easedAmount * 0.02);
  const aspectRatio = width / Math.max(1, height);
  const maxLensRadius = Math.sqrt((aspectRatio * aspectRatio) + 1);

  for (let y = 0; y < height; y += 1) {
    const normalizedY = (y / Math.max(1, height - 1)) * 2 - 1;
    for (let x = 0; x < width; x += 1) {
      const normalizedX = (x / Math.max(1, width - 1)) * 2 - 1;
      const lensX = normalizedX * aspectRatio;
      const lensY = normalizedY;
      const radius = Math.sqrt((lensX * lensX) + (lensY * lensY));
      const normalizedRadius = Math.min(1, radius / maxLensRadius);
      const theta = radius === 0 ? 0 : Math.atan2(lensY, lensX);
      const remappedRadius = normalizedRadius === 0
        ? 0
        : (
          normalizedRadius
          * (1 - (distortionStrength * normalizedRadius * normalizedRadius))
          * zoom
        ) * maxLensRadius;
      const sampleLensX = Math.cos(theta) * remappedRadius;
      const sampleLensY = Math.sin(theta) * remappedRadius;
      const sampleNormalizedX = sampleLensX / aspectRatio;
      const sampleNormalizedY = sampleLensY;

      if (
        Number.isNaN(sampleNormalizedX)
        || Number.isNaN(sampleNormalizedY)
        || Math.abs(sampleNormalizedX) > 1
        || Math.abs(sampleNormalizedY) > 1
      ) {
        const targetIndex = ((y * width) + x) * 4;
        outputData[targetIndex] = 8;
        outputData[targetIndex + 1] = 8;
        outputData[targetIndex + 2] = 8;
        outputData[targetIndex + 3] = 255;
        continue;
      }

      const sampleX = ((sampleNormalizedX + 1) * 0.5) * (width - 1);
      const sampleY = ((sampleNormalizedY + 1) * 0.5) * (height - 1);
      const sampleXi = Math.max(0, Math.min(width - 1, Math.round(sampleX)));
      const sampleYi = Math.max(0, Math.min(height - 1, Math.round(sampleY)));
      const sourceIndex = ((sampleYi * width) + sampleXi) * 4;
      const targetIndex = ((y * width) + x) * 4;

      outputData[targetIndex] = sourceData[sourceIndex];
      outputData[targetIndex + 1] = sourceData[sourceIndex + 1];
      outputData[targetIndex + 2] = sourceData[sourceIndex + 2];
      outputData[targetIndex + 3] = 255;
    }
  }

  workingCtx.putImageData(outputImageData, 0, 0);

  const softenedCanvas = document.createElement('canvas');
  softenedCanvas.width = width;
  softenedCanvas.height = height;
  const softenedCtx = softenedCanvas.getContext('2d');
  if (softenedCtx) {
    softenedCtx.filter = `blur(${0.2 + (amount * 0.45)}px)`;
    softenedCtx.drawImage(workingCanvas, 0, 0, width, height);
    softenedCtx.filter = 'none';
    workingCtx.clearRect(0, 0, width, height);
    workingCtx.drawImage(softenedCanvas, 0, 0, width, height);
  }

  const random = createSeededRandom(effect.seed);
  const scanlineGap = 4;
  for (let y = 0; y < height; y += scanlineGap) {
    workingCtx.fillStyle = `rgba(0, 0, 0, ${0.06 + (amount * 0.08)})`;
    workingCtx.fillRect(0, y, width, 1);
    if ((y / scanlineGap) % 9 === 0) {
      workingCtx.fillStyle = 'rgba(255, 255, 255, 0.018)';
      workingCtx.fillRect(0, y + 1, width, 1);
    }
  }

  const grainImageData = workingCtx.createImageData(width, height);
  for (let index = 0; index < grainImageData.data.length; index += 4) {
    const grainValue = Math.floor(92 + (random() * 54));
    const alphaValue = Math.floor(4 + (random() * (8 + (amount * 10))));
    grainImageData.data[index] = grainValue;
    grainImageData.data[index + 1] = grainValue;
    grainImageData.data[index + 2] = grainValue;
    grainImageData.data[index + 3] = alphaValue;
  }

  const grainCanvas = document.createElement('canvas');
  grainCanvas.width = width;
  grainCanvas.height = height;
  const grainCtx = grainCanvas.getContext('2d');
  if (grainCtx) {
    grainCtx.putImageData(grainImageData, 0, 0);
    workingCtx.save();
    workingCtx.globalCompositeOperation = 'soft-light';
    workingCtx.drawImage(grainCanvas, 0, 0, width, height);
    workingCtx.restore();
  }

  const bloomBandHeight = Math.max(12, Math.floor(height * 0.04));
  const bloomY = Math.floor(height * (0.12 + (random() * 0.1)));
  const bloom = workingCtx.createLinearGradient(0, bloomY, 0, bloomY + bloomBandHeight);
  bloom.addColorStop(0, 'rgba(255, 255, 255, 0)');
  bloom.addColorStop(0.45, 'rgba(255, 255, 255, 0.025)');
  bloom.addColorStop(0.55, 'rgba(255, 255, 255, 0.055)');
  bloom.addColorStop(1, 'rgba(255, 255, 255, 0)');
  workingCtx.fillStyle = bloom;
  workingCtx.fillRect(0, bloomY, width, bloomBandHeight);

  const edgeFalloff = workingCtx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.34,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.74
  );
  edgeFalloff.addColorStop(0, 'rgba(0, 0, 0, 0)');
  edgeFalloff.addColorStop(0.76, 'rgba(0, 0, 0, 0)');
  edgeFalloff.addColorStop(1, `rgba(0, 0, 0, ${0.08 + (amount * 0.09)})`);
  workingCtx.fillStyle = edgeFalloff;
  workingCtx.fillRect(0, 0, width, height);

  if (effect.opacity >= 0.999) {
    return workingCanvas;
  }

  const blendedCanvas = document.createElement('canvas');
  blendedCanvas.width = width;
  blendedCanvas.height = height;
  const blendedCtx = blendedCanvas.getContext('2d');
  if (!blendedCtx) return workingCanvas;

  blendedCtx.drawImage(sourceCanvas, 0, 0, width, height);
  blendedCtx.globalAlpha = Math.min(1, Math.max(0.05, effect.opacity));
  blendedCtx.drawImage(workingCanvas, 0, 0, width, height);
  blendedCtx.globalAlpha = 1;

  return blendedCanvas;
};

const buildImageEffectCanvas = (effect: ImageEffectLayer, width: number, height: number) => {
  const preset = getImageEffectPreset(effect.presetId);
  if (!preset || width <= 0 || height <= 0) return null;
  if (preset.kind === 'scene') return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const random = createSeededRandom(effect.seed);

  switch (preset.id) {
    case 'film-grain': {
      const imageData = ctx.createImageData(width, height);
      for (let i = 0; i < imageData.data.length; i += 4) {
        const grainValue = Math.floor(80 + random() * 120);
        const alpha = Math.floor(70 + random() * 100);
        imageData.data[i] = grainValue;
        imageData.data[i + 1] = grainValue;
        imageData.data[i + 2] = grainValue;
        imageData.data[i + 3] = alpha;
      }
      ctx.putImageData(imageData, 0, 0);
      break;
    }
    case 'inverse': {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      break;
    }
    case 'darken': {
      const gradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.12,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.78
      );
      gradient.addColorStop(0, 'rgba(70, 60, 76, 0.18)');
      gradient.addColorStop(0.58, 'rgba(44, 37, 49, 0.4)');
      gradient.addColorStop(1, 'rgba(10, 8, 14, 0.88)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < Math.max(10, Math.floor((width + height) / 90)); i++) {
        const cloudX = random() * width;
        const cloudY = random() * height;
        const cloudRadius = Math.min(width, height) * (0.05 + random() * 0.12);
        const cloud = ctx.createRadialGradient(
          cloudX,
          cloudY,
          0,
          cloudX,
          cloudY,
          cloudRadius
        );
        cloud.addColorStop(0, `rgba(12, 10, 18, ${0.12 + random() * 0.12})`);
        cloud.addColorStop(1, 'rgba(12, 10, 18, 0)');
        ctx.fillStyle = cloud;
        ctx.fillRect(cloudX - cloudRadius, cloudY - cloudRadius, cloudRadius * 2, cloudRadius * 2);
      }
      break;
    }
    case 'dust-scratches': {
      for (let i = 0; i < Math.floor((width * height) / 2200); i++) {
        const x = random() * width;
        const y = random() * height;
        const radius = 0.4 + random() * 1.8;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.08 + random() * 0.4})`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let i = 0; i < Math.max(3, Math.floor(width / 220)); i++) {
        const startX = random() * width;
        const startY = random() * height;
        const length = 20 + random() * Math.min(width, height) * 0.2;
        const angle = (random() - 0.5) * Math.PI;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.08 + random() * 0.18})`;
        ctx.lineWidth = 0.5 + random() * 1.2;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(startX + Math.cos(angle) * length, startY + Math.sin(angle) * length);
        ctx.stroke();
      }
      break;
    }
    case 'vignette': {
      const gradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.18,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.68
      );
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.08)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.78)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      break;
    }
    case 'scanlines': {
      for (let y = 0; y < height; y += 4) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.fillRect(0, y, width, 1);
        if ((y / 4) % 6 === 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
          ctx.fillRect(0, y + 1, width, 1);
        }
      }
      break;
    }
    case 'vhs': {
      const imageData = ctx.createImageData(width, height);
      for (let i = 0; i < imageData.data.length; i += 4) {
        const grain = Math.floor(70 + random() * 120);
        const tintShift = Math.floor(random() * 18);
        imageData.data[i] = grain + tintShift;
        imageData.data[i + 1] = grain;
        imageData.data[i + 2] = Math.max(0, grain - tintShift);
        imageData.data[i + 3] = Math.floor(16 + random() * 44);
      }
      ctx.putImageData(imageData, 0, 0);

      for (let y = 0; y < height; y += 3) {
        ctx.fillStyle = y % 6 === 0 ? 'rgba(0, 0, 0, 0.24)' : 'rgba(255, 255, 255, 0.035)';
        ctx.fillRect(0, y, width, 1);
      }

      for (let i = 0; i < Math.max(4, Math.floor(height / 120)); i++) {
        const bandY = random() * height;
        const bandHeight = 8 + random() * 26;
        const bandOffset = (random() - 0.5) * 24;
        const bandGradient = ctx.createLinearGradient(0, bandY, 0, bandY + bandHeight);
        bandGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        bandGradient.addColorStop(0.25, `rgba(255, 255, 255, ${0.05 + random() * 0.08})`);
        bandGradient.addColorStop(0.5, `rgba(95, 214, 255, ${0.04 + random() * 0.08})`);
        bandGradient.addColorStop(0.75, `rgba(255, 80, 120, ${0.03 + random() * 0.06})`);
        bandGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = bandGradient;
        ctx.fillRect(bandOffset, bandY, width, bandHeight);
      }

      for (let i = 0; i < Math.max(14, Math.floor(width / 42)); i++) {
        const streakY = random() * height;
        const streakWidth = 18 + random() * (width * 0.14);
        const streakX = random() * (width - streakWidth);
        ctx.fillStyle = `rgba(255, 70, 110, ${0.035 + random() * 0.045})`;
        ctx.fillRect(streakX, streakY, streakWidth, 1.2 + random() * 1.5);
        ctx.fillStyle = `rgba(80, 210, 255, ${0.03 + random() * 0.05})`;
        ctx.fillRect(streakX + 3, streakY + 1, streakWidth, 1 + random());
      }

      const bottomNoiseHeight = Math.max(24, Math.floor(height * 0.08));
      const bottomStart = height - bottomNoiseHeight;
      for (let y = bottomStart; y < height; y += 2) {
        const jitter = (random() - 0.5) * 38;
        const segmentWidth = width * (0.76 + random() * 0.26);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.05 + random() * 0.12})`;
        ctx.fillRect(jitter, y, segmentWidth, 1);
        if (random() > 0.65) {
          ctx.fillStyle = `rgba(0, 0, 0, ${0.08 + random() * 0.14})`;
          ctx.fillRect(0, y + 1, width, 1);
        }
      }

      const vignette = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.24,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.7
      );
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(0.68, 'rgba(0, 0, 0, 0.06)');
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0.36)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);
      break;
    }
    default:
      return null;
  }

  return canvas;
};

const hasSceneImageEffects = computed(() =>
  activeImageEffectLayers.value.some(({ preset }) => preset.kind === 'scene')
);

const buildAffectedSceneCanvas = async () => {
  if (!droppedImageSrc.value) return null;

  const width = dropZoneWidth.value || 800;
  const height = dropZoneHeight.value || 600;
  if (width <= 0 || height <= 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  const baseImage = await loadHtmlImage(droppedImageSrc.value);
  const viewportRatio = width / height;
  const imageRatio = baseImage.naturalWidth / baseImage.naturalHeight;
  let drawWidth: number;
  let drawHeight: number;
  let offsetX: number;
  let offsetY: number;

  if (imageRatio > viewportRatio) {
    drawWidth = width;
    drawHeight = width / imageRatio;
    offsetX = 0;
    offsetY = (height - drawHeight) / 2;
  } else {
    drawHeight = height;
    drawWidth = height * imageRatio;
    offsetX = (width - drawWidth) / 2;
    offsetY = 0;
  }

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.translate(imageTransform.x, imageTransform.y);
  ctx.scale(imageTransform.scale, imageTransform.scale);
  ctx.drawImage(
    baseImage,
    offsetX - (width / 2),
    offsetY - (height / 2),
    drawWidth,
    drawHeight
  );
  ctx.restore();

  for (const overlay of effectAwareImageOverlays.value.affected) {
    const overlayCanvas = await buildMaskedImageOverlayCanvas(overlay);
    if (!overlayCanvas) continue;

    ctx.save();
    ctx.globalAlpha = overlay.opacity;
    ctx.translate(overlay.transform.x, overlay.transform.y);
    ctx.scale(overlay.transform.scale, overlay.transform.scale);
    ctx.drawImage(overlayCanvas, 0, 0);
    ctx.restore();
  }

  return canvas;
};

const applyImageEffectsToSceneCanvas = async (sceneCanvas: HTMLCanvasElement) => {
  let workingCanvas = sceneCanvas;

  for (const { effect, preset } of activeImageEffectLayers.value) {
    if (preset.kind === 'scene') {
      if (preset.id === 'cctv') {
        workingCanvas = applyCctvSceneEffect(workingCanvas, effect, preset);
      }
      continue;
    }

    const effectCanvas = buildImageEffectCanvas(effect, workingCanvas.width, workingCanvas.height);
    if (!effectCanvas) continue;

    const compositedCanvas = document.createElement('canvas');
    compositedCanvas.width = workingCanvas.width;
    compositedCanvas.height = workingCanvas.height;
    const compositedCtx = compositedCanvas.getContext('2d');
    if (!compositedCtx) continue;

    compositedCtx.drawImage(workingCanvas, 0, 0, workingCanvas.width, workingCanvas.height);
    compositedCtx.save();
    compositedCtx.globalAlpha = effect.opacity;
    compositedCtx.globalCompositeOperation = preset.blendMode;
    compositedCtx.drawImage(effectCanvas, 0, 0, workingCanvas.width, workingCanvas.height);
    compositedCtx.restore();
    workingCanvas = compositedCanvas;
  }

  return workingCanvas;
};

const activeImageEffectLayers = computed(() =>
  imageEffects.value
    .map((effect) => {
      const preset = getImageEffectPreset(effect.presetId);
      if (!preset) return null;
      return { effect, preset };
    })
    .sort((a, b) => {
      if (!a || !b) return 0;
      return IMAGE_EFFECT_PRESETS.findIndex((preset) => preset.id === a.effect.presetId) -
        IMAGE_EFFECT_PRESETS.findIndex((preset) => preset.id === b.effect.presetId);
    })
    .filter((entry): entry is { effect: ImageEffectLayer; preset: ImageEffectPreset } => entry !== null)
);

const imageEffectPreviewCache = new Map<string, string>();
const activeImageEffectPreviews = shallowRef<ImageEffectPreviewEntry[]>([]);
const sceneImageEffectPreviewDataUrl = ref<string | null>(null);
const isSceneImageEffectPreviewRefreshing = ref(false);
let sceneImageEffectPreviewRefreshToken = 0;

const refreshImageEffectPreviews = async () => {
  const refreshToken = ++sceneImageEffectPreviewRefreshToken;

  if (!droppedImageSrc.value) {
    activeImageEffectPreviews.value = [];
    sceneImageEffectPreviewDataUrl.value = null;
    isSceneImageEffectPreviewRefreshing.value = false;
    return;
  }

  const width = dropZoneWidth.value || 800;
  const height = dropZoneHeight.value || 600;

  if (hasSceneImageEffects.value) {
    isSceneImageEffectPreviewRefreshing.value = true;
    const sceneCanvas = await buildAffectedSceneCanvas();
    if (!sceneCanvas) {
      if (refreshToken !== sceneImageEffectPreviewRefreshToken) return;
      activeImageEffectPreviews.value = [];
      sceneImageEffectPreviewDataUrl.value = null;
      isSceneImageEffectPreviewRefreshing.value = false;
      return;
    }

    const processedSceneCanvas = await applyImageEffectsToSceneCanvas(sceneCanvas);
    if (refreshToken !== sceneImageEffectPreviewRefreshToken) return;
    sceneImageEffectPreviewDataUrl.value = processedSceneCanvas.toDataURL('image/png');
    activeImageEffectPreviews.value = [];
    isSceneImageEffectPreviewRefreshing.value = false;
    return;
  }

  isSceneImageEffectPreviewRefreshing.value = false;
  sceneImageEffectPreviewDataUrl.value = null;

  activeImageEffectPreviews.value = activeImageEffectLayers.value
    .map(({ effect, preset }) => {
      const cacheKey = `${preset.id}:${effect.seed}:${effect.amount ?? ''}:${width}x${height}`;
      let dataUrl = imageEffectPreviewCache.get(cacheKey);

      if (!dataUrl) {
        const canvas = buildImageEffectCanvas(effect, width, height);
        if (!canvas) return null;

        dataUrl = canvas.toDataURL('image/png');
        imageEffectPreviewCache.set(cacheKey, dataUrl);
      }

      return {
        effect,
        preset,
        dataUrl
      };
    })
    .filter((entry): entry is ImageEffectPreviewEntry => entry !== null);
};

watch([droppedImageSrc, imageEffects, dropZoneWidth, dropZoneHeight, () => ({ ...imageTransform }), imageOverlays], () => {
  void refreshImageEffectPreviews();
}, {
  deep: true,
  immediate: true
});

const getImageEffectPreviewStyle = (entry: ImageEffectPreviewEntry) => ({
  position: 'absolute' as const,
  inset: '0',
  pointerEvents: 'none' as const,
  backgroundImage: `url(${entry.dataUrl})`,
  backgroundRepeat: 'no-repeat',
  backgroundSize: '100% 100%',
  opacity: entry.effect.opacity,
  mixBlendMode: entry.preset.blendMode,
  zIndex: 100
});

const sceneImageEffectPreviewStyle = computed(() => ({
  position: 'absolute' as const,
  inset: '0',
  width: '100%',
  height: '100%',
  objectFit: 'fill' as const,
  pointerEvents: 'none' as const,
  zIndex: 90
}));

const shouldShowSceneImageEffectPreview = computed(() => {
  if (!sceneImageEffectPreviewDataUrl.value) {
    return false;
  }

  if (isSceneImageEffectPreviewRefreshing.value) {
    return false;
  }

  if (!isPanning.value) {
    return true;
  }

  if (activeImageDragTarget.value === 'base') {
    return false;
  }

  return !(activeImageOverlay.value?.acceptsEffects ?? false);
});

const normalizeHexColor = (value: string, fallback: string) => {
  const normalized = value.trim();
  return /^#([0-9a-fA-F]{6})$/.test(normalized) ? normalized.toLowerCase() : fallback.toLowerCase();
};

const resolveThemeId = (themeId: string) => {
  if (vuetifyTheme.themes.value[themeId]) return themeId;

  const legacyThemeMap: Record<string, string> = {
    dark: 'default-light',
    steel: 'steel-light',
    ember: 'ember-light',
    aurora: 'aurora-light'
  };

  return legacyThemeMap[themeId] || 'default-light';
};

const getThemeFamilyId = (themeId: string) => themeId.replace(/-(light|dark)$/, '');

const createThemeDefinitionFromPalette = (palette: EditorThemePalette) =>
  createEditorThemeDefinition(palette);

const getThemePaletteFromDefinition = (themeId: string): EditorThemePalette => {
  const definition = vuetifyTheme.themes.value[themeId] ?? editorThemePresets['default-dark'];
  const colors = definition.colors ?? {};

  return {
    background: colors.background ?? '#121313',
    surface: colors.surface ?? '#1b1d1d',
    surfaceVariant: colors['surface-variant'] ?? '#23272d',
    primary: colors.primary ?? '#64b5f6',
    secondary: colors.secondary ?? '#9575cd'
  };
};

const registerCustomEditorTheme = (themeConfig: SavedEditorTheme) => {
  vuetifyTheme.themes.value[themeConfig.id] = createThemeDefinitionFromPalette(themeConfig.colors) as typeof vuetifyTheme.themes.value[string];
};

const saveCustomEditorThemes = () => {
  localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify(customEditorThemes.value));
};

const applyEditorTheme = (themeId: string) => {
  const resolvedThemeId = resolveThemeId(themeId);
  if (!vuetifyTheme.themes.value[resolvedThemeId]) return;

  activeEditorThemeId.value = resolvedThemeId;
  vuetifyTheme.global.name.value = resolvedThemeId;
  localStorage.setItem(ACTIVE_THEME_STORAGE_KEY, resolvedThemeId);
};

const loadEditorThemes = () => {
  const savedThemes = localStorage.getItem(CUSTOM_THEMES_STORAGE_KEY);
  if (savedThemes) {
    try {
      const parsedThemes = JSON.parse(savedThemes);
      if (Array.isArray(parsedThemes)) {
        customEditorThemes.value = parsedThemes
          .filter((themeConfig) => themeConfig && typeof themeConfig.id === 'string' && typeof themeConfig.name === 'string')
          .map((themeConfig) => ({
            id: themeConfig.id,
            name: themeConfig.name,
            createdAt: themeConfig.createdAt || new Date().toISOString(),
            colors: {
              background: normalizeHexColor(themeConfig.colors?.background || '', '#121313'),
              surface: normalizeHexColor(themeConfig.colors?.surface || '', '#1b1d1d'),
              surfaceVariant: normalizeHexColor(themeConfig.colors?.surfaceVariant || '', '#232626'),
              primary: normalizeHexColor(themeConfig.colors?.primary || '', '#42a5f5'),
              secondary: normalizeHexColor(themeConfig.colors?.secondary || '', '#7e57c2')
            }
          }));
      }
    } catch (error) {
      console.error('Error loading custom editor themes:', error);
    }
  }

  customEditorThemes.value.forEach(registerCustomEditorTheme);

  const storedThemeId = localStorage.getItem(ACTIVE_THEME_STORAGE_KEY) || 'default-light';
  if (vuetifyTheme.themes.value[storedThemeId]) {
    applyEditorTheme(storedThemeId);
  } else {
    applyEditorTheme(resolveThemeId(storedThemeId));
  }

  Object.assign(themeDraftColors, getThemePaletteFromDefinition(activeEditorThemeId.value));
};

const populateThemeDraftFromActiveTheme = () => {
  Object.assign(themeDraftColors, getThemePaletteFromDefinition(activeEditorThemeId.value));
  themeDraftName.value = '';
};

const saveCustomEditorTheme = () => {
  const trimmedName = themeDraftName.value.trim();
  if (!trimmedName) return;

  const customTheme: SavedEditorTheme = {
    id: `custom-theme-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmedName,
    createdAt: new Date().toISOString(),
    colors: {
      background: normalizeHexColor(themeDraftColors.background, '#f4f5f7'),
      surface: normalizeHexColor(themeDraftColors.surface, '#ffffff'),
      surfaceVariant: normalizeHexColor(themeDraftColors.surfaceVariant, '#edf1f5'),
      primary: normalizeHexColor(themeDraftColors.primary, '#42a5f5'),
      secondary: normalizeHexColor(themeDraftColors.secondary, '#7e57c2')
    }
  };

  customEditorThemes.value.push(customTheme);
  registerCustomEditorTheme(customTheme);
  saveCustomEditorThemes();
  applyEditorTheme(customTheme.id);
  themeDraftName.value = '';
};

const deleteCustomEditorTheme = (themeId: string) => {
  customEditorThemes.value = customEditorThemes.value.filter((themeConfig) => themeConfig.id !== themeId);
  delete vuetifyTheme.themes.value[themeId];
  saveCustomEditorThemes();

  if (activeEditorThemeId.value === themeId) {
    applyEditorTheme('default-light');
  }
};

const exportActiveTheme = () => {
  const customTheme = customEditorThemes.value.find((themeConfig) => themeConfig.id === activeEditorThemeId.value);
  const payload = customTheme
    ? customTheme
    : {
        id: activeEditorThemeId.value,
        name: builtInThemeOptions.find((themeOption) => themeOption.id === getThemeFamilyId(activeEditorThemeId.value))?.name || 'Theme',
        createdAt: new Date().toISOString(),
        colors: getThemePaletteFromDefinition(activeEditorThemeId.value)
      };

  themeSharePayload.value = JSON.stringify(payload, null, 2);
};

const importSharedTheme = () => {
  if (!themeImportPayload.value.trim()) return;

  try {
    const importedTheme = JSON.parse(themeImportPayload.value);
    const trimmedName = typeof importedTheme.name === 'string' ? importedTheme.name.trim() : '';
    if (!trimmedName) return;

    const themeConfig: SavedEditorTheme = {
      id: `custom-theme-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmedName,
      createdAt: new Date().toISOString(),
      colors: {
        background: normalizeHexColor(importedTheme.colors?.background || '', '#f4f5f7'),
        surface: normalizeHexColor(importedTheme.colors?.surface || '', '#ffffff'),
        surfaceVariant: normalizeHexColor(importedTheme.colors?.surfaceVariant || '', '#edf1f5'),
        primary: normalizeHexColor(importedTheme.colors?.primary || '', '#42a5f5'),
        secondary: normalizeHexColor(importedTheme.colors?.secondary || '', '#7e57c2')
      }
    };

    customEditorThemes.value.push(themeConfig);
    registerCustomEditorTheme(themeConfig);
    saveCustomEditorThemes();
    applyEditorTheme(themeConfig.id);
    themeImportPayload.value = '';
  } catch (error) {
    console.error('Error importing shared theme:', error);
  }
};

const getChatOverlayName = (rawText: string, overlayIndex: number) => {
  const firstLine = rawText
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    return `Chatlog ${overlayIndex + 1}`;
  }

  return firstLine.length > 32 ? `${firstLine.slice(0, 32)}...` : firstLine;
};

const cloneChatOverlay = (overlay: Partial<ChatOverlay>, index: number): ChatOverlay => ({
  id: overlay.id || createOverlayId(),
  name: overlay.name || getChatOverlayName(overlay.rawText || '', index),
  rawText: overlay.rawText || '',
  parsedLines: Array.isArray(overlay.parsedLines) ? overlay.parsedLines : parseChatText(overlay.rawText || ''),
  transform: {
    ...createDefaultChatTransform(),
    ...(overlay.transform || {})
  },
  censoredRegions: Array.isArray(overlay.censoredRegions) ? overlay.censoredRegions : [],
  manualColorRegions: Array.isArray(overlay.manualColorRegions) ? overlay.manualColorRegions : [],
  lineWidth: overlay.lineWidth || DEFAULT_CHAT_LINE_WIDTH,
  isHidden: overlay.isHidden ?? false,
  isLocked: overlay.isLocked ?? false
});

const createEditorSnapshot = (): EditorStateSnapshot => ({
  characterName: characterName.value,
  chatlogText: chatlogText.value,
  droppedImageSrc: droppedImageSrc.value,
  dropZoneWidth: dropZoneWidth.value || 800,
  dropZoneHeight: dropZoneHeight.value || 600,
  imageTransform: { ...imageTransform },
  imageOverlays: imageOverlays.value.map((overlay, index) => cloneImageOverlay(overlay, index)),
  activeImageOverlayId: activeImageOverlayId.value,
  imageEffects: imageEffects.value.map((effect) => cloneImageEffectLayer(effect)),
  chatOverlays: chatOverlays.value.map((overlay, index) => cloneChatOverlay(overlay, index)),
  activeChatOverlayId: activeChatOverlayId.value,
  isImageDraggingEnabled: isImageDraggingEnabled.value,
  isChatDraggingEnabled: isChatDraggingEnabled.value,
  showBlackBars: showBlackBars.value,
  selectedText: { ...selectedText },
  chatLineWidth: chatLineWidth.value
});

const toSerializableSnapshot = (snapshot: EditorStateSnapshot): EditorStateSnapshot =>
  JSON.parse(JSON.stringify(snapshot)) as EditorStateSnapshot;

const toPortableProjectFile = (project: ProjectRecord): PortableProjectFile => ({
  format: 'ssmag-project',
  version: 1,
  exportedAt: new Date().toISOString(),
  project: {
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    snapshot: toSerializableSnapshot(project.snapshot)
  }
});

const createComparableSnapshot = (snapshot: EditorStateSnapshot = createEditorSnapshot()) => {
  const comparableSnapshot = toSerializableSnapshot(snapshot);
  comparableSnapshot.selectedText = { ...DEFAULT_SELECTED_TEXT };
  return comparableSnapshot;
};

const getSnapshotSignature = (snapshot: EditorStateSnapshot = createEditorSnapshot()) =>
  JSON.stringify(createComparableSnapshot(snapshot));

const markCurrentStateAsSaved = (snapshot: EditorStateSnapshot = createEditorSnapshot()) => {
  lastSavedSnapshotSignature.value = getSnapshotSignature(snapshot);
};

const createHistoryEntry = (snapshot: EditorStateSnapshot = createEditorSnapshot()): EditorHistoryEntry => {
  const serializableSnapshot = toSerializableSnapshot(snapshot);

  return {
    signature: getSnapshotSignature(serializableSnapshot),
    snapshot: serializableSnapshot,
    currentProjectId: currentProjectId.value,
    currentProjectName: currentProjectName.value
  };
};

const resetHistoryState = (snapshot: EditorStateSnapshot = createEditorSnapshot()) => {
  if (historyCommitTimer) {
    clearTimeout(historyCommitTimer);
    historyCommitTimer = null;
  }

  const initialEntry = createHistoryEntry(snapshot);
  historyEntries.value = [initialEntry];
  historyIndex.value = 0;
};

const commitHistorySnapshot = (snapshot: EditorStateSnapshot = createEditorSnapshot()) => {
  const entry = createHistoryEntry(snapshot);
  const currentEntry = historyEntries.value[historyIndex.value];

  if (currentEntry?.signature === entry.signature) return;

  const nextEntries = historyEntries.value.slice(0, historyIndex.value + 1);
  nextEntries.push(entry);

  if (nextEntries.length > HISTORY_LIMIT) {
    nextEntries.shift();
  }

  historyEntries.value = nextEntries;
  historyIndex.value = nextEntries.length - 1;
};

const canUndo = computed(() => historyIndex.value > 0);
const canRedo = computed(() => historyIndex.value >= 0 && historyIndex.value < historyEntries.value.length - 1);

const hasUnsavedChanges = computed(() =>
  getSnapshotSignature() !== lastSavedSnapshotSignature.value
);

const applyHistoryEntry = (entry: EditorHistoryEntry) => {
  isApplyingHistoryState.value = true;
  applyEditorSnapshot(entry.snapshot);
  currentProjectId.value = entry.currentProjectId;
  currentProjectName.value = entry.currentProjectName;
  showUnsavedChangesDialog.value = false;
  pendingEditorAction.value = null;
  window.setTimeout(() => {
    isApplyingHistoryState.value = false;
  }, 0);
};

const undoEditorChange = () => {
  if (!canUndo.value) return;

  historyIndex.value -= 1;
  applyHistoryEntry(historyEntries.value[historyIndex.value]);
};

const redoEditorChange = () => {
  if (!canRedo.value) return;

  historyIndex.value += 1;
  applyHistoryEntry(historyEntries.value[historyIndex.value]);
};

const isEditableEventTarget = (target: EventTarget | null) =>
  target instanceof HTMLInputElement
  || target instanceof HTMLTextAreaElement
  || (target instanceof HTMLElement && target.isContentEditable);

const nudgeImage = (deltaX: number, deltaY: number) => {
  if (activeImageDragTarget.value === 'overlay') {
    if (!activeImageOverlay.value || activeImageOverlay.value.isLocked) return false;
    activeImageOverlay.value.transform.x += deltaX;
    activeImageOverlay.value.transform.y += deltaY;
    return true;
  }

  if (!droppedImageSrc.value) return false;

  imageTransform.x += deltaX;
  imageTransform.y += deltaY;
  return true;
};

const nudgeActiveChatOverlay = (deltaX: number, deltaY: number) => {
  if (!activeChatOverlay.value || activeChatOverlay.value.isLocked) return false;

  activeChatOverlay.value.transform.x += deltaX;
  activeChatOverlay.value.transform.y += deltaY;
  renderKey.value++;
  return true;
};

const zoomImage = (direction: 'in' | 'out') => {
  const scaleAmount = 0.1;
  const minScale = 0.1;
  const maxScale = 10;

  if (activeImageDragTarget.value === 'overlay') {
    if (!activeImageOverlay.value || activeImageOverlay.value.isLocked) return false;

    activeImageOverlay.value.transform.scale = direction === 'in'
      ? Math.min(maxScale, activeImageOverlay.value.transform.scale + scaleAmount)
      : Math.max(minScale, activeImageOverlay.value.transform.scale - scaleAmount);

    return true;
  }

  if (!droppedImageSrc.value) return false;

  imageTransform.scale = direction === 'in'
    ? Math.min(maxScale, imageTransform.scale + scaleAmount)
    : Math.max(minScale, imageTransform.scale - scaleAmount);

  return true;
};

const resetImageView = () => {
  imageTransform.x = 0;
  imageTransform.y = 0;
  imageTransform.scale = 1;
};

const recenterImageFromMinimap = (event: MouseEvent) => {
  if (!droppedImageSrc.value || !minimapRef.value) return;

  const bounds = minimapRef.value.getBoundingClientRect();
  const clickX = event.clientX - bounds.left;
  const clickY = event.clientY - bounds.top;
  const { width, height, offsetX, offsetY } = imageFitDimensions.value;
  const zoneWidth = dropZoneWidth.value || 800;
  const zoneHeight = dropZoneHeight.value || 600;
  const centerX = zoneWidth / 2;
  const centerY = zoneHeight / 2;

  const targetX = (clickX / bounds.width) * width;
  const targetY = (clickY / bounds.height) * height;

  imageTransform.x = -imageTransform.scale * ((offsetX + targetX) - centerX);
  imageTransform.y = -imageTransform.scale * ((offsetY + targetY) - centerY);
};

const zoomActiveChatOverlay = (direction: 'in' | 'out') => {
  if (!activeChatOverlay.value || activeChatOverlay.value.isLocked) return false;

  const scaleAmount = 0.1;
  const minScale = 0.1;
  const maxScale = 10;

  activeChatOverlay.value.transform.scale = direction === 'in'
    ? Math.min(maxScale, activeChatOverlay.value.transform.scale + scaleAmount)
    : Math.max(minScale, activeChatOverlay.value.transform.scale - scaleAmount);

  renderKey.value++;
  return true;
};

const clearSelectedFormatting = () => {
  if (selectedText.lineIndex === -1 || !activeChatOverlay.value) return false;

  const hasMatchingCensor = activeChatOverlay.value.censoredRegions.some((region) =>
    region.lineIndex === selectedText.lineIndex
    && region.startOffset < selectedText.endOffset
    && region.endOffset > selectedText.startOffset
  );

  const hasMatchingColorOverride = activeChatOverlay.value.manualColorRegions.some((region) =>
    region.lineIndex === selectedText.lineIndex
    && region.startOffset < selectedText.endOffset
    && region.endOffset > selectedText.startOffset
  );

  if (!hasMatchingCensor && !hasMatchingColorOverride) return false;

  clearCensorType();
  removeManualColorOverride();
  renderKey.value++;
  return true;
};

const openKeyboardShortcuts = () => {
  showKeyboardShortcutsDialog.value = true;
};

const handleEditorHistoryKeydown = (event: KeyboardEvent) => {
  const key = event.key.toLowerCase();
  const isEditableTarget = isEditableEventTarget(event.target);

  if (key === 'q') {
    isQBypassHeld.value = true;
  }

  if (!isEditableTarget && key === '?') {
    event.preventDefault();
    openKeyboardShortcuts();
    return;
  }

  if (event.ctrlKey || event.metaKey) {
    if (event.altKey) return;

    if (key === 's') {
      event.preventDefault();
      void saveCurrentProject();
      return;
    }

    if (isEditableTarget) return;

    const shouldRedo = key === 'y' || (key === 'z' && event.shiftKey);

    if (key !== 'z' && key !== 'y') return;

    event.preventDefault();

    if (shouldRedo) {
      redoEditorChange();
      return;
    }

    undoEditorChange();
    return;
  }

  if (isEditableTarget) return;

  const nudgeAmount = event.shiftKey ? 10 : 1;

  if (key === 'delete' || key === 'backspace') {
    if (!clearSelectedFormatting()) return;

    event.preventDefault();
    return;
  }

  if (key === 'arrowup' || key === 'arrowdown' || key === 'arrowleft' || key === 'arrowright') {
    let handled = false;

    if (isChatDraggingEnabled.value && activeChatOverlay.value) {
      if (key === 'arrowup') handled = nudgeActiveChatOverlay(0, -nudgeAmount);
      if (key === 'arrowdown') handled = nudgeActiveChatOverlay(0, nudgeAmount);
      if (key === 'arrowleft') handled = nudgeActiveChatOverlay(-nudgeAmount, 0);
      if (key === 'arrowright') handled = nudgeActiveChatOverlay(nudgeAmount, 0);
    } else if (isImageDraggingEnabled.value && droppedImageSrc.value) {
      if (key === 'arrowup') handled = nudgeImage(0, -nudgeAmount);
      if (key === 'arrowdown') handled = nudgeImage(0, nudgeAmount);
      if (key === 'arrowleft') handled = nudgeImage(-nudgeAmount, 0);
      if (key === 'arrowright') handled = nudgeImage(nudgeAmount, 0);
    }

    if (!handled) return;

    event.preventDefault();
    return;
  }

  const isZoomInKey = key === '+' || key === '=' || key === 'add';
  const isZoomOutKey = key === '-' || key === '_' || key === 'subtract';

  if (!isZoomInKey && !isZoomOutKey) return;

  let handled = false;
  const direction = isZoomInKey ? 'in' : 'out';

  if (isChatDraggingEnabled.value && activeChatOverlay.value) {
    handled = zoomActiveChatOverlay(direction);
  } else if (isImageDraggingEnabled.value && droppedImageSrc.value) {
    handled = zoomImage(direction);
  }

  if (!handled) return;

  event.preventDefault();
};

const handleEditorHistoryKeyup = (event: KeyboardEvent) => {
  if (event.key.toLowerCase() !== 'q') return;

  isQBypassHeld.value = false;
  isGuideBypassActive.value = false;
};

const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (!unsavedNavigationStore.shouldWarnBeforeLeaving) return;

  const message = unsavedNavigationStore.getBeforeUnloadMessage();
  event.preventDefault();
  event.returnValue = message;
};

const pendingActionDescription = computed(() => {
  if (!pendingEditorAction.value) return '';

  if (pendingEditorAction.value.type === 'load-project') {
    const targetProject = projectRecords.value.find((project) => project.id === pendingEditorAction.value?.projectId);
    return targetProject
      ? `open "${targetProject.name}"`
      : 'open another project';
  }

  return 'start a new session';
});

const isCompactToolbar = computed(() => viewportWidth.value < 1400);

const getAnalyticsContext = () => ({
  has_image: Boolean(droppedImageSrc.value),
  canvas_width: dropZoneWidth.value || 800,
  canvas_height: dropZoneHeight.value || 600,
  image_layers_count: imageOverlays.value.length,
  chat_layers_count: chatOverlays.value.filter((overlay) => overlay.parsedLines.length > 0).length,
  image_effects_count: imageEffects.value.length,
  line_width: chatLineWidth.value
});

const projectStatusMessage = computed(() => {
  if (autosaveState.value === 'saving') {
    return 'Autosaving locally...';
  }

  if (autosaveState.value === 'saved') {
    return 'Autosaved locally in this browser';
  }

  if (autosaveState.value === 'error') {
    return 'Autosave failed. Use Save Project to try again.';
  }

  if (hasUnsavedChanges.value) {
    return currentProjectId.value
      ? 'You have unsaved changes. Autosave will update this project shortly.'
      : 'You have unsaved changes.';
  }

  return currentProjectId.value
    ? 'Saved locally in this browser'
    : 'Use Save Project to keep this work for later';
});

const applyEditorSnapshot = (snapshot: Partial<EditorStateSnapshot>) => {
  imageOverlays.value.forEach((overlay) => clearImageOverlayRuntimeState(overlay.id));
  characterName.value = snapshot.characterName || '';
  chatlogText.value = snapshot.chatlogText || '';
  droppedImageSrc.value = snapshot.droppedImageSrc || null;
  dropZoneWidth.value = snapshot.dropZoneWidth || 800;
  dropZoneHeight.value = snapshot.dropZoneHeight || 600;
  Object.assign(imageTransform, snapshot.imageTransform || { x: 0, y: 0, scale: 1 });
  imageOverlays.value = Array.isArray(snapshot.imageOverlays)
    ? snapshot.imageOverlays
      .filter((overlay) => typeof overlay?.src === 'string' && overlay.src.length > 0)
      .map((overlay, index) => cloneImageOverlay(overlay, index))
    : [];
  activeImageOverlayId.value = snapshot.activeImageOverlayId || null;
  activeImageDragTarget.value = activeImageOverlayId.value ? 'overlay' : 'base';
  imageEffects.value = Array.isArray(snapshot.imageEffects)
    ? snapshot.imageEffects.map((effect) => cloneImageEffectLayer(effect))
    : [];
  isImageDraggingEnabled.value = snapshot.isImageDraggingEnabled || false;
  isChatDraggingEnabled.value = snapshot.isChatDraggingEnabled || false;
  showBlackBars.value = snapshot.showBlackBars || false;
  Object.assign(selectedText, snapshot.selectedText || DEFAULT_SELECTED_TEXT);
  chatLineWidth.value = snapshot.chatLineWidth || DEFAULT_CHAT_LINE_WIDTH;
  chatOverlays.value = Array.isArray(snapshot.chatOverlays)
    ? snapshot.chatOverlays.map((overlay, index) => cloneChatOverlay(overlay, index))
    : [];
  activeChatOverlayId.value = snapshot.activeChatOverlayId || chatOverlays.value[0]?.id || null;
  syncEditorFromActiveOverlay();
  syncImageOverlayRuntimeState();
  renderKey.value++;
  void nextTick(() => {
    renderAllImageOverlayCanvases();
  });
};

const openProjectsDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(PROJECTS_DB_NAME, PROJECTS_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECTS_STORE_NAME)) {
        db.createObjectStore(PROJECTS_STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const getProjectStore = async (mode: IDBTransactionMode) => {
  const db = await openProjectsDb();
  const transaction = db.transaction(PROJECTS_STORE_NAME, mode);
  const store = transaction.objectStore(PROJECTS_STORE_NAME);
  return { db, transaction, store };
};

const listStoredProjects = async () =>
  new Promise<ProjectRecord[]>(async (resolve, reject) => {
    try {
      const { db, transaction, store } = await getProjectStore('readonly');
      const request = store.getAll();

      request.onsuccess = () => {
        db.close();
        resolve((request.result as ProjectRecord[]).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)));
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    } catch (error) {
      reject(error);
    }
  });

const saveStoredProject = async (project: ProjectRecord) =>
  new Promise<void>(async (resolve, reject) => {
    try {
      const { db, transaction, store } = await getProjectStore('readwrite');
      const request = store.put(project);

      request.onsuccess = () => {
        db.close();
        resolve();
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    } catch (error) {
      reject(error);
    }
  });

const loadStoredProject = async (projectId: string) =>
  new Promise<ProjectRecord | undefined>(async (resolve, reject) => {
    try {
      const { db, transaction, store } = await getProjectStore('readonly');
      const request = store.get(projectId);

      request.onsuccess = () => {
        db.close();
        resolve(request.result as ProjectRecord | undefined);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    } catch (error) {
      reject(error);
    }
  });

const deleteStoredProject = async (projectId: string) =>
  new Promise<void>(async (resolve, reject) => {
    try {
      const { db, transaction, store } = await getProjectStore('readwrite');
      const request = store.delete(projectId);

      request.onsuccess = () => {
        db.close();
        resolve();
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    } catch (error) {
      reject(error);
    }
  });

const refreshProjectList = async () => {
  isProjectsLoading.value = true;

  try {
    const projects = await listStoredProjects();
    projectRecords.value = projects.map(({ id, name, createdAt, updatedAt }) => ({ id, name, createdAt, updatedAt }));
  } catch (error) {
    console.error('Error loading projects:', error);
  } finally {
    isProjectsLoading.value = false;
  }
};

const clearChatlog = () => {
  chatlogText.value = '';
  selectedText.lineIndex = -1;
  selectedText.startOffset = 0;
  selectedText.endOffset = 0;
  selectedText.text = '';
};

const TIMESTAMP_PREFIX_PATTERN = /^\[\d{2}:\d{2}:\d{2}\]\s*/;

const stripTimestampPrefix = (line: string) =>
  line.replace(TIMESTAMP_PREFIX_PATTERN, '');

const getTimestampPrefixLength = (line: string) => {
  const timestampMatch = line.match(TIMESTAMP_PREFIX_PATTERN);
  return timestampMatch ? timestampMatch[0].length : 0;
};

const parseChatText = (rawText: string) => {
  const lines = rawText.split('\n').filter(line => line.trim() !== '');

  return lines.map((line, index) => {
    return {
      id: index,
      text: stripTimestampPrefix(line)
    };
  });
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

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

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
  selectedText.lineIndex = -1;
  selectedText.startOffset = 0;
  selectedText.endOffset = 0;
  selectedText.text = '';
};

const startNewChatLayer = () => {
  activeChatOverlayId.value = null;
  chatlogText.value = '';
  chatLineWidth.value = DEFAULT_CHAT_LINE_WIDTH;
  selectedText.lineIndex = -1;
  selectedText.startOffset = 0;
  selectedText.endOffset = 0;
  selectedText.text = '';
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

const duplicateChatOverlay = (overlayId: string) => {
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

  if (overlay.isLocked && isChatPanning.value && activeChatOverlayId.value === overlayId) {
    handleChatMouseUpOrLeave();
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

// --- File Handling Methods ---

// Trigger click on hidden file input when the import button is clicked
const triggerFileInput = () => {
  if (fileInputRef.value) {
    fileInputRef.value.click();
  }
};

const triggerImageOverlayInput = () => {
  if (imageOverlayInputRef.value) {
    imageOverlayInputRef.value.click();
  }
};

const setBaseImageFromDataUrl = (src: string) => {
  droppedImageSrc.value = src;
  imageTransform.x = 0;
  imageTransform.y = 0;
  imageTransform.scale = 1;
  selectImageOverlay(null);
};

const addImageOverlayFromFile = async (file: File, src: string) => {
  const overlayIndex = imageOverlays.value.length;
  const overlayMetrics = await new Promise<{ x: number; y: number; scale: number; width: number; height: number }>((resolve) => {
    const overlayImage = new Image();
    overlayImage.onload = () => {
      resolve({
        ...getInitialImageOverlayPlacement(overlayImage.naturalWidth, overlayImage.naturalHeight, overlayIndex),
        width: overlayImage.naturalWidth,
        height: overlayImage.naturalHeight
      });
    };
    overlayImage.onerror = () => {
      resolve({
        ...getInitialImageOverlayPlacement(0, 0, overlayIndex),
        width: 0,
        height: 0
      });
    };
    overlayImage.src = src;
  });

  const overlay = cloneImageOverlay({
    id: createImageOverlayId(),
    name: file.name.replace(/\.[^.]+$/, ''),
    src,
    sourceWidth: overlayMetrics.width,
    sourceHeight: overlayMetrics.height,
    maskDataUrl: null,
    transform: {
      x: overlayMetrics.x,
      y: overlayMetrics.y,
      scale: overlayMetrics.scale
    },
    opacity: 1,
    acceptsEffects: true,
    isHidden: false,
    isLocked: false
  }, overlayIndex);

  imageOverlays.value.push(overlay);
  selectImageOverlay(overlay.id);
  isImageDraggingEnabled.value = true;
  isChatDraggingEnabled.value = false;
  imageOverlayTool.value = 'move';

  trackEvent('import_image_overlay', {
    file_extension: file.name.split('.').pop()?.toLowerCase() || 'unknown',
    mime_type: file.type || 'unknown',
    overlay_layers_count: imageOverlays.value.length,
    ...getAnalyticsContext()
  });
};

// Handle image file selection from file picker
const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  
  if (files && files.length > 0) {
    const file = files[0];
    
    // Basic image type validation
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setBaseImageFromDataUrl(e.target?.result as string);
        trackEvent('import_image', {
          file_extension: file.name.split('.').pop()?.toLowerCase() || 'unknown',
          mime_type: file.type || 'unknown',
          ...getAnalyticsContext()
        });
      };
      reader.readAsDataURL(file);
    } else {
      console.warn('Selected file is not an image.');
      // Optionally show an error message to the user
    }
    
    // Reset the input so the same file can be selected again
    target.value = '';
  }
};

const handleImageOverlayFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const files = target.files;

  if (files && files.length > 0) {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        console.warn('Selected overlay file is not an image.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        addImageOverlayFromFile(file, e.target?.result as string);
      };
      reader.readAsDataURL(file);
    });

    target.value = '';
  }
};

// Handle chatlog file selection
const handleChatFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  
  if (files && files.length > 0) {
    const file = files[0];
    
    // Basic text file validation
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      try {
        const text = await file.text(); // Read file as text
        startNewChatLayer();
        chatlogText.value = text; // Set the textarea content
        trackEvent('import_chatlog', {
          file_extension: file.name.split('.').pop()?.toLowerCase() || 'txt',
          characters_count: text.length,
          line_breaks_count: text.split('\n').length,
          ...getAnalyticsContext()
        });
        parseChatlog(); // Automatically parse the imported chat
      } catch (error) {
        console.error('Error reading chat file:', error);
        // Optionally show an error message to the user
      }
    } else {
      console.warn('Selected file is not a text file.');
      // Optionally show an error message to the user
    }
    
    // Reset the input so the same file can be selected again
    target.value = '';
  }
};

// Trigger chat file input
const triggerChatFileInput = () => {
  if (chatFileInputRef.value) {
    chatFileInputRef.value.click();
  }
};

const triggerProjectFileInput = () => {
  if (projectFileInputRef.value) {
    projectFileInputRef.value.click();
  }
};

const exportProjectFile = async (projectId: string) => {
  try {
    const project = await loadStoredProject(projectId);
    if (!project) return;

    const portableProject = toPortableProjectFile(project);
    const projectSlug = project.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'screenshot-magician-project';
    const blob = new Blob([JSON.stringify(portableProject, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectSlug}.ssmag`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting project file:', error);
  }
};

const handleProjectFileImport = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const files = target.files;

  if (!files || files.length === 0) {
    target.value = '';
    return;
  }

  const file = files[0];

  try {
    const rawText = await file.text();
    const importedFile = JSON.parse(rawText) as Partial<PortableProjectFile>;

    if (
      importedFile.format !== 'ssmag-project'
      || importedFile.version !== 1
      || !importedFile.project
      || !importedFile.project.snapshot
    ) {
      throw new Error('Unsupported project file format.');
    }

    const importedProject: ProjectRecord = {
      id: createProjectId(),
      name: importedFile.project.name?.trim() || file.name.replace(/\.ssmag$/i, '') || 'Imported Project',
      createdAt: importedFile.project.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      snapshot: toSerializableSnapshot(importedFile.project.snapshot as EditorStateSnapshot)
    };

    await saveStoredProject(importedProject);
    await refreshProjectList();
  } catch (error) {
    console.error('Error importing project file:', error);
  } finally {
    target.value = '';
  }
};

// --- Drag and Drop Handlers ---
const handleDragOver = (event: DragEvent) => {
  event.preventDefault(); // Prevent default behavior
  isDraggingOverDropZone.value = true;
};

const handleDragLeave = () => {
  isDraggingOverDropZone.value = false;
};

const getCanvasInteractionScale = () => {
  const scale = isScaledDown.value ? dropzoneScale.value : 1;
  return scale > 0 ? scale : 1;
};

const clearSmartGuides = () => {
  smartGuideLines.value = [];
  smartGuideLabels.value = [];
};

const beginCapturedCanvasDrag = (
  event: PointerEvent,
  moveHandler: (event: PointerEvent) => void,
  endHandler: (event?: PointerEvent) => void
) => {
  const target = event.currentTarget;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  activeCanvasDragCleanup?.();

  const pointerId = event.pointerId;
  const cleanup = () => {
    window.removeEventListener('pointermove', handlePointerMove, true);
    window.removeEventListener('pointerup', handlePointerEnd, true);
    window.removeEventListener('pointercancel', handlePointerEnd, true);
    target.removeEventListener('lostpointercapture', handleLostPointerCapture);

    if (target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId);
    }

    if (activeCanvasDragCleanup === cleanup) {
      activeCanvasDragCleanup = null;
    }
  };

  const handlePointerMove = (pointerEvent: PointerEvent) => {
    if (pointerEvent.pointerId !== pointerId) return;
    moveHandler(pointerEvent);
  };

  const handlePointerEnd = (pointerEvent: PointerEvent) => {
    if (pointerEvent.pointerId !== pointerId) return;
    cleanup();
    endHandler(pointerEvent);
  };

  const handleLostPointerCapture = () => {
    cleanup();
    endHandler();
  };

  target.setPointerCapture(pointerId);
  window.addEventListener('pointermove', handlePointerMove, true);
  window.addEventListener('pointerup', handlePointerEnd, true);
  window.addEventListener('pointercancel', handlePointerEnd, true);
  target.addEventListener('lostpointercapture', handleLostPointerCapture);
  activeCanvasDragCleanup = cleanup;
};

const createGuideBounds = (left: number, top: number, width: number, height: number): GuideBounds => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
  centerX: left + (width / 2),
  centerY: top + (height / 2),
  width,
  height
});

const getImageOverlayGuideBounds = (
  overlay: ImageOverlay,
  element: HTMLElement,
  x: number = overlay.transform.x,
  y: number = overlay.transform.y
) => {
  const width = element.offsetWidth * overlay.transform.scale;
  const height = element.offsetHeight * overlay.transform.scale;
  return createGuideBounds(x, y, width, height);
};

const getChatOverlayGuideBounds = (
  overlay: ChatOverlay,
  element: HTMLElement,
  x: number = overlay.transform.x,
  y: number = overlay.transform.y
) => {
  const width = element.offsetWidth * overlay.transform.scale;
  const height = element.offsetHeight * overlay.transform.scale;
  return createGuideBounds(x, y, width, height);
};

const collectSmartGuideBounds = (
  draggingType: 'chat' | 'image',
  draggingId: string
) => {
  const bounds: GuideBounds[] = [];

  imageOverlays.value.forEach((overlay) => {
    if (overlay.id === draggingId && draggingType === 'image') return;
    if (overlay.isHidden) return;

    const element = imageOverlayElementMap.get(overlay.id);
    if (!element) return;

    bounds.push(getImageOverlayGuideBounds(overlay, element));
  });

  chatOverlays.value.forEach((overlay) => {
    if (overlay.id === draggingId && draggingType === 'chat') return;
    if (overlay.isHidden || overlay.parsedLines.length === 0) return;

    const element = chatOverlayElementMap.get(overlay.id);
    if (!element) return;

    bounds.push(getChatOverlayGuideBounds(overlay, element));
  });

  return bounds;
};

const getBestAxisSnap = (
  movingPoints: number[],
  targets: number[]
): AxisSnap | null => {
  let bestDelta = Number.POSITIVE_INFINITY;
  let bestTarget: number | null = null;

  movingPoints.forEach((point) => {
    targets.forEach((target) => {
      const delta = target - point;
      if (Math.abs(delta) <= smartGuideStrength.value && Math.abs(delta) < Math.abs(bestDelta)) {
        bestDelta = delta;
        bestTarget = target;
      }
    });
  });

  if (bestTarget === null || !Number.isFinite(bestDelta)) {
    return null;
  }

  return {
    delta: bestDelta,
    target: bestTarget
  };
};

const rangesOverlap = (startA: number, endA: number, startB: number, endB: number) =>
  Math.min(endA, endB) - Math.max(startA, startB) > 0;

const getSpacingSnap = (
  proposedBounds: GuideBounds,
  stationaryBounds: GuideBounds[],
  axis: 'horizontal' | 'vertical'
): SpacingSnap | null => {
  let bestMatch: SpacingSnap | null = null;

  stationaryBounds.forEach((before) => {
    stationaryBounds.forEach((after) => {
      if (before === after) return;

      if (axis === 'horizontal') {
        if (before.right > proposedBounds.left || after.left < proposedBounds.right) return;
        if (!rangesOverlap(before.top, before.bottom, proposedBounds.top, proposedBounds.bottom)) return;
        if (!rangesOverlap(after.top, after.bottom, proposedBounds.top, proposedBounds.bottom)) return;

        const targetX = (before.right + after.left - proposedBounds.width) / 2;
        const delta = targetX - proposedBounds.left;
        if (Math.abs(delta) > smartGuideStrength.value) return;

        const gap = targetX - before.right;
        if (!bestMatch || Math.abs(delta) < Math.abs(bestMatch.delta)) {
          bestMatch = { delta, gap, before, after };
        }
        return;
      }

      if (before.bottom > proposedBounds.top || after.top < proposedBounds.bottom) return;
      if (!rangesOverlap(before.left, before.right, proposedBounds.left, proposedBounds.right)) return;
      if (!rangesOverlap(after.left, after.right, proposedBounds.left, proposedBounds.right)) return;

      const targetY = (before.bottom + after.top - proposedBounds.height) / 2;
      const delta = targetY - proposedBounds.top;
      if (Math.abs(delta) > smartGuideStrength.value) return;

      const gap = targetY - before.bottom;
      if (!bestMatch || Math.abs(delta) < Math.abs(bestMatch.delta)) {
        bestMatch = { delta, gap, before, after };
      }
    });
  });

  return bestMatch;
};

const applySmartGuides = (
  draggingType: 'chat' | 'image',
  draggingId: string,
  proposedBounds: GuideBounds,
  bypassSnapping = false
) => {
  if (bypassSnapping || !smartGuidesEnabled.value) {
    clearSmartGuides();
    return {
      x: proposedBounds.left,
      y: proposedBounds.top
    };
  }

  const stationaryBounds = collectSmartGuideBounds(draggingType, draggingId);
  const verticalTargets = [0, (dropZoneWidth.value || 800) / 2, dropZoneWidth.value || 800];
  const horizontalTargets = [0, (dropZoneHeight.value || 600) / 2, dropZoneHeight.value || 600];

  stationaryBounds.forEach((bounds) => {
    verticalTargets.push(bounds.left, bounds.centerX, bounds.right);
    horizontalTargets.push(bounds.top, bounds.centerY, bounds.bottom);
  });

  const verticalSnap = getBestAxisSnap(
    [proposedBounds.left, proposedBounds.centerX, proposedBounds.right],
    verticalTargets
  );
  const horizontalSnap = getBestAxisSnap(
    [proposedBounds.top, proposedBounds.centerY, proposedBounds.bottom],
    horizontalTargets
  );
  const horizontalSpacingSnap = getSpacingSnap(proposedBounds, stationaryBounds, 'horizontal');
  const verticalSpacingSnap = getSpacingSnap(proposedBounds, stationaryBounds, 'vertical');

  const resolvedX = proposedBounds.left
    + (horizontalSpacingSnap?.delta ?? verticalSnap?.delta ?? 0);
  const resolvedY = proposedBounds.top
    + (verticalSpacingSnap?.delta ?? horizontalSnap?.delta ?? 0);

  const nextLines: SmartGuideLine[] = [];
  const nextLabels: SmartGuideLabel[] = [];
  if (verticalSnap) {
    nextLines.push({
      kind: 'alignment',
      orientation: 'vertical',
      position: verticalSnap.target,
      start: 0,
      end: dropZoneHeight.value || 600
    });
  }
  if (horizontalSnap) {
    nextLines.push({
      kind: 'alignment',
      orientation: 'horizontal',
      position: horizontalSnap.target,
      start: 0,
      end: dropZoneWidth.value || 800
    });
  }
  if (horizontalSpacingSnap) {
    const spacingY = proposedBounds.centerY + (verticalSpacingSnap?.delta ?? 0);
    const leftX = horizontalSpacingSnap.before.right;
    const snappedLeft = resolvedX;
    const snappedRight = resolvedX + proposedBounds.width;
    const rightX = horizontalSpacingSnap.after.left;

    nextLines.push({
      kind: 'spacing',
      orientation: 'horizontal',
      position: spacingY,
      start: leftX,
      end: snappedLeft
    });
    nextLines.push({
      kind: 'spacing',
      orientation: 'horizontal',
      position: spacingY,
      start: snappedRight,
      end: rightX
    });
    nextLabels.push({
      text: `${Math.round(horizontalSpacingSnap.gap)} px`,
      x: (leftX + snappedLeft) / 2,
      y: spacingY - 12
    });
    nextLabels.push({
      text: `${Math.round(horizontalSpacingSnap.gap)} px`,
      x: (snappedRight + rightX) / 2,
      y: spacingY - 12
    });
  }
  if (verticalSpacingSnap) {
    const spacingX = proposedBounds.centerX + (horizontalSpacingSnap?.delta ?? verticalSnap?.delta ?? 0);
    const topY = verticalSpacingSnap.before.bottom;
    const snappedTop = resolvedY;
    const snappedBottom = resolvedY + proposedBounds.height;
    const bottomY = verticalSpacingSnap.after.top;

    nextLines.push({
      kind: 'spacing',
      orientation: 'vertical',
      position: spacingX,
      start: topY,
      end: snappedTop
    });
    nextLines.push({
      kind: 'spacing',
      orientation: 'vertical',
      position: spacingX,
      start: snappedBottom,
      end: bottomY
    });
    nextLabels.push({
      text: `${Math.round(verticalSpacingSnap.gap)} px`,
      x: spacingX + 10,
      y: (topY + snappedTop) / 2
    });
    nextLabels.push({
      text: `${Math.round(verticalSpacingSnap.gap)} px`,
      x: spacingX + 10,
      y: (snappedBottom + bottomY) / 2
    });
  }
  smartGuideLines.value = nextLines;
  smartGuideLabels.value = nextLabels;

  return {
    x: resolvedX,
    y: resolvedY
  };
};

const setImageOverlayElement = (overlayId: string, element: TemplateRefElement) => {
  if (element instanceof HTMLCanvasElement) {
    imageOverlayElementMap.set(overlayId, element);
    void renderImageOverlayCanvas(overlayId);
    return;
  }

  imageOverlayElementMap.delete(overlayId);
};

const setChatOverlayElement = (overlayId: string, element: TemplateRefElement) => {
  if (element instanceof HTMLElement) {
    chatOverlayElementMap.set(overlayId, element);
    return;
  }

  chatOverlayElementMap.delete(overlayId);
};

const buildImageTransform = (x: number, y: number, scale: number) =>
  `translate(${x}px, ${y}px) scale(${scale})`;

const applyImmediateImageDragPosition = () => {
  if (activeImageDragTarget.value === 'overlay' && activeImageOverlayId.value) {
    const element = imageOverlayElementMap.get(activeImageOverlayId.value);
    const overlay = activeImageOverlay.value;
    if (element && overlay) {
      element.style.transform = buildImageTransform(
        pendingImageDragPosition.x,
        pendingImageDragPosition.y,
        overlay.transform.scale
      );
    }
    return;
  }

  if (imageElementRef.value) {
    imageElementRef.value.style.transform = buildImageTransform(
      pendingImageDragPosition.x,
      pendingImageDragPosition.y,
      imageTransform.scale
    );
  }
};

const scheduleImmediateImageDragPosition = () => {
  if (typeof window === 'undefined') return;
  if (imageDragAnimationFrame !== null) return;

  imageDragAnimationFrame = window.requestAnimationFrame(() => {
    imageDragAnimationFrame = null;
    applyImmediateImageDragPosition();
  });
};

const buildChatTransform = (x: number, y: number, scale: number) =>
  `translate(${x}px, ${y}px) scale(${scale})`;

const applyImmediateChatDragPosition = () => {
  if (!activeChatOverlayId.value || !activeChatOverlay.value) return;

  const element = chatOverlayElementMap.get(activeChatOverlayId.value);
  if (!element) return;

  element.style.transform = buildChatTransform(
    pendingChatDragPosition.x,
    pendingChatDragPosition.y,
    activeChatOverlay.value.transform.scale
  );
};

const scheduleImmediateChatDragPosition = () => {
  if (typeof window === 'undefined') return;
  if (chatDragAnimationFrame !== null) return;

  chatDragAnimationFrame = window.requestAnimationFrame(() => {
    chatDragAnimationFrame = null;
    applyImmediateChatDragPosition();
  });
};

const handleDrop = (event: DragEvent) => {
  event.preventDefault();
  isDraggingOverDropZone.value = false;

  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    const file = files[0];
    // Basic image type validation
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (!droppedImageSrc.value) {
          setBaseImageFromDataUrl(e.target?.result as string);
          trackEvent('import_image', {
            file_extension: file.name.split('.').pop()?.toLowerCase() || 'unknown',
            mime_type: file.type || 'unknown',
            ...getAnalyticsContext()
          });
          return;
        }

        addImageOverlayFromFile(file, e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      console.warn('Dropped file is not an image.');
      // Optionally show an error message to the user
    }
  }
};

// --- Image Panning Handlers ---
const handleImageMouseDown = (event: PointerEvent) => {
  if (!isImageDraggingEnabled.value || !droppedImageSrc.value) return;
  if (activeImageOverlayId.value !== null) return;
  selectImageOverlay(null);
  event.preventDefault();
  isPanning.value = true;
  panStart.x = event.clientX;
  panStart.y = event.clientY;
  panStartImagePos.x = imageTransform.x;
  panStartImagePos.y = imageTransform.y;
  pendingImageDragPosition.x = imageTransform.x;
  pendingImageDragPosition.y = imageTransform.y;
  document.body.style.userSelect = 'none';
  beginCapturedCanvasDrag(event, handleImageMouseMove, handleImageMouseUpOrLeave);
};

const handleImageMouseMove = (event: PointerEvent) => {
  if (!isPanning.value) return;
  const interactionScale = getCanvasInteractionScale();
  const deltaX = (event.clientX - panStart.x) / interactionScale;
  const deltaY = (event.clientY - panStart.y) / interactionScale;

  if (activeImageDragTarget.value === 'overlay' && activeImageOverlay.value) {
    const element = imageOverlayElementMap.get(activeImageOverlay.value.id);
    const proposedX = panStartImagePos.x + deltaX;
    const proposedY = panStartImagePos.y + deltaY;

    if (element) {
      const snappedPosition = applySmartGuides(
        'image',
        activeImageOverlay.value.id,
        getImageOverlayGuideBounds(activeImageOverlay.value, element, proposedX, proposedY),
        isGuideBypassActive.value
      );
      pendingImageDragPosition.x = snappedPosition.x;
      pendingImageDragPosition.y = snappedPosition.y;
    } else {
      clearSmartGuides();
      pendingImageDragPosition.x = proposedX;
      pendingImageDragPosition.y = proposedY;
    }

    scheduleImmediateImageDragPosition();
    return;
  }

  clearSmartGuides();
  pendingImageDragPosition.x = panStartImagePos.x + deltaX;
  pendingImageDragPosition.y = panStartImagePos.y + deltaY;
  scheduleImmediateImageDragPosition();
};

const handleImageMouseUpOrLeave = () => {
  if (isPanning.value) {
    if (activeImageDragTarget.value === 'overlay' && activeImageOverlay.value) {
      activeImageOverlay.value.transform.x = pendingImageDragPosition.x;
      activeImageOverlay.value.transform.y = pendingImageDragPosition.y;
    } else {
      imageTransform.x = pendingImageDragPosition.x;
      imageTransform.y = pendingImageDragPosition.y;
    }

    isPanning.value = false;
    document.body.style.userSelect = ''; // Re-enable text selection
  }

  clearSmartGuides();

  if (imageDragAnimationFrame !== null) {
    window.cancelAnimationFrame(imageDragAnimationFrame);
    imageDragAnimationFrame = null;
  }

};

// --- Image Zoom Handler ---
const handleWheel = (event: WheelEvent) => {
  if (!isImageDraggingEnabled.value || !droppedImageSrc.value) return;
  if (activeImageOverlayId.value !== null) {
    event.preventDefault();
    return;
  }
  event.preventDefault();
  const scaleAmount = 0.1;
  const minScale = 0.1;
  const maxScale = 10;

  if (event.deltaY < 0) {
    // Zoom in
    imageTransform.scale = Math.min(maxScale, imageTransform.scale + scaleAmount);
  } else {
    // Zoom out
    imageTransform.scale = Math.max(minScale, imageTransform.scale - scaleAmount);
  }
};

// --- Toolbar Button Handlers ---
const toggleImageDrag = () => {
  isImageDraggingEnabled.value = !isImageDraggingEnabled.value;
  if (isImageDraggingEnabled.value) {
    imageOverlayTool.value = 'move';
  }
  if (isImageDraggingEnabled.value && isChatDraggingEnabled.value) {
    isChatDraggingEnabled.value = false; // Disable chat drag if enabling image drag
  }

  if (!isImageDraggingEnabled.value && isPanning.value) {
    handleImageMouseUpOrLeave();
  }
};

const enableImageDragFromCanvas = (event: MouseEvent) => {
  if (!droppedImageSrc.value) return;

  event.preventDefault();
  event.stopPropagation();
  selectImageOverlay(null);
  imageOverlayTool.value = 'move';
  isImageDraggingEnabled.value = true;
  isChatDraggingEnabled.value = false;
};

const handleImageOverlayMaskPointerMove = (event: PointerEvent) => {
  const overlayId = activeImageMaskOverlayId.value;
  if (!overlayId) return;

  const overlay = imageOverlays.value.find((item) => item.id === overlayId);
  const element = imageOverlayElementMap.get(overlayId);
  if (!overlay || !(element instanceof HTMLCanvasElement)) {
    finishImageOverlayMaskPainting();
    hideImageMaskBrushPreview();
    return;
  }

  const point = getImageOverlayCanvasPoint(element, event.clientX, event.clientY);
  if (!point) {
    hideImageMaskBrushPreview();
    return;
  }

  paintImageOverlayMaskSegment(
    overlay,
    ensureImageOverlayMaskCanvas(overlay, element.width, element.height),
    imageMaskPaintLastPoint.x,
    imageMaskPaintLastPoint.y,
    point.x,
    point.y
  );

  imageMaskPaintLastPoint.x = point.x;
  imageMaskPaintLastPoint.y = point.y;
  updateImageMaskBrushPreview(overlay, point.zoneX, point.zoneY);
};

const startImageOverlayMaskPainting = (event: PointerEvent, overlay: ImageOverlay) => {
  const element = imageOverlayElementMap.get(overlay.id);
  if (!(element instanceof HTMLCanvasElement)) {
    return;
  }

  const point = getImageOverlayCanvasPoint(element, event.clientX, event.clientY);
  if (!point) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  activeImageMaskOverlayId.value = overlay.id;
  isImageMaskPainting.value = true;
  imageMaskPaintLastPoint.x = point.x;
  imageMaskPaintLastPoint.y = point.y;
  updateImageMaskBrushPreview(overlay, point.zoneX, point.zoneY);

  paintImageOverlayMaskSegment(
    overlay,
    ensureImageOverlayMaskCanvas(overlay, element.width, element.height),
    point.x,
    point.y,
    point.x,
    point.y
  );

  beginCapturedCanvasDrag(event, handleImageOverlayMaskPointerMove, () => {
    finishImageOverlayMaskPainting();
    hideImageMaskBrushPreview();
  });
};

const handleImageOverlayPointerMove = (event: PointerEvent, overlayId: string) => {
  const overlay = imageOverlays.value.find((item) => item.id === overlayId);
  const element = imageOverlayElementMap.get(overlayId);
  if (!overlay || !(element instanceof HTMLCanvasElement)) {
    hideImageMaskBrushPreview();
    return;
  }

  if (!isImageOverlayBrushActive.value || activeImageOverlayId.value !== overlayId || overlay.isLocked) {
    hideImageMaskBrushPreview();
    return;
  }

  const point = getImageOverlayCanvasPoint(element, event.clientX, event.clientY);
  if (!point) {
    hideImageMaskBrushPreview();
    return;
  }

  updateImageMaskBrushPreview(overlay, point.zoneX, point.zoneY);
};

const handleImageOverlayPointerLeave = (overlayId: string) => {
  if (activeImageMaskOverlayId.value === overlayId && isImageMaskPainting.value) {
    return;
  }

  hideImageMaskBrushPreview();
};

const handleImageOverlayMouseDown = (event: PointerEvent, overlayId: string) => {
  const overlay = imageOverlays.value.find((item) => item.id === overlayId);
  if (!overlay) return;

  if (activeImageOverlayId.value !== overlayId) {
    return;
  }

  if (isImageOverlayBrushActive.value) {
    if (overlay.isLocked) return;
    startImageOverlayMaskPainting(event, overlay);
    return;
  }

  if (overlay.isLocked || !isImageDraggingEnabled.value) return;

  event.preventDefault();
  event.stopPropagation();
  isPanning.value = true;
  panStart.x = event.clientX;
  panStart.y = event.clientY;
  panStartImagePos.x = overlay.transform.x;
  panStartImagePos.y = overlay.transform.y;
  pendingImageDragPosition.x = overlay.transform.x;
  pendingImageDragPosition.y = overlay.transform.y;
  isGuideBypassActive.value = isQBypassHeld.value;
  document.body.style.userSelect = 'none';
  beginCapturedCanvasDrag(event, handleImageMouseMove, handleImageMouseUpOrLeave);
};

const enableImageOverlayDragFromCanvas = (event: MouseEvent, overlayId: string) => {
  const overlay = imageOverlays.value.find((item) => item.id === overlayId);
  if (!overlay || overlay.isLocked) return;

  event.preventDefault();
  event.stopPropagation();
  selectImageOverlay(overlayId);
  imageOverlayTool.value = 'move';
  isImageDraggingEnabled.value = true;
  isChatDraggingEnabled.value = false;
};

const handleImageOverlayWheel = (event: WheelEvent, overlayId: string) => {
  const overlay = imageOverlays.value.find((item) => item.id === overlayId);
  if (!overlay) return;

  event.preventDefault();
  event.stopPropagation();

  if (isImageOverlayBrushActive.value && activeImageOverlayId.value === overlayId) {
    imageMaskBrushSize.value = clampImageMaskBrushSize(
      imageMaskBrushSize.value + (event.deltaY < 0 ? 14 : -14)
    );
    const element = imageOverlayElementMap.get(overlayId);
    if (element instanceof HTMLCanvasElement) {
      const point = getImageOverlayCanvasPoint(element, event.clientX, event.clientY);
      if (point) {
        updateImageMaskBrushPreview(overlay, point.zoneX, point.zoneY);
      }
    }
    return;
  }

  if (!isImageDraggingEnabled.value) return;

  if (overlay.isLocked || activeImageOverlayId.value !== overlayId) {
    return;
  }

  const scaleAmount = 0.1;
  const minScale = 0.1;
  const maxScale = 10;

  overlay.transform.scale = event.deltaY < 0
    ? Math.min(maxScale, overlay.transform.scale + scaleAmount)
    : Math.max(minScale, overlay.transform.scale - scaleAmount);
};

// --- Chat Dragging Handlers ---
const handleChatMouseDown = (event: PointerEvent, overlayId: string) => {
  selectChatOverlay(overlayId);

  const overlay = chatOverlays.value.find((item) => item.id === overlayId);
  if (!overlay || overlay.parsedLines.length === 0) return;

  event.stopPropagation();

  if (overlay.isLocked || !isChatDraggingEnabled.value) return;
  
  // Don't allow chat dragging if image dragging is active and in progress
  if (isImageDraggingEnabled.value && isPanning.value) {
    return;
  }
  
  event.preventDefault();
  isChatPanning.value = true;
  chatPanStart.x = event.clientX;
  chatPanStart.y = event.clientY;
  chatPanStartPos.x = overlay.transform.x;
  chatPanStartPos.y = overlay.transform.y;
  pendingChatDragPosition.x = overlay.transform.x;
  pendingChatDragPosition.y = overlay.transform.y;
  document.body.style.userSelect = 'none';
  beginCapturedCanvasDrag(event, handleChatMouseMove, handleChatMouseUpOrLeave);
};

const handleChatMouseMove = (event: PointerEvent) => {
  if (!isChatPanning.value || !activeChatOverlay.value) return;
  
  // Prevent event from being handled by image drag
  event.stopPropagation();
  
  const interactionScale = getCanvasInteractionScale();
  const deltaX = (event.clientX - chatPanStart.x) / interactionScale;
  const deltaY = (event.clientY - chatPanStart.y) / interactionScale;
  const element = chatOverlayElementMap.get(activeChatOverlay.value.id);
  const proposedX = chatPanStartPos.x + deltaX;
  const proposedY = chatPanStartPos.y + deltaY;

  if (element) {
    const snappedPosition = applySmartGuides(
      'chat',
      activeChatOverlay.value.id,
      getChatOverlayGuideBounds(activeChatOverlay.value, element, proposedX, proposedY),
      isGuideBypassActive.value
    );
    pendingChatDragPosition.x = snappedPosition.x;
    pendingChatDragPosition.y = snappedPosition.y;
  } else {
    clearSmartGuides();
    pendingChatDragPosition.x = proposedX;
    pendingChatDragPosition.y = proposedY;
  }

  scheduleImmediateChatDragPosition();
};

const handleChatMouseUpOrLeave = (event?: PointerEvent) => {
  if (isChatPanning.value) {
    if (activeChatOverlay.value) {
      activeChatOverlay.value.transform.x = pendingChatDragPosition.x;
      activeChatOverlay.value.transform.y = pendingChatDragPosition.y;
    }

    if (event) {
      event.stopPropagation();
    }
    isChatPanning.value = false;
    document.body.style.userSelect = '';
  }

  clearSmartGuides();

  if (chatDragAnimationFrame !== null) {
    window.cancelAnimationFrame(chatDragAnimationFrame);
    chatDragAnimationFrame = null;
  }

};

// --- Chat Zoom Handler ---
const handleChatWheel = (event: WheelEvent, overlayId: string) => {
  const overlay = chatOverlays.value.find((item) => item.id === overlayId);
  if (!overlay || overlay.isLocked || !isChatDraggingEnabled.value || overlay.parsedLines.length === 0) return;

  selectChatOverlay(overlayId);
  event.preventDefault();
  event.stopPropagation();
  const scaleAmount = 0.1;
  const minScale = 0.5;
  const maxScale = 3;

  if (event.deltaY < 0) {
    overlay.transform.scale = Math.min(maxScale, overlay.transform.scale + scaleAmount);
  } else {
    overlay.transform.scale = Math.max(minScale, overlay.transform.scale - scaleAmount);
  }
};

// Toggle chat dragging
const toggleChatDrag = () => {
  isChatDraggingEnabled.value = !isChatDraggingEnabled.value;
  if (isChatDraggingEnabled.value && isImageDraggingEnabled.value) {
    isImageDraggingEnabled.value = false; // Disable image drag if enabling chat drag
  }
};

const enableChatDragFromCanvas = (event: MouseEvent, overlayId: string) => {
  const overlay = chatOverlays.value.find((item) => item.id === overlayId);
  if (!overlay || overlay.isLocked) return;

  event.preventDefault();
  event.stopPropagation();
  selectChatOverlay(overlayId);
  isChatDraggingEnabled.value = true;
  isImageDraggingEnabled.value = false;
};

// --- Chat Panel Resize Handlers ---
const handleResizeMouseDown = (event: MouseEvent) => {
  // Prevent default behavior (like text selection)
  event.preventDefault();
  event.stopPropagation();

  // Record starting coordinates and initial width
  resizeStartX.value = event.clientX;
  
  // Store current width percentage
  const currentBasis = parseFloat(chatPanelFlexBasis.value);
  initialChatPanelBasis.value = isNaN(currentBasis) ? 25 : currentBasis;
  
  // Set flag for resizing state
  isResizingChatPanel.value = true;
  
  // Set cursor and user-select for entire document during resize
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  
  // Add event listeners for move and up directly to document
  document.addEventListener('mousemove', handleResizeMouseMove);
  document.addEventListener('mouseup', handleResizeMouseUp);
};

const handleResizeMouseMove = (event: MouseEvent) => {
  // Only proceed if we're in resizing state
  if (!isResizingChatPanel.value) return;
  
  // Prevent default behavior
  event.preventDefault();
  event.stopPropagation();
  
  // Get the movement delta - positive when moving left (making panel wider)
  const deltaX = resizeStartX.value - event.clientX;
  
  // Calculate direct conversion to percentage - using parent container width
  const parentWidth = parentRowRef.value?.offsetWidth || window.innerWidth;
  const deltaPercent = (deltaX / parentWidth) * 100;
  
  // Calculate new basis value - original percentage + delta
  let newBasis = initialChatPanelBasis.value + deltaPercent;
  
  // Calculate minimum width based on drop zone size to prevent panel from disappearing
  // As drop zone gets wider, we need to ensure chat panel has a reasonable minimum width
  const minWidthPx = 250; // Absolute minimum width in pixels
  let minWidthPercent = 15; // Default minimum percentage
  
  if (dropZoneWidth.value && dropZoneWidth.value > 800) {
    // For wider drop zones, calculate a higher minimum percentage
    // This ensures the chat panel stays visible even with wide drop zones
    const minPercentForCurrentWidth = (minWidthPx / parentWidth) * 100;
    minWidthPercent = Math.max(minWidthPercent, minPercentForCurrentWidth);
  }
  
  // Clamp the value to reasonable boundaries
  // The maximum is still 50% but minimum is now dynamic based on drop zone width
  newBasis = Math.max(minWidthPercent, Math.min(newBasis, 50));
  
  // Apply the new width percentage
  chatPanelFlexBasis.value = `${newBasis}%`;
  mainContentFlexBasis.value = `${100 - newBasis}%`;
};

const handleResizeMouseUp = () => {
  // Clean up - reset flags and styles
  isResizingChatPanel.value = false;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  
  // Remove the event listeners
  document.removeEventListener('mousemove', handleResizeMouseMove);
  document.removeEventListener('mouseup', handleResizeMouseUp);
};

const getImageOverlayStyles = (overlay: ImageOverlay) => {
  const isActiveOverlay = activeImageOverlayId.value === overlay.id;
  const overlayIndex = imageOverlays.value.findIndex((item) => item.id === overlay.id);
  const isBrushTarget = isActiveOverlay && isImageOverlayBrushActive.value;

  return {
    position: 'absolute' as const,
    top: '0',
    left: '0',
    display: 'block',
    width: `${overlay.sourceWidth || 1}px`,
    height: `${overlay.sourceHeight || 1}px`,
    maxWidth: 'none',
    maxHeight: 'none',
    pointerEvents: 'auto' as const,
    touchAction: 'none' as const,
    transformOrigin: 'top left',
    transform: `translate(${overlay.transform.x}px, ${overlay.transform.y}px) scale(${overlay.transform.scale})`,
    opacity: String(overlay.opacity),
    willChange: isPanning.value && isActiveOverlay ? 'transform' : 'auto',
    cursor: overlay.isLocked
      ? 'not-allowed'
      : isBrushTarget
        ? 'crosshair'
      : isImageDraggingEnabled.value
        ? (isActiveOverlay && isPanning.value ? 'grabbing' : 'grab')
        : 'pointer',
    outline: isActiveOverlay ? `1px dashed ${overlay.isLocked ? 'rgba(239, 83, 80, 0.9)' : 'rgba(66, 165, 245, 0.9)'}` : 'none',
    outlineOffset: '2px',
    zIndex: overlay.acceptsEffects ? 1 + Math.max(overlayIndex, 0) : 200 + Math.max(overlayIndex, 0)
  };
};

const moveImageOverlay = (overlayId: string, direction: 'forward' | 'backward') => {
  const overlayIndex = imageOverlays.value.findIndex((overlay) => overlay.id === overlayId);
  if (overlayIndex === -1) return;

  const targetIndex = direction === 'forward' ? overlayIndex + 1 : overlayIndex - 1;
  if (targetIndex < 0 || targetIndex >= imageOverlays.value.length) return;

  const [overlay] = imageOverlays.value.splice(overlayIndex, 1);
  imageOverlays.value.splice(targetIndex, 0, overlay);
};

const duplicateImageOverlay = (overlayId: string) => {
  const sourceOverlay = imageOverlays.value.find((overlay) => overlay.id === overlayId);
  if (!sourceOverlay) return;

  const overlayIndex = imageOverlays.value.length;
  const duplicatedOverlay = cloneImageOverlay({
    ...sourceOverlay,
    id: createImageOverlayId(),
    name: `${sourceOverlay.name} Copy`,
    transform: {
      ...sourceOverlay.transform,
      x: sourceOverlay.transform.x + 16,
      y: sourceOverlay.transform.y + 16
    }
  }, overlayIndex);

  imageOverlays.value.push(duplicatedOverlay);
  selectImageOverlay(duplicatedOverlay.id);
  void nextTick(() => {
    void renderImageOverlayCanvas(duplicatedOverlay.id);
  });
};

const removeImageOverlay = (overlayId: string) => {
  const overlayIndex = imageOverlays.value.findIndex((overlay) => overlay.id === overlayId);
  if (overlayIndex === -1) return;

  if (activeImageOverlayId.value === overlayId && isPanning.value) {
    handleImageMouseUpOrLeave();
  }

  imageOverlays.value.splice(overlayIndex, 1);
  clearImageOverlayRuntimeState(overlayId);
  if (activeImageMaskOverlayId.value === overlayId) {
    finishImageOverlayMaskPainting();
    hideImageMaskBrushPreview();
  }

  if (activeImageOverlayId.value === overlayId) {
    const nextOverlay = imageOverlays.value[Math.max(0, overlayIndex - 1)] ?? imageOverlays.value[0] ?? null;
    selectImageOverlay(nextOverlay?.id ?? null);
  }
};

const toggleImageOverlayVisibility = (overlayId: string) => {
  const overlay = imageOverlays.value.find((item) => item.id === overlayId);
  if (!overlay) return;

  overlay.isHidden = !overlay.isHidden;

  if (overlay.isHidden && activeImageOverlayId.value === overlayId && isPanning.value) {
    handleImageMouseUpOrLeave();
  }

  if (overlay.isHidden && activeImageMaskOverlayId.value === overlayId) {
    finishImageOverlayMaskPainting();
    hideImageMaskBrushPreview();
  }
};

const toggleImageOverlayLock = (overlayId: string) => {
  const overlay = imageOverlays.value.find((item) => item.id === overlayId);
  if (!overlay) return;

  overlay.isLocked = !overlay.isLocked;

  if (overlay.isLocked && isPanning.value && activeImageOverlayId.value === overlayId) {
    handleImageMouseUpOrLeave();
  }

  if (overlay.isLocked && activeImageMaskOverlayId.value === overlayId) {
    finishImageOverlayMaskPainting();
    hideImageMaskBrushPreview();
  }
};

const toggleImageOverlayEffects = (overlayId: string) => {
  const overlay = imageOverlays.value.find((item) => item.id === overlayId);
  if (!overlay) return;

  overlay.acceptsEffects = !overlay.acceptsEffects;
};

const resetActiveImageOverlayView = () => {
  if (!activeImageOverlay.value) return;

  activeImageOverlay.value.transform.x = 0;
  activeImageOverlay.value.transform.y = 0;
  activeImageOverlay.value.transform.scale = 1;
};

const resetActiveImageOverlayMask = () => {
  const overlay = activeImageOverlay.value;
  if (!overlay) return;

  overlay.maskDataUrl = null;
  clearImageOverlayMaskRuntimeState(overlay.id);
  void renderImageOverlayCanvas(overlay.id);
};

// Update chat overlay styles
const getChatStyles = (overlay: ChatOverlay) => {
  const isActiveOverlay = activeChatOverlayId.value === overlay.id;
  const overlayIndex = chatOverlays.value.findIndex((item) => item.id === overlay.id);
  const shouldYieldToActiveImageOverlay = shouldPrioritizeActiveImageOverlayInteraction.value;

  return {
    position: 'absolute' as const,
    top: '0',
    left: '0',
    width: `${overlay.lineWidth}px`,
    height: 'auto',
    maxWidth: `${overlay.lineWidth}px`,
    fontFamily: '"Arial Black", Arial, sans-serif',
    fontSize: '12px',
    lineHeight: '16px',
    transform: `translate(${overlay.transform.x}px, ${overlay.transform.y}px) scale(${overlay.transform.scale})`,
    transformOrigin: 'top left',
    pointerEvents: shouldYieldToActiveImageOverlay ? 'none' as const : 'auto' as const,
    wordWrap: 'break-word' as const,
    whiteSpace: 'pre-wrap' as const,
    opacity: overlay.isHidden ? '0.45' : '1',
    cursor: overlay.isLocked
      ? 'not-allowed'
      : shouldYieldToActiveImageOverlay
        ? 'default'
      : isChatDraggingEnabled.value
        ? (isActiveOverlay && isChatPanning.value ? 'grabbing' : 'grab')
        : 'pointer',
    outline: isActiveOverlay ? `1px dashed ${overlay.isLocked ? 'rgba(239, 83, 80, 0.9)' : 'rgba(66, 165, 245, 0.9)'}` : 'none',
    outlineOffset: '2px',
    zIndex: 300 + Math.max(overlayIndex, 0)
  };
};

const buildMaskedImageOverlayCanvas = async (overlay: ImageOverlay) => {
  const sourceImage = await loadOverlaySourceImage(overlay.src);
  syncImageOverlayIntrinsicSize(overlay, sourceImage.naturalWidth, sourceImage.naturalHeight);

  const canvas = document.createElement('canvas');
  canvas.width = overlay.sourceWidth || sourceImage.naturalWidth;
  canvas.height = overlay.sourceHeight || sourceImage.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);

  const maskCanvas = imageOverlayMaskCanvasMap.get(overlay.id)
    ?? (overlay.maskDataUrl ? await hydrateImageOverlayMaskCanvas(overlay) : null);

  if (maskCanvas) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  return canvas;
};

const effectAwareImageOverlays = computed(() => {
  const visibleOverlays = imageOverlays.value.filter((overlay) => !overlay.isHidden && overlay.src);

  return {
    affected: visibleOverlays.filter((overlay) => overlay.acceptsEffects),
    unaffected: visibleOverlays.filter((overlay) => !overlay.acceptsEffects)
  };
});

// Update the saveImage function to ensure 1:1 positioning match with preview
const saveImage = async () => {
  if (!droppedImageSrc.value) {
    console.warn('No image to save');
    return;
  }

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Set canvas size to match the drop zone exactly
    canvas.width = dropZoneWidth.value || 800;
    canvas.height = dropZoneHeight.value || 600;

    // Draw background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const drawOverlayCollection = async (overlays: ImageOverlay[]) => {
      for (const overlay of overlays) {
        const overlayCanvas = await buildMaskedImageOverlayCanvas(overlay);
        if (!overlayCanvas) continue;

        ctx.save();
        ctx.globalAlpha = overlay.opacity;
        ctx.translate(overlay.transform.x, overlay.transform.y);
        ctx.scale(overlay.transform.scale, overlay.transform.scale);
        ctx.drawImage(overlayCanvas, 0, 0);
        ctx.restore();
      }
    };

    if (hasSceneImageEffects.value) {
      const affectedSceneCanvas = await buildAffectedSceneCanvas();
      if (affectedSceneCanvas) {
        const processedSceneCanvas = await applyImageEffectsToSceneCanvas(affectedSceneCanvas);
        ctx.drawImage(processedSceneCanvas, 0, 0, canvas.width, canvas.height);
      }
    } else {
      const affectedSceneCanvas = await buildAffectedSceneCanvas();
      if (affectedSceneCanvas) {
        ctx.drawImage(affectedSceneCanvas, 0, 0, canvas.width, canvas.height);
      }

      activeImageEffectLayers.value.forEach(({ effect, preset }) => {
        const effectCanvas = buildImageEffectCanvas(effect, canvas.width, canvas.height);
        if (!effectCanvas) return;

        ctx.save();
        ctx.globalAlpha = effect.opacity;
        ctx.globalCompositeOperation = preset.blendMode;
        ctx.drawImage(effectCanvas, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      });
    }

    await drawOverlayCollection(effectAwareImageOverlays.value.unaffected);

    const visibleChatOverlays = chatOverlays.value.filter((overlay) => overlay.parsedLines.length > 0);

    if (visibleChatOverlays.length > 0) {
      ctx.font = '700 12px Arial, sans-serif';
      ctx.textBaseline = 'top';
      ctx.textRendering = 'geometricPrecision';
      ctx.letterSpacing = '0px';

      const drawBlackBar = (y: number, width: number) => {
        if (showBlackBars.value) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, y, width + 8, 17);
        }
      };

      const drawStandardText = (
        targetCtx: CanvasRenderingContext2D,
        text: string,
        x: number,
        y: number,
        color: string
      ) => {
        const textOffsetY = 1;
        const shadowOffsets = [
          [-1, -1], [-1, 0], [-1, 1],
          [0, -1],           [0, 1],
          [1, -1], [1, 0], [1, 1]
        ];

        targetCtx.fillStyle = '#000000';
        shadowOffsets.forEach(([dx, dy]) => {
          targetCtx.fillText(text, x + dx, y + textOffsetY + dy);
        });

        targetCtx.fillStyle = color;
        targetCtx.fillText(text, x, y + textOffsetY);
      };

      const drawTextWithOutline = (text: string, x: number, y: number, color: string, censorType?: CensorType) => {
        const width = ctx.measureText(text).width;

        if (showBlackBars.value) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(x - 2, y, width + 4, 16);
        }

        if (censorType === CensorType.Invisible) {
          return;
        }

        if (censorType === CensorType.BlackBar) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(x, y, width, 16);
          return;
        }

        if (censorType === CensorType.Blur) {
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d');
          if (!tempCtx) return;

          tempCanvas.width = width + 20;
          tempCanvas.height = 16 + 20;

          tempCtx.font = ctx.font;
          tempCtx.textBaseline = ctx.textBaseline;
          tempCtx.textRendering = ctx.textRendering;

          drawStandardText(tempCtx, text, 10, 10, color);

          ctx.save();
          ctx.filter = 'blur(4px)';
          ctx.drawImage(tempCanvas, x - 10, y - 10);
          ctx.restore();
          return;
        }

        drawStandardText(ctx, text, x, y, color);
      };

      const measureCharacters = (characters: Array<{ character: string }>) =>
        ctx.measureText(characters.map((character) => character.character).join('')).width;

      const drawCharacterRun = (
        characters: Array<{ character: string; color: string; censorType?: CensorType }>,
        xPos: number,
        yPos: number
      ) => {
        let currentX = xPos;

        collapseStyledCharacters(characters).forEach((run) => {
          drawTextWithOutline(run.text, currentX, yPos, run.color, run.censorType);
          currentX += ctx.measureText(run.text).width;
        });
      };

      for (const overlay of visibleChatOverlays) {
        ctx.save();
        ctx.translate(overlay.transform.x, overlay.transform.y);
        ctx.scale(overlay.transform.scale, overlay.transform.scale);

        let currentY = 0;
        const maxTextWidth = overlay.lineWidth - 8;

        for (let lineIndex = 0; lineIndex < overlay.parsedLines.length; lineIndex++) {
          const line = overlay.parsedLines[lineIndex];
          const styledCharacters = getStyledCharacters(overlay, lineIndex, line.text);
          let remainingCharacters = [...styledCharacters];

          while (remainingCharacters.length > 0) {
            if (measureCharacters(remainingCharacters) <= maxTextWidth) {
              const currentLineWidth = measureCharacters(remainingCharacters);
              drawBlackBar(currentY, currentLineWidth);
              drawCharacterRun(remainingCharacters, 4, currentY);
              currentY += 16;
              remainingCharacters = [];
              continue;
            }

            let breakIndex = 0;
            let lastSpaceIndex = -1;

            for (let index = 0; index < remainingCharacters.length; index++) {
              const testCharacters = remainingCharacters.slice(0, index + 1);
              if (measureCharacters(testCharacters) > maxTextWidth) {
                breakIndex = lastSpaceIndex > 0 ? lastSpaceIndex : index;
                break;
              }

              if (remainingCharacters[index].character === ' ') {
                lastSpaceIndex = index;
              }
            }

            if (breakIndex === 0) {
              breakIndex = Math.max(1, remainingCharacters.length - 1);
            }

            let lineCharacters = remainingCharacters.slice(0, breakIndex);
            remainingCharacters = remainingCharacters.slice(
              remainingCharacters[breakIndex]?.character === ' ' ? breakIndex + 1 : breakIndex
            );

            while (lineCharacters[lineCharacters.length - 1]?.character === ' ') {
              lineCharacters = lineCharacters.slice(0, -1);
            }

            if (lineCharacters.length === 0) {
              lineCharacters = remainingCharacters.slice(0, 1);
              remainingCharacters = remainingCharacters.slice(1);
            }

            const currentLineWidth = measureCharacters(lineCharacters);
            drawBlackBar(currentY, currentLineWidth);
            drawCharacterRun(lineCharacters, 4, currentY);
            currentY += 16;
          }
        }

        ctx.restore();
      }
    }

    // Convert to blob and save
    canvas.toBlob((blob) => {
      if (!blob) {
        throw new Error('Failed to create blob');
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'screenshot.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      trackEvent('export_image', {
        export_format: 'png',
        ...getAnalyticsContext()
      });
    }, 'image/png');

  } catch (error) {
    console.error('Error saving image:', error);
  }
};

// Reset all state to default values
const resetSession = () => {
  // Reset image and transform
  droppedImageSrc.value = null;
  imageTransform.x = 0;
  imageTransform.y = 0;
  imageTransform.scale = 1;
  imageOverlays.value.forEach((overlay) => clearImageOverlayRuntimeState(overlay.id));
  imageOverlays.value = [];
  activeImageOverlayId.value = null;
  activeImageDragTarget.value = 'base';
  imageEffects.value = [];
  imageOverlayTool.value = 'move';
  activeImageMaskOverlayId.value = null;
  isImageMaskPainting.value = false;
  hideImageMaskBrushPreview();
  
  // Reset image dragging state
  isImageDraggingEnabled.value = false;
  isPanning.value = false;
  
  // Reset chat
  chatlogText.value = '';
  chatOverlays.value = [];
  activeChatOverlayId.value = null;
  currentProjectId.value = null;
  currentProjectName.value = '';
  
  // Reset drop zone dimensions to defaults
  dropZoneWidth.value = 800;
  dropZoneHeight.value = 600;
  
  isChatDraggingEnabled.value = false;
  isChatPanning.value = false;

  // Reset censoring data
  Object.assign(selectedText, DEFAULT_SELECTED_TEXT);
  markCurrentStateAsSaved();
  renderKey.value++;
  
  // Close the confirmation dialog
  showNewSessionDialog.value = false;
  showUnsavedChangesDialog.value = false;
  pendingEditorAction.value = null;
};

// Add state for black bars toggle
const showBlackBars = ref(false);

// Toggle black bars
const toggleBlackBars = () => {
  showBlackBars.value = !showBlackBars.value;
};

const selectedText = reactive({
  ...DEFAULT_SELECTED_TEXT
});

// Add a key to force re-render when censoring changes
const renderKey = ref(0);

const getChatlogTextareaElement = () =>
  document.querySelector('.chatlog-textarea textarea') as HTMLTextAreaElement | null;

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
    selectedText.lineIndex = -1;
    selectedText.startOffset = 0;
    selectedText.endOffset = 0;
    selectedText.text = '';
  }

  renderKey.value++;
};

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
  const safeStartOffset = Math.max(0, Math.min(getDisplayedLineText(lineText).length, region.startOffset));
  const safeEndOffset = Math.max(safeStartOffset, Math.min(getDisplayedLineText(lineText).length, region.endOffset));
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

const addCustomColorSwatch = () => {
  const normalizedColor = customColorHex.value.trim().toLowerCase();
  if (!normalizedColor || customColorSwatches.value.includes(normalizedColor)) return;

  customColorSwatches.value.push(normalizedColor);
  saveCustomColorSwatches();
};

// Update handleTextSelection to work with textarea
const handleTextSelection = () => {
  const selection = window.getSelection();
  
  if (!selection || selection.toString().trim() === '') {
    selectedText.lineIndex = -1;
    return;
  }

  try {
    // Get the textarea element
    const textarea = getChatlogTextareaElement();
    if (!textarea) return;

    const selectedValue = selection.toString().trim();
    const fullText = textarea.value;
    const lines = fullText.split('\n');
    
    // Find which line contains the selection
    let currentPos = 0;
    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length + 1; // +1 for newline
      const lineStart = currentPos;
      const lineEnd = currentPos + lineLength;
      
      // Check if selection is in this line
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

// Save editor state to cookie
const saveEditorState = (snapshot: EditorStateSnapshot = createEditorSnapshot()) => {
  if (typeof window === 'undefined') return;

  const state: PersistedEditorSession = {
    snapshot: toSerializableSnapshot(snapshot),
    currentProjectId: currentProjectId.value,
    currentProjectName: currentProjectName.value
  };

  try {
    window.localStorage.setItem(EDITOR_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Error saving editor state:', error);
  }
};

// Load editor state from cookie
const loadEditorState = () => {
  if (typeof window === 'undefined') return;

  const savedState = window.localStorage.getItem(EDITOR_STATE_STORAGE_KEY) || Cookies.get('editorState');
  if (savedState) {
    try {
      const parsedState = JSON.parse(savedState) as Partial<PersistedEditorSession & EditorStateSnapshot>;
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
        saveEditorState();
        Cookies.remove('editorState');
        return;
      }

      applyEditorSnapshot(state);
      currentProjectId.value = typeof parsedState.currentProjectId === 'string' ? parsedState.currentProjectId : null;
      currentProjectName.value = typeof parsedState.currentProjectName === 'string' ? parsedState.currentProjectName : '';
      saveEditorState();
      Cookies.remove('editorState');
    } catch (error) {
      console.error('Error loading editor state:', error);
    }
  }
};

// Load character name from cookie
const loadCharacterName = () => {
  const savedName = Cookies.get('characterName');
  if (savedName) {
    characterName.value = savedName;
  }
};

const openTutorial = () => {
  tutorialStepIndex.value = 0;
  showTutorialDialog.value = true;
  trackEvent('tutorial_begin', {
    ...getAnalyticsContext()
  });
};

const closeTutorial = () => {
  if (dontShowTutorialAgain.value) {
    Cookies.set(TUTORIAL_DISMISSED_COOKIE, 'true', { expires: 365 });
  } else {
    Cookies.remove(TUTORIAL_DISMISSED_COOKIE);
  }

  showTutorialDialog.value = false;
};

const showTutorialIfNeeded = () => {
  const tutorialDismissed = Cookies.get(TUTORIAL_DISMISSED_COOKIE) === 'true';
  dontShowTutorialAgain.value = tutorialDismissed;

  if (!tutorialDismissed) {
    openTutorial();
  }
};

const loadNavigatorPreference = () => {
  if (typeof window === 'undefined') return;

  const storedPreference = window.localStorage.getItem(SHOW_NAVIGATOR_STORAGE_KEY);
  showNavigator.value = storedPreference !== 'false';
};

const loadSmartGuidePreferences = () => {
  if (typeof window === 'undefined') return;

  const storedEnabled = window.localStorage.getItem(SMART_GUIDES_ENABLED_STORAGE_KEY);
  smartGuidesEnabled.value = storedEnabled !== 'false';

  const storedStrength = Number(window.localStorage.getItem(SMART_GUIDE_STRENGTH_STORAGE_KEY));
  if (Number.isFinite(storedStrength)) {
    smartGuideStrength.value = Math.min(24, Math.max(2, storedStrength));
  }
};

const goToNextTutorialStep = () => {
  if (tutorialStepIndex.value >= tutorialSteps.length - 1) {
    trackEvent('tutorial_complete', {
      total_steps: tutorialSteps.length,
      ...getAnalyticsContext()
    });
    closeTutorial();
    return;
  }

  tutorialStepIndex.value += 1;
};

const goToPreviousTutorialStep = () => {
  if (tutorialStepIndex.value <= 0) return;
  tutorialStepIndex.value -= 1;
};

// Initialize flex layout values to create a stable layout
const initializeLayoutValues = () => {
  // Ensure we're using string percentages for flex basis values
  chatPanelFlexBasis.value = '25%';
  mainContentFlexBasis.value = '75%';
  utilityPanelWidth.value = 320;
};

const scheduleEditorStatePersist = () => {
  if (editorStatePersistTimer) {
    clearTimeout(editorStatePersistTimer);
  }

  editorStatePersistTimer = setTimeout(() => {
    editorStatePersistTimer = null;
    saveEditorState();
  }, 250);
};

watch([
  chatlogText,
  dropZoneWidth,
  dropZoneHeight,
  () => ({ ...imageTransform }),
  imageOverlays,
  activeImageOverlayId,
  imageEffects,
  chatOverlays,
  activeChatOverlayId,
  isImageDraggingEnabled,
  isChatDraggingEnabled,
  showBlackBars,
  () => ({ ...selectedText }),
  chatLineWidth
], () => {
  scheduleEditorStatePersist();
}, { deep: true });

watch([currentProjectId, currentProjectName], () => {
  scheduleEditorStatePersist();
});

watch(
  () => imageOverlays.value.map((overlay) => ({
    id: overlay.id,
    src: overlay.src,
    maskDataUrl: overlay.maskDataUrl,
    sourceWidth: overlay.sourceWidth,
    sourceHeight: overlay.sourceHeight
  })),
  () => {
    syncImageOverlayRuntimeState();
    void nextTick(() => {
      renderAllImageOverlayCanvases();
    });
  },
  { deep: true }
);

// Load saved state when component mounts
onMounted(() => {
  unsavedNavigationStore.setEditorMounted(true);
  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('keydown', handleEditorHistoryKeydown);
  window.addEventListener('keyup', handleEditorHistoryKeyup);
  loadNavigatorPreference();
  loadSmartGuidePreferences();
  loadEditorThemes();
  loadCharacterName();
  loadCustomColorSwatches();
  loadEditorState();
  markCurrentStateAsSaved();
  resetHistoryState();
  refreshProjectList();
  showTutorialIfNeeded();
  
  // Make sure layout is initialized correctly
  initializeLayoutValues();

  windowResizeHandler = () => {
    scheduleDropzoneScaleCalculation();
  };
  window.addEventListener('resize', windowResizeHandler);
  scheduleDropzoneScaleCalculation();
  void nextTick(() => {
    renderAllImageOverlayCanvases();
  });
});

onUnmounted(() => {
  if (historyCommitTimer) {
    clearTimeout(historyCommitTimer);
  }
  if (projectAutosaveTimer) {
    clearTimeout(projectAutosaveTimer);
  }
  if (editorStatePersistTimer) {
    clearTimeout(editorStatePersistTimer);
  }
  if (dropzoneScaleAnimationFrame !== null) {
    window.cancelAnimationFrame(dropzoneScaleAnimationFrame);
  }
  if (imageDragAnimationFrame !== null) {
    window.cancelAnimationFrame(imageDragAnimationFrame);
  }
  if (chatDragAnimationFrame !== null) {
    window.cancelAnimationFrame(chatDragAnimationFrame);
  }
  imageOverlayMaskSerializeTimers.forEach((timer) => clearTimeout(timer));
  imageOverlayMaskSerializeTimers.clear();
  imageOverlayMaskCanvasMap.clear();
  activeCanvasDragCleanup?.();
  window.removeEventListener('beforeunload', handleBeforeUnload);
  window.removeEventListener('keydown', handleEditorHistoryKeydown);
  window.removeEventListener('keyup', handleEditorHistoryKeyup);
  if (windowResizeHandler) {
    window.removeEventListener('resize', windowResizeHandler);
  }
  unsavedNavigationStore.reset();
  handleChatMouseUpOrLeave();
});

watch(hasUnsavedChanges, (value) => {
  unsavedNavigationStore.setHasUnsavedChanges(value);
}, { immediate: true });

watch(showNavigator, (value) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SHOW_NAVIGATOR_STORAGE_KEY, String(value));
});

watch(smartGuidesEnabled, (value) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SMART_GUIDES_ENABLED_STORAGE_KEY, String(value));

  if (!value) {
    clearSmartGuides();
  }
});

watch(smartGuideStrength, (value) => {
  if (typeof window === 'undefined') return;

  const clampedValue = Math.min(24, Math.max(2, value));
  if (clampedValue !== value) {
    smartGuideStrength.value = clampedValue;
    return;
  }

  window.localStorage.setItem(SMART_GUIDE_STRENGTH_STORAGE_KEY, String(clampedValue));
});

watch(imageMaskBrushSize, (value) => {
  const clampedValue = clampImageMaskBrushSize(value);
  if (clampedValue !== value) {
    imageMaskBrushSize.value = clampedValue;
  }
});

watch(imageMaskBrushSoftness, (value) => {
  const clampedValue = clampImageMaskBrushSoftness(value);
  if (clampedValue !== value) {
    imageMaskBrushSoftness.value = clampedValue;
  }
});

watch(imageMaskBrushStrength, (value) => {
  const clampedValue = clampImageMaskBrushStrength(value);
  if (clampedValue !== value) {
    imageMaskBrushStrength.value = clampedValue;
  }
});

watch(() => getSnapshotSignature(), () => {
  if (isApplyingHistoryState.value) return;

  if (historyCommitTimer) {
    clearTimeout(historyCommitTimer);
  }

  historyCommitTimer = setTimeout(() => {
    commitHistorySnapshot();
    historyCommitTimer = null;
  }, HISTORY_COMMIT_DELAY_MS);
});

watch(
  [() => getSnapshotSignature(), currentProjectId, currentProjectName],
  ([, projectId, projectName]) => {
    if (projectAutosaveTimer) {
      clearTimeout(projectAutosaveTimer);
      projectAutosaveTimer = null;
    }

    if (isApplyingHistoryState.value || !projectId || !projectName.trim()) {
      if (!projectId) {
        autosaveState.value = 'idle';
      }
      return;
    }

    if (!hasUnsavedChanges.value) {
      if (autosaveState.value !== 'error') {
        autosaveState.value = 'saved';
      }
      return;
    }

    autosaveState.value = 'pending';
    projectAutosaveTimer = setTimeout(async () => {
      projectAutosaveTimer = null;

      if (!currentProjectId.value || !currentProjectName.value.trim() || !hasUnsavedChanges.value) {
        return;
      }

      await saveProject({
        autosave: true,
        refreshProjectList: false
      });
      await refreshProjectList();
    }, PROJECT_AUTOSAVE_DELAY_MS);
  }
);

watch(chatLineWidth, (newValue) => {
  if (!activeChatOverlay.value) return;
  activeChatOverlay.value.lineWidth = newValue;
  renderKey.value++;
});

const openProjectsManager = async () => {
  showProjectsDialog.value = true;
  await refreshProjectList();
};

const closeSaveProjectDialog = () => {
  showSaveProjectDialog.value = false;
  pendingEditorAction.value = null;
};

const closePendingEditorAction = () => {
  showUnsavedChangesDialog.value = false;
  pendingEditorAction.value = null;
};

const requestEditorAction = async (action: PendingEditorAction) => {
  if (hasUnsavedChanges.value) {
    pendingEditorAction.value = action;
    showUnsavedChangesDialog.value = true;
    return;
  }

  if (action.type === 'new-session') {
    showNewSessionDialog.value = true;
    return;
  }

  if (action.type === 'load-project' && action.projectId) {
    await loadProject(action.projectId, { bypassUnsavedCheck: true });
  }
};

const saveAndContinuePendingAction = async () => {
  if (!pendingEditorAction.value) return;

  if (!currentProjectId.value) {
    pendingProjectName.value = currentProjectName.value || `Project ${projectRecords.value.length + 1}`;
    showUnsavedChangesDialog.value = false;
    showSaveProjectDialog.value = true;
    return;
  }

  pendingProjectName.value = currentProjectName.value;
  await saveProject();
};

const discardAndContinuePendingAction = async () => {
  const action = pendingEditorAction.value;
  closePendingEditorAction();
  if (!action) return;

  if (action.type === 'new-session') {
    resetSession();
    return;
  }

  if (action.type === 'load-project' && action.projectId) {
    await loadProject(action.projectId, { bypassUnsavedCheck: true });
  }
};

const promptSaveProject = () => {
  pendingProjectName.value = currentProjectName.value || `Project ${projectRecords.value.length + 1}`;
  showSaveProjectDialog.value = true;
};

const saveProject = async (options: SaveProjectOptions = {}) => {
  const {
    forceNewProject = false,
    autosave = false,
    refreshProjectList: shouldRefreshProjectList = true
  } = options;

  const trimmedName = autosave
    ? currentProjectName.value.trim()
    : pendingProjectName.value.trim();
  if (!trimmedName) return false;

  const now = new Date().toISOString();
  const hadExistingProject = Boolean(currentProjectId.value);
  const projectId = forceNewProject || !currentProjectId.value ? createProjectId() : currentProjectId.value;
  const existingCreatedAt = forceNewProject || !currentProjectId.value
    ? now
    : projectRecords.value.find((project) => project.id === currentProjectId.value)?.createdAt || now;

  const projectRecord: ProjectRecord = {
    id: projectId,
    name: trimmedName,
    createdAt: existingCreatedAt,
    updatedAt: now,
    snapshot: toSerializableSnapshot(createEditorSnapshot())
  };

  try {
    autosaveState.value = autosave ? 'saving' : autosaveState.value;
    await saveStoredProject(projectRecord);
    currentProjectId.value = projectRecord.id;
    currentProjectName.value = projectRecord.name;
    markCurrentStateAsSaved(projectRecord.snapshot);

    if (autosave) {
      autosaveState.value = 'saved';
    } else {
      autosaveState.value = 'idle';
      trackEvent('save_project', {
        save_mode: forceNewProject ? 'save_as_new' : hadExistingProject ? 'overwrite' : 'create',
        had_existing_project: hadExistingProject,
        ...getAnalyticsContext()
      });
      showSaveProjectDialog.value = false;
      if (shouldRefreshProjectList) {
        await refreshProjectList();
      }

      if (pendingEditorAction.value) {
        const action = pendingEditorAction.value;
        closePendingEditorAction();

        if (action.type === 'new-session') {
          resetSession();
        } else if (action.type === 'load-project' && action.projectId) {
          await loadProject(action.projectId, { bypassUnsavedCheck: true });
        }
      }
    }

    return true;
  } catch (error) {
    autosaveState.value = autosave ? 'error' : autosaveState.value;
    console.error('Error saving project:', error);
    return false;
  }
};

const loadProject = async (projectId: string, options?: { bypassUnsavedCheck?: boolean }) => {
  if (!options?.bypassUnsavedCheck && hasUnsavedChanges.value) {
    pendingEditorAction.value = { type: 'load-project', projectId };
    showUnsavedChangesDialog.value = true;
    return;
  }

  try {
    const project = await loadStoredProject(projectId);
    if (!project) return;

    applyEditorSnapshot(project.snapshot);
    currentProjectId.value = project.id;
    currentProjectName.value = project.name;
    markCurrentStateAsSaved(project.snapshot);
    trackEvent('load_project', {
      ...getAnalyticsContext(),
      loaded_chat_layers_count: project.snapshot.chatOverlays?.filter((overlay) => overlay.parsedLines?.length > 0).length || 0,
      loaded_has_image: Boolean(project.snapshot.droppedImageSrc)
    });
    closePendingEditorAction();
    showProjectsDialog.value = false;
  } catch (error) {
    console.error('Error loading project:', error);
  }
};

const saveCurrentProject = async () => {
  if (!currentProjectId.value) {
    promptSaveProject();
    return;
  }

  pendingProjectName.value = currentProjectName.value;
  await saveProject();
};

const deleteProject = async (projectId: string) => {
  try {
    await deleteStoredProject(projectId);
    if (currentProjectId.value === projectId) {
      currentProjectId.value = null;
      currentProjectName.value = '';
    }
    await refreshProjectList();
  } catch (error) {
    console.error('Error deleting project:', error);
  }
};

const requestDeleteProject = (projectId: string, projectName: string) => {
  pendingProjectDelete.value = { id: projectId, name: projectName };
  showDeleteProjectDialog.value = true;
};

const closeDeleteProjectDialog = () => {
  showDeleteProjectDialog.value = false;
  pendingProjectDelete.value = null;
};

const confirmDeleteProject = async () => {
  const targetProject = pendingProjectDelete.value;
  if (!targetProject) return;

  await deleteProject(targetProject.id);
  closeDeleteProjectDialog();
};

// Add this new method to handle the click on drop zone
const handleDropZoneClick = () => {
  if (!droppedImageSrc.value) {
    triggerFileInput();
  }
};

const preventNativePreviewDrag = (event: DragEvent) => {
  event.preventDefault();
};

</script>

<template>
  <div class="magician-wrapper">
    <v-toolbar
      density="compact"
      color="surface-variant"
      :class="['editor-toolbar', { 'editor-toolbar-compact': isCompactToolbar }]"
    >
      <template v-if="!isCompactToolbar">
      <div class="toolbar-button-group">
        <v-tooltip text="New Session" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn 
              v-bind="props" 
              icon="mdi-plus-box-outline"
              @click="requestEditorAction({ type: 'new-session' })"
            ></v-btn>
          </template>
        </v-tooltip>
        <v-tooltip text="Import Chatlog" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" icon="mdi-message-plus-outline" @click="triggerChatFileInput"></v-btn>
          </template>
        </v-tooltip>
        <v-tooltip text="Add Image Overlay" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" icon="mdi-image-multiple-outline" @click="triggerImageOverlayInput"></v-btn>
          </template>
        </v-tooltip>
        <v-tooltip text="Open Projects" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" icon="mdi-folder-open-outline" @click="openProjectsManager"></v-btn>
          </template>
        </v-tooltip>
        <v-tooltip text="Undo (Ctrl+Z)" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn
              v-bind="props"
              icon="mdi-undo"
              :disabled="!canUndo"
              @click="undoEditorChange"
            ></v-btn>
          </template>
        </v-tooltip>
        <v-tooltip text="Redo (Ctrl+Y)" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn
              v-bind="props"
              icon="mdi-redo"
              :disabled="!canRedo"
              @click="redoEditorChange"
            ></v-btn>
          </template>
        </v-tooltip>
        <v-tooltip text="Save Project (Ctrl+S)" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" icon="mdi-content-save-cog-outline" @click="saveCurrentProject"></v-btn>
          </template>
        </v-tooltip>
        <v-tooltip text="Keyboard Shortcuts (?)" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" icon="mdi-keyboard-outline" @click="openKeyboardShortcuts"></v-btn>
          </template>
        </v-tooltip>
        <v-tooltip text="Settings" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" icon="mdi-cog-outline" @click="showSettingsDialog = true"></v-btn>
          </template>
        </v-tooltip>
        <v-tooltip text="Show Tutorial" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" icon="mdi-help-circle-outline" @click="openTutorial"></v-btn>
          </template>
        </v-tooltip>
      </div>

      <v-spacer></v-spacer>

      <div class="toolbar-button-group">
        <v-text-field
          v-model="characterName"
          label="Character Name"
          density="compact"
          hide-details
          variant="solo-filled"
          flat
          style="max-width: 300px; min-width: 250px;"
          class="mx-1"
          @input="reparseChatOverlays"
          prepend-inner-icon="mdi-account"
        ></v-text-field>
      </div>

      <v-spacer></v-spacer>

      <div class="toolbar-button-group">
        <v-text-field
          v-model.number="dropZoneWidth"
          label="Width"
          type="number"
          density="compact"
          hide-details
          variant="solo-filled"
          flat
          style="max-width: 120px;"
          prepend-inner-icon="mdi-arrow-expand-horizontal"
        ></v-text-field>
        <v-text-field
          v-model.number="dropZoneHeight"
          label="Height"
          type="number"
          density="compact"
          hide-details
          variant="solo-filled"
          flat
          style="max-width: 120px;"
          prepend-inner-icon="mdi-arrow-expand-vertical"
        ></v-text-field>
        <v-text-field
          v-model.number="chatLineWidth"
          label="Line Width"
          type="number"
          density="compact"
          hide-details
          variant="solo-filled"
          flat
          style="max-width: 120px;"
          prepend-inner-icon="mdi-format-line-spacing"
          min="300"
          max="1200"
          @change="renderKey++"
        ></v-text-field>
      </div>

      <v-spacer></v-spacer>

      <div class="toolbar-button-group">
        <v-tooltip text="Enable Image Drag/Zoom (Arrows, +/-)" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn 
              v-bind="props" 
              icon="mdi-drag-variant"
              :color="isImageDraggingEnabled ? 'primary' : undefined"
              @click="toggleImageDrag"
            ></v-btn>
          </template>
        </v-tooltip>
        <v-tooltip text="Reset Image View" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn
              v-bind="props"
              icon="mdi-fit-to-screen-outline"
              :disabled="!droppedImageSrc"
              @click="resetImageView"
            ></v-btn>
          </template>
        </v-tooltip>
        <v-tooltip text="Enable Chat Drag/Zoom (Arrows, +/-)" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn 
              v-bind="props" 
              icon="mdi-message-text-lock-outline"
              :color="isChatDraggingEnabled ? 'primary' : undefined"
              @click="toggleChatDrag"
            ></v-btn>
          </template>
        </v-tooltip>
      </div>

      <v-spacer></v-spacer>

      <div class="toolbar-button-group">
        <v-tooltip text="Toggle Black Bars" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn 
              v-bind="props" 
              icon="mdi-view-day-outline"
              :color="showBlackBars ? 'primary' : undefined"
              @click="toggleBlackBars"
            ></v-btn>
          </template>
        </v-tooltip>
        <v-btn
          prepend-icon="mdi-image-filter-center-focus"
          append-icon="mdi-chevron-down"
          text="Effects"
          class="text-none"
          :color="imageEffects.length > 0 ? 'primary' : undefined"
          @click="showEffectsDialog = true"
        ></v-btn>
        <v-menu location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn
              v-bind="props"
              prepend-icon="mdi-eye-off"
              append-icon="mdi-chevron-down"
              text="Censor"
              class="text-none"
              :disabled="selectedText.lineIndex === -1"
            ></v-btn>
          </template>
          <v-list density="comfortable">
            <v-list-item
              prepend-icon="mdi-text-box-outline"
              title="Invisible"
              subtitle="Hide the selected text entirely"
              @click="applyCensorType(CensorType.Invisible)"
            ></v-list-item>
            <v-list-item
              prepend-icon="mdi-minus-box"
              title="Black Bar"
              subtitle="Cover the selection with a solid black bar"
              @click="applyCensorType(CensorType.BlackBar)"
            ></v-list-item>
            <v-list-item
              prepend-icon="mdi-blur"
              title="Blur"
              subtitle="Blur the selected text while keeping its space"
              @click="applyCensorType(CensorType.Blur)"
            ></v-list-item>
            <v-divider></v-divider>
            <v-list-item
              prepend-icon="mdi-close-circle-outline"
              title="Remove Censor"
              subtitle="Clear censoring from the selected text"
              @click="clearCensorType"
            ></v-list-item>
          </v-list>
        </v-menu>
        <v-tooltip text="Color Selection" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn
              v-bind="props"
              icon="mdi-palette-outline"
              @click="openColorDialog"
              :disabled="selectedText.lineIndex === -1"
            ></v-btn>
          </template>
        </v-tooltip>
        <v-tooltip text="Save Image" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn 
              v-bind="props" 
              icon="mdi-content-save-outline"
              @click="saveImage"
              :disabled="!droppedImageSrc"
            ></v-btn>
          </template>
        </v-tooltip>
      </div>
      </template>
      <template v-else>
        <div class="toolbar-compact-layout">
          <div class="toolbar-compact-row">
            <div class="toolbar-button-group">
              <v-tooltip text="New Session" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon="mdi-plus-box-outline"
                    @click="requestEditorAction({ type: 'new-session' })"
                  ></v-btn>
                </template>
              </v-tooltip>
              <v-tooltip text="Import Chatlog" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" icon="mdi-message-plus-outline" @click="triggerChatFileInput"></v-btn>
                </template>
              </v-tooltip>
              <v-tooltip text="Add Image Overlay" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" icon="mdi-image-multiple-outline" @click="triggerImageOverlayInput"></v-btn>
                </template>
              </v-tooltip>
              <v-tooltip text="Open Projects" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" icon="mdi-folder-open-outline" @click="openProjectsManager"></v-btn>
                </template>
              </v-tooltip>
              <v-tooltip text="Undo (Ctrl+Z)" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon="mdi-undo"
                    :disabled="!canUndo"
                    @click="undoEditorChange"
                  ></v-btn>
                </template>
              </v-tooltip>
              <v-tooltip text="Redo (Ctrl+Y)" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon="mdi-redo"
                    :disabled="!canRedo"
                    @click="redoEditorChange"
                  ></v-btn>
                </template>
              </v-tooltip>
              <v-tooltip text="Save Project (Ctrl+S)" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" icon="mdi-content-save-cog-outline" @click="saveCurrentProject"></v-btn>
                </template>
              </v-tooltip>
              <v-tooltip text="Keyboard Shortcuts (?)" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" icon="mdi-keyboard-outline" @click="openKeyboardShortcuts"></v-btn>
                </template>
              </v-tooltip>
              <v-tooltip text="Settings" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" icon="mdi-cog-outline" @click="showSettingsDialog = true"></v-btn>
                </template>
              </v-tooltip>
              <v-tooltip text="Show Tutorial" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" icon="mdi-help-circle-outline" @click="openTutorial"></v-btn>
                </template>
              </v-tooltip>
            </div>

            <div class="toolbar-button-group">
              <v-menu location="bottom end" :close-on-content-click="false">
                <template v-slot:activator="{ props }">
                  <v-btn
                    v-bind="props"
                    prepend-icon="mdi-account"
                    append-icon="mdi-chevron-down"
                    text="Character"
                    class="text-none"
                  ></v-btn>
                </template>
                <v-card class="toolbar-popover" min-width="280">
                  <v-card-text>
                    <v-text-field
                      v-model="characterName"
                      label="Character Name"
                      density="compact"
                      hide-details
                      variant="solo-filled"
                      flat
                      prepend-inner-icon="mdi-account"
                      @input="reparseChatOverlays"
                    ></v-text-field>
                  </v-card-text>
                </v-card>
              </v-menu>

              <v-menu location="bottom end" :close-on-content-click="false">
                <template v-slot:activator="{ props }">
                  <v-btn
                    v-bind="props"
                    prepend-icon="mdi-ruler"
                    append-icon="mdi-chevron-down"
                    text="Canvas"
                    class="text-none"
                  ></v-btn>
                </template>
                <v-card class="toolbar-popover" min-width="280">
                  <v-card-text class="toolbar-popover-fields">
                    <v-text-field
                      v-model.number="dropZoneWidth"
                      label="Width"
                      type="number"
                      density="compact"
                      hide-details
                      variant="solo-filled"
                      flat
                      prepend-inner-icon="mdi-arrow-expand-horizontal"
                    ></v-text-field>
                    <v-text-field
                      v-model.number="dropZoneHeight"
                      label="Height"
                      type="number"
                      density="compact"
                      hide-details
                      variant="solo-filled"
                      flat
                      prepend-inner-icon="mdi-arrow-expand-vertical"
                    ></v-text-field>
                    <v-text-field
                      v-model.number="chatLineWidth"
                      label="Line Width"
                      type="number"
                      density="compact"
                      hide-details
                      variant="solo-filled"
                      flat
                      prepend-inner-icon="mdi-format-line-spacing"
                      min="300"
                      max="1200"
                      @change="renderKey++"
                    ></v-text-field>
                  </v-card-text>
                </v-card>
              </v-menu>
            </div>
          </div>

          <div class="toolbar-compact-row">
            <div class="toolbar-button-group">
              <v-tooltip text="Enable Image Drag/Zoom (Arrows, +/-)" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon="mdi-drag-variant"
                    :color="isImageDraggingEnabled ? 'primary' : undefined"
                    @click="toggleImageDrag"
                  ></v-btn>
                </template>
              </v-tooltip>
              <v-tooltip text="Reset Image View" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon="mdi-fit-to-screen-outline"
                    :disabled="!droppedImageSrc"
                    @click="resetImageView"
                  ></v-btn>
                </template>
              </v-tooltip>
              <v-tooltip text="Enable Chat Drag/Zoom (Arrows, +/-)" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon="mdi-message-text-lock-outline"
                    :color="isChatDraggingEnabled ? 'primary' : undefined"
                    @click="toggleChatDrag"
                  ></v-btn>
                </template>
              </v-tooltip>
              <v-tooltip text="Toggle Black Bars" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon="mdi-view-day-outline"
                    :color="showBlackBars ? 'primary' : undefined"
                    @click="toggleBlackBars"
                  ></v-btn>
                </template>
              </v-tooltip>
            </div>

            <div class="toolbar-button-group toolbar-button-group-wrap">
              <v-btn
                prepend-icon="mdi-image-filter-center-focus"
                append-icon="mdi-chevron-down"
                text="Effects"
                class="text-none"
                :color="imageEffects.length > 0 ? 'primary' : undefined"
                @click="showEffectsDialog = true"
              ></v-btn>
              <v-menu location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn
                    v-bind="props"
                    prepend-icon="mdi-eye-off"
                    append-icon="mdi-chevron-down"
                    text="Censor"
                    class="text-none"
                    :disabled="selectedText.lineIndex === -1"
                  ></v-btn>
                </template>
                <v-list density="comfortable">
                  <v-list-item
                    prepend-icon="mdi-text-box-outline"
                    title="Invisible"
                    subtitle="Hide the selected text entirely"
                    @click="applyCensorType(CensorType.Invisible)"
                  ></v-list-item>
                  <v-list-item
                    prepend-icon="mdi-minus-box"
                    title="Black Bar"
                    subtitle="Cover the selection with a solid black bar"
                    @click="applyCensorType(CensorType.BlackBar)"
                  ></v-list-item>
                  <v-list-item
                    prepend-icon="mdi-blur"
                    title="Blur"
                    subtitle="Blur the selected text while keeping its space"
                    @click="applyCensorType(CensorType.Blur)"
                  ></v-list-item>
                  <v-divider></v-divider>
                  <v-list-item
                    prepend-icon="mdi-close-circle-outline"
                    title="Remove Censor"
                    subtitle="Clear censoring from the selected text"
                    @click="clearCensorType"
                  ></v-list-item>
                </v-list>
              </v-menu>
              <v-tooltip text="Color Selection" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon="mdi-palette-outline"
                    @click="openColorDialog"
                    :disabled="selectedText.lineIndex === -1"
                  ></v-btn>
                </template>
              </v-tooltip>
              <v-tooltip text="Save Image" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon="mdi-content-save-outline"
                    @click="saveImage"
                    :disabled="!droppedImageSrc"
                  ></v-btn>
                </template>
              </v-tooltip>
            </div>
          </div>
        </div>
      </template>
    </v-toolbar>

    <!-- New Session Confirmation Dialog -->
    <v-dialog v-model="showNewSessionDialog" max-width="400">
      <v-card>
        <v-card-title class="text-h6">
          Start New Session?
        </v-card-title>
        <v-card-text>
          This will clear all current work, including any loaded images and chat data. This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            color="grey-darken-1"
            variant="text"
            @click="showNewSessionDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="red-darken-1"
            variant="text"
            @click="resetSession"
          >
            Reset Everything
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showUnsavedChangesDialog" max-width="460">
      <v-card>
        <v-card-title class="text-h6">
          Unsaved Changes
        </v-card-title>
        <v-card-text>
          Your current work has unsaved changes. Do you want to save before you {{ pendingActionDescription }}?
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            @click="closePendingEditorAction"
          >
            Cancel
          </v-btn>
          <v-btn
            color="grey-darken-1"
            variant="text"
            @click="discardAndContinuePendingAction"
          >
            Don't Save
          </v-btn>
          <v-btn
            color="primary"
            variant="text"
            @click="saveAndContinuePendingAction"
          >
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showTutorialDialog" max-width="760">
      <v-card class="tutorial-card">
        <v-card-title class="d-flex align-center justify-space-between">
          <div>
            <div class="text-h6">Welcome to Screenshot Magician</div>
            <div class="text-body-2 text-medium-emphasis">
              A quick walkthrough so the editor feels easier to understand on first open.
            </div>
          </div>
          <v-chip size="small" variant="tonal" color="primary">
            Step {{ tutorialStepIndex + 1 }} / {{ tutorialSteps.length }}
          </v-chip>
        </v-card-title>
        <v-card-text>
          <v-window v-model="tutorialStepIndex" class="tutorial-window">
            <v-window-item
              v-for="(step, index) in tutorialSteps"
              :key="step.title"
              :value="index"
            >
              <div class="tutorial-step">
                <div class="tutorial-icon-wrap">
                  <v-icon :icon="step.icon" size="36"></v-icon>
                </div>
                <div class="text-h6 mb-3">{{ step.title }}</div>
                <div class="text-body-1 text-medium-emphasis">
                  {{ step.description }}
                </div>
              </div>
            </v-window-item>
          </v-window>

          <div class="tutorial-progress mt-6">
            <div
              v-for="(step, index) in tutorialSteps"
              :key="`${step.title}-dot`"
              :class="['tutorial-progress-dot', { 'is-active': tutorialStepIndex === index }]"
            ></div>
          </div>
        </v-card-text>
        <v-card-actions class="tutorial-actions">
          <v-checkbox
            v-model="dontShowTutorialAgain"
            label="Don't show this again"
            density="compact"
            hide-details
          ></v-checkbox>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="closeTutorial">
            I know what I'm doing
          </v-btn>
          <v-btn
            variant="text"
            :disabled="tutorialStepIndex === 0"
            @click="goToPreviousTutorialStep"
          >
            Back
          </v-btn>
          <v-btn color="primary" @click="goToNextTutorialStep">
            {{ tutorialStepIndex === tutorialSteps.length - 1 ? 'Finish' : 'Next' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showKeyboardShortcutsDialog" max-width="760">
      <v-card class="shortcuts-card">
        <v-card-title class="d-flex align-center justify-space-between">
          <div>
            <div class="text-h6">Keyboard Shortcuts</div>
            <div class="text-body-2 text-medium-emphasis">
              Faster editing, right where you already work.
            </div>
          </div>
          <v-btn icon="mdi-close" variant="text" @click="showKeyboardShortcutsDialog = false"></v-btn>
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
          <v-btn variant="text" @click="showKeyboardShortcutsDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showSettingsDialog" max-width="900">
      <v-card>
        <v-card-title class="d-flex align-center justify-space-between">
          <div>
            <div class="text-h6">Settings</div>
            <div class="text-body-2 text-medium-emphasis">
              Configure how the editor looks today, with room for more preferences later.
            </div>
          </div>
          <v-btn icon="mdi-close" variant="text" @click="showSettingsDialog = false"></v-btn>
        </v-card-title>
        <v-card-text>
          <div class="settings-section mb-6">
            <div class="settings-section-header">
              <div class="text-subtitle-1">Workflow</div>
              <div class="text-body-2 text-medium-emphasis">
                Keep the editor easy to learn with guided help and shortcut discovery that stays out of the way.
              </div>
            </div>
            <div class="settings-action-row">
              <v-btn variant="tonal" color="primary" prepend-icon="mdi-keyboard-outline" @click="openKeyboardShortcuts">
                View Keyboard Shortcuts
              </v-btn>
              <v-btn variant="text" prepend-icon="mdi-help-circle-outline" @click="showSettingsDialog = false; openTutorial()">
                Reopen Tutorial
              </v-btn>
            </div>
            <v-switch
              v-model="showNavigator"
              color="primary"
              inset
              hide-details
              label="Show navigator preview"
              class="mt-4"
            ></v-switch>
          </div>

          <div class="settings-section mb-6">
            <div class="settings-section-header">
              <div class="text-subtitle-1">Smart Guides</div>
              <div class="text-body-2 text-medium-emphasis">
                Control Photoshop-style snapping, alignment guides, and equal spacing guides while dragging layers.
              </div>
            </div>
            <v-switch
              v-model="smartGuidesEnabled"
              color="primary"
              inset
              hide-details
              label="Enable Smart Guides and snapping"
            ></v-switch>
            <div class="text-caption text-medium-emphasis mt-4 mb-2">
              Snap strength: {{ smartGuideStrength }} px
            </div>
            <v-slider
              v-model="smartGuideStrength"
              min="2"
              max="24"
              step="1"
              color="primary"
              hide-details
              :disabled="!smartGuidesEnabled"
            ></v-slider>
            <div class="text-caption text-medium-emphasis mt-2">
              Turn Smart Guides off here anytime you want completely free movement.
            </div>
          </div>

          <div class="settings-section mb-6">
            <div class="settings-section-header">
              <div class="text-subtitle-1">Ads</div>
              <div class="text-body-2 text-medium-emphasis">
                Keep a small home page ad slot visible to help offset hosting, or disable ads entirely for free.
              </div>
            </div>
            <v-switch
              :model-value="showAds"
              color="primary"
              inset
              hide-details
              label="Show home page ads"
              @update:model-value="setShowAds(Boolean($event))"
            ></v-switch>
          </div>

          <div class="settings-section mb-6">
            <div class="settings-section-header">
              <div class="text-subtitle-1">Theme Presets</div>
              <div class="text-body-2 text-medium-emphasis">
                Switch the whole editor between built-in looks.
              </div>
            </div>
            <div class="theme-grid">
              <div
                v-for="themeOption in builtInThemeOptions"
                :key="themeOption.id"
                :class="['theme-card', { 'is-active': getThemeFamilyId(activeEditorThemeId) === themeOption.id }]"
              >
                <div class="theme-variant-label text-caption text-medium-emphasis">Light</div>
                <div class="theme-swatch-row">
                  <span
                    v-for="(color, index) in themeOption.lightPreview"
                    :key="`${themeOption.id}-light-${index}`"
                    class="theme-swatch"
                    :style="{ backgroundColor: color }"
                  ></span>
                </div>
                <div class="theme-variant-label text-caption text-medium-emphasis mt-2">Dark</div>
                <div class="theme-swatch-row theme-swatch-row-dark">
                  <span
                    v-for="(color, index) in themeOption.darkPreview"
                    :key="`${themeOption.id}-dark-${index}`"
                    class="theme-swatch"
                    :style="{ backgroundColor: color }"
                  ></span>
                </div>
                <div class="text-subtitle-2">{{ themeOption.name }}</div>
                <div class="text-caption text-medium-emphasis mb-3">{{ themeOption.description }}</div>
                <div class="theme-card-actions">
                  <v-btn
                    size="small"
                    :variant="activeEditorThemeId === `${themeOption.id}-light` ? 'flat' : 'tonal'"
                    :color="activeEditorThemeId === `${themeOption.id}-light` ? 'primary' : undefined"
                    @click.stop="applyEditorTheme(`${themeOption.id}-light`)"
                  >
                    Light
                  </v-btn>
                  <v-btn
                    size="small"
                    :variant="activeEditorThemeId === `${themeOption.id}-dark` ? 'flat' : 'tonal'"
                    :color="activeEditorThemeId === `${themeOption.id}-dark` ? 'primary' : undefined"
                    @click.stop="applyEditorTheme(`${themeOption.id}-dark`)"
                  >
                    Dark
                  </v-btn>
                </div>
              </div>
            </div>
          </div>

          <div class="settings-section mb-6">
            <div class="settings-section-header">
              <div class="text-subtitle-1">Custom Themes</div>
              <div class="text-body-2 text-medium-emphasis">
                Build your own look, save it locally, and share it with other users.
              </div>
            </div>

            <div class="theme-editor-grid">
              <div class="theme-editor-fields">
                <v-text-field
                  v-model="themeDraftName"
                  label="Theme Name"
                  variant="outlined"
                  density="comfortable"
                  hide-details
                  class="mb-3"
                ></v-text-field>

                <div class="theme-color-grid">
                  <label class="theme-color-field">
                    <span class="text-caption">Background</span>
                    <input v-model="themeDraftColors.background" type="color" class="native-color-picker theme-picker" />
                    <v-text-field v-model="themeDraftColors.background" variant="outlined" density="comfortable" hide-details></v-text-field>
                  </label>
                  <label class="theme-color-field">
                    <span class="text-caption">Surface</span>
                    <input v-model="themeDraftColors.surface" type="color" class="native-color-picker theme-picker" />
                    <v-text-field v-model="themeDraftColors.surface" variant="outlined" density="comfortable" hide-details></v-text-field>
                  </label>
                  <label class="theme-color-field">
                    <span class="text-caption">Surface Variant</span>
                    <input v-model="themeDraftColors.surfaceVariant" type="color" class="native-color-picker theme-picker" />
                    <v-text-field v-model="themeDraftColors.surfaceVariant" variant="outlined" density="comfortable" hide-details></v-text-field>
                  </label>
                  <label class="theme-color-field">
                    <span class="text-caption">Primary</span>
                    <input v-model="themeDraftColors.primary" type="color" class="native-color-picker theme-picker" />
                    <v-text-field v-model="themeDraftColors.primary" variant="outlined" density="comfortable" hide-details></v-text-field>
                  </label>
                  <label class="theme-color-field">
                    <span class="text-caption">Secondary</span>
                    <input v-model="themeDraftColors.secondary" type="color" class="native-color-picker theme-picker" />
                    <v-text-field v-model="themeDraftColors.secondary" variant="outlined" density="comfortable" hide-details></v-text-field>
                  </label>
                </div>

                <div class="d-flex ga-2 mt-4 flex-wrap">
                  <v-btn variant="tonal" @click="populateThemeDraftFromActiveTheme">
                    Use Active Theme
                  </v-btn>
                  <v-btn color="primary" @click="saveCustomEditorTheme">
                    Save Custom Theme
                  </v-btn>
                </div>
              </div>

              <div class="theme-saved-list">
                <div class="text-subtitle-2 mb-2">Saved Custom Themes</div>
                <v-list density="comfortable" bg-color="transparent" class="theme-list">
                  <v-list-item
                    v-for="themeConfig in customEditorThemes"
                    :key="themeConfig.id"
                    rounded="lg"
                    :active="activeEditorThemeId === themeConfig.id"
                  >
                    <template v-slot:prepend>
                      <div class="theme-inline-swatches">
                        <span class="theme-inline-swatch" :style="{ backgroundColor: themeConfig.colors.background }"></span>
                        <span class="theme-inline-swatch" :style="{ backgroundColor: themeConfig.colors.surface }"></span>
                        <span class="theme-inline-swatch" :style="{ backgroundColor: themeConfig.colors.primary }"></span>
                      </div>
                    </template>
                    <v-list-item-title>{{ themeConfig.name }}</v-list-item-title>
                    <v-list-item-subtitle>
                      Saved {{ new Date(themeConfig.createdAt).toLocaleDateString() }}
                    </v-list-item-subtitle>
                    <template v-slot:append>
                      <div class="d-flex ga-1">
                        <v-btn size="small" variant="text" color="primary" @click="applyEditorTheme(themeConfig.id)">
                          Apply
                        </v-btn>
                        <v-btn size="small" variant="text" color="error" @click="deleteCustomEditorTheme(themeConfig.id)">
                          Delete
                        </v-btn>
                      </div>
                    </template>
                  </v-list-item>
                </v-list>
                <div v-if="customEditorThemes.length === 0" class="text-caption text-medium-emphasis">
                  No custom themes saved yet.
                </div>
              </div>
            </div>
          </div>

          <div class="settings-section mb-6">
            <div class="settings-section-header">
              <div class="text-subtitle-1">Share Themes</div>
              <div class="text-body-2 text-medium-emphasis">
                Export your current theme to JSON or import one someone else made.
              </div>
            </div>

            <v-row>
              <v-col cols="12" md="6">
                <div class="text-subtitle-2 mb-2">Export Current Theme</div>
                <v-textarea
                  v-model="themeSharePayload"
                  variant="outlined"
                  rows="8"
                  auto-grow
                  readonly
                  hide-details
                ></v-textarea>
                <v-btn class="mt-3" variant="tonal" color="primary" @click="exportActiveTheme">
                  Generate Theme JSON
                </v-btn>
              </v-col>
              <v-col cols="12" md="6">
                <div class="text-subtitle-2 mb-2">Import Shared Theme</div>
                <v-textarea
                  v-model="themeImportPayload"
                  variant="outlined"
                  rows="8"
                  auto-grow
                  hide-details
                  placeholder='Paste shared theme JSON here'
                ></v-textarea>
                <v-btn class="mt-3" color="primary" @click="importSharedTheme">
                  Import Theme
                </v-btn>
              </v-col>
            </v-row>
          </div>

          <div class="settings-section">
            <div class="settings-section-header">
              <div class="text-subtitle-1">Other Settings</div>
              <div class="text-body-2 text-medium-emphasis">
                More editor defaults and accessibility options can live here as the tool grows.
              </div>
            </div>
            <v-btn variant="tonal" color="primary" @click="showSettingsDialog = false; openTutorial()">
              Reopen Tutorial
            </v-btn>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showSettingsDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showSaveProjectDialog" max-width="520">
      <v-card>
        <v-card-title class="text-h6">
          {{ currentProjectId ? 'Save Project' : 'Create Project' }}
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="pendingProjectName"
            label="Project Name"
            variant="outlined"
            density="comfortable"
            hide-details
            autofocus
          ></v-text-field>
          <div class="text-caption text-medium-emphasis mt-3">
            Projects are stored locally in this browser on this machine, including the current image and all chat layers.
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="closeSaveProjectDialog">Cancel</v-btn>
          <v-btn
            v-if="currentProjectId"
            variant="text"
            color="secondary"
            @click="saveProject({ forceNewProject: true })"
          >
            Save As New
          </v-btn>
          <v-btn color="primary" variant="text" @click="saveProject()">
            {{ currentProjectId ? 'Save' : 'Create' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-navigation-drawer
      v-model="showEffectsDialog"
      location="right"
      temporary
      :scrim="false"
      width="420"
      class="effects-drawer"
    >
      <div class="effects-drawer-content">
        <div class="d-flex align-center justify-space-between mb-4">
          <div>
            <div class="text-h6">Image Effects</div>
            <div class="text-body-2 text-medium-emphasis">
              Keep this panel open while you tweak the canvas.
            </div>
          </div>
          <v-btn icon="mdi-close" variant="text" @click="showEffectsDialog = false"></v-btn>
        </div>

        <div class="d-flex align-center justify-space-between mb-4">
          <v-chip size="small" variant="tonal" color="primary">
            {{ imageEffects.length }} active
          </v-chip>
          <v-btn variant="text" color="error" @click="clearImageEffects">
            Clear All
          </v-btn>
        </div>

        <div class="text-body-2 mb-4">
          Stack texture and finishing layers over the screenshot to push the final mood. Base image is always affected, and each image overlay can opt in or stay clean from its own layer controls.
        </div>

        <div class="effect-preset-list">
          <v-card
            v-for="preset in IMAGE_EFFECT_PRESETS"
            :key="preset.id"
            variant="outlined"
            class="mb-3"
          >
            <v-card-text>
              <div class="d-flex align-start justify-space-between ga-4 flex-wrap">
                <div class="effect-copy">
                  <div class="text-subtitle-1">{{ preset.name }}</div>
                  <div class="text-body-2 text-medium-emphasis">
                    {{ preset.description }}
                  </div>
                </div>
                <v-btn
                  :color="isImageEffectActive(preset.id) ? 'primary' : undefined"
                  :variant="isImageEffectActive(preset.id) ? 'flat' : 'tonal'"
                  @click="toggleImageEffect(preset.id)"
                >
                  {{ isImageEffectActive(preset.id) ? 'Enabled' : 'Enable' }}
                </v-btn>
              </div>

              <div v-if="getImageEffectLayer(preset.id) && preset.supportsOpacity !== false" class="mt-4">
                <div class="d-flex align-center justify-space-between mb-2">
                  <span class="text-caption text-medium-emphasis">Opacity</span>
                  <span class="text-caption text-medium-emphasis">
                    {{ Math.round((getImageEffectLayer(preset.id)?.opacity || 0) * 100) }}%
                  </span>
                </div>
                <div class="d-flex align-center ga-3">
                  <v-slider
                    :model-value="getImageEffectLayer(preset.id)?.opacity || preset.defaultOpacity"
                    min="0.05"
                    max="1"
                    step="0.05"
                    hide-details
                    color="primary"
                    @update:model-value="setImageEffectOpacity(preset.id, Number($event))"
                  ></v-slider>
                  <v-btn
                    v-if="preset.supportsSeed"
                    icon="mdi-dice-5-outline"
                    variant="text"
                    title="Generate a new texture pattern"
                    @click="rerollImageEffect(preset.id)"
                  ></v-btn>
                </div>
              </div>

              <div v-if="getImageEffectLayer(preset.id) && preset.supportsAmount" class="mt-4">
                <div class="d-flex align-center justify-space-between mb-2">
                  <span class="text-caption text-medium-emphasis">{{ preset.amountLabel || 'Amount' }}</span>
                  <span class="text-caption text-medium-emphasis">
                    {{ Math.round((getImageEffectLayer(preset.id)?.amount ?? preset.defaultAmount ?? 0) * 100) }}%
                  </span>
                </div>
                <v-slider
                  :model-value="getImageEffectLayer(preset.id)?.amount ?? preset.defaultAmount ?? 0.35"
                  :min="preset.amountMin ?? 0"
                  :max="preset.amountMax ?? 1"
                  :step="preset.amountStep ?? 0.01"
                  hide-details
                  color="primary"
                  @update:model-value="setImageEffectAmount(preset.id, Number($event))"
                ></v-slider>
              </div>
            </v-card-text>
          </v-card>
        </div>
      </div>
    </v-navigation-drawer>

    <v-dialog v-model="showColorDialog" max-width="620">
      <v-card>
        <v-card-title class="text-h6">Color Selection</v-card-title>
        <v-card-text>
          <div class="text-body-2 mb-3">
            Apply a manual color override to the currently selected text in the chat editor.
          </div>
          <div class="text-subtitle-2 mb-2">Default Swatches</div>
          <div class="swatch-grid mb-4">
            <button
              v-for="swatch in defaultColorSwatches"
              :key="swatch.color"
              type="button"
              class="color-swatch"
              :style="{ backgroundColor: swatch.color }"
              :title="swatch.label"
              :aria-label="swatch.label"
              @click="applyManualColorOverride(swatch.color)"
            ></button>
          </div>

          <div class="text-subtitle-2 mb-2">Custom Swatches</div>
          <div v-if="customColorSwatches.length > 0" class="swatch-grid mb-4">
            <button
              v-for="color in customColorSwatches"
              :key="color"
              type="button"
              class="color-swatch"
              :style="{ backgroundColor: color }"
              :title="formatSwatchLabel(color)"
              :aria-label="formatSwatchLabel(color)"
              @click="applyManualColorOverride(color)"
            ></button>
          </div>
          <div v-else class="text-caption text-medium-emphasis mb-4">
            No custom swatches saved yet.
          </div>

          <div class="d-flex align-center ga-3">
            <input v-model="customColorHex" type="color" class="native-color-picker" />
            <v-text-field
              v-model="customColorHex"
              label="Custom Color"
              variant="outlined"
              density="comfortable"
              hide-details
            ></v-text-field>
            <v-btn variant="tonal" color="primary" @click="addCustomColorSwatch">
              Save Swatch
            </v-btn>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" color="error" @click="removeManualColorOverride">
            Remove Override
          </v-btn>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showColorDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showProjectsDialog" max-width="720">
      <v-card>
        <v-card-title class="d-flex align-center justify-space-between">
          <span class="text-h6">Projects</span>
          <div class="d-flex align-center ga-2 flex-wrap justify-end">
            <v-btn size="small" variant="tonal" prepend-icon="mdi-file-import-outline" @click="triggerProjectFileInput">
              Import .ssmag
            </v-btn>
            <v-btn size="small" variant="tonal" color="primary" prepend-icon="mdi-plus" @click="promptSaveProject">
              New Project Save
            </v-btn>
          </div>
        </v-card-title>
        <v-card-text>
          <div v-if="currentProjectName" class="text-body-2 mb-4">
            Current project: <strong>{{ currentProjectName }}</strong>
          </div>
          <div class="text-caption text-medium-emphasis mb-4">
            Import exported `.ssmag` files into this browser, or export any saved project to move it between machines.
          </div>
          <div v-if="isProjectsLoading" class="text-medium-emphasis">
            Loading projects...
          </div>
          <v-list v-else-if="projectRecords.length > 0" density="comfortable" bg-color="transparent">
            <v-list-item
              v-for="project in projectRecords"
              :key="project.id"
              rounded="lg"
            >
              <template v-slot:prepend>
                <v-icon icon="mdi-folder-outline"></v-icon>
              </template>
              <v-list-item-title>{{ project.name }}</v-list-item-title>
              <v-list-item-subtitle>
                Updated {{ new Date(project.updatedAt).toLocaleString() }}
              </v-list-item-subtitle>
              <template v-slot:append>
                <div class="d-flex align-center">
                  <v-btn
                    size="small"
                    variant="text"
                    color="primary"
                    @click="loadProject(project.id)"
                  >
                    Open
                  </v-btn>
                  <v-btn
                    icon="mdi-file-export-outline"
                    size="small"
                    variant="text"
                    @click="exportProjectFile(project.id)"
                  ></v-btn>
                  <v-btn
                    icon="mdi-delete-outline"
                    size="small"
                    variant="text"
                    color="error"
                    @click="requestDeleteProject(project.id, project.name)"
                  ></v-btn>
                </div>
              </template>
            </v-list-item>
          </v-list>
          <div v-else class="text-medium-emphasis">
            No saved projects yet. Save the current editor state to create one.
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showProjectsDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showDeleteProjectDialog" max-width="440">
      <v-card>
        <v-card-title class="text-h6">
          Delete Project?
        </v-card-title>
        <v-card-text>
          <div class="mb-2">
            This will permanently delete
            <strong>{{ pendingProjectDelete?.name || 'this project' }}</strong>
            from local browser storage.
          </div>
          <div class="text-caption text-medium-emphasis">
            This action cannot be undone unless you exported the project to a `.ssmag` file earlier.
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="closeDeleteProjectDialog">Cancel</v-btn>
          <v-btn color="error" variant="text" @click="confirmDeleteProject">
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Hidden file inputs -->
    <input 
      type="file" 
      ref="fileInputRef"
      class="hidden-input" 
      accept="image/*" 
      @change="handleFileSelect"
    />
    <input
      type="file"
      ref="imageOverlayInputRef"
      class="hidden-input"
      accept="image/*"
      multiple
      @change="handleImageOverlayFileSelect"
    />
    <input 
      type="file" 
      ref="chatFileInputRef"
      class="hidden-input" 
      accept=".txt,text/plain"
      @change="handleChatFileSelect"
    />
    <input
      type="file"
      ref="projectFileInputRef"
      class="hidden-input"
      accept=".ssmag,application/json"
      @change="handleProjectFileImport"
    />

    <!-- Row takes remaining height and full width. Padding applied here. -->
    <div class="layout-container pa-2" ref="parentRowRef">
      <div class="utility-panel" :style="{ width: `${utilityPanelWidth}px` }">
        <v-sheet class="utility-panel-sheet fill-height d-flex flex-column pa-2" style="border-radius: 4px;">
          <div ref="utilityPanelScrollRef" class="utility-panel-scroll">
            <div class="project-status mb-3">
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
                  @click="resetImageView"
                ></v-btn>
              </div>
              <div
                ref="minimapRef"
                class="image-minimap-frame"
                :style="{ width: `${minimapSize.width}px`, height: `${minimapSize.height}px` }"
                @click="recenterImageFromMinimap"
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
                  @click="triggerImageOverlayInput"
                >
                  Add Image
                </v-btn>
              </div>
              <div
                class="image-layer-scroll-region mb-3"
                @wheel="handleImageLayerRailWheel"
              >
                <div class="chat-layer-list">
                  <v-list density="compact" class="pa-0" bg-color="transparent">
                    <v-list-item
                      :active="activeImageOverlayId === null"
                      rounded="lg"
                      @click="selectImageOverlay(null)"
                    >
                      <template v-slot:prepend>
                        <v-icon icon="mdi-image-outline" size="small"></v-icon>
                      </template>
                      <v-list-item-title>Base Screenshot</v-list-item-title>
                      <v-list-item-subtitle>
                        {{ droppedImageSrc ? 'Primary canvas image' : 'No screenshot loaded yet' }}
                      </v-list-item-subtitle>
                      <template v-slot:append>
                        <v-btn
                          icon="mdi-fit-to-screen-outline"
                          size="x-small"
                          variant="text"
                          :disabled="!droppedImageSrc"
                          @click.stop="resetImageView"
                        ></v-btn>
                      </template>
                    </v-list-item>
                    <v-list-item
                      v-for="overlay in imageOverlays"
                      :key="overlay.id"
                      :active="overlay.id === activeImageOverlayId"
                      class="image-layer-list-item"
                      rounded="lg"
                      @click="selectImageOverlay(overlay.id)"
                    >
                      <template v-slot:prepend>
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
                            <template v-slot:activator="{ props }">
                              <v-btn
                                v-bind="props"
                                icon="mdi-arrow-down-bold-outline"
                                size="x-small"
                                variant="text"
                                :disabled="imageOverlays.findIndex((item) => item.id === overlay.id) === imageOverlays.length - 1"
                                @click.stop="moveImageOverlay(overlay.id, 'forward')"
                              ></v-btn>
                            </template>
                          </v-tooltip>
                          <v-tooltip text="Move this layer lower in the stack" location="top">
                            <template v-slot:activator="{ props }">
                              <v-btn
                                v-bind="props"
                                icon="mdi-arrow-up-bold-outline"
                                size="x-small"
                                variant="text"
                                :disabled="imageOverlays.findIndex((item) => item.id === overlay.id) === 0"
                                @click.stop="moveImageOverlay(overlay.id, 'backward')"
                              ></v-btn>
                            </template>
                          </v-tooltip>
                          <v-tooltip :text="overlay.acceptsEffects ? 'Effects are enabled for this layer' : 'Effects are disabled for this layer'" location="top">
                            <template v-slot:activator="{ props }">
                              <v-btn
                                v-bind="props"
                                :icon="overlay.acceptsEffects ? 'mdi-image-filter-center-focus' : 'mdi-image-filter-center-focus-weak'"
                                size="x-small"
                                variant="text"
                                :color="overlay.acceptsEffects ? 'primary' : undefined"
                                @click.stop="toggleImageOverlayEffects(overlay.id)"
                              ></v-btn>
                            </template>
                          </v-tooltip>
                          <v-tooltip :text="overlay.isHidden ? 'Show this layer' : 'Hide this layer'" location="top">
                            <template v-slot:activator="{ props }">
                              <v-btn
                                v-bind="props"
                                :icon="overlay.isHidden ? 'mdi-eye-outline' : 'mdi-eye-off-outline'"
                                size="x-small"
                                variant="text"
                                @click.stop="toggleImageOverlayVisibility(overlay.id)"
                              ></v-btn>
                            </template>
                          </v-tooltip>
                          <v-tooltip :text="overlay.isLocked ? 'Unlock this layer for editing' : 'Lock this layer to prevent editing'" location="top">
                            <template v-slot:activator="{ props }">
                              <v-btn
                                v-bind="props"
                                :icon="overlay.isLocked ? 'mdi-lock-open-variant-outline' : 'mdi-lock-outline'"
                                size="x-small"
                                variant="text"
                                @click.stop="toggleImageOverlayLock(overlay.id)"
                              ></v-btn>
                            </template>
                          </v-tooltip>
                          <v-tooltip text="Duplicate this layer" location="top">
                            <template v-slot:activator="{ props }">
                              <v-btn
                                v-bind="props"
                                icon="mdi-content-copy"
                                size="x-small"
                                variant="text"
                                @click.stop="duplicateImageOverlay(overlay.id)"
                              ></v-btn>
                            </template>
                          </v-tooltip>
                          <v-tooltip text="Delete this layer" location="top">
                            <template v-slot:activator="{ props }">
                              <v-btn
                                v-bind="props"
                                icon="mdi-delete-outline"
                                size="x-small"
                                variant="text"
                                color="error"
                                @click.stop="removeImageOverlay(overlay.id)"
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
              v-model="activeImageOverlay.opacity"
              min="0.05"
              max="1"
              step="0.01"
              hide-details
              color="primary"
            ></v-slider>
            <div class="d-flex align-center justify-space-between text-caption mb-2">
              <span>{{ Math.round(activeImageOverlay.opacity * 100) }}%</span>
              <v-btn
                size="x-small"
                variant="text"
                prepend-icon="mdi-fit-to-screen-outline"
                @click="resetActiveImageOverlayView"
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
              @update:model-value="setImageOverlayTool(($event as ImageOverlayTool) || 'move')"
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
              v-model="imageMaskBrushSize"
              min="8"
              max="640"
              step="1"
              hide-details
              color="primary"
            ></v-slider>
            <div class="image-mask-value-row text-caption mb-1">
              <span>{{ imageMaskBrushSize }} px</span>
            </div>
            <div class="text-caption text-medium-emphasis image-mask-helper-copy mb-2">
              Mouse wheel over the selected layer adjusts brush size.
            </div>
            <div class="text-caption text-medium-emphasis mb-1">Softness</div>
            <v-slider
              v-model="imageMaskBrushSoftness"
              min="0"
              max="1"
              step="0.01"
              hide-details
              color="primary"
            ></v-slider>
            <div class="image-mask-value-row text-caption mb-1">
              <span>{{ Math.round(imageMaskBrushSoftness * 100) }}%</span>
            </div>
            <div class="text-caption text-medium-emphasis image-mask-helper-copy mb-2">
              Softer edges create a smoother blend into the layer below.
            </div>
            <div class="text-caption text-medium-emphasis mb-1">Strength</div>
            <v-slider
              v-model="imageMaskBrushStrength"
              min="0.05"
              max="1"
              step="0.01"
              hide-details
              color="primary"
            ></v-slider>
            <div class="image-mask-action-row text-caption">
              <span>{{ Math.round(imageMaskBrushStrength * 100) }}%</span>
              <v-btn
                size="x-small"
                variant="text"
                prepend-icon="mdi-layers-remove-outline"
                :disabled="!activeImageOverlayHasMask"
                @click="resetActiveImageOverlayMask"
              >
                Clear Mask
              </v-btn>
            </div>
            </v-sheet>
          </div>
        </v-sheet>
      </div>

      <div class="main-content" ref="contentAreaRef">
        <!-- Add aspect ratio container to enforce proper ratio -->
        <div class="aspect-ratio-container" :style="aspectRatioContainerStyle">
          <v-sheet 
            ref="dropZoneRef"
            class="drop-zone d-flex align-center justify-center pa-0"
            :class="{ 
              'is-dragging-over': isDraggingOverDropZone,
              'clickable': !droppedImageSrc 
            }" 
            :style="dropZoneStyle as CSSProperties"
            @dragstart="preventNativePreviewDrag"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            @drop="handleDrop"
            @wheel="handleWheel"
            @click="handleDropZoneClick"
            :role="!droppedImageSrc ? 'button' : undefined"
            :tabindex="!droppedImageSrc ? 0 : undefined"
            @keydown.enter="handleDropZoneClick"
          >
            <!-- Scale indicator when dropzone is scaled down -->
            <div v-if="isScaledDown" class="scale-indicator">
              {{ scaleIndicator }}
            </div>
            <div
              v-for="guide in smartGuideLines"
              :key="`${guide.kind}-${guide.orientation}-${guide.position}-${guide.start}-${guide.end}`"
              :class="[
                'smart-guide-line',
                `smart-guide-line-${guide.orientation}`,
                `smart-guide-line-${guide.kind}`
              ]"
              :style="guide.orientation === 'vertical'
                ? { left: `${guide.position}px`, top: `${guide.start}px`, height: `${Math.max(0, guide.end - guide.start)}px` }
                : { top: `${guide.position}px`, left: `${guide.start}px`, width: `${Math.max(0, guide.end - guide.start)}px` }"
            ></div>
            <div
              v-for="label in smartGuideLabels"
              :key="`${label.text}-${label.x}-${label.y}`"
              class="smart-guide-label"
              :style="{ left: `${label.x}px`, top: `${label.y}px` }"
            >
              {{ label.text }}
            </div>
            
            <!-- Display Dropped Image -->
            <img 
              v-if="droppedImageSrc"
              ref="imageElementRef"
              :src="droppedImageSrc" 
              alt="Dropped Screenshot"
              class="dropped-image"
              :style="imageStyle as CSSProperties"
              draggable="false"
              @dragstart="preventNativePreviewDrag"
              @pointerdown="handleImageMouseDown"
              @dblclick="enableImageDragFromCanvas"
            />
            <canvas
              v-for="overlay in effectAwareImageOverlays.affected"
              v-show="droppedImageSrc"
              :ref="(element) => setImageOverlayElement(overlay.id, element)"
              :key="overlay.id"
              class="dropped-image image-overlay-layer"
              :style="getImageOverlayStyles(overlay) as CSSProperties"
              @dragstart="preventNativePreviewDrag"
              @pointerdown.stop="handleImageOverlayMouseDown($event, overlay.id)"
              @pointermove.stop="handleImageOverlayPointerMove($event, overlay.id)"
              @pointerleave="handleImageOverlayPointerLeave(overlay.id)"
              @dblclick.stop.prevent="enableImageOverlayDragFromCanvas($event, overlay.id)"
              @wheel="handleImageOverlayWheel($event, overlay.id)"
            ></canvas>
            <div
              v-for="preview in activeImageEffectPreviews"
              v-show="droppedImageSrc"
              :key="`${preview.effect.presetId}-${preview.effect.seed}`"
              class="image-effect-layer"
              :style="getImageEffectPreviewStyle(preview) as CSSProperties"
              @dragstart="preventNativePreviewDrag"
            ></div>
            <img
              v-if="shouldShowSceneImageEffectPreview && sceneImageEffectPreviewDataUrl"
              :src="sceneImageEffectPreviewDataUrl"
              alt="Scene effect preview"
              class="scene-effect-preview-layer"
              :style="sceneImageEffectPreviewStyle as CSSProperties"
              draggable="false"
              @dragstart="preventNativePreviewDrag"
            />
            <canvas
              v-for="overlay in effectAwareImageOverlays.unaffected"
              v-show="droppedImageSrc"
              :ref="(element) => setImageOverlayElement(overlay.id, element)"
              :key="overlay.id"
              class="dropped-image image-overlay-layer"
              :style="getImageOverlayStyles(overlay) as CSSProperties"
              @dragstart="preventNativePreviewDrag"
              @pointerdown.stop="handleImageOverlayMouseDown($event, overlay.id)"
              @pointermove.stop="handleImageOverlayPointerMove($event, overlay.id)"
              @pointerleave="handleImageOverlayPointerLeave(overlay.id)"
              @dblclick.stop.prevent="enableImageOverlayDragFromCanvas($event, overlay.id)"
              @wheel="handleImageOverlayWheel($event, overlay.id)"
            ></canvas>
            <div
              v-if="imageMaskBrushPreview.visible && isImageOverlayBrushActive"
              class="image-mask-brush-preview"
              :style="imageMaskBrushPreviewStyle as CSSProperties"
            ></div>
            <!-- Display Placeholder -->
            <div v-if="!droppedImageSrc" class="text-center">
              <v-icon size="x-large" color="grey-darken-1">mdi-paperclip</v-icon>
              <div class="text-grey-darken-1 mt-2">Click or drag and drop your screenshot here</div>
            </div>

            <!-- Chat Overlay with fixed-width wrapping -->
            <div
              v-for="overlay in chatOverlays"
              v-show="overlay.parsedLines.length > 0 && droppedImageSrc && !overlay.isHidden"
              :ref="(element) => setChatOverlayElement(overlay.id, element)"
              :key="`${overlay.id}-${renderKey}`"
              class="chat-overlay"
              @pointerdown.stop="handleChatMouseDown($event, overlay.id)"
              @dblclick.stop.prevent="enableChatDragFromCanvas($event, overlay.id)"
              @wheel="handleChatWheel($event, overlay.id)"
              @dragstart="preventNativePreviewDrag"
              :style="getChatStyles(overlay)"
            >
              <div
                class="chat-lines-container"
                @dblclick.stop.prevent="enableChatDragFromCanvas($event, overlay.id)"
              >
                <div
                  v-for="(line, index) in overlay.parsedLines"
                  :key="line.id"
                  class="chat-line"
                  :style="{ width: `${overlay.lineWidth}px` }"
                  @dblclick.stop.prevent="enableChatDragFromCanvas($event, overlay.id)"
                >
                  <span
                    :class="['chat-text', { 'chat-text-black-bars': showBlackBars }]"
                    @dblclick.stop.prevent="enableChatDragFromCanvas($event, overlay.id)"
                    v-html="buildStyledLineHtml(overlay, index, line.text)"
                  ></span>
                </div>
              </div>
            </div>
          </v-sheet>
        </div>
      </div>

      <!-- Add resize handle between columns -->
      <div 
        class="resize-handle"
        @mousedown.prevent="handleResizeMouseDown"
      ></div>

      <!-- Right side chatlog panel -->
      <div class="chatlog-panel" ref="chatPanelRef" :style="{ width: chatPanelFlexBasis }">
        <v-sheet class="chatlog-panel-sheet fill-height d-flex flex-column pa-2" style="border-radius: 4px;">
          <div class="d-flex align-center justify-space-between mb-2">
            <div class="text-subtitle-1">Chat Layers</div>
            <v-btn
              size="small"
              variant="tonal"
              color="primary"
              prepend-icon="mdi-plus"
              @click="startNewChatLayer"
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
                @click="selectChatOverlay(overlay.id)"
              >
                <template v-slot:prepend>
                  <v-icon :icon="overlay.isHidden ? 'mdi-message-off-outline' : 'mdi-message-text-outline'" size="small"></v-icon>
                </template>
                <v-list-item-title>{{ overlay.name }}</v-list-item-title>
                <v-list-item-subtitle>
                  {{ overlay.parsedLines.length }} lines
                  <span v-if="overlay.isHidden"> • Hidden</span>
                  <span v-if="overlay.isLocked"> • Locked</span>
                </v-list-item-subtitle>
                <template v-slot:append>
                  <div class="d-flex align-center ga-1">
                    <v-btn
                      :icon="overlay.isHidden ? 'mdi-eye-outline' : 'mdi-eye-off-outline'"
                      size="x-small"
                      variant="text"
                      @click.stop="toggleChatOverlayVisibility(overlay.id)"
                    ></v-btn>
                    <v-btn
                      :icon="overlay.isLocked ? 'mdi-lock-open-variant-outline' : 'mdi-lock-outline'"
                      size="x-small"
                      variant="text"
                      @click.stop="toggleChatOverlayLock(overlay.id)"
                    ></v-btn>
                    <v-btn
                      icon="mdi-content-copy"
                      size="x-small"
                      variant="text"
                      @click.stop="duplicateChatOverlay(overlay.id)"
                    ></v-btn>
                    <v-btn
                      icon="mdi-delete-outline"
                      size="x-small"
                      variant="text"
                      color="error"
                      @click.stop="removeChatOverlay(overlay.id)"
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
              v-model="chatlogText"
              :placeholder="activeChatOverlay
                ? 'Edit the selected chat layer, then hit Parse or Ctrl+Enter to update it.'
                : 'Paste a new chatlog here, then hit Parse or Ctrl+Enter to add it as a new layer.'"
              class="chatlog-textarea mb-1"
              density="compact"
              variant="outlined"
              hide-details
              no-resize
              @keyup.ctrl.enter="parseChatlog"
              @mouseup="handleTextSelection"
              @select="handleTextSelection"
              @keyup="handleTextSelection"
            ></v-textarea>
          </div>
          <v-sheet
            v-if="activeChatOverlay"
            class="censored-region-panel mb-2"
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
                @click="focusCensoredRegion(region)"
              >
                <v-list-item-title class="text-body-2">
                  {{ region.preview }}
                </v-list-item-title>
                <v-list-item-subtitle>
                  {{ region.label }}
                </v-list-item-subtitle>
                <template v-slot:append>
                  <div class="d-flex align-center ga-1">
                    <v-btn
                      icon="mdi-crosshairs"
                      size="x-small"
                      variant="text"
                      @click.stop="focusCensoredRegion(region)"
                    ></v-btn>
                    <v-btn
                      icon="mdi-close-circle-outline"
                      size="x-small"
                      variant="text"
                      color="error"
                      @click.stop="removeCensoredRegion(region)"
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
                  @click="clearChatlog"
                  density="compact"
                >
                  Clear
                </v-btn>
              </v-col>
              <v-col class="ps-1">
                <v-btn
                  color="grey-darken-3"
                  block
                  @click="parseChatlog"
                  density="compact"
                >
                  {{ activeChatOverlay ? 'Update' : 'Parse' }}
                </v-btn>
              </v-col>
            </v-row>
          </div>
        </v-sheet>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Add explicit fixed-width style for chat display */
.chat-lines-container {
  position: relative;
  width: 100%; 
  padding: 0;
  margin: 0;
}

.chat-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: auto;
  pointer-events: auto;
  user-select: none;
  -webkit-user-select: none;
  -webkit-user-drag: none;
  overflow: visible;
  transform-origin: top left;
  will-change: transform;
  z-index: 2;
}

.chat-line {
  position: relative;
  display: block;
  user-select: none;
  -webkit-user-select: none;
  font-family: Arial, sans-serif;
  font-size: 12px;
  line-height: 1.3;
  padding: 0;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  width: v-bind('chatLineWidth + "px"');
  margin: 0;
  text-shadow: 
    -1px -1px 0 #000,
    -1px 0 0 #000,
    -1px 1px 0 #000,
    0 -1px 0 #000,
    0 1px 0 #000,
    1px -1px 0 #000,
    1px 0 0 #000,
    1px 1px 0 #000;
  -webkit-font-smoothing: none !important;
  font-weight: 700;
  letter-spacing: 0;
}

.chat-text {
  display: inline;
  padding-right: 5px;
  user-select: none !important;
  -webkit-user-select: none !important;
  cursor: inherit;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}

.chat-text-black-bars {
  background-color: #000000;
  box-shadow:
    -2px 0 0 #000000,
    2px 0 0 #000000;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}

/* Keep other CSS styles the same */
.magician-wrapper {
  background-color: rgb(var(--v-theme-surface-variant));
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.drop-zone {
  border: 2px dashed transparent;
  transition: background-color 0.2s ease, border-color 0.2s ease;
  -webkit-user-drag: none;
}

.drop-zone.clickable:hover {
  border-color: #42a5f5;
  background-color: #e3f2fd;
  cursor: pointer;
}

.drop-zone.clickable:focus {
  outline: none;
  border-color: #42a5f5;
  background-color: #e3f2fd;
}

.dropped-image {
  display: block;
  user-select: none; /* Prevent image selection during drag */
  -webkit-user-drag: none; /* Prevent browser native image drag */
  position: absolute; /* Ensure it fits within the container */
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain; /* Scale image while preserving aspect ratio */
  z-index: 0;
}

.image-overlay-layer {
  width: auto;
  height: auto;
  object-fit: initial;
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

.image-mask-brush-preview {
  position: absolute;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.92);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.58),
    0 0 0 9999px rgba(255, 255, 255, 0);
  background:
    radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.04) 48%, rgba(255, 255, 255, 0) 72%);
  pointer-events: none;
  z-index: 260;
  backdrop-filter: invert(1);
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

.image-effect-layer {
  border-radius: inherit;
  z-index: 1;
  -webkit-user-drag: none;
}

.scene-effect-preview-layer {
  border-radius: inherit;
  display: block;
  -webkit-user-drag: none;
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
  max-height: 180px;
  overflow-y: auto;
}

.censored-region-item {
  margin-bottom: 4px;
}

.hidden-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

/* Censoring styles */
:deep(.censored-invisible) {
  opacity: 0;
  user-select: none;
  -webkit-user-select: none;
  display: inline;
  background-color: transparent;
  text-shadow: none !important;
}

:deep(.censored-blackbar) {
  background-color: #000000;
  color: transparent;
  user-select: none;
  -webkit-user-select: none;
  display: inline;
  padding: 0;
  text-shadow: none !important;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}

:deep(.censored-blur) {
  filter: blur(5px);
  user-select: none;
  -webkit-user-select: none;
  display: inline;
  padding: 0;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}

.fill-height {
  height: 100%;
}

.editor-toolbar {
  overflow: visible;
}

.editor-toolbar-compact {
  min-height: auto !important;
  height: auto !important;
  padding-top: 6px;
  padding-bottom: 6px;
}

.editor-toolbar-compact :deep(.v-toolbar__content) {
  height: auto !important;
  min-height: auto !important;
  align-items: stretch;
  padding-top: 6px;
  padding-bottom: 6px;
}

.toolbar-compact-layout {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.toolbar-compact-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.toolbar-popover {
  backdrop-filter: blur(8px);
}

.toolbar-popover-fields {
  display: grid;
  gap: 10px;
}

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

.toolbar-button-group .v-btn {
  margin: 0 2px;
}

.toolbar-button-group .v-text-field {
  margin: 0 4px;
}

.toolbar-button-group {
  display: flex;
  align-items: center; /* Align text fields vertically */
}

.toolbar-button-group-wrap {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.resize-handle {
  width: 8px; /* Even wider for easier targeting */
  cursor: col-resize;
  background-color: rgba(128, 128, 128, 0.5);
  height: 100%;
  flex-shrink: 0;
  transition: background-color 0.2s ease;
  position: relative; /* Added for pseudo-element positioning */
  z-index: 1; /* Ensure it's above other elements */
}

.resize-handle:hover {
  background-color: rgba(128, 128, 128, 0.8);
}

/* Add visual indicator in the middle of the handle */
.resize-handle::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  height: 80px; /* Taller indicator */
  width: 2px;
  background-color: rgba(200, 200, 200, 0.9); /* Brighter color */
  border-radius: 1px;
}

/* Add dots to make it more visible as a grip */
.resize-handle::before {
  content: ':::';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(90deg);
  font-size: 12px;
  color: rgba(240, 240, 240, 0.7); /* Light colored dots */
  letter-spacing: 2px;
}

.layout-container {
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative; /* Ensure proper stacking context */
  gap: 0;
}

.utility-panel {
  height: 100%;
  padding: 4px;
  flex-shrink: 0;
  min-width: 0;
}

.main-content {
  height: 100%;
  display: flex;
  flex: 1 1 auto;
  justify-content: center;
  align-items: center;
  padding: 4px;
  min-width: 0;
}

.chatlog-panel {
  height: 100%;
  padding: 4px;
  flex-shrink: 0;
}

.utility-panel-sheet,
.chatlog-panel-sheet {
  background: #131213 !important;
  color: #f3f4f6 !important;
  min-height: 0;
  overflow: hidden;
}

.utility-panel-sheet {
  min-width: 0;
}

.utility-panel-sheet :deep(.text-medium-emphasis),
.utility-panel-sheet .text-medium-emphasis,
.utility-panel-sheet .text-caption,
.utility-panel-sheet .text-body-2,
.chatlog-panel-sheet :deep(.text-medium-emphasis),
.chatlog-panel-sheet .text-medium-emphasis,
.chatlog-panel-sheet .text-caption,
.chatlog-panel-sheet .text-body-2 {
  color: rgba(243, 244, 246, 0.78) !important;
}

.utility-panel-sheet .text-subtitle-2,
.utility-panel-sheet .text-subtitle-1,
.chatlog-panel-sheet .text-subtitle-2,
.chatlog-panel-sheet .text-subtitle-1 {
  color: #f3f4f6 !important;
}

.swatch-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.color-swatch {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.35);
  cursor: pointer;
}

.effect-copy {
  min-width: 0;
  flex: 1;
}

.effects-drawer-content {
  height: 100%;
  overflow-y: auto;
  padding: 20px 18px 24px;
  background: rgb(var(--v-theme-surface));
}

.tutorial-card {
  overflow: hidden;
}

.tutorial-window {
  min-height: 240px;
}

.tutorial-step {
  min-height: 220px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 12px 20px;
}

.tutorial-icon-wrap {
  width: 72px;
  height: 72px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  background: linear-gradient(135deg, rgba(66, 165, 245, 0.18), rgba(171, 71, 188, 0.18));
  color: rgb(var(--v-theme-primary));
}

.tutorial-progress {
  display: flex;
  justify-content: center;
  gap: 10px;
}

.tutorial-progress-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  transition: transform 0.2s ease, background-color 0.2s ease;
}

.tutorial-progress-dot.is-active {
  background: rgb(var(--v-theme-primary));
  transform: scale(1.2);
}

.tutorial-actions {
  gap: 8px;
  flex-wrap: wrap;
}

.settings-section + .settings-section {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 24px;
}

.settings-section-header {
  margin-bottom: 16px;
}

.settings-action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.theme-card {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.02);
  color: inherit;
  text-align: left;
  padding: 14px;
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease, background-color 0.2s ease;
}

.theme-card:hover {
  transform: translateY(-1px);
  border-color: rgba(255, 255, 255, 0.18);
}

.theme-card.is-active {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.08);
}

.theme-swatch-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-bottom: 12px;
}

.theme-swatch-row-dark {
  margin-bottom: 14px;
}

.theme-swatch {
  height: 24px;
  border-radius: 999px;
}

.theme-variant-label {
  display: block;
  margin-bottom: 6px;
}

.theme-card-actions {
  display: flex;
  gap: 8px;
}

.theme-editor-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(260px, 0.9fr);
  gap: 18px;
}

.theme-color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.theme-color-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.theme-picker {
  width: 100%;
  height: 42px;
}

.theme-list {
  max-height: 320px;
  overflow-y: auto;
}

.theme-inline-swatches {
  display: flex;
  gap: 4px;
}

.theme-inline-swatch {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
}

.native-color-picker {
  width: 48px;
  height: 48px;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
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

.aspect-ratio-container {
  position: relative;
  width: 100%;
  height: 0; /* Height will be determined by padding-top */
  max-height: 100%;
  padding-bottom: 0;
  overflow: visible;
}

/* Add styles for the drop-zone when inside an aspect ratio container */
.aspect-ratio-container .drop-zone {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(var(--container-scale, 1));
  transform-origin: center center;
}

@media (max-width: 960px) {
  .theme-editor-grid {
    grid-template-columns: 1fr;
  }

  .toolbar-compact-row {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-button-group,
  .toolbar-button-group-wrap {
    justify-content: center;
  }
}

.scale-indicator {
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  z-index: 10;
  pointer-events: none;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.smart-guide-line {
  position: absolute;
  pointer-events: none;
  z-index: 300;
  background: rgba(66, 165, 245, 0.92);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.18);
}

.smart-guide-line-vertical {
  width: 1px;
}

.smart-guide-line-horizontal {
  height: 1px;
}

.smart-guide-line-spacing {
  background: rgba(255, 193, 7, 0.95);
  box-shadow: 0 0 0 1px rgba(19, 18, 19, 0.25);
}

.smart-guide-label {
  position: absolute;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 301;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(19, 18, 19, 0.92);
  color: #f8fafc;
  font-size: 11px;
  line-height: 1.2;
  white-space: nowrap;
  border: 1px solid rgba(255, 255, 255, 0.14);
}

</style>
