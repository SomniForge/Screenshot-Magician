import { editorThemeFamilies } from '@/plugins/vuetify';
import type { BuiltInThemeOption } from './types';

const builtInThemeDescriptions: Record<string, string> = {
  default: 'The familiar Screenshot Magician look, now with a dark companion.',
  steel: 'Cool blue-gray tones with a crisp studio feel.',
  ember: 'Warm editorial tones with orange highlights.',
  aurora: 'Sharper neon accents for a vivid control room vibe.',
  dracula: 'Moody purple-forward contrast inspired by the Dracula palette.',
  solarized: 'Balanced classic tones inspired by Solarized light and dark.',
  nord: 'Muted arctic colors with a calm, technical feel.'
};

export const builtInThemeOptions: BuiltInThemeOption[] = Object.entries(editorThemeFamilies).map(([familyId, family]) => ({
  id: familyId,
  name: family.name,
  description: builtInThemeDescriptions[familyId] || `${family.name} in light and dark variants.`,
  lightPreview: [family.light.background, family.light.surface, family.light.primary, family.light.secondary],
  darkPreview: [family.dark.background, family.dark.surface, family.dark.primary, family.dark.secondary]
}));
