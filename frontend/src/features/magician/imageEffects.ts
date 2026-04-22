import type { ImageEffectPreset } from './types';

export const IMAGE_EFFECT_PRESETS: ImageEffectPreset[] = [
  {
    id: 'film-grain',
    name: 'Film Grain',
    description: 'Adds fine monochrome grain for a gritty, cinematic finish.',
    blendMode: 'overlay',
    defaultOpacity: 0.32,
    supportsSeed: true
  },
  {
    id: 'inverse',
    name: 'Inverse',
    description: 'Inverts the screenshot colors so dark tones become light and vice versa.',
    blendMode: 'difference',
    defaultOpacity: 1,
    supportsSeed: false,
    supportsOpacity: false
  },
  {
    id: 'darken',
    name: 'Darken',
    description: 'Pushes a smoky dark wash over the frame without crushing every highlight.',
    blendMode: 'darken',
    defaultOpacity: 0.42,
    supportsSeed: true
  },
  {
    id: 'dust-scratches',
    name: 'Dust & Scratches',
    description: 'Layers specks and hairline scratches for an aged-photo look.',
    blendMode: 'screen',
    defaultOpacity: 0.24,
    supportsSeed: true
  },
  {
    id: 'vignette',
    name: 'Vignette',
    description: 'Darkens the edges to push attention toward the center.',
    blendMode: 'multiply',
    defaultOpacity: 0.48,
    supportsSeed: false
  },
  {
    id: 'scanlines',
    name: 'Scanlines',
    description: 'Adds subtle horizontal lines for a harsh broadcast feel.',
    blendMode: 'multiply',
    defaultOpacity: 0.22,
    supportsSeed: false
  },
  {
    id: 'vhs',
    name: 'VHS',
    description: 'Adds tracking noise, chroma drift, scanlines, and tape grime for a lo-fi cassette look.',
    blendMode: 'overlay',
    defaultOpacity: 0.42,
    supportsSeed: true
  },
  {
    id: 'cctv',
    name: 'CCTV',
    description: 'Pushes the frame into high-contrast surveillance monochrome with scanlines, noise, and adjustable lens curvature.',
    blendMode: 'source-over',
    defaultOpacity: 1,
    supportsSeed: true,
    kind: 'scene',
    supportsAmount: true,
    amountLabel: 'Lens Curve',
    defaultAmount: 0.34,
    amountMin: 0,
    amountMax: 1,
    amountStep: 0.01
  }
];

export const imageEffectPresetMap = new Map(IMAGE_EFFECT_PRESETS.map((preset) => [preset.id, preset]));
