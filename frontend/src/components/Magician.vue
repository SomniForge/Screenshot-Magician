// src/components/Magician.vue

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue';
import { type CSSProperties } from 'vue';
import Cookies from 'js-cookie';

const chatlogText = ref('');
const droppedImageSrc = ref<string | null>(null); // To store the image data URL
const isDraggingOverDropZone = ref(false); // Renamed from isDragging for clarity
const dropZoneWidth = ref<number | null>(800); // Default width
const dropZoneHeight = ref<number | null>(600); // Default height
const fileInputRef = ref<HTMLInputElement | null>(null); // Ref for the file input element
const chatFileInputRef = ref<HTMLInputElement | null>(null); // New ref for chat file input
const showNewSessionDialog = ref(false); // Control dialog visibility
const stripTimestamps = ref(false); // New state for stripping timestamps

// --- Resizable Chat Panel State ---
const chatPanelRef = ref<HTMLElement | null>(null);
const parentRowRef = ref<HTMLElement | null>(null);
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
}

interface EditorStateSnapshot {
  characterName: string;
  chatlogText: string;
  droppedImageSrc: string | null;
  dropZoneWidth: number;
  dropZoneHeight: number;
  imageTransform: ChatTransform;
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
  stripTimestamps: boolean;
  chatLineWidth: number;
}

interface ProjectRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  snapshot: EditorStateSnapshot;
}

const DEFAULT_CHAT_LINE_WIDTH = 640;
const PROJECTS_DB_NAME = 'screenshot-magician-projects';
const PROJECTS_STORE_NAME = 'projects';
const PROJECTS_DB_VERSION = 1;

const chatOverlays = ref<ChatOverlay[]>([]);
const activeChatOverlayId = ref<string | null>(null);
const activeChatOverlay = computed(() =>
  chatOverlays.value.find((overlay) => overlay.id === activeChatOverlayId.value) ?? null
);

const projectRecords = ref<Array<Pick<ProjectRecord, 'id' | 'name' | 'createdAt' | 'updatedAt'>>>([]);
const currentProjectId = ref<string | null>(null);
const currentProjectName = ref('');
const showProjectsDialog = ref(false);
const showSaveProjectDialog = ref(false);
const pendingProjectName = ref('');
const isProjectsLoading = ref(false);
const showColorDialog = ref(false);
const customColorHex = ref('#ffffff');
const customColorSwatches = ref<string[]>([]);

// --- Image Manipulation State ---
const isImageDraggingEnabled = ref(false);
const imageTransform = reactive({ x: 0, y: 0, scale: 1 });
const isPanning = ref(false);
const panStart = reactive({ x: 0, y: 0 });
const panStartImagePos = reactive({ x: 0, y: 0 });

// --- Chat Manipulation State ---
const isChatDraggingEnabled = ref(false);
const isChatPanning = ref(false);
const chatPanStart = reactive({ x: 0, y: 0 });
const chatPanStartPos = reactive({ x: 0, y: 0 });

// --- Scale Adjustment for Drop Zone Visibility ---
const contentAreaRef = ref<HTMLElement | null>(null); // Reference to content area div
const dropzoneScale = ref(1); // Scale factor for the dropzone to fit screen
const isScaledDown = ref(false); // Flag to track if the dropzone is scaled down

// Add to the script setup section near the other state variables
const chatLineWidth = ref(DEFAULT_CHAT_LINE_WIDTH);

// Calculate necessary scale factor to fit dropzone in available viewport
const calculateDropzoneScale = () => {
  if (!contentAreaRef.value || !dropZoneWidth.value || !dropZoneHeight.value) return;
  
  // Get the available space in the content area (accounting for padding)
  const availableWidth = contentAreaRef.value.clientWidth - 24; // Adjust padding for better fit
  const availableHeight = contentAreaRef.value.clientHeight - 24;
  
  // Calculate the aspect ratio of the dropzone
  const dropzoneRatio = dropZoneWidth.value / dropZoneHeight.value;
  
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
      console.log(`Optimized scaling: ${optimalScale.toFixed(2)}x to better use available space`);
      return;
    }
  }
  
  // Only update if there's a significant change to avoid unnecessary renders
  if (Math.abs(newScale - dropzoneScale.value) > 0.01) {
    dropzoneScale.value = newScale;
    isScaledDown.value = newScale < 0.98; // Consider it scaled down if below 98% of original size
    console.log(`Rescaled dropzone: ${newScale.toFixed(2)}x (${isScaledDown.value ? 'scaled down' : 'actual size'})`);
  }
};

// Add watchers to recalculate scale when dimensions change
watch([dropZoneWidth, dropZoneHeight, chatPanelFlexBasis], () => {
  // Recalculate scale whenever dropzone dimensions or chat panel width changes
  setTimeout(() => calculateDropzoneScale(), 0);
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

const defaultColorSwatches = computed(() => {
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

  return Array.from(swatches);
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

// Computed style for the drop zone
const dropZoneStyle = computed(() => {
  // Calculate scale if needed
  const scale = isScaledDown.value ? dropzoneScale.value : 1;
  
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
    cursor: isImageDraggingEnabled.value ? (isPanning.value ? 'grabbing' : 'grab') : 'default',
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

const imageStyle = computed(() => ({
  maxWidth: 'none', // Allow image to be larger than container for zoom
  maxHeight: 'none',
  position: 'absolute', // Position relative to the drop zone sheet
  top: '0', // Start at top-left before transform
  left: '0',
  transformOrigin: 'center center', // Zoom from the center
  transform: `translate(${imageTransform.x}px, ${imageTransform.y}px) scale(${imageTransform.scale})`,
  cursor: isImageDraggingEnabled.value ? (isPanning.value ? 'grabbing' : 'grab') : 'default',
  transition: isPanning.value ? 'none' : 'transform 0.1s ease-out' // Smooth transition only when not panning
}));

const createOverlayId = () =>
  `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createProjectId = () =>
  `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createDefaultChatTransform = (): ChatTransform => ({
  x: 0,
  y: 0,
  scale: 1
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
  lineWidth: overlay.lineWidth || DEFAULT_CHAT_LINE_WIDTH
});

const createEditorSnapshot = (): EditorStateSnapshot => ({
  characterName: characterName.value,
  chatlogText: chatlogText.value,
  droppedImageSrc: droppedImageSrc.value,
  dropZoneWidth: dropZoneWidth.value || 800,
  dropZoneHeight: dropZoneHeight.value || 600,
  imageTransform: { ...imageTransform },
  chatOverlays: chatOverlays.value.map((overlay, index) => cloneChatOverlay(overlay, index)),
  activeChatOverlayId: activeChatOverlayId.value,
  isImageDraggingEnabled: isImageDraggingEnabled.value,
  isChatDraggingEnabled: isChatDraggingEnabled.value,
  showBlackBars: showBlackBars.value,
  selectedText: { ...selectedText },
  stripTimestamps: stripTimestamps.value,
  chatLineWidth: chatLineWidth.value
});

const toSerializableSnapshot = (snapshot: EditorStateSnapshot): EditorStateSnapshot =>
  JSON.parse(JSON.stringify(snapshot)) as EditorStateSnapshot;

const applyEditorSnapshot = (snapshot: Partial<EditorStateSnapshot>) => {
  characterName.value = snapshot.characterName || '';
  chatlogText.value = snapshot.chatlogText || '';
  droppedImageSrc.value = snapshot.droppedImageSrc || null;
  dropZoneWidth.value = snapshot.dropZoneWidth || 800;
  dropZoneHeight.value = snapshot.dropZoneHeight || 600;
  Object.assign(imageTransform, snapshot.imageTransform || { x: 0, y: 0, scale: 1 });
  isImageDraggingEnabled.value = snapshot.isImageDraggingEnabled || false;
  isChatDraggingEnabled.value = snapshot.isChatDraggingEnabled || false;
  showBlackBars.value = snapshot.showBlackBars || false;
  Object.assign(selectedText, snapshot.selectedText || { lineIndex: -1, startOffset: 0, endOffset: 0, text: '' });
  stripTimestamps.value = snapshot.stripTimestamps || false;
  chatLineWidth.value = snapshot.chatLineWidth || DEFAULT_CHAT_LINE_WIDTH;
  chatOverlays.value = Array.isArray(snapshot.chatOverlays)
    ? snapshot.chatOverlays.map((overlay, index) => cloneChatOverlay(overlay, index))
    : [];
  activeChatOverlayId.value = snapshot.activeChatOverlayId || chatOverlays.value[0]?.id || null;
  syncEditorFromActiveOverlay();
  renderKey.value++;
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

const parseChatText = (rawText: string) => {
  const lines = rawText.split('\n').filter(line => line.trim() !== '');

  return lines.map((line, index) => {
    let processedText = line;

    if (stripTimestamps.value) {
      processedText = processedText.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, '');
    }

    return {
      id: index,
      text: processedText
    };
  });
};

const getDisplayedLineText = (line: string) => {
  if (!stripTimestamps.value) {
    return line;
  }

  return line.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, '');
};

const getDisplayedSelectionRange = (line: string, rawStartOffset: number, rawEndOffset: number) => {
  const displayedLine = getDisplayedLineText(line);

  if (!stripTimestamps.value) {
    return {
      displayedLine,
      startOffset: rawStartOffset,
      endOffset: rawEndOffset
    };
  }

  const timestampMatch = line.match(/^\[\d{2}:\d{2}:\d{2}\]\s*/);
  const strippedLength = timestampMatch ? timestampMatch[0].length : 0;

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
      return `<span${classAttribute} style="color: ${run.color}">${escapeHtml(run.text)}</span>`;
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
  renderKey.value++;
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
      lineWidth: chatLineWidth.value
    };

    chatOverlays.value.push(newOverlay);
    activeChatOverlayId.value = newOverlay.id;
  }

  renderKey.value++;
};

// --- File Handling Methods ---

// Trigger click on hidden file input when the import button is clicked
const triggerFileInput = () => {
  if (fileInputRef.value) {
    fileInputRef.value.click();
  }
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
        droppedImageSrc.value = e.target?.result as string;
        // Reset image transform
        imageTransform.x = 0;
        imageTransform.y = 0;
        imageTransform.scale = 1;
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

// --- Drag and Drop Handlers ---
const handleDragOver = (event: DragEvent) => {
  event.preventDefault(); // Prevent default behavior
  isDraggingOverDropZone.value = true;
};

const handleDragLeave = () => {
  isDraggingOverDropZone.value = false;
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
        droppedImageSrc.value = e.target?.result as string;
        // Reset image transform when new image is dropped
        imageTransform.x = 0;
        imageTransform.y = 0;
        imageTransform.scale = 1;
      };
      reader.readAsDataURL(file);
    } else {
      console.warn('Dropped file is not an image.');
      // Optionally show an error message to the user
    }
  }
};

// --- Image Panning Handlers ---
const handleImageMouseDown = (event: MouseEvent) => {
  if (!isImageDraggingEnabled.value || !droppedImageSrc.value) return;
  event.preventDefault();
  isPanning.value = true;
  panStart.x = event.clientX;
  panStart.y = event.clientY;
  panStartImagePos.x = imageTransform.x;
  panStartImagePos.y = imageTransform.y;
  // Add a class to body to prevent text selection during drag
  document.body.style.userSelect = 'none';
};

const handleImageMouseMove = (event: MouseEvent) => {
  if (!isPanning.value) return;
  const deltaX = event.clientX - panStart.x;
  const deltaY = event.clientY - panStart.y;
  imageTransform.x = panStartImagePos.x + deltaX;
  imageTransform.y = panStartImagePos.y + deltaY;
};

const handleImageMouseUpOrLeave = () => {
  if (isPanning.value) {
    isPanning.value = false;
    document.body.style.userSelect = ''; // Re-enable text selection
  }
};

// --- Image Zoom Handler ---
const handleWheel = (event: WheelEvent) => {
  if (!isImageDraggingEnabled.value || !droppedImageSrc.value) return;
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
  if (isImageDraggingEnabled.value && isChatDraggingEnabled.value) {
    isChatDraggingEnabled.value = false; // Disable chat drag if enabling image drag
  }
};

// --- Chat Dragging Handlers ---
const handleChatMouseDown = (event: MouseEvent, overlayId: string) => {
  selectChatOverlay(overlayId);

  const overlay = chatOverlays.value.find((item) => item.id === overlayId);
  if (!overlay || overlay.parsedLines.length === 0 || !isChatDraggingEnabled.value) return;
  
  // Don't allow chat dragging if image dragging is active and in progress
  if (isImageDraggingEnabled.value && isPanning.value) {
    event.stopPropagation();
    return;
  }
  
  event.preventDefault();
  event.stopPropagation(); // Stop event from propagating to image
  isChatPanning.value = true;
  chatPanStart.x = event.clientX;
  chatPanStart.y = event.clientY;
  chatPanStartPos.x = overlay.transform.x;
  chatPanStartPos.y = overlay.transform.y;
  document.body.style.userSelect = 'none';
};

const handleChatMouseMove = (event: MouseEvent) => {
  if (!isChatPanning.value || !activeChatOverlay.value) return;
  
  // Prevent event from being handled by image drag
  event.stopPropagation();
  
  const deltaX = event.clientX - chatPanStart.x;
  const deltaY = event.clientY - chatPanStart.y;
  activeChatOverlay.value.transform.x = chatPanStartPos.x + deltaX;
  activeChatOverlay.value.transform.y = chatPanStartPos.y + deltaY;
};

const handleChatMouseUpOrLeave = (event?: MouseEvent) => {
  if (isChatPanning.value) {
    if (event) {
      event.stopPropagation();
    }
    isChatPanning.value = false;
    document.body.style.userSelect = '';
  }
};

// --- Chat Zoom Handler ---
const handleChatWheel = (event: WheelEvent, overlayId: string) => {
  const overlay = chatOverlays.value.find((item) => item.id === overlayId);
  if (!overlay || !isChatDraggingEnabled.value || overlay.parsedLines.length === 0) return;

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

// --- Chat Panel Resize Handlers ---
const handleResizeMouseDown = (event: MouseEvent) => {
  // Prevent default behavior (like text selection)
  event.preventDefault();
  event.stopPropagation();
  
  console.log("Starting resize...");
  
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
    
    console.log(`Adjusted min width: ${minWidthPercent.toFixed(2)}% (${minWidthPx}px)`);
  }
  
  // Clamp the value to reasonable boundaries
  // The maximum is still 50% but minimum is now dynamic based on drop zone width
  newBasis = Math.max(minWidthPercent, Math.min(newBasis, 50));
  
  // Apply the new width percentage
  chatPanelFlexBasis.value = `${newBasis}%`;
  mainContentFlexBasis.value = `${100 - newBasis}%`;
  
  console.log(`Resizing: delta=${deltaX.toFixed(0)}px (${deltaPercent.toFixed(2)}%), new width=${newBasis.toFixed(2)}%`);
};

const handleResizeMouseUp = () => {
  // Clean up - reset flags and styles
  isResizingChatPanel.value = false;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  
  // Remove the event listeners
  document.removeEventListener('mousemove', handleResizeMouseMove);
  document.removeEventListener('mouseup', handleResizeMouseUp);
  
  console.log("Resize complete");
};

// Update chat overlay styles
const getChatStyles = (overlay: ChatOverlay) => {
  const isActiveOverlay = activeChatOverlayId.value === overlay.id;

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
    pointerEvents: 'auto' as const,
    wordWrap: 'break-word' as const,
    whiteSpace: 'pre-wrap' as const,
    cursor: isChatDraggingEnabled.value ? (isActiveOverlay && isChatPanning.value ? 'grabbing' : 'grab') : 'pointer',
    outline: isActiveOverlay ? '1px dashed rgba(66, 165, 245, 0.9)' : 'none',
    outlineOffset: '2px',
  };
};

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

    // Draw the image with correct positioning and transform origin
    ctx.save();
    const img = new Image();
    img.src = droppedImageSrc.value;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    // --- Match CSS object-fit: contain ---
    const viewportRatio = canvas.width / canvas.height;
    const imageRatio = img.naturalWidth / img.naturalHeight;
    let drawWidth, drawHeight, offsetX, offsetY;

    if (imageRatio > viewportRatio) {
      // Image is wider than canvas aspect ratio (letterboxed top/bottom)
      drawWidth = canvas.width;
      drawHeight = canvas.width / imageRatio;
      offsetX = 0;
      offsetY = (canvas.height - drawHeight) / 2;
    } else {
      // Image is taller than canvas aspect ratio (pillarboxed left/right)
      drawHeight = canvas.height;
      drawWidth = canvas.height * imageRatio;
      offsetX = (canvas.width - drawWidth) / 2;
      offsetY = 0;
    }

    // Match the preview image element exactly:
    // the image fills the whole drop zone, uses object-fit: contain, and transforms
    // around the center of the full drop zone rather than the contained image bounds.
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.translate(imageTransform.x, imageTransform.y);
    ctx.scale(imageTransform.scale, imageTransform.scale);
    ctx.drawImage(
      img,
      offsetX - canvas.width / 2,
      offsetY - canvas.height / 2,
      drawWidth,
      drawHeight
    );

    ctx.restore(); // Restore context after drawing image

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
  selectedText.lineIndex = -1;
  selectedText.startOffset = 0;
  selectedText.endOffset = 0;
  selectedText.text = '';
  renderKey.value++;
  
  // Close the confirmation dialog
  showNewSessionDialog.value = false;
};

// Add state for black bars toggle
const showBlackBars = ref(false);

// Toggle black bars
const toggleBlackBars = () => {
  showBlackBars.value = !showBlackBars.value;
};

const selectedText = reactive({
  lineIndex: -1,
  startOffset: 0,
  endOffset: 0,
  text: ''
});

// Add a key to force re-render when censoring changes
const renderKey = ref(0);

// Update cycleCensorType to trigger re-render
const cycleCensorType = () => {
  if (selectedText.lineIndex === -1 || !activeChatOverlay.value) return;

  console.log('Applying censoring:', selectedText);

  // Find existing censor for this region
  const existingIndex = activeChatOverlay.value.censoredRegions.findIndex(
    region => region.lineIndex === selectedText.lineIndex &&
             region.startOffset === selectedText.startOffset &&
             region.endOffset === selectedText.endOffset
  );

  if (existingIndex === -1) {
    // Add new censor starting with Invisible
    console.log('Adding new censor region');
    activeChatOverlay.value.censoredRegions.push({
      lineIndex: selectedText.lineIndex,
      startOffset: selectedText.startOffset,
      endOffset: selectedText.endOffset,
      type: CensorType.Invisible
    });
  } else {
    const current = activeChatOverlay.value.censoredRegions[existingIndex];
    console.log('Cycling existing censor:', current.type);
    switch (current.type) {
      case CensorType.Invisible:
        current.type = CensorType.BlackBar;
        break;
      case CensorType.BlackBar:
        current.type = CensorType.Blur;
        break;
      case CensorType.Blur:
        // Remove censoring
        activeChatOverlay.value.censoredRegions.splice(existingIndex, 1);
        break;
    }
  }

  // Force re-render
  renderKey.value++;
  console.log('Updated censor regions:', activeChatOverlay.value.censoredRegions);
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
  console.log('Selection event triggered', selection?.toString());
  
  if (!selection || selection.toString().trim() === '') {
    selectedText.lineIndex = -1;
    return;
  }

  try {
    // Get the textarea element
    const textarea = document.querySelector('.chatlog-textarea textarea') as HTMLTextAreaElement;
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
        console.log('Found selection in line:', i, lines[i]);
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
    
    console.log('Selection state:', selectedText);
  } catch (error) {
    console.error('Error handling text selection:', error);
  }
};

// Save editor state to cookie
const saveEditorState = () => {
  const state = toSerializableSnapshot(createEditorSnapshot());
  delete (state as Partial<EditorStateSnapshot>).droppedImageSrc;
  Cookies.set('editorState', JSON.stringify(state), { expires: 365 });
};

// Load editor state from cookie
const loadEditorState = () => {
  const savedState = Cookies.get('editorState');
  if (savedState) {
    try {
      const state = JSON.parse(savedState);
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
          lineWidth: state.chatLineWidth || DEFAULT_CHAT_LINE_WIDTH
        };

        applyEditorSnapshot({
          ...state,
          chatOverlays: [migratedOverlay],
          activeChatOverlayId: migratedOverlay.id
        });
        return;
      }

      applyEditorSnapshot(state);
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

// Initialize flex layout values to create a stable layout
const initializeLayoutValues = () => {
  // Ensure we're using string percentages for flex basis values
  chatPanelFlexBasis.value = '25%';
  mainContentFlexBasis.value = '75%';
  
  // Ensure consistent size of both panels
  console.log('Layout initialized with main content: 75%, chat panel: 25%');
};

// Watch for changes that should trigger state save
watch([
  chatlogText,
  dropZoneWidth,
  dropZoneHeight,
  () => ({ ...imageTransform }),
  chatOverlays,
  activeChatOverlayId,
  isImageDraggingEnabled,
  isChatDraggingEnabled,
  showBlackBars,
  () => ({ ...selectedText }),
  stripTimestamps,
  chatLineWidth
], () => {
  saveEditorState();
}, { deep: true });

// Load saved state when component mounts
onMounted(() => {
  loadCharacterName();
  loadCustomColorSwatches();
  loadEditorState();
  refreshProjectList();
  
  // Make sure layout is initialized correctly
  initializeLayoutValues();
  
  // Calculate initial scale
  setTimeout(() => {
    calculateDropzoneScale();
    
    // Add window resize listener
    window.addEventListener('resize', () => {
      calculateDropzoneScale();
    });
  }, 100);
});

watch(chatLineWidth, (newValue) => {
  if (!activeChatOverlay.value) return;
  activeChatOverlay.value.lineWidth = newValue;
  renderKey.value++;
});

const openProjectsManager = async () => {
  showProjectsDialog.value = true;
  await refreshProjectList();
};

const promptSaveProject = () => {
  pendingProjectName.value = currentProjectName.value || `Project ${projectRecords.value.length + 1}`;
  showSaveProjectDialog.value = true;
};

const saveProject = async (forceNewProject = false) => {
  const trimmedName = pendingProjectName.value.trim();
  if (!trimmedName) return;

  const now = new Date().toISOString();
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
    await saveStoredProject(projectRecord);
    currentProjectId.value = projectRecord.id;
    currentProjectName.value = projectRecord.name;
    showSaveProjectDialog.value = false;
    await refreshProjectList();
  } catch (error) {
    console.error('Error saving project:', error);
  }
};

const loadProject = async (projectId: string) => {
  try {
    const project = await loadStoredProject(projectId);
    if (!project) return;

    applyEditorSnapshot(project.snapshot);
    currentProjectId.value = project.id;
    currentProjectName.value = project.name;
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
  await saveProject(false);
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

// Add this new method to handle the click on drop zone
const handleDropZoneClick = (event: Event) => {
  if (!droppedImageSrc.value) {
    triggerFileInput();
  }
};

</script>

<template>
  <div class="magician-wrapper">
    <v-toolbar density="compact" color="surface-variant">
      <div class="toolbar-button-group">
        <v-tooltip text="New Session" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn 
              v-bind="props" 
              icon="mdi-plus-box-outline"
              @click="showNewSessionDialog = true"
            ></v-btn>
          </template>
        </v-tooltip>
        <v-tooltip text="Import Chatlog" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" icon="mdi-message-plus-outline" @click="triggerChatFileInput"></v-btn>
          </template>
        </v-tooltip>
        <v-tooltip text="Open Projects" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" icon="mdi-folder-open-outline" @click="openProjectsManager"></v-btn>
          </template>
        </v-tooltip>
        <v-tooltip text="Save Project" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" icon="mdi-content-save-cog-outline" @click="saveCurrentProject"></v-btn>
          </template>
        </v-tooltip>
        <v-tooltip text="Strip Timestamps from Chatlog" location="bottom">
          <template v-slot:activator="{ props }">
            <v-switch
              v-bind="props"
              v-model="stripTimestamps"
              color="primary"
              density="compact"
              hide-details
              class="ms-2 me-1 custom-switch"
              @change="reparseChatOverlays" 
            ></v-switch>
          </template>
        </v-tooltip>
        <v-tooltip text="Import Layer Image (Coming Soon!)" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" icon="mdi-layers-search" disabled></v-btn>
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
        <v-tooltip text="Enable Image Drag/Zoom" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn 
              v-bind="props" 
              icon="mdi-drag-variant"
              :color="isImageDraggingEnabled ? 'primary' : undefined"
              @click="toggleImageDrag"
            ></v-btn>
          </template>
        </v-tooltip>
        <v-tooltip text="Enable Chat Drag/Zoom" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn 
              v-bind="props" 
              icon="mdi-message-text-lock-outline"
              :color="isChatDraggingEnabled ? 'primary' : undefined"
              @click="toggleChatDrag"
            ></v-btn>
          </template>
        </v-tooltip>
        <v-tooltip text="Enable Layer Drag (Coming Soon!)" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" icon="mdi-layers-triple-outline" disabled></v-btn>
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
        <v-tooltip text="Create Layer (Coming Soon!)" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" icon="mdi-layers-plus" disabled></v-btn>
          </template>
        </v-tooltip>
        <v-tooltip text="Remove Layer (Coming Soon!)" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" icon="mdi-layers-minus" disabled></v-btn>
          </template>
        </v-tooltip>
        <v-tooltip text="Censor Selection" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn 
              v-bind="props" 
              icon="mdi-eye-off"
              @click="cycleCensorType"
              :disabled="selectedText.lineIndex === -1"
            ></v-btn>
          </template>
        </v-tooltip>
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
          <v-btn variant="text" @click="showSaveProjectDialog = false">Cancel</v-btn>
          <v-btn variant="text" color="secondary" @click="saveProject(true)">Save As New</v-btn>
          <v-btn color="primary" variant="text" @click="saveProject(false)">
            {{ currentProjectId ? 'Save' : 'Create' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

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
              v-for="color in defaultColorSwatches"
              :key="color"
              type="button"
              class="color-swatch"
              :style="{ backgroundColor: color }"
              :title="color"
              @click="applyManualColorOverride(color)"
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
              :title="color"
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
          <v-btn size="small" variant="tonal" color="primary" prepend-icon="mdi-plus" @click="promptSaveProject">
            New Project Save
          </v-btn>
        </v-card-title>
        <v-card-text>
          <div v-if="currentProjectName" class="text-body-2 mb-4">
            Current project: <strong>{{ currentProjectName }}</strong>
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
                    icon="mdi-delete-outline"
                    size="small"
                    variant="text"
                    color="error"
                    @click="deleteProject(project.id)"
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
      ref="chatFileInputRef"
      class="hidden-input" 
      accept=".txt,text/plain"
      @change="handleChatFileSelect"
    />

    <!-- Row takes remaining height and full width. Padding applied here. -->
    <div class="layout-container pa-2">
      <div class="main-content" ref="contentAreaRef" :style="{ width: mainContentFlexBasis }">
        <!-- Add aspect ratio container to enforce proper ratio -->
        <div class="aspect-ratio-container" :style="aspectRatioContainerStyle">
          <v-sheet 
            class="drop-zone d-flex align-center justify-center pa-0"
            :class="{ 
              'is-dragging-over': isDraggingOverDropZone,
              'clickable': !droppedImageSrc 
            }" 
            :style="dropZoneStyle as CSSProperties"
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
            
            <!-- Display Dropped Image -->
            <img 
              v-if="droppedImageSrc"
              :src="droppedImageSrc" 
              alt="Dropped Screenshot"
              class="dropped-image"
              :style="imageStyle as CSSProperties"
              draggable="false" 
              @mousedown="handleImageMouseDown"
              @mousemove="handleImageMouseMove"
              @mouseup="handleImageMouseUpOrLeave"
              @mouseleave="handleImageMouseUpOrLeave"
            />
            <!-- Display Placeholder -->
            <div v-else class="text-center">
              <v-icon size="x-large" color="grey-darken-1">mdi-paperclip</v-icon>
              <div class="text-grey-darken-1 mt-2">Click or drag and drop your screenshot here</div>
            </div>

            <!-- Chat Overlay with fixed-width wrapping -->
            <div
              v-for="overlay in chatOverlays"
              v-show="overlay.parsedLines.length > 0 && droppedImageSrc"
              :key="`${overlay.id}-${renderKey}`"
              class="chat-overlay"
              @mousedown="handleChatMouseDown($event, overlay.id)"
              @mousemove="handleChatMouseMove"
              @mouseup="handleChatMouseUpOrLeave"
              @mouseleave="handleChatMouseUpOrLeave"
              @wheel="handleChatWheel($event, overlay.id)"
              :style="getChatStyles(overlay)"
            >
              <div class="chat-lines-container">
                <div
                  v-for="(line, index) in overlay.parsedLines"
                  :key="line.id"
                  class="chat-line"
                  :style="{ width: `${overlay.lineWidth}px` }"
                >
                  <span
                    :class="['chat-text', { 'chat-text-black-bars': showBlackBars }]"
                    v-html="buildStyledLineHtml(overlay, index, line.text)"
                    @mouseup="handleTextSelection"
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
        <v-sheet class="fill-height d-flex flex-column pa-2" style="border-radius: 4px;">
          <div class="project-status mb-3">
            <div class="text-subtitle-2">Project</div>
            <div class="text-body-2">
              {{ currentProjectName || 'Unsaved session' }}
            </div>
            <div class="text-caption text-medium-emphasis">
              {{ currentProjectId ? 'Saved locally in this browser' : 'Use Save Project to keep this work for later' }}
            </div>
          </div>
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
                  <v-icon icon="mdi-message-text-outline" size="small"></v-icon>
                </template>
                <v-list-item-title>{{ overlay.name }}</v-list-item-title>
                <v-list-item-subtitle>{{ overlay.parsedLines.length }} lines</v-list-item-subtitle>
                <template v-slot:append>
                  <v-btn
                    icon="mdi-delete-outline"
                    size="x-small"
                    variant="text"
                    color="error"
                    @click.stop="removeChatOverlay(overlay.id)"
                  ></v-btn>
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
  overflow: visible;
  transform-origin: top left;
  will-change: transform;
}

.chat-line {
  position: relative;
  display: block;
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
  user-select: text !important;
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
  user-select: text;
  display: inline;
  background-color: transparent;
  text-shadow: none !important;
}

:deep(.censored-blackbar) {
  background-color: #000000;
  color: transparent;
  user-select: text;
  display: inline;
  padding: 0;
  text-shadow: none !important;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}

:deep(.censored-blur) {
  filter: blur(5px);
  user-select: text;
  display: inline;
  padding: 0;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}

.fill-height {
  height: 100%;
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
}

.main-content {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 4px;
}

.chatlog-panel {
  height: 100%;
  padding: 4px;
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

/* Add custom style for the switch if needed */
.custom-switch {
  /* Adjust display or margins if it doesn't align well in the toolbar */
  display: inline-flex; /* Helps with alignment in flex containers */
  align-items: center;
}
</style>
