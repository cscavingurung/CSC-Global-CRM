// Theme switch options — the CSC brand navy family plus the CSC Red brand colour.
export type ThemeKey = 'csc-navy' | 'csc-red' | 'midnight' | 'harbour';

export const THEME_OPTIONS: { key: ThemeKey; label: string; swatch: string }[] = [
  { key: 'csc-navy', label: 'CSC Navy', swatch: '#16283D' },
  { key: 'csc-red', label: 'CSC Red', swatch: '#C8102E' },
  { key: 'midnight', label: 'Midnight', swatch: '#0B1B2B' },
  { key: 'harbour', label: 'Harbour Blue', swatch: '#1E3A5F' },
];

const STORAGE_KEY = 'csc:theme';

export function readTheme(): ThemeKey {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'csc-navy' || stored === 'csc-red' || stored === 'midnight' || stored === 'harbour') return stored;
  } catch {
    /* storage unavailable — fall through to the default */
  }
  return 'csc-navy';
}

export function applyTheme(theme: ThemeKey): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* storage unavailable — theme still applies for this session */
  }
}
