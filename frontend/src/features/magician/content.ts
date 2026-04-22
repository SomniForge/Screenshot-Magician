import type { ShortcutGroup, TutorialStep } from './types';

export const tutorialSteps: TutorialStep[] = [
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

export const shortcutGroups: ShortcutGroup[] = [
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
