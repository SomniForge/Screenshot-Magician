import { reactive, ref } from 'vue';
import { createEditorThemeDefinition, editorThemePresets } from '@/plugins/vuetify';
import { builtInThemeOptions } from './themeConfig';
import { ACTIVE_THEME_STORAGE_KEY, CUSTOM_THEMES_STORAGE_KEY } from './constants';
import type { EditorThemePalette, SavedEditorTheme } from './types';

const normalizeHexColor = (value: string, fallback: string) => {
  const normalized = value.trim();
  return /^#([0-9a-fA-F]{6})$/.test(normalized) ? normalized.toLowerCase() : fallback.toLowerCase();
};

export const getThemeFamilyId = (themeId: string) => themeId.replace(/-(light|dark)$/, '');

const resolveThemeId = (availableThemes: Record<string, unknown>, themeId: string) => {
  if (availableThemes[themeId]) return themeId;

  const legacyThemeMap: Record<string, string> = {
    dark: 'default-light',
    steel: 'steel-light',
    ember: 'ember-light',
    aurora: 'aurora-light'
  };

  return legacyThemeMap[themeId] || 'default-light';
};

const getThemePaletteFromDefinition = (
  availableThemes: Record<string, { colors?: Record<string, string> }>,
  themeId: string
): EditorThemePalette => {
  const definition = availableThemes[themeId] ?? editorThemePresets['default-dark'];
  const colors = definition.colors ?? {};

  return {
    background: colors.background ?? '#121313',
    surface: colors.surface ?? '#1b1d1d',
    surfaceVariant: colors['surface-variant'] ?? '#23272d',
    primary: colors.primary ?? '#64b5f6',
    secondary: colors.secondary ?? '#9575cd'
  };
};

const registerCustomEditorTheme = (
  availableThemes: Record<string, unknown>,
  themeConfig: SavedEditorTheme
) => {
  availableThemes[themeConfig.id] = createEditorThemeDefinition(themeConfig.colors);
};

const readStoredThemes = (): SavedEditorTheme[] => {
  const savedThemes = localStorage.getItem(CUSTOM_THEMES_STORAGE_KEY);
  if (!savedThemes) return [];

  try {
    const parsedThemes = JSON.parse(savedThemes);
    if (!Array.isArray(parsedThemes)) return [];

    return parsedThemes
      .filter((themeConfig) => themeConfig && typeof themeConfig.id === 'string' && typeof themeConfig.name === 'string')
      .map((themeConfig) => ({
        id: themeConfig.id,
        name: themeConfig.name,
        createdAt: themeConfig.createdAt || new Date().toISOString(),
        colors: {
          background: normalizeHexColor(themeConfig.colors?.background || '', '#121313'),
          surface: normalizeHexColor(themeConfig.colors?.surface || '', '#1b1d1d'),
          surfaceVariant: normalizeHexColor(themeConfig.colors?.surfaceVariant || '', '#232626'),
          primary: normalizeHexColor(themeConfig.colors?.primary || '', '#42a5f5'),
          secondary: normalizeHexColor(themeConfig.colors?.secondary || '', '#7e57c2')
        }
      }));
  } catch (error) {
    console.error('Error loading custom editor themes:', error);
    return [];
  }
};

const createSavedTheme = (name: string, palette: EditorThemePalette): SavedEditorTheme => ({
  id: `custom-theme-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name,
  createdAt: new Date().toISOString(),
  colors: {
    background: normalizeHexColor(palette.background, '#f4f5f7'),
    surface: normalizeHexColor(palette.surface, '#ffffff'),
    surfaceVariant: normalizeHexColor(palette.surfaceVariant, '#edf1f5'),
    primary: normalizeHexColor(palette.primary, '#42a5f5'),
    secondary: normalizeHexColor(palette.secondary, '#7e57c2')
  }
});

export const useMagicianThemes = (
  vuetifyTheme: {
    themes: { value: Record<string, { colors?: Record<string, string> }> };
    global: { name: { value: string } };
  }
) => {
  const customEditorThemes = ref<SavedEditorTheme[]>([]);
  const themeDraftName = ref('');
  const themeSharePayload = ref('');
  const themeImportPayload = ref('');
  const activeEditorThemeId = ref('default-light');
  const themeDraftColors = reactive<EditorThemePalette>({
    background: '#f4f5f7',
    surface: '#ffffff',
    surfaceVariant: '#edf1f5',
    primary: '#42a5f5',
    secondary: '#7e57c2'
  });

  const saveCustomEditorThemes = () => {
    localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify(customEditorThemes.value));
  };

  const applyEditorTheme = (themeId: string) => {
    const resolvedThemeId = resolveThemeId(vuetifyTheme.themes.value, themeId);
    if (!vuetifyTheme.themes.value[resolvedThemeId]) return;

    activeEditorThemeId.value = resolvedThemeId;
    vuetifyTheme.global.name.value = resolvedThemeId;
    localStorage.setItem(ACTIVE_THEME_STORAGE_KEY, resolvedThemeId);
  };

  const loadEditorThemes = () => {
    customEditorThemes.value = readStoredThemes();
    customEditorThemes.value.forEach((themeConfig) => registerCustomEditorTheme(vuetifyTheme.themes.value, themeConfig));

    const storedThemeId = localStorage.getItem(ACTIVE_THEME_STORAGE_KEY) || 'default-light';
    if (vuetifyTheme.themes.value[storedThemeId]) {
      applyEditorTheme(storedThemeId);
    } else {
      applyEditorTheme(resolveThemeId(vuetifyTheme.themes.value, storedThemeId));
    }

    Object.assign(
      themeDraftColors,
      getThemePaletteFromDefinition(vuetifyTheme.themes.value, activeEditorThemeId.value)
    );
  };

  const populateThemeDraftFromActiveTheme = () => {
    Object.assign(
      themeDraftColors,
      getThemePaletteFromDefinition(vuetifyTheme.themes.value, activeEditorThemeId.value)
    );
    themeDraftName.value = '';
  };

  const saveCustomEditorTheme = () => {
    const trimmedName = themeDraftName.value.trim();
    if (!trimmedName) return;

    const customTheme = createSavedTheme(trimmedName, themeDraftColors);
    customEditorThemes.value.push(customTheme);
    registerCustomEditorTheme(vuetifyTheme.themes.value, customTheme);
    saveCustomEditorThemes();
    applyEditorTheme(customTheme.id);
    themeDraftName.value = '';
  };

  const deleteCustomEditorTheme = (themeId: string) => {
    customEditorThemes.value = customEditorThemes.value.filter((themeConfig) => themeConfig.id !== themeId);
    delete vuetifyTheme.themes.value[themeId];
    saveCustomEditorThemes();

    if (activeEditorThemeId.value === themeId) {
      applyEditorTheme('default-light');
    }
  };

  const exportActiveTheme = () => {
    const customTheme = customEditorThemes.value.find((themeConfig) => themeConfig.id === activeEditorThemeId.value);
    const payload = customTheme
      ? customTheme
      : {
          id: activeEditorThemeId.value,
          name: builtInThemeOptions.find((themeOption) => themeOption.id === getThemeFamilyId(activeEditorThemeId.value))?.name || 'Theme',
          createdAt: new Date().toISOString(),
          colors: getThemePaletteFromDefinition(vuetifyTheme.themes.value, activeEditorThemeId.value)
        };

    themeSharePayload.value = JSON.stringify(payload, null, 2);
  };

  const importSharedTheme = () => {
    if (!themeImportPayload.value.trim()) return;

    try {
      const importedTheme = JSON.parse(themeImportPayload.value);
      const trimmedName = typeof importedTheme.name === 'string' ? importedTheme.name.trim() : '';
      if (!trimmedName) return;

      const themeConfig = createSavedTheme(trimmedName, {
        background: importedTheme.colors?.background || '',
        surface: importedTheme.colors?.surface || '',
        surfaceVariant: importedTheme.colors?.surfaceVariant || '',
        primary: importedTheme.colors?.primary || '',
        secondary: importedTheme.colors?.secondary || ''
      });

      customEditorThemes.value.push(themeConfig);
      registerCustomEditorTheme(vuetifyTheme.themes.value, themeConfig);
      saveCustomEditorThemes();
      applyEditorTheme(themeConfig.id);
      themeImportPayload.value = '';
    } catch (error) {
      console.error('Error importing shared theme:', error);
    }
  };

  return {
    activeEditorThemeId,
    applyEditorTheme,
    customEditorThemes,
    deleteCustomEditorTheme,
    exportActiveTheme,
    getThemeFamilyId,
    importSharedTheme,
    loadEditorThemes,
    populateThemeDraftFromActiveTheme,
    saveCustomEditorTheme,
    themeDraftColors,
    themeDraftName,
    themeImportPayload,
    themeSharePayload
  };
};
