// src/plugins/vuetify.ts
import 'vuetify/styles' // <-- CRITICAL: Imports Vuetify CSS
import { createVuetify, type ThemeDefinition } from 'vuetify'
import * as components from 'vuetify/components' // Often needed if not using auto-import plugin
import * as directives from 'vuetify/directives' // Often needed if not using auto-import plugin
import '@mdi/font/css/materialdesignicons.css' // Ensure icon CSS is imported

const getContrastColor = (hexColor: string) => {
  const hex = hexColor.replace('#', '');
  const red = parseInt(hex.slice(0, 2), 16) / 255;
  const green = parseInt(hex.slice(2, 4), 16) / 255;
  const blue = parseInt(hex.slice(4, 6), 16) / 255;

  const [r, g, b] = [red, green, blue].map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );

  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? '#111111' : '#ffffff';
};

type EditorThemePalette = {
  background: string;
  surface: string;
  surfaceVariant: string;
  primary: string;
  secondary: string;
};

type EditorThemeFamily = {
  name: string;
  light: EditorThemePalette;
  dark: EditorThemePalette;
};

export const createEditorThemeDefinition = (palette: EditorThemePalette): ThemeDefinition => {
  const onBackground = getContrastColor(palette.background);
  const onSurface = getContrastColor(palette.surface);
  const onSurfaceVariant = getContrastColor(palette.surfaceVariant);
  const onPrimary = getContrastColor(palette.primary);
  const onSecondary = getContrastColor(palette.secondary);

  return {
    dark: onBackground === '#ffffff',
    colors: {
      background: palette.background,
      surface: palette.surface,
      'surface-variant': palette.surfaceVariant,
      primary: palette.primary,
      secondary: palette.secondary,
      success: '#4caf50',
      warning: '#fbc02d',
      error: '#ff5252',
      info: '#29b6f6',
      'on-background': onBackground,
      'on-surface': onSurface,
      'on-surface-variant': onSurfaceVariant,
      'on-primary': onPrimary,
      'on-secondary': onSecondary,
    }
  };
};

export const editorThemeFamilies: Record<string, EditorThemeFamily> = {
  default: {
    name: 'Default',
    light: {
      background: '#f4f5f7',
      surface: '#ffffff',
      surfaceVariant: '#edf1f5',
      primary: '#42a5f5',
      secondary: '#7e57c2'
    },
    dark: {
      background: '#111315',
      surface: '#171a1d',
      surfaceVariant: '#23272d',
      primary: '#64b5f6',
      secondary: '#9575cd'
    }
  },
  steel: {
    name: 'Steel',
    light: {
      background: '#eef3f8',
      surface: '#ffffff',
      surfaceVariant: '#dde7f0',
      primary: '#3f83b8',
      secondary: '#5c6bc0'
    },
    dark: {
      background: '#0f1720',
      surface: '#16212c',
      surfaceVariant: '#223140',
      primary: '#74b7ea',
      secondary: '#8ea2ff'
    }
  },
  ember: {
    name: 'Ember',
    light: {
      background: '#fff4ec',
      surface: '#ffffff',
      surfaceVariant: '#ffe0cc',
      primary: '#e76f51',
      secondary: '#f4a261'
    },
    dark: {
      background: '#1a120f',
      surface: '#241915',
      surfaceVariant: '#35231f',
      primary: '#ff8a65',
      secondary: '#ffb56b'
    }
  },
  aurora: {
    name: 'Aurora',
    light: {
      background: '#eff3ff',
      surface: '#ffffff',
      surfaceVariant: '#dde5ff',
      primary: '#4f8cff',
      secondary: '#8b5cf6'
    },
    dark: {
      background: '#0d1320',
      surface: '#141d2f',
      surfaceVariant: '#202b44',
      primary: '#67a7ff',
      secondary: '#a78bfa'
    }
  },
  dracula: {
    name: 'Dracula',
    light: {
      background: '#f7f4ff',
      surface: '#ffffff',
      surfaceVariant: '#ece5ff',
      primary: '#6272a4',
      secondary: '#bd93f9'
    },
    dark: {
      background: '#282a36',
      surface: '#313442',
      surfaceVariant: '#3b3f51',
      primary: '#8be9fd',
      secondary: '#bd93f9'
    }
  },
  solarized: {
    name: 'Solarized',
    light: {
      background: '#fdf6e3',
      surface: '#fffdf7',
      surfaceVariant: '#eee8d5',
      primary: '#268bd2',
      secondary: '#2aa198'
    },
    dark: {
      background: '#002b36',
      surface: '#073642',
      surfaceVariant: '#0f4654',
      primary: '#268bd2',
      secondary: '#2aa198'
    }
  },
  nord: {
    name: 'Nord',
    light: {
      background: '#eceff4',
      surface: '#ffffff',
      surfaceVariant: '#d8dee9',
      primary: '#5e81ac',
      secondary: '#88c0d0'
    },
    dark: {
      background: '#2e3440',
      surface: '#3b4252',
      surfaceVariant: '#434c5e',
      primary: '#81a1c1',
      secondary: '#88c0d0'
    }
  }
};

export const editorThemePresets: Record<string, ThemeDefinition> = Object.entries(editorThemeFamilies).reduce(
  (presets, [familyId, family]) => {
    presets[`${familyId}-light`] = createEditorThemeDefinition(family.light);
    presets[`${familyId}-dark`] = createEditorThemeDefinition(family.dark);
    return presets;
  },
  {} as Record<string, ThemeDefinition>
);

const vuetify = createVuetify({
  components, // Makes components available (if not using auto-import)
  directives, // Makes directives available (if not using auto-import)
  icons: {
    defaultSet: 'mdi',
  },
  // Handle dark theme by default
  theme: {
    defaultTheme: 'default-light',
    themes: editorThemePresets
  },
});

export default vuetify
