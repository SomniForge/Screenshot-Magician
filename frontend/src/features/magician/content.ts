import type { ShortcutGroup, TutorialStep } from './types';

export const tutorialSteps: TutorialStep[] = [
  {
    title: 'Build A Demo Scene',
    icon: 'mdi-image-plus-outline',
    description: 'Start with a safe demo project so you can touch the editor without risking real work.',
    actionLabel: 'Load Demo Project',
    completionHint: 'A base screenshot, chat draft, and image layer will appear in the editor.',
    target: 'canvas',
    task: 'Load the demo project, then look at the canvas and layer panels.'
  },
  {
    title: 'Parse A Chat Layer',
    icon: 'mdi-message-plus-outline',
    description: 'Chat starts as raw text. Parsing turns it into a styled, movable layer on the screenshot.',
    actionLabel: 'Parse Demo Chat',
    completionHint: 'The demo chat becomes a layer and automatic GTA World colors are applied.',
    target: 'chat-panel',
    task: 'Use Parse or Ctrl+Enter to create the chat layer.'
  },
  {
    title: 'Move And Scale',
    icon: 'mdi-cursor-move',
    description: 'Turn on chat movement with the highlighted toolbar button, or double-click the chat directly on the canvas. Then drag it, scroll to scale it, or nudge it with the arrow keys.',
    actionLabel: 'Enable Chat Move',
    completionHint: 'The chat move button uses the message-lock icon. Double-clicking the chat is the fastest way to enable it from the canvas.',
    target: 'canvas',
    task: 'Enable chat movement, then move the chat layer slightly so it sits where you want it.'
  },
  {
    title: 'Censor Sensitive Text',
    icon: 'mdi-eye-off-outline',
    description: 'Select text in the chat editor, then use the censor controls to hide it with a bar, blur, or invisible text.',
    actionLabel: 'Censor Demo Phrase',
    completionHint: 'A black bar is applied to one demo phrase, and it appears in the censor review list.',
    target: 'chat-panel',
    task: 'Apply censoring to the highlighted demo phrase.'
  },
  {
    title: 'Add Polish',
    icon: 'mdi-image-filter-center-focus',
    description: 'Effects and image layers help make the screenshot feel finished instead of flat.',
    actionLabel: 'Add Demo Polish',
    completionHint: 'A vignette effect and demo overlay are enabled so you can inspect layer controls.',
    target: 'utility-panel',
    task: 'Review the image layer list and the effect indicator.'
  },
  {
    title: 'Finish The Demo',
    icon: 'mdi-content-save-outline',
    description: 'You now have a complete demo composition in the editor. Save it as a project or export a PNG when you are ready.',
    actionLabel: 'Mark Demo Ready',
    completionHint: 'The demo remains in the editor as an unsaved project you can keep experimenting with.',
    target: 'project',
    task: 'Finish the walkthrough, then keep editing or save/export the demo.'
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
