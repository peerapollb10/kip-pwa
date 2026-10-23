import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const IMAGE_BUCKET = 'kip-images';

export const SUPPORT = {
  line: import.meta.env.VITE_SUPPORT_LINE_URL || '#',
  email: import.meta.env.VITE_SUPPORT_EMAIL || 'support@kip.app',
};
