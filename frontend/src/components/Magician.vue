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

// --- Scale Adjustment for Drop Zone Visibility ---
const contentAreaRef = ref<HTMLElement | null>(null); // Reference to content area div
const dropzoneScale = ref(1); // Scale factor for the dropzone to fit screen
const isScaledDown = ref(false); // Flag to track if the dropzone is scaled down

// Add to the script setup section near the other state variables
const chatLineWidth = ref(640);

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
    border: isScaledDown.value ? '2px solid #42a5f5' : '2px dashed transparent' // Blue border when scaled
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

const clearChatlog = () => {
  chatlogText.value = '';
  parsedChatLines.value = []; // Clear parsed lines too
};

const parseChatlog = () => {
  const lines = chatlogText.value.split('\n').filter(line => line.trim() !== '');
  parsedChatLines.value = lines.map((line, index) => {
    let processedText = line;
    
    // Strip timestamps if the option is enabled
    if (stripTimestamps.value) {
      processedText = processedText.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, '');
    }
    
    let color: string | undefined = undefined;
    
    // First check for cellphone messages
    const cellphonePattern = colorMappings.find(mapping => 
      mapping.checkPlayerName && mapping.pattern.test(processedText)
    );
    
    if (cellphonePattern && characterName.value) {
      // If it's the player's message, use white color
      if (processedText.startsWith(characterName.value)) {
        color = 'rgb(255, 255, 255)';
      } else {
        // Otherwise use yellow for incoming calls
        color = cellphonePattern.color;
      }
    } else {
      // Check for patterns that should color the entire line
      const fullLinePattern = colorMappings.find(mapping => 
        mapping.fullLine && !mapping.checkPlayerName && mapping.pattern.test(processedText)
      );

      if (fullLinePattern) {
        color = fullLinePattern.color;
      } else {
        // Check for split patterns 
        const splitPattern = colorMappings.find(mapping => 
          mapping.splitPattern && mapping.pattern.test(processedText)
        );

        if (splitPattern && splitPattern.splitPattern && splitPattern.markerColor) {
          const parts = processedText.split(splitPattern.splitPattern);
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
            if (mapping.pattern.test(processedText)) {
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

// Compute chat overlay style
const chatOverlayStyle = computed(() => ({
  transform: `translate(${chatTransform.x}px, ${chatTransform.y}px) scale(${chatTransform.scale})`,
  cursor: isChatDraggingEnabled.value ? (isChatPanning.value ? 'grabbing' : 'grab') : 'default',
  transition: isChatPanning.value ? 'none' : 'transform 0.1s ease-out',
  pointerEvents: (isChatDraggingEnabled.value ? 'auto' : 'none') as 'auto' | 'none'
} as const));

// Replace chatLineStyle with a direct rendering approach
const chatLineStyle = computed(() => (line: ParsedLine, index: number) => {
  // Hard code basic positioning
  return {
    position: 'relative' as const,
    top: 0,
    left: 0,
    marginBottom: '0',
    padding: 0,
    boxSizing: 'border-box' as const,
  };
});

// Update chat overlay styles
const chatStyles = computed(() => {
  return {
    position: 'absolute' as const,
    top: '0',
    left: '0',
    width: '100%',
    height: 'auto',
    // Force the width to be constrained to enforce wrapping at same break points
    maxWidth: `${dropZoneWidth.value}px`, // Match the exact dropzone width
    fontFamily: '"Arial Black", Arial, sans-serif',
    fontSize: '12px',
    lineHeight: '16px',
    transform: `translate(${chatTransform.x}px, ${chatTransform.y}px) scale(${chatTransform.scale})`,
    transformOrigin: 'top left',
    pointerEvents: (isChatDraggingEnabled.value ? 'auto' : 'none') as 'auto' | 'none',
    wordWrap: 'break-word' as const,
    whiteSpace: 'pre-wrap' as const,
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

    // --- Apply CSS-like transform (translate + scale) with center origin ---
    // 1. Translate context to the center of the drawing area (where the image is placed by object-fit: contain)
    ctx.translate(offsetX + drawWidth / 2, offsetY + drawHeight / 2);
    // 2. Apply scaling relative to the center
    ctx.scale(imageTransform.scale, imageTransform.scale);
    // 3. Apply translation relative to the now scaled and centered origin
    ctx.translate(imageTransform.x, imageTransform.y);
    // 4. Draw the image centered at the origin (0,0) of the transformed context
    // The image itself is drawn from its top-left corner (-drawWidth / 2, -drawHeight / 2)
    // relative to the transformed origin, filling the calculated drawWidth/drawHeight.
    ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

    ctx.restore(); // Restore context after drawing image

    // If there are chat lines, render them
    if (parsedChatLines.value.length > 0) {
      ctx.save();
      
      // FIXED: Apply chat transform directly without offset
      // The previous implementation added drop zone position offsets which caused misalignment
      ctx.translate(chatTransform.x, chatTransform.y);
      ctx.scale(chatTransform.scale, chatTransform.scale);

      // Set up text rendering to match exactly with the preview
      ctx.font = '700 12px Arial, sans-serif';
      ctx.textBaseline = 'top';
      ctx.textRendering = 'geometricPrecision';
      ctx.letterSpacing = '0px';
      
      let currentY = 0;
      const TEXT_OFFSET_Y = 1; // Consistent with preview
      const MAX_LINE_CHARS = 80; // Same as preview

      // Helper function to get text color based on content (unchanged)
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

      // Helper function to draw black bar (unchanged)
      const drawBlackBar = (y: number, width: number) => {
        if (showBlackBars.value) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, y, width + 8, 17);
        }
      };

      // Helper functions for text drawing (unchanged)
      const drawTextWithOutline = (text: string, x: number, y: number, color: string, censorType?: CensorType) => {
        const width = ctx.measureText(text).width;
        const TEXT_OFFSET_Y = 1; // Moved declaration here

        // If black bars are enabled, draw the background first
        if (showBlackBars.value) {
          // Adjust bar slightly for better coverage around text, matching shadow spread
          ctx.fillStyle = '#000000';
          ctx.fillRect(x - 2, y, width + 4, 16);
        }

        if (censorType) {
          // Define tempCanvas and context locally for blur effect
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d');
          if (!tempCtx) return; // Guard against null context

          // Set temp canvas size slightly larger to accommodate blur filter
          tempCanvas.width = width + 20; // Add padding for blur
          tempCanvas.height = 16 + 20;

          // Draw the text onto the temporary canvas (offset to center it)
          tempCtx.font = ctx.font;
          tempCtx.fillStyle = color;
          tempCtx.fillText(text, 10, 10 + TEXT_OFFSET_Y); // Draw text with offset

          // Apply blur filter to the temporary canvas
          tempCtx.globalCompositeOperation = 'source-in'; // Keep original text shape
          tempCtx.filter = 'blur(4px)';
          tempCtx.fillStyle = 'black'; // Or use original color if preferred
          tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
          tempCtx.filter = 'none'; // Reset filter
          tempCtx.globalCompositeOperation = 'source-over'; // Reset composite operation

          // Draw the blurred result back to main canvas
          // Adjust draw position to account for the padding added to tempCanvas
          ctx.drawImage(tempCanvas, x - 10, y - 10);
          return; // Make sure to return after drawing blur
        }

        // Normal text rendering - mimic CSS text-shadow using multiple fillText calls
        const shadowOffsets = [
          [-1, -1], [-1, 0], [-1, 1],
          [0, -1],           [0, 1],
          [1, -1], [1, 0], [1, 1]
        ];
        ctx.fillStyle = '#000000'; // Shadow color
        shadowOffsets.forEach(([dx, dy]) => {
          // Apply the same TEXT_OFFSET_Y to shadows as well for consistency
          ctx.fillText(text, x + dx, y + TEXT_OFFSET_Y + dy);
        });

        // Draw the main text on top
        ctx.fillStyle = color;
        ctx.fillText(text, x, y + TEXT_OFFSET_Y);
      };

      // Other helper functions (unchanged)
      const getCensorType = (lineIndex: number, startPos: number, length: number): CensorType | undefined => {
        return censoredRegions.value.find(r => 
          r.lineIndex === lineIndex &&
          ((startPos >= r.startOffset && startPos < r.endOffset) || // Start point is within region
           (startPos + length > r.startOffset && startPos + length <= r.endOffset) || // End point is within region
           (startPos <= r.startOffset && startPos + length >= r.endOffset)) // Region is completely contained
        )?.type;
      };

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

      const drawTextSegment = async (text: string, xPos: number, yPos: number, color: string, lineStartPos: number, lineIndex: number) => {
        // Split text into censored and uncensored segments
        let currentX = xPos;
        let remainingText = text;
        let currentOffset = lineStartPos;
        
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

      // Process each line using width-based wrapping to match CSS behavior
      let lineIndex = 0;
      // FIXED: Use the explicit width from the CSS rule (.chat-line { width: 640px; }) 
      // minus horizontal padding (4px each side) for accurate wrapping.
      const maxTextWidth = chatLineWidth.value - 8; 

      for (const line of parsedChatLines.value) {
        // Get the raw text content, ensuring HTML entities are decoded for measurement
        const parser = new DOMParser();
        const doc = parser.parseFromString(line.text, 'text/html');
        const textContent = doc.body ? doc.body.textContent || '' : line.text; // Use fallback

        // Get the color for this line (using original logic)
        const textColor = getTextColor(textContent);

        // --- Width-based wrapping logic ---
        const words = textContent.split(' ');
        let currentLineText = '';
        let lineStartPosition = 0; // Track character offset within the original line for censoring

        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          // Build the potential next line text (current + space + new word)
          const testLine = currentLineText ? currentLineText + ' ' + word : word;
          const metrics = ctx.measureText(testLine);

          // Check if adding the next word exceeds the max width
          if (metrics.width > maxTextWidth && currentLineText) {
            // The current line is full (without the new word). Draw it.
            const currentLineWidth = ctx.measureText(currentLineText).width;
            drawBlackBar(currentY, currentLineWidth); // Draw bar based on measured width

            // Draw the text segment, handling special lines and censoring
            if (!drawSpecialLine(currentLineText, 4, currentY, lineIndex)) {
              await drawTextSegment(currentLineText, 4, currentY, textColor, lineStartPosition, lineIndex);
            }

            // Move to the next line position on the canvas
            currentY += 16; // Increment Y position based on line height

            // Update the starting character position for the next segment
            // Length of the drawn line + 1 for the space character that caused the wrap
            lineStartPosition += currentLineText.length + 1;

            // Start the new line with the word that didn't fit
            currentLineText = word;

          } else {
            // The word fits, add it to the current line
            currentLineText = testLine;
          }
        }

        // After the loop, draw any remaining text in currentLineText
        if (currentLineText) {
          const currentLineWidth = ctx.measureText(currentLineText).width;
          drawBlackBar(currentY, currentLineWidth);
          if (!drawSpecialLine(currentLineText, 4, currentY, lineIndex)) {
            await drawTextSegment(currentLineText, 4, currentY, textColor, lineStartPosition, lineIndex);
          }
          currentY += 16; // Increment Y for the last line
        }
        // --- End width-based wrapping logic ---

        lineIndex++; // Move to the next original line index (for censoring mapping)
      }

      ctx.restore(); // Restore context after drawing all chat
    } // End if (parsedChatLines.value.length > 0)

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
    selectedText: { ...selectedText },
    stripTimestamps: stripTimestamps.value,
    chatLineWidth: chatLineWidth.value
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
      stripTimestamps.value = state.stripTimestamps || false; // Load the new option
      chatLineWidth.value = state.chatLineWidth || 640;
      
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
  () => ({ ...chatTransform }),
  isImageDraggingEnabled,
  isChatDraggingEnabled,
  showBlackBars,
  censoredRegions,
  () => ({ ...selectedText }),
  stripTimestamps,
  chatLineWidth
], () => {
  saveEditorState();
}, { deep: true });

// Load saved state when component mounts
onMounted(() => {
  loadCharacterName();
  loadEditorState();
  
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
        <v-tooltip text="Strip Timestamps from Chatlog" location="bottom">
          <template v-slot:activator="{ props }">
            <v-switch
              v-bind="props"
              v-model="stripTimestamps"
              color="primary"
              density="compact"
              hide-details
              class="ms-2 me-1 custom-switch"
              @change="parseChatlog" 
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

    <!-- Added Alert Banner for Known Issue -->
    <div class="alert-banner-container">
      <v-alert
        type="error"
        variant="tonal"
        prominent
        closable
        icon="mdi-alert"
        class="ma-0"
        border="start"
      >
        <strong>Known Issue: We are aware of inconsistencies affecting some exported images and are actively working on a fix. Thank you for your patience.</strong>
      </v-alert>
    </div>

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
            <div v-if="parsedChatLines.length > 0 && droppedImageSrc" 
                class="chat-overlay"
                :key="renderKey"
                @mousedown="handleChatMouseDown"
                @mousemove="handleChatMouseMove"
                @mouseup="handleChatMouseUpOrLeave"
                @mouseleave="handleChatMouseUpOrLeave"
                @wheel="handleChatWheel"
                :style="chatStyles"
            >
              <div class="chat-lines-container">
                <div
                  v-for="(line, index) in parsedChatLines"
                  :key="line.id"
                  class="chat-line"
                  :style="{ color: line.color }"
                >
                  <!-- Conditionally wrap the text span for black bars -->
                  <span v-if="showBlackBars" class="with-black-bar">
                    <span class="chat-text" v-html="applyCensoring(line.text, index)" @mouseup="handleTextSelection"></span>
                  </span>
                  <!-- Render text directly if black bars are off -->
                  <span v-else class="chat-text" v-html="applyCensoring(line.text, index)" @mouseup="handleTextSelection"></span>
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
  cursor: text;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}

.with-black-bar {
  background-color: #000000;
  padding: 0 4px;
  display: inline; /* Changed from block to inline */
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





