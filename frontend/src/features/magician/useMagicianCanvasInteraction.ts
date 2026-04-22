import { reactive, ref, type ComputedRef, type Ref } from 'vue';
import type {
  AxisSnap,
  ChatOverlay,
  GuideBounds,
  ImageOverlay,
  ImageOverlayTool,
  SmartGuideLabel,
  SmartGuideLine,
  SpacingSnap,
  TemplateRefElement
} from './types';

interface UseMagicianCanvasInteractionOptions {
  activeChatOverlay: ComputedRef<ChatOverlay | null>;
  activeChatOverlayId: Ref<string | null>;
  activeImageDragTarget: Ref<'base' | 'overlay'>;
  activeImageMaskOverlayId: Ref<string | null>;
  activeImageOverlay: ComputedRef<ImageOverlay | null>;
  activeImageOverlayId: Ref<string | null>;
  chatOverlays: Ref<ChatOverlay[]>;
  chatPanelFlexBasis: Ref<string>;
  clampImageMaskBrushSize: (size: number) => number;
  dropZoneHeight: Ref<number | null>;
  dropZoneWidth: Ref<number | null>;
  droppedImageSrc: Ref<string | null>;
  ensureImageOverlayMaskCanvas: (
    overlay: ImageOverlay,
    fallbackWidth?: number,
    fallbackHeight?: number
  ) => HTMLCanvasElement;
  finishImageOverlayMaskPainting: () => void;
  getCanvasInteractionScale: () => number;
  getImageOverlayCanvasPoint: (
    canvas: HTMLCanvasElement,
    clientX: number,
    clientY: number
  ) => { x: number; y: number; zoneX: number; zoneY: number } | null;
  hideImageMaskBrushPreview: () => void;
  imageElementRef: Ref<HTMLImageElement | null>;
  imageMaskBrushSize: Ref<number>;
  imageOverlays: Ref<ImageOverlay[]>;
  imageOverlayElementMap: Map<string, HTMLElement>;
  imageOverlayTool: Ref<ImageOverlayTool>;
  imageTransform: {
    x: number;
    y: number;
    scale: number;
  };
  isImageDraggingEnabled: Ref<boolean>;
  isImageMaskPainting: Ref<boolean>;
  isImageOverlayBrushActive: ComputedRef<boolean>;
  isChatDraggingEnabled: Ref<boolean>;
  mainContentFlexBasis: Ref<string>;
  parentRowRef: Ref<HTMLElement | null>;
  paintImageOverlayMaskSegment: (
    overlay: ImageOverlay,
    maskCanvas: HTMLCanvasElement,
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ) => void;
  selectChatOverlay: (overlayId: string) => void;
  selectImageOverlay: (overlayId: string | null) => void;
  smartGuidesEnabled: Ref<boolean>;
  smartGuideStrength: Ref<number>;
  updateImageMaskBrushPreview: (overlay: ImageOverlay, zoneX: number, zoneY: number) => void;
}

export const useMagicianCanvasInteraction = (options: UseMagicianCanvasInteractionOptions) => {
  const {
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
    getCanvasInteractionScale,
    getImageOverlayCanvasPoint,
    hideImageMaskBrushPreview,
    imageElementRef,
    imageMaskBrushSize,
    imageOverlays,
    imageOverlayElementMap,
    imageOverlayTool,
    imageTransform,
    isImageDraggingEnabled,
    isImageMaskPainting,
    isImageOverlayBrushActive,
    isChatDraggingEnabled,
    mainContentFlexBasis,
    parentRowRef,
    paintImageOverlayMaskSegment,
    selectChatOverlay,
    selectImageOverlay,
    smartGuidesEnabled,
    smartGuideStrength,
    updateImageMaskBrushPreview
  } = options;

  const isPanning = ref(false);
  const panStart = reactive({ x: 0, y: 0 });
  const panStartImagePos = reactive({ x: 0, y: 0 });
  const pendingImageDragPosition = reactive({ x: 0, y: 0 });
  const isChatPanning = ref(false);
  const chatPanStart = reactive({ x: 0, y: 0 });
  const chatPanStartPos = reactive({ x: 0, y: 0 });
  const pendingChatDragPosition = reactive({ x: 0, y: 0 });
  const smartGuideLines = ref<SmartGuideLine[]>([]);
  const smartGuideLabels = ref<SmartGuideLabel[]>([]);
  const isQBypassHeld = ref(false);
  const isGuideBypassActive = ref(false);
  const chatOverlayElementMap = new Map<string, HTMLElement>();

  const resizeStartX = ref(0);
  const initialChatPanelBasis = ref(25);
  const isResizingChatPanel = ref(false);

  let imageDragAnimationFrame: number | null = null;
  let chatDragAnimationFrame: number | null = null;
  let activeCanvasDragCleanup: (() => void) | null = null;

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
      document.body.style.userSelect = '';
    }

    clearSmartGuides();

    if (imageDragAnimationFrame !== null) {
      window.cancelAnimationFrame(imageDragAnimationFrame);
      imageDragAnimationFrame = null;
    }
  };

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
      imageTransform.scale = Math.min(maxScale, imageTransform.scale + scaleAmount);
    } else {
      imageTransform.scale = Math.max(minScale, imageTransform.scale - scaleAmount);
    }
  };

  const toggleImageDrag = () => {
    isImageDraggingEnabled.value = !isImageDraggingEnabled.value;
    if (isImageDraggingEnabled.value) {
      imageOverlayTool.value = 'move';
    }
    if (isImageDraggingEnabled.value && isChatDraggingEnabled.value) {
      isChatDraggingEnabled.value = false;
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

  const imageMaskPaintLastPoint = reactive({ x: 0, y: 0 });

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

  const handleChatMouseMove = (event: PointerEvent) => {
    if (!isChatPanning.value || !activeChatOverlay.value) return;

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

  const handleChatMouseDown = (event: PointerEvent, overlayId: string) => {
    selectChatOverlay(overlayId);

    const overlay = chatOverlays.value.find((item) => item.id === overlayId);
    if (!overlay || overlay.parsedLines.length === 0) return;

    event.stopPropagation();

    if (overlay.isLocked || !isChatDraggingEnabled.value) return;

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

  const toggleChatDrag = () => {
    isChatDraggingEnabled.value = !isChatDraggingEnabled.value;
    if (isChatDraggingEnabled.value && isImageDraggingEnabled.value) {
      isImageDraggingEnabled.value = false;
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

  const handleResizeMouseMove = (event: MouseEvent) => {
    if (!isResizingChatPanel.value) return;

    event.preventDefault();
    event.stopPropagation();

    const deltaX = resizeStartX.value - event.clientX;
    const parentWidth = parentRowRef.value?.offsetWidth || window.innerWidth;
    const deltaPercent = (deltaX / parentWidth) * 100;
    let newBasis = initialChatPanelBasis.value + deltaPercent;

    const minWidthPx = 250;
    let minWidthPercent = 15;

    if (dropZoneWidth.value && dropZoneWidth.value > 800) {
      const minPercentForCurrentWidth = (minWidthPx / parentWidth) * 100;
      minWidthPercent = Math.max(minWidthPercent, minPercentForCurrentWidth);
    }

    newBasis = Math.max(minWidthPercent, Math.min(newBasis, 50));

    chatPanelFlexBasis.value = `${newBasis}%`;
    mainContentFlexBasis.value = `${100 - newBasis}%`;
  };

  const handleResizeMouseUp = () => {
    isResizingChatPanel.value = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', handleResizeMouseMove);
    document.removeEventListener('mouseup', handleResizeMouseUp);
  };

  const handleResizeMouseDown = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    resizeStartX.value = event.clientX;

    const currentBasis = parseFloat(chatPanelFlexBasis.value);
    initialChatPanelBasis.value = Number.isNaN(currentBasis) ? 25 : currentBasis;

    isResizingChatPanel.value = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleResizeMouseMove);
    document.addEventListener('mouseup', handleResizeMouseUp);
  };

  const disposeCanvasInteraction = () => {
    activeCanvasDragCleanup?.();
    handleImageMouseUpOrLeave();
    handleChatMouseUpOrLeave();
    handleResizeMouseUp();
    hideImageMaskBrushPreview();
    clearSmartGuides();

    if (imageDragAnimationFrame !== null) {
      window.cancelAnimationFrame(imageDragAnimationFrame);
      imageDragAnimationFrame = null;
    }

    if (chatDragAnimationFrame !== null) {
      window.cancelAnimationFrame(chatDragAnimationFrame);
      chatDragAnimationFrame = null;
    }
  };

  return {
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
    handleResizeMouseUp,
    handleWheel,
    isChatPanning,
    isGuideBypassActive,
    isPanning,
    isQBypassHeld,
    pendingChatDragPosition,
    pendingImageDragPosition,
    setChatOverlayElement,
    smartGuideLabels,
    smartGuideLines,
    toggleChatDrag,
    toggleImageDrag
  };
};
