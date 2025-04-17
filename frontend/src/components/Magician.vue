// src/components/Magician.vue

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue';
import { type CSSProperties } from 'vue';
import Cookies from 'js-cookie';
import html2canvas from 'html2canvas';

const chatlogText = ref('');
const droppedImageSrc = ref<string | null>(null); // To store the image data URL
const isDraggingOverDropZone = ref(false); // Renamed from isDragging for clarity
const dropZoneWidth = ref<number | null>(800); // Default width
const dropZoneHeight = ref<number | null>(600); // Default height
const fileInputRef = ref<HTMLInputElement | null>(null); // Ref for the file input element
const chatFileInputRef = ref<HTMLInputElement | null>(null); // New ref for chat file input
const showNewSessionDialog = ref(false); // Control dialog visibility

// --- Parsed Chat State ---
interface ParsedLine {
  id: number;
  text: string;
  color?: string;
}
const parsedChatLines = ref<ParsedLine[]>([]);

// --- Image Manipulation State ---
const isImageDraggingEnabled = ref(false);
const imageTransform = reactive({ x: 0, y: 0, scale: 1 });
const isPanning = ref(false);
const panStart = reactive({ x: 0, y: 0 });
const panStartImagePos = reactive({ x: 0, y: 0 });

// --- Chat Manipulation State ---
const isChatDraggingEnabled = ref(false);
const chatTransform = reactive({ x: 0, y: 0, scale: 1 });
const isChatPanning = ref(false);
const chatPanStart = reactive({ x: 0, y: 0 });
const chatPanStartPos = reactive({ x: 0, y: 0 });

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

// Computed style for the drop zone
const dropZoneStyle = computed(() => ({
  width: dropZoneWidth.value ? `${dropZoneWidth.value}px` : '100%', 
  height: dropZoneHeight.value ? `${dropZoneHeight.value}px` : '100%',
  maxWidth: '100%', // Prevent exceeding column width
  maxHeight: '100%', // Prevent exceeding column height
  backgroundColor: '#e0e0e0',
  borderRadius: '4px',
  position: 'relative',
  overflow: 'hidden',
  cursor: isImageDraggingEnabled.value ? (isPanning.value ? 'grabbing' : 'grab') : 'default'
}));

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

const clearChatlog = () => {
  chatlogText.value = '';
  parsedChatLines.value = []; // Clear parsed lines too
};

const parseChatlog = () => {
  const lines = chatlogText.value.split('\n').filter(line => line.trim() !== '');
  parsedChatLines.value = lines.map((line, index) => {
    let color: string | undefined = undefined;
    let processedText = line;
    
    // First check for cellphone messages
    const cellphonePattern = colorMappings.find(mapping => 
      mapping.checkPlayerName && mapping.pattern.test(line)
    );
    
    if (cellphonePattern && characterName.value) {
      // If it's the player's message, use white color
      if (line.startsWith(characterName.value)) {
        color = 'rgb(255, 255, 255)';
      } else {
        // Otherwise use yellow for incoming calls
        color = cellphonePattern.color;
      }
    } else {
      // Check for patterns that should color the entire line
      const fullLinePattern = colorMappings.find(mapping => 
        mapping.fullLine && !mapping.checkPlayerName && mapping.pattern.test(line)
      );

      if (fullLinePattern) {
        color = fullLinePattern.color;
      } else {
        // Check for split patterns 
        const splitPattern = colorMappings.find(mapping => 
          mapping.splitPattern && mapping.pattern.test(line)
        );

        if (splitPattern && splitPattern.splitPattern && splitPattern.markerColor) {
          const parts = line.split(splitPattern.splitPattern);
          if (parts.length > 1) {
            processedText = parts.map((part, i) => {
              if (splitPattern.splitPattern?.test(part)) {
                return `<span style="color: ${splitPattern.markerColor}">${part}</span>`;
              }
              return `<span style="color: ${splitPattern.color}">${part}</span>`;
            }).join('');
            color = 'white'; // Base color doesn't matter as we're using inline styles
          }
        } else {
          // Check other patterns
          for (const mapping of colorMappings) {
            if (mapping.pattern.test(line)) {
              color = mapping.color;
              break;
            }
          }
        }
      }
    }
    
    return {
      id: index,
      text: processedText,
      color: color || 'white'
    };
  });
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
const handleChatMouseDown = (event: MouseEvent) => {
  if (!isChatDraggingEnabled.value || parsedChatLines.value.length === 0) return;
  
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
  chatPanStartPos.x = chatTransform.x;
  chatPanStartPos.y = chatTransform.y;
  document.body.style.userSelect = 'none';
};

const handleChatMouseMove = (event: MouseEvent) => {
  if (!isChatPanning.value) return;
  
  // Prevent event from being handled by image drag
  event.stopPropagation();
  
  const deltaX = event.clientX - chatPanStart.x;
  const deltaY = event.clientY - chatPanStart.y;
  chatTransform.x = chatPanStartPos.x + deltaX;
  chatTransform.y = chatPanStartPos.y + deltaY;
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
const handleChatWheel = (event: WheelEvent) => {
  if (!isChatDraggingEnabled.value || parsedChatLines.value.length === 0) return;
  event.preventDefault();
  const scaleAmount = 0.1;
  const minScale = 0.5;
  const maxScale = 3;

  if (event.deltaY < 0) {
    chatTransform.scale = Math.min(maxScale, chatTransform.scale + scaleAmount);
  } else {
    chatTransform.scale = Math.max(minScale, chatTransform.scale - scaleAmount);
  }
};

// Toggle chat dragging
const toggleChatDrag = () => {
  isChatDraggingEnabled.value = !isChatDraggingEnabled.value;
  if (isChatDraggingEnabled.value && isImageDraggingEnabled.value) {
    isImageDraggingEnabled.value = false; // Disable image drag if enabling chat drag
  }
};

// Compute chat overlay style
const chatOverlayStyle = computed(() => ({
  transform: `translate(${chatTransform.x}px, ${chatTransform.y}px) scale(${chatTransform.scale})`,
  cursor: isChatDraggingEnabled.value ? (isChatPanning.value ? 'grabbing' : 'grab') : 'default',
  transition: isChatPanning.value ? 'none' : 'transform 0.1s ease-out',
  pointerEvents: isChatDraggingEnabled.value ? 'auto' : 'none'
} as const));

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
  parsedChatLines.value = [];
  
  // Reset drop zone dimensions to defaults
  dropZoneWidth.value = 800;
  dropZoneHeight.value = 600;
  
  // Reset chat transform
  chatTransform.x = 0;
  chatTransform.y = 0;
  chatTransform.scale = 1;
  isChatDraggingEnabled.value = false;
  isChatPanning.value = false;

  // Reset censoring data
  censoredRegions.value = [];
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

// State for censored regions
const censoredRegions = ref<CensoredRegion[]>([]);
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
  if (selectedText.lineIndex === -1) return;

  console.log('Applying censoring:', selectedText);

  // Find existing censor for this region
  const existingIndex = censoredRegions.value.findIndex(
    region => region.lineIndex === selectedText.lineIndex &&
             region.startOffset === selectedText.startOffset &&
             region.endOffset === selectedText.endOffset
  );

  if (existingIndex === -1) {
    // Add new censor starting with Invisible
    console.log('Adding new censor region');
    censoredRegions.value.push({
      lineIndex: selectedText.lineIndex,
      startOffset: selectedText.startOffset,
      endOffset: selectedText.endOffset,
      type: CensorType.Invisible
    });
  } else {
    const current = censoredRegions.value[existingIndex];
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
        censoredRegions.value.splice(existingIndex, 1);
        break;
    }
  }

  // Force re-render
  renderKey.value++;
  console.log('Updated censor regions:', censoredRegions.value);
};

// Update applyCensoring to handle partial text censoring
const applyCensoring = (text: string, lineIndex: number) => {
  const regions = censoredRegions.value
    .filter(region => region.lineIndex === lineIndex)
    .sort((a, b) => a.startOffset - b.startOffset);

  console.log(`Applying censoring to line ${lineIndex}, found ${regions.length} regions`);

  if (regions.length === 0) return text;

  let result = '';
  let lastIndex = 0;

  for (const region of regions) {
    // Add uncensored text before this region
    result += text.slice(lastIndex, region.startOffset);
    
    // Add censored text
    const censoredText = text.slice(region.startOffset, region.endOffset);
    console.log('Censoring text:', censoredText, 'with type:', region.type);
    
    // Ensure the text is properly escaped for HTML
    const escapedText = censoredText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    
    switch (region.type) {
      case CensorType.Invisible:
        result += `<span class="censored-invisible">${escapedText}</span>`;
        break;
      case CensorType.BlackBar:
        result += `<span class="censored-blackbar">${escapedText}</span>`;
        break;
      case CensorType.Blur:
        result += `<span class="censored-blur">${escapedText}</span>`;
        break;
    }
    
    lastIndex = region.endOffset;
  }

  // Add remaining uncensored text
  result += text.slice(lastIndex);
  return result;
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
        selectedText.lineIndex = i;
        selectedText.startOffset = selectionStart - lineStart;
        selectedText.endOffset = textarea.selectionEnd - lineStart;
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

// Helper function to strip HTML and extract text content
const stripHtml = (html: string): string => {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || '';
};

// Helper function to break text into lines
const breakTextIntoLines = (text: string, ctx: CanvasRenderingContext2D, maxWidth: number): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + ' ' + word).width;
    if (width < maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
};

// Update the saveImage function to match editor rendering
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

    // Load the base image
    const img = new Image();
    img.src = droppedImageSrc.value;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    // Set canvas size to match the drop zone
    canvas.width = dropZoneWidth.value || 800;
    canvas.height = dropZoneHeight.value || 600;

    // Draw background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the image with correct positioning
    ctx.save();
    const viewportRatio = canvas.width / canvas.height;
    const imageRatio = img.naturalWidth / img.naturalHeight;
    
    let baseWidth, baseHeight;
    if (imageRatio > viewportRatio) {
      baseWidth = canvas.width;
      baseHeight = canvas.width / imageRatio;
    } else {
      baseHeight = canvas.height;
      baseWidth = canvas.height * imageRatio;
    }

    const scaledWidth = baseWidth * imageTransform.scale;
    const scaledHeight = baseHeight * imageTransform.scale;
    
    const x = (canvas.width - scaledWidth) / 2 + imageTransform.x;
    const y = (canvas.height - scaledHeight) / 2 + imageTransform.y;

    ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
    ctx.restore();

    // If there are chat lines, render them
    if (parsedChatLines.value.length > 0) {
      ctx.save();
      
      // Match editor positioning
      const dzWidth = dropZoneWidth.value || 800;
      const dzHeight = dropZoneHeight.value || 600;
      const dropZoneLeft = (canvas.width - dzWidth) / 2;
      const dropZoneTop = (canvas.height - dzHeight) / 2;
      
      // Apply chat transform with correct offset
      ctx.translate(dropZoneLeft + chatTransform.x, dropZoneTop + chatTransform.y);
      ctx.scale(chatTransform.scale, chatTransform.scale);

      // Set up text rendering
      ctx.font = '12px "Arial Black", Arial, sans-serif';
      ctx.textBaseline = 'top';
      ctx.textRendering = 'geometricPrecision';
      
      let currentY = 0;
      const TEXT_OFFSET_Y = 1; // Shift text down by 1px for perfect centering

      // Helper function to get text color based on content
      const getTextColor = (text: string): string => {
        // Check for radio messages first (since they contain asterisks)
        if (text.includes('[S:') && text.includes('CH:')) return 'rgb(214, 207, 140)';
        
        // Check for RP lines (lines starting with *)
        if (text.startsWith('*')) return 'rgb(194, 163, 218)';
        
        // Check for car whispers
        if (text.includes('(Car)') && text.includes('whispers:')) return 'rgb(255, 255, 0)';
        
        // Check for regular whispers
        if (text.includes('whispers:')) return 'rgb(237, 168, 65)';
        
        // Check for cellphone messages - make white if it's the character's message
        if (text.includes('(cellphone)')) {
          if (text.startsWith(characterName.value)) {
            return 'rgb(255, 255, 255)';
          }
          return 'rgb(251, 247, 36)';
        }
        
        // Check for megaphone messages
        if (text.includes('[Megaphone]')) return 'rgb(241, 213, 3)';
        
        // Check for money messages
        if (text.includes('You paid')) return 'rgb(86, 214, 75)';
        
        // Default color
        return 'rgb(255, 255, 255)';
      };

      // Helper function to draw black bar
      const drawBlackBar = (y: number, width: number) => {
        if (showBlackBars.value) {
          ctx.fillStyle = '#000000';
          // Extend the bar height by 1px and position it to overlap with adjacent bars
          ctx.fillRect(0, y, width + 8, 17);
        }
      };

      // Helper function to draw text with outline
      const drawTextWithOutline = (text: string, x: number, y: number, color: string, censorType?: CensorType) => {
        const width = ctx.measureText(text).width;
        
        // If black bars are enabled, draw the background first
        if (showBlackBars.value) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(x, y, width, 16);
        }

        if (censorType) {
          // Handle censoring
          switch (censorType) {
            case CensorType.Invisible:
              // Skip drawing anything
              return;
            case CensorType.BlackBar:
              // Just a black rectangle
              ctx.fillStyle = '#000000';
              ctx.fillRect(x, y, width, 16);
              return;
            case CensorType.Blur:
              // Create a temporary canvas for the blur effect
              const tempCanvas = document.createElement('canvas');
              tempCanvas.width = width + 20; // Add padding for blur
              tempCanvas.height = 36; // Add vertical padding
              const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
              if (!tempCtx) return;

              // Set up text rendering on temp canvas
              tempCtx.font = ctx.font;
              tempCtx.textBaseline = 'top';
              
              // Draw the base text
              tempCtx.strokeStyle = '#000000';
              tempCtx.lineWidth = 2;
              tempCtx.strokeText(text, 10, 10);
              tempCtx.fillStyle = color;
              tempCtx.fillText(text, 10, 10);

              // Create blur effect by drawing multiple copies with slight offsets
              tempCtx.globalAlpha = 0.1;
              const blurRadius = 5;
              const numPasses = 20;

              // Draw copies in a circular pattern
              for (let i = 0; i < numPasses; i++) {
                const angle = (i / numPasses) * Math.PI * 2;
                for (let r = 1; r <= blurRadius; r++) {
                  const offsetX = Math.cos(angle) * r;
                  const offsetY = Math.sin(angle) * r;
                  tempCtx.strokeText(text, 10 + offsetX, 10 + offsetY);
                  tempCtx.fillText(text, 10 + offsetX, 10 + offsetY);
                }
              }

              // Draw additional copies with random offsets for more natural blur
              tempCtx.globalAlpha = 0.05;
              for (let i = 0; i < 30; i++) {
                const offsetX = (Math.random() * 2 - 1) * blurRadius;
                const offsetY = (Math.random() * 2 - 1) * blurRadius;
                tempCtx.strokeText(text, 10 + offsetX, 10 + offsetY);
                tempCtx.fillText(text, 10 + offsetX, 10 + offsetY);
              }

              // Draw the blurred result back to main canvas
              ctx.drawImage(tempCanvas, x - 10, y - 10);
              return;
          }
        }

        // Normal text rendering
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeText(text, x, y + TEXT_OFFSET_Y);
        ctx.fillStyle = color;
        ctx.fillText(text, x, y + TEXT_OFFSET_Y);
      };

      // Helper function to get censor type for a position in text
      const getCensorType = (lineIndex: number, startPos: number, length: number): CensorType | undefined => {
        return censoredRegions.value.find(r => 
          r.lineIndex === lineIndex &&
          ((startPos >= r.startOffset && startPos < r.endOffset) || // Start point is within region
           (startPos + length > r.startOffset && startPos + length <= r.endOffset) || // End point is within region
           (startPos <= r.startOffset && startPos + length >= r.endOffset)) // Region is completely contained
        )?.type;
      };

      // Helper function to draw special multi-colored line
      const drawSpecialLine = (text: string, x: number, y: number, lineIndex: number) => {
        if (text.includes('[!]')) {
          // Split the text around [!]
          const parts = text.split(/(\[!\])/);
          let currentX = x;
          let partOffset = 0;
          
          for (const part of parts) {
            const width = ctx.measureText(part).width;
            const censorType = getCensorType(lineIndex, partOffset, part.length);
            if (part === '[!]') {
              drawTextWithOutline(part, currentX, y, 'rgb(255, 0, 195)', censorType);
            } else {
              drawTextWithOutline(part, currentX, y, 'rgb(255, 255, 255)', censorType);
            }
            currentX += width;
            partOffset += part.length;
          }
          return true;
        }
        
        if (text.includes('[Character kill]')) {
          // Split the text around [Character kill]
          const parts = text.split(/(\[Character kill\])/);
          let currentX = x;
          let partOffset = 0;
          
          for (const part of parts) {
            const width = ctx.measureText(part).width;
            const censorType = getCensorType(lineIndex, partOffset, part.length);
            if (part === '[Character kill]') {
              drawTextWithOutline(part, currentX, y, 'rgb(56, 150, 243)', censorType);
            } else {
              drawTextWithOutline(part, currentX, y, 'rgb(240, 0, 0)', censorType);
            }
            currentX += width;
            partOffset += part.length;
          }
          return true;
        }
        
        return false;
      };

      // Process each line
      let lineIndex = 0;
      for (const line of parsedChatLines.value) {
        // Get the raw text content
        const parser = new DOMParser();
        const doc = parser.parseFromString(line.text, 'text/html');
        const textContent = doc.body.textContent || '';

        // Word wrap setup
        const words = textContent.split(/\s+/);
        let currentLine = '';
        let x = 4;
        let lineStart = currentY;
        let lineWidth = 0;
        let totalOffset = 0; // Track total characters processed in this line

        // Helper function to draw text with censoring
        const drawTextSegment = async (text: string, xPos: number, yPos: number, color: string) => {
          // Split text into censored and uncensored segments
          let currentX = xPos;
          let remainingText = text;
          let currentOffset = totalOffset;
          
          while (remainingText.length > 0) {
            // Find the next censored region that intersects with our current position
            const censorRegion = censoredRegions.value.find(r => 
              r.lineIndex === lineIndex &&
              r.startOffset <= currentOffset + remainingText.length &&
              r.endOffset > currentOffset
            );

            if (!censorRegion) {
              // No more censoring in this segment, draw the rest normally
              await drawTextWithOutline(remainingText, currentX, yPos, color);
              break;
            }

            // Draw uncensored portion before the censored region
            const uncensoredLength = Math.max(0, censorRegion.startOffset - currentOffset);
            if (uncensoredLength > 0) {
              const uncensoredText = remainingText.substring(0, uncensoredLength);
              await drawTextWithOutline(uncensoredText, currentX, yPos, color);
              currentX += ctx.measureText(uncensoredText).width;
              remainingText = remainingText.substring(uncensoredLength);
              currentOffset += uncensoredLength;
            }

            // Draw censored portion
            const censorLength = Math.min(
              remainingText.length,
              censorRegion.endOffset - currentOffset
            );
            const censoredText = remainingText.substring(0, censorLength);
            await drawTextWithOutline(censoredText, currentX, yPos, color, censorRegion.type);
            currentX += ctx.measureText(censoredText).width;
            remainingText = remainingText.substring(censorLength);
            currentOffset += censorLength;
          }
        };

        // Process each word
        for (const word of words) {
          const spaceWidth = ctx.measureText(' ').width;
          const wordWidth = ctx.measureText(word).width;
          const testWidth = x + (currentLine ? spaceWidth : 0) + wordWidth;

          if (testWidth > dzWidth - 8) {
            // Draw black bar for current line
            drawBlackBar(lineStart, lineWidth);

            // Draw current line with special handling for [!] and Character kill
            if (!drawSpecialLine(currentLine, 4, lineStart, lineIndex)) {
              await drawTextSegment(currentLine, 4, lineStart, getTextColor(textContent));
            }

            currentY += 16;
            currentLine = word;
            x = 4 + wordWidth;
            lineStart = currentY;
            lineWidth = wordWidth;
            totalOffset += currentLine.length + 1; // +1 for space
          } else {
            if (currentLine) {
              currentLine += ' ' + word;
              x = testWidth;
            } else {
              currentLine = word;
              x += wordWidth;
            }
            lineWidth = x;
          }
        }

        // Draw black bar for the last/only line
        drawBlackBar(lineStart, lineWidth);

        // Draw remaining text with special handling for [!] and Character kill
        if (currentLine) {
          if (!drawSpecialLine(currentLine, 4, lineStart, lineIndex)) {
            await drawTextSegment(currentLine, 4, lineStart, getTextColor(textContent));
          }
          currentY += 16;
        }

        lineIndex++;
      }
      ctx.restore();
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

// Save editor state to cookie
const saveEditorState = () => {
  const state = {
    characterName: characterName.value,
    chatlogText: chatlogText.value,
    dropZoneWidth: dropZoneWidth.value,
    dropZoneHeight: dropZoneHeight.value,
    imageTransform: { ...imageTransform },
    chatTransform: { ...chatTransform },
    isImageDraggingEnabled: isImageDraggingEnabled.value,
    isChatDraggingEnabled: isChatDraggingEnabled.value,
    showBlackBars: showBlackBars.value,
    censoredRegions: censoredRegions.value,
    selectedText: { ...selectedText }
  };
  Cookies.set('editorState', JSON.stringify(state), { expires: 365 });
};

// Load editor state from cookie
const loadEditorState = () => {
  const savedState = Cookies.get('editorState');
  if (savedState) {
    try {
      const state = JSON.parse(savedState);
      characterName.value = state.characterName || '';
      chatlogText.value = state.chatlogText || '';
      dropZoneWidth.value = state.dropZoneWidth || 800;
      dropZoneHeight.value = state.dropZoneHeight || 600;
      Object.assign(imageTransform, state.imageTransform || { x: 0, y: 0, scale: 1 });
      Object.assign(chatTransform, state.chatTransform || { x: 0, y: 0, scale: 1 });
      isImageDraggingEnabled.value = state.isImageDraggingEnabled || false;
      isChatDraggingEnabled.value = state.isChatDraggingEnabled || false;
      showBlackBars.value = state.showBlackBars || false;
      censoredRegions.value = state.censoredRegions || [];
      Object.assign(selectedText, state.selectedText || { lineIndex: -1, startOffset: 0, endOffset: 0, text: '' });
      
      // If there's chat text, parse it
      if (chatlogText.value) {
        parseChatlog();
      }
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

// Watch for changes that should trigger state save
watch([
  chatlogText,
  dropZoneWidth,
  dropZoneHeight,
  () => ({ ...imageTransform }),
  () => ({ ...chatTransform }),
  isImageDraggingEnabled,
  isChatDraggingEnabled,
  showBlackBars,
  censoredRegions,
  () => ({ ...selectedText })
], () => {
  saveEditorState();
}, { deep: true });

// Load saved state when component mounts
onMounted(() => {
  loadCharacterName();
  loadEditorState();
});

// Update the computed style for chat lines
const chatLineStyle = computed(() => (line: ParsedLine, index: number) => {
  // Calculate if line will wrap based on content length and available width
  const tempDiv = document.createElement('div');
  tempDiv.style.visibility = 'hidden';
  tempDiv.style.position = 'absolute';
  tempDiv.style.width = `${dropZoneWidth.value! - 16}px`;
  tempDiv.style.whiteSpace = 'pre-wrap';
  tempDiv.style.wordBreak = 'break-word';
  tempDiv.style.font = '12px "Arial Black", Arial, sans-serif';
  tempDiv.style.lineHeight = '16px';
  tempDiv.innerHTML = line.text;
  document.body.appendChild(tempDiv);
  
  const height = tempDiv.offsetHeight;
  document.body.removeChild(tempDiv);
  
  // Calculate total height needed (16px per wrapped line)
  const lines = Math.ceil(height / 16);
  const totalHeight = lines * 16;
  
  // Calculate position based on previous lines
  let position = index * 16; // Start with base position
  
  // Only add extra space for wrapped lines in previous messages
  for (let i = 0; i < index; i++) {
    const prevLine = parsedChatLines.value[i];
    const prevTempDiv = document.createElement('div');
    prevTempDiv.style.visibility = 'hidden';
    prevTempDiv.style.position = 'absolute';
    prevTempDiv.style.width = `${dropZoneWidth.value! - 16}px`;
    prevTempDiv.style.whiteSpace = 'pre-wrap';
    prevTempDiv.style.wordBreak = 'break-word';
    prevTempDiv.style.font = '12px "Arial Black", Arial, sans-serif';
    prevTempDiv.style.lineHeight = '16px';
    prevTempDiv.innerHTML = prevLine.text;
    document.body.appendChild(prevTempDiv);
    
    const prevHeight = prevTempDiv.offsetHeight;
    document.body.removeChild(prevTempDiv);
    
    // Only add extra space if the line wraps (height > 16px)
    if (prevHeight > 16) {
      position += Math.ceil(prevHeight / 16) * 16 - 16; // Subtract base height
    }
  }

  return {
    transform: `translateY(${position}px)`,
    minHeight: `${totalHeight}px`,
    maxWidth: `${dropZoneWidth.value! - 16}px`,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    position: 'absolute' as const,
    width: '100%',
    margin: 0,
    padding: 0
  } as const;
});

// Add a reactive effect to update positions when content changes
watch([parsedChatLines, dropZoneWidth], () => {
  renderKey.value++; // Force re-render when content or width changes
});

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
        <v-tooltip text="Import Screenshot" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" icon="mdi-camera-plus-outline" @click="triggerFileInput"></v-btn>
          </template>
        </v-tooltip>
        <v-tooltip text="Import Chatlog" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" icon="mdi-message-plus-outline" @click="triggerChatFileInput"></v-btn>
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
          @input="parseChatlog"
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
    <v-row no-gutters class="flex-grow-1 ma-0 pa-2" style="overflow-y: hidden;">
      <!-- Center drag and drop area -->
      <v-col cols="12" sm="9" md="9" class="pa-1 d-flex align-center justify-center">
        <v-sheet 
          class="drop-zone d-flex align-center justify-center pa-0"
          :class="{ 'is-dragging-over': isDraggingOverDropZone }" 
          :style="dropZoneStyle as CSSProperties"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="handleDrop"
          @wheel="handleWheel" 
        >
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
            <div class="text-grey-darken-1 mt-2">Drag and drop your screenshot here</div>
          </div>

          <!-- Chat Overlay -->
          <div v-if="parsedChatLines.length > 0 && droppedImageSrc" 
               class="chat-overlay"
               :style="chatOverlayStyle"
               :key="renderKey"
               @mousedown="handleChatMouseDown"
               @mousemove="handleChatMouseMove"
               @mouseup="handleChatMouseUpOrLeave"
               @mouseleave="handleChatMouseUpOrLeave"
               @wheel="handleChatWheel"
          >
            <div 
              v-for="(line, index) in parsedChatLines" 
              :key="`${line.id}-${renderKey}`"
              class="chat-line-container"
              :data-line-index="index"
              :style="chatLineStyle(line, index)"
            >
              <div
                class="chat-line"
                :class="{ 'with-black-bar': showBlackBars }"
              >
                <span 
                  class="chat-text"
                  :style="{ color: line.color || 'white' }"
                  v-html="applyCensoring(line.text, index)"
                ></span>
              </div>
            </div>
          </div>
        </v-sheet>
      </v-col>

      <!-- Right side chatlog panel -->
      <v-col cols="12" sm="3" md="3" class="fill-height pa-1">
        <v-sheet class="fill-height d-flex flex-column pa-2" style="border-radius: 4px;">
          <div class="text-subtitle-1 mb-1">Chatlog Snippet</div>
          <div class="flex-grow-1 d-flex flex-column" style="overflow-y: hidden;">
            <v-textarea
              v-model="chatlogText"
              placeholder="Paste your chat lines here!&#10;Hit 'Parse' afterwards to see color-swatched parsed lines on your image."
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
                  Parse
                </v-btn>
              </v-col>
            </v-row>
          </div>
        </v-sheet>
      </v-col>
    </v-row>
  </div>
</template>

<style scoped>
.magician-wrapper {
  background-color: rgb(var(--v-theme-surface-variant));
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.drop-zone {
  border: 2px dashed transparent; /* Base border */
  transition: background-color 0.2s ease, border-color 0.2s ease; /* Smooth transition */
}

.drop-zone.is-dragging-over {
  border-color: #42a5f5; /* Highlight border when dragging */
  background-color: #e3f2fd; /* Light blue background */
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

.chat-text {
  position: relative;
  display: inline-block;
  padding-right: 5px;
  user-select: text !important;
  cursor: text;
}

.with-black-bar {
  background-color: #000000;
  padding: 0 4px;
  height: 16px; /* Match line height */
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
  display: inline-block;
  background-color: transparent;
}

:deep(.censored-blackbar) {
  background-color: #000000;
  color: transparent;
  user-select: text;
  display: inline-block;
  padding: 0 2px;
}

:deep(.censored-blur) {
  filter: blur(5px);
  user-select: text;
  display: inline-block;
  padding: 0 2px;
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

.chat-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: auto;
  overflow: visible;
  transform-origin: top left;
  will-change: transform;
}

.chat-line-container {
  position: absolute;
  left: 0;
  display: block;
  min-height: 16px;
  width: calc(100% - 16px);
  overflow: visible;
  line-height: 16px;
  padding-bottom: 0; /* Remove extra padding */
}

.chat-line {
  position: relative;
  display: block;
  font-family: 'Arial Black', sans-serif;
  font-size: 12px;
  line-height: 16px;
  padding: 0;
  white-space: pre-wrap;
  word-break: break-word;
  pointer-events: none;
  width: 100%;
  margin: 0; /* Ensure no extra margins */
  text-shadow: 
    -1px -1px 0 #000,
    -1px 0 0 #000,
    -1px 1px 0 #000,
    0 -1px 0 #000,
    0 1px 0 #000,
    1px -1px 0 #000,
    1px 0 0 #000,
    1px 1px 0 #000;
}

.chat-text {
  position: relative;
  display: inline;
  padding-right: 5px;
  user-select: text !important;
  cursor: text;
  white-space: pre-wrap;
  word-break: break-word;
}

.with-black-bar {
  background-color: #000000;
  padding: 0 4px;
  display: inline;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}

</style>





