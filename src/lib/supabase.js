import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const IMAGE_BUCKET = 'kip-images';
export const SLIP_BUCKET = 'payment-slips';

// PromptPay account that receives manual QR payments (phone / national ID / e-wallet).
export const PROMPTPAY = {
  id: import.meta.env.VITE_PROMPTPAY_ID || '',
  name: import.meta.env.VITE_PROMPTPAY_NAME || '',
};

export const SUPPORT = {
  line: import.meta.env.VITE_SUPPORT_LINE_URL || '#',
  email: import.meta.env.VITE_SUPPORT_EMAIL || 'support@kip.app',
};
