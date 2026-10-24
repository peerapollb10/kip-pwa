// Trash: deleting an item sets `deleted_at`; it stays restorable for TRASH_RETENTION_DAYS, then is purged.
export const TRASH_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export const isTrashed = (item) => Boolean(item.deleted_at);

export function isExpired(item, now = Date.now()) {
  return isTrashed(item) && now - new Date(item.deleted_at).getTime() >= TRASH_RETENTION_DAYS * DAY_MS;
}

// Whole days left before auto-delete (0 = goes on the next purge).
export function daysLeft(item, now = Date.now()) {
  const left = TRASH_RETENTION_DAYS * DAY_MS - (now - new Date(item.deleted_at).getTime());
  return Math.max(0, Math.ceil(left / DAY_MS));
}
