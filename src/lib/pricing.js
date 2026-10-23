// Stepped dynamic pricing — shared by the client UI and the /api/checkout function.
// Prices are in THB.

export const FULL_PRICE = { month: 49, year: 490 };
export const FREE_ITEM_LIMIT = 50;
export const URGENCY_THRESHOLD = 50;

export const TIERS = [
  { tier: 1, start: 0, end: 100, month: 19, year: 190 },
  { tier: 2, start: 100, end: 300, month: 29, year: 290 },
  { tier: 3, start: 300, end: 600, month: 39, year: 390 },
  { tier: 4, start: 600, end: Infinity, month: 49, year: 490 },
];

export function getTier(tierNumber) {
  return TIERS.find((t) => t.tier === tierNumber) ?? TIERS[TIERS.length - 1];
}

// proCount = slots already claimed. The next subscriber is number proCount + 1.
export function getPricingStatus(proCount) {
  const count = Math.max(0, Math.floor(Number(proCount) || 0));
  const current = TIERS.find((t) => count < t.end);
  const remaining = current.end === Infinity ? null : current.end - count;
  const size = current.end - current.start;
  const showUrgency = remaining !== null && remaining <= URGENCY_THRESHOLD;
  return {
    tier: current.tier,
    price: { month: current.month, year: current.year },
    fullPrice: FULL_PRICE,
    remaining,
    showUrgency,
    progress: showUrgency ? (count - current.start) / size : null,
    isDiscounted: current.month < FULL_PRICE.month,
  };
}

// Existing subscribers keep their locked tier (grandfathering); new ones get the current tier.
export function resolveCheckoutPrice({ proCount, interval, lockedTier }) {
  if (interval !== 'month' && interval !== 'year') throw new Error('INVALID_INTERVAL');
  const tier = lockedTier ? getTier(lockedTier) : getTier(getPricingStatus(proCount).tier);
  return { tier: tier.tier, amount: tier[interval] };
}

// Mirrors public.is_pro(): tier 'pro' and not expired; null pro_until = Lifetime.
export function isPro(profile, now = new Date()) {
  if (profile?.subscription_tier !== 'pro') return false;
  return !profile.pro_until || new Date(profile.pro_until) > now;
}
