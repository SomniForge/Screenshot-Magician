// src/components/Magician.vue

<script setup lang="ts">
import { ref, computed, reactive } from 'vue';
import { type CSSProperties } from 'vue';

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
}

// Replace first/last name with single character name
const characterName = ref('');

// Update color mappings to handle phone calls
const colorMappings: ColorMapping[] = [
  { pattern: /says:|shouts:/i, color: 'rgb(241, 241, 241)' },
  { pattern: /\(Car\)/i, color: 'rgb(251, 247, 36)' },
  { pattern: /^\*/, color: 'rgb(194, 163, 218)' },
  { pattern: /\bwhispers\b/i, color: 'rgb(237, 168, 65)' },
  { pattern: /\bYou paid\b|\bpaid you\b|\byou gave\b|\bgave you\b|\bYou received\b/i, color: 'rgb(86, 214, 75)' },
  { pattern: /g\)/i, color: 'rgb(255, 255, 0)' },
  { pattern: /\[low\]:|\[lower\]:/i, color: 'rgb(150, 149, 149)' },
  // Phone call pattern will be handled separately in the parsing logic
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
    
    // Special handling for phone calls
    if (line.toLowerCase().includes('says (cellphone)')) {
      if (characterName.value && line.startsWith(characterName.value)) {
        color = 'rgb(255, 255, 255)';
      } else {
        color = 'rgb(251, 247, 36)';
      }
    } else {
      // Check other patterns if it's not a phone call
      for (const mapping of colorMappings) {
        if (mapping.pattern.test(line)) {
          color = mapping.color;
          break;
        }
      }
    }
    
    return {
      id: index,
      text: line,
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
};

// --- Chat Dragging Handlers ---
const handleChatMouseDown = (event: MouseEvent) => {
  if (!isChatDraggingEnabled.value || parsedChatLines.value.length === 0) return;
  event.preventDefault();
  isChatPanning.value = true;
  chatPanStart.x = event.clientX;
  chatPanStart.y = event.clientY;
  chatPanStartPos.x = chatTransform.x;
  chatPanStartPos.y = chatTransform.y;
  document.body.style.userSelect = 'none';
};

const handleChatMouseMove = (event: MouseEvent) => {
  if (!isChatPanning.value) return;
  const deltaX = event.clientX - chatPanStart.x;
  const deltaY = event.clientY - chatPanStart.y;
  chatTransform.x = chatPanStartPos.x + deltaX;
  chatTransform.y = chatPanStartPos.y + deltaY;
};

const handleChatMouseUpOrLeave = () => {
  if (isChatPanning.value) {
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
};

// Compute chat overlay style
const chatOverlayStyle = computed(() => ({
  transform: `translate(${chatTransform.x}px, ${chatTransform.y}px) scale(${chatTransform.scale})`,
  cursor: isChatDraggingEnabled.value ? (isChatPanning.value ? 'grabbing' : 'grab') : 'default',
  transition: isChatPanning.value ? 'none' : 'transform 0.1s ease-out'
}));

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

// Update applyCensoring with debug logging
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
  
  // Log the final result for debugging
  console.log('Final censored text:', result);
  
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

// Function to save the final image
const saveImage = async () => {
  if (!droppedImageSrc.value) {
    console.warn('No image to save');
    return;
  }

  try {
    // Create a canvas element
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

    // First, determine the scale needed to fit the image in the viewport
    const viewportRatio = canvas.width / canvas.height;
    const imageRatio = img.naturalWidth / img.naturalHeight;
    
    let baseWidth, baseHeight;
    if (imageRatio > viewportRatio) {
      // Image is wider than viewport ratio
      baseWidth = canvas.width;
      baseHeight = canvas.width / imageRatio;
    } else {
      // Image is taller than viewport ratio
      baseHeight = canvas.height;
      baseWidth = canvas.height * imageRatio;
    }

    // Apply user's scale and position
    const scaledWidth = baseWidth * imageTransform.scale;
    const scaledHeight = baseHeight * imageTransform.scale;
    
    // Center the image and apply user's translation
    const x = (canvas.width - scaledWidth) / 2 + imageTransform.x;
    const y = (canvas.height - scaledHeight) / 2 + imageTransform.y;

    // Draw the image
    ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
    ctx.restore();

    // If there are chat lines, render them
    if (parsedChatLines.value.length > 0) {
      ctx.save();
      // Calculate drop zone offset (centered in canvas)
      const dzWidth = dropZoneWidth.value || 800;
      const dzHeight = dropZoneHeight.value || 600;
      const dropZoneLeft = (canvas.width - dzWidth) / 2;
      const dropZoneTop = (canvas.height - dzHeight) / 2;
      ctx.translate(dropZoneLeft + chatTransform.x, dropZoneTop + chatTransform.y + 8);
      ctx.scale(chatTransform.scale, chatTransform.scale);
      ctx.font = '12px "Arial Black", Arial, sans-serif';
      ctx.textBaseline = 'top';
      ctx.textRendering = 'geometricPrecision';
      parsedChatLines.value.forEach((line, index) => {
        const barY = index * 16;
        const textY = barY + 2;
        const x = 4;
        // Gather regions for this line
        const regions = censoredRegions.value
          .filter(region => region.lineIndex === index)
          .sort((a, b) => a.startOffset - b.startOffset);
        // Build up segments (uncensored/censored)
        let lastIndex = 0;
        let currentX = x;
        // For bar: measure the full text width
        let barWidth = ctx.measureText(line.text).width;
        if (showBlackBars.value) {
          ctx.save();
          ctx.fillStyle = '#000000';
          ctx.fillRect(x - 2, barY, barWidth + 8, 16);
          ctx.restore();
        }
        // Draw each segment
        for (let r = 0; r <= regions.length; r++) {
          const region = regions[r];
          const segStart = lastIndex;
          const segEnd = region ? region.startOffset : line.text.length;
          // Draw uncensored segment
          if (segEnd > segStart) {
            const segText = line.text.slice(segStart, segEnd);
            ctx.save();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.lineJoin = 'miter';
            ctx.miterLimit = 2;
            ctx.strokeText(segText, currentX, textY);
            ctx.fillStyle = line.color || 'white';
            ctx.fillText(segText, currentX, textY);
            ctx.restore();
            currentX += ctx.measureText(segText).width;
          }
          if (region) {
            // Draw censored segment
            const censoredText = line.text.slice(region.startOffset, region.endOffset);
            const censorWidth = ctx.measureText(censoredText).width;
            switch (region.type) {
              case CensorType.Invisible:
                // Skip drawing, just advance
                break;
              case CensorType.BlackBar:
                ctx.save();
                ctx.fillStyle = '#000000';
                ctx.fillRect(currentX, barY, censorWidth, 16);
                ctx.restore();
                break;
              case CensorType.Blur:
                ctx.save();
                ctx.filter = 'blur(5px)';
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 2;
                ctx.lineJoin = 'miter';
                ctx.miterLimit = 2;
                ctx.strokeText(censoredText, currentX, textY);
                ctx.fillStyle = line.color || 'white';
                ctx.fillText(censoredText, currentX, textY);
                ctx.filter = 'none';
                ctx.restore();
                break;
            }
            currentX += censorWidth;
            lastIndex = region.endOffset;
          }
        }
      });
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
        <v-tooltip text="Import Layer Image" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" icon="mdi-layers-search"></v-btn>
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
          style="max-width: 100px;"
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
          style="max-width: 100px;"
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
        <v-tooltip text="Enable Layer Drag" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" icon="mdi-layers-triple-outline"></v-btn> <!-- Placeholder icon -->
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
        <v-tooltip text="Create Layer" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" icon="mdi-layers-plus"></v-btn>
          </template>
        </v-tooltip>
        <v-tooltip text="Remove Layer" location="bottom">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" icon="mdi-layers-minus"></v-btn>
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
              :style="{
                transform: `translateY(${index * 16}px)`,
              }"
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
  display: inline-block;
  white-space: nowrap;
  height: 16px; /* Fixed height for each line container */
}

.chat-line {
  position: relative;
  display: inline-block;
  font-family: 'Arial Black', sans-serif;
  font-size: 12px;
  line-height: 16px; /* Match container height */
  padding: 0 4px;
  white-space: pre;
  pointer-events: none;
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

</style>




