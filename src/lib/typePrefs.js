// Which optional content types (Instagram / TikTok / Document) are switched on — off by default.
// Stored per device, like the theme.
import { OPTIONAL_TYPES } from './content.js';

const KEY = 'kip.types';

export function getEnabledTypes(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(KEY) || '[]');
    return Array.isArray(saved) ? saved.filter((t) => OPTIONAL_TYPES.includes(t)) : [];
  } catch {
    return [];
  }
}

export function setEnabledTypes(types, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(types));
  } catch {
    /* private mode — still applies for this session */
  }
}
