import type { ColorMapping } from './types';

export const colorMappings: ColorMapping[] = [
  {
    pattern: /^\*\* \[S: .+? \| CH: .+?\]/i,
    color: 'rgb(214, 207, 140)',
    fullLine: true
  },
  {
    pattern: /\(cellphone\)/i,
    color: 'rgb(251, 247, 36)',
    fullLine: true,
    checkPlayerName: true
  },
  { pattern: /says:|shouts:/i, color: 'rgb(241, 241, 241)' },
  { pattern: /\(Car\)/i, color: 'rgb(251, 247, 36)' },
  { pattern: /^\*/, color: 'rgb(194, 163, 218)' },
  { pattern: /\bwhispers\b/i, color: 'rgb(237, 168, 65)' },
  { pattern: /\bYou paid\b|\bpaid you\b|\byou gave\b|\bgave you\b|\bYou received\b/i, color: 'rgb(86, 214, 75)' },
  { pattern: /g\)/i, color: 'rgb(255, 255, 0)' },
  { pattern: /\[low\]:|\[lower\]:/i, color: 'rgb(150, 149, 149)' },
  {
    pattern: /\[!]/,
    color: 'rgb(255, 255, 255)',
    splitPattern: /(\[!])/,
    markerColor: 'rgb(255, 0, 195)'
  },
  { pattern: /\[INFO]:/, color: 'rgb(255, 255, 255)', splitPattern: /(\[INFO]:)/, markerColor: 'rgb(27, 124, 222)' },
  { pattern: /\[ALERT]/, color: 'rgb(255, 255, 255)', splitPattern: /(\[ALERT])/, markerColor: 'rgb(27, 124, 222)' },
  { pattern: /\[GYM]/, color: 'rgb(255, 255, 255)', splitPattern: /(\[GYM])/, markerColor: 'rgb(22, 106, 189)' },
  { pattern: /\[advertisement]/i, color: 'rgb(127, 239, 43)' },
  { pattern: /\(\( \(PM/i, color: 'rgb(239, 227, 0)' },
  { pattern: /\(\( \(/i, color: 'rgb(139, 138, 138)' },
  { pattern: /\[megaphone]/i, color: 'rgb(241, 213, 3)' },
  { pattern: /\[microphone]/i, color: 'rgb(246, 218, 3)' },
  { pattern: /\[intercom]/i, color: 'rgb(26, 131, 232)' },
  { pattern: /\[Character kill]/, color: 'rgb(240, 0, 0)', splitPattern: /(\[Character kill])/, markerColor: 'rgb(56, 150, 243)' },
  {
    pattern: /\[\$.*g\)/,
    color: 'rgb(255, 255, 0)',
    splitPattern: /(\[\$[^\]]*\])/,
    markerColor: 'rgb(86, 214, 75)'
  },
  {
    pattern: /\(\$.*g\)/,
    color: 'rgb(255, 255, 0)',
    splitPattern: /(\(\$[^\)]*\))/,
    markerColor: 'rgb(86, 214, 75)'
  },
  {
    pattern: / PH: .*g\)/,
    color: 'rgb(255, 255, 0)',
    splitPattern: /( PH: .*)/,
    markerColor: 'rgb(86, 214, 75)'
  }
];

export const defaultSwatchUsageMap = new Map<string, string[]>([
  ['rgb(255, 255, 255)', ['Standard chat text', 'Info and alert body text']],
  ['rgb(0, 0, 0)', ['Black bars and dark masking accents']],
  ['rgb(214, 207, 140)', ['Radio messages']],
  ['rgb(251, 247, 36)', ['Cellphone text', 'Car chat', 'Government chat / g)']],
  ['rgb(241, 241, 241)', ['Normal speech and shouting']],
  ['rgb(194, 163, 218)', ['Roleplay action lines']],
  ['rgb(237, 168, 65)', ['Whispers']],
  ['rgb(86, 214, 75)', ['Money received / paid', 'Payment and phone markers']],
  ['rgb(150, 149, 149)', ['Low or lower chat']],
  ['rgb(255, 0, 195)', ['[!] markers']],
  ['rgb(27, 124, 222)', ['[INFO] and [ALERT] markers']],
  ['rgb(22, 106, 189)', ['[GYM] markers']],
  ['rgb(127, 239, 43)', ['Advertisements']],
  ['rgb(239, 227, 0)', ['Private messages']],
  ['rgb(139, 138, 138)', ['Out of character chat']],
  ['rgb(241, 213, 3)', ['Megaphone']],
  ['rgb(246, 218, 3)', ['Microphone']],
  ['rgb(26, 131, 232)', ['Intercom']],
  ['rgb(240, 0, 0)', ['Character kill text']],
  ['rgb(56, 150, 243)', ['Character kill marker']]
]);

export const formatSwatchLabel = (color: string, fallbackLabel = 'Custom swatch') => {
  const uses = defaultSwatchUsageMap.get(color);
  return uses && uses.length > 0 ? uses.join(' / ') : `${fallbackLabel} (${color})`;
};
