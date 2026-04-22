import type { Ref } from 'vue';
import type { ImageOverlay, ImageOverlayTool, TemplateRefElement } from './types';

interface ImageMaskBrushPreviewState {
  visible: boolean;
  x: number;
  y: number;
  diameter: number;
}

interface UseMagicianImageOverlayRuntimeOptions {
  activeImageMaskOverlayId: Ref<string | null>;
  clampImageMaskBrushSoftness: (softness: number) => number;
  clampImageMaskBrushStrength: (strength: number) => number;
  dropZoneRef: Ref<TemplateRefElement | HTMLElement | null>;
  getCanvasInteractionScale: () => number;
  imageMaskBrushPreview: ImageMaskBrushPreviewState;
  imageMaskBrushSize: Ref<number>;
  imageMaskBrushSoftness: Ref<number>;
  imageMaskBrushStrength: Ref<number>;
  imageOverlayTool: Ref<ImageOverlayTool>;
  imageOverlays: Ref<ImageOverlay[]>;
  isImageMaskPainting: Ref<boolean>;
}

export const useMagicianImageOverlayRuntime = (options: UseMagicianImageOverlayRuntimeOptions) => {
  const {
    activeImageMaskOverlayId,
    clampImageMaskBrushSoftness,
    clampImageMaskBrushStrength,
    dropZoneRef,
    getCanvasInteractionScale,
    imageMaskBrushPreview,
    imageMaskBrushSize,
    imageMaskBrushSoftness,
    imageMaskBrushStrength,
    imageOverlayTool,
    imageOverlays,
    isImageMaskPainting
  } = options;

  const imageOverlaySourceImageCache = new Map<string, HTMLImageElement>();
  const imageOverlaySourceImageLoadCache = new Map<string, Promise<HTMLImageElement>>();
  const imageOverlayMaskCanvasMap = new Map<string, HTMLCanvasElement>();
  const imageOverlayMaskSerializeTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const imageOverlayElementMap = new Map<string, HTMLElement>();

  const loadHtmlImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 96)}`));
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

    const request = loadHtmlImage(src).then((image) => {
      imageOverlaySourceImageCache.set(src, image);
      imageOverlaySourceImageLoadCache.delete(src);
      return image;
    }).catch((error) => {
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

  const setImageOverlayElement = (overlayId: string, element: TemplateRefElement) => {
    if (element instanceof HTMLCanvasElement) {
      imageOverlayElementMap.set(overlayId, element);
      void renderImageOverlayCanvas(overlayId);
      return;
    }

    imageOverlayElementMap.delete(overlayId);
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

  const disposeImageOverlayRuntime = () => {
    imageOverlayMaskSerializeTimers.forEach((timer) => clearTimeout(timer));
    imageOverlayMaskSerializeTimers.clear();
    imageOverlayMaskCanvasMap.clear();
    imageOverlayElementMap.clear();
  };

  return {
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
  };
};
