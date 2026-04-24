// src/components/Magician.vue

<script setup lang="ts">
import { ref, computed, reactive, shallowRef, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { type ComponentPublicInstance, type CSSProperties } from 'vue';
import { useDisplay, useTheme } from 'vuetify';
import Cookies from 'js-cookie';
import ChatEditorPanel from '@/components/ChatEditorPanel.vue';
import GuidedTutorialPanel from '@/components/GuidedTutorialPanel.vue';
import KeyboardShortcutsDialog from '@/components/KeyboardShortcutsDialog.vue';
import UtilitySidebar from '@/components/UtilitySidebar.vue';
import { useAdPreferences } from '@/composables/useAdPreferences';
import { useAnalytics } from '@/composables/useAnalytics';
import { copyTextToClipboard, uploadImageToImgBb } from '@/composables/useImageHosting';
import { recordImageExport } from '@/composables/useLiveStats';
import { useUnsavedNavigationStore } from '@/stores/unsavedNavigation';
import {
  CensorType,
  type ChatOverlay,
  type ChatTransform,
  type EditorHistoryEntry,
  type EditorStateSnapshot,
  type ImageEffectLayer,
  type ImageEffectPreset,
  type ImageEffectPreviewEntry,
  type ImageOverlay,
  type ImageOverlayTool,
  type PendingEditorAction,
  type PortableProjectFile,
  type ProjectRecord,
  type SwatchEntry,
  type TutorialStep
} from '@/features/magician/types';
import {
  DEFAULT_CHAT_LINE_WIDTH,
  DEFAULT_IMAGE_MASK_BRUSH_SIZE,
  DEFAULT_IMAGE_MASK_BRUSH_SOFTNESS,
  DEFAULT_IMAGE_MASK_BRUSH_STRENGTH,
  DEFAULT_SELECTED_TEXT,
  HISTORY_COMMIT_DELAY_MS,
  HISTORY_LIMIT,
  MAX_IMAGE_MASK_BRUSH_SIZE,
  MIN_IMAGE_MASK_BRUSH_SIZE,
  PROJECT_AUTOSAVE_DELAY_MS,
  IMAGE_HOSTING_IMGBB_API_KEY_STORAGE_KEY,
  SHARE_PROMPT_ENABLED_STORAGE_KEY,
  SHOW_NAVIGATOR_STORAGE_KEY,
  SMART_GUIDES_ENABLED_STORAGE_KEY,
  SMART_GUIDE_STRENGTH_STORAGE_KEY,
  TUTORIAL_DISMISSED_COOKIE
} from '@/features/magician/constants';
import { tutorialSteps, shortcutGroups } from '@/features/magician/content';
import { builtInThemeOptions } from '@/features/magician/themeConfig';
import { IMAGE_EFFECT_PRESETS, imageEffectPresetMap } from '@/features/magician/imageEffects';
import { colorMappings, formatSwatchLabel } from '@/features/magician/chatColors';
import { loadStoredProject, saveStoredProject } from '@/features/magician/storage';
import { getThemeFamilyId, useMagicianThemes } from '@/features/magician/useMagicianThemes';
import { useMagicianProjects } from '@/features/magician/useMagicianProjects';
import { useMagicianSessionPersistence } from '@/features/magician/useMagicianSessionPersistence';
import { useMagicianChatLayers } from '@/features/magician/useMagicianChatLayers';
import { useMagicianImageOverlayRuntime } from '@/features/magician/useMagicianImageOverlayRuntime';
import { useMagicianCanvasInteraction } from '@/features/magician/useMagicianCanvasInteraction';

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
const chatPanelFlexBasis = ref('25%'); // Default width as string with %
const mainContentFlexBasis = ref('75%'); // Default width for main content

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
const pendingProjectName = ref('');
const pendingProjectDelete = ref<{ id: string; name: string } | null>(null);
const isProjectsLoading = ref(false);
const showColorDialog = ref(false);
const customColorHex = ref('#ffffff');
const customColorSwatches = ref<string[]>([]);
const imageEffects = ref<ImageEffectLayer[]>([]);
const dontShowTutorialAgain = ref(false);
const tutorialStepIndex = ref(0);
const tutorialDemoStarted = ref(false);
const tutorialDemoReady = ref(false);
const isApplyingTutorialDemoState = ref(false);
const imageHostImgBbApiKey = ref('');
const isImageHostUploadInProgress = ref(false);
const lastUploadedImageUrl = ref('');
const showShareDialog = ref(false);
const sharePromptContext = ref<'export' | 'upload'>('export');
const shareSnippetStyle = ref<'short' | 'casual' | 'forum'>('casual');
const sharePromptEnabled = ref(true);
const disableSharePromptOnClose = ref(false);
const editorNoticeVisible = ref(false);
const editorNoticeMessage = ref('');
const editorNoticeTone = ref<'error' | 'success' | 'info'>('error');
const vuetifyTheme = useTheme();
const {
  activeEditorThemeId,
  applyEditorTheme,
  customEditorThemes,
  deleteCustomEditorTheme,
  exportActiveTheme,
  importSharedTheme,
  loadEditorThemes,
  populateThemeDraftFromActiveTheme,
  saveCustomEditorTheme,
  themeDraftColors,
  themeDraftName,
  themeImportPayload,
  themeSharePayload
} = useMagicianThemes(vuetifyTheme);
const { width: viewportWidth } = useDisplay();
const { showAds, setShowAds } = useAdPreferences();
const { trackEvent } = useAnalytics();
const isApplyingHistoryState = ref(false);
let historyCommitTimer: ReturnType<typeof setTimeout> | null = null;
let projectAutosaveTimer: ReturnType<typeof setTimeout> | null = null;
let editorStatePersistTimer: ReturnType<typeof setTimeout> | null = null;
let applyHistoryStateTimer: ReturnType<typeof setTimeout> | null = null;
let dropzoneScaleAnimationFrame: number | null = null;
let windowResizeHandler: (() => void) | null = null;

// --- Image Manipulation State ---
const isImageDraggingEnabled = ref(false);
const imageTransform = reactive({ x: 0, y: 0, scale: 1 });
const activeImageDragTarget = ref<'base' | 'overlay'>('base');
const imageOverlayTool = ref<ImageOverlayTool>('move');
const imageMaskBrushSize = ref(DEFAULT_IMAGE_MASK_BRUSH_SIZE);
const imageMaskBrushSoftness = ref(DEFAULT_IMAGE_MASK_BRUSH_SOFTNESS);
const imageMaskBrushStrength = ref(DEFAULT_IMAGE_MASK_BRUSH_STRENGTH);
const isImageMaskPainting = ref(false);
const activeImageMaskOverlayId = ref<string | null>(null);
const imageMaskBrushPreview = reactive({
  visible: false,
  x: 0,
  y: 0,
  diameter: DEFAULT_IMAGE_MASK_BRUSH_SIZE
});

// --- Chat Manipulation State ---
const isChatDraggingEnabled = ref(false);

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

// Replace first/last name with single character name
const characterName = ref('');

// Watch character name changes and save to cookie
watch(characterName, (newValue) => {
  if (isApplyingTutorialDemoState.value) return;
  Cookies.set('characterName', newValue, { expires: 365 }); // Save for 1 year
});

// Update color mappings to handle all GTA World patterns
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

const setUtilityPanelScrollElement = (element: Element | ComponentPublicInstance | null) => {
  utilityPanelScrollRef.value = element instanceof HTMLElement ? element : null;
};

const setMinimapElement = (element: Element | ComponentPublicInstance | null) => {
  minimapRef.value = element instanceof HTMLElement ? element : null;
};

const updateActiveImageOverlayOpacity = (value: number) => {
  if (!activeImageOverlay.value) return;
  activeImageOverlay.value.opacity = value;
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

const {
  buildMaskedImageOverlayCanvas,
  clearImageOverlayMaskRuntimeState,
  clearImageOverlayRuntimeState,
  disposeImageOverlayRuntime,
  ensureImageOverlayMaskCanvas,
  finishImageOverlayMaskPainting,
  getImageOverlayCanvasPoint,
  hideImageMaskBrushPreview,
  imageOverlayElementMap,
  imageOverlayMaskCanvasMap,
  loadOverlaySourceImage,
  paintImageOverlayMaskSegment,
  renderAllImageOverlayCanvases,
  renderImageOverlayCanvas,
  setImageOverlayElement,
  syncImageOverlayRuntimeState,
  updateImageMaskBrushPreview
} = useMagicianImageOverlayRuntime({
  activeImageMaskOverlayId,
  clampImageMaskBrushSoftness,
  clampImageMaskBrushStrength,
  dropZoneRef,
  getCanvasInteractionScale: () => getCanvasInteractionScale(),
  imageMaskBrushPreview,
  imageMaskBrushSize,
  imageMaskBrushSoftness,
  imageMaskBrushStrength,
  imageOverlayTool,
  imageOverlays,
  isImageMaskPainting
});

const {
  clearSmartGuides,
  disposeCanvasInteraction,
  enableChatDragFromCanvas,
  enableImageDragFromCanvas,
  enableImageOverlayDragFromCanvas,
  handleChatMouseDown,
  handleChatMouseUpOrLeave,
  handleChatWheel,
  handleImageMouseDown,
  handleImageMouseUpOrLeave,
  handleImageOverlayMouseDown,
  handleImageOverlayPointerLeave,
  handleImageOverlayPointerMove,
  handleImageOverlayWheel,
  handleResizeMouseDown,
  handleWheel,
  isChatPanning,
  isGuideBypassActive,
  isPanning,
  isQBypassHeld,
  pendingImageDragPosition,
  setChatOverlayElement,
  smartGuideLabels,
  smartGuideLines,
  toggleChatDrag,
  toggleImageDrag
} = useMagicianCanvasInteraction({
  activeChatOverlay,
  activeChatOverlayId,
  activeImageDragTarget,
  activeImageMaskOverlayId,
  activeImageOverlay,
  activeImageOverlayId,
  chatOverlays,
  chatPanelFlexBasis,
  clampImageMaskBrushSize,
  dropZoneHeight,
  dropZoneWidth,
  droppedImageSrc,
  ensureImageOverlayMaskCanvas,
  finishImageOverlayMaskPainting,
  getCanvasInteractionScale: () => getCanvasInteractionScale(),
  getImageOverlayCanvasPoint,
  hideImageMaskBrushPreview,
  imageElementRef,
  imageMaskBrushSize,
  imageOverlays,
  imageOverlayElementMap,
  imageOverlayTool,
  imageTransform,
  isChatDraggingEnabled,
  isImageDraggingEnabled,
  isImageMaskPainting,
  isImageOverlayBrushActive,
  mainContentFlexBasis,
  paintImageOverlayMaskSegment,
  parentRowRef,
  selectChatOverlay: (overlayId: string) => selectChatOverlay(overlayId),
  selectImageOverlay,
  smartGuidesEnabled,
  smartGuideStrength,
  updateImageMaskBrushPreview
});

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

  const baseImage = await loadOverlaySourceImage(droppedImageSrc.value);
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
  if (applyHistoryStateTimer) {
    clearTimeout(applyHistoryStateTimer);
  }
  const clearApplyingHistoryState = () => {
    isApplyingHistoryState.value = false;
    applyHistoryStateTimer = null;
  };
  applyHistoryStateTimer = window.setTimeout(clearApplyingHistoryState, 0);
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
const editorNoticeIcon = computed(() => {
  if (editorNoticeTone.value === 'success') return 'mdi-check-circle-outline';
  if (editorNoticeTone.value === 'info') return 'mdi-information-outline';
  return 'mdi-alert-circle-outline';
});

const getErrorDetails = (error: unknown) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  return '';
};

const showEditorNotice = (
  message: string,
  tone: 'error' | 'success' | 'info' = 'error'
) => {
  editorNoticeMessage.value = message;
  editorNoticeTone.value = tone;
  editorNoticeVisible.value = true;
};

const reportError = (message: string, error?: unknown) => {
  const details = getErrorDetails(error);
  console.error(message, error);
  showEditorNotice(details ? `${message} ${details}` : message, 'error');
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(String(event.target?.result || ''));
    reader.onerror = () => reject(reader.error ?? new Error(`Unable to read "${file.name}".`));
    reader.readAsDataURL(file);
  });

const getExportFileName = () => {
  const projectSegment = currentProjectName.value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const dateSegment = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `${projectSegment || 'screenshot-magician'}-${dateSegment}.png`;
};

const appShareUrl = computed(() => {
  if (typeof window === 'undefined') {
    return '';
  }

  return new URL(import.meta.env.BASE_URL || '/', window.location.origin).toString();
});

const sharePromptHeadline = computed(() =>
  sharePromptContext.value === 'upload'
    ? 'Your image link is copied. Want to share the app too?'
    : 'Export complete. Want to share the app too?'
);

const sharePromptBody = computed(() =>
  sharePromptContext.value === 'upload'
    ? 'If this upload flow saved you time, send Screenshot Magician to someone still wrestling with Photoshop.'
    : 'If this export saved you time, send Screenshot Magician to someone still wrestling with Photoshop.'
);

const shareSnippetText = computed(() => {
  const appUrl = appShareUrl.value;

  if (shareSnippetStyle.value === 'short') {
    return `Screenshot Magician saved me a ton of time for GTA World screenshots: ${appUrl}`;
  }

  if (shareSnippetStyle.value === 'forum') {
    return `Made this with Screenshot Magician.\nWay faster than Photoshop for GTA World screenshots.\n${appUrl}`;
  }

  return `Been using Screenshot Magician for GTA World screenshots and it is way faster than Photoshop for this kind of work: ${appUrl}`;
});

const canUseNativeShare = computed(() =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function'
);

const closeShareDialog = () => {
  showShareDialog.value = false;

  if (disableSharePromptOnClose.value) {
    sharePromptEnabled.value = false;
  }
};

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
      reader.onerror = () => {
        reportError(`Unable to read "${file.name}" as an image.`, reader.error);
      };
      reader.readAsDataURL(file);
    } else {
      showEditorNotice(`"${file.name}" is not an image file.`, 'error');
    }
    
    // Reset the input so the same file can be selected again
    target.value = '';
  }
};

const handleImageOverlayFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const files = target.files;

  if (files && files.length > 0) {
    Array.from(files).forEach(async (file) => {
      if (!file.type.startsWith('image/')) {
        showEditorNotice(`"${file.name}" is not an image file.`, 'error');
        return;
      }

      try {
        const src = await readFileAsDataUrl(file);
        await addImageOverlayFromFile(file, src);
      } catch (error) {
        reportError(`Unable to add "${file.name}" as an image overlay.`, error);
      }
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
        reportError(`Unable to read "${file.name}" as a chat file.`, error);
      }
    } else {
      showEditorNotice(`"${file.name}" must be a plain text file.`, 'error');
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
    if (!project) {
      showEditorNotice('That project could not be found for export.', 'error');
      return;
    }

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
    showEditorNotice(`Exported "${project.name}" to a .ssmag file.`, 'success');
  } catch (error) {
    reportError('Unable to export that project right now.', error);
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
    showEditorNotice(`Imported "${importedProject.name}" successfully.`, 'success');
  } catch (error) {
    reportError(`Unable to import "${file.name}".`, error);
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
      reader.onerror = () => {
        reportError(`Unable to read "${file.name}" as an image.`, reader.error);
      };
      reader.readAsDataURL(file);
    } else {
      showEditorNotice(`"${file.name}" is not an image file.`, 'error');
    }
  }
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

const effectAwareImageOverlays = computed(() => {
  const visibleOverlays = imageOverlays.value.filter((overlay) => !overlay.isHidden && overlay.src);

  return {
    affected: visibleOverlays.filter((overlay) => overlay.acceptsEffects),
    unaffected: visibleOverlays.filter((overlay) => !overlay.acceptsEffects)
  };
});

const createExportImageBlob = async () => {
  if (!droppedImageSrc.value) {
    throw new Error('Add an image before exporting a screenshot.');
  }

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

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error('Failed to create blob'));
        return;
      }

      resolve(result);
    }, 'image/png');
  });
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }
};

const openSharePrompt = (context: 'export' | 'upload') => {
  sharePromptContext.value = context;

  if (context === 'upload') {
    shareSnippetStyle.value = 'forum';
  } else {
    shareSnippetStyle.value = 'casual';
  }

  if (!sharePromptEnabled.value) {
    return;
  }

  disableSharePromptOnClose.value = false;
  showShareDialog.value = true;
};

const copyAppShareLink = async () => {
  try {
    await copyTextToClipboard(appShareUrl.value);
    trackEvent('share_app_link_copy', {
      share_context: sharePromptContext.value,
      share_method: 'link',
      ...getAnalyticsContext()
    });
    showEditorNotice('Copied the app link to your clipboard.', 'success');
  } catch (error) {
    reportError('Unable to copy the app link right now.', error);
  }
};

const copyShareSnippet = async () => {
  try {
    await copyTextToClipboard(shareSnippetText.value);
    trackEvent('share_app_link_copy', {
      share_context: sharePromptContext.value,
      share_method: `snippet_${shareSnippetStyle.value}`,
      ...getAnalyticsContext()
    });
    showEditorNotice('Copied a share message to your clipboard.', 'success');
  } catch (error) {
    reportError('Unable to copy the share message right now.', error);
  }
};

const shareAppNatively = async () => {
  if (!canUseNativeShare.value) {
    showEditorNotice('Native sharing is not available in this browser.', 'info');
    return;
  }

  try {
    await navigator.share({
      title: 'Screenshot Magician',
      text: shareSnippetText.value,
      url: appShareUrl.value
    });
    trackEvent('share_app_link_copy', {
      share_context: sharePromptContext.value,
      share_method: 'native_share',
      ...getAnalyticsContext()
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return;
    }

    reportError('Unable to open the share sheet right now.', error);
  }
};

// Update the saveImage function to ensure 1:1 positioning match with preview
const saveImage = async () => {
  try {
    const blob = await createExportImageBlob();
    downloadBlob(blob, getExportFileName());
    trackEvent('export_image', {
      export_format: 'png',
      ...getAnalyticsContext()
    });
    void recordImageExport();
    showEditorNotice('Exported the screenshot successfully.', 'success');
    openSharePrompt('export');

  } catch (error) {
    reportError('Unable to export the screenshot right now.', error);
  }
};

const copyUploadedImageLink = async () => {
  if (!lastUploadedImageUrl.value) {
    showEditorNotice('Upload an image first to copy its direct link.', 'info');
    return;
  }

  try {
    await copyTextToClipboard(lastUploadedImageUrl.value);
    showEditorNotice('Copied the direct image link to your clipboard.', 'success');
  } catch (error) {
    reportError('Unable to copy the uploaded image link.', error);
  }
};

const uploadImageToImgBbHost = async () => {
  if (!imageHostImgBbApiKey.value.trim()) {
    showSettingsDialog.value = true;
    showEditorNotice('Add your ImgBB API key in Settings before uploading.', 'info');
    return;
  }

  isImageHostUploadInProgress.value = true;

  try {
    const blob = await createExportImageBlob();
    const uploadResult = await uploadImageToImgBb({
      apiKey: imageHostImgBbApiKey.value,
      fileName: getExportFileName(),
      image: blob
    });

    lastUploadedImageUrl.value = uploadResult.directUrl;
    await copyTextToClipboard(uploadResult.directUrl);
    trackEvent('upload_image_host', {
      host_provider: uploadResult.provider,
      host_has_direct_url: Boolean(uploadResult.directUrl),
      ...getAnalyticsContext()
    });
    showEditorNotice('Uploaded to ImgBB and copied the direct image link.', 'success');
    openSharePrompt('upload');
  } catch (error) {
    reportError('Unable to upload the screenshot to ImgBB right now.', error);
  } finally {
    isImageHostUploadInProgress.value = false;
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
const {
  activeCensoredRegionSummaries,
  applyCensorType,
  applyManualColorOverride,
  buildStyledLineHtml,
  clearCensorType,
  clearChatlog,
  collapseStyledCharacters,
  duplicateChatOverlay: duplicateChatOverlayBase,
  focusCensoredRegion,
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
} = useMagicianChatLayers({
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
  nextTick: () => nextTick(),
  onLockedActiveOverlay: () => {
    if (isChatPanning.value) {
      handleChatMouseUpOrLeave();
    }
  },
  renderKey,
  selectedText,
  showColorDialog,
  trackEvent
});

const duplicateChatOverlay = (overlayId: string) => {
  duplicateChatOverlayBase(cloneChatOverlay, overlayId);
};

const addCustomColorSwatch = () => {
  const normalizedColor = customColorHex.value.trim().toLowerCase();
  if (!normalizedColor || customColorSwatches.value.includes(normalizedColor)) return;

  customColorSwatches.value.push(normalizedColor);
  saveCustomColorSwatches();
};

const sessionPersistence = useMagicianSessionPersistence({
  applyEditorSnapshot,
  createDefaultChatTransform,
  createOverlayId,
  currentProjectId,
  currentProjectName,
  getChatOverlayName,
  parseChatText,
  reportError,
  toSerializableSnapshot
});

const saveEditorState = async (snapshot: EditorStateSnapshot = createEditorSnapshot()) => {
  await sessionPersistence.saveEditorState(snapshot);
};

const loadEditorState = async () => {
  await sessionPersistence.loadEditorState(saveEditorState);
};

// Load character name from cookie
const loadCharacterName = () => {
  const savedName = Cookies.get('characterName');
  if (savedName) {
    characterName.value = savedName;
  }
};

const createSvgDataUrl = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const tutorialDemoScreenshotSrc = createSvgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#26364f"/>
      <stop offset="0.58" stop-color="#5f5d71"/>
      <stop offset="1" stop-color="#14171e"/>
    </linearGradient>
    <linearGradient id="road" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3d4048"/>
      <stop offset="1" stop-color="#17191f"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#sky)"/>
  <rect y="455" width="1280" height="265" fill="url(#road)"/>
  <path d="M0 455h1280" stroke="#d7a35b" stroke-width="5" opacity=".7"/>
  <path d="M160 720 505 455h112l-160 265zM820 455h104l226 265H944z" fill="#242730" opacity=".9"/>
  <g opacity=".95">
    <rect x="92" y="260" width="210" height="195" fill="#1b2230"/>
    <rect x="112" y="285" width="40" height="44" fill="#f4cc74"/>
    <rect x="170" y="285" width="40" height="44" fill="#7db4d8"/>
    <rect x="228" y="285" width="40" height="44" fill="#f4cc74"/>
    <rect x="114" y="352" width="154" height="24" fill="#ff6b62"/>
  </g>
  <g opacity=".92">
    <rect x="920" y="205" width="205" height="250" fill="#202838"/>
    <rect x="946" y="237" width="52" height="58" fill="#8dc7e7"/>
    <rect x="1017" y="237" width="52" height="58" fill="#f0c86c"/>
    <rect x="946" y="319" width="123" height="48" fill="#293447"/>
  </g>
  <g>
    <rect x="555" y="382" width="226" height="76" rx="12" fill="#111827"/>
    <rect x="584" y="345" width="168" height="65" rx="14" fill="#253044"/>
    <circle cx="604" cy="468" r="28" fill="#0d1117"/>
    <circle cx="733" cy="468" r="28" fill="#0d1117"/>
    <rect x="606" y="360" width="118" height="42" rx="9" fill="#9cc7e5"/>
    <rect x="535" y="420" width="270" height="20" rx="10" fill="#d3473e"/>
  </g>
  <g opacity=".74">
    <circle cx="550" cy="170" r="36" fill="#fff4b8"/>
    <rect x="513" y="170" width="74" height="14" fill="#fff4b8"/>
  </g>
  <text x="42" y="58" font-family="Arial Black, Arial, sans-serif" font-size="30" fill="#f8fafc">Demo Scene</text>
  <text x="42" y="92" font-family="Arial, sans-serif" font-size="18" fill="#dbeafe">Screenshot Magician walkthrough canvas</text>
</svg>`);

const tutorialDemoOverlaySrc = createSvgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="260" height="88" viewBox="0 0 260 88">
  <rect width="260" height="88" rx="18" fill="#101820" opacity=".92"/>
  <rect x="12" y="12" width="236" height="64" rx="14" fill="#192536" stroke="#7dd3fc" stroke-width="2"/>
  <text x="130" y="40" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="20" fill="#f8fafc">SSMAG</text>
  <text x="130" y="62" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" fill="#bae6fd">image overlay layer</text>
</svg>`);

const tutorialDemoChatText = [
  '[21:14:11] Avery Stone says: secret code is 4812.',
  '[21:14:17] * Avery Stone slides a note across the counter.',
  '[21:14:21] [INFO]: Screenshot Magician colored this marker automatically.',
  '[21:14:30] (( (PM) Try moving this chat layer with the arrow keys. ))',
  '[21:14:39] You received $250 from Marcus Hale.'
].join('\n');

const createTutorialDemoSnapshot = (): EditorStateSnapshot => ({
  characterName: 'Avery Stone',
  chatlogText: tutorialDemoChatText,
  droppedImageSrc: tutorialDemoScreenshotSrc,
  dropZoneWidth: 1280,
  dropZoneHeight: 720,
  imageTransform: { x: 0, y: 0, scale: 1 },
  imageOverlays: [
    {
      id: 'tutorial-overlay-badge',
      name: 'Demo Badge',
      src: tutorialDemoOverlaySrc,
      sourceWidth: 260,
      sourceHeight: 88,
      maskDataUrl: null,
      transform: { x: 948, y: 42, scale: 0.82 },
      opacity: 0.92,
      acceptsEffects: false,
      isHidden: false,
      isLocked: false
    }
  ],
  activeImageOverlayId: null,
  imageEffects: [],
  chatOverlays: [
    {
      id: 'tutorial-chat-main',
      name: 'Demo Chat Draft',
      rawText: tutorialDemoChatText,
      parsedLines: [],
      transform: { x: 52, y: 392, scale: 1 },
      censoredRegions: [],
      manualColorRegions: [],
      lineWidth: 780,
      isHidden: false,
      isLocked: false
    }
  ],
  activeChatOverlayId: 'tutorial-chat-main',
  isImageDraggingEnabled: false,
  isChatDraggingEnabled: false,
  showBlackBars: true,
  selectedText: { ...DEFAULT_SELECTED_TEXT },
  chatLineWidth: 780
});

const hasAnyEditorWork = () =>
  Boolean(droppedImageSrc.value)
  || chatlogText.value.trim().length > 0
  || chatOverlays.value.length > 0
  || imageOverlays.value.length > 0
  || imageEffects.value.length > 0;

const startTutorialDemo = () => {
  const demoSnapshot = createTutorialDemoSnapshot();
  isApplyingTutorialDemoState.value = true;
  applyEditorSnapshot(demoSnapshot);
  currentProjectId.value = null;
  currentProjectName.value = 'Tutorial Demo';
  pendingProjectName.value = 'Tutorial Demo';
  tutorialDemoStarted.value = true;
  tutorialDemoReady.value = false;
  showNewSessionDialog.value = false;
  showUnsavedChangesDialog.value = false;
  pendingEditorAction.value = null;
  resetHistoryState(demoSnapshot);
  scheduleDropzoneScaleCalculation();
  void nextTick(() => {
    isApplyingTutorialDemoState.value = false;
  });
  showEditorNotice('Loaded a demo project for the walkthrough.', 'success');
};

const currentTutorialStep = computed(() => tutorialSteps[tutorialStepIndex.value]);

const isTutorialActive = computed(() => showTutorialDialog.value);

const tutorialTargetClass = computed(() =>
  isTutorialActive.value ? `tutorial-target-${currentTutorialStep.value?.target || 'canvas'}` : ''
);

const isTutorialTarget = (target: TutorialStep['target']) =>
  isTutorialActive.value && currentTutorialStep.value?.target === target;

const hasParsedTutorialChat = computed(() =>
  chatOverlays.value.some((overlay) => overlay.id === 'tutorial-chat-main' && overlay.parsedLines.length > 0)
);

const hasMovedTutorialChat = computed(() => {
  const overlay = chatOverlays.value.find((item) => item.id === 'tutorial-chat-main');
  if (!overlay) return false;

  return (
    overlay.transform.x !== 52
    || overlay.transform.y !== 392
    || overlay.transform.scale !== 1
    || isChatDraggingEnabled.value
  );
});

const hasTutorialCensor = computed(() =>
  chatOverlays.value.some((overlay) => overlay.id === 'tutorial-chat-main' && overlay.censoredRegions.length > 0)
);

const hasTutorialPolish = computed(() =>
  imageOverlays.value.length > 0 && imageEffects.value.some((effect) => effect.presetId === 'vignette')
);

const isCurrentTutorialStepComplete = computed(() => {
  switch (tutorialStepIndex.value) {
    case 0:
      return tutorialDemoStarted.value && Boolean(droppedImageSrc.value);
    case 1:
      return hasParsedTutorialChat.value;
    case 2:
      return hasMovedTutorialChat.value;
    case 3:
      return hasTutorialCensor.value;
    case 4:
      return hasTutorialPolish.value;
    default:
      return tutorialDemoReady.value;
  }
});

const shouldHighlightChatMoveControl = computed(() =>
  isTutorialActive.value && tutorialStepIndex.value === 2
);

const shouldHighlightDemoLoadControl = computed(() =>
  isTutorialActive.value && tutorialStepIndex.value === 0
);

const shouldHighlightParseControls = computed(() =>
  isTutorialActive.value && tutorialStepIndex.value === 1
);

const shouldHighlightCensorControls = computed(() =>
  isTutorialActive.value && tutorialStepIndex.value === 3
);

const shouldHighlightPolishControls = computed(() =>
  isTutorialActive.value && tutorialStepIndex.value === 4
);

const shouldHighlightFinishControls = computed(() =>
  isTutorialActive.value && tutorialStepIndex.value === tutorialSteps.length - 1
);

const parseTutorialChat = () => {
  const tutorialOverlay = chatOverlays.value.find((overlay) => overlay.id === 'tutorial-chat-main');
  if (!tutorialOverlay) {
    startTutorialDemo();
  }

  selectChatOverlay('tutorial-chat-main');
  chatlogText.value = tutorialDemoChatText;
  parseChatlog();
};

const enableTutorialChatMove = () => {
  if (!hasParsedTutorialChat.value) {
    parseTutorialChat();
  }

  selectChatOverlay('tutorial-chat-main');
  isChatDraggingEnabled.value = true;
  isImageDraggingEnabled.value = false;
  showEditorNotice('Chat move mode is on. Drag the chat or use arrow keys to nudge it.', 'info');
};

const censorTutorialPhrase = () => {
  if (!hasParsedTutorialChat.value) {
    parseTutorialChat();
  }

  const overlay = chatOverlays.value.find((item) => item.id === 'tutorial-chat-main');
  if (!overlay) return;

  const lineText = overlay.parsedLines[0]?.text ?? '';
  const phrase = 'secret code';
  const startOffset = lineText.indexOf(phrase);
  if (startOffset === -1) return;

  selectChatOverlay(overlay.id);
  Object.assign(selectedText, {
    lineIndex: 0,
    startOffset,
    endOffset: startOffset + phrase.length,
    text: phrase
  });
  applyCensorType(CensorType.BlackBar);
  showEditorNotice('Applied a black bar to the demo phrase.', 'success');
};

const addTutorialPolish = () => {
  if (!hasParsedTutorialChat.value) {
    parseTutorialChat();
  }

  if (!imageEffects.value.some((effect) => effect.presetId === 'vignette')) {
    imageEffects.value.push(cloneImageEffectLayer({
      presetId: 'vignette',
      opacity: 0.42,
      seed: createImageEffectSeed()
    }));
  }

  selectImageOverlay('tutorial-overlay-badge');
  showEditorNotice('Added a vignette and selected the demo image overlay.', 'success');
};

const markTutorialDemoReady = () => {
  tutorialDemoReady.value = true;
  showEditorNotice('The demo project is ready. Save it or export when you want.', 'success');
};

const runTutorialStepAction = () => {
  switch (tutorialStepIndex.value) {
    case 0:
      startTutorialDemo();
      break;
    case 1:
      parseTutorialChat();
      break;
    case 2:
      enableTutorialChatMove();
      break;
    case 3:
      censorTutorialPhrase();
      break;
    case 4:
      addTutorialPolish();
      break;
    default:
      markTutorialDemoReady();
      break;
  }
};

const openTutorial = () => {
  tutorialStepIndex.value = 0;
  tutorialDemoStarted.value = currentProjectName.value === 'Tutorial Demo' && Boolean(droppedImageSrc.value);
  tutorialDemoReady.value = false;
  showTutorialDialog.value = true;
  if (!hasAnyEditorWork()) {
    startTutorialDemo();
  }
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

const loadImageHostingPreferences = () => {
  if (typeof window === 'undefined') return;

  imageHostImgBbApiKey.value = window.localStorage.getItem(IMAGE_HOSTING_IMGBB_API_KEY_STORAGE_KEY) || '';
};

const loadSharePromptPreference = () => {
  if (typeof window === 'undefined') return;

  const storedPreference = window.localStorage.getItem(SHARE_PROMPT_ENABLED_STORAGE_KEY);
  sharePromptEnabled.value = storedPreference !== 'false';
};

const goToNextTutorialStep = () => {
  if (tutorialStepIndex.value >= tutorialSteps.length - 1) {
    markTutorialDemoReady();
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
    void saveEditorState();
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
onMounted(async () => {
  unsavedNavigationStore.setEditorMounted(true);
  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('keydown', handleEditorHistoryKeydown);
  window.addEventListener('keyup', handleEditorHistoryKeyup);
  loadNavigatorPreference();
  loadSmartGuidePreferences();
  loadImageHostingPreferences();
  loadSharePromptPreference();
  loadEditorThemes();
  loadCharacterName();
  loadCustomColorSwatches();
  await loadEditorState();
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
  if (applyHistoryStateTimer) {
    clearTimeout(applyHistoryStateTimer);
  }
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
  disposeCanvasInteraction();
  disposeImageOverlayRuntime();
  window.removeEventListener('beforeunload', handleBeforeUnload);
  window.removeEventListener('keydown', handleEditorHistoryKeydown);
  window.removeEventListener('keyup', handleEditorHistoryKeyup);
  if (windowResizeHandler) {
    window.removeEventListener('resize', windowResizeHandler);
  }
  unsavedNavigationStore.reset();
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

watch(imageHostImgBbApiKey, (value) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(IMAGE_HOSTING_IMGBB_API_KEY_STORAGE_KEY, value.trim());
});

watch(sharePromptEnabled, (value) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SHARE_PROMPT_ENABLED_STORAGE_KEY, String(value));
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

const closePendingEditorAction = () => {
  showUnsavedChangesDialog.value = false;
  pendingEditorAction.value = null;
};

const {
  closeDeleteProjectDialog,
  closeSaveProjectDialog,
  confirmDeleteProject,
  discardAndContinuePendingAction,
  loadProject,
  openProjectsManager,
  promptSaveProject,
  refreshProjectList,
  requestDeleteProject,
  requestEditorAction,
  saveAndContinuePendingAction,
  saveCurrentProject,
  saveProject
} = useMagicianProjects({
  autosaveState,
  closePendingEditorAction,
  createEditorSnapshot,
  createProjectId,
  currentProjectId,
  currentProjectName,
  getAnalyticsContext,
  hasUnsavedChanges,
  isProjectsLoading,
  markCurrentStateAsSaved,
  openNewSessionDialog: () => {
    showNewSessionDialog.value = true;
  },
  pendingEditorAction,
  pendingProjectDelete,
  pendingProjectName,
  projectRecords,
  resetSession,
  reportError,
  showDeleteProjectDialog,
  showProjectsDialog,
  showSaveProjectDialog,
  showUnsavedChangesDialog,
  toSerializableSnapshot,
  trackEvent,
  applyEditorSnapshot
});

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
  <div :class="['magician-wrapper', { 'tutorial-active': isTutorialActive }, tutorialTargetClass]">
    <v-toolbar
      density="compact"
      color="surface-variant"
      :class="[
        'editor-toolbar',
        {
          'editor-toolbar-compact': isCompactToolbar,
          'tutorial-spotlight-target': isTutorialTarget('toolbar') || isTutorialTarget('effects') || isTutorialTarget('project')
        }
      ]"
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
            <v-btn
              v-bind="props"
              icon="mdi-content-save-cog-outline"
              :class="{ 'tutorial-control-highlight': shouldHighlightFinishControls }"
              @click="saveCurrentProject"
            ></v-btn>
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
              :class="{ 'tutorial-control-highlight': shouldHighlightChatMoveControl }"
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
          :class="{ 'tutorial-control-highlight': shouldHighlightPolishControls }"
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
              :class="{ 'tutorial-control-highlight': shouldHighlightCensorControls }"
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
              :class="{ 'tutorial-control-highlight': shouldHighlightCensorControls }"
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
              :class="{ 'tutorial-control-highlight': shouldHighlightFinishControls }"
              @click="saveImage"
              :disabled="!droppedImageSrc"
            ></v-btn>
          </template>
        </v-tooltip>
        <v-tooltip text="Upload to ImgBB" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn
              v-bind="props"
              icon="mdi-cloud-upload-outline"
              @click="uploadImageToImgBbHost"
              :loading="isImageHostUploadInProgress"
              :disabled="!droppedImageSrc || isImageHostUploadInProgress"
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
                  <v-btn
                    v-bind="props"
                    icon="mdi-content-save-cog-outline"
                    :class="{ 'tutorial-control-highlight': shouldHighlightFinishControls }"
                    @click="saveCurrentProject"
                  ></v-btn>
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
                    :class="{ 'tutorial-control-highlight': shouldHighlightChatMoveControl }"
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
              :class="{ 'tutorial-control-highlight': shouldHighlightPolishControls }"
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
                    :class="{ 'tutorial-control-highlight': shouldHighlightCensorControls }"
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
                    :class="{ 'tutorial-control-highlight': shouldHighlightCensorControls }"
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
                    :class="{ 'tutorial-control-highlight': shouldHighlightFinishControls }"
                    @click="saveImage"
                    :disabled="!droppedImageSrc"
                  ></v-btn>
                </template>
              </v-tooltip>
              <v-tooltip text="Upload to ImgBB" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon="mdi-cloud-upload-outline"
                    @click="uploadImageToImgBbHost"
                    :loading="isImageHostUploadInProgress"
                    :disabled="!droppedImageSrc || isImageHostUploadInProgress"
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

    <GuidedTutorialPanel
      v-if="showTutorialDialog && currentTutorialStep"
      :current-step="currentTutorialStep"
      :step-index="tutorialStepIndex"
      :steps="tutorialSteps"
      :is-current-step-complete="isCurrentTutorialStepComplete"
      :dont-show-tutorial-again="dontShowTutorialAgain"
      :should-highlight-action-button="shouldHighlightDemoLoadControl || shouldHighlightParseControls || shouldHighlightCensorControls || shouldHighlightPolishControls || shouldHighlightFinishControls"
      @close="closeTutorial"
      @back="goToPreviousTutorialStep"
      @next="goToNextTutorialStep"
      @run-action="runTutorialStepAction"
      @update:step-index="tutorialStepIndex = $event"
      @update:dont-show-tutorial-again="dontShowTutorialAgain = $event"
    />

    <KeyboardShortcutsDialog
      v-model="showKeyboardShortcutsDialog"
      :shortcut-groups="shortcutGroups"
    />

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
              <div class="text-subtitle-1">Sharing</div>
              <div class="text-body-2 text-medium-emphasis">
                Stay in control of whether the editor suggests sharing the app after a successful export or upload.
              </div>
            </div>
            <v-switch
              v-model="sharePromptEnabled"
              color="primary"
              inset
              hide-details
              label="Show share prompt after export or upload"
            ></v-switch>
            <div class="text-caption text-medium-emphasis mt-2">
              Turn this back on here anytime if you decide you want the reminder again.
            </div>
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

          <div class="settings-section mb-6">
            <div class="settings-section-header">
              <div class="text-subtitle-1">Image Hosting</div>
              <div class="text-body-2 text-medium-emphasis">
                Upload the current screenshot to your own ImgBB setup, then copy the direct image link for forum sharing.
              </div>
            </div>
            <div class="text-body-2 mb-3">
              Get your ImgBB API key from
              <a
                href="https://api.imgbb.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                api.imgbb.com
              </a>.
            </div>
            <div class="text-caption text-medium-emphasis mb-4">
              Open that page, sign in if needed, copy your API key, then paste it here.
            </div>
            <v-text-field
              v-model="imageHostImgBbApiKey"
              label="ImgBB API Key"
              variant="outlined"
              density="comfortable"
              type="password"
              autocomplete="off"
              hide-details
            ></v-text-field>
            <div class="text-caption text-medium-emphasis mt-3">
              This key stays in local browser storage on this machine. Imgur account upload will need a backend OAuth step, so this first version uses ImgBB only.
            </div>
            <div class="settings-action-row mt-4">
              <v-btn
                variant="text"
                prepend-icon="mdi-open-in-new"
                href="https://api.imgbb.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open ImgBB API Page
              </v-btn>
              <v-btn
                color="primary"
                prepend-icon="mdi-cloud-upload-outline"
                :loading="isImageHostUploadInProgress"
                :disabled="!droppedImageSrc || isImageHostUploadInProgress"
                @click="uploadImageToImgBbHost"
              >
                Upload Current Screenshot
              </v-btn>
              <v-btn
                variant="tonal"
                prepend-icon="mdi-content-copy"
                :disabled="!lastUploadedImageUrl"
                @click="copyUploadedImageLink"
              >
                Copy Last Link
              </v-btn>
            </div>
            <v-text-field
              v-model="lastUploadedImageUrl"
              label="Last uploaded direct link"
              variant="outlined"
              density="comfortable"
              readonly
              class="mt-4"
              hide-details
              placeholder="Upload a screenshot to fill this in"
            ></v-text-field>
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

    <v-dialog v-model="showShareDialog" max-width="560">
      <v-card>
        <v-card-title class="text-h6">
          {{ sharePromptHeadline }}
        </v-card-title>
        <v-card-text>
          <div class="text-body-2 text-medium-emphasis mb-4">
            {{ sharePromptBody }}
          </div>
          <div class="text-subtitle-2 mb-2">Choose a share message</div>
          <v-btn-toggle
            v-model="shareSnippetStyle"
            mandatory
            color="primary"
            variant="outlined"
            divided
            class="mb-4 flex-wrap"
          >
            <v-btn value="short">Short</v-btn>
            <v-btn value="casual">Casual</v-btn>
            <v-btn value="forum">Forum</v-btn>
          </v-btn-toggle>
          <v-textarea
            :model-value="shareSnippetText"
            label="Share message"
            variant="outlined"
            rows="4"
            auto-grow
            readonly
            hide-details
          ></v-textarea>
          <div class="text-caption text-medium-emphasis mt-3">
            The app link points back to Screenshot Magician so friends can try it immediately.
          </div>
          <v-checkbox
            v-model="disableSharePromptOnClose"
            color="primary"
            hide-details
            class="mt-4"
            label="Don't show this again"
          ></v-checkbox>
        </v-card-text>
        <v-card-actions class="flex-wrap ga-2">
          <v-btn variant="text" prepend-icon="mdi-link-variant" @click="copyAppShareLink">
            Copy App Link
          </v-btn>
          <v-btn variant="tonal" color="primary" prepend-icon="mdi-content-copy" @click="copyShareSnippet">
            Copy Share Message
          </v-btn>
          <v-btn
            v-if="canUseNativeShare"
            variant="text"
            prepend-icon="mdi-share-variant-outline"
            @click="shareAppNatively"
          >
            Share
          </v-btn>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="closeShareDialog">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar
      v-model="editorNoticeVisible"
      location="bottom right"
      :color="editorNoticeTone"
      :timeout="5000"
      rounded="pill"
    >
      <div class="d-flex align-center ga-2">
        <v-icon :icon="editorNoticeIcon"></v-icon>
        <span>{{ editorNoticeMessage }}</span>
      </div>
    </v-snackbar>

    <!-- Row takes remaining height and full width. Padding applied here. -->
    <div class="layout-container pa-2" ref="parentRowRef">
      <div
        :class="['utility-panel', { 'tutorial-spotlight-target': isTutorialTarget('utility-panel') || isTutorialTarget('project') }]"
        :style="{ width: `${utilityPanelWidth}px` }"
      >
        <UtilitySidebar
          :active-image-overlay="activeImageOverlay"
          :active-image-overlay-has-mask="activeImageOverlayHasMask"
          :active-image-overlay-id="activeImageOverlayId"
          :current-project-name="currentProjectName"
          :dropped-image-src="droppedImageSrc"
          :image-mask-brush-size="imageMaskBrushSize"
          :image-mask-brush-softness="imageMaskBrushSoftness"
          :image-mask-brush-strength="imageMaskBrushStrength"
          :image-overlay-tool="imageOverlayTool"
          :image-overlays="imageOverlays"
          :minimap-ref-setter="setMinimapElement"
          :minimap-size="minimapSize"
          :minimap-viewport="minimapViewport"
          :project-status-message="projectStatusMessage"
          :should-highlight-finish-controls="shouldHighlightFinishControls"
          :should-highlight-polish-controls="shouldHighlightPolishControls"
          :show-image-minimap="showImageMinimap"
          :utility-panel-scroll-ref-setter="setUtilityPanelScrollElement"
          @trigger-image-overlay-input="triggerImageOverlayInput"
          @reset-image-view="resetImageView"
          @recenter-image-from-minimap="recenterImageFromMinimap"
          @handle-image-layer-rail-wheel="handleImageLayerRailWheel"
          @select-image-overlay="selectImageOverlay"
          @move-image-overlay="moveImageOverlay($event.overlayId, $event.direction)"
          @toggle-image-overlay-effects="toggleImageOverlayEffects"
          @toggle-image-overlay-visibility="toggleImageOverlayVisibility"
          @toggle-image-overlay-lock="toggleImageOverlayLock"
          @duplicate-image-overlay="duplicateImageOverlay"
          @remove-image-overlay="removeImageOverlay"
          @update:active-image-overlay-opacity="updateActiveImageOverlayOpacity"
          @reset-active-image-overlay-view="resetActiveImageOverlayView"
          @update:image-overlay-tool="setImageOverlayTool"
          @update:image-mask-brush-size="imageMaskBrushSize = $event"
          @update:image-mask-brush-softness="imageMaskBrushSoftness = $event"
          @update:image-mask-brush-strength="imageMaskBrushStrength = $event"
          @reset-active-image-overlay-mask="resetActiveImageOverlayMask"
        />
      </div>

      <div
        ref="contentAreaRef"
        :class="['main-content', { 'tutorial-spotlight-target': isTutorialTarget('canvas') }]"
      >
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
              :class="['chat-overlay', { 'tutorial-control-highlight': shouldHighlightChatMoveControl && overlay.id === activeChatOverlayId }]"
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
      <div
        ref="chatPanelRef"
        :class="['chatlog-panel', { 'tutorial-spotlight-target': isTutorialTarget('chat-panel') }]"
        :style="{ width: chatPanelFlexBasis }"
      >
        <ChatEditorPanel
          :active-chat-overlay="activeChatOverlay"
          :active-chat-overlay-id="activeChatOverlayId"
          :active-censored-region-summaries="activeCensoredRegionSummaries"
          :chat-overlays="chatOverlays"
          :chatlog-text="chatlogText"
          :is-region-selected="isRegionSelected"
          :should-highlight-censor-controls="shouldHighlightCensorControls"
          :should-highlight-parse-controls="shouldHighlightParseControls"
          @update:chatlog-text="chatlogText = $event"
          @start-new-chat-layer="startNewChatLayer"
          @select-chat-overlay="selectChatOverlay"
          @toggle-chat-overlay-visibility="toggleChatOverlayVisibility"
          @toggle-chat-overlay-lock="toggleChatOverlayLock"
          @duplicate-chat-overlay="duplicateChatOverlay"
          @remove-chat-overlay="removeChatOverlay"
          @parse-chatlog="parseChatlog"
          @clear-chatlog="clearChatlog"
          @handle-text-selection="handleTextSelection"
          @focus-censored-region="focusCensoredRegion"
          @remove-censored-region="removeCensoredRegion"
        />
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

.tutorial-active .layout-container,
.tutorial-active .editor-toolbar {
  transition: filter 0.2s ease, opacity 0.2s ease;
}

.tutorial-active .layout-container > :not(.tutorial-spotlight-target),
.tutorial-active .editor-toolbar:not(.tutorial-spotlight-target) {
  filter: saturate(0.6) brightness(0.62);
  opacity: 0.72;
}

.tutorial-spotlight-target {
  position: relative;
  z-index: 12;
  outline: 3px solid rgba(125, 211, 252, 0.96);
  outline-offset: -3px;
  box-shadow: 0 0 0 9999px rgba(2, 6, 23, 0.28), 0 0 32px rgba(125, 211, 252, 0.5);
}

.editor-toolbar.tutorial-spotlight-target {
  z-index: 13;
}

.tutorial-target-effects .editor-toolbar {
  animation: tutorialPulse 1.4s ease-in-out infinite;
}

.tutorial-control-highlight {
  outline: 2px solid #7dd3fc;
  outline-offset: 3px;
  animation: tutorialControlPulse 1.2s ease-in-out infinite;
}

@keyframes tutorialPulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(125, 211, 252, 0.35);
  }

  50% {
    box-shadow: 0 0 0 6px rgba(125, 211, 252, 0.12);
  }
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
