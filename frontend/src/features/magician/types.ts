import type { ComponentPublicInstance } from 'vue';

export interface ParsedLine {
  id: number;
  text: string;
  color?: string;
}

export interface ChatTransform {
  x: number;
  y: number;
  scale: number;
}

export interface ImageOverlay {
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

export enum CensorType {
  None = 'none',
  Invisible = 'invisible',
  BlackBar = 'blackbar',
  Blur = 'blur'
}

export interface CensoredRegion {
  lineIndex: number;
  startOffset: number;
  endOffset: number;
  type: CensorType;
}

export interface CensoredRegionSummary extends CensoredRegion {
  id: string;
  label: string;
  preview: string;
  lineText: string;
}

export interface ManualColorRegion {
  lineIndex: number;
  startOffset: number;
  endOffset: number;
  color: string;
}

export interface ChatOverlay {
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

export interface ImageEffectLayer {
  presetId: string;
  opacity: number;
  seed: number;
  amount?: number;
}

export interface EditorStateSnapshot {
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

export interface ProjectRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  snapshot: EditorStateSnapshot;
}

export interface SaveProjectOptions {
  forceNewProject?: boolean;
  autosave?: boolean;
  refreshProjectList?: boolean;
}

export interface PortableProjectFile {
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

export interface PersistedEditorSession {
  snapshot: EditorStateSnapshot;
  currentProjectId: string | null;
  currentProjectName: string;
}

export interface PersistedEditorSessionRecord {
  id: string;
  state: PersistedEditorSession;
  updatedAt: string;
}

export interface ImageEffectPreset {
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

export interface TutorialStep {
  title: string;
  icon: string;
  description: string;
}

export interface ShortcutGroup {
  title: string;
  items: Array<{
    label: string;
    keys: string[];
  }>;
}

export interface EditorThemePalette {
  background: string;
  surface: string;
  surfaceVariant: string;
  primary: string;
  secondary: string;
}

export interface SavedEditorTheme {
  id: string;
  name: string;
  colors: EditorThemePalette;
  createdAt: string;
}

export interface BuiltInThemeOption {
  id: string;
  name: string;
  description: string;
  lightPreview: string[];
  darkPreview: string[];
}

export interface PendingEditorAction {
  type: 'new-session' | 'load-project';
  projectId?: string;
}

export interface EditorHistoryEntry {
  signature: string;
  snapshot: EditorStateSnapshot;
  currentProjectId: string | null;
  currentProjectName: string;
}

export interface ImageEffectPreviewEntry {
  effect: ImageEffectLayer;
  preset: ImageEffectPreset;
  dataUrl: string;
}

export interface GuideBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

export interface SmartGuideLine {
  kind: 'alignment' | 'spacing';
  orientation: 'vertical' | 'horizontal';
  position: number;
  start: number;
  end: number;
}

export interface SmartGuideLabel {
  text: string;
  x: number;
  y: number;
}

export interface AxisSnap {
  delta: number;
  target: number;
}

export interface SpacingSnap {
  delta: number;
  gap: number;
  before: GuideBounds;
  after: GuideBounds;
}

export interface ColorMapping {
  pattern: RegExp;
  color: string;
  splitPattern?: RegExp;
  markerColor?: string;
  fullLine?: boolean;
  checkPlayerName?: boolean;
}

export interface SwatchEntry {
  color: string;
  label: string;
}

export type ImageOverlayTool = 'move' | 'erase' | 'restore';

export type TemplateRefElement = Element | ComponentPublicInstance | null;
