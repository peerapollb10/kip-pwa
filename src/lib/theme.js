// Light is the default; Dark only when the user picks it in Settings.
// index.html applies the stored theme before first paint (no flash) — keep KEY in sync there.
const KEY = 'kip.theme';
const THEME_COLOR = { light: '#f8fafc', dark: '#0b0b0f' };

export function getTheme(storage = globalThis.localStorage) {
  try {
    return storage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
}

export function setTheme(theme, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, theme);
  } catch {
    /* private mode — still apply for this session */
  }
  applyTheme(theme);
}
