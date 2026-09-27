// Theme color — any hex colour the user picks. The portal's `navy` / `navy-light` /
// `navy-dark` Tailwind colours read CSS variables, so setting those three variables
// restyles the whole app. Light and dark shades are derived from the picked colour.
// The choice is remembered per user (keyed by email).

export const DEFAULT_THEME_COLOR = '#16283D';

export const THEME_PRESETS: { label: string; color: string }[] = [
  { label: 'CSC Navy', color: '#16283D' },
  { label: 'CSC Red', color: '#C8102E' },
  { label: 'Midnight', color: '#0B1B2B' },
  { label: 'Harbour Blue', color: '#1E3A5F' },
  { label: 'Emerald', color: '#047857' },
  { label: 'Teal', color: '#0F766E' },
  { label: 'Royal Purple', color: '#5B21B6' },
  { label: 'Burnt Orange', color: '#C2410C' },
  { label: 'Rose', color: '#BE185D' },
  { label: 'Charcoal', color: '#374151' },
];

// Old preset keys saved before custom colours existed.
const LEGACY_KEYS: Record<string, string> = {
  'csc-navy': '#16283D',
  'csc-red': '#C8102E',
  midnight: '#0B1B2B',
  harbour: '#1E3A5F',
};

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;
const storageKey = (email?: string) => (email ? `csc:theme:${email.toLowerCase()}` : 'csc:theme');

export function themeLabel(color: string): string {
  return THEME_PRESETS.find((p) => p.color.toLowerCase() === color.toLowerCase())?.label ?? `Custom (${color.toUpperCase()})`;
}

export function readTheme(email?: string): string {
  try {
    const stored = window.localStorage.getItem(storageKey(email)) ?? window.localStorage.getItem(storageKey());
    if (stored && HEX_PATTERN.test(stored)) return stored;
    if (stored && LEGACY_KEYS[stored]) return LEGACY_KEYS[stored];
  } catch {
    /* storage unavailable — fall through to the default */
  }
  return DEFAULT_THEME_COLOR;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Blends each channel toward `target` (255 = white, 0 = black) by `amount` (0–1).
function mix(rgb: [number, number, number], target: number, amount: number): string {
  return rgb.map((c) => Math.round(c + (target - c) * amount)).join(' ');
}

export function applyTheme(color: string, email?: string): void {
  const hex = HEX_PATTERN.test(color) ? color : DEFAULT_THEME_COLOR;
  const rgb = hexToRgb(hex);
  const root = document.documentElement.style;
  root.setProperty('--navy', rgb.join(' '));
  root.setProperty('--navy-light', mix(rgb, 255, 0.25));
  root.setProperty('--navy-dark', mix(rgb, 0, 0.3));
  try {
    window.localStorage.setItem(storageKey(email), hex);
  } catch {
    /* storage unavailable — theme still applies for this session */
  }
}
